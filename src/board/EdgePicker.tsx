// The picker behind a connector's "+" handle: what to put in the middle of the connection.
// Icons with tooltips, one compact row; "more" opens a second row with the remaining card types.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Translate } from "../home/i18n";
import { Icon, type IconName } from "./icons";
import type { Item } from "./model";

export interface PickSpec {
  id: string;
  icon: IconName;
  label: string;
  /** The item to insert, or a card type that needs more input first. */
  item?: Item;
  ask?: "link" | "embed" | "image" | "board";
}

export function pickerEntries(t: Translate): { main: PickSpec[]; more: PickSpec[] } {
  return {
    main: [
      { id: "rect", icon: "shapeRect", label: t("board.shape.rect"), item: { k: "shape", sh: "rect" } },
      { id: "diamond", icon: "shapeDiamond", label: t("board.shape.diamond"), item: { k: "shape", sh: "diamond" } },
      { id: "pill", icon: "shapePill", label: t("board.shape.pill"), item: { k: "shape", sh: "pill" } },
      { id: "circle", icon: "shapeCircle", label: t("board.shape.circle"), item: { k: "shape", sh: "circle" } },
      { id: "text", icon: "text", label: t("board.shape.text"), item: { k: "text", size: "p" } },
      { id: "note", icon: "note", label: t("board.tool.note"), item: { k: "card", w: 256 } },
      { id: "todo", icon: "todo", label: t("board.tool.todo"), item: { k: "todo", title: t("board.todo.title"), items: [] } },
    ],
    more: [
      { id: "col", icon: "col", label: t("board.tool.col"), item: { k: "col", title: t("board.col.title") } },
      { id: "link", icon: "link", label: t("board.tool.link"), ask: "link" },
      { id: "image", icon: "image", label: t("board.tool.image"), ask: "image" },
      { id: "board", icon: "board", label: t("board.tool.board"), ask: "board" },
      { id: "embed", icon: "embed", label: t("board.tool.embed"), ask: "embed" },
    ],
  };
}

export function EdgePicker({ at, bounds, t, onPick, onClose }: {
  /** Anchor in the board root's coordinates. */
  at: { x: number; y: number };
  bounds: { w: number; h: number };
  t: Translate;
  onPick: (spec: PickSpec) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [pos, setPos] = useState({ x: at.x, y: at.y });
  const { main, more: rest } = pickerEntries(t);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    setPos({
      x: Math.max(8, Math.min(bounds.w - w - 8, at.x - w / 2)),
      y: Math.max(52, Math.min(bounds.h - h - 48, at.y + 18)),
    });
  }, [at.x, at.y, bounds.w, bounds.h, more]);

  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key, true); };
  }, [onClose]);

  const btn = (s: PickSpec) => (
    <button key={s.id} className="ib" data-tip={s.label} aria-label={s.label} onClick={() => onPick(s)}><Icon name={s.icon} size={15} /></button>
  );
  return (
    <div ref={ref} className="hb-epick" role="toolbar" aria-label={t("board.insert.title")} style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <span className="kind">{t("board.insert.title")}</span>
      <i className="sep" />
      {main.map(btn)}
      <i className="sep" />
      <button className={`ib${more ? " on" : ""}`} data-tip={t("board.insert.more")} aria-label={t("board.insert.more")} aria-expanded={more}
        onClick={() => setMore((v) => !v)}><Icon name="more" size={15} /></button>
      {more && <div className="row2">{rest.map(btn)}</div>}
    </div>
  );
}
