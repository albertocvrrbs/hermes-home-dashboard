// The component gallery: the user's library as live thumbnails (each one runs the component in its
// own sandboxed frame with its sample data), opened from the board toolbar or the right-click menu.
// Picking one puts a component card on the board.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "../home/i18n";
import { boardsApi, type CompDoc, type CompRow } from "./api";
import { componentDocument, type HbInit } from "./componentBridge";
import type { EmbedTheme } from "./embedBridge";
import { Icon } from "./icons";
import { readTheme, useEmbedBridge } from "./useEmbedBridge";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const THUMB_W = 480, THUMB_H = 320, SHOW_W = 196;

function Thumb({ row, base }: { row: CompRow; base: EmbedTheme }) {
  const [doc, setDoc] = useState<CompDoc | null | "fail">(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    boardsApi.component(row.name).then((d) => live && setDoc(d), () => live && setDoc("fail"));
    return () => { live = false; };
  }, [row.name, row.current]);
  const html = useMemo(() => {
    if (!doc || doc === "fail") return null;
    const init: HbInit = {
      component: { name: row.name, version: doc.version }, assets: {}, actions: [],
      data: doc.sample && typeof doc.sample === "object" ? doc.sample as Record<string, unknown> : {},
      clock: { t: 0, playing: false, rate: 1, duration: 0, group: null, manual: false, master: false }, preview: true,
    };
    return componentDocument(doc.html, true, base, init);
  }, [doc, base, row.name]);
  useEmbedBridge(box, html != null, true, row.current);
  return (
    <div className="gal-thumb" aria-hidden="true">
      <div className="gal-scale" ref={box} style={{ width: THUMB_W, height: THUMB_H, transform: `scale(${SHOW_W / THUMB_W})` }}>
        {html != null && <iframe className="frame themed" sandbox="allow-scripts" srcDoc={html} title={row.title} tabIndex={-1} referrerPolicy="no-referrer" />}
      </div>
      {doc === "fail" && <span className="gal-nofile"><Icon name="alert" size={16} /></span>}
    </div>
  );
}

export function CompGallery({ t, onPick, onClose }: { t: T; onPick: (name: string, title: string) => void; onClose: () => void }) {
  const [rows, setRows] = useState<CompRow[] | null>(null);
  const [down, setDown] = useState(false);
  const [base, setBase] = useState<EmbedTheme | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    boardsApi.components().then((r) => live && setRows(r), () => live && (setRows([]), setDown(true)));
    return () => { live = false; };
  }, []);
  useLayoutEffect(() => { if (!base && root.current) setBase(readTheme(root.current)); }, [base, rows]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  return (
    <div className="hb-gallery" ref={root} role="dialog" aria-label={t("board.comp.gallery")} data-nodrag="">
      <div className="gal-hd"><Icon name="components" size={13} /><span>{t("board.comp.gallery")}</span>
        <button className="kbtn" aria-label={t("board.comp.close")} onClick={onClose}><Icon name="close" size={13} /></button></div>
      {rows === null && <div className="gal-empty">{t("common.loading")}</div>}
      {rows && rows.length === 0 && (
        <div className="gal-empty"><b>{down ? t("board.comp.downTitle") : t("board.comp.emptyTitle")}</b>
          <span>{down ? t("board.comp.downBody") : t("board.comp.emptyBody")}</span></div>
      )}
      {rows && rows.length > 0 && (
        <div className="gal-grid">
          {rows.slice(0, 24).map((r) => (
            <button key={r.name} className="gal-tile" onClick={() => onPick(r.name, r.title === r.name ? "" : r.title)}>
              {base ? <Thumb row={r} base={base} /> : <div className="gal-thumb" />}
              <b>{r.title}</b>
              <small>{r.name} · {r.current}{r.desc ? ` · ${r.desc}` : ""}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
