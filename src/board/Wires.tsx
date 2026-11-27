// Connectors: orthogonal, rounded elbows, square source port, solid triangular head.
// Alberto's are continuous ink; Hermes' are dot matrix (and appear dot by dot when fresh).
import { useLayoutEffect, useState } from "react";
import { elbowPath, headPath, route, samplePolyline, type Rect } from "./geometry";
import type { BoardDoc, End, Point } from "./model";

interface Wire {
  id: string; d: string; dots: Point[] | null; head: string; port: Point; hermes: boolean;
  label?: string; mid: Point; fresh: boolean;
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
}

function endRect(end: End | undefined, getRect: (id: string) => Rect | null): Rect | null {
  if (end == null) return null;
  if (Array.isArray(end)) return { x: end[0], y: end[1], w: 0, h: 0 };
  return getRect(end);
}

export function Wires({ doc, getRect, version, hidden, fresh, selected, draft, onSelect }: WiresProps) {
  const [wires, setWires] = useState<Wire[]>([]);
  useLayoutEffect(() => {
    const out: Wire[] = [];
    for (const [id, it] of Object.entries(doc.items)) {
      if (it.k !== "line" || hidden.has(id)) continue;
      if ([it.a, it.b].some((e) => typeof e === "string" && hidden.has(e))) continue;
      const a = endRect(it.a, getRect), b = endRect(it.b, getRect);
      if (!a || !b) continue;
      const r = route(a, b);
      const pts = r.points.slice();
      const end = pts[pts.length - 1];
      const hermes = it.by === "h";
      const tip: Point = [end[0] + ({ r: -2, l: 2, d: 0, u: 0 }[r.dir]), end[1] + ({ r: 0, l: 0, d: -2, u: 2 }[r.dir])];
      pts[pts.length - 1] = tip;
      const mi = Math.floor(pts.length / 2);
      const mid: Point = pts.length === 2
        ? [(pts[0][0] + tip[0]) / 2, (pts[0][1] + tip[1]) / 2]
        : [(pts[mi - 1][0] + pts[mi][0]) / 2, (pts[mi - 1][1] + pts[mi][1]) / 2];
      out.push({
        id, hermes, label: it.label, mid, fresh: fresh.has(id),
        d: elbowPath(pts, 7),
        dots: hermes ? samplePolyline(pts, 4).filter(([x, y]) => Math.hypot(x - tip[0], y - tip[1]) > 6) : null,
        head: headPath(tip[0], tip[1], r.dir),
        port: pts[0],
      });
    }
    setWires(out);
  }, [doc, version, hidden, fresh, getRect]);

  return (
    <svg className="hb-wires" width="1" height="1" aria-hidden="true">
      {wires.map((w) => {
        const ink = w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 55%, transparent)";
        const sel = selected.has(w.id);
        return (
          <g key={w.id} className={w.fresh ? "fresh" : undefined}>
            <path className="hit" d={w.d} stroke="transparent" strokeWidth={12} fill="none"
              data-line={w.id} style={{ pointerEvents: "stroke" }}
              onPointerDown={(e) => { e.stopPropagation(); onSelect(w.id, e.shiftKey); }} />
            {sel && <path className="line-sel" d={w.d} />}
            {w.dots
              ? w.dots.map(([x, y], i) => (
                  <rect key={i} className="d" x={x - 1.15} y={y - 1.15} width={2.3} height={2.3} fill={ink}
                    style={w.fresh ? { animationDelay: `${i * 14}ms` } : undefined} />
                ))
              : <path d={w.d} fill="none" stroke={ink} strokeWidth={1.3} />}
            <rect x={w.port[0] - 2.5} y={w.port[1] - 2.5} width={5} height={5} fill={ink} />
            <path d={w.head} fill={w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 72%, transparent)"}
              style={w.fresh && w.dots ? { animation: "hb-dot-in .2s both", animationDelay: `${w.dots.length * 14}ms` } : undefined} />
            {w.label && (
              <g>
                <rect className="lbl-bg" x={w.mid[0] - w.label.length * 3.3 - 6} y={w.mid[1] - 8} width={w.label.length * 6.6 + 12} height={16} />
                <text className="lbl" x={w.mid[0]} y={w.mid[1] + 3.5} textAnchor="middle">{w.label}</text>
              </g>
            )}
          </g>
        );
      })}
      {draft && (() => {
        const r = route(draft.from, { x: draft.to[0], y: draft.to[1], w: 0, h: 0 });
        return <path className="draft" d={elbowPath(r.points, 7)} />;
      })()}
    </svg>
  );
}
