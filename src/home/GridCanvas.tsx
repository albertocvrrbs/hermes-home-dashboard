import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import { navigateTo } from "../sdk";
import {
  GRID_COLS, clampPosition, findSwapTarget, findFreeSlot, reflow,
  type GridBox, type GridItem,
} from "./grid-engine";
import type { HomeLayout } from "./layout-schema";
import { WIDGET_REGISTRY } from "./widgets/registry";
import { WidgetShell } from "./WidgetShell";
import type { HomeData } from "./useHomeData";

const CELL_H = 44;
const GAP = 10;
const PAD = 12;

export interface GridCanvasHandle {
  /** Begin dragging a brand-new widget in from the catalog. */
  startExternalAdd: (id: string, e: React.PointerEvent) => void;
}

interface Props {
  layout: HomeLayout;
  editing: boolean;
  data: HomeData;
  onLayoutChange: (next: HomeLayout) => void;
  onRemove: (id: string) => void;
  onWidgetPropsChange: (id: string, props: Record<string, unknown>) => void;
  /** Element acting as the trash / catalog drop zone (to delete by drag). */
  trashRef: React.RefObject<HTMLElement | null>;
  /** Notifies HomePage to highlight the trash zone during a drag over it. */
  onTrashActive: (active: boolean) => void;
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  candidate: GridBox;
  px: { left: number; top: number; width: number; height: number };
  swapWith: string | null;
  moved: Map<string, number>;
  /** Pointer is over the trash zone → dropping here deletes the widget. */
  overTrash: boolean;
}

interface AddState {
  id: string;
  pointer: { x: number; y: number };
  /** Grid cell candidate when the pointer is over the stage; null otherwise. */
  candidate: GridBox | null;
  moved: Map<string, number>;
}

