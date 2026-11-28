// Maths for the page transitions (zoom into a nested board, out of it, in from the Home widget).
// A transition shows a snapshot of the page being left over the page being entered. Both show
// the same board content at a given moment, so the snapshot is moved by the one similarity
// (scale + shift) that maps where the content was drawn to where the arriving camera draws it.
import type { View } from "./geometry";

export interface Affine { k: number; tx: number; ty: number }

/** The scale + shift that takes a point drawn under view `from` to where view `to` draws it. */
export function matchTransform(from: View, to: View): Affine {
  const k = to.z / from.z;
  return { k, tx: to.x - k * from.x, ty: to.y - k * from.y };
}

export const affineCss = (a: Affine): string => `translate(${a.tx.toFixed(2)}px, ${a.ty.toFixed(2)}px) scale(${a.k.toFixed(5)})`;

/** A view expressed relative to an element's top-left, moved into page coordinates. */
export const toPage = (v: View, origin: { left: number; top: number }): View => ({ z: v.z, x: v.x + origin.left, y: v.y + origin.top });
export const fromPage = (v: View, origin: { left: number; top: number }): View => ({ z: v.z, x: v.x - origin.left, y: v.y - origin.top });

const smooth = (a: number, b: number, u: number): number => {
  const t = Math.min(1, Math.max(0, (u - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Opacity of the page we leave / the page we arrive at, by eased progress: the old one holds,
 *  then dissolves while the new one comes up, so the middle of the move shows both. */
export const leavingOpacity = (u: number): number => 1 - smooth(0.34, 0.94, u);
export const arrivingOpacity = (u: number): number => smooth(0.1, 0.62, u);

/** Timing of the moves, ms. */
export const ZOOM_IN_MS = 560;
export const ZOOM_OUT_MS = 480;
/** cubic-bezier control points: slow start, quick middle, soft landing. */
export const ZOOM_EASE: [number, number, number, number] = [0.62, 0, 0.18, 1];
