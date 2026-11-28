// Ink for the board's Draw tool: settings, input stabilisation, stroke finishing, shape geometry,
// stroke outlines, and hit tests. Pure (no React/DOM) so node --test can load it.
import type { Item, Point } from "./model";

/** Ramer–Douglas–Peucker (kept local so this module stays dependency-free for node --test). */
export function simplify(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = len ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      if (d > far) { far = d; best = i; }
    }
    if (best > 0 && far > eps) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export type InkTool = "pen" | "hl" | "eraser" | "lasso" | "line" | "arrow" | "rect" | "ellipse";
export type ShapeTool = "line" | "arrow" | "rect" | "ellipse";
export const SHAPES: readonly ShapeTool[] = ["line", "arrow", "rect", "ellipse"];
export const isShape = (t: string | undefined): t is ShapeTool => !!t && (SHAPES as readonly string[]).includes(t);

/** The restrained palette. `ink` is the theme's text colour and is the default (not stored);
 *  the rest are stored by name so they re-skin with the theme. */
export const INK_COLORS = ["ink", "accent", "sage", "clay", "slate", "sand"] as const;
export type InkColor = (typeof INK_COLORS)[number];

/** Width presets in world px: pen and shapes, then the (wide) highlighter. */
export const PEN_WIDTHS = [1.9, 3.5, 6] as const;
export const HL_WIDTHS = [10, 16, 24] as const;

/** 0 = raw input, uniform width · 1 = stabilised + tapered (default) · 2 = strong. */
export type Smooth = 0 | 1 | 2;

export interface InkSettings {
  tool: InkTool;
  /** Preset index (0-2) for pen/shapes and for the highlighter. */
  w: { pen: number; hl: number };
  c: InkColor;
  ds: boolean;
  sm: Smooth;
}

export const DEFAULT_INK: InkSettings = { tool: "pen", w: { pen: 0, hl: 1 }, c: "ink", ds: false, sm: 1 };
const TOOLS: readonly InkTool[] = ["pen", "hl", "eraser", "lasso", ...SHAPES];
const idx = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2 ? v : d);

/** Last-used settings from storage; anything unknown falls back to the defaults. */
export function parseInk(raw: string | null | undefined): InkSettings {
  let o: Record<string, unknown> = {};
  try { o = raw ? JSON.parse(raw) : {}; } catch { o = {}; }
  if (!o || typeof o !== "object") o = {};
  const w = (o.w ?? {}) as Record<string, unknown>;
  return {
    tool: TOOLS.includes(o.tool as InkTool) ? (o.tool as InkTool) : DEFAULT_INK.tool,
    w: { pen: idx(w.pen, DEFAULT_INK.w.pen), hl: idx(w.hl, DEFAULT_INK.w.hl) },
    c: INK_COLORS.includes(o.c as InkColor) ? (o.c as InkColor) : DEFAULT_INK.c,
    ds: o.ds === true,
    sm: o.sm === 0 || o.sm === 2 ? o.sm : 1,
  };
}

/** The stroke width a tool draws with under these settings. */
export function inkWidth(s: InkSettings, tool: InkTool = s.tool): number {
  return tool === "hl" ? HL_WIDTHS[s.w.hl] : PEN_WIDTHS[s.w.pen];
}

/** `[` / `]`: step the active tool's width preset. */
export function stepWidth(s: InkSettings, dir: 1 | -1): InkSettings {
  const key = s.tool === "hl" ? "hl" : "pen";
  return { ...s, w: { ...s.w, [key]: Math.max(0, Math.min(2, s.w[key] + dir)) } };
}

// ── One Euro filter (Casiez et al. 2012) ─────────────────────────────────
// A low-pass whose cutoff rises with speed: slow, shaky motion gets strong smoothing (jitter
// gone); fast motion barely any (no lag). Tuned in screen px and milliseconds.

export interface EuroParams { minCutoff: number; beta: number; dCutoff: number }

const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

export class OneEuro2D {
  private x = 0; private y = 0;
  private dx = 0; private dy = 0;
  private rx = 0; private ry = 0;
  private t = -1;
  private p: EuroParams;
  constructor(p: EuroParams) { this.p = p; }

  filter(x: number, y: number, tMs: number): Point {
    if (this.t < 0) {
      this.t = tMs; this.x = this.rx = x; this.y = this.ry = y;
      return [x, y];
    }
    const dt = Math.max(1 / 1000, (tMs - this.t) / 1000 || 1 / 240);
    this.t = tMs;
    const ad = alpha(this.p.dCutoff, dt);
    this.dx += ad * ((x - this.rx) / dt - this.dx);
    this.dy += ad * ((y - this.ry) / dt - this.dy);
    this.rx = x; this.ry = y;
    const a = alpha(this.p.minCutoff + this.p.beta * Math.hypot(this.dx, this.dy), dt);
    this.x += a * (x - this.x);
    this.y += a * (y - this.y);
    return [this.x, this.y];
  }
}

