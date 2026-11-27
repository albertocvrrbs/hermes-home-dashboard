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

/** The names worth showing for one tool call: deferred `tool_call` batches name their tools. */
function toolNames(name: string, args: unknown): string[] {
  if (!name || QUIET.has(name)) return [];
  if (name === "tool_call") {
    const calls = (args as { calls?: { name?: unknown }[] } | null)?.calls;
    const inner = Array.isArray(calls) ? calls.map((c) => (typeof c?.name === "string" ? c.name : "")).filter(Boolean) : [];
    return inner.length ? inner : [name];
  }
  return [name];
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
      const names = toolNames(r.name || r.tool_name || "tool", r.args);
      if (!names.length) return;
      const last = out[out.length - 1];
      if (last?.role === "tool") { names.forEach((n) => { if (!last.tools!.includes(n)) last.tools!.push(n); }); return; }
      out.push({ key, role: "tool", text: "", t, tools: names });
      return;
    }
    if (role !== "user" && role !== "assistant") return;
    let text = textOf(r).trim();
    // the board marker and the "(selected: ids)" tail are for Hermes, not for the reader
    if (role === "user") text = text.replace(MARKER, "").replace(SELECTION_TAIL, "");
    const calls = (r.tool_calls ?? []).flatMap((c) => toolNames(c?.function?.name || c?.name || "", parseArgs(c?.function?.arguments)));
    if (text) out.push({ key, role, text, t });
    if (calls.length) {
      const last = out[out.length - 1];
      if (last?.role === "tool") { calls.forEach((n) => { if (!last.tools!.includes(n)) last.tools!.push(n); }); }
      else out.push({ key: `${key}c`, role: "tool", text: "", t, tools: [...new Set(calls)] });
    }
  });
  return out;
}

/** The prompt as the session receives it: the board marker (it links a new session) and the
 *  selected item ids, so Hermes knows what "this" means. */
export function boardPrompt(doc: BoardDoc, text: string, selected: string[], selectedLabel: string): string {
  const sel = selected.filter((id) => doc.items[id]);
  return `[board:${doc.id}] ${text.trim()}${sel.length ? ` (${selectedLabel}: ${sel.join(", ")})` : ""}`;
}

