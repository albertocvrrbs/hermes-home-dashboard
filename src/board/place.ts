// Collision-free placement for the board, as pure functions over rectangles. Mirrored by
// dashboard/boardkit/place.py (same results on test/fixtures/place-cases.json), so a paste in the
// UI, a drop, an upload, a Hermes `add` and an import all land the same way.
//
//   estimateSize(item)            how big a card will be (media: from its own aspect, never a guess)
//   freePlace(want, size, obs)    the nearest spot to `want` where `size` clears every obstacle by `gap`
//   placeBatch(sizes, want, obs)  several items in a row, each treated as an obstacle for the next
//   resolvePlan(entries)          one-time cleanup: who moves where so that nothing overlaps
//   pushPlan(entries, grown)      a card grew: nudge what it now covers, leave connected structure alone
//
// Importers (project files, bulk orders) should call `placeBatch` with measured or estimated
// obstacle rects; nothing else is needed to be overlap-free. No React/DOM: node --test loads it.
import type { Item } from "./model";

export interface Box { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

/** Default card sizes: a copy of model.DEFAULT_SIZE / SHAPE_SIZE (tests keep them equal; node's
 *  test loader cannot follow value imports between these modules). */
export const SIZES: Record<string, [number, number]> = {
  card: [256, 120], todo: [304, 240], col: [276, 320], link: [276, 250], image: [372, 260],
  embed: [452, 320], video: [400, 260], board: [212, 170], frame: [480, 320], box: [196, 62],
  text: [420, 40], draw: [120, 80], live: [400, 300], shape: [160, 56], comp: [480, 320],
};
export const SHAPES: Record<string, [number, number]> = { rect: [160, 56], diamond: [150, 100], pill: [150, 48], circle: [72, 72] };

/** Clear space kept between a placed card and everything around it. */
export const PLACE_GAP = 24;

/** Content kinds that step aside to a free spot. Frames, text, ink and diagram pieces (box,
 *  shape, line) are layout: they go exactly where they are put. Same list as engine.MOVABLE. */
export const MOVABLE = new Set(["card", "todo", "col", "link", "image", "embed", "video", "board", "live", "comp"]);

const round = (n: number) => Math.round(n) + 0; // + 0: no -0

// ── intrinsic shape of media ─────────────────────────────────────────────

/** width / height of an image card's picture, or null while its size is unknown. */
export function aspectOf(item: Item): number | null {
  const { iw, ih } = item;
  return iw && ih && iw > 0 && ih > 0 ? iw / ih : null;
}

/** Video stage ratio: the clip's own, within 9:18 .. 12:5 so an odd file never makes a sliver. */
export function stageRatio(item: Item): number {
  if (item.video) return item.video.vert ? 9 / 16 : 16 / 9;
  const r = aspectOf(item);
  return r === null ? 16 / 9 : Math.min(2.4, Math.max(0.5, r));
}

/** Inline style for a video stage (provider players keep the CSS 16:9 / 9:16). */
export function stageAspect(item: Item): { aspectRatio: string } | undefined {
  if (item.video || aspectOf(item) === null) return undefined;
  return { aspectRatio: `${stageRatio(item)}` };
}

export const THUMB_MIN = 96, THUMB_MAX = 200, THUMB_DEFAULT = 128;

/** Inline style for a link thumbnail: the picture's own shape (CSS clamps it to 96..200 px tall). */
export function thumbAspect(item: Item): { aspectRatio: string } | undefined {
  const r = aspectOf(item);
  return r === null ? undefined : { aspectRatio: `${item.iw} / ${item.ih}` };
}

// ── how big a card is ────────────────────────────────────────────────────

const lines = (chars: number, perLine: number) => Math.max(1, Math.ceil(chars / Math.max(1, perLine)));

/** Card chrome around the picture of an image card: border 2 + padding 6 + caption row. */
const IMAGE_CHROME = 2 + 6, CAP_LINE = 15.6;

/**
 * Height a card will have once rendered. Exact for media whose size is known (the CSS gives the
 * frame the picture's own aspect); a close estimate for text. The DOM is always the authority
 * once the card is on screen: this is for the card that is about to exist.
 */
export function estimateSize(item: Item): Size {
  const k = item.k;
  const [dw, dh] = (k === "shape" ? SHAPES[item.sh ?? "rect"] : undefined) ?? SIZES[k] ?? [200, 100];
  const w = item.w ?? dw;
  switch (k) {
    case "image": {
      const r = aspectOf(item) ?? 4 / 3;
      const art = Math.max(aspectOf(item) === null ? 60 : 0, (w - 14) / r);
      const cap = item.cap ?? "";
      const capLines = cap ? lines(cap.length * 7.4, w - 24) : 0;
      return { w, h: round(IMAGE_CHROME + art + 21 + CAP_LINE * capLines) };
    }
    case "video": {
      const stage = (w - 2) / stageRatio(item);
      const title = item.title || "";
      const body = 24 + 10.5 + 7 + 18.85 * lines(title.length * 7.6, w - 28) + (item.desc ? 4 + 17.75 * Math.min(3, lines(item.desc.length * 6.4, w - 28)) : 0) + (item.by === "h" ? 29 : 0);
      return { w, h: round(2 + stage + 1 + body) };
    }
    case "link": {
      const r = aspectOf(item);
      const thumb = item.st === "wait" || item.img ? (r === null ? THUMB_DEFAULT : Math.min(THUMB_MAX, Math.max(THUMB_MIN, (w - 2) / r))) + 1 : 0;
      const dom = 10.5;
      let body: number;
      if (item.st === "wait") body = 112;
      else {
        const title = item.title || (item.st === "fail" ? item.site || "" : item.url || "");
        body = 24 + dom + 7 + 18.85 * lines(title.length * 7.6, w - 28);
        if (item.desc) body += 4 + 17.75 * Math.min(3, lines(item.desc.length * 6.4, w - 28));
        if ((item.st === "fail" || !item.title) && item.url) body += 6 + 14 * lines(item.url.length * 6.3, w - 28);
        if (item.by === "h") body += 29;
      }
      return { w, h: round(2 + thumb + body) };
    }
    case "card": {
      // border 2 + padding 26; title 18.5/line (pad-right 20); body 18.1/line, or a 16px quote
      const text = item.text ?? "";
      const quote = !item.title && text.length > 0 && text.length <= 160 && !text.includes("\n");
      let h = 28;
      if (item.title) h += 18.5 * lines(item.title.length * 7.6, w - 54);
      if (text) {
        const per = quote ? 8.6 : 6.5, inner = quote ? w - 48 : w - 34;
        const rows = text.split("\n").reduce((n, ln) => n + lines(ln.length * per, inner), 0);
        h += (quote ? 22.7 : 18.1) * rows + (item.title ? 4 : 0);
      }
      if (item.by === "h") h += 23;
      if (item.tags?.length || item.due) h += 24;
      return { w, h: round(Math.max(h, 40)) };
    }
    case "col": return { w, h: 60 + 96 * (item.kids?.length ?? 0) };
    case "todo": return { w, h: 110 + 26 * (item.items?.length ?? 0) };
    case "live": return { w, h: item.h ?? dh };
    default: return { w, h: item.h ?? dh };
  }
}

// ── collisions ───────────────────────────────────────────────────────────

/** True when `a` and `b` are closer than `gap` (0: they overlap; touching is not overlapping). */
export function collides(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

/** Real overlap, ignoring slivers under `tol` px (sub-pixel rounding, borders). */
export function overlaps(a: Box, b: Box, tol = 1): boolean {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > tol && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > tol;
}

export interface PlaceOpts {
  /** clear space to keep (default PLACE_GAP) */
  gap?: number;
  /** prefer spots fully inside this rectangle (a frame the item belongs to) */
  within?: Box;
}

const NEAR = 100, UP = 3; // obstacles whose edges generate candidates; collisions are checked against all

/**
 * The nearest top-left to `want` where a `size` box keeps `gap` clear of every obstacle: `want`
 * itself when it is already free, else the closest candidate hugging an obstacle's edge. Always
 * answers: when no candidate is free it goes below everything.
 */
export function freePlace(want: { x: number; y: number }, size: Size, obstacles: Box[], opts: PlaceOpts = {}): { x: number; y: number } {
  const gap = opts.gap ?? PLACE_GAP;
  const wx = round(want.x), wy = round(want.y);
  const free = (x: number, y: number) => !obstacles.some((o) => collides({ x, y, w: size.w, h: size.h }, o, gap));
  const inside = (x: number, y: number) => !opts.within || (x >= opts.within.x && y >= opts.within.y && x + size.w <= opts.within.x + opts.within.w && y + size.h <= opts.within.y + opts.within.h);
  if (free(wx, wy) && inside(wx, wy)) return { x: wx, y: wy };

  const cx = wx + size.w / 2, cy = wy + size.h / 2;
  const near = obstacles
    .map((o) => ({ o, d: (o.x + o.w / 2 - cx) ** 2 + (o.y + o.h / 2 - cy) ** 2 }))
    .sort((p, q) => p.d - q.d || p.o.y - q.o.y || p.o.x - q.o.x)
    .slice(0, NEAR).map((p) => p.o);
  const xs = new Set<number>([wx]), ys = new Set<number>([wy]);
  for (const o of near) {
    xs.add(round(o.x + o.w + gap)); xs.add(round(o.x - size.w - gap)); xs.add(round(o.x));
    ys.add(round(o.y + o.h + gap)); ys.add(round(o.y - size.h - gap)); ys.add(round(o.y));
  }
  const cands: { x: number; y: number; d: number }[] = [];
  // distance to `want`, dearer going up or left (x3): new things fall to the right and below
  for (const x of xs) for (const y of ys) cands.push({ x, y, d: (UP * Math.min(0, x - wx) + Math.max(0, x - wx)) ** 2 + (UP * Math.min(0, y - wy) + Math.max(0, y - wy)) ** 2 });
  cands.sort((p, q) => p.d - q.d || p.y - q.y || p.x - q.x);
  if (opts.within) {
    const hit = cands.find((c) => inside(c.x, c.y) && free(c.x, c.y));
    if (hit) return { x: hit.x, y: hit.y };
  }
  const hit = cands.find((c) => free(c.x, c.y));
  if (hit) return { x: hit.x, y: hit.y };
  const bottom = Math.max(wy, ...obstacles.map((o) => o.y + o.h));
  return { x: wx, y: round(bottom + gap) };
}

/**
 * Places `sizes` one after the other, all aiming at `want`; each lands clear of the obstacles and
 * of the ones placed before it. Returns the top-lefts in order.
 */
export function placeBatch(sizes: Size[], want: { x: number; y: number }, obstacles: Box[], opts: PlaceOpts = {}): { x: number; y: number }[] {
  const taken = obstacles.slice();
  const out: { x: number; y: number }[] = [];
  for (const s of sizes) {
    const p = freePlace(want, s, taken, opts);
    out.push(p);
    taken.push({ x: p.x, y: p.y, w: s.w, h: s.h });
  }
  return out;
}

// ── cleaning up an existing board ────────────────────────────────────────

export interface Entry {
  id: string;
  rect: Box;
  /** stays where it is (wired into a flow, a frame, hand-held): others move around it */
  anchored?: boolean;
  /** the frame it sits in: it is kept there when there is room */
  within?: Box;
}

/**
 * One-time cleanup. Anchored entries never move. The rest are taken in reading order; each one
 * that overlaps what is already settled steps to the nearest free spot (with a clear gap). Items
 * that overlap nothing do not move, so a tidy board comes back unchanged. Returns only moves.
 */
export function resolvePlan(entries: Entry[], opts: { gap?: number; tol?: number } = {}): { id: string; x: number; y: number }[] {
  const gap = opts.gap ?? PLACE_GAP, tol = opts.tol ?? 1;
  const settled: Box[] = entries.filter((e) => e.anchored).map((e) => e.rect);
  const order = entries.filter((e) => !e.anchored)
    .sort((p, q) => p.rect.y - q.rect.y || p.rect.x - q.rect.x || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  const pending = new Map(order.map((e) => [e.id, e.rect] as const));
  const out: { id: string; x: number; y: number }[] = [];
  for (const e of order) {
    pending.delete(e.id);
    const hit = settled.some((s) => overlaps(e.rect, s, tol));
    let rect = e.rect;
    if (hit) {
      const others = [...settled, ...pending.values()];
      const p = freePlace({ x: e.rect.x, y: e.rect.y }, e.rect, others, { gap, within: e.within });
      rect = { x: p.x, y: p.y, w: e.rect.w, h: e.rect.h };
      out.push({ id: e.id, x: p.x, y: p.y });
    }
    settled.push(rect);
  }
  return out;
}

// ── a card grew ──────────────────────────────────────────────────────────

/**
 * `grown` now covers neighbours. Each one it overlaps is pushed away from it (down when it sits
 * below, otherwise sideways) just far enough to leave `gap`, and whatever that one now covers is
 * pushed in turn. Anchored entries never move: when one is in the way, its id is in `blocked`
 * and the caller relocates the grown card instead (freePlace).
 */
export function pushPlan(entries: Entry[], grown: string, opts: { gap?: number; tol?: number } = {}): { moves: { id: string; x: number; y: number }[]; blocked: string[] } {
  const gap = opts.gap ?? PLACE_GAP, tol = opts.tol ?? 1;
  const rects = new Map<string, Box>(entries.map((e) => [e.id, { ...e.rect }]));
  const anchored = new Set(entries.filter((e) => e.anchored).map((e) => e.id));
  const origin = new Map(entries.map((e) => [e.id, { x: e.rect.x, y: e.rect.y }] as const));
  const order = entries.map((e) => e.id).sort();
  const blocked = new Set<string>();
  const queue = [grown];
  const seen = new Set<string>([grown]);
  for (let guard = 0; queue.length && guard < 400; guard++) {
    const sid = queue.shift()!;
    const s = rects.get(sid);
    if (!s) continue;
    for (const id of order) {
      if (id === sid || id === grown && sid !== grown) continue;
      const m = rects.get(id)!;
      if (!overlaps(s, m, tol)) continue;
      if (anchored.has(id)) { blocked.add(id); continue; }
      const below = m.y + m.h / 2 >= s.y + s.h / 2, right = m.x + m.w / 2 >= s.x + s.w / 2;
      const dy = below ? s.y + s.h + gap - m.y : m.y + m.h + gap - s.y;
      const dx = right ? s.x + s.w + gap - m.x : m.x + m.w + gap - s.x;
      // down (or up) is the natural way to make room; sideways only when it is much cheaper
      if (dy <= dx * 1.6) m.y = round(below ? m.y + dy : m.y - dy);
      else m.x = round(right ? m.x + dx : m.x - dx);
      if (!seen.has(id)) { seen.add(id); }
      queue.push(id);
    }
  }
  const moves: { id: string; x: number; y: number }[] = [];
  for (const id of order) {
    if (id === grown) continue;
    const r = rects.get(id)!, o = origin.get(id)!;
    if (r.x !== o.x || r.y !== o.y) moves.push({ id, x: r.x, y: r.y });
  }
  return { moves, blocked: [...blocked].sort() };
}
