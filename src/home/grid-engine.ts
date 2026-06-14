/** Pure grid math for the Home page hybrid layout.
 *  No DOM here — everything is unit-testable. */

export interface GridBox {
  gx: number; gy: number; gw: number; gh: number;
}
export interface GridItem extends GridBox {
  id: string;
}

export const GRID_COLS = 12;

export function collide(a: GridBox, b: GridBox): boolean {
  return (
    a.gx < b.gx + b.gw && a.gx + a.gw > b.gx &&
    a.gy < b.gy + b.gh && a.gy + a.gh > b.gy
  );
}

/** Cascade-push every item that collides with `box` (or with an already
 *  pushed item) downward. Returns map id → new gy for items that moved.
 *  `box` is the candidate footprint of the dragged/resized widget. */
export function reflow(box: GridBox, others: GridItem[]): Map<string, number> {
  const moved = new Map<string, number>();
  const rest = others
    .map((i) => ({ ...i }))
    .sort((a, b) => a.gy - b.gy);
  const placed: GridBox[] = [box];
  for (const r of rest) {
    let guard = 0;
    while (placed.some((p) => collide(r, p)) && guard++ < 100) {
      const blocker = placed.find((p) => collide(r, p))!;
      r.gy = blocker.gy + blocker.gh;
    }
    placed.push(r);
    const original = others.find((o) => o.id === r.id)!;
    if (r.gy !== original.gy) moved.set(r.id, r.gy);
  }
  return moved;
}

/** Swap detection against LOGICAL grid coords of committed positions —
 *  never against DOM rects (the swap preview moves elements and causes
 *  detect/cancel flicker). (pgx, pgy) = pointer in fractional grid units. */
export function findSwapTarget(
  pgx: number, pgy: number, dragged: GridItem, others: GridItem[],
): GridItem | null {
  for (const t of others) {
    if (t.id === dragged.id || t.gw !== dragged.gw || t.gh !== dragged.gh) continue;
    if (pgx >= t.gx && pgx < t.gx + t.gw && pgy >= t.gy && pgy < t.gy + t.gh) {
      return t;
    }
  }
  return null;
}

/** First position (scanning top-to-bottom, left-to-right) where `size`
 *  fits without colliding with any existing item. */
export function findFreeSlot(
  layout: GridItem[],
  size: { gw: number; gh: number },
  cols: number = GRID_COLS,
): { gx: number; gy: number } {
  const maxRow = layout.reduce((m, w) => Math.max(m, w.gy + w.gh), 0);
  for (let gy = 0; gy <= maxRow; gy++) {
    for (let gx = 0; gx <= cols - size.gw; gx++) {
      const box: GridBox = { gx, gy, gw: size.gw, gh: size.gh };
      if (!layout.some((w) => collide(box, w))) return { gx, gy };
    }
  }
  return { gx: 0, gy: maxRow };
}

export function clampPosition(
  gx: number, gy: number, gw: number, _gh: number, cols: number = GRID_COLS,
): { gx: number; gy: number } {
  return {
    gx: Math.max(0, Math.min(cols - gw, Math.round(gx))),
    gy: Math.max(0, Math.round(gy)),
  };
}
