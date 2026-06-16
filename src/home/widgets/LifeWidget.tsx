import { useEffect, useRef, useState } from "react";
import { HoverCtl } from "./HoverArrows";

const CELL = 7;
const STEP_MS = 160;
const SEED_DENSITY = 0.22;
const RESEED_STEPS = 400;

/** Conway's Game of Life in the theme accent — the matrix rain's quieter
 *  cousin. Reseeds itself when the colony dies out or goes stale.
 *  Draw on it: in rest mode, click/drag paints live cells into the running
 *  colony (pause first to compose a precise pattern). Drawing is disabled in
 *  edit mode so it never fights drag/resize. The board is ephemeral — a reload
 *  reseeds. */
export function LifeWidget({ editing }: { editing: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<Uint8Array>(new Uint8Array(0));
  const dimsRef = useRef({ cols: 0, rows: 0 });
  const stepsRef = useRef(0);
  const pausedRef = useRef(false);
  // True once you've taken manual control (cleared or drawn): suppresses ALL
  // auto-reseed — an empty board stays empty, a dying drawn pattern isn't
  // replaced. The board is yours until you press `seed` to return to ambient.
  const userComposedRef = useRef(false);
  const editingRef = useRef(editing);
  const [paused, setPaused] = useState(false);

  // Keep the loop/handler closure in sync with the latest props/state.
  editingRef.current = editing;
  pausedRef.current = paused;

  const seedGrid = () => {
    const { cols, rows } = dimsRef.current;
    const g = new Uint8Array(cols * rows);
    for (let i = 0; i < g.length; i++) g[i] = Math.random() < SEED_DENSITY ? 1 : 0;
    gridRef.current = g;
    stepsRef.current = 0;
    userComposedRef.current = false; // a random seed is ambient, not composed
  };
  const clearGrid = () => {
    const { cols, rows } = dimsRef.current;
    gridRef.current = new Uint8Array(cols * rows);
    stepsRef.current = 0;
    // Manual mode: the empty board stays empty (no auto-reseed) and keeps
    // whatever play/pause state you had — draw straight onto it to bring it to
    // life, or pause first to compose. `seed` returns to ambient.
    userComposedRef.current = true;
  };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let accent = "#d4af37";
    const fit = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(10, rect.width);
      cv.height = Math.max(10, rect.height);
      accent = getComputedStyle(cv).getPropertyValue("--home-accent").trim() || accent;
      dimsRef.current = {
        cols: Math.max(4, Math.floor(cv.width / CELL)),
        rows: Math.max(4, Math.floor(cv.height / CELL)),
      };
      seedGrid();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const render = () => {
      const { cols, rows } = dimsRef.current;
      const g = gridRef.current;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.75;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (g[y * cols + x]) ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
      ctx.globalAlpha = 1;
    };

    const t = setInterval(() => {
      if (document.hidden) return;
      const g = gridRef.current;
      if (g.length === 0) return;
      const { cols, rows } = dimsRef.current;
      if (!pausedRef.current) {
        const next = new Uint8Array(g.length);
        let alive = 0;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const yy = (y + dy + rows) % rows;
                const xx = (x + dx + cols) % cols;
                n += g[yy * cols + xx];
              }
            }
            const i = y * cols + x;
            next[i] = g[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
            alive += next[i];
          }
        }
        gridRef.current = next;
        stepsRef.current++;
        // Auto-reseed only in ambient mode. In manual mode (you cleared or
        // drew) the board is yours: an empty board stays empty and a dying
        // pattern isn't replaced — press `seed` to return to ambient.
        if (!userComposedRef.current &&
            (alive === 0 || alive < next.length * 0.02 ||
             stepsRef.current > RESEED_STEPS)) seedGrid();
      }
      render();
    }, STEP_MS);

    // Pointer drawing (rest mode only).
    let drawing = false;
    const paint = (e: PointerEvent) => {
      const { cols, rows } = dimsRef.current;
      const rect = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / CELL);
      const y = Math.floor((e.clientY - rect.top) / CELL);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      gridRef.current[y * cols + x] = 1;
      userComposedRef.current = true; // hand-drawn — protect it from the sparse reseed
      render();
    };
    const onDown = (e: PointerEvent) => {
      if (editingRef.current) return;
      drawing = true;
      try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      paint(e);
    };
    const onMove = (e: PointerEvent) => { if (drawing) paint(e); };
    const onUp = (e: PointerEvent) => {
      drawing = false;
      try { cv.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);

    return () => {
      ro.disconnect();
      clearInterval(t);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <>
      <HoverCtl>
        <button className="hv-opt" onClick={() => setPaused((p) => !p)}>
          {paused ? "play" : "pause"}
        </button>
        <button className="hv-opt" onClick={seedGrid}>seed</button>
        <button className="hv-opt" onClick={clearGrid}>clear</button>
      </HoverCtl>
      <canvas ref={ref} className="home-canvas home-life" />
    </>
  );
}
