// A faithful miniature of a board: the same items drawn by the same renderers and styles as
// the full page, read-only, scaled to fit its box. Used by the Home widget and by nested-board
// cards, so zooming from either into the full page is one continuous picture.
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "../home/i18n";
import { fitView, RESIZE_H, type Rect, type View } from "./geometry";
import { ItemBody, type ItemCtx } from "./items";
import { approxRect, DEFAULT_SIZE, itemLabel, type BoardDoc, type Item } from "./model";
import { Wires } from "./Wires";
import { SyncHub } from "./syncClock";

/** How a miniature laid its content out: the view (relative to the box's top-left) and the
 *  content bounds in board coordinates. Read by the page transitions. */
export interface MiniFit { view: View; w: number; h: number; b: Rect }
const fits = new WeakMap<HTMLElement, MiniFit>();
export const miniFitOf = (el: HTMLElement | null | undefined): MiniFit | null => (el ? fits.get(el) ?? null : null);

/** Padding around the content inside the box, CSS px. */
export const miniPad = (w: number, h: number): number => Math.max(6, Math.min(22, Math.round(Math.min(w, h) * 0.09)));

const NONE = new Set<string>();
const noop = () => undefined;
const MINI_HUB = new SyncHub();
const layer = (it: Item) => (it.k === "frame" ? 0 : it.k === "draw" && it.tl === "hl" ? 1 : 2);

/** The items as the board page positions them. */
function box(it: Item): { x: number; y: number; width?: number; height?: number } {
  const [dw] = DEFAULT_SIZE[it.k] ?? [200, 100];
  return {
    x: it.x ?? 0, y: it.y ?? 0,
    width: it.k === "draw" ? undefined : (it.w ?? (it.k === "text" ? undefined : dw)),
    height: RESIZE_H.has(it.k) ? (it.h ?? (it.k === "frame" ? 320 : it.k === "box" ? 62 : undefined)) : undefined,
  };
}

export function MiniBoard({ doc, id, className }: { doc: BoardDoc | null; id?: string; className?: string }) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, Rect>());
  const sig = useRef("");
  const [ver, setVer] = useState(0);

  const ctx: ItemCtx | null = useMemo(() => {
    if (!doc) return null;
    const c: ItemCtx = {
      doc, t, editing: null, hint: null, keyOf: (k) => k, setEditing: noop, update: noop, commit: noop, playing: null, setPlaying: noop,
      openBoard: noop, addToColumn: noop, liveActions: null, liveActionsDown: false, runLiveAction: async () => null,
      bid: "", sync: MINI_HUB, runCompAction: async () => null,
      renderKid: (kid) => {
        const it = doc.items[kid];
        return it ? <div key={kid} className="hb-kid"><MiniBody id={kid} item={it} c={c} /></div> : null;
      },
    };
    return c;
  }, [doc, t]);

  const items = useMemo(() => {
    if (!doc) return [] as [string, Item][];
    return Object.entries(doc.items).filter(([, it]) => !it.in && it.k !== "line").sort(([, a], [, b]) => layer(a) - layer(b));
  }, [doc]);

  const getRect = useCallback((rid: string): Rect | null => {
    const r = rects.current.get(rid);
    if (r) return r;
    const it = doc?.items[rid];
    return it ? approxRect(it) : null;
  }, [doc]);

  /** Fit the measured content into the box. */
  const place = useCallback(() => {
    const root = rootRef.current, world = worldRef.current;
    if (!root || !world) return;
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    const tops = [...rects.current.entries()].filter(([rid]) => doc?.items[rid] && !doc.items[rid].in && doc.items[rid].k !== "line").map(([, r]) => r);
    if (!tops.length) { world.style.transform = "none"; fits.delete(root); return; }
    const x0 = Math.min(...tops.map((r) => r.x)), y0 = Math.min(...tops.map((r) => r.y));
    const x1 = Math.max(...tops.map((r) => r.x + r.w)), y1 = Math.max(...tops.map((r) => r.y + r.h));
    const b = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const view = fitView(b, { w, h }, miniPad(w, h), 1.1);
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
    fits.set(root, { view, w, h, b });
  }, [doc]);

  /** Read each item's laid-out box (offset sizes ignore the scale). */
  const measure = useCallback(() => {
    const next = new Map<string, Rect>();
    let s = "";
    els.current.forEach((el, rid) => {
      const r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      next.set(rid, r);
      s += `${rid}:${r.x},${r.y},${r.w},${r.h};`;
    });
    rects.current = next;
    place();
    if (s !== sig.current) { sig.current = s; setVer((v) => v + 1); }
  }, [place]);

  useLayoutEffect(() => { measure(); }, [measure, doc, ctx]);

  useLayoutEffect(() => {
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const root = rootRef.current;
    if (!RO || !root) return;
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    const ro = new RO(schedule);
    ro.observe(root);
    els.current.forEach((el) => ro.observe(el));
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [measure, items]);

  const reg = (rid: string) => (el: HTMLElement | null) => { if (el) els.current.set(rid, el); else els.current.delete(rid); };

  return (
    <div ref={rootRef} className={`hb hb-mini${className ? ` ${className}` : ""}`} data-mini={id} aria-hidden="true">
      <div className="hb-world" ref={worldRef}>
        {doc && <Wires doc={doc} getRect={getRect} version={ver} hidden={NONE} fresh={NONE} selected={NONE} draft={null} onSelect={noop}
          editLabel={null} insertLabel="" onLabel={noop} onDouble={noop} onInsert={noop} />}
        {ctx && items.map(([rid, it]) => {
          const b = box(it);
          return (
            <div key={rid} className="hb-item" ref={reg(rid)} style={{ left: b.x, top: b.y, width: b.width, height: b.height, zIndex: layer(it) < 2 ? 0 : 1 }}>
              <MiniBody id={rid} item={it} c={ctx} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One item as a miniature draws it: the real renderer, except where it would load or run something. */
function MiniBody({ id, item, c }: { id: string; item: Item; c: ItemCtx }): ReactNode {
  if (item.k === "embed") {
    return (
      <div className="hb-card hb-embed" style={{ width: item.w ?? 452 }}>
        <div className="bar-e"><span className="file">{item.title || c.t("board.embed.title")}</span></div>
        <div className="frame" style={{ height: item.h ? Math.max(120, item.h - 80) : 240 }} />
      </div>
    );
  }
  if (item.k === "comp") {
    return (
      <div className={`hb-card hb-embed hb-comp${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 480 }}>
        <div className="bar-e"><span className="file">{item.title || item.comp}</span></div>
        <div className="frame" style={{ height: item.h ? Math.max(120, item.h - 80) : 240 }} />
      </div>
    );
  }
  if (item.k === "video" && item.sync) return <ItemBody id={id} item={{ ...item, sync: undefined }} c={c} dropIndex={null} selected={false} />;
  if (item.k === "board") {
    return (
      <div className={`hb-card hb-boardref${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 212 }}>
        <div className="pv" />
        <div className="ttl"><b>{item.title || itemLabel(item)}</b></div>
        <div className="meta"><span>&nbsp;</span></div>
      </div>
    );
  }
  return <ItemBody id={id} item={item} c={c} dropIndex={null} selected={false} />;
}
