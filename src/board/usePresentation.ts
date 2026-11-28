// Presentation mode, the React half: owns the TourPlayer, flies the board camera for it, takes
// over the keyboard while it runs, follows a tour into nested boards and back, and publishes
// window.__hbTour. BoardView only renders the HUD and the `presenting` class from what this returns.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { flightDuration, viewForRect, type Camera } from "./camera";
import type { Rect, View } from "./geometry";
import type { BoardDoc, Tour, TourStop } from "./model";
import {
  TourPlayer, carryInto, carryOut, claimCarry, clearCarry, framesAsStops, installTourApi, liveStops, peekCarry, stopNote, stopTitle,
  type PlayerState, type TourApi,
} from "./tour";
import { getCameraClock } from "./camera";

const INITIAL: PlayerState = { on: false, i: 0, n: 0, auto: false, flying: false, done: false };

export interface PresentationDeps {
  bid: string;
  doc: BoardDoc | null;
  docRef: MutableRefObject<BoardDoc | null>;
  cam: MutableRefObject<Camera | null>;
  vpRef: MutableRefObject<HTMLElement | null>;
  view: MutableRefObject<View>;
  applyView: () => void;
  getRect: (id: string) => Rect | null;
  contentBounds: () => Rect | null;
  openChild: (id: string) => void;
  closeToParent: (id: string) => void;
  /** resolves when the zoom that brought us onto this board has landed */
  arrival: MutableRefObject<Promise<unknown> | null>;
  /** the board is loaded and has its first view */
  ready: boolean;
  stopCamera: () => void;
}

export interface StartOptions { from?: number; auto?: boolean; duration?: number; hud?: boolean; fullscreen?: boolean }

export interface Presentation {
  presenting: boolean;
  ps: PlayerState;
  hud: boolean;
  /** what the tour would play right now (a stored tour, else the frames in reading order) */
  stops: TourStop[];
  tour: Tour | undefined;
  stored: boolean;
  /** nested depth: 0 on the board the tour started on */
  depth: number;
  title: string;
  note: string;
  /** how many stops would play right now (measured fresh) */
  count: () => number;
  start: (o?: StartOptions) => Promise<boolean>;
  stop: () => void;
  next: () => void;
  prev: () => void;
  toggleAuto: () => void;
}

/** A presentation scales a flight up: slower and more deliberate than the everyday camera. */
const CINEMA = 1.9;

