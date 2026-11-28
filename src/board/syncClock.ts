// Shared playheads ("sync groups"). Cards whose `sync` field names the same group share one clock:
// play / pause / seek / rate from any of them moves all of them. A video card with a real <video>
// element is the master (the clock follows video.currentTime, frame-accurate through
// requestVideoFrameCallback when the browser has it); with no video the group runs its own clock.
// Components read it as `hb.clock`; scripts and recorders step it deterministically through
// `window.__hbSync` (manual mode). Pure TypeScript, no React/DOM imports, so node --test loads it.

export interface ClockState {
  /** seconds */
  t: number;
  playing: boolean;
  rate: number;
  /** 0 when unknown */
  duration: number;
  /** a video drives it */
  master: boolean;
  /** frozen to real time: only advance()/seek() move it */
  manual: boolean;
}

export type ClockEvent = "tick" | "state" | "seek";
export type ClockListener = (event: ClockEvent, state: ClockState) => void;

type Fn = () => void;

export interface VideoLike {
  currentTime: number;
  duration: number;
  paused: boolean;
  playbackRate: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, fn: Fn): void;
  removeEventListener(type: string, fn: Fn): void;
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
}

export interface TimeSource {
  now(): number;
  raf(fn: (now: number) => void): number;
  caf(id: number): void;
}

export function browserTime(): TimeSource {
  const g = globalThis as unknown as {
    performance?: { now(): number }; requestAnimationFrame?: (f: (n: number) => void) => number; cancelAnimationFrame?: (i: number) => void;
  };
  return {
    now: () => (g.performance ? g.performance.now() : Date.now()),
    raf: (fn) => (g.requestAnimationFrame ? g.requestAnimationFrame(fn) : (setTimeout(() => fn(Date.now()), 16) as unknown as number)),
    caf: (id) => (g.cancelAnimationFrame ? g.cancelAnimationFrame(id) : clearTimeout(id)),
  };
}

export const RATES = [0.25, 0.5, 1, 1.5, 2] as const;
const clampRate = (r: number) => (Number.isFinite(r) ? Math.max(0.1, Math.min(8, r)) : 1);
const finite = (n: number, d = 0) => (Number.isFinite(n) ? n : d);

/** One shared playhead. */
export class GroupClock {
  readonly name: string;
  private s: ClockState;
  private subs = new Set<ClockListener>();
  private video: VideoLike | null = null;
  private offVideo: Fn | null = null;
  private loop = 0;
  private vloop = 0;
  private wall = 0;     // time source ms when the free-running clock last advanced
  private pendingSeek: Array<() => void> = [];

  private time: TimeSource;
  private hub?: SyncHub;

  constructor(name: string, time: TimeSource, hub?: SyncHub) {
    this.name = name;
    this.time = time;
    this.hub = hub;
    this.s = { t: 0, playing: false, rate: 1, duration: 0, master: false, manual: false };
  }

  get state(): ClockState { return { ...this.s }; }
  get hasVideo(): boolean { return this.video !== null; }

  subscribe(fn: ClockListener): () => void {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }

  private emit(ev: ClockEvent): void {
    const st = this.state;
    for (const fn of [...this.subs]) { try { fn(ev, st); } catch { /* a listener must not break the clock */ } }
    this.hub?.changed(this.name);
  }

  // ── the video master ──────────────────────────────────────────────────
  attachVideo(v: VideoLike): () => void {
    if (this.video === v) return () => this.detach(v);
    this.detachCurrent();
    this.video = v;
    this.s.master = true;
    const ev = (name: string, f: Fn) => { v.addEventListener(name, f); return () => v.removeEventListener(name, f); };
    const dur = () => { const d = finite(v.duration); if (d > 0 && d !== this.s.duration) { this.s.duration = d; this.emit("state"); } };
    const offs = [
      ev("loadedmetadata", dur), ev("durationchange", dur),
      ev("play", () => { if (this.s.manual) return; this.freeze(); this.s.playing = true; this.s.t = finite(v.currentTime); this.startLoop(); this.emit("state"); }),
      ev("pause", () => { if (this.s.manual) return; this.s.playing = false; this.s.t = finite(v.currentTime); this.stopLoop(); this.emit("state"); }),
      ev("ended", () => { this.s.playing = false; this.s.t = finite(v.currentTime); this.stopLoop(); this.emit("state"); }),
      ev("ratechange", () => { this.s.rate = clampRate(v.playbackRate); this.emit("state"); }),
      ev("seeked", () => {
        this.s.t = finite(v.currentTime);
        this.emit("tick");
        const waiting = this.pendingSeek; this.pendingSeek = [];
        waiting.forEach((f) => f());
      }),
      ev("seeking", () => { if (!this.s.manual) { this.s.t = finite(v.currentTime); this.emit("seek"); } }),
    ];
    this.offVideo = () => offs.forEach((o) => o());
    // adopt what the group already was, so linking a video does not rewind the others
    const had = this.s;
    dur();
    if (had.t > 0 && Math.abs(v.currentTime - had.t) > 0.05) { try { v.currentTime = had.t; } catch { /* metadata not ready */ } }
    this.s.rate = clampRate(had.rate);
    try { v.playbackRate = this.s.rate; } catch { /* ignore */ }
    if (had.playing && !had.manual) { this.stopLoop(); this.startVideo(v); } else { this.s.t = had.t; }
    this.emit("state");
    return () => this.detach(v);
  }

