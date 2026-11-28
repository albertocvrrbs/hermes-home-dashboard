import { useEffect, useRef, useState } from "react";
import type { StatusResponse } from "@/api-types";
import { emblemFromProps, stepEmblem, type EmblemId } from "./ascii-presentation";
import { EMBLEMS, OFFICIAL_CADUCEUS } from "./emblems";
import { paint, rasterize, readColors, type Raster } from "./emblem-render";
import { HoverArrows } from "./HoverArrows";
import { useT, type MessageKey } from "../i18n";

const REVEAL_MS = 520;
const GLINT_MS = 1700;
const GLINT_EVERY_MS = 15000;

interface Props {
  status: StatusResponse | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Hermes emblem: the official caduceus and a Hermes mythology set, dithered onto a square
 *  dot grid at the widget's resolution. Hover arrows cycle the design; the choice persists in
 *  the widget's layout props (`art`). Motion (a dissolve on change, a rare glint) only runs
 *  while the widget is visible and the user allows motion; idle, nothing ticks. */
export function AsciiWidget({ status, widgetProps, onWidgetPropsChange }: Props) {
  const t = useT();
  const version = status?.version;
  const id = emblemFromProps(widgetProps);
  const slotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [noCanvas, setNoCanvas] = useState(false);
  const label = t(`ascii.art.${id}` as MessageKey);

  useEffect(() => {
    const slot = slotRef.current, canvas = canvasRef.current;
    if (!slot || !canvas) return;
    if (!canvas.getContext("2d")) { setNoCanvas(true); return; }
    return mountEmblem(slot, canvas, id);
  }, [id]);

  return (
    <div className="home-ascii-wrap">
      <HoverArrows
        onPrev={() => onWidgetPropsChange(stepEmblem(widgetProps, -1))}
        onNext={() => onWidgetPropsChange(stepEmblem(widgetProps, 1))}
        label={label}
      />
      <div className="home-emblem" ref={slotRef}>
        {noCanvas
          ? <div className="home-ascii">{OFFICIAL_CADUCEUS}</div>
          : <canvas ref={canvasRef} role="img" aria-label={label} />}
      </div>
      <div className="home-ascii-ver">
        HERMES-AGENT{version ? ` · v${version}` : ""}
      </div>
    </div>
  );
}

/** Wires one design to its canvas: sizing, painting and motion. Returns the cleanup. */
function mountEmblem(slot: HTMLElement, canvas: HTMLCanvasElement, id: EmblemId): () => void {
  const emblem = EMBLEMS[id];
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const motion = () => !motionQuery?.matches;
  let raster: Raster | null = null;
  let colors = readColors(canvas);
  let reveal = motion() ? 0 : 1;
  let glint: number | null = null;
  let visible = true;
  let raf = 0, layoutRaf = 0, timer = 0;
  let sized = "";

  const draw = () => { if (raster) paint(canvas, raster, colors, { reveal, glint }); };

  const layout = () => {
    layoutRaf = 0;
    const r = slot.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const key = `${Math.round(r.width)}x${Math.round(r.height)}@${dpr}`;
    if (key === sized) return;
    sized = key;
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    raster = rasterize(emblem, r.width, r.height, dpr);
    draw();
  };

  /** Runs `step(progress)` on animation frames for `ms`, then `done`. */
  const animate = (ms: number, step: (p: number) => void, done: () => void) => {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      step(p);
      draw();
      if (p < 1) raf = requestAnimationFrame(tick);
      else { raf = 0; done(); }
    };
    raf = requestAnimationFrame(tick);
  };

  const scheduleGlint = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!motion() || !visible || document.hidden || !raster) { scheduleGlint(); return; }
      animate(GLINT_MS, (p) => { glint = -0.15 + 1.3 * p; }, () => { glint = null; draw(); scheduleGlint(); });
    }, GLINT_EVERY_MS);
  };

  layout();
  if (reveal < 1) {
    animate(REVEAL_MS, (p) => { reveal = 1 - (1 - p) ** 3; }, () => { reveal = 1; scheduleGlint(); });
  } else {
    scheduleGlint();
  }

  const ro = new ResizeObserver(() => { if (!layoutRaf) layoutRaf = requestAnimationFrame(layout); });
  ro.observe(slot);
  const io = new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); });
  io.observe(slot);
  // Theme switches restyle the accent without resizing anything: repaint in the new colour.
  const mo = new MutationObserver(() => {
    const next = readColors(canvas);
    if (next.accent !== colors.accent) { colors = next; draw(); }
  });
  for (const el of [document.documentElement, document.body]) {
    mo.observe(el, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  }
  const onMotion = () => { if (!motion()) { cancelAnimationFrame(raf); raf = 0; reveal = 1; glint = null; draw(); } };
  motionQuery?.addEventListener?.("change", onMotion);

  return () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(layoutRaf);
    clearTimeout(timer);
    ro.disconnect();
    io.disconnect();
    mo.disconnect();
    motionQuery?.removeEventListener?.("change", onMotion);
  };
}
