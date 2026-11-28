// Presentation mode, the pure half: stop resolution, the player (a small state machine that
// flies the camera from stop to stop, with optional dwell for auto-play), the carry that follows
// a tour into a nested board and back, and window.__hbTour for a recorder. No React, no DOM, and
// no runtime imports from sibling modules (node --test loads this file as is): the camera, the
// geometry and the clock come in through `PlayerIO`.
import type { Item, Tour, TourStop } from "./model";

export interface Rect { x: number; y: number; w: number; h: number }
export interface View { x: number; y: number; z: number }
export interface ClockLike { now(): number; request(cb: (t: number) => void): number; cancel(id: number): void }

export const DEFAULT_DWELL_S = 4;

// ── stops ────────────────────────────────────────────────────────────────

interface DocLike { items: Record<string, Item>; tour?: Tour; name?: string }

/** The stops that can be shown now (an item deleted since the tour was written is skipped). */
export function liveStops(doc: DocLike | null | undefined): TourStop[] {
  const tour = doc?.tour;
  if (!tour) return [];
  return tour.stops.filter((s) => (s.id ? !!doc!.items[s.id] && doc!.items[s.id].k !== "line" : !!(s.r || s.v)));
}

export function itemTitle(it: Item | undefined): string {
  return ((it?.title || it?.text || it?.cap || it?.label || it?.note || "").trim().split("\n")[0] ?? "").slice(0, 80);
}

/** What the HUD calls a stop: its own caption, else the item's title, else "n". */
export function stopTitle(stop: TourStop, doc: DocLike | null | undefined, n: number): string {
  if (stop.t) return stop.t;
  const it = stop.id ? doc?.items[stop.id] : undefined;
  return itemTitle(it) || String(n);
}

/** A secondary line: a frame's note. */
export function stopNote(stop: TourStop, doc: DocLike | null | undefined): string {
  const it = stop.id ? doc?.items[stop.id] : undefined;
  return it?.k === "frame" ? (it.note ?? "").trim().split("\n")[0].slice(0, 120) : "";
}

export const hasDwell = (tour: Tour | undefined): boolean => !!tour && (!!tour.dw || tour.stops.some((s) => !!s.dw));

/** Seconds a stop waits in auto-play. */
export const dwellOf = (stop: TourStop, tour: Tour | undefined): number => stop.dw ?? tour?.dw ?? DEFAULT_DWELL_S;

/** Frames in reading order (rows top to bottom, left to right inside a row), as stops. Mirrors tour.frames_in_order. */
export function framesAsStops(doc: DocLike, rectOf: (id: string) => Rect | null): TourStop[] {
  const rows: { id: string; r: Rect }[][] = [];
  const all = Object.entries(doc.items).filter(([, it]) => it.k === "frame" && !it.in)
    .map(([id]) => ({ id, r: rectOf(id) })).filter((f): f is { id: string; r: Rect } => !!f.r)
    .sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);
  for (const f of all) {
    const row = rows.find((r) => Math.abs(f.r.y - r[0].r.y) <= Math.max(40, 0.5 * Math.min(f.r.h, r[0].r.h)));
    if (row) row.push(f); else rows.push([f]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.r.x - b.r.x)).map((f) => ({ k: "frame" as const, id: f.id }));
}

/** The tour with `stop` appended (or the tour started). */
export function withStop(tour: Tour | undefined, stop: TourStop): Tour {
  return { ...(tour ?? { stops: [] }), stops: [...(tour?.stops ?? []), stop] };
}

export function moveStop(tour: Tour, from: number, to: number): Tour {
  const stops = [...tour.stops];
  if (from < 0 || from >= stops.length) return tour;
  const [s] = stops.splice(from, 1);
  stops.splice(Math.max(0, Math.min(stops.length, to)), 0, s);
  return { ...tour, stops };
}

// ── player ───────────────────────────────────────────────────────────────

export interface PlayerState {
  on: boolean;
  /** current stop index and how many there are */
  i: number; n: number;
  auto: boolean;
  /** a camera flight is running */
  flying: boolean;
  /** the tour ran out (non-looping) and the player is about to hand control back */
  done: boolean;
}

