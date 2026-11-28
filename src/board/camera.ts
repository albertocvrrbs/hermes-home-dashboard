// The board's camera: eased, interruptible moves between views, on a clock that can be
// swapped for a manual one (frame-by-frame capture). Pure: no React, no DOM beyond the
// default clock's requestAnimationFrame, so node --test can drive it.
import type { Rect, View } from "./geometry";

// Mirrors geometry.ts (node --test can't follow extensionless runtime imports between modules).
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.4;
function zoomView(v: View, f: number, sx: number, sy: number): View {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * f));
  const wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
  return { z, x: sx - wx * z, y: sy - wy * z };
}

export type EaseFn = (t: number) => number;
export type EaseName = "out" | "inOut" | "in" | "linear" | "spring";
/** A name, a function of 0..1, or CSS cubic-bezier control points. */
export type Ease = EaseName | EaseFn | [number, number, number, number];

export interface Size { w: number; h: number }

// ── easing ───────────────────────────────────────────────────────────────

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s: number) => ((ax * s + bx) * s + cx) * s;
  const Y = (s: number) => ((ay * s + by) * s + cy) * s;
  const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 6; i++) {
      const err = X(s) - t;
      if (Math.abs(err) < 1e-6) return Y(s);
      const d = dX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0, hi = 1;
    s = t;
    for (let i = 0; i < 24; i++) {
      const x = X(s);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return Y(s);
  };
}

/** Critically damped spring, rescaled to land exactly on 1 at t = 1 (no overshoot). */
export function springEase(omega = 9): EaseFn {
  const end = 1 - (1 + omega) * Math.exp(-omega);
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - (1 + omega * t) * Math.exp(-omega * t)) / end);
}

export const EASES: Record<EaseName, EaseFn> = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.5, 0, 0.75, 0),
  linear: (t) => Math.min(1, Math.max(0, t)),
  spring: springEase(),
};

export function resolveEase(e: Ease | undefined, fallback: EaseName = "inOut"): EaseFn {
  if (typeof e === "function") return e;
  if (Array.isArray(e)) return cubicBezier(e[0], e[1], e[2], e[3]);
  return EASES[e ?? fallback] ?? EASES[fallback];
}

// ── views ────────────────────────────────────────────────────────────────

/** The view that frames `r` in `vp` with `pad` screen px around it, zoom clamped to [minZ, maxZ]. */
export function viewForRect(r: Rect, vp: Size, o: { pad?: number; minZ?: number; maxZ?: number } = {}): View {
  const pad = o.pad ?? 60, minZ = o.minZ ?? ZOOM_MIN, maxZ = o.maxZ ?? ZOOM_MAX;
  const z = Math.max(minZ, Math.min(maxZ, (vp.w - 2 * pad) / Math.max(1, r.w), (vp.h - 2 * pad) / Math.max(1, r.h)));
  return { z, x: vp.w / 2 - (r.x + r.w / 2) * z, y: vp.h / 2 - (r.y + r.h / 2) * z };
}

/** The view that puts world point (wx, wy) at the viewport centre at zoom z. */
export function viewCentered(wx: number, wy: number, z: number, vp: Size): View {
  return { z, x: vp.w / 2 - wx * z, y: vp.h / 2 - wy * z };
}

