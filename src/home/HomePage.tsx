import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJSON } from "../sdk";
import { GridCanvas, type GridCanvasHandle } from "./GridCanvas";
import { WidgetCatalog } from "./WidgetCatalog";
import { useHomeData } from "./useHomeData";
import {
  DEFAULT_LAYOUT, parseLayout, type HomeLayout,
} from "./layout-schema";

const LAYOUT_URL = "/api/plugins/home-dashboard/layout";

function loadLayout(): Promise<HomeLayout> {
  return fetchJSON<{ layout: unknown }>(LAYOUT_URL)
    .then((r) => (r.layout == null ? DEFAULT_LAYOUT : parseLayout(r.layout)))
    .catch(() => DEFAULT_LAYOUT);
}

function saveLayout(layout: HomeLayout): Promise<unknown> {
  return fetchJSON(LAYOUT_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout }),
  });
}

export default function HomePage() {
  const [layout, setLayout] = useState<HomeLayout | null>(null);
  const [editing, setEditing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridCanvasHandle>(null);
  const dirty = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const data = useHomeData();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // The edit affordance lives below the grid and reveals once the user
  // starts scrolling down — or right away when the grid is short enough
  // that there's nothing to scroll (otherwise it'd be unreachable).
  const recomputeShowEdit = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight - el.clientHeight > 24;
    setShowEdit(!canScroll || el.scrollTop > 16);
  }, []);

  useEffect(() => {
    loadLayout().then(setLayout);
  }, []);

  // Re-evaluate visibility when the layout (and thus grid height) changes.
  useEffect(() => { recomputeShowEdit(); }, [layout, editing, recomputeShowEdit]);

  const update = useCallback((next: HomeLayout) => {
    dirty.current = true;
    setLayout(next);
  }, []);

  // Widget props (e.g. notes) change in rest mode too — autosave debounced
  // instead of waiting for the lock to close.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateWidgetProps = useCallback(
    (id: string, props: Record<string, unknown>) => {
      setLayout((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          widgets: prev.widgets.map((w) => (w.id === id ? { ...w, props } : w)),
        };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveLayout(next).then(
            () => { dirty.current = false; },
            () => showToast("Could not save the layout — it is kept for this session"),
          );
        }, 800);
        dirty.current = true;
        return next;
      });
    },
    [showToast],
  );
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const toggleEditing = useCallback(async () => {
    if (editing && dirty.current && layout) {
      try {
        await saveLayout(layout);
        dirty.current = false;
      } catch {
        showToast("Could not save the layout — it is kept for this session");
      }
    }
    setEditing((e) => !e);
  }, [editing, layout, showToast]);

  // Escape closes the lock (saving), same as the button.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void toggleEditing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, toggleEditing]);

  if (!layout) return null;

  return (
    <div
      ref={rootRef}
      className={`home-root${editing ? " editing" : ""}`}
      onScroll={recomputeShowEdit}
    >
      <div
        ref={catalogRef}
        className={`home-catalog-wrap${editing ? " open" : ""}${overTrash ? " trash-active" : ""}`}
        aria-hidden={!editing}
      >
        <WidgetCatalog
          layout={layout}
          onChipPointerDown={(id, e) => gridRef.current?.startExternalAdd(id, e)}
        />
      </div>
      <GridCanvas
        ref={gridRef}
        layout={layout}
        editing={editing}
        data={data}
        onLayoutChange={update}
        onRemove={(id) =>
          update({ ...layout, widgets: layout.widgets.filter((w) => w.id !== id) })
        }
        onWidgetPropsChange={updateWidgetProps}
        trashRef={catalogRef}
        onTrashActive={setOverTrash}
      />
      <div className={`home-editbar${editing || showEdit ? " visible" : ""}`}>
        {editing && (
          <button
            className="home-fab home-fab-enter"
            onClick={() => update(DEFAULT_LAYOUT)}
            title="Restore default layout"
            aria-label="Restore default layout"
          >
            <span className="home-fab-spin">↺</span>
          </button>
        )}
        <button
          className={`home-fab${editing ? " active" : ""}`}
          onClick={() => void toggleEditing()}
          title={editing ? "Done editing" : "Edit layout"}
          aria-label={editing ? "Done editing" : "Edit layout"}
        >
          <span className="home-fab-ico ico-edit" aria-hidden="true">✎</span>
          <span className="home-fab-ico ico-done" aria-hidden="true">✓</span>
        </button>
      </div>
      {toast && <div className="home-toast" role="status">{toast}</div>}
    </div>
  );
}
