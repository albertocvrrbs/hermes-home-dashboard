// Board document model + the client mirror of the op engine (dashboard/boardkit/engine.py).
// The server is authoritative and logs normalised ops (put / set / del / board); the client
// replays them, and applies its own pending batches optimistically (`add` with a $ref id).
// Kept free of React/SDK imports so node --test can load it.

export type Kind =
  | "card" | "todo" | "col" | "link" | "image" | "embed" | "video" | "board"
  | "frame" | "box" | "text" | "draw" | "line";

export type Point = [number, number];
export type End = string | Point;

export interface TodoItem { t: string; done?: boolean; by?: "h"; due?: string }
export interface VideoRef { p: "youtube" | "vimeo" | "loom" | "x"; id: string; vert?: boolean }

export interface Item {
  k: Kind;
  x?: number; y?: number; w?: number; h?: number;
  in?: string; by?: "h";
  title?: string; text?: string; tags?: string[]; due?: string;
  items?: TodoItem[]; kids?: string[];
  url?: string; desc?: string; site?: string; icon?: string; img?: string;
  st?: "wait" | "ok" | "fail"; video?: VideoRef;
  asset?: string; cap?: string; iw?: number; ih?: number; src?: string;
  ref?: string; note?: string; sub?: string; num?: string; size?: "h" | "p";
  d?: string; sw?: number; a?: End; b?: End; label?: string;
}

export interface Presence { at: number; act: string; on?: string }

export interface BoardDoc {
  v: 1; id: string; name: string; parent: string | null; seq: number; n: number;
  session: { id: string; profile: string } | null; seen: number;
  created: number; updated: number; hermes?: Presence;
  items: Record<string, Item>;
}

export type Op =
  | { op: "put"; id: string; item: Item; at?: number }
  | { op: "set"; id: string; p: Partial<Record<keyof Item, unknown>>; at?: number }
  | { op: "del"; id: string }
  | { op: "board"; p: { name?: string } }
  | { op: "add"; ref?: string; item: Item; at?: number };

export interface Entry {
  s: number; t: number; by: "u" | "h" | "s"; ops: Op[];
  ids?: Record<string, string>; note?: string; undo?: number;
}

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function insertKid(items: Record<string, Item>, col: string, id: string, at?: number): void {
  const c = items[col];
  if (!c || c.k !== "col") return;
  const kids = c.kids ?? (c.kids = []);
  if (kids.includes(id)) return;
  const idx = at == null ? kids.length : Math.max(0, Math.min(kids.length, Math.round(at)));
  kids.splice(idx, 0, id);
}

function removeKid(items: Record<string, Item>, id: string): void {
  const col = items[id]?.in;
  const c = col ? items[col] : undefined;
  if (c?.kids) c.kids = c.kids.filter((k) => k !== id);
}

function putItem(doc: BoardDoc, id: string, raw: Item, at?: number): void {
  const item = clone(raw);
  doc.items[id] = item;
  if (/^[a-z0-9]{1,8}$/.test(id)) doc.n = Math.max(doc.n, parseInt(id, 36) + 1);
  if (item.in) {
    delete item.x;
    delete item.y;
    insertKid(doc.items, item.in, id, at);
  }
}

/** Apply one op in place. Unknown ids are ignored (a stale optimistic op must never throw). */
export function applyOp(doc: BoardDoc, op: Op): void {
  const items = doc.items;
  switch (op.op) {
    case "put":
      putItem(doc, op.id, op.item, op.at);
      return;
    case "add": {
      const id = op.ref ?? `$local${Object.keys(items).length}`;
      const item = clone(op.item);
      if (item.k === "col" && !item.kids) item.kids = [];
      putItem(doc, id, item, op.at);
      return;
    }
    case "set": {
      const it = items[op.id];
      if (!it) return;
      const p = op.p as Record<string, unknown>;
      if ("in" in p) {
        const next = p.in as string | null;
        if (next !== (it.in ?? null)) {
          removeKid(items, op.id);
          if (next) {
            it.in = next;
            delete it.x;
            delete it.y;
            insertKid(items, next, op.id, op.at);
          } else {
            delete it.in;
          }
        }
      }
      for (const [key, value] of Object.entries(p)) {
        if (key === "in" || key === "k" || key === "by") continue;
        if (key === "x" || key === "y") {
          if (it.in) continue;
        }
        if (value === null || value === undefined) delete (it as unknown as Record<string, unknown>)[key];
        else (it as unknown as Record<string, unknown>)[key] = clone(value);
      }
      return;
    }
    case "del": {
      const it = items[op.id];
      if (!it) return;
      const doomed = new Set([op.id, ...(it.k === "col" ? it.kids ?? [] : [])]);
      for (const [k, v] of Object.entries(items)) {
        if (v.k === "line" && [v.a, v.b].some((e) => typeof e === "string" && doomed.has(e))) doomed.add(k);
      }
      removeKid(items, op.id);
      for (const k of doomed) delete items[k];
      return;
    }
    case "board":
      if (typeof op.p.name === "string") doc.name = op.p.name;
      return;
  }
}