export function viewEquals(a: View, b: View, eps = 0.001): boolean {
  return Math.abs(a.z - b.z) < eps * Math.max(a.z, b.z) && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

/** In-between view at progress u: zoom moves geometrically (equal ratios per step) and the
 *  world point under the viewport centre moves along the straight line at the pace that keeps
 *  the screen-space motion even, so a push-in reads as one dolly and not as pan + zoom. */
export function mixView(a: View, b: View, u: number, vp: Size): View {
  if (u <= 0) return { ...a };
  if (u >= 1) return { ...b };
  const z = a.z * Math.pow(b.z / a.z, u);
  const cax = (vp.w / 2 - a.x) / a.z, cay = (vp.h / 2 - a.y) / a.z;
  const cbx = (vp.w / 2 - b.x) / b.z, cby = (vp.h / 2 - b.y) / b.z;
  const ia = 1 / a.z, ib = 1 / b.z;
  const p = Math.abs(ia - ib) < 1e-9 ? u : (1 / z - ia) / (ib - ia);
  const cx = cax + (cbx - cax) * p, cy = cay + (cby - cay) * p;
  return { z, x: vp.w / 2 - cx * z, y: vp.h / 2 - cy * z };
}

/** How long a move takes: 300–650 ms, longer for bigger zoom changes and longer pans. */
export function flightDuration(a: View, b: View, vp: Size): number {
  const dz = Math.abs(Math.log2(b.z / a.z));
  const cax = (vp.w / 2 - a.x) / a.z, cay = (vp.h / 2 - a.y) / a.z;
  const cbx = (vp.w / 2 - b.x) / b.z, cby = (vp.h / 2 - b.y) / b.z;
  const dist = Math.hypot(cbx - cax, cby - cay) * Math.min(a.z, b.z) / Math.max(1, Math.hypot(vp.w, vp.h));
  return Math.round(Math.max(300, Math.min(650, 330 + 70 * dz + 220 * Math.min(1, dist))));
}

// ── clock ────────────────────────────────────────────────────────────────

export interface Clock {
  now(): number;
  request(cb: (t: number) => void): number;
  cancel(id: number): void;
}

export const realClock: Clock = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

/** Time that only moves when told to: `advance(ms)` runs the queued frames at a fixed step. */
export class ManualClock implements Clock {
  t = 0;
  private id = 0;
  private queue = new Map<number, (t: number) => void>();
  now(): number { return this.t; }
  request(cb: (t: number) => void): number { const id = ++this.id; this.queue.set(id, cb); return id; }
  cancel(id: number): void { this.queue.delete(id); }
  /** Advance `ms` in frames of `step` ms (the last one may be shorter), running what each frame queued. */
  advance(ms: number, step = 1000 / 60): number {
    let left = ms, frames = 0;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      left -= dt;
      this.t += dt;
      const run = [...this.queue.values()];
      this.queue.clear();
      for (const cb of run) cb(this.t);
      frames++;
    }
    return frames;
  }
  pending(): number { return this.queue.size; }
}

let clock: Clock = realClock;
export const getCameraClock = (): Clock => clock;
/** Swap the clock every camera uses (null = the real one). */
export function setCameraClock(c: Clock | null): void { clock = c ?? realClock; }

// ── controller ───────────────────────────────────────────────────────────

export interface CameraIO {
  get: () => View;
  set: (v: View) => void;
  size: () => Size;
  reduced?: () => boolean;
  /** true when a move starts, false when it ends or is cut short. */
  onMoving?: (moving: boolean) => void;
}

export interface FlyOptions {
  /** ms; default picks one from the distance. 0 jumps. */
  duration?: number;
  ease?: Ease;
  /** Called every frame with eased progress 0..1 and the view just applied. */
  onFrame?: (u: number, v: View) => void;
}

interface Flight {
  from: View; to: View; t0: number; dur: number; ease: EaseFn; id: number;
  done: (completed: boolean) => void; onFrame?: FlyOptions["onFrame"]; clock: Clock;
}

export class Camera {
  private flight: Flight | null = null;
  private io: CameraIO;
  constructor(io: CameraIO) { this.io = io; }

  get moving(): boolean { return this.flight !== null; }
  /** Where the running move ends (null at rest). */
  get target(): View | null { return this.flight ? { ...this.flight.to } : null; }

