export const LAYOUT_VERSION = 1;

export interface LayoutWidget {
  id: string; gx: number; gy: number; gw: number; gh: number;
  props?: Record<string, unknown>;
}
export interface HomeLayout {
  version: number;
  widgets: LayoutWidget[];
}

/** Factory layout — the approved home-rice-v2 mockup composition. */
export const DEFAULT_LAYOUT: HomeLayout = {
  version: LAYOUT_VERSION,
  widgets: [
    { id: "ascii",    gx: 0, gy: 0, gw: 3, gh: 6 },
    { id: "clock",    gx: 3, gy: 0, gw: 5, gh: 3 },
    { id: "gateway",  gx: 8, gy: 0, gw: 4, gh: 3 },
    { id: "tokens",   gx: 3, gy: 3, gw: 5, gh: 4 },
    { id: "host",     gx: 8, gy: 3, gw: 4, gh: 4 },
    { id: "matrix",   gx: 0, gy: 6, gw: 3, gh: 4 },
    { id: "sessions", gx: 3, gy: 7, gw: 3, gh: 3 },
    { id: "cron",     gx: 6, gy: 7, gw: 3, gh: 3 },
    { id: "errors",   gx: 9, gy: 7, gw: 3, gh: 3 },
  ],
};

function isValidWidget(w: unknown): w is LayoutWidget {
  if (typeof w !== "object" || w === null) return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    [o.gx, o.gy, o.gw, o.gh].every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Unknown/corrupt documents fall back to the default layout. With `known` (the
 *  widget registry's ids), the retired agent widget's slot becomes the board
 *  widget, other ids that no longer exist are dropped, and everything else keeps
 *  its place and props. */
export function parseLayout(raw: unknown, known?: ReadonlySet<string>): HomeLayout {
  if (typeof raw !== "object" || raw === null) return DEFAULT_LAYOUT;
  const o = raw as Record<string, unknown>;
  if (o.version !== LAYOUT_VERSION || !Array.isArray(o.widgets)) return DEFAULT_LAYOUT;
  const valid = o.widgets.filter(isValidWidget);
  if (!known) return { version: LAYOUT_VERSION, widgets: valid };
  // The board took the retired agent widget's place (1.8): same slot, fresh props.
  let hasBoard = valid.some((w) => w.id === "board");
  const widgets: LayoutWidget[] = [];
  for (const w of valid) {
    if (w.id === "agent" && known.has("board") && !hasBoard) {
      hasBoard = true;
      widgets.push({ id: "board", gx: w.gx, gy: w.gy, gw: w.gw, gh: w.gh });
    } else if (known.has(w.id)) {
      widgets.push(w);
    }
  }
  return { version: LAYOUT_VERSION, widgets };
}
