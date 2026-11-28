// Level of detail for a zoomed-out board. Pure: the zoom in, CSS variables out.
//
// Zoomed out, text shrinks with the board until it is unreadable. Instead titles keep a
// legible on-screen size (counter-scaled, with a cap), small text fades to skeleton lines
// and pictures drop to a thumbnail, so a crowded board reads as an ordered map.

/** 0 = full detail, 1 = map (skeleton text, counter-scaled titles), 2 = overview (titles only). */
export type Lod = 0 | 1 | 2;

/** Zoom below which the board switches to the map view, and to the overview. */
export const LOD1_Z = 0.5;
export const LOD2_Z = 0.24;
/** Hysteresis, so hovering around a threshold doesn't flicker. */
const GAP = 0.04;

export function lodFor(z: number, prev: Lod = 0): Lod {
  const down1 = prev >= 1 ? LOD1_Z + GAP : LOD1_Z;
  const down2 = prev >= 2 ? LOD2_Z + GAP * 0.5 : LOD2_Z;
  if (z < down2) return 2;
  if (z < down1) return 1;
  return 0;
}

/** Families of text that keep a legible size: base = CSS px at 100 %, floor = on-screen px
 *  they settle on when zoomed far out. */
export const LABELS = {
  /** frame labels, column and to-do headers */
  f: { base: 10, floor: 11.5, cap: 4.5 },
  /** section headings (text items, size h): capped lower, they are wide and sit side by side */
  h: { base: 15, floor: 16, cap: 3.2 },
  /** card and link titles */
  c: { base: 14, floor: 11, cap: 3 },
  /** diagram box titles */
  b: { base: 14, floor: 11.5, cap: 3.2 },
  /** connector and frame-corner strokes */
  w: { base: 1.3, floor: 1.7, cap: 4.5 },
} as const;
export type LabelFamily = keyof typeof LABELS;

/** Above this zoom nothing is counter-scaled; the move to the floor is eased up to Z_END. */
const Z_START = 0.62;
const Z_END = 0.3;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Scale factor (>= 1) for a label with CSS size `base` at zoom `z`: its on-screen size goes
 *  from base*z (at Z_START, so there is no pop) to `floor` px (at Z_END and below), never
 *  more than `cap` times its own size. */
export function labelScale(z: number, base: number, floor: number, cap = 4.5): number {
  if (z >= Z_START) return 1;
  const t = Math.min(1, (Z_START - z) / (Z_START - Z_END));
  const eff = base * Z_START + (floor - base * Z_START) * smooth(t);
  return Math.max(1, Math.min(cap, eff / (base * z)));
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** The CSS custom properties a board world carries at zoom z. */
export function lodVars(z: number): Record<string, string> {
  const out: Record<string, string> = { "--iz": String(r3(1 / z)) };
  for (const k of Object.keys(LABELS) as LabelFamily[]) out[`--ls-${k}`] = String(r3(labelScale(z, LABELS[k].base, LABELS[k].floor, LABELS[k].cap)));
  return out;
}

/** Writes lodVars and the data-lod level on `el`; returns the level. Only touches the DOM
 *  when something changed (a custom property write restyles every descendant). */
export function applyLod(el: HTMLElement, z: number): Lod {
  const prev = (Number(el.dataset.lod) || 0) as Lod;
  const lod = lodFor(z, prev);
  const key = String(r3(z));
  if ((el as HTMLElement & { __lodZ?: string }).__lodZ === key) return lod;
  (el as HTMLElement & { __lodZ?: string }).__lodZ = key;
  for (const [k, v] of Object.entries(lodVars(z))) el.style.setProperty(k, v);
  if (el.dataset.lod !== String(lod)) el.dataset.lod = String(lod);
  return lod;
}