  private detach(v: VideoLike): void { if (this.video === v) { this.detachCurrent(); this.emit("state"); } }

  private detachCurrent(): void {
    this.stopLoop();
    this.offVideo?.();
    this.offVideo = null;
    this.video = null;
    this.s.master = false;
    const waiting = this.pendingSeek; this.pendingSeek = [];
    waiting.forEach((f) => f());
  }

  // ── the loop ──────────────────────────────────────────────────────────
  private freeze(): void { this.wall = this.time.now(); }

  private startLoop(): void {
    if (this.s.manual || this.loop || this.vloop) return;
    const v = this.video;
    if (v && v.requestVideoFrameCallback) {
      const onFrame = (_n: number, meta: { mediaTime: number }) => {
        this.vloop = 0;
        if (!this.s.playing || !this.video) return;
        this.s.t = finite(meta.mediaTime, this.video.currentTime);
        this.emit("tick");
        this.vloop = this.video.requestVideoFrameCallback!(onFrame);
      };
      this.vloop = v.requestVideoFrameCallback(onFrame);
      return;
    }
    const step = () => {
      this.loop = 0;
      if (!this.s.playing) return;
      if (this.video) this.s.t = finite(this.video.currentTime);
      else {
        const now = this.time.now();
        this.s.t += ((now - this.wall) / 1000) * this.s.rate;
        this.wall = now;
        if (this.s.duration > 0 && this.s.t >= this.s.duration) {
          this.s.t = this.s.duration; this.s.playing = false; this.emit("state"); this.emit("tick"); return;
        }
      }
      this.emit("tick");
      this.loop = this.time.raf(step);
    };
    this.loop = this.time.raf(step);
  }

  private stopLoop(): void {
    if (this.loop) { this.time.caf(this.loop); this.loop = 0; }
    if (this.vloop) { try { this.video?.cancelVideoFrameCallback?.(this.vloop); } catch { /* ignore */ } this.vloop = 0; }
  }

  // ── commands (from any linked card, the transport or a script) ────────
  play(): void {
    if (this.s.playing) return;
    if (this.s.duration > 0 && this.s.t >= this.s.duration - 0.001) this.s.t = 0;
    this.s.playing = true;
    if (this.video && !this.s.manual) {
      try { this.video.currentTime = this.s.t; } catch { /* ignore */ }
      this.startVideo(this.video);
    } else { this.freeze(); this.startLoop(); }
    this.emit("state");
  }

  /** play() can be refused (autoplay policy, codec): the group must not claim to play then. */
  private startVideo(v: VideoLike): void {
    let res: Promise<void> | void;
    try { res = v.play(); } catch { res = Promise.reject(new Error("play failed")); }
    if (res && typeof (res as Promise<void>).catch === "function") {
      (res as Promise<void>).catch(() => {
        if (this.video !== v || !this.s.playing) return;
        this.s.playing = false;
        this.stopLoop();
        this.emit("state");
      });
    }
  }

  pause(): void {
    if (!this.s.playing) return;
    this.s.playing = false;
    this.stopLoop();
    if (this.video && !this.s.manual) { this.video.pause(); this.s.t = finite(this.video.currentTime, this.s.t); }
    this.emit("state");
  }

  toggle(): void { if (this.s.playing) this.pause(); else this.play(); }

  /** Moves the playhead. Resolves once the video (if any) shows that frame. */
  seek(t: number): Promise<void> {
    let to = Math.max(0, finite(t));
    if (this.s.duration > 0) to = Math.min(to, this.s.duration);
    this.s.t = to;
    if (!this.s.playing) this.freeze();
    this.emit("seek");
    const v = this.video;
    if (!v) { this.emit("tick"); return Promise.resolve(); }
    return new Promise<void>((resolve) => {
      this.pendingSeek.push(resolve);
      try { v.currentTime = to; } catch { this.pendingSeek = this.pendingSeek.filter((f) => f !== resolve); this.emit("tick"); resolve(); return; }
      // a seek to the very same frame fires no `seeked`: do not hang a recorder
      this.time.raf(() => { if (Math.abs(finite(v.currentTime) - to) < 1e-6 && !(v as { seeking?: boolean }).seeking) { const i = this.pendingSeek.indexOf(resolve); if (i >= 0) { this.pendingSeek.splice(i, 1); this.emit("tick"); resolve(); } } });
    });
  }

  setRate(r: number): void {
    this.s.rate = clampRate(r);
    if (this.video) { try { this.video.playbackRate = this.s.rate; } catch { /* ignore */ } }
    this.freeze();
    this.emit("state");
  }

  /** Free-running groups only (a video knows its own length). */
  setDuration(d: number): void {
    if (this.video) return;
    this.s.duration = Math.max(0, finite(d));
    this.emit("state");
  }

