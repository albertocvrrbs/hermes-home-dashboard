// Dot-matrix previews (Home widget, boards index, nested board cards): the board's items as
// blocks of dots, Hermes' items brighter, in the LIFE widget idiom.
import { approxRect, type BoardDoc } from "./model";
import { boundsOf, type Rect } from "./geometry";

export interface PreviewOptions {
  accent: string;
  cell?: number;
  hermesAt?: { x: number; y: number } | null;
}

export function previewRects(doc: BoardDoc): { r: Rect; h: boolean; frame: boolean }[] {
  const out: { r: Rect; h: boolean; frame: boolean }[] = [];
  for (const it of Object.values(doc.items)) {
    const r = approxRect(it);
    if (r) out.push({ r, h: it.by === "h", frame: it.k === "frame" || it.k === "text" });
  }
  return out;
}

/** Where the board's content lands in a W x H preview: scale and offset (CSS px). Shared by the
 *  dot drawing and by overlays (the minimap's view frame) so they always agree. */
export function previewGeometry(doc: BoardDoc | null, W: number, H: number, pad = 30): { s: number; ox: number; oy: number; b: Rect } {
  const rects = doc ? previewRects(doc) : [];
  const b = boundsOf(rects.map((x) => x.r)) ?? { x: 0, y: 0, w: 1, h: 1 };
  const s = Math.min(W / (b.w + pad * 2), H / (b.h + pad * 2));
  return { s, ox: (W - b.w * s) / 2 - b.x * s, oy: (H - b.h * s) / 2 - b.y * s, b };
}

/** Draw onto a canvas sized in CSS px (handles devicePixelRatio). */
export function drawPreview(canvas: HTMLCanvasElement, doc: BoardDoc | null, opts: PreviewOptions): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cell = opts.cell ?? 6;
  const rects = doc ? previewRects(doc) : [];
  const { s, ox, oy } = previewGeometry(doc, W, H);
  ctx.fillStyle = opts.accent;
  for (let y = cell / 2; y < H; y += cell) {
    for (let x = cell / 2; x < W; x += cell) {
      const wx = (x - ox) / s, wy = (y - oy) / s;
      let hit: { h: boolean; frame: boolean } | null = null;
      for (const it of rects) {
        if (wx >= it.r.x && wx <= it.r.x + it.r.w && wy >= it.r.y && wy <= it.r.y + it.r.h) {
          if (!it.frame || !hit) hit = it;
        }
      }
      let a = 0.07, sz = 1.2;
      if (hit) { a = hit.frame ? 0.16 : hit.h ? 0.85 : 0.5; sz = hit.frame ? 1.2 : cell * 0.62; }
      ctx.globalAlpha = a;
      ctx.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
    }
  }
  if (opts.hermesAt) {
    const hx = ox + opts.hermesAt.x * s, hy = oy + opts.hermesAt.y * s;
    ctx.globalAlpha = 1;
    ctx.fillRect(Math.round(hx - cell * 0.8), Math.round(hy - cell * 0.8), cell * 1.6, cell * 1.6);
    ctx.clearRect(Math.round(hx - cell * 0.3), Math.round(hy - cell * 0.3), cell * 0.6, cell * 0.6);
  }
  ctx.globalAlpha = 1;
}

/** The accent colour as a canvas fillStyle, read from the element's computed style. */
export function accentOf(el: Element | null, fallback = "#ffe3c4"): string {
  if (!el) return fallback;
  const v = getComputedStyle(el).getPropertyValue("--accent").trim()
    || getComputedStyle(el).getPropertyValue("--home-accent").trim();
  if (!v) return fallback;
  // Resolve var()/color-mix through a throwaway element so canvas gets a concrete colour.
  const probe = document.createElement("span");
  probe.style.color = v;
  probe.style.display = "none";
  el.appendChild(probe);
  const c = getComputedStyle(probe).color || fallback;
  probe.remove();
  return c;
}