export const GridCanvas = forwardRef<GridCanvasHandle, Props>(function GridCanvas(
  { layout, editing, data, onLayoutChange, onRemove, onWidgetPropsChange, trashRef, onTrashActive },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [adding, setAdding] = useState<AddState | null>(null);
  const addRef = useRef<AddState | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const colW = stageW > 0 ? (stageW - PAD * 2 - GAP * (GRID_COLS - 1)) / GRID_COLS : 0;

  const toPx = (box: GridBox) => ({
    left: PAD + box.gx * (colW + GAP),
    top: PAD + box.gy * (CELL_H + GAP),
    width: box.gw * colW + (box.gw - 1) * GAP,
    height: box.gh * CELL_H + (box.gh - 1) * GAP,
  });

  const pointerOverTrash = (x: number, y: number) => {
    const el = trashRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  // ── Move / resize an existing widget (drop on the catalog = delete) ──
  function startDrag(item: GridItem, mode: "move" | "resize", e: React.PointerEvent) {
    if (!editing || colW <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const stageRect = stageRef.current!.getBoundingClientRect();
    const startPx = toPx(item);
    const start = { x: e.clientX, y: e.clientY };
    const others = layout.widgets.filter((w) => w.id !== item.id);

    const init: DragState = {
      id: item.id, mode, candidate: { ...item }, px: startPx,
      swapWith: null, moved: new Map(), overTrash: false,
    };
    dragRef.current = init;
    setDrag(init);

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      const overTrash = mode === "move" && pointerOverTrash(ev.clientX, ev.clientY);
      onTrashActive(overTrash);
      let next: DragState;
      if (mode === "resize") {
        const def = WIDGET_REGISTRY[item.id];
        const minW = def?.minSize.gw ?? 2;
        const minH = def?.minSize.gh ?? 1;
        const gw = Math.max(minW, Math.min(GRID_COLS - item.gx,
          Math.round((startPx.width + dx + GAP) / (colW + GAP))));
        const gh = Math.max(minH,
          Math.round((startPx.height + dy + GAP) / (CELL_H + GAP)));
        const candidate = { gx: item.gx, gy: item.gy, gw, gh };
        next = {
          ...dragRef.current!,
          candidate,
          px: {
            ...startPx,
            width: Math.max(70, startPx.width + dx),
            height: Math.max(CELL_H, startPx.height + dy),
          },
          swapWith: null,
          moved: reflow({ ...candidate }, others),
          overTrash: false,
        };
      } else {
        const pos = clampPosition(
          item.gx + dx / (colW + GAP),
          item.gy + dy / (CELL_H + GAP),
          item.gw, item.gh,
        );
        const candidate = { ...pos, gw: item.gw, gh: item.gh };
        const pgx = (ev.clientX - stageRect.left - PAD) / (colW + GAP);
        const pgy = (ev.clientY - stageRect.top - PAD) / (CELL_H + GAP);
        const twin = overTrash ? null : findSwapTarget(pgx, pgy, item, others);
        next = {
          ...dragRef.current!,
          candidate,
          px: { ...startPx, left: startPx.left + dx, top: startPx.top + dy },
          swapWith: twin?.id ?? null,
          moved: twin || overTrash ? new Map() : reflow({ ...candidate }, others),
          overTrash,
        };
      }
      dragRef.current = next;
      setDrag(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      onTrashActive(false);
      if (!d) return;
      if (d.overTrash) { onRemove(d.id); return; }
      const widgets = layout.widgets.map((w) => ({ ...w }));
      const me = widgets.find((w) => w.id === d.id)!;
      if (d.swapWith) {
        const twin = widgets.find((w) => w.id === d.swapWith)!;
        const { gx, gy } = twin;
        twin.gx = me.gx; twin.gy = me.gy;
        me.gx = gx; me.gy = gy;
      } else {
        me.gx = d.candidate.gx; me.gy = d.candidate.gy;
        me.gw = d.candidate.gw; me.gh = d.candidate.gh;
        for (const w of widgets) {
          const gy = d.moved.get(w.id);
          if (gy !== undefined) w.gy = gy;
        }
      }
      onLayoutChange({ ...layout, widgets });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // ── Drag a NEW widget in from the catalog ──
  useImperativeHandle(ref, () => ({
    startExternalAdd(id: string, e: React.PointerEvent) {
      if (colW <= 0) return;
      const def = WIDGET_REGISTRY[id];
      if (!def) return;
      e.preventDefault();
      const { gw, gh } = def.defaultSize;

      const cellFor = (x: number, y: number): GridBox | null => {
        const stageRect = stageRef.current!.getBoundingClientRect();
        if (x < stageRect.left || x > stageRect.right || y < stageRect.top || y > stageRect.bottom) {
          return null;
        }
        const pos = clampPosition(
          (x - stageRect.left - PAD) / (colW + GAP),
          (y - stageRect.top - PAD) / (CELL_H + GAP),
          gw, gh,
        );
        return { ...pos, gw, gh };
      };

      const startPoint = { x: e.clientX, y: e.clientY };
      const init: AddState = {
        id, pointer: { x: e.clientX, y: e.clientY },
        candidate: cellFor(e.clientX, e.clientY), moved: new Map(),
      };
      addRef.current = init;
      setAdding(init);

      function onMove(ev: PointerEvent) {
        const candidate = cellFor(ev.clientX, ev.clientY);
        const next: AddState = {
          id,
          pointer: { x: ev.clientX, y: ev.clientY },
          candidate,
          moved: candidate ? reflow({ ...candidate }, layout.widgets) : new Map(),
        };
        addRef.current = next;
        setAdding(next);
      }
      function onUp(ev: PointerEvent) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const a = addRef.current;
        addRef.current = null;
        setAdding(null);
        if (!a) return;
        const moved = Math.hypot(ev.clientX - startPoint.x, ev.clientY - startPoint.y);
        // Dropped on the grid → place there. A near-stationary release (a
        // tap on the chip) → drop into the first free slot. Released away
        // from the grid after dragging → cancel.
        let cell = a.candidate;
        let pushed = a.moved;
        if (!cell) {
          if (moved > 6) return;
          cell = { ...findFreeSlot(layout.widgets, { gw, gh }), gw, gh };
          pushed = new Map();
        }
        const widgets = layout.widgets.map((w) => {
          const gy = pushed.get(w.id);
          return gy !== undefined ? { ...w, gy } : { ...w };
        });
        widgets.push({ id, gx: cell.gx, gy: cell.gy, gw, gh });
        onLayoutChange({ ...layout, widgets });
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
  }), [colW, layout, onLayoutChange]);

  const previewMoved = drag?.moved ?? adding?.moved ?? null;
  const maxRow = layout.widgets.reduce(
    (m, w) => Math.max(m, (previewMoved?.get(w.id) ?? w.gy) + w.gh), 0,
  );
  const addRow = adding?.candidate ? adding.candidate.gy + adding.candidate.gh : 0;
  const stageH = PAD * 2 + Math.max(maxRow, addRow) * (CELL_H + GAP) - GAP;

  const ghostBox: GridBox | null = drag
    ? drag.overTrash
      ? null
      : drag.swapWith
        ? { ...layout.widgets.find((w) => w.id === drag.swapWith)!, gw: drag.candidate.gw, gh: drag.candidate.gh }
        : drag.candidate
    : adding?.candidate ?? null;

  const addDef = adding ? WIDGET_REGISTRY[adding.id] : null;

  return (
    <div ref={stageRef} className="home-stage" style={{ height: Math.max(stageH, 200) }}>
      <div
        className={`home-ghost${ghostBox ? " visible" : ""}${drag?.swapWith ? " swap" : ""}`}
        style={ghostBox ? toPx(ghostBox) : undefined}
      />
      {colW > 0 && layout.widgets.map((item) => {
        const def = WIDGET_REGISTRY[item.id];
        if (!def) return null;
        const isDragged = drag?.id === item.id;
        const isTwinTarget = drag?.swapWith === item.id;
        let box: GridBox = item;
        if (!isDragged) {
          if (isTwinTarget && drag) {
            const origin = layout.widgets.find((w) => w.id === drag.id)!;
            box = { ...item, gx: origin.gx, gy: origin.gy };
          } else {
            const gy = previewMoved?.get(item.id);
            if (gy !== undefined) box = { ...item, gy };
          }
        }
        const style = isDragged && drag ? drag.px : toPx(box);
        const Component = def.component;
        return (
          <WidgetShell
            key={item.id}
            title={def.title}
            style={style}
            editing={editing}
            dragging={isDragged}
            swapTarget={isTwinTarget}
            trashing={isDragged && drag?.overTrash}
            error={def.dataSource !== null && data.errors.has(def.dataSource)}
            onRemove={() => onRemove(item.id)}
            onHeaderPointerDown={(e) => startDrag(item, "move", e)}
            onResizePointerDown={(e) => startDrag(item, "resize", e)}
            onClickThrough={
              def.navigateTo ? () => navigateTo(def.navigateTo!) : undefined
            }
          >
            <Component
              data={data}
              widgetProps={item.props ?? {}}
              onWidgetPropsChange={(p) => onWidgetPropsChange(item.id, p)}
            />
          </WidgetShell>
        );
      })}
      {adding && addDef && (
        <div
          className="home-add-ghost"
          style={{ left: adding.pointer.x, top: adding.pointer.y }}
        >
          + {addDef.title}
        </div>
      )}
    </div>
  );
});
