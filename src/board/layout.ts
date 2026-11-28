// Pure layout helpers for the board: tidy (clean grid in reading order), snapping while
// dragging, and where to put a shape inserted on a connector. Mirrored by
// dashboard/boardkit/layout.py (same results on test/fixtures/layout-cases.json), so Hermes'
// `tidy` / `insert_on_edge` ops and the UI agree. No React/DOM: node --test loads it.
import type { Rect } from "./geometry";

export const GRID = 24;
export const TIDY_GAP = 24;
export const INSERT_GAP = 48;

const round = (n: number) => Math.round(n) + 0; // + 0: no -0
const snapTo = (n: number, g: number) => Math.round(n / g) * g;

// ── tidy ─────────────────────────────────────────────────────────────────

/** One thing that moves as a whole: an item, or a group of strokes. */
export interface Block { ids: string[]; rect: Rect }
export interface Placed { ids: string[]; x: number; y: number }

/**
 * Reading order: rows from the top (items whose vertical extents overlap share a row), left to
 * right inside a row. Each row is laid left-justified with uniform gaps, rows stacked with the
 * same gap, the whole starting on the grid at the top-left of the original bounds. A row wider
 * than the original footprint (clamped to 640..2400) wraps. Ids are the tie-break so the
 * result is deterministic, and tidying a tidy board changes nothing.
 */
export function tidyPlan(blocks: Block[], opts: { gap?: number; grid?: number; maxW?: number; fixed?: Rect[] } = {}): Placed[] {
  if (!blocks.length) return [];
  const gap = opts.gap ?? TIDY_GAP, grid = opts.grid ?? GRID;
  const x0 = Math.min(...blocks.map((b) => b.rect.x)), y0 = Math.min(...blocks.map((b) => b.rect.y));
  const x1 = Math.max(...blocks.map((b) => b.rect.x + b.rect.w));
  const maxW = opts.maxW ?? Math.min(2400, Math.max(640, x1 - x0));

  const sorted = blocks.slice().sort((p, q) => p.rect.y - q.rect.y || p.rect.x - q.rect.x || (p.ids[0] < q.ids[0] ? -1 : 1));
  const rows: { top: number; bottom: number; items: Block[] }[] = [];
  for (const b of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const overlap = Math.min(row.bottom, b.rect.y + b.rect.h) - Math.max(row.top, b.rect.y);
      if (overlap >= 0.4 * Math.min(b.rect.h, row.bottom - row.top)) {
        row.items.push(b);
        row.top = Math.min(row.top, b.rect.y);
        row.bottom = Math.max(row.bottom, b.rect.y + b.rect.h);
        continue;
      }
    }
    rows.push({ top: b.rect.y, bottom: b.rect.y + b.rect.h, items: [b] });
  }

  // wrap long rows
  const lines: Block[][] = [];
  for (const row of rows) {
    const items = row.items.slice().sort((p, q) => p.rect.x - q.rect.x || (p.ids[0] < q.ids[0] ? -1 : 1));
    let cur: Block[] = [], w = 0;
    for (const b of items) {
      if (cur.length && w + gap + b.rect.w > maxW) { lines.push(cur); cur = []; w = 0; }
      w += (cur.length ? gap : 0) + b.rect.w;
      cur.push(b);
    }
    if (cur.length) lines.push(cur);
  }

  const out: Placed[] = [];
  let y = snapTo(y0, grid);
  const left = snapTo(x0, grid);
  for (const line of lines) {
    let x = left;
    for (const b of line) {
      out.push({ ids: b.ids, x: round(x), y: round(y) });
      x += b.rect.w + gap;
    }
    y += Math.max(...line.map((b) => b.rect.h)) + gap;
  }
  // Items that stay where they are (wired ones, frames) are obstacles: when the tidied
  // block lands on one, the whole block moves below it, so nothing ends up on top of anything.
  const fixed = opts.fixed ?? [];
  if (fixed.length) {
    const size = new Map(blocks.map((b) => [b.ids[0], b.rect] as const));
    for (let pass = 0; pass < 20; pass++) {
      let bottom = -Infinity;
      for (const o of out) {
        const r = size.get(o.ids[0])!;
        for (const f of fixed) {
          if (o.x < f.x + f.w && o.x + r.w > f.x && o.y < f.y + f.h && o.y + r.h > f.y) bottom = Math.max(bottom, f.y + f.h);
        }
      }
      if (bottom === -Infinity) break;
      const top = Math.min(...out.map((o) => o.y));
      const dy = snapTo(bottom + gap - top, grid);
      for (const o of out) o.y = round(o.y + Math.max(dy, grid));
    }
  }
  return out;
}

// ── snapping while dragging ──────────────────────────────────────────────

export interface Guide { axis: "x" | "y"; pos: number; from: number; to: number }
export interface Snap { dx: number; dy: number; guides: Guide[] }

