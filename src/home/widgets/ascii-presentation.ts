// Pure math for the Hermes emblem widget: square dot grids, dithering, braille decoding and the
// persisted design choice. Kept free of DOM/React so node --test can load it.

/** Design ids in cycle order. The official banner caduceus stays first (the default). */
export const EMBLEM_IDS = [
  "caduceus", "winged-caduceus", "talaria", "petasos", "lyre", "tortoise", "drachma", "wing",
] as const;
export type EmblemId = (typeof EMBLEM_IDS)[number];

/** What the 1.x `artIndex` pointed at: 0 caduceus, 1 pyramid, 2 diamond. The geometric
 *  placeholders map to the closest mythology pieces (a pointed hat, a round emblem). */
const LEGACY_INDEX: EmblemId[] = ["caduceus", "petasos", "drachma"];

/** The design a widget shows: `art` (id, 1.9.2+) wins, then the legacy `artIndex`. */
export function emblemFromProps(props: Record<string, unknown>): EmblemId {
  const art = props.art;
  if (typeof art === "string" && (EMBLEM_IDS as readonly string[]).includes(art)) return art as EmblemId;
  const idx = props.artIndex;
  if (typeof idx === "number" && Number.isFinite(idx)) {
    const n = LEGACY_INDEX.length;
    return LEGACY_INDEX[((Math.trunc(idx) % n) + n) % n];
  }
  return "caduceus";
}

/** Props after stepping the design by `dir`: writes `art`, drops the legacy index. */
export function stepEmblem(props: Record<string, unknown>, dir: 1 | -1): Record<string, unknown> {
  const n = EMBLEM_IDS.length;
  const i = EMBLEM_IDS.indexOf(emblemFromProps(props));
  const next: Record<string, unknown> = { ...props, art: EMBLEM_IDS[(i + dir + n) % n] };
  delete next.artIndex;
  return next;
}

// ── square dot grid ──────────────────────────────────────────────────────

export interface Grid {
  /** Dot pitch in device pixels (identical on both axes: dots sit on a square grid). */
  pitch: number;
  cols: number;
  rows: number;
  /** Top-left of the first dot cell, device px (centres the grid in the slot). */
  ox: number;
  oy: number;
}

export interface GridOptions {
  /** Fixed resolution (bitmap art): the pitch grows with the slot. */
  cols?: number;
  rows?: number;
  /** Vector art: aim for this many dots across the slot's short side… */
  target?: number;
  /** …with the pitch clamped to [minCss, maxCss] CSS px, so big widgets gain detail. */
  minCss?: number;
  maxCss?: number;
}

/** Lays a square dot grid over a `w`×`h` CSS px slot at device pixel ratio `dpr`. The pitch is
 *  a whole number of device pixels so every dot lands on the same sub-pixel phase (no beating). */
export function fitGrid(w: number, h: number, dpr: number, o: GridOptions = {}): Grid {
  const W = Math.max(0, Math.floor(w * dpr)), H = Math.max(0, Math.floor(h * dpr));
  const fixed = !!(o.cols && o.rows);
  let pitch: number;
  if (fixed) {
    pitch = Math.floor(Math.min(W / o.cols!, H / o.rows!));
  } else {
    const target = o.target ?? 72;
    const lo = Math.max(2, Math.round((o.minCss ?? 2.8) * dpr));
    const hi = Math.max(lo, Math.round((o.maxCss ?? 4.2) * dpr));
    pitch = Math.min(hi, Math.max(lo, Math.round(Math.min(W, H) / target)));
  }
  pitch = Math.max(2, pitch);
  const cols = fixed ? o.cols! : Math.floor(W / pitch);
  const rows = fixed ? o.rows! : Math.floor(H / pitch);
  return { pitch, cols, rows, ox: Math.floor((W - cols * pitch) / 2), oy: Math.floor((H - rows * pitch) / 2) };
}

/** Fits a `bw`×`bh` design box into a `cols`×`rows` dot grid with `margin` dots around it,
 *  uniform scale (so the art keeps its proportions). Returns dots per design unit + offset. */
export function fitBox(bw: number, bh: number, cols: number, rows: number, margin = 1): { s: number; x: number; y: number } {
  const aw = Math.max(1, cols - 2 * margin), ah = Math.max(1, rows - 2 * margin);
  const s = Math.min(aw / bw, ah / bh);
  return { s, x: (cols - bw * s) / 2, y: (rows - bh * s) / 2 };
}

// ── dithering (1 = ink) ──────────────────────────────────────────────────

