// Pure geometry for the board: stroke simplification, connector routing, dot sampling, fit.
import type { Point } from "./model";

export interface Rect { x: number; y: number; w: number; h: number }
export type Dir = "r" | "l" | "d" | "u";

/** Ramer–Douglas–Peucker. */
export function simplify(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > far) { far = d; best = i; }
    }
    if (best > 0 && far > eps) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** World points -> stored stroke: integer origin + "x,y x,y" relative pairs. */
export function toStroke(pts: Point[]): { x: number; y: number; d: string } {
  const r = pts.map(([x, y]) => [Math.round(x), Math.round(y)] as Point);
  const x = Math.min(...r.map((p) => p[0]));
  const y = Math.min(...r.map((p) => p[1]));
  return { x, y, d: r.map(([px, py]) => `${px - x},${py - y}`).join(" ") };
}

export function fromStroke(d: string | undefined): Point[] {
  if (!d) return [];
  return d.split(" ").map((pair) => pair.split(",").map(Number) as Point).filter((p) => p.length === 2 && p.every(Number.isFinite));
}

/** Smooth SVG path through stroke points (quadratic midpoints), for a drawn-by-hand look. */
export function strokePath(pts: Point[]): string {
  if (!pts.length) return "";
  if (pts.length < 3) return `M${pts.map((p) => p.join(" ")).join(" L")}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

const cx = (r: Rect) => r.x + r.w / 2;
const cy = (r: Rect) => r.y + r.h / 2;

/** Orthogonal route between two rects (or points as 0x0 rects): exits the facing sides,
 *  elbows at the midpoint. `dir` is the arrow head direction at the end. */
export function route(a: Rect, b: Rect): { points: Point[]; dir: Dir } {
  const hgap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const vgap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  let s: Point, e: Point, dir: Dir, horizontal: boolean;
  if (hgap > 0 && hgap >= vgap) {
    horizontal = true;
    if (b.x >= a.x + a.w) { s = [a.x + a.w, cy(a)]; e = [b.x, cy(b)]; dir = "r"; }
    else { s = [a.x, cy(a)]; e = [b.x + b.w, cy(b)]; dir = "l"; }
  } else {
    horizontal = false;
    if (cy(b) >= cy(a)) { s = [cx(a), a.y + a.h]; e = [cx(b), b.y]; dir = "d"; }
    else { s = [cx(a), a.y]; e = [cx(b), b.y + b.h]; dir = "u"; }
  }
  s = [Math.round(s[0]), Math.round(s[1])];
  e = [Math.round(e[0]), Math.round(e[1])];
  if (horizontal ? s[1] === e[1] : s[0] === e[0]) return { points: [s, e], dir };
  if (horizontal) {
    const mx = Math.round((s[0] + e[0]) / 2);
    return { points: [s, [mx, s[1]], [mx, e[1]], e], dir };
  }
  const my = Math.round((s[1] + e[1]) / 2);
  return { points: [s, [s[0], my], [e[0], my], e], dir };
}

/** SVG path with rounded elbows of radius r (the mockup's connector). */
export function elbowPath(pts: Point[], r = 7): string {
  if (!pts.length) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const p1 = [b[0] + ((a[0] - b[0]) * rr) / d1, b[1] + ((a[1] - b[1]) * rr) / d1];
    const p2 = [b[0] + ((c[0] - b[0]) * rr) / d2, b[1] + ((c[1] - b[1]) * rr) / d2];
    d += ` L${p1[0]} ${p1[1]} Q${b[0]} ${b[1]} ${p2[0]} ${p2[1]}`;
  }
  const z = pts[pts.length - 1];
  return `${d} L${z[0]} ${z[1]}`;
}

/** Triangle head pointing along `dir`, tip at (x, y). */
export function headPath(x: number, y: number, dir: Dir, L = 7, W = 4): string {
  const [dx, dy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[dir];
  return `M${x} ${y} L${x - dx * L - dy * W} ${y - dy * L + dx * W} L${x - dx * L + dy * W} ${y - dy * L - dx * W}Z`;
}

/** Evenly spaced dots along a polyline (Hermes' dot-matrix connectors), starting at step/2. */
export function samplePolyline(pts: Point[], step: number): Point[] {
  const out: Point[] = [];
  let carry = step / 2;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let s = carry;
    while (s <= len) {
      const t = s / len;
      out.push([Math.round((ax + (bx - ax) * t) * 10) / 10, Math.round((ay + (by - ay) * t) * 10) / 10]);
      s += step;
    }
    carry = s - len;
  }
  return out;
}

/** The point `t` (0..1) of the way along a polyline, by length. */
export function pointAtT(pts: Point[], t: number): Point {
  if (pts.length < 2) return pts[0] ?? [0, 0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= len || i === pts.length - 1) {
      const u = len ? want / len : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    }
    want -= len;
  }
  return pts[pts.length - 1];
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface View { x: number; y: number; z: number }

export function fitView(b: Rect, vp: { w: number; h: number }, pad = 60, maxZ = 1.25): View {
  const z = Math.max(0.15, Math.min(maxZ, (vp.w - 2 * pad) / Math.max(1, b.w), (vp.h - 2 * pad) / Math.max(1, b.h)));
  return { z, x: vp.w / 2 - (b.x + b.w / 2) * z, y: vp.h / 2 - (b.y + b.h / 2) * z };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Kinds whose height is set by hand; everything else sizes its own height
 *  (video stages keep 16:9 or 9:16 via CSS aspect-ratio, images keep theirs). */
export const RESIZE_H = new Set(["frame", "box", "embed", "text", "shape"]);

/** The patch a resize-handle drag commits: width always, height only for free-height kinds. */
export function resizePatch(kind: string, w: number, h: number): { w: number; h?: number } {
  const p: { w: number; h?: number } = { w: Math.round(Math.max(kind === "shape" ? 40 : 120, w)) };
  if (RESIZE_H.has(kind)) p.h = Math.round(Math.max(40, h));
  return p;
}

// ── wheel: mouse wheels zoom, trackpads pan, pinch zooms ─────────────────

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 2.4;

export interface WheelLike {
  deltaX: number; deltaY: number; deltaMode: number;
  ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean;
  /** Chrome's legacy field: multiples of 120 for a wheel notch. */
  wheelDeltaY?: number;
}

/** "zoom" for a mouse wheel or a pinch (Chrome sends pinch as ctrl+wheel), "pan" for a
 *  two-finger trackpad scroll. A wheel notch is line/page mode, or a whole, vertical-only pixel
 *  delta of 50+ (or a wheelDelta that is a multiple of 120). Trackpads send small, fractional or
 *  two-axis pixel deltas, and keep doing so through their momentum, so a recent trackpad event
 *  (`trackpadRecent`) keeps the gesture panning. */
export function wheelIntent(e: WheelLike, trackpadRecent = false): "zoom" | "pan" {
  if (e.ctrlKey || e.metaKey) return "zoom";
  if (e.deltaMode !== 0) return "zoom";
  const notch = e.deltaX === 0 && e.deltaY !== 0 && (
    (typeof e.wheelDeltaY === "number" && e.wheelDeltaY !== 0 && Math.abs(e.wheelDeltaY) % 120 === 0)
    || (Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50));
  if (notch && !trackpadRecent) return "zoom";
  return "pan";
}

/** Zoom factor for one wheel event: pixel-normalised, clamped per event so one fast spin
 *  can't jump the whole range. A pinch is finer than a wheel notch. */
export function wheelZoomFactor(e: WheelLike): number {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
  const px = Math.max(-240, Math.min(240, e.deltaY * unit));
  const k = e.ctrlKey || e.metaKey ? 0.01 : 0.0015;
  return Math.exp(-px * k);
}

/** The view after zooming by `f` around screen point (sx, sy): that point stays put. */
export function zoomView(v: View, f: number, sx: number, sy: number, min = ZOOM_MIN, max = ZOOM_MAX): View {
  const z = Math.min(max, Math.max(min, v.z * f));
  const wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
  return { z, x: sx - wx * z, y: sy - wy * z };
}
