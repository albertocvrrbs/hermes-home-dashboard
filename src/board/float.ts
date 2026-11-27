// Placement math for everything that floats over the board: tooltips, the selection bar and
// the right-click menu. Pure functions (no DOM), so node --test covers the flip/clamp rules.

export interface Box { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

/** Keep a floating box inside `bounds` with `pad` px of air on every side. */
export function clampBox(x: number, y: number, size: Size, bounds: Box, pad = 8): { x: number; y: number } {
  const maxX = bounds.x + bounds.w - size.w - pad;
  const maxY = bounds.y + bounds.h - size.h - pad;
  return {
    x: Math.round(Math.max(bounds.x + pad, Math.min(x, maxX))),
    y: Math.round(Math.max(bounds.y + pad, Math.min(y, maxY))),
  };
}

/** A tooltip above its trigger, flipped below when there is no room; centred and clamped. */
export function placeTip(trigger: Box, tip: Size, bounds: Box, gap = 6): { x: number; y: number; side: "top" | "bottom" } {
  const cx = trigger.x + trigger.w / 2 - tip.w / 2;
  const above = trigger.y - gap - tip.h;
  const below = trigger.y + trigger.h + gap;
  const preferBelow = trigger.y + trigger.h / 2 < bounds.y + Math.min(120, bounds.h / 3);
  let side: "top" | "bottom" = preferBelow ? "bottom" : "top";
  if (side === "top" && above < bounds.y + 4) side = "bottom";
  else if (side === "bottom" && below + tip.h > bounds.y + bounds.h - 4) side = "top";
  const p = clampBox(cx, side === "top" ? above : below, tip, bounds, 6);
  return { ...p, side };
}

/** The selection bar: above the selection, flipped below when the top is covered, pinned to the
 *  top edge when the selection is taller than the view. `null` when the selection is off-screen. */
export function placeBar(sel: Box, bar: Size, bounds: Box, gap = 14): { x: number; y: number; below: boolean } | null {
  if (sel.x > bounds.x + bounds.w || sel.x + sel.w < bounds.x || sel.y > bounds.y + bounds.h || sel.y + sel.h < bounds.y) return null;
  const above = sel.y - gap - bar.h;
  const below = sel.y + sel.h + gap;
  let y = above, isBelow = false;
  if (above < bounds.y + 8) {
    if (below + bar.h <= bounds.y + bounds.h - 8) { y = below; isBelow = true; }
    else y = bounds.y + 8;
  }
  const p = clampBox(sel.x, y, bar, bounds, 8);
  return { x: p.x, y: p.y, below: isBelow };
}

/** A menu opened at the pointer: grows right/down, flips left/up at the edges. */
export function placeMenu(at: { x: number; y: number }, menu: Size, bounds: Box): { x: number; y: number } {
  const x = at.x + menu.w > bounds.x + bounds.w - 8 ? at.x - menu.w : at.x;
  const y = at.y + menu.h > bounds.y + bounds.h - 8 ? at.y - menu.h : at.y;
  return clampBox(x, y, menu, bounds, 8);
}

/** Platform-aware modifier label: ⌘ on Apple, Ctrl elsewhere. */
export function modKey(platform: string = typeof navigator !== "undefined" ? navigator.platform || "" : ""): string {
  return /mac|iphone|ipad/i.test(platform) ? "⌘" : "Ctrl+";
}