/** Stabiliser strength by input device: strongest for mice, lighter for touch, minimal for pens
 *  (they are already precise and carry pressure). `null` = raw. */
export function euroFor(pointerType: string, sm: Smooth): EuroParams | null {
  if (sm === 0) return null;
  const strong = sm === 2;
  if (pointerType === "pen") return strong ? { minCutoff: 3, beta: 0.03, dCutoff: 1 } : { minCutoff: 6, beta: 0.05, dCutoff: 1 };
  if (pointerType === "touch") return strong ? { minCutoff: 1.4, beta: 0.015, dCutoff: 1 } : { minCutoff: 2.8, beta: 0.025, dCutoff: 1 };
  return strong ? { minCutoff: 0.8, beta: 0.01, dCutoff: 1 } : { minCutoff: 1.6, beta: 0.018, dCutoff: 1 };
}

// ── finishing a stroke ───────────────────────────────────────────────────

/** Centripetal Catmull–Rom through `pts`, sampled about every `step` units. */
export function catmullRom(pts: Point[], step: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const out: Point[] = [pts[0]];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const knot = (a: Point, b: Point) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 1; k <= n; k++) {
      const t = t1 + ((t2 - t1) * k) / n;
      const lerp = (a: Point, b: Point, ta: number, tb: number): Point => {
        const u = tb - ta < 1e-9 ? 0 : (t - ta) / (tb - ta);
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      };
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
      out.push(lerp(B1, B2, t1, t2));
    }
  }
  return out;
}

export const MAX_POINTS = 400;

/** World points of a finished freehand stroke → clean, compact integer points: a zoom-aware
 *  Ramer–Douglas–Peucker pass drops input noise, a centripetal Catmull–Rom pass rounds the
 *  corners that are left, and a last light RDP keeps the stored stroke small (≤ 400 points). */
export function finishStroke(pts: Point[], zoom: number, pointerType = "mouse", smooth: Smooth = 1): Point[] {
  if (pts.length < 2) return pts.map(([x, y]) => [Math.round(x), Math.round(y)] as Point);
  const z = Math.max(0.05, zoom);
  const screenEps = smooth === 0 ? 0.6 : pointerType === "pen" ? 0.6 : pointerType === "touch" ? 1 : smooth === 2 ? 1.8 : 1.2;
  let pts1 = simplify(pts, screenEps / z);
  if (smooth > 0 && pts1.length >= 3) pts1 = catmullRom(pts1, 5 / z);
  const ints: Point[] = [];
  for (const [x, y] of pts1) {
    const p: Point = [Math.round(x), Math.round(y)];
    const last = ints[ints.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) ints.push(p);
  }
  let eps = 0.45;
  let out = simplify(ints, eps);
  while (out.length > MAX_POINTS) { eps *= 1.6; out = simplify(ints, eps); }
  return out;
}

/** Resamples per-sample pressures onto finished points by relative arc length; one digit
 *  (0-9) per point. Returns undefined when the pressure never varied (mice, most touch). */
export function pressureDigits(raw: Point[], pressures: number[], done: Point[]): string | undefined {
  if (raw.length < 2 || pressures.length !== raw.length || done.length < 2) return undefined;
  const lo = Math.min(...pressures), hi = Math.max(...pressures);
  if (hi - lo < 0.05) return undefined;
  const cum = (pts: Point[]) => {
    const c = [0];
    for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = c[c.length - 1] || 1;
    return c.map((v) => v / total);
  };
  const cr = cum(raw), cd = cum(done);
  let j = 0;
  return cd.map((u) => {
    while (j < cr.length - 2 && cr[j + 1] < u) j++;
    const span = cr[j + 1] - cr[j] || 1;
    const k = Math.max(0, Math.min(1, (u - cr[j]) / span));
    const p = pressures[j] + (pressures[j + 1] - pressures[j]) * k;
    return String(Math.max(0, Math.min(9, Math.round(p * 9))));
  }).join("");
}

// ── shapes ───────────────────────────────────────────────────────────────

/** The two defining points of a shape dragged from `a` to `b`. Shift snaps lines to 45° and
 *  makes rectangles square and ellipses round; Alt draws from the centre outward. */