export function usePresentation(d: PresentationDeps): Presentation {
  const [ps, setPs] = useState<PlayerState>(INITIAL);
  // a board a tour just dived into (or came back to) renders on stage from its first paint
  const [presenting, setPresenting] = useState(() => { const c = peekCarry(); return !!c && c.target === d.bid; });
  const presentingRef = useRef(presenting);
  presentingRef.current = presenting;
  const [hud, setHud] = useState(true);
  const [depth, setDepth] = useState(0);
  const depthRef = useRef(0);
  const dep = useRef(d);
  dep.current = d;
  const doc = d.doc;
  const tour = doc?.tour;
  const stored = !!tour?.stops.length;

  /** The stops this board plays: its tour; the frames in order when it has none; a whole-board shot for a child. */
  const stopsNow = useCallback((): TourStop[] => {
    const { docRef, getRect, contentBounds } = dep.current;
    const cur = docRef.current;
    if (!cur) return [];
    const own = liveStops(cur);
    if (own.length) return own;
    if (!cur.tour?.stops.length) {
      const frames = framesAsStops(cur, getRect);
      if (frames.length) return frames;
    }
    if (depthRef.current > 0) {
      const b = contentBounds();
      if (b) return [{ k: "view", r: { x: b.x - 140, y: b.y - 120, w: b.w + 280, h: b.h + 240 } }];
    }
    return [];
  }, []);

  const viewOf = useCallback((stop: TourStop): View | null => {
    const { vpRef, getRect } = dep.current;
    const vp = vpRef.current;
    if (!vp) return null;
    if (stop.v) return { ...stop.v };
    const r = stop.r ?? (stop.id ? getRect(stop.id) : null);
    if (!r) return null;
    const size = { w: vp.clientWidth, h: vp.clientHeight };
    const frame = stop.k === "frame" || stop.k === "view";
    return viewForRect(r, size, { pad: frame ? 64 : 120, maxZ: frame ? 2.2 : 1.4, minZ: 0.05 });
  }, []);

  const playerRef = useRef<TourPlayer | null>(null);
  const hudRef = useRef(true);
  const fsRef = useRef(false);
  const arrived = useRef<((ok: boolean) => void) | null>(null);

  const exitFullscreen = useCallback(() => {
    if (fsRef.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    fsRef.current = false;
  }, []);

  const player = useMemo(() => {
    const p = new TourPlayer({
      stops: () => stopsNow(),
      tour: () => dep.current.docRef.current?.tour,
      view: (s) => viewOf(s),
      fly: (to, o) => {
        const c = dep.current.cam.current!;
        const from = dep.current.view.current;
        const vp = dep.current.vpRef.current;
        const size = { w: vp?.clientWidth ?? 1, h: vp?.clientHeight ?? 1 };
        const dur = o.duration ?? Math.round(Math.min(1700, Math.max(700, flightDuration(from, to, size) * CINEMA)));
        return c.flyTo(to, { duration: dur, ease: "inOut" });
      },
      cancel: () => dep.current.cam.current?.cancel(),
      clock: () => getCameraClock(),
      enter: (stop, index, auto) => {
        const ref = dep.current.docRef.current?.items[stop.id ?? ""]?.ref;
        if (!ref) return false;
        carryInto(dep.current.bid, index, ref, auto, undefined);
        dep.current.openChild(ref);
        return true;
      },
      onEnd: (why) => {
        if (why === "end" && depthRef.current > 0) {
          // a nested board's tour is over: climb back up and let the parent carry on
          const parent = carryOut();
          if (parent) { dep.current.closeToParent(parent); return; }
        }
        clearCarry();
        exitFullscreen();
        depthRef.current = 0;
        setDepth(0);
        setPresenting(false);
        arrived.current?.(false);
      },
      onState: (s) => setPs(s),
    });
    playerRef.current = p;
    return p;
  }, [exitFullscreen, stopsNow, viewOf]);

  // Chrome leaves / returns with the class; keep the board where it is on screen while the viewport moves
  const rectBefore = useRef<DOMRect | null>(null);
  const markViewport = () => { rectBefore.current = dep.current.vpRef.current?.getBoundingClientRect() ?? null; };
  const pending = useRef<{ from: number; o: StartOptions } | null>(null);
  useLayoutEffect(() => {
    const vp = dep.current.vpRef.current, before = rectBefore.current;
    rectBefore.current = null;
    if (vp && before) {
      const after = vp.getBoundingClientRect();
      const v = dep.current.view.current;
      if (after.left !== before.left || after.top !== before.top) {
        dep.current.view.current = { ...v, x: v.x + before.left - after.left, y: v.y + before.top - after.top };
        dep.current.applyView();
      }
    }
    const p = pending.current;
    if (presenting && p) {
      pending.current = null;
      void player.start(p.from, { auto: p.o.auto, duration: p.o.duration }).then((ok) => arrived.current?.(ok));
    }
  }, [presenting, player]);

  const begin = useCallback((from: number, o: StartOptions, sub = 0): Promise<boolean> => {
    depthRef.current = sub;
    setDepth(sub);
    hudRef.current = o.hud !== false;
    setHud(hudRef.current);
    dep.current.stopCamera();
    pending.current = { from, o };
    if (presentingRef.current) {
      // already on stage (a nested board, or a recorder restarting the tour): start straight away
      pending.current = null;
      return player.start(from, { auto: o.auto, duration: o.duration });
    }
    markViewport();
    setPresenting(true);
    return new Promise<boolean>((res) => { arrived.current = res; });
  }, [player]);

  const start = useCallback((o: StartOptions = {}): Promise<boolean> => {
    if (!stopsNow().length) return Promise.resolve(false);
    clearCarry();
    if (o.fullscreen) {
      fsRef.current = true;
      void document.documentElement.requestFullscreen?.().catch(() => { fsRef.current = false; });
    }
    return begin(o.from ?? 0, o, 0);
  }, [begin, stopsNow]);

  const stop = useCallback(() => player.stop(), [player]);
  const next = useCallback(() => { void player.next(); }, [player]);
  const prev = useCallback(() => { void player.prev(); }, [player]);
  const toggleAuto = useCallback(() => player.toggleAuto(), [player]);

  // arriving in a nested board with a tour in flight: play it (child) or carry on (parent, back again)
  const claimed = useRef<string | null>(null);
  useEffect(() => {
    if (!d.ready || claimed.current === d.bid) return;
    claimed.current = d.bid;
    const role = claimCarry(d.bid);
    if (!role) return;
    const go = () => {
      if (role.role === "child") { void begin(0, { auto: role.auto || undefined, duration: role.duration }, role.depth); return; }
      const n = stopsNow().length;
      depthRef.current = role.depth;
      if (role.index >= n) {
        // the dive was the last stop of this board's tour
        if (role.depth > 0) { const parent = carryOut(); if (parent) { dep.current.closeToParent(parent); return; } }
        setPresenting(false);
        return;
      }
      void begin(role.index, { auto: role.auto, duration: role.duration }, role.depth);
    };
    const wait = d.arrival.current;
    if (wait) void wait.then(go, go); else go();
  }, [begin, d.arrival, d.bid, d.ready, stopsNow]);
  useEffect(() => { claimed.current = null; }, [d.bid]);

  // the keyboard belongs to the presentation while it runs
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (e.type === "keyup") { if (k === " ") eat(); return; }
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === "Enter") { eat(); next(); }
      else if (k === " ") { eat(); if (playerRef.current?.state.auto) toggleAuto(); else next(); }
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { eat(); prev(); }
      else if (k === "Home") { eat(); void player.goto(0); }
      else if (k === "End") { eat(); void player.goto(Math.max(0, stopsNow().length - 1)); }
      else if (k === "Escape") { eat(); stop(); }
      else if (k === "p" || k === "P") { eat(); toggleAuto(); }
      else if (k === "h" || k === "H") { eat(); hudRef.current = !hudRef.current; setHud(hudRef.current); }
      else if (k === "f" || k === "F") {
        eat();
        if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
        else { fsRef.current = true; void document.documentElement.requestFullscreen?.().catch(() => { fsRef.current = false; }); }
      } else eat();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onKey, true); };
  }, [next, player, presenting, prev, stop, stopsNow, toggleAuto]);

  // leaving real fullscreen with the browser's own Esc ends the presentation
  useEffect(() => {
    if (!presenting) return;
    const onFs = () => { if (fsRef.current && !document.fullscreenElement) { fsRef.current = false; stop(); } };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [presenting, stop]);

  // leaving the board mid-tour ends the player (the carry decides what the next board does)
  useEffect(() => () => { playerRef.current?.dispose(); }, []);

  // the QA / recorder surface
  useEffect(() => {
    if (!d.ready) return;
    const api: TourApi = {
      version: 1, board: d.bid,
      stops: () => stopsNow().map((stop, i) => ({ stop, title: stopTitle(stop, dep.current.docRef.current, i + 1), view: viewOf(stop) })),
      state: () => playerRef.current?.state ?? INITIAL,
      start: (o) => start(o),
      next: () => player.next(),
      prev: () => player.prev(),
      goto: (i) => player.goto(i),
      auto: (on) => player.setAuto(on),
      stop: () => player.stop(),
      hud: (on) => { hudRef.current = on; setHud(on); },
    };
    return installTourApi(api);
  }, [d.bid, d.ready, player, start, stopsNow, viewOf]);

  const stops = useMemo(() => stopsNow(), [stopsNow, doc, presenting, ps.n, ps.on]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = stops[ps.i];
  return {
    presenting, ps, hud, stops, tour, stored, depth,
    title: cur ? stopTitle(cur, doc, ps.i + 1) : "",
    note: cur ? stopNote(cur, doc) : "",
    count: () => stopsNow().length,
    start, stop, next, prev, toggleAuto,
  };
}
