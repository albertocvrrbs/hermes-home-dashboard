// Connectors: orthogonal, rounded elbows, square source port, solid triangular head.
// Alberto's are continuous ink; Hermes' are dot matrix (and appear dot by dot when fresh).
//
// Redrawing is cheap on purpose: every wire is memoised on its geometry, and `refresh(ids)`
// (rAF-batched) re-routes only the wires touching those items, so dragging a card, a tidy
// animation or a resize moves its connectors every frame without touching the rest.
import { forwardRef, memo, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { elbowPath, headPath, pointAtT, route, samplePolyline, type Rect } from "./geometry";
import { nextTap, pointerKind } from "./gesture";
import type { TapPoint } from "./gesture";
import type { BoardDoc, End, Point } from "./model";

interface Wire {
  id: string; d: string; dots: Point[] | null; head: string; port: Point; hermes: boolean;
  label?: string; mid: Point; fresh: boolean; pts: Point[]; sig: string;
}

export interface WiresHandle {
  /** Re-route the wires that touch `ids` on the next frame (all of them when omitted). */
  refresh: (ids?: Iterable<string>) => void;
}

export interface WiresProps {
  doc: BoardDoc;
  getRect: (id: string) => Rect | null;
  version: number;
  hidden: Set<string>;
  fresh: Set<string>;
  selected: Set<string>;
  draft: { from: Rect; to: Point } | null;
  onSelect: (id: string, additive: boolean) => void;
  /** Connector being renamed in place, and its outcome (null = leave the label alone). */
  editLabel: string | null;
  onLabel: (id: string, value: string | null) => void;
  /** Double click / double tap on a connector. */
  onDouble: (id: string) => void;
  /** The "+" handle was pressed: insert something in the middle of this connector. */
  onInsert: (id: string, at: { x: number; y: number }) => void;
  insertLabel: string;
}

function endRect(end: End | undefined, getRect: (id: string) => Rect | null): Rect | null {
  if (end == null) return null;
  if (Array.isArray(end)) return { x: end[0], y: end[1], w: 0, h: 0 };
  return getRect(end);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function build(id: string, it: BoardDoc["items"][string], getRect: (id: string) => Rect | null, fresh: boolean, prev?: Wire): Wire | null {
  const a = endRect(it.a, getRect), b = endRect(it.b, getRect);
  if (!a || !b) return null;
  const hermes = it.by === "h";
  const sig = `${r1(a.x)},${r1(a.y)},${r1(a.w)},${r1(a.h)}|${r1(b.x)},${r1(b.y)},${r1(b.w)},${r1(b.h)}|${it.label ?? ""}|${hermes ? 1 : 0}|${fresh ? 1 : 0}`;
  if (prev && prev.sig === sig) return prev;
  const r = route(a, b);
  const pts = r.points.slice();
  const end = pts[pts.length - 1];
  const tip: Point = [end[0] + ({ r: -2, l: 2, d: 0, u: 0 }[r.dir]), end[1] + ({ r: 0, l: 0, d: -2, u: 2 }[r.dir])];
  pts[pts.length - 1] = tip;
  const mi = Math.floor(pts.length / 2);
  const mid: Point = pts.length === 2
    ? [(pts[0][0] + tip[0]) / 2, (pts[0][1] + tip[1]) / 2]
    : [(pts[mi - 1][0] + pts[mi][0]) / 2, (pts[mi - 1][1] + pts[mi][1]) / 2];
  return {
    id, hermes, label: it.label, mid, fresh, sig, pts,
    d: elbowPath(pts, 7),
    dots: hermes ? samplePolyline(pts, 4).filter(([x, y]) => Math.hypot(x - tip[0], y - tip[1]) > 6) : null,
    head: headPath(tip[0], tip[1], r.dir),
    port: pts[0],
  };
}

interface Hover { id: string }

interface ViewProps {
  w: Wire; selected: boolean; /** the only thing selected: its "+" stays up (touch has no hover) */ sole: boolean; showHandle: Hover | null; editing: boolean; insertLabel: string;
  onSelect: WiresProps["onSelect"]; onLabel: WiresProps["onLabel"]; onDouble: WiresProps["onDouble"];
  onInsert: WiresProps["onInsert"]; onHover: (h: Hover | null, soon?: boolean) => void;
}

const WireView = memo(function WireView({ w, selected, sole, showHandle, editing, insertLabel, onSelect, onLabel, onDouble, onInsert, onHover }: ViewProps) {
  const lastTap = useRef<TapPoint | null>(null);
  const ink = w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 55%, transparent)";
  // The "+" sits at the middle of the connector (beside its label when it has one), never under
  // the pointer: a double click on the line must not land on it.
  const plus = (): Point => {
    if (!w.label) return w.mid;
    const total = w.pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - w.pts[i - 1][0], p[1] - w.pts[i - 1][1]) : 0), 0) || 1;
    return pointAtT(w.pts, Math.min(0.92, 0.5 + (w.label.length * 3.3 + 26) / total));
  };
  const handleAt = showHandle?.id === w.id || sole ? plus() : null;
  return (
    <g className={w.fresh ? "fresh" : undefined}>
      <path className="hit" d={w.d} stroke="transparent" strokeWidth={12} fill="none"
        data-line={w.id} style={{ pointerEvents: "stroke" }}
        onPointerEnter={(e) => { if (e.pointerType !== "touch") onHover({ id: w.id }); }}
        onPointerLeave={() => onHover(null, true)}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(w.id, e.shiftKey);
          const r = nextTap(lastTap.current, { t: e.timeStamp, x: e.clientX, y: e.clientY, type: pointerKind(e.pointerType) });
          lastTap.current = r.last;
          // after the browser's own mousedown focus change, or it would take the field's focus right back
          if (r.double) window.setTimeout(() => onDouble(w.id), 0);
        }} />
      {selected && <path className="line-sel" d={w.d} />}
      {w.dots
        ? w.dots.map(([x, y], i) => (
            <rect key={i} className="d" x={x - 1.15} y={y - 1.15} width={2.3} height={2.3} fill={ink}
              style={w.fresh ? { animationDelay: `${i * 14}ms` } : undefined} />
          ))
        : <path d={w.d} fill="none" stroke={ink} strokeWidth={1.3} />}
      <rect x={w.port[0] - 2.5} y={w.port[1] - 2.5} width={5} height={5} fill={ink} />
      <path d={w.head} fill={w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 72%, transparent)"}
        style={w.fresh && w.dots ? { animation: "hb-dot-in .2s both", animationDelay: `${w.dots.length * 14}ms` } : undefined} />
      {w.label && !editing && (
        <g>
          <rect className="lbl-bg" x={w.mid[0] - w.label.length * 3.3 - 6} y={w.mid[1] - 8} width={w.label.length * 6.6 + 12} height={16} />
          <text className="lbl" x={w.mid[0]} y={w.mid[1] + 3.5} textAnchor="middle">{w.label}</text>
        </g>
      )}
      {editing && (
        <foreignObject x={w.mid[0] - 70} y={w.mid[1] - 11} width={140} height={22}>
          <input className="hb-lbl-edit" autoFocus defaultValue={w.label ?? ""} data-nodrag="" maxLength={200}
            ref={(el) => { if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); el.select(); } }}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => { if (!e.currentTarget.dataset.cancel) onLabel(w.id, e.currentTarget.value); }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
              if (e.key === "Escape") { e.preventDefault(); e.currentTarget.dataset.cancel = "1"; onLabel(w.id, null); }
            }} />
        </foreignObject>
      )}
      {handleAt && !editing && (
        <g className="hb-eplus" data-tip={insertLabel} aria-label={insertLabel} role="button"
          style={{ transform: `translate(${handleAt[0]}px, ${handleAt[1]}px) scale(var(--iz, 1))` }}
          onPointerEnter={() => onHover({ id: w.id })}
          onPointerLeave={() => onHover(null, true)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onInsert(w.id, { x: e.clientX, y: e.clientY }); }}>
          <circle r={13} className="pad" />
          <circle r={9} className="dot" />
          {/* lucide "plus" */}
          <path className="pl" d="M-4 0H4M0 -4V4" />
        </g>
      )}
    </g>
  );
});