/** Floyd–Steinberg error diffusion, serpentine scan. `lum` is ink coverage 0..1 per dot. */
export function floydSteinberg(lum: ArrayLike<number>, cols: number, rows: number, threshold = 0.5): Uint8Array {
  const buf = Float32Array.from(lum as ArrayLike<number>);
  const out = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    const ltr = y % 2 === 0;
    const dx = ltr ? 1 : -1;
    for (let k = 0; k < cols; k++) {
      const x = ltr ? k : cols - 1 - k;
      const i = y * cols + x;
      const v = buf[i];
      const on = v >= threshold ? 1 : 0;
      out[i] = on;
      const err = v - on;
      const fwd = x + dx >= 0 && x + dx < cols;
      const back = x - dx >= 0 && x - dx < cols;
      if (fwd) buf[i + dx] += (err * 7) / 16;
      if (y + 1 < rows) {
        if (back) buf[i + cols - dx] += (err * 3) / 16;
        buf[i + cols] += (err * 5) / 16;
        if (fwd) buf[i + cols + dx] += err / 16;
      }
    }
  }
  return out;
}

/** The classic recursive Bayer index matrix of size 2^n (n = 2 → 4×4). */
export function bayerMatrix(n = 2): number[][] {
  let m = [[0]];
  for (let k = 0; k < n; k++) {
    const s = m.length;
    const next: number[][] = Array.from({ length: s * 2 }, () => new Array<number>(s * 2).fill(0));
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = 4 * m[y][x];
        next[y][x] = v;
        next[y][x + s] = v + 2;
        next[y + s][x] = v + 3;
        next[y + s][x + s] = v + 1;
      }
    }
    m = next;
  }
  return m;
}

const BAYER4 = bayerMatrix(2);

/** Ordered (Bayer 4×4) dithering: regular, print-like texture that never crawls. */
export function bayerDither(lum: ArrayLike<number>, cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = (BAYER4[y & 3][x & 3] + 0.5) / 16;
      out[y * cols + x] = lum[y * cols + x] > t ? 1 : 0;
    }
  }
  return out;
}

// ── braille ──────────────────────────────────────────────────────────────

// Unicode braille: bit k of (code - 0x2800) is dot k+1. Dots 1-3 and 7 are the left column
// (rows 0-3), dots 4-6 and 8 the right one.
const BRAILLE_DOTS: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];

export interface Bitmap { cols: number; rows: number; bits: Uint8Array }

/** Decodes braille art (one text line per 4 dot rows) into a dot bitmap: 2 dots per character
 *  across, 4 down. In a terminal those dots are square-spaced, so this is the art's true shape. */
export function brailleToBits(art: string): Bitmap {
  const lines = art.split("\n");
  const width = Math.max(0, ...lines.map((l) => [...l].length));
  const cols = width * 2, rows = lines.length * 4;
  const bits = new Uint8Array(cols * rows);
  lines.forEach((line, ly) => {
    [...line].forEach((ch, lx) => {
      const code = ch.codePointAt(0)! - 0x2800;
      if (code <= 0 || code > 0xff) return;
      BRAILLE_DOTS.forEach(([dx, dy], k) => {
        if (code & (1 << k)) bits[(ly * 4 + dy) * cols + lx * 2 + dx] = 1;
      });
    });
  });
  return { cols, rows, bits };
}

/** Crops a bitmap to its inked bounding box. */
export function trimBits(b: Bitmap): Bitmap {
  let x0 = b.cols, y0 = b.rows, x1 = -1, y1 = -1;
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      if (!b.bits[y * b.cols + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { cols: 0, rows: 0, bits: new Uint8Array(0) };
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  const bits = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) bits.set(b.bits.subarray((y + y0) * b.cols + x0, (y + y0) * b.cols + x0 + cols), y * cols);
  return { cols, rows, bits };
}

/** Box-averages an RGBA buffer `s`× down to ink coverage per dot (luma × alpha, 0..1). */
export function coverage(rgba: ArrayLike<number>, cols: number, rows: number, s: number): Float32Array {
  const out = new Float32Array(cols * rows);
  const W = cols * s;
  const n = s * s * 255 * 255;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let acc = 0;
      for (let yy = 0; yy < s; yy++) {
        let p = ((y * s + yy) * W + x * s) * 4;
        for (let xx = 0; xx < s; xx++, p += 4) {
          const luma = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
          acc += luma * rgba[p + 3];
        }
      }
      out[y * cols + x] = acc / n;
    }
  }
  return out;
}

/** A stable pseudo-random value in [0, 1) per dot index (the dissolve order). */
export function dotRank(i: number): number {
  let h = (i + 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
