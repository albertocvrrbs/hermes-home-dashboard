import { useEffect, useRef } from "react";

const CELL = 7;
const STEP_MS = 160;
const SEED_DENSITY = 0.22;
const RESEED_STEPS = 400;

/** Conway's Game of Life in the theme accent — the matrix rain's quieter
 *  cousin. Reseeds itself when the colony dies out or goes stale. */
export function LifeWidget() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cols = 0, rows = 0;
    let grid: Uint8Array = new Uint8Array(0);
    let steps = 0;
    let accent = "#d4af37";

    const seed = () => {
      grid = new Uint8Array(cols * rows);
      for (let i = 0; i < grid.length; i++) {
        grid[i] = Math.random() < SEED_DENSITY ? 1 : 0;
      }
      steps = 0;
    };
    const fit = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(10, rect.width);
      cv.height = Math.max(10, rect.height);
      accent = getComputedStyle(cv).getPropertyValue("--home-accent").trim() || accent;
      cols = Math.max(4, Math.floor(cv.width / CELL));
      rows = Math.max(4, Math.floor(cv.height / CELL));
      seed();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const t = setInterval(() => {
      if (document.hidden || grid.length === 0) return;
      const next = new Uint8Array(grid.length);
      let alive = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const yy = (y + dy + rows) % rows;
              const xx = (x + dx + cols) % cols;
              n += grid[yy * cols + xx];
            }
          }
          const i = y * cols + x;
          next[i] = grid[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
          alive += next[i];
        }
      }
      grid = next;
      steps++;
      if (alive < grid.length * 0.02 || steps > RESEED_STEPS) seed();

      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.75;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (grid[y * cols + x]) {
            ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
          }
        }
      }
      ctx.globalAlpha = 1;
    }, STEP_MS);

    return () => { ro.disconnect(); clearInterval(t); };
  }, []);

  return <canvas ref={ref} className="home-canvas" />;
}