export const Wires = forwardRef<WiresHandle, WiresProps>(function Wires(props, ref) {
  const { doc, getRect, version, hidden, fresh, selected, draft, editLabel, insertLabel } = props;
  const [wires, setWires] = useState<Wire[]>([]);
  const [hover, setHover] = useState<Hover | null>(null);
  const cache = useRef(new Map<string, Wire>());
  const live = useRef(props);
  live.current = props;
  const raf = useRef(0);
  const pending = useRef<Set<string> | "all" | null>(null);
  const hideTimer = useRef(0);

  const compute = useCallback((only: Set<string> | null) => {
    const { doc: d, getRect: gr, hidden: hid, fresh: fr } = live.current;
    const next: Wire[] = [];
    const keep = new Map<string, Wire>();
    for (const [id, it] of Object.entries(d.items)) {
      if (it.k !== "line" || hid.has(id)) continue;
      if ([it.a, it.b].some((e) => typeof e === "string" && hid.has(e))) continue;
      const prev = cache.current.get(id);
      const touched = !only || !prev || [it.a, it.b].some((e) => typeof e === "string" && only.has(e));
      const w = touched ? build(id, it, gr, fr.has(id), prev) : prev ?? null;
      if (w) { next.push(w); keep.set(id, w); }
    }
    cache.current = keep;
    setWires((cur) => (cur.length === next.length && cur.every((w, i) => w === next[i]) ? cur : next));
  }, []);

  useLayoutEffect(() => { compute(null); }, [doc, version, hidden, fresh, getRect, compute]);

  useImperativeHandle(ref, () => ({
    refresh: (ids) => {
      if (!ids) pending.current = "all";
      else if (pending.current !== "all") {
        const set = pending.current ?? (pending.current = new Set());
        for (const id of ids) set.add(id);
      }
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const p = pending.current;
        pending.current = null;
        compute(p === "all" || !p ? null : p);
      });
    },
  }), [compute]);
  useLayoutEffect(() => () => { cancelAnimationFrame(raf.current); window.clearTimeout(hideTimer.current); }, []);

  const onHover = useCallback((h: Hover | null, soon?: boolean) => {
    window.clearTimeout(hideTimer.current);
    if (h) { setHover(h); return; }
    if (soon) hideTimer.current = window.setTimeout(() => setHover(null), 260);
    else setHover(null);
  }, []);

  // stable callbacks, so a wire re-renders only when its own geometry or state changes
  const stable = useRef({
    onSelect: (id: string, add: boolean) => live.current.onSelect(id, add),
    onLabel: (id: string, v: string | null) => live.current.onLabel(id, v),
    onDouble: (id: string) => live.current.onDouble(id),
    onInsert: (id: string, at: { x: number; y: number }) => live.current.onInsert(id, at),
  }).current;

  return (
    <svg className="hb-wires" width="1" height="1">
      {wires.map((w) => (
        <WireView key={w.id} w={w} selected={selected.has(w.id)} sole={selected.size === 1 && selected.has(w.id)} showHandle={hover?.id === w.id ? hover : null}
          editing={editLabel === w.id} insertLabel={insertLabel}
          onSelect={stable.onSelect} onLabel={stable.onLabel} onDouble={stable.onDouble} onInsert={stable.onInsert} onHover={onHover} />
      ))}
      {draft && (() => {
        const r = route(draft.from, { x: draft.to[0], y: draft.to[1], w: 0, h: 0 });
        return <path className="draft" d={elbowPath(r.points, 7)} />;
      })()}
    </svg>
  );
});
