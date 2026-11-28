// Pure gesture logic for direct manipulation: double tap detection, what a double tap does,
// type-to-edit, and placing the caret where the user clicked. No React, no DOM, so node --test
// can load it.
//
// Why not the native `dblclick`: the viewport captures the pointer on pointerdown (needed for
// drags), and Chromium then retargets `click`/`dblclick` to the capturing element, so cards
// never see their own double clicks. BoardView detects the double tap itself on pointerup
// (mouse, pen and touch alike) and re-dispatches a `dblclick` at the real element.

export type PointerKind = "mouse" | "pen" | "touch";

export interface TapPoint { t: number; x: number; y: number; type: PointerKind }

/** Max gap between the two taps (ms). Touch is more forgiving. */
export const DBL_MS: Record<PointerKind, number> = { mouse: 380, pen: 420, touch: 480 };
/** Max distance between the two taps (px). */
export const DBL_PX: Record<PointerKind, number> = { mouse: 6, pen: 10, touch: 28 };
/** A press that moves less than this (px) and is shorter than TAP_MS is a tap, not a drag. */
export const TAP_SLOP: Record<PointerKind, number> = { mouse: 3, pen: 5, touch: 10 };
export const TAP_MS = 700;

export function pointerKind(type: string | undefined): PointerKind {
  return type === "touch" ? "touch" : type === "pen" ? "pen" : "mouse";
}

export function isTap(down: TapPoint, up: TapPoint): boolean {
  return up.t - down.t < TAP_MS && Math.hypot(up.x - down.x, up.y - down.y) <= TAP_SLOP[down.type];
}

/** Feeds one finished tap. `last` is what to remember for next time (null after a double so a
 *  third tap starts over instead of chaining). */
export function nextTap(prev: TapPoint | null, cur: TapPoint): { double: boolean; last: TapPoint | null } {
  if (prev && prev.type === cur.type
    && cur.t - prev.t <= DBL_MS[cur.type]
    && Math.hypot(cur.x - prev.x, cur.y - prev.y) <= DBL_PX[cur.type]) {
    return { double: true, last: null };
  }
  return { double: false, last: cur };
}

/** Kinds you can edit in place. */
export const EDITABLE = new Set(["card", "todo", "col", "frame", "box", "text", "image", "link", "video", "shape"]);
/** Kinds whose first typed character starts editing (a single selected text-like item). */
export const TYPE_TO_EDIT = new Set(["card", "text", "box", "shape"]);

export interface DblHit {
  /** Kind of the item (or column kid) under the pointer; null on the bare canvas. */
  kind: string | null;
  /** Over a connector. */
  wire?: boolean;
  /** Over selection chrome, a control or an active embed: leave it alone. */
  chrome?: boolean;
  /** Current tool. */
  tool: string;
}

export type DblAction = "none" | "new" | "edit" | "open" | "label";

export function dblAction(h: DblHit): DblAction {
  if (h.tool === "draw" || h.chrome) return "none";
  if (h.wire) return "label";
  if (!h.kind) return "new";
  if (h.kind === "board") return "open";
  return EDITABLE.has(h.kind) ? "edit" : "none";
}

/** A printable character that should start editing, or null. Space stays the pan key. */
export function typeToEditChar(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, kind: string | undefined): string | null {
  if (!kind || !TYPE_TO_EDIT.has(kind)) return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const chars = [...e.key];
  if (chars.length !== 1 || e.key === " " || e.key.trim() === "") return null;
  return e.key;
}

/**
 * Where in `source` the caret should go, given an offset into the text as rendered. Rich text
 * hides markers (`**bold**`), so the rendered string can be shorter than the source: anchor on
 * the few characters before the click when they appear in the source, else scale.
 */
export function mapCaret(rendered: string, offset: number, source: string): number {
  const o = Math.max(0, Math.min(rendered.length, Math.round(offset)));
  if (rendered === source) return o;
  if (!source.length) return 0;
  if (o >= rendered.length) return source.length;
  if (o === 0) return 0;
  for (const n of [14, 8, 4, 2]) {
    const ctx = rendered.slice(Math.max(0, o - n), o);
    if (ctx.length < Math.min(n, o)) continue;
    const at = source.indexOf(ctx);
    if (at >= 0 && source.indexOf(ctx, at + 1) < 0) return at + ctx.length;
  }
  return Math.round((o / rendered.length) * source.length);
}

export interface EditHint {
  id: string;
  /** Which part: title | text | cap | row:<n> | label. Absent = the default field. */
  field?: string;
  /** Caret offset in the source text (absent = end). */
  caret?: number;
  /** A character typed to start editing: appended to the field. */
  seed?: string;
}
