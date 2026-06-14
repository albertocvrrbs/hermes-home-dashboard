import { useEffect, useRef } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01☿";
const COL_W = 13;
const ROW_H = 14;
const TICK_MS = 66;

/** Matrix rain in the theme accent. Pauses while the tab is hidden. */
export function MatrixWidget() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let drops: number[] = [];
    let accent = "#d4af37";

    const fit = () => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(10, r.width);
      cv.height = Math.max(10, r.height);
      accent =
        getComputedStyle(cv).getPropertyValue("--home-accent").trim() || accent;
      drops = Array.from(
        { length: Math.floor(cv.width / COL_W) },
        () => Math.floor(Math.random() * -30),
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const t = setInterval(() => {
      if (document.hidden) return;
      // Fade existing glyphs toward TRANSPARENT (not black) so the widget's
      // glass background shows through the rain.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.font = "12px monospace";
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() < 0.12 ? "#ffffff" : accent;
        ctx.fillText(
          GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          i * COL_W,
          y * ROW_H,
        );
        drops[i] = y * ROW_H > cv.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    }, TICK_MS);

    return () => { ro.disconnect(); clearInterval(t); };
  }, []);

  return <canvas ref={ref} className="home-matrix-c" />;
}