  setManual(on: boolean): void {
    if (this.s.manual === on) return;
    this.s.manual = on;
    if (on) { this.stopLoop(); this.video?.pause(); if (this.video) this.s.t = finite(this.video.currentTime, this.s.t); }
    else if (this.s.playing) { if (this.video) this.startVideo(this.video); else { this.freeze(); this.startLoop(); } }
    this.emit("state");
  }

  /** Manual mode: move time by `ms` of real time at the current rate (only while "playing"). */
  async advance(ms: number): Promise<number> {
    if (!this.s.manual) return this.s.t;
    if (this.s.playing) await this.seek(this.s.t + (ms / 1000) * this.s.rate);
    return this.s.t;
  }

  destroy(): void { this.stopLoop(); this.offVideo?.(); this.subs.clear(); }
}

/** All the clocks of one board. */
export class SyncHub {
  private clocks = new Map<string, GroupClock>();
  private watchers = new Set<(group: string) => void>();
  private manualOn = false;
  readonly time: TimeSource;

  constructor(time: TimeSource = browserTime()) { this.time = time; }

  clock(name: string): GroupClock {
    let c = this.clocks.get(name);
    if (!c) {
      c = new GroupClock(name, this.time, this);
      if (this.manualOn) c.setManual(true);
      this.clocks.set(name, c);
    }
    return c;
  }

  has(name: string): boolean { return this.clocks.has(name); }
  names(): string[] { return [...this.clocks.keys()].filter((n) => !n.startsWith("~")).sort(); }

  /** Anything about any clock changed (the transport re-renders from this). */
  watch(fn: (group: string) => void): () => void { this.watchers.add(fn); return () => { this.watchers.delete(fn); }; }
  changed(group: string): void { for (const w of [...this.watchers]) { try { w(group); } catch { /* ignore */ } } }

  get manual(): boolean { return this.manualOn; }
  setManual(on: boolean): void { this.manualOn = on; this.clocks.forEach((c) => c.setManual(on)); }

  async advance(ms: number): Promise<void> { await Promise.all([...this.clocks.values()].map((c) => c.advance(ms))); }

  destroy(): void { this.clocks.forEach((c) => c.destroy()); this.clocks.clear(); this.watchers.clear(); }
}

// ── window.__hbSync: the recorder / QA face of the hub ────────────────────

export interface SyncApi {
  version: 1;
  board: string;
  groups: () => string[];
  state: (group?: string) => ClockState | null;
  play: (group?: string) => void;
  pause: (group?: string) => void;
  seek: (t: number, group?: string) => Promise<void>;
  rate: (r: number, group?: string) => void;
  /** Freeze every clock to the API: nothing advances until step()/advance(). */
  manual: (on: boolean) => void;
  /** Manual mode: advance `frames` frames at `fps` (default 1 frame at 30 fps), resolves with the new time. */
  step: (frames?: number, fps?: number, group?: string) => Promise<number>;
  /** Manual mode: advance by ms of media time on every playing group. */
  advance: (ms: number) => Promise<void>;
}

export function makeSyncApi(hub: SyncHub, board: string, defaultGroup: () => string | undefined): SyncApi {
  const pick = (g?: string) => { const n = g ?? defaultGroup() ?? hub.names()[0]; return n ? hub.clock(n) : null; };
  return {
    version: 1,
    board,
    groups: () => hub.names(),
    state: (g) => pick(g)?.state ?? null,
    play: (g) => pick(g)?.play(),
    pause: (g) => pick(g)?.pause(),
    seek: (t, g) => pick(g)?.seek(t) ?? Promise.resolve(),
    rate: (r, g) => pick(g)?.setRate(r),
    manual: (on) => hub.setManual(on),
    step: async (frames = 1, fps = 30, g) => {
      const c = pick(g);
      if (!c) return 0;
      const rate = Math.max(1, fps);
      await c.seek((Math.round(c.state.t * rate) + frames) / rate);   // snap to the frame grid: no float drift over a long capture
      return c.state.t;
    },
    advance: (ms) => hub.advance(ms),
  };
}

type SyncWin = { __hbSync?: SyncApi };

export function installSyncApi(api: SyncApi, win: SyncWin = window as unknown as SyncWin): () => void {
  win.__hbSync = api;
  return () => { if (win.__hbSync === api) delete win.__hbSync; };
}

export function formatClock(t: number, fps = 0): string {
  const s = Math.max(0, finite(t));
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const whole = Math.floor(sec);
  const tail = fps > 0 ? `:${String(Math.floor((sec - whole) * fps)).padStart(2, "0")}` : `.${String(Math.floor((sec - whole) * 10))}`;
  return `${m}:${String(whole).padStart(2, "0")}${tail}`;
}

/** Group names that the items of a document use, in first-seen order. */
export function groupsOf(items: Record<string, { sync?: string }>): string[] {
  const out: string[] = [];
  for (const it of Object.values(items)) if (it.sync && !out.includes(it.sync)) out.push(it.sync);
  return out;
}
