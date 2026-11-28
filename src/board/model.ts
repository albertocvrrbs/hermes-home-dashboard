// Board document model + the client mirror of the op engine (dashboard/boardkit/engine.py).
// The server is authoritative and logs normalised ops (put / set / del / board); the client
// replays them, and applies its own pending batches optimistically (`add` with a $ref id).
// Kept free of React/SDK imports so node --test can load it.
import type { LiveBlock } from "./live";

export type Kind =
  | "card" | "todo" | "col" | "link" | "image" | "embed" | "video" | "board"
  | "frame" | "box" | "text" | "draw" | "line" | "live" | "shape";

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
  /** embed: Hermes theme + responsive bridge (off = the page renders exactly as authored) */
  theme?: boolean;
  asset?: string; cap?: string; iw?: number; ih?: number; src?: string;
  ref?: string; note?: string; sub?: string; num?: string; size?: "h" | "p" | "s";
  /** shape: flowchart symbol (process, decision, start/end, connector) */
  sh?: "rect" | "diamond" | "pill" | "circle";
  d?: string; sw?: number; a?: End; b?: End; label?: string;
  /** draw: tool (absent = pen), palette colour (absent = ink), dashed, smooth (tapered outline),
   *  per-point pressure digits 0-9, group id */
  tl?: "hl" | "line" | "arrow" | "rect" | "ellipse"; c?: "accent" | "sage" | "clay" | "slate" | "sand";
  ds?: boolean; sm?: boolean; pr?: string; g?: string;
  /** video: duration (s); live: block spec, data bag, freshness TTL (s), last update (epoch s) */
  dur?: number; blocks?: LiveBlock[]; data?: Record<string, unknown>; ttl?: number; at?: number; tpl?: string;
}

/** One stop of the presentation: a frame, an item, a nested-board card, or a free view
 *  (`r` = a world rect to frame, `v` = a saved camera view). `dw` = auto-play dwell (s). */
export interface TourStop {
  k: "frame" | "item" | "board" | "view";
  id?: string; r?: { x: number; y: number; w: number; h: number }; v?: { x: number; y: number; z: number };
  t?: string; dw?: number;
}
export interface Tour { stops: TourStop[]; loop?: boolean; dw?: number; t?: string }

export interface Presence { at: number; act: string; on?: string }

export interface BoardDoc {
  v: 1; id: string; name: string; parent: string | null; seq: number; n: number;
  session: { id: string; profile: string } | null; seen: number;
  created: number; updated: number; hermes?: Presence;
  items: Record<string, Item>;
  /** presentation tour (tour.ts plays it) */
  tour?: Tour;
}

export type Op =
  | { op: "put"; id: string; item: Item; at?: number }
  | { op: "set"; id: string; p: Partial<Record<keyof Item, unknown>>; at?: number }
  | { op: "del"; id: string }
  | { op: "board"; p: { name?: string } }
  | { op: "tour"; tour: Tour | null }
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
    case "tour":
      if (op.tour && op.tour.stops) doc.tour = clone(op.tour);
      else delete doc.tour;
      return;
    case "board":
      if (typeof op.p.name === "string") doc.name = op.p.name;
      return;
  }
}

/**
 * The ids a bulk delete should send: existing, unique, minus whatever another selected id already
 * removes (kids of a selected column, connectors attached to a removed item). The server treats
 * those as no-ops too; this keeps batches and optimistic state minimal.
 */
export function normalizeDeletes(doc: BoardDoc, ids: Iterable<string>): string[] {
  const want = [...new Set(ids)].filter((id) => doc.items[id]);
  const set = new Set(want);
  const gone = new Set<string>();
  for (const id of want) {
    const it = doc.items[id];
    if (it.in && set.has(it.in)) gone.add(id);
    if (it.k === "col") for (const kid of it.kids ?? []) gone.add(kid);
  }
  const removed = new Set([...set].filter((id) => !(doc.items[id].in && set.has(doc.items[id].in!))));
  for (const id of want) if (doc.items[id].k === "col") for (const kid of doc.items[id].kids ?? []) removed.add(kid);
  return want.filter((id) => {
    const it = doc.items[id];
    if (gone.has(id)) return false;
    if (it.k === "line") return ![it.a, it.b].some((e) => typeof e === "string" && removed.has(e));
    return true;
  });
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
  text: [420, 40], draw: [120, 80], live: [400, 300], shape: [160, 56],
};

/** Rows the metrics grid wraps into (mirrors the CSS: columns follow the count, pairs below 380px). */
export function liveMetricRows(n: number, w: number): number {
  if (n <= 0) return 1;
  const cols = w < 380 ? Math.min(n, 2) : n <= 4 ? n : n <= 6 ? 3 : 4;
  return Math.ceil(n / cols);
}

/** Default size of a flowchart shape (engine.SHAPE_SIZE). */
export const SHAPE_SIZE: Record<string, [number, number]> = { rect: [160, 56], diamond: [150, 100], pill: [150, 48], circle: [72, 72] };

/** Rough height of a live card from its blocks (previews and auto layout only). */
export function liveHeight(item: Item): number {
  const w = item.w ?? 400;
  let h = 40;
  for (const b of item.blocks ?? []) {
    h += { header: 60, progress: 46, metrics: 74 * (b.t === "metrics" ? liveMetricRows(b.items?.length ?? 0, w) : 1), spark: 66, media: Math.round(w * 9 / 16) + 26, text: 22 + 16 * (b.t === "text" ? b.lines ?? 6 : 0), actions: 46 }[b.t] ?? 40;
  }
  return h;
}

export function approxRect(item: Item): { x: number; y: number; w: number; h: number } | null {
  if (item.k === "line" || item.in || item.x == null || item.y == null) return null;
  const [dw, dh] = (item.k === "shape" ? SHAPE_SIZE[item.sh ?? "rect"] : undefined) ?? DEFAULT_SIZE[item.k] ?? [200, 100];
  let h = item.h ?? dh;
  if (item.k === "col") h = 60 + 96 * (item.kids?.length ?? 0);
  if (item.k === "todo") h = 110 + 26 * (item.items?.length ?? 0);
  if (item.k === "live") h = item.h ?? liveHeight(item);
  if (item.k === "draw" && item.d) {
    const pts = item.d.split(" ").map((p) => p.split(",").map(Number));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: item.x + Math.min(...xs), y: item.y + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  }
  return { x: item.x, y: item.y, w: item.w ?? dw, h };
}
