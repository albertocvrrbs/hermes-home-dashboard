import { useEffect, useRef, useState } from "react";

const SYNODIC_DAYS = 29.53058867;
/** Reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

const PHASE_NAMES = [
  "new moon", "waxing crescent", "first quarter", "waxing gibbous",
  "full moon", "waning gibbous", "last quarter", "waning crescent",
];

function moonPhase(now: number): number {
  const days = (now - NEW_MOON_MS) / 86_400_000;
  return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS / SYNODIC_DAYS;
}

function phaseName(phase: number): string {
  return PHASE_NAMES[Math.round(phase * 8) % 8];
}

/** Pure-math moon: disc + terminator ellipse, drawn in the theme accent. */
export function MoonWidget() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(10, rect.width);
      cv.height = Math.max(10, rect.height);
      const accent =
        getComputedStyle(cv).getPropertyValue("--home-accent").trim() || "#d4af37";
      const phase = moonPhase(Date.now());
      setLabel(`${phaseName(phase)} · ${Math.round(
        ((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100,
      )}%`);

      const r = Math.min(cv.width, cv.height) / 2 - 6;
      const cx = cv.width / 2;
      const cy = cv.height / 2;
      ctx.clearRect(0, 0, cv.width, cv.height);

      // Dark side of the disc.
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();

      // Lit side: outer limb half-circle + terminator half-ellipse.
      const waxing = phase < 0.5;
      const a = r * Math.cos(2 * Math.PI * phase);
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing);
      ctx.ellipse(cx, cy, Math.abs(a), r, 0, Math.PI / 2, -Math.PI / 2, a > 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    const t = setInterval(draw, 3_600_000); // phase barely moves; hourly is plenty
    return () => { ro.disconnect(); clearInterval(t); };
  }, []);

  return (
    <div className="home-moon-wrap">
      <canvas ref={ref} className="home-moon-c" />
      <div className="home-moon-label">{label}</div>
    </div>
  );
}
