// Item renderers. Each renders the inside of one board item; positioning, selection and
// dragging live in BoardView. Text is always React text, never HTML.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MessageKey, Translate } from "../home/i18n";
import type { SandboxedFrameComponent } from "../sdk";
import { assetHtml, assetUrl, boardsApi, openAsset, type ActionResult } from "./api";
import type { LiveActionInfo, LiveActionRef } from "./live";
import { Cad, RichText, Sig, ago, dueLabel } from "./bits";
import { strokePath } from "./geometry";
import { inkGeometry } from "./ink";
import { Icon } from "./icons";
import { drawPreview, accentOf } from "./preview";
import { MiniBoard } from "./miniboard";
import { thumbUrl } from "./thumbs";
import { classifyUrl, hostOf, playerUrl } from "./urlKind";
import { LiveView } from "./LiveCard";
import { CompView } from "./CompCard";
import type { SyncHub } from "./syncClock";
import { VideoStage } from "./video";
import { embedDocument, type EmbedTheme } from "./embedBridge";
import { readTheme, useEmbedBridge } from "./useEmbedBridge";
import type { BoardDoc, Item, Op, TodoItem } from "./model";
import type { EditHint } from "./gesture";

export interface ItemCtx {
  doc: BoardDoc;
  t: Translate;
  editing: string | null;
  setEditing: (id: string | null) => void;
  /** Where editing started (double click point, typed character), for the item being edited. */
  hint: EditHint | null;
  update: (id: string, p: Record<string, unknown>) => void;
  commit: (ops: Op[]) => void;
  playing: string | null;
  setPlaying: (id: string | null) => void;
  Frame?: SandboxedFrameComponent;
  openBoard: (id: string) => void;
  renderKid: (id: string) => ReactNode;
  /** Stable React key for an item (optimistic ids are swapped for real ones under the same key). */
  keyOf: (id: string) => string;
  addToColumn: (col: string) => void;
  /** Live cards: the owner's action allowlist (null while loading) and the button handler
   *  (resolves null when the user cancels the confirm dialog). */
  liveActions: Record<string, LiveActionInfo> | null;
  /** The action list could not be read (an older backend still serving this page). */
  liveActionsDown: boolean;
  runLiveAction: (iid: string, ref: LiveActionRef, index: number) => Promise<ActionResult | null>;
  /** Custom components: this board's id, its sync hub (shared playheads) and the `hb.action` handler
   *  (resolves null when the user cancels the confirm dialog). */
  bid: string;
  sync: SyncHub;
  runCompAction: (iid: string, action: string, args: Record<string, unknown>) => Promise<ActionResult | null>;
  /** Draw strokes the eraser is over (hover preview) or has swept (while dragging). */
  erasing?: Set<string>;
}

function useAsset(aid: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (aid) assetUrl(aid).then((u) => live && setUrl(u), () => undefined);
    return () => { live = false; };
  }, [aid]);
  return url;
}

/** The hint that applies to one field of item `id`: caret / seed, and whether it takes focus.
 *  With no hint every field of an edited item mounts and the `dflt` one ends up focused. */
function fieldHint(c: ItemCtx, id: string, field: string, dflt = false): { caret?: number; seed?: string; focus: boolean } {
  const h = c.hint && c.hint.id === id ? c.hint : null;
  const mine = h?.field ? h.field === field : dflt;
  return { caret: mine ? h?.caret : undefined, seed: mine ? h?.seed : undefined, focus: mine };
}

/** A picture that also carries a small copy of itself: zoomed out, the board shows the copy
 *  (CSS, by level of detail), so painting 150 items never means decoding full-size photos. */
function Pic({ src, alt = "" }: { src: string; alt?: string }) {
  const [lo, setLo] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setLo(null);
    void thumbUrl(src).then((u) => { if (live) setLo(u); });
    return () => { live = false; };
  }, [src]);
  return (
    <>
      <img className={lo ? "full" : undefined} src={src} alt={alt} draggable={false} />
      {lo && <img className="lo" src={lo} alt="" draggable={false} />}
    </>
  );
}

