// Hermes' cursor, driven by his op stream: it walks to each op's target, reveals what he
// placed when it gets there, and leaves a ~1 s trail of dots. Lives in the world layer and is
// counter-scaled by --iz so it keeps its size at any zoom.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Cad } from "./bits";

export interface CursorStep {
  id: string | null;
  act: string;
  /** Resolved when the cursor starts moving to this step (the DOM exists by then). */
  locate: () => { x: number; y: number } | null;
  onArrive?: () => void;
}

export interface CursorHandle {
  enqueue: (steps: CursorStep[], doneLabel: string) => void;
  position: () => { x: number; y: number } | null;
  active: () => boolean;
}

const MOVE_MS = 300;
const DWELL_MS = 110;
const TRAIL = 16;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const HermesCursor = forwardRef<CursorHandle, { reducedMotion: boolean; onActive?: (on: boolean, act: string) => void }>(
  function HermesCursor({ reducedMotion, onActive }, ref) {
    const el = useRef<HTMLDivElement>(null);
    const actEl = useRef<HTMLSpanElement>(null);
    const trailEl = useRef<HTMLDivElement>(null);
    const state = useRef({
      pos: null as { x: number; y: number } | null,
      queue: [] as CursorStep[],
      doneLabel: "",
      running: false,
      trail: [] as { x: number; y: number; t: number }[],
      idleTimer: 0 as unknown as ReturnType<typeof setTimeout>,
      raf: 0,
    });
    const activeCb = useRef(onActive);
    activeCb.current = onActive;

    const paint = (x: number, y: number, act?: string) => {
      const s = state.current;
      s.pos = { x, y };
      if (el.current) el.current.style.transform = `translate(${x}px, ${y}px) scale(var(--iz, 1))`;
      if (act !== undefined && actEl.current && actEl.current.textContent !== act) actEl.current.textContent = act;
      const now = performance.now();
      s.trail.push({ x, y, t: now });
      while (s.trail.length && now - s.trail[0].t > 1000) s.trail.shift();
      const dots = trailEl.current?.children;
      if (dots) {
        const recent = s.trail.slice(-TRAIL * 3).filter((_, i, a) => (a.length - i) % 3 === 0);
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i] as HTMLElement;
          const p = recent[recent.length - 1 - i];
          if (!p || Math.hypot(p.x - x, p.y - y) < 6) { d.style.opacity = "0"; continue; }
          d.style.opacity = String(Math.max(0, (1 - (now - p.t) / 1000) * 0.55));
          d.style.transform = `translate(${p.x}px, ${p.y}px) scale(var(--iz, 1))`;
        }
      }
    };

    const fadeTrail = () => {
      const s = state.current;
      const step = () => {
        if (!s.pos) return;
        paint(s.pos.x, s.pos.y);
        if (s.trail.length > 1 && !s.running) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    };

    const setIdle = (idle: boolean) => {
      el.current?.classList.toggle("idle", idle);
    };

    const run = () => {
      const s = state.current;
      if (s.running) return;
      const next = s.queue.shift();
      if (!next) {
        if (actEl.current) actEl.current.textContent = s.doneLabel;
        activeCb.current?.(false, s.doneLabel);
        clearTimeout(s.idleTimer);
        s.idleTimer = setTimeout(() => setIdle(true), 4000);
        fadeTrail();
        return;
      }
      const target = next.locate();
      if (!target) { next.onArrive?.(); run(); return; }
      s.running = true;
      clearTimeout(s.idleTimer);
      setIdle(false);
      activeCb.current?.(true, next.act);
      const from = s.pos ?? { x: target.x + 180, y: target.y - 90 };
      if (reducedMotion) {
        paint(target.x, target.y, next.act);
        next.onArrive?.();
        s.running = false;
        setTimeout(run, 60);
        return;
      }
      const t0 = performance.now();
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / MOVE_MS);
        const e = ease(k);
        paint(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e, next.act);
        if (k < 1) { s.raf = requestAnimationFrame(frame); return; }
        next.onArrive?.();
        setTimeout(() => { s.running = false; run(); }, DWELL_MS);
      };
      s.raf = requestAnimationFrame(frame);
    };

    useImperativeHandle(ref, () => ({
      enqueue: (steps, doneLabel) => {
        state.current.queue.push(...steps);
        state.current.doneLabel = doneLabel;
        run();
      },
      position: () => state.current.pos,
      active: () => state.current.running || state.current.queue.length > 0,
    }));

    useEffect(() => () => {
      cancelAnimationFrame(state.current.raf);
      clearTimeout(state.current.idleTimer);
    }, []);

    return (
      <>
        <div className="hb-trail" ref={trailEl} aria-hidden="true">
          {Array.from({ length: TRAIL }, (_, i) => (
            <i key={i} style={{ position: "absolute", left: -1.5, top: -1.5, width: 3, height: 3, background: "var(--accent)", opacity: 0, transformOrigin: "1.5px 1.5px" }} />
          ))}
        </div>
        <div className="hb-hcur idle" ref={el} aria-hidden="true">
          <svg className="arrow" width="20" height="22" viewBox="0 0 20 22">
            <path d="M2.5 2 17 10.4 10 11.9 6.6 18.8z" fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <div className="label">
            <span className="name"><Cad size={[8, 10]} />HERMES</span>
            <span className="act"><span ref={actEl} /><span className="caret" /></span>
          </div>
        </div>
      </>
    );
  },
);