export interface PlayerIO {
  /** the stops, read fresh each time (the document may change under a running tour) */
  stops: () => TourStop[];
  tour: () => Tour | undefined;
  /** the view that shows `stop`, null when it cannot be shown now */
  view: (stop: TourStop) => View | null;
  /** fly the camera; resolves true on arrival, false when cut short */
  fly: (to: View, o: { duration?: number }) => Promise<boolean>;
  cancel: () => void;
  clock: () => ClockLike;
  /** dive into the nested board a board stop points at; the tour carries on over there */
  enter?: (stop: TourStop, index: number, auto: boolean) => boolean;
  /** called when the tour ends (or is stopped by the user) */
  onEnd?: (why: "end" | "stop") => void;
  onState?: (s: PlayerState) => void;
}

export interface PlayOptions { auto?: boolean; duration?: number }

export class TourPlayer {
  private io: PlayerIO;
  private token = 0;
  private timer: { id: number; clock: ClockLike } | null = null;
  private duration: number | undefined;
  state: PlayerState = { on: false, i: 0, n: 0, auto: false, flying: false, done: false };

  constructor(io: PlayerIO) { this.io = io; }

  private set(p: Partial<PlayerState>): void {
    this.state = { ...this.state, ...p };
    this.io.onState?.(this.state);
  }

  private clearTimer(): void {
    if (this.timer) { this.timer.clock.cancel(this.timer.id); this.timer = null; }
  }

  /** Begins at stop `index` (default 0). Resolves when the camera arrives. */
  start(index = 0, o: PlayOptions = {}): Promise<boolean> {
    const stops = this.io.stops();
    this.duration = o.duration;
    this.set({ on: true, n: stops.length, auto: o.auto ?? hasDwell(this.io.tour()), done: false });
    if (!stops.length) { this.finish("end"); return Promise.resolve(false); }
    return this.goto(index);
  }

  /** Flies to stop `index`, skipping any that cannot be shown (`dir` says which way to look on). */
  async goto(index: number, dir: 1 | -1 = 1): Promise<boolean> {
    const stops = this.io.stops();
    const n = stops.length;
    this.clearTimer();
    const tok = ++this.token;
    let i = Math.max(0, Math.min(n - 1, index));
    let view = n ? this.io.view(stops[i]) : null;
    while (!view && i + dir >= 0 && i + dir < n) { i += dir; view = this.io.view(stops[i]); }
    if (!view) { this.finish("end"); return false; }
    this.set({ i, n, flying: true, done: false });
    const ok = await this.io.fly(view, { duration: this.duration });
    if (tok !== this.token) return false;
    this.set({ flying: false });
    if (ok) this.arm(tok);
    return ok;
  }

  /** Waits the stop's dwell on the camera clock (so a manual clock steps it), then moves on. */
  private arm(tok: number): void {
    if (!this.state.auto || !this.state.on) return;
    const stop = this.io.stops()[this.state.i];
    if (!stop) return;
    const clock = this.io.clock();
    const deadline = clock.now() + dwellOf(stop, this.io.tour()) * 1000;
    const tick = (t: number) => {
      if (tok !== this.token || !this.state.auto) return;
      if (t >= deadline) { this.timer = null; void this.next(); return; }
      this.timer = { id: clock.request(tick), clock };
    };
    this.timer = { id: clock.request(tick), clock };
  }

  next(): Promise<boolean> {
    if (!this.state.on) return Promise.resolve(false);
    const stops = this.io.stops();
    const cur = stops[this.state.i];
    // a board stop dives into its board when you move on from it
    if (cur?.k === "board" && !this.state.flying && this.io.enter?.(cur, this.state.i, this.state.auto)) {
      this.token++;
      this.clearTimer();
      this.set({ on: false });
      return Promise.resolve(true);
    }
    if (this.state.i >= stops.length - 1) {
      if (this.io.tour()?.loop && stops.length > 1) return this.goto(0);
      this.finish("end");
      return Promise.resolve(false);
    }
    return this.goto(this.state.i + 1, 1);
  }