export function shapePoints(tool: ShapeTool, a: Point, b: Point, mods: { shift?: boolean; alt?: boolean } = {}): [Point, Point] {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  if (mods.shift) {
    if (tool === "line" || tool === "arrow") {
      const len = Math.hypot(dx, dy);
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      dx = Math.round(Math.cos(ang) * len * 1000) / 1000;
      dy = Math.round(Math.sin(ang) * len * 1000) / 1000;
    } else {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * side;
      dy = (dy < 0 ? -1 : 1) * side;
    }
  }
  if (mods.alt) return [[a[0] - dx, a[1] - dy], [a[0] + dx, a[1] + dy]];
  return [a, [a[0] + dx, a[1] + dy]];
}

/** Arrow head (open chevron) at `tip`, pointing away from `from`. */
export function arrowHead(from: Point, tip: Point, sw: number): string {
  const L = Math.max(9, sw * 4.2), W = L * 0.55;
  const dx = tip[0] - from[0], dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const bx = tip[0] - ux * L, by = tip[1] - uy * L;
  const r = (v: number) => Math.round(v * 10) / 10;
  return `M${r(bx - uy * W)} ${r(by + ux * W)} L${tip[0]} ${tip[1]} L${r(bx + uy * W)} ${r(by - ux * W)}`;
}

export function shapePath(tool: ShapeTool, p0: Point, p1: Point): string {
  const [x0, y0] = p0, [x1, y1] = p1;
  if (tool === "line" || tool === "arrow") return `M${x0} ${y0} L${x1} ${y1}`;
  const l = Math.min(x0, x1), t = Math.min(y0, y1), r = Math.max(x0, x1), b = Math.max(y0, y1);
  if (tool === "rect") return `M${l} ${t} H${r} V${b} H${l} Z`;
  const rx = (r - l) / 2, ry = (b - t) / 2, cx = l + rx, cy = t + ry;
  return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

// ── tapered outline (perfect-freehand style) ─────────────────────────────

/** Closed outline of a variable-width stroke: width follows pressure (0..1 per point, when
 *  known) and tapers in at the start and out at the end, with round caps. */
export function freehandOutline(pts: Point[], size: number, pressures?: number[]): Point[] {
  const n = pts.length;
  if (n === 0) return [];
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1];
  const taper = Math.min(total * 0.3, size * 7);
  const radius = (i: number) => {
    const p = pressures?.[i];
    const w = p === undefined ? size : size * (0.3 + 0.95 * p);
    const ease = (v: number) => 1 - (1 - Math.min(1, v)) ** 2;
    const f = taper > 0 ? Math.min(ease(cum[i] / taper), ease((total - cum[i]) / taper)) : 1;
    return Math.max(0.35, (w / 2) * (0.22 + 0.78 * f));
  };
  if (n === 1 || total < 0.5) {
    const r = Math.max(0.5, size / 2);
    return Array.from({ length: 12 }, (_, k) => [pts[0][0] + Math.cos((k / 12) * Math.PI * 2) * r, pts[0][1] + Math.sin((k / 12) * Math.PI * 2) * r] as Point);
  }
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const r = radius(i);
    left.push([pts[i][0] - ty * r, pts[i][1] + tx * r]);
    right.push([pts[i][0] + ty * r, pts[i][1] - tx * r]);
  }
  const cap = (c: Point, from: Point, r: number, steps = 5): Point[] => {
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    return Array.from({ length: steps - 1 }, (_, k) => {
      const a = a0 - (Math.PI * (k + 1)) / steps;
      return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r] as Point;
    });
  };
  const end = cap(pts[n - 1], left[n - 1], radius(n - 1));
  const start = cap(pts[0], right[0], radius(0));
  return [...left, ...end, ...right.reverse(), ...start];
}

/** Smooth closed SVG path through an outline (quadratic curves through the midpoints). */
export function outlinePath(poly: Point[]): string {
  if (poly.length < 3) return "";
  const r = (v: number) => Math.round(v * 100) / 100;
  const mid = (a: Point, b: Point) => `${r((a[0] + b[0]) / 2)} ${r((a[1] + b[1]) / 2)}`;
  let d = `M${mid(poly[0], poly[1])}`;
  for (let i = 1; i <= poly.length; i++) {
    const p = poly[i % poly.length], q = poly[(i + 1) % poly.length];
    d += ` Q${r(p[0])} ${r(p[1])} ${mid(p, q)}`;
  }
  return `${d}Z`;
}

export function parsePressure(pr: string | undefined, n: number): number[] | undefined {
  if (!pr || !/^[0-9]+$/.test(pr)) return undefined;
  if (pr.length === n) return [...pr].map((c) => Number(c) / 9);
  // tolerate a length mismatch: stretch the digits over the points
  return Array.from({ length: n }, (_, i) => Number(pr[Math.round((i / Math.max(1, n - 1)) * (pr.length - 1))]) / 9);
}