const xs = (r: Rect) => [r.x, r.x + r.w / 2, r.x + r.w];
const ys = (r: Rect) => [r.y, r.y + r.h / 2, r.y + r.h];

/** Best alignment offset on one axis (or null): moving candidate vs neighbours' candidates. */
function bestAlign(mov: number[], others: number[][], thr: number): number | null {
  let best: number | null = null;
  for (const o of others) for (const oc of o) for (const mc of mov) {
    const d = oc - mc;
    if (Math.abs(d) <= thr && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best;
}

/**
 * Where a dragged rect (`mov`, already at its raw position) lands: neighbours' edges and
 * centres win within `thr` (world px); otherwise its top-left falls on the grid. Guides list
 * every neighbour now exactly aligned, as lines spanning both.
 */
export function snapMove(mov: Rect, others: Rect[], o: { grid?: number; thr: number; toGrid?: boolean }): Snap {
  const grid = o.grid ?? GRID;
  let dx = bestAlign(xs(mov), others.map(xs), o.thr);
  let dy = bestAlign(ys(mov), others.map(ys), o.thr);
  if (dx === null) dx = o.toGrid === false ? 0 : snapTo(mov.x, grid) - mov.x;
  if (dy === null) dy = o.toGrid === false ? 0 : snapTo(mov.y, grid) - mov.y;
  const m: Rect = { x: mov.x + dx, y: mov.y + dy, w: mov.w, h: mov.h };
  const guides: Guide[] = [];
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.5;
  for (const r of others) {
    const vx = xs(r).find((c) => xs(m).some((mc) => eq(c, mc)));
    if (vx !== undefined) guides.push({ axis: "x", pos: vx, from: Math.min(m.y, r.y), to: Math.max(m.y + m.h, r.y + r.h) });
    const vy = ys(r).find((c) => ys(m).some((mc) => eq(c, mc)));
    if (vy !== undefined) guides.push({ axis: "y", pos: vy, from: Math.min(m.x, r.x), to: Math.max(m.x + m.w, r.x + r.w) });
  }
  return { dx, dy, guides };
}

// ── insert on a connector ────────────────────────────────────────────────

export interface InsertPlan {
  /** Top-left of the new item. */
  x: number; y: number;
  /** How far B (and everything downstream of it) moves to make room. */
  shift: { dx: number; dy: number };
}

/**
 * Centres a `size` item between A and B along the connector's axis (the one `route` would use),
 * leaving `gap` on each side. When the gap is too tight, B (and what hangs off it) is pushed
 * away by the missing amount. `shiftB: false` (B is a free point) never shifts.
 */
export function insertPlan(a: Rect, b: Rect, size: { w: number; h: number }, o: { gap?: number; shiftB?: boolean } = {}): InsertPlan {
  const gap = o.gap ?? INSERT_GAP;
  const hgap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const vgap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const horizontal = hgap > 0 && hgap >= vgap;
  let shift = { dx: 0, dy: 0 };
  let x: number, y: number;
  if (horizontal) {
    const fwd = b.x >= a.x + a.w;
    const space = fwd ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
    const more = o.shiftB === false ? 0 : Math.max(0, size.w + 2 * gap - space);
    shift = { dx: round((fwd ? 1 : -1) * more), dy: 0 };
    const edgeA = fwd ? a.x + a.w : a.x;
    const edgeB = fwd ? b.x + shift.dx : b.x + b.w + shift.dx;
    x = (edgeA + edgeB) / 2 - size.w / 2;
    y = (a.y + a.h / 2 + b.y + b.h / 2) / 2 - size.h / 2;
  } else {
    const fwd = b.y + b.h / 2 >= a.y + a.h / 2;
    const space = fwd ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
    const more = o.shiftB === false ? 0 : Math.max(0, size.h + 2 * gap - space);
    shift = { dx: 0, dy: round((fwd ? 1 : -1) * more) };
    const edgeA = fwd ? a.y + a.h : a.y;
    const edgeB = fwd ? b.y + shift.dy : b.y + b.h + shift.dy;
    y = (edgeA + edgeB) / 2 - size.h / 2;
    x = (a.x + a.w / 2 + b.x + b.w / 2) / 2 - size.w / 2;
  }
  return { x: round(x), y: round(y), shift };
}

/** Ids reachable from `start` following a→b edges. If that loops back to `stop` (a cycle through
 *  A), only `start` itself may move. Sorted, so results are stable. */
export function downstream(edges: [string, string][], start: string, stop: string): string[] {
  const next = new Map<string, string[]>();
  for (const [a, b] of edges) next.set(a, [...(next.get(a) ?? []), b]);
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of next.get(cur) ?? []) {
      if (n === stop) return [start];
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return [...seen].sort();
}
