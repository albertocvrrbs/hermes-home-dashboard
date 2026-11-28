// Pure half of the board chat (no SDK imports, so node --test loads it): turning gateway
// transcript rows / REST messages into panel rows, and building the prompt a board sends.
import type { BoardDoc } from "./model";

export type ChatRole = "user" | "assistant" | "tool";

export interface ChatRow {
  key: string;
  role: ChatRole;
  text: string;
  t?: number;
  /** Tool rows: the tool names, collapsed into one line. */
  tools?: string[];
  /** Tool rows: what those tools mean, one entry per kind of work (what the panel shows). */
  acts?: ToolAct[];
}

export interface RawRow {
  role?: string; text?: string | null; content?: unknown; timestamp?: number | null;
  row_id?: number | null; name?: string | null; tool_name?: string | null;
  tool_calls?: { function?: { name?: string; arguments?: unknown }; name?: string }[] | null;
  args?: unknown;
  row_kind?: string;
}

const MARKER = /^\s*\[board:[a-z0-9]{8}\]\s*/;
const SELECTION_TAIL = /\s*\([^():\n]{1,24}: [a-z0-9$]{1,12}(?:, [a-z0-9$]{1,12})*\)\s*$/;

// Plumbing that says nothing to the reader: schema lookups.
const QUIET = new Set(["tool_describe", "tool_search"]);

function parseArgs(a: unknown): unknown {
  if (typeof a !== "string") return a;
  try { return JSON.parse(a); } catch { return null; }
}

/** The calls worth showing for one tool step: deferred `tool_call` batches name their tools. */
function toolCalls(name: string, args: unknown): { name: string; args: unknown }[] {
  if (!name || QUIET.has(name)) return [];
  if (name === "tool_call") {
    const calls = (args as { calls?: { name?: unknown; arguments?: unknown }[] } | null)?.calls;
    const inner = Array.isArray(calls)
      ? calls.filter((c) => typeof c?.name === "string" && c.name).map((c) => ({ name: c.name as string, args: parseArgs(c.arguments) }))
      : [];
    return inner.length ? inner : [{ name, args }];
  }
  return [{ name, args }];
}

function textOf(r: RawRow): string {
  if (typeof r.text === "string") return r.text;
  const c = r.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c.map((p) => (p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : ""))
      .filter(Boolean).join("\n");
  }
  return "";
}

/** Tool steps in a row fold into ONE line, however many calls there were. */
function foldTools(out: ChatRow[], key: string, t: number | undefined, calls: { name: string; args: unknown }[]): void {
  let row = out[out.length - 1];
  if (row?.role !== "tool") { row = { key, role: "tool", text: "", t, tools: [], acts: [] }; out.push(row); }
  calls.forEach((c) => { if (!row.tools!.includes(c.name)) row.tools!.push(c.name); });
  mergeActs(row.acts!, calls.map((c) => toolAct(c.name, c.args)));
}

/** Gateway rows / REST messages → what the panel shows: user and assistant text, tool calls
 *  folded into one quiet line between them. Oldest first. */
export function toChatRows(raw: RawRow[]): ChatRow[] {
  const out: ChatRow[] = [];
  raw.forEach((r, i) => {
    const role = r.role;
    const key = r.row_id != null ? `r${r.row_id}` : `i${i}-${r.timestamp ?? ""}`;
    const t = typeof r.timestamp === "number" ? r.timestamp : undefined;
    if (r.row_kind === "compaction") return;
    if (role === "tool") {
      const calls = toolCalls(r.name || r.tool_name || "tool", r.args);
      if (!calls.length) return;
      foldTools(out, key, t, calls);
      return;
    }
    if (role !== "user" && role !== "assistant") return;
    let text = textOf(r).trim();
    // the board marker and the "(selected: ids)" tail are for Hermes, not for the reader
    if (role === "user") text = text.replace(MARKER, "").replace(SELECTION_TAIL, "");
    const calls = (r.tool_calls ?? []).flatMap((c) => toolCalls(c?.function?.name || c?.name || "", parseArgs(c?.function?.arguments)));
    if (text) out.push({ key, role, text, t });
    if (calls.length) foldTools(out, `${key}c`, t, calls);
  });
  return out;
}

/** The prompt as the session receives it: the board marker (it links a new session) and the
 *  selected item ids, so Hermes knows what "this" means. */
export function boardPrompt(doc: BoardDoc, text: string, selected: string[], selectedLabel: string): string {
  const sel = selected.filter((id) => doc.items[id]);
  return `[board:${doc.id}] ${text.trim()}${sel.length ? ` (${selectedLabel}: ${sel.join(", ")})` : ""}`;
}


// ── tool labels ───────────────────────────────────────────────────────────
// Tool names are plumbing (`board_apply`, `skill_view`, `terminal`). The chat panel shows what the
// step means, one friendly label per kind of work.
export type ToolKind =
  | "readBoard" | "editBoard" | "viewBoard" | "skill" | "command" | "readFile" | "editFile"
  | "search" | "web" | "image" | "plan" | "memory" | "delegate" | "other";

export interface ToolAct { kind: ToolKind; /** board edits: how many changes the call carried */ n?: number }

const EXACT: Record<string, ToolKind> = {
  board_read: "readBoard", board_apply: "editBoard", board_render: "viewBoard", board_component: "editBoard",
  skill_view: "skill", skills_list: "skill", skill_manage: "skill",
  terminal: "command", process_manage: "command", execute_code: "command",
  read_file: "readFile", write_file: "editFile", patch: "editFile",
  search_files: "search", web_search: "web", web_extract: "web",
  vision_analyze: "image", image_generate: "image",
  todo: "plan", todo_list: "plan", memory: "memory", delegate_task: "delegate",
};

/** `mcp__server__tool` and `connectors__app__tool` come down to their last segment. */
function bare(name: string): string {
  const parts = name.split("__").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function toolKind(name: string): ToolKind {
  const n = name.trim().toLowerCase();
  if (EXACT[n]) return EXACT[n];
  const b = bare(n);
  if (EXACT[b]) return EXACT[b];
  if (/^browser_|^firecrawl_|^web_/.test(b) || /^firecrawl/.test(n)) return "web";
  if (/^(read|view|get)_/.test(b)) return "readFile";
  return "other";
}

/** The change count a board_apply call carries (`ops` as an array or a JSON string). */
export function opCount(args: unknown): number | undefined {
  let a = args;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { return undefined; } }
  const ops = (a as { ops?: unknown } | null)?.ops;
  if (Array.isArray(ops)) return ops.length || undefined;
  if (typeof ops === "string") { try { const p = JSON.parse(ops); return Array.isArray(p) && p.length ? p.length : undefined; } catch { return undefined; } }
  return undefined;
}

export function toolAct(name: string, args?: unknown): ToolAct {
  const kind = toolKind(name);
  return kind === "editBoard" ? { kind, n: opCount(args) } : { kind };
}

/** Merge acts of one folded run: one entry per kind, in order of first appearance. */
export function mergeActs(into: ToolAct[], more: ToolAct[]): void {
  for (const a of more) {
    const cur = into.find((x) => x.kind === a.kind);
    if (!cur) into.push({ ...a });
    else if ((a.n ?? 0) > (cur.n ?? 0)) cur.n = a.n;
  }
}
