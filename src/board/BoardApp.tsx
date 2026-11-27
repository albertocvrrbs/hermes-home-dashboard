// Board surfaces: the full page (index or one board) and the Home widget.
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../home/i18n";
import { HoverArrows } from "../home/widgets/HoverArrows";
import { openBoard, readBoardRoute } from "../sdk";
import { boardsApi, type BoardRow } from "./api";
import { Cad, ago } from "./bits";
import { BoardView } from "./BoardView";
import { BoardPreview, loadBoardDoc } from "./items";
import type { BoardDoc } from "./model";
import { HERMES_ACTIVE_S } from "./useBoard";

// ── route state shared by every board surface ──────────────────────────────

const routeListeners = new Set<() => void>();
export function notifyBoardRoute(): void {
  routeListeners.forEach((l) => l());
}

export function currentBoardRoute(): string | null | undefined {
  return readBoardRoute(window.location);
}

/** Follows the board route: hash changes, history pushes (HashRouter fires no
 *  hashchange) and our own navigations. */
export function useBoardRoute(): string | null | undefined {
  const [route, setRoute] = useState(currentBoardRoute);
  useEffect(() => {
    const check = () => setRoute(currentBoardRoute());
    routeListeners.add(check);
    window.addEventListener("hashchange", check);
    window.addEventListener("popstate", check);
    const i = window.setInterval(check, 700);
    return () => {
      routeListeners.delete(check);
      window.removeEventListener("hashchange", check);
      window.removeEventListener("popstate", check);
      window.clearInterval(i);
    };
  }, []);
  return route;
}

export function goBoard(id: string | null): void {
  openBoard(id);
  window.setTimeout(notifyBoardRoute, 0);
}

// ── index ───────────────────────────────────────────────────────────────────

function BoardCard({ row, onOpen, onDelete }: { row: BoardRow; onOpen: () => void; onDelete: () => void }) {
  const t = useT();
  const [doc, setDoc] = useState<BoardDoc | null>(null);
  useEffect(() => {
    let live = true;
    loadBoardDoc(row.id, true).then((d) => live && setDoc(d));
    return () => { live = false; };
  }, [row.id, row.seq]);
  return (
    <div className="hb-card hb-boardref" role="link" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}>
      <div className="pv"><BoardPreview doc={doc} /></div>
      <div className="ttl"><b>{row.name}</b><span>{t("board.ref.open")} ↗</span></div>
      <div className="meta">
        <span>{t("board.ref.meta", { n: row.count, when: ago(t, row.updated) })}</span>
        <span className="sp" />
        {row.session && <span className="sig"><Cad /></span>}
        <button className="del" onClick={(e) => { e.stopPropagation(); onDelete(); }}>{t("board.index.delete")}</button>
      </div>
    </div>
  );
}