/** Auto-growing textarea. Enter / Esc / click outside commit; Shift+Enter is a newline in the
 *  multi-line ones. `caret` (offset in `value`) puts the caret where the user double-clicked;
 *  `seed` is a character typed to start editing. `onDone` also says whether focus left the card. */
function EditText({ value, onDone, placeholder, className, single, caret, seed, focus = true, onEnter }: {
  value: string; onDone: (v: string, leaving: boolean) => void; placeholder?: string; className?: string; single?: boolean;
  caret?: number; seed?: string; focus?: boolean; onEnter?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [v, setV] = useState(seed ? value + seed : value);
  useEffect(() => {
    const el = ref.current;
    if (!el || !focus) return;
    el.focus({ preventScroll: true });
    const at = seed ? el.value.length : Math.max(0, Math.min(el.value.length, caret ?? el.value.length));
    el.setSelectionRange(at, at);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [v]);
  return (
    <textarea
      ref={ref}
      className={`edit${className ? ` ${className}` : ""}`}
      value={v}
      rows={1}
      placeholder={placeholder}
      data-nodrag=""
      onChange={(e) => setV(single ? e.target.value.replace(/\n/g, " ") : e.target.value)}
      onBlur={(e) => {
        const to = e.relatedTarget as HTMLElement | null;
        const card = e.currentTarget.closest("[data-iid], [data-kid]");
        onDone(v, !(to && card?.contains(to)));
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); return; }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (onEnter && !e.metaKey && !e.ctrlKey) onEnter();
          else (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}

function Meta({ item, t, extra }: { item: Item; t: Translate; extra?: ReactNode }) {
  const due = item.due ? dueLabel(t, item.due) : null;
  if (!item.tags?.length && !due && item.by !== "h" && !extra) return null;
  return (
    <div className="meta">
      {item.tags?.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
      {extra}
      <span className="sp" />
      {due && <span className={due.today ? "due" : undefined}>{due.text}</span>}
      {item.by === "h" && <Sig />}
    </div>
  );
}

// ── card ─────────────────────────────────────────────────────────────────

export function CardView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const editing = c.editing === id;
  const text = item.text ?? "";
  const quote = !item.title && text.length > 0 && text.length <= 160 && !text.includes("\n");
  if (editing) {
    const th = fieldHint(c, id, "title"), bh = fieldHint(c, id, "text", true);
    return (
      <div className={`hb-card hb-note${item.by === "h" ? " dm" : ""}`}>
        <h4><EditText single value={item.title ?? ""} placeholder={c.t("board.card.titlePh")} caret={th.caret} seed={th.seed} focus={th.focus}
          onEnter={() => (document.querySelector(`[data-iid="${id}"] .body textarea, [data-kid="${id}"] .body textarea`) as HTMLTextAreaElement | null)?.focus()}
          onDone={(v, leaving) => { if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null }); if (leaving) c.setEditing(null); }} /></h4>
        <div className="body"><EditText value={text} placeholder={c.t("board.card.textPh")} caret={bh.caret} seed={bh.seed} focus={bh.focus}
          onDone={(v, leaving) => { if (leaving) c.setEditing(null); if (v !== text) c.update(id, { text: v || null }); }} /></div>
      </div>
    );
  }
  return (
    <div className={`hb-card hb-note${quote ? " quote" : ""}${item.by === "h" ? " dm" : ""}`}>
      {item.title && <h4 data-field="title">{item.title}</h4>}
      {text ? <div className="body" data-field="text"><RichText text={text} /></div>
        : !item.title && <div className="body" style={{ opacity: 0.5 }}>{c.t("board.card.empty")}</div>}
      <Meta item={item} t={c.t} />
    </div>
  );
}

// ── to-do ────────────────────────────────────────────────────────────────

export function TodoView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const items = item.items ?? [];
  const done = items.filter((x) => x.done).length;
  const left = items.length - done;
  const [editRow, setEditRow] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const set = (next: TodoItem[]) => c.update(id, { items: next });
  const rowHint = c.hint && c.hint.id === id && c.hint.field?.startsWith("row:") ? c.hint : null;
  useEffect(() => {
    if (rowHint && c.editing === id) setEditRow(Number(rowHint.field!.slice(4)));
  }, [rowHint, c.editing, id]);
  return (
    <div className={`hb-card hb-todo${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 304 }}>
      {c.editing === id && !(c.hint?.id === id && c.hint.field?.startsWith("row:"))
        ? <div className="hd"><EditText single value={item.title ?? ""} caret={fieldHint(c, id, "title", true).caret} seed={fieldHint(c, id, "title", true).seed}
            onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} /></div>
        : <div className="hd"><span className="t" data-field="title">{item.title || c.t("board.todo.title")}</span><span className="n">{done}/{items.length}</span></div>}
      {items.length > 0 && items.length <= 40 && (
        <div className="cells">{items.map((x, i) => <i key={i} className={x.done ? "on" : undefined} />)}</div>
      )}
      {items.length > 0 && (
        <div className="sum">
          {left === 0 ? <b>{c.t("board.todo.allDone")}</b> : <b>{c.t("board.todo.left", { n: left })}</b>}
        </div>
      )}
      <ul>
        {items.map((x, i) => (
          <li key={i} className={x.done ? "x" : undefined}>
            <span className="box" role="checkbox" aria-checked={!!x.done} tabIndex={0} data-nodrag=""
              onClick={() => set(items.map((y, j) => (j === i ? { ...y, done: !y.done || undefined } : y)))}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); set(items.map((y, j) => (j === i ? { ...y, done: !y.done || undefined } : y))); } }} />
            {editRow === i
              ? <span className="l"><EditText single value={x.t} caret={rowHint?.field === `row:${i}` ? rowHint.caret : undefined} onDone={(v) => {
                  setEditRow(null);
                  if (c.editing === id) c.setEditing(null);
                  if (!v.trim()) set(items.filter((_, j) => j !== i));
                  else if (v !== x.t) set(items.map((y, j) => (j === i ? { ...y, t: v.trim() } : y)));
                }} /></span>
              : <span className="l" data-field={`row:${i}`}>{x.t}</span>}
            {x.due ? <span className={`side${dueLabel(c.t, x.due).today ? " due" : ""}`}>{dueLabel(c.t, x.due).text}</span>
              : x.by === "h" ? <span className="side sig"><Cad /></span> : null}
            <button className="rm" data-nodrag="" aria-label={c.t("board.todo.remove")}
              onClick={() => set(items.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
          </li>
        ))}
      </ul>
      <label className="addrow" data-nodrag="">
        <b><Icon name="plus" size={13} /></b>
        <input value={draft} placeholder={c.t("board.todo.add")} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && draft.trim()) { set([...items, { t: draft.trim() }]); setDraft(""); }
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }} />
      </label>
    </div>
  );
}

// ── column ───────────────────────────────────────────────────────────────

export function ColumnView({ id, item, c, dropIndex }: { id: string; item: Item; c: ItemCtx; dropIndex: number | null }) {
  const kids = item.kids ?? [];
  return (
    <div className="hb-col" style={item.w ? { width: item.w } : undefined}>
      {c.editing === id
        ? <div className="hd"><EditText single value={item.title ?? ""} caret={fieldHint(c, id, "title", true).caret} seed={fieldHint(c, id, "title", true).seed}
            onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} /></div>
        : <div className="hd"><span className="t" data-field="title">{item.title || c.t("board.col.title")}</span><span className="n">{kids.length}</span>{item.by === "h" && <span className="n sig"><Cad /></span>}</div>}
      <div className={`track${dropIndex != null ? " drop" : ""}`} data-col={id}>
        {kids.map((k, i) => (
          <div key={c.keyOf(k)} style={{ display: "contents" }}>
            {dropIndex === i && <div className="drop-line" />}
            {c.renderKid(k)}
          </div>
        ))}
        {dropIndex != null && dropIndex >= kids.length && <div className="drop-line" />}
      </div>
      <button className="add" data-nodrag="" onClick={() => c.addToColumn(id)}>
        <Icon name="plus" size={13} />{c.t("board.col.add")}
      </button>
    </div>
  );
}

// ── links and videos ─────────────────────────────────────────────────────

const PLAY = <svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0 10 6 0 12z" /></svg>;

export function VideoView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const poster = useAsset(item.video ? item.img : undefined);
  const playing = c.playing === id;
  const direct = item.k === "video" ? item.src : undefined;
  const asset = item.k === "video" ? item.asset : undefined;
  const player = item.video ? playerUrl(item.video) : null;
  const vert = !!item.video?.vert;
  const site = item.site || (item.url ? hostOf(item.url) : direct ? hostOf(direct) : asset ? c.t("board.video.uploaded") : "");
  const title = item.title || (direct ? direct.split("/").pop() : "") || c.t("board.video.untitled");
  return (
    <div className={`hb-card hb-video${vert ? " vert" : ""}${item.by === "h" ? " dm" : ""}`}>
      {player ? (
        <div className="stage">
          {playing && (
            <iframe src={player} title={title} data-nodrag=""
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          )}
          {!playing && (poster ? <Pic src={poster} /> : <div className="poster-empty">{site}</div>)}
          {!playing && <button className="play" data-nodrag="" onClick={() => c.setPlaying(id)}>{PLAY}{c.t("board.video.play")}</button>}
        </div>
      ) : (
        <VideoStage playId={id} c={c} src={direct} asset={asset} posterAsset={item.img} dur={item.dur} title={title} syncGroup={item.sync} />
      )}
      <div className="hb-link"><div className="body">
        <div className="dom"><span>{site}</span></div>
        {c.editing === id
          ? <h4><EditText single value={item.title ?? ""} placeholder={title} caret={fieldHint(c, id, "title", true).caret} seed={fieldHint(c, id, "title", true).seed}
              onDone={(v) => { c.setEditing(null); if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null }); }} /></h4>
          : <h4 data-field="title">{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" draggable={false}>{title}</a> : title}</h4>}
        {item.desc && <p>{item.desc}</p>}
        {item.by === "h" && <div className="meta" style={{ marginTop: 9 }}><span className="sp" /><Sig /></div>}
      </div></div>
    </div>
  );
}

export function LinkView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const thumb = useAsset(item.img);
  const icon = useAsset(item.icon);
  if (item.video) return <VideoView id={id} item={item} c={c} />;
  const waiting = item.st === "wait";
  const failed = item.st === "fail";
  const site = item.site || (item.url ? hostOf(item.url) : "");
  return (
    <div className={`hb-card hb-link${item.by === "h" ? " dm" : ""}`}>
      {(thumb || waiting) && <div className={`thumb${waiting ? " skel-thumb" : ""}`}>{thumb && <Pic src={thumb} />}</div>}
      <div className="body">
        <div className="dom">{icon && <img src={icon} alt="" />}<span>{item.url ? hostOf(item.url) : site}</span></div>
        {waiting ? (
          <div className="skel"><i /><i /><i /></div>
        ) : (
          <>
            {c.editing === id
              ? <h4><EditText single value={item.title ?? ""} placeholder={failed ? site : item.url} caret={fieldHint(c, id, "title", true).caret} seed={fieldHint(c, id, "title", true).seed}
                  onDone={(v) => { c.setEditing(null); if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null }); }} /></h4>
              : <h4 data-field="title"><a href={item.url} target="_blank" rel="noopener noreferrer" draggable={false}>
                  {item.title || (failed ? site : item.url)}
                </a></h4>}
            {item.desc && <p>{item.desc}</p>}
            {(failed || !item.title) && item.url && <div className="url">{item.url}</div>}
          </>
        )}
        {item.by === "h" && <div className="meta" style={{ marginTop: 9 }}><span className="sp" /><Sig /></div>}
      </div>
    </div>
  );
}

// ── image ────────────────────────────────────────────────────────────────

const FILE_LABEL: Record<string, string> = { pdf: "PDF", stl: "STL", obj: "OBJ", "3mf": "3MF" };

export function ImageView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const url = useAsset(item.asset);
  const ratio = item.iw && item.ih ? item.ih / item.iw : 0.6;
  const fk = item.file ? item.fk ?? "pdf" : null;
  const isPdf = fk === "pdf";
  const [busy, setBusy] = useState(false);
  const getFile = () => {
    if (!item.file || busy) return;
    setBusy(true);
    openAsset(item.file, item.cap || "model").catch(() => undefined).finally(() => setBusy(false));
  };
  return (
    <div className={`hb-card hb-image${fk ? " has-file" : ""}${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 372 }}>
      <div className="art" style={!url ? { aspectRatio: `${1 / ratio}` } : undefined}>
        {url ? <Pic src={url} alt={item.cap ?? ""} />
          : fk && <span className="file-ph"><Icon name={isPdf ? "fileDoc" : "model3d"} size={34} /></span>}
        {fk && <span className="fbadge">{FILE_LABEL[fk]}{isPdf && item.pg ? ` · ${c.t("board.file.pages", { n: item.pg })}` : ""}</span>}
      </div>
      <div className="cap">
        {c.editing === id
          ? <b style={{ flex: 1 }}><EditText single value={item.cap ?? ""} placeholder={c.t("board.image.capPh")} caret={fieldHint(c, id, "cap", true).caret}
              onDone={(v) => { c.setEditing(null); c.update(id, { cap: v.trim() || null }); }} /></b>
          : <b data-field="cap">{item.cap || (item.url ? hostOf(item.url) : "")}</b>}
        {fk && <button className="kbtn" data-nodrag="" data-tip={c.t(isPdf ? "board.file.open" : "board.file.download")}
          aria-label={c.t(isPdf ? "board.file.open" : "board.file.download")} disabled={busy} onClick={getFile}><Icon name={isPdf ? "fileOpen" : "fileGet"} size={13} /></button>}
        {item.by === "h" && <Sig />}
      </div>
    </div>
  );
}

// ── embed: sandboxed HTML ────────────────────────────────────────────────

function toDataUrl(html: string): string {
  const bytes = new TextEncoder().encode(html);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:text/html;charset=utf-8;base64,${btoa(bin)}`;
}

export function EmbedView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const [html, setHtml] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [tall, setTall] = useState(false);
  const [base, setBase] = useState<EmbedTheme | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const themed = item.theme === true;
  useEffect(() => {
    let live = true;
    if (item.asset) assetHtml(item.asset).then((h) => live && setHtml(h), () => live && setHtml(""));
    return () => { live = false; };
  }, [item.asset]);
  // The look is read once, before the frame exists, so the document never reloads for a theme
  // change; later changes reach the page through the bridge.
  useLayoutEffect(() => { if (themed && !base && box.current) setBase(readTheme(box.current)); }, [themed, base]);
  const doc = useMemo(() => (html == null ? null : embedDocument(html, themed, base)), [html, themed, base]);
  // An iframe whose page declares a colour scheme the embedder lacks gets an opaque canvas; matching
  // it on the element keeps the card showing through.
  const [scheme, setScheme] = useState<string | undefined>(undefined);
  useEmbedBridge(box, doc != null, themed, `${nonce}`, (t) => setScheme(t.scheme));
  const Frame = c.Frame;
  const active = c.playing === id;
  const height = tall ? 520 : (item.h ? Math.max(120, item.h - 80) : 240);
  const frameStyle = { height, ...(themed ? { colorScheme: scheme ?? base?.scheme } : {}) };
  const waiting = doc == null || (themed && !base);
  return (
    <div className={`hb-card hb-embed${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 452 }}>
      <div className="bar-e">
        <span className="file">{item.title || c.t("board.embed.title")}</span>
        <span className="sb">{c.t("board.embed.sandbox")}</span>
        <span className="tools">
          <button className={`kbtn${themed ? " on" : ""}`} data-nodrag="" data-tip={c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn")} aria-label={c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn")} aria-pressed={themed}
            onClick={() => c.update(id, { theme: themed ? null : true })}><Icon name="theme" size={13} /></button>
          <button className="kbtn" data-nodrag="" data-tip={c.t("board.embed.reload")} aria-label={c.t("board.embed.reload")} onClick={() => setNonce((n) => n + 1)}><Icon name="reload" size={13} /></button>
          <button className="kbtn" data-nodrag="" data-tip={c.t("board.embed.taller")} aria-label={c.t("board.embed.taller")} onClick={() => setTall((v) => !v)}><Icon name="taller" size={13} /></button>
        </span>
      </div>
      <div ref={box} data-nodrag="" style={{ height, position: "relative" }}>
        {/* Until it's clicked, a shield keeps the wheel and drags on the board (an iframe eats
            them); clicking hands it the pointer, clicking elsewhere takes it back. */}
        {!active && <button className="shield" aria-label={c.t("board.embed.activate")} onClick={() => c.setPlaying(id)}>
          <span>{c.t("board.embed.activate")}</span></button>}
        {waiting ? <div className="frame" style={{ height }} /> : Frame
          ? <Frame key={`${nonce}${themed}`} src={toDataUrl(doc)} title={item.title || "embed"} className={themed ? "frame themed" : "frame"} style={frameStyle} />
          : <iframe key={`${nonce}${themed}`} className={themed ? "frame themed" : "frame"} style={frameStyle} sandbox="allow-scripts" srcDoc={doc}
              title={item.title || "embed"} referrerPolicy="no-referrer" />}
      </div>
      <div className="foot meta"><span>{c.t("board.embed.live")}</span><span className="sp" />{item.by === "h" && <Sig />}</div>
    </div>
  );
}