// ── hit tests (world coordinates) ────────────────────────────────────────

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** The polyline a draw item is made of, in world coordinates (shapes become their outline). */
export function itemPolyline(item: Item): Point[] {
  const ox = item.x ?? 0, oy = item.y ?? 0;
  const pts = (item.d ?? "").split(" ").map((p) => p.split(",").map(Number) as Point)
    .filter((p) => p.length === 2 && p.every(Number.isFinite)).map(([x, y]) => [x + ox, y + oy] as Point);
  if (pts.length < 2 || !isShape(item.tl)) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (item.tl === "line" || item.tl === "arrow") return [a, b];
  const l = Math.min(a[0], b[0]), t = Math.min(a[1], b[1]), r = Math.max(a[0], b[0]), bt = Math.max(a[1], b[1]);
  if (item.tl === "rect") return [[l, t], [r, t], [r, bt], [l, bt], [l, t]];
  const cx = (l + r) / 2, cy = (t + bt) / 2, rx = (r - l) / 2, ry = (bt - t) / 2;
  return Array.from({ length: 49 }, (_, k) => [cx + Math.cos((k / 48) * Math.PI * 2) * rx, cy + Math.sin((k / 48) * Math.PI * 2) * ry] as Point);
}

/** True when a circle of radius `r` at `p` touches the item's ink. */
export function strokeHit(item: Item, p: Point, r: number): boolean {
  const pts = itemPolyline(item);
  const reach = r + Math.max(1, (item.sw ?? 1.9) / 2);
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= reach;
  for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= reach) return true;
  return false;
}

/** Strokes the eraser at `p` (radius `r`) would remove. */
export function eraseHits(items: Record<string, Item>, p: Point, r: number): string[] {
  const out: string[] = [];
  for (const [id, it] of Object.entries(items)) if (it.k === "draw" && !it.in && strokeHit(it, p, r)) out.push(id);
  return out;
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Strokes mostly (≥ 60 % of their points) inside a lasso loop. */
export function lassoHits(items: Record<string, Item>, loop: Point[]): string[] {
  if (loop.length < 3) return [];
  const out: string[] = [];
  for (const [id, it] of Object.entries(items)) {
    if (it.k !== "draw" || it.in) continue;
    const pts = itemPolyline(it);
    if (!pts.length) continue;
    const inside = pts.filter((q) => pointInPolygon(q, loop)).length;
    if (inside / pts.length >= 0.6) out.push(id);
  }
  return out;
}

/** Selection grown to whole groups (`g`): picking one grouped stroke picks its siblings. */
export function expandGroups(items: Record<string, Item>, ids: Iterable<string>): Set<string> {
  const sel = new Set(ids);
  const groups = new Set([...sel].map((id) => items[id]?.g).filter(Boolean));
  if (groups.size) for (const [id, it] of Object.entries(items)) if (it.g && groups.has(it.g)) sel.add(id);
  return sel;
}

/** A short random group id (matches boardkit's `g` validation). */
export function newGroupId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(4, "0");
}

// ── rendering a draw item ────────────────────────────────────────────────

export interface InkPath { d: string; fill: boolean; dashed: boolean }
export interface InkGeometry { paths: InkPath[]; box: { x: number; y: number; w: number; h: number } }

/** SVG paths for a draw item, in the item's own coordinates, and the padded box they need. */
export function inkGeometry(item: Item, strokePath: (pts: Point[]) => string): InkGeometry | null {
  const pts = (item.d ?? "").split(" ").map((p) => p.split(",").map(Number) as Point)
    .filter((p) => p.length === 2 && p.every(Number.isFinite));
  if (!pts.length) return null;
  const sw = item.sw ?? 1.9;
  const dashed = !!item.ds;
  const paths: InkPath[] = [];
  let pad = Math.max(6, sw);
  if (isShape(item.tl) && pts.length >= 2) {
    const a = pts[0], b = pts[pts.length - 1];
    paths.push({ d: shapePath(item.tl, a, b), fill: false, dashed });
    if (item.tl === "arrow") {
      paths.push({ d: arrowHead(a, b, sw), fill: false, dashed: false });
      pad += Math.max(9, sw * 4.2);
    }
  } else if (item.sm && item.tl !== "hl" && !dashed) {
    paths.push({ d: outlinePath(freehandOutline(pts, sw * 1.35, parsePressure(item.pr, pts.length))), fill: true, dashed: false });
  } else {
    paths.push({ d: strokePath(pts), fill: false, dashed });
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return { paths, box: { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad } };
}