export function BoardsIndex({ onHome }: { onHome: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    boardsApi.list().then((r) => { setRows(r); setError(null); }, (e) => setError(String(e?.message ?? e)));
  }, []);
  useEffect(() => { load(); }, [load]);
  const create = async () => {
    const doc = await boardsApi.create(t("board.untitled"));
    goBoard(doc.id);
  };
  const top = rows?.filter((r) => !r.parent) ?? [];
  return (
    <div className="hb">
      <header className="hb-top">
        <nav className="hb-path">
          <span className="mark"><Cad /></span>
          <button onClick={onHome}>{t("board.path.home")}</button><span className="sl">/</span>
        </nav>
        <span className="hb-btitle">{t("board.index.title")}</span>
        <span className="spacer" />
        <button className="btn primary" onClick={() => void create()}>{t("board.index.new")}</button>
      </header>
      <div className="hb-index">
        <div className="hd">{t("board.index.title")}<span className="n">{top.length}</span></div>
        <p className="lead">{t("board.index.lead")}</p>
        {error && <p className="lead">{error}</p>}
        <div className="grid">
          <button className="new" onClick={() => void create()}>
            <b>+</b>{t("board.index.new")}<small>{t("board.index.newHint")}</small>
          </button>
          {top.map((r) => (
            <BoardCard key={r.id} row={r} onOpen={() => goBoard(r.id)}
              onDelete={() => { if (window.confirm(t("board.index.confirmDelete", { name: r.name }))) void boardsApi.remove(r.id).then(load); }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── full page ───────────────────────────────────────────────────────────────

export function BoardApp({ route, onHome }: { route: string | null; onHome: () => void }) {
  if (route) return <BoardView key={route} bid={route} onOpenBoard={goBoard} onHome={onHome} />;
  return <BoardsIndex onHome={onHome} />;
}

// ── Home widget: live preview of one board ─────────────────────────────────

export function BoardWidget({ widgetProps, onWidgetPropsChange, editing }: {
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
  editing: boolean;
}) {
  const t = useT();
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [doc, setDoc] = useState<BoardDoc | null>(null);
  const seq = useRef(-1);
  const pinned = typeof widgetProps.board === "string" ? widgetProps.board : null;
  const bid = pinned && rows?.some((r) => r.id === pinned) ? pinned : rows?.find((r) => !r.parent)?.id ?? null;

  useEffect(() => {
    let live = true;
    const load = () => boardsApi.list().then((r) => live && setRows(r), () => live && setRows((x) => x ?? []));
    load();
    const i = window.setInterval(load, 30000);
    return () => { live = false; window.clearInterval(i); };
  }, []);

  useEffect(() => {
    if (!bid) { setDoc(null); return; }
    let live = true;
    seq.current = -1;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const r = await boardsApi.since(bid, seq.current >= 0 ? seq.current : -1);
        if (!live) return;
        if (r.doc) { seq.current = r.doc.seq; setDoc(r.doc); }
        else if (r.entries?.length) {
          const full = await boardsApi.since(bid, -1);
          if (live && full.doc) { seq.current = full.doc.seq; setDoc(full.doc); }
        } else if (r.hermes) {
          setDoc((d) => (d && d.hermes?.at !== r.hermes!.at ? { ...d, hermes: r.hermes } : d));
        }
      } catch {
        // keep the last preview
      }
    };
    void poll();
    const i = window.setInterval(poll, 10000);
    return () => { live = false; window.clearInterval(i); };
  }, [bid]);

  const cycle = (dir: 1 | -1) => {
    const list = (rows ?? []).filter((r) => !r.parent);
    if (list.length < 2 || !bid) return;
    const i = list.findIndex((r) => r.id === bid);
    onWidgetPropsChange({ ...widgetProps, board: list[(i + dir + list.length) % list.length].id });
  };

  if (rows && !rows.length) {
    return (
      <div className="hb-widget" onClick={(e) => {
        e.stopPropagation();
        if (editing) return;
        void boardsApi.create(t("board.untitled")).then((d) => goBoard(d.id));
      }}>
        <div className="empty"><span>{t("board.widget.empty")}<br /><b>{t("board.index.new")} ↗</b></span></div>
      </div>
    );
  }
  const active = doc?.hermes && Date.now() / 1000 - doc.hermes.at < HERMES_ACTIVE_S;
  const count = doc ? Object.values(doc.items).filter((x) => x.k !== "line").length : 0;
  const list = (rows ?? []).filter((r) => !r.parent);
  return (
    <div className="hb-widget" onClick={(e) => { e.stopPropagation(); if (!editing && bid) goBoard(bid); }}>
      <div className="pvw"><BoardPreview doc={doc} /></div>
      <div className="foot">
        <b>{doc?.name ?? "…"}</b>
        {active
          ? <span className="tagh"><Cad size={[7, 9]} />HERMES</span>
          : <span>{t("board.ref.meta", { n: count, when: ago(t, doc?.updated) })}</span>}
      </div>
      {list.length > 1 && <HoverArrows onPrev={() => cycle(-1)} onNext={() => cycle(1)} />}
    </div>
  );
}
