import { useEffect, useRef } from "react";
import type { StatusResponse } from "../../api-types";

const SPEED_PX = 2;
const TICK_MS = 33;
const BEAT_S = 1.0;

/** ECG-style waveform: 0 at rest, P bump, QRS spike, T bump. t in [0,1). */
function beatY(t: number): number {
  if (t > 0.10 && t < 0.18) return 0.12 * Math.sin(((t - 0.10) / 0.08) * Math.PI);
  if (t > 0.22 && t < 0.25) return -0.12;
  if (t >= 0.25 && t < 0.29) return 1.0 * Math.sin(((t - 0.25) / 0.04) * Math.PI);
  if (t >= 0.29 && t < 0.33) return -0.28;
  if (t > 0.42 && t < 0.54) return 0.2 * Math.sin(((t - 0.42) / 0.12) * Math.PI);
  return 0;
}

/** Scrolling heartbeat trace: beats while the gateway is online, flatlines
 *  (in the error color) when it goes down. */
export function HeartbeatWidget({ status }: { status: StatusResponse | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const online = useRef(false);
  useEffect(() => {
    online.current = status?.gateway_running ?? false;
  }, [status]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let x = 0;
    let clock = 0;
    let prevY: number | null = null;
    let accent = "#d4af37";
    let errColor = "#e25555";

    const fit = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(10, rect.width);
      cv.height = Math.max(10, rect.height);
      const cs = getComputedStyle(cv);
      accent = cs.getPropertyValue("--home-accent").trim() || accent;
      errColor = cs.getPropertyValue("--home-error").trim() || errColor;
      x = 0;
      prevY = null;
      ctx.clearRect(0, 0, cv.width, cv.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const t = setInterval(() => {
      if (document.hidden || cv.width < 20) return;
      clock += TICK_MS / 1000;
      const base = cv.height * 0.62;
      const amp = cv.height * 0.42;
      const y = online.current
        ? base - beatY((clock % BEAT_S) / BEAT_S) * amp
        : base;

      // Erase a column ahead of the pen for the classic scope gap.
      ctx.clearRect(x, 0, 14, cv.height);
      if (prevY !== null) {
        ctx.strokeStyle = online.current ? accent : errColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - SPEED_PX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      prevY = y;
      x += SPEED_PX;
      if (x > cv.width) { x = 0; prevY = null; }
    }, TICK_MS);

    return () => { ro.disconnect(); clearInterval(t); };
  }, []);

  return <canvas ref={ref} className="home-canvas" />;
}
