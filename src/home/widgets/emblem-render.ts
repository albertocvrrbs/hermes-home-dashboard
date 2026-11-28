// Rasterises an emblem onto a square dot grid and paints the dots on a canvas. The design is
// drawn supersampled into an offscreen canvas, box-averaged to one coverage value per dot and
// dithered; the dots are then painted at a whole-device-pixel pitch, so they sit on a true
// square grid at any widget size and pixel ratio (braille text never could: a mono font's cell
// is not 1:2, which stretched the old art).
import {
  bayerDither, brailleToBits, coverage, dotRank, fitBox, fitGrid, floydSteinberg, trimBits,
  type Bitmap, type Grid,
} from "./ascii-presentation";
import type { Emblem } from "./emblems";

export interface Raster extends Grid {
  bits: Uint8Array;
  /** First and last inked row (the vertical gradient spans the art, not the slot). */
  top: number;
  bottom: number;
}

const SUPER = 4;
const bitmapCache = new Map<string, Bitmap>();

function inkRows(bits: Uint8Array, cols: number, rows: number): [number, number] {
  let top = rows, bottom = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (bits[y * cols + x]) { if (y < top) top = y; bottom = y; break; }
    }
  }
  return bottom < 0 ? [0, rows - 1] : [top, bottom];
}

/** Dots for `e` in a `w`×`h` CSS px slot at `dpr`. */
export function rasterize(e: Emblem, w: number, h: number, dpr: number): Raster | null {
  if (w < 8 || h < 8) return null;
  if (e.kind === "braille") {
    let bm = bitmapCache.get(e.art);
    if (!bm) { bm = trimBits(brailleToBits(e.art)); bitmapCache.set(e.art, bm); }
    // one blank dot of margin on every side
    const cols = bm.cols + 2, rows = bm.rows + 2;
    const grid = fitGrid(w, h, dpr, { cols, rows });
    const bits = new Uint8Array(cols * rows);
    for (let y = 0; y < bm.rows; y++) bits.set(bm.bits.subarray(y * bm.cols, (y + 1) * bm.cols), (y + 1) * cols + 1);
    const [top, bottom] = inkRows(bits, cols, rows);
    return { ...grid, bits, top, bottom };
  }
  const grid = fitGrid(w, h, dpr, { target: 72, minCss: 2.8, maxCss: 4.2 });
  const { cols, rows } = grid;
  if (cols < 4 || rows < 4) return null;
  const off = document.createElement("canvas");
  off.width = cols * SUPER;
  off.height = rows * SUPER;
  const g = off.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.fillStyle = "#000";
  g.fillRect(0, 0, off.width, off.height);
  const box = fitBox(e.w, e.h, cols, rows, 1);
  g.setTransform(box.s * SUPER, 0, 0, box.s * SUPER, box.x * SUPER, box.y * SUPER);
  e.draw(g);
  const lum = coverage(g.getImageData(0, 0, off.width, off.height).data, cols, rows, SUPER);
  const bits = e.dither === "bayer" ? bayerDither(lum, cols, rows) : floydSteinberg(lum, cols, rows);
  const [top, bottom] = inkRows(bits, cols, rows);
  return { ...grid, bits, top, bottom };
}

export interface Colors { accent: string; dim: string; glint: string }

export interface PaintState {
  /** 0..1: share of dots revealed (dissolve in), by each dot's stable rank. */
  reveal: number;
  /** Diagonal glint position in 0..1 (null = none). */
  glint: number | null;
}

/** Paints the raster. The canvas backing store must already be device-pixel sized. */
export function paint(canvas: HTMLCanvasElement, r: Raster, c: Colors, s: PaintState): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const { pitch, cols, rows, ox, oy, bits } = r;
  const y0 = oy + r.top * pitch, y1 = oy + (r.bottom + 1) * pitch;
  const grad = g.createLinearGradient(0, y0, 0, Math.max(y0 + 1, y1));
  grad.addColorStop(0, c.dim);
  grad.addColorStop(0.4, c.accent);
  grad.addColorStop(0.6, c.accent);
  grad.addColorStop(1, c.dim);
  // Small pitches get crisp device-pixel squares; larger ones real round dots.
  const round = pitch >= 5;
  const size = round ? pitch * 0.34 : Math.max(1, Math.round(pitch * 0.67));
  const inset = Math.floor((pitch - size) / 2);
  const band = 0.09;
  const span = cols + rows * 0.7;
  const base = new Path2D(), hot = new Path2D();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!bits[i]) continue;
      if (s.reveal < 1 && dotRank(i) >= s.reveal) continue;
      const lit = s.glint !== null && Math.abs((x + y * 0.7) / span - s.glint) < band;
      const p = lit ? hot : base;
      if (round) {
        const cx = ox + (x + 0.5) * pitch, cy = oy + (y + 0.5) * pitch;
        p.moveTo(cx + size, cy);
        p.arc(cx, cy, size, 0, Math.PI * 2);
      } else {
        p.rect(ox + x * pitch + inset, oy + y * pitch + inset, size, size);
      }
    }
  }
  g.fillStyle = grad;
  g.fill(base);
  if (s.glint !== null) {
    g.fillStyle = c.glint;
    g.fill(hot);
  }
}

function parseRgb(color: string): [number, number, number] | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** The theme accent as the canvas sees it (the element's resolved `color`), plus the dim end of
 *  the gradient (55 % accent over black, like --home-accent-dim) and a whiter glint. */
export function readColors(el: HTMLElement): Colors {
  const accent = getComputedStyle(el).color || "rgb(255, 215, 0)";
  const rgb = parseRgb(accent) ?? [255, 215, 0];
  const mix = (k: number, to: number) => rgb.map((v) => Math.round(v * k + to * (1 - k))).join(",");
  return { accent, dim: `rgb(${mix(0.55, 0)})`, glint: `rgb(${mix(0.45, 255)})` };
}