export function applyOps(doc: BoardDoc, ops: readonly Op[]): BoardDoc {
  const next = clone(doc);
  for (const op of ops) applyOp(next, op);
  return next;
}

/** Replays server entries on a confirmed document, advancing seq. */
export function applyEntries(doc: BoardDoc, entries: readonly Entry[]): BoardDoc {
  let next = doc;
  for (const e of entries) {
    if (e.s <= next.seq) continue;
    next = applyOps(next, e.ops);
    next.seq = e.s;
    next.updated = e.t;
  }
  return next;
}

/** Rewrites optimistic `$ref` ids in queued batches once the server assigned real ids. */
export function remapIds(ops: Op[], ids: Record<string, string>): Op[] {
  const map = (v: unknown): unknown => (typeof v === "string" && v in ids ? ids[v] : v);
  return ops.map((op) => {
    const o = clone(op) as Record<string, unknown>;
    if ("id" in o) o.id = map(o.id);
    const bag = (o.item ?? o.p) as Record<string, unknown> | undefined;
    if (bag) {
      for (const key of ["a", "b", "in"]) if (key in bag) bag[key] = map(bag[key]);
      if (Array.isArray(bag.kids)) bag.kids = bag.kids.map(map);
    }
    return o as unknown as Op;
  });
}

let refCounter = 0;
/** A fresh optimistic id, valid as both a $ref for the server and a local item key. */
export function newRef(): string {
  refCounter = (refCounter + 1) % 1e9;
  return `$u${Date.now().toString(36).slice(-4)}${refCounter.toString(36)}`;
}

/** Ops that restore `ids` exactly as they are in `doc` (for client-side undo of local batches). */
export function snapshotOps(doc: BoardDoc, ids: Iterable<string>): Op[] {
  const out: Op[] = [];
  for (const id of ids) {
    const it = doc.items[id];
    if (it) out.push({ op: "set", id, p: clone(it) as unknown as Record<string, unknown> });
  }
  return out;
}

export function isHermes(item: Item | undefined): boolean {
  return item?.by === "h";
}

/** Items drawn on the canvas directly (column kids render inside their column). */
export function topLevel(doc: BoardDoc): [string, Item][] {
  return Object.entries(doc.items).filter(([, it]) => !it.in && it.k !== "line");
}

export function itemLabel(item: Item): string {
  return (item.title || item.text || item.cap || item.url || item.src || item.label || item.note || "").trim();
}

/** Mirrors engine.DEFAULT_SIZE: used where the DOM is not measured (previews, auto layout). */
export const DEFAULT_SIZE: Record<string, [number, number]> = {
  card: [256, 120], todo: [304, 240], col: [276, 320], link: [276, 250], image: [372, 260],
  embed: [452, 320], video: [400, 260], board: [212, 170], frame: [480, 320], box: [196, 62],
  text: [420, 40], draw: [120, 80],
};

export function approxRect(item: Item): { x: number; y: number; w: number; h: number } | null {
  if (item.k === "line" || item.in || item.x == null || item.y == null) return null;
  const [dw, dh] = DEFAULT_SIZE[item.k] ?? [200, 100];
  let h = item.h ?? dh;
  if (item.k === "col") h = 60 + 96 * (item.kids?.length ?? 0);
  if (item.k === "todo") h = 110 + 26 * (item.items?.length ?? 0);
  if (item.k === "draw" && item.d) {
    const pts = item.d.split(" ").map((p) => p.split(",").map(Number));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: item.x + Math.min(...xs), y: item.y + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  }
  return { x: item.x, y: item.y, w: item.w ?? dw, h };
}