  prev(): Promise<boolean> {
    if (!this.state.on) return Promise.resolve(false);
    return this.state.i > 0 ? this.goto(this.state.i - 1, -1) : this.goto(0);
  }

  setAuto(on: boolean): void {
    this.set({ auto: on });
    if (!on) this.clearTimer();
    else if (this.state.on && !this.state.flying && !this.timer) this.arm(this.token);
  }

  toggleAuto(): void { this.setAuto(!this.state.auto); }

  /** Silently drops timers and in-flight work (the board unmounted); no onEnd. */
  dispose(): void { this.token++; this.clearTimer(); }

  /** Stops at the current stop and hands control back. */
  stop(): void { this.finish("stop"); }

  private finish(why: "end" | "stop"): void {
    this.token++;
    this.clearTimer();
    if (why === "stop") this.io.cancel();
    this.set({ on: false, flying: false, done: why === "end" });
    this.io.onEnd?.(why);
  }
}

// ── carry: a tour that dives into nested boards and comes back ───────────

export interface CarryFrame { board: string; index: number; auto: boolean }
export interface Carry {
  stack: CarryFrame[];
  /** "in": heading into `target` (a child); "out": heading back up to `target` */
  phase: "in" | "out";
  target: string;
  duration?: number;
}

let carry: Carry | null = null;
export const peekCarry = (): Carry | null => carry;
export const clearCarry = (): void => { carry = null; };

/** `from` is diving into `child` from stop `index`. */
export function carryInto(from: string, index: number, child: string, auto: boolean, duration?: number): void {
  carry = { stack: [...(carry?.stack ?? []), { board: from, index, auto }], phase: "in", target: child, duration };
}

/** The child tour is over: head back up to the board that dove in. Returns that board, or null with nothing to go back to. */
export function carryOut(): string | null {
  if (!carry || !carry.stack.length) { carry = null; return null; }
  carry = { ...carry, phase: "out", target: carry.stack[carry.stack.length - 1].board };
  return carry.target;
}

export type CarryRole =
  /** a nested board the tour just dived into; `depth` = how many boards are waiting above it */
  | { role: "child"; depth: number; duration?: number }
  /** the board that dove in, back again: carry on from `index`; `depth` = boards still waiting above it */
  | { role: "resume"; index: number; auto: boolean; depth: number; duration?: number }
  | null;

/** What a board that just mounted should do with the carry. A mismatch (the user went elsewhere) drops it. */
export function claimCarry(bid: string): CarryRole {
  const c = carry;
  if (!c) return null;
  if (c.target !== bid) { carry = null; return null; }
  if (c.phase === "in") return { role: "child", depth: c.stack.length, duration: c.duration };
  const top = c.stack[c.stack.length - 1];
  const rest = c.stack.slice(0, -1);
  carry = rest.length ? { ...c, stack: rest, phase: "in", target: bid } : null;
  return { role: "resume", index: top.index + 1, auto: top.auto, depth: rest.length, duration: c.duration };
}

// ── window.__hbTour ──────────────────────────────────────────────────────

export interface TourApi {
  version: 1;
  board: string;
  /** the stops that can be shown, with the view each one flies to */
  stops: () => { stop: TourStop; title: string; view: View | null }[];
  state: () => PlayerState;
  /** start presenting; resolves when the camera has arrived at `from` */
  start: (o?: { from?: number; auto?: boolean; duration?: number; hud?: boolean; fullscreen?: boolean }) => Promise<boolean>;
  next: () => Promise<boolean>;
  prev: () => Promise<boolean>;
  goto: (i: number) => Promise<boolean>;
  auto: (on: boolean) => void;
  stop: () => void;
  /** show / hide the on-screen controls (a recorder wants none) */
  hud: (on: boolean) => void;
}

type Win = { __hbTour?: TourApi };

/** Publishes the tour on `window.__hbTour`. Returns the disposer. */
export function installTourApi(api: TourApi, win: Win = window as unknown as Win): () => void {
  win.__hbTour = api;
  return () => { if (win.__hbTour === api) delete win.__hbTour; };
}