// ── nested board ─────────────────────────────────────────────────────────

const childCache = new Map<string, Promise<BoardDoc | null>>();
export const CHILD_POLL_MS = 5000;

export function loadBoardDoc(bid: string, fresh = false): Promise<BoardDoc | null> {
  let p = fresh ? undefined : childCache.get(bid);
  if (!p) {
    p = boardsApi.since(bid, -1).then((r) => r.doc ?? null, () => null);
    childCache.set(bid, p);
  }
  return p;
}

export function BoardPreview({ doc, className }: { doc: BoardDoc | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => drawPreview(el, doc, { accent: accentOf(el), cell: 5 });
    draw();
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const ro = RO ? new RO(draw) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [doc]);
  return <canvas ref={ref} className={className} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

export function BoardRefView({ item, c }: { item: Item; c: ItemCtx }) {
  const [child, setChild] = useState<BoardDoc | null>(null);
  // The preview follows the child: it used to load once on mount, so a card kept saying "0 cards"
  // while the sub-board grew. Poll the cheap `since` call and refetch only when something changed.
  useEffect(() => {
    if (!item.ref) return;
    const ref = item.ref;
    let live = true;
    let seq = -1;
    const load = () => loadBoardDoc(ref, true).then((d) => { if (live) { seq = d?.seq ?? -1; setChild(d); } });
    void load();
    const check = async () => {
      if (document.hidden || seq < 0) return;
      try {
        const r = await boardsApi.since(ref, seq);
        if (live && (r.entries?.length || r.doc)) await load();
      } catch { /* keep the last preview */ }
    };
    const i = window.setInterval(check, CHILD_POLL_MS);
    const onVis = () => { void check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      live = false;
      window.clearInterval(i);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [item.ref]);
  const count = child ? Object.values(child.items).filter((x) => x.k !== "line").length : 0;
  return (
    <div className={`hb-card hb-boardref${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 212 }}
      onDoubleClick={(e) => { e.stopPropagation(); if (item.ref) c.openBoard(item.ref); }}>
      <div className="pv"><MiniBoard doc={child} id={item.ref} /></div>
      <div className="ttl">
        <b data-tip={child?.name ?? item.title ?? undefined}>{child?.name ?? item.title ?? c.t("board.ref.missing")}</b>
        <span><button data-nodrag="" data-tip={c.t("board.index.open")} aria-label={c.t("board.index.open")} onClick={() => item.ref && c.openBoard(item.ref)}><Icon name="openBoard" size={13} /></button></span>
      </div>
      <div className="meta"><span>{c.t("board.ref.meta", { n: count, when: ago(c.t, child?.updated) })}</span></div>
    </div>
  );
}

// ── frame, box, text, freehand ───────────────────────────────────────────

export function FrameView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  return (
    <div className={`hb-frame${item.by === "h" ? " dm soft" : ""}`}>
      {item.by !== "h" && <><i /><i /><i /><i /></>}
      <span className="lbl">
        {item.by === "h" && <Cad />}
        <span className="t">{c.editing === id
          ? <EditText single value={item.title ?? ""} caret={fieldHint(c, id, "title", true).caret} seed={fieldHint(c, id, "title", true).seed}
              onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} />
          : <span data-field="title">{item.title || c.t("board.frame.title")}</span>}</span>
        {item.note && <em>{item.note}</em>}
      </span>
    </div>
  );
}

export function BoxView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  return (
    <div className="hb-box">
      {item.num && <span className="num">{item.num}</span>}
      <span style={{ minWidth: 0 }}>
        {c.editing === id
          ? <b><EditText single value={item.title ?? ""} caret={fieldHint(c, id, "title", true).caret} seed={fieldHint(c, id, "title", true).seed}
              onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} /></b>
          : <b data-field="title">{item.title || "…"}</b>}
        {item.sub && <small>{item.sub}</small>}
      </span>
    </div>
  );
}

export function TextView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const size = item.size === "h" || item.size === "s" ? item.size : "p";
  if (c.editing === id) {
    const h = fieldHint(c, id, "text", true);
    return <div className={`hb-text ${size}`}><EditText single={size === "h"} value={item.text ?? ""} caret={h.caret} seed={h.seed}
      onDone={(v) => { c.setEditing(null); c.update(id, { text: v || null }); }} /></div>;
  }
  return <div className={`hb-text ${size}`} data-field="text">{item.text || c.t("board.text.empty")}</div>;
}

const SHAPE_DEFAULT: Record<string, [number, number]> = { rect: [160, 56], diamond: [150, 100], pill: [150, 48], circle: [72, 72] };

/** Outline path of a flowchart shape in an exactly w × h box (px, so the stroke never distorts). */
export function shapeOutline(sh: string, w: number, h: number): string {
  const x0 = 0.75, y0 = 0.75, x1 = w - 0.75, y1 = h - 0.75, mx = w / 2, my = h / 2;
  if (sh === "diamond") return `M${mx} ${y0} L${x1} ${my} L${mx} ${y1} L${x0} ${my}Z`;
  if (sh === "circle") return `M${x0} ${my} A${mx - 0.75} ${my - 0.75} 0 1 0 ${x1} ${my} A${mx - 0.75} ${my - 0.75} 0 1 0 ${x0} ${my}Z`;
  const r = sh === "pill" ? Math.min(mx, my) - 0.75 : 5;
  return `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}

export function ShapeView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const sh = item.sh ?? "rect";
  const [dw, dh] = SHAPE_DEFAULT[sh] ?? SHAPE_DEFAULT.rect;
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: item.w ?? dw, h: item.h ?? dh });
  useEffect(() => {
    const el = ref.current;
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!el || !RO) return;
    const ro = new RO(() => setBox((b) => (b.w === el.offsetWidth && b.h === el.offsetHeight ? b : { w: el.offsetWidth || b.w, h: el.offsetHeight || b.h })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const hint = fieldHint(c, id, "title", true);
  return (
    <div ref={ref} className={`hb-shape ${sh}${item.by === "h" ? " by-h" : ""}`}>
      <svg className="o" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
        <path d={shapeOutline(sh, box.w, box.h)} />
      </svg>
      <span className="t">
        {c.editing === id
          ? <EditText value={item.title ?? ""} placeholder={c.t("board.shape.ph")} caret={hint.caret} seed={hint.seed}
              onDone={(v) => { c.setEditing(null); if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null }); }} />
          : <span data-field="title">{item.title || ""}</span>}
      </span>
    </div>
  );
}

export function DrawView({ item, selected, erasing }: { item: Item; selected: boolean; erasing?: boolean }) {
  const geo = inkGeometry(item, strokePath);
  if (!geo) return null;
  const { box } = geo;
  const sw = item.sw ?? 1.9;
  const cls = `hb-draw${selected ? " sel" : ""}${erasing ? " erasing" : ""}${item.tl === "hl" ? " hl" : ""}${item.c ? ` c-${item.c}` : ""}`;
  return (
    <svg className={cls} width={box.w} height={box.h} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      style={{ position: "absolute", left: box.x, top: box.y }}>
      {geo.paths.map((p, i) => (
        <path key={i} d={p.d} className={p.fill ? "fill" : undefined} strokeWidth={p.fill ? undefined : sw}
          strokeDasharray={p.dashed ? `${Math.max(4, sw * 3)} ${Math.max(4, sw * 2.4)}` : undefined} />
      ))}
    </svg>
  );
}

const MARK_ICON = { ok: "markOk", fail: "markFail", wait: "markWait" } as const;

/** Status stamp (ok / fail / wait) on the corner of any card-like item. */
export function Mark({ mark, t }: { mark: NonNullable<Item["mark"]>; t: ItemCtx["t"] }) {
  return <i className={`hb-mark ${mark}`} role="img" aria-label={t(`board.mark.${mark}` as MessageKey)} data-tip={t(`board.mark.${mark}` as MessageKey)}><Icon name={MARK_ICON[mark]} size={11} /></i>;
}

/** Picks the renderer for an item. */
export function ItemBody(props: {
  id: string; item: Item; c: ItemCtx; dropIndex: number | null; selected: boolean;
}) {
  const mark = props.item.mark;
  if (!mark || props.item.k === "line" || props.item.k === "draw" || props.item.k === "frame") return <ItemKind {...props} />;
  return <><ItemKind {...props} /><Mark mark={mark} t={props.c.t} /></>;
}

function ItemKind({ id, item, c, dropIndex, selected }: {
  id: string; item: Item; c: ItemCtx; dropIndex: number | null; selected: boolean;
}) {
  switch (item.k) {
    case "card": return <CardView id={id} item={item} c={c} />;
    case "todo": return <TodoView id={id} item={item} c={c} />;
    case "col": return <ColumnView id={id} item={item} c={c} dropIndex={dropIndex} />;
    case "link": return <LinkView id={id} item={item} c={c} />;
    case "video": return <VideoView id={id} item={item} c={c} />;
    case "image": return <ImageView id={id} item={item} c={c} />;
    case "embed": return <EmbedView id={id} item={item} c={c} />;
    case "board": return <BoardRefView item={item} c={c} />;
    case "shape": return <ShapeView id={id} item={item} c={c} />;
    case "frame": return <FrameView id={id} item={item} c={c} />;
    case "box": return <BoxView id={id} item={item} c={c} />;
    case "text": return <TextView id={id} item={item} c={c} />;
    case "draw": return <DrawView item={item} selected={selected} erasing={c.erasing?.has(id)} />;
    case "live": return <LiveView id={id} item={item} c={c} />;
    case "comp": return <CompView id={id} item={item} c={c} />;
    default: return null;
  }
}

/** Kind of item a pasted URL should become, with the fields known before the preview. */
export function itemForUrl(url: string): Item | null {
  const k = classifyUrl(url);
  if (!k) return null;
  if (k.kind === "image") return { k: "image", url };
  if (k.kind === "file-video") return { k: "video", src: url, w: 400 };
  if (k.kind === "video") {
    const video = k.vert ? { p: k.p, id: k.id, vert: true as const } : { p: k.p, id: k.id };
    return { k: "link", url, video, w: k.vert ? 260 : 400 };
  }
  return { k: "link", url };
}