  /** Moves to `to`; resolves true when it arrives, false when something cut it short. */
  flyTo(to: View, o: FlyOptions = {}): Promise<boolean> {
    this.stop(false);
    const from = this.io.get();
    const size = this.io.size();
    const dur = this.io.reduced?.() ? 0 : o.duration ?? flightDuration(from, to, size);
    if (dur <= 0 || viewEquals(from, to)) {
      this.io.set({ ...to });
      o.onFrame?.(1, to);
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      const c = getCameraClock();
      const f: Flight = { from, to: { ...to }, t0: c.now(), dur, ease: resolveEase(o.ease), id: 0, done: resolve, onFrame: o.onFrame, clock: c };
      this.flight = f;
      this.io.onMoving?.(true);
      const step = (now: number) => {
        if (this.flight !== f) return;
        const u = Math.min(1, Math.max(0, (now - f.t0) / f.dur));
        const e = f.ease(u);
        const v = u >= 1 ? { ...f.to } : mixView(f.from, f.to, e, this.io.size());
        this.io.set(v);
        f.onFrame?.(e, v);
        if (u >= 1) { this.flight = null; this.io.onMoving?.(false); f.done(true); return; }
        f.id = f.clock.request(step);
      };
      f.id = c.request(step);
    });
  }

  /** Zoom by factor `f` around a screen point, building on the running move's target so
   *  repeated presses accumulate. */
  zoomBy(f: number, sx: number, sy: number, o: FlyOptions = {}): Promise<boolean> {
    const base = this.target ?? this.io.get();
    return this.flyTo(zoomView(base, f, sx, sy), { duration: 220, ease: "out", ...o });
  }

  /** Cuts the running move where it is (user input wins). */
  cancel(): void { this.stop(true); }

  private stop(notify: boolean): void {
    const f = this.flight;
    if (!f) return;
    this.flight = null;
    f.clock.cancel(f.id);
    if (notify) this.io.onMoving?.(false);
    f.done(false);
  }
}

// ── programmatic API (window.__hbCamera) ─────────────────────────────────

export interface CameraTarget {
  rect?: Rect;
  item?: string;
  items?: string[];
  view?: View;
  /** Frame the whole board. */
  fit?: boolean;
  /** Frame the current selection. */
  selection?: boolean;
}

export interface CameraRequest extends CameraTarget {
  duration?: number;
  ease?: Ease;
  pad?: number;
  maxZ?: number;
  minZ?: number;
}

export interface BoardCameraApi {
  version: 1;
  board: string;
  flyTo: (req: CameraRequest) => Promise<boolean>;
  fit: (o?: FlyOptions) => Promise<boolean>;
  getView: () => View;
  setView: (v: View) => void;
  itemRect: (id: string) => Rect | null;
  cancel: () => void;
  moving: () => boolean;
  minimap: (on: boolean) => void;
  clock: {
    /** Freeze camera time; `advance` then moves it by hand. */
    manual: (on: boolean) => void;
    advance: (ms: number, step?: number) => number;
    now: () => number;
  };
}

let manual: ManualClock | null = null;
export const cameraClockApi: BoardCameraApi["clock"] = {
  manual: (on) => { if (on) { manual = manual ?? new ManualClock(); setCameraClock(manual); } else { manual = null; setCameraClock(null); } },
  advance: (ms, step) => (manual ? manual.advance(ms, step) : 0),
  now: () => getCameraClock().now(),
};

/** window.__hbClock: freeze and step camera time before any board is open (the Home widget's zoom). */
export function installClockApi(win: { __hbClock?: BoardCameraApi["clock"] } = window as unknown as { __hbClock?: BoardCameraApi["clock"] }): void {
  win.__hbClock = cameraClockApi;
}

type Win = { __hbCamera?: BoardCameraApi; dispatchEvent?: (e: Event) => boolean; addEventListener?: Window["addEventListener"]; removeEventListener?: Window["removeEventListener"] };

/** Publishes the board's camera on `window.__hbCamera` and listens for `hb:camera` events
 *  (detail = CameraRequest + optional `id`); `hb:camera:end` reports the outcome. Returns the disposer. */
export function installCameraApi(api: BoardCameraApi, win: Win = window as unknown as Win): () => void {
  win.__hbCamera = api;
  installClockApi(win as { __hbClock?: BoardCameraApi["clock"] });
  const onReq = (e: Event) => {
    const d = ((e as CustomEvent).detail ?? {}) as CameraRequest & { id?: string };
    void api.flyTo(d).then((completed) => {
      win.dispatchEvent?.(new CustomEvent("hb:camera:end", { detail: { id: d.id, completed, view: api.getView() } }));
    });
  };
  win.addEventListener?.("hb:camera", onReq);
  return () => {
    if (win.__hbCamera === api) delete win.__hbCamera;
    win.removeEventListener?.("hb:camera", onReq);
  };
}
