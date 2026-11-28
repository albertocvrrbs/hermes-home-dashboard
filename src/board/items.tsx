// Item renderers. Each renders the inside of one board item; positioning, selection and
// dragging live in BoardView. Text is always React text, never HTML.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Translate } from "../home/i18n";
import type { SandboxedFrameComponent } from "../sdk";
import { assetHtml, assetUrl, boardsApi, type ActionResult } from "./api";
import type { LiveActionInfo, LiveActionRef } from "./live";
import { Cad, RichText, Sig, ago, dueLabel } from "./bits";
import { strokePath } from "./geometry";
import { inkGeometry } from "./ink";
import { Icon } from "./icons";
import { drawPreview, accentOf } from "./preview";
import { classifyUrl, hostOf, playerUrl } from "./urlKind";
import { LiveView } from "./LiveCard";
import { VideoStage } from "./video";
import type { BoardDoc, Item, Op, TodoItem } from "./model";

export interface ItemCtx {
  doc: BoardDoc;
  t: Translate;
  editing: string | null;
  setEditing: (id: string | null) => void;
  update: (id: string, p: Record<string, unknown>) => void;
  commit: (ops: Op[]) => void;
  playing: string | null;
  setPlaying: (id: string | null) => void;
  Frame?: SandboxedFrameComponent;
  openBoard: (id: string) => void;
  renderKid: (id: string) => ReactNode;
  addToColumn: (col: string) => void;
  /** Live cards: the owner's action allowlist (null while loading) and the button handler
   *  (resolves null when the user cancels the confirm dialog). */
  liveActions: Record<string, LiveActionInfo> | null;
  /** The action list could not be read (an older backend still serving this page). */
  liveActionsDown: boolean;
  runLiveAction: (iid: string, ref: LiveActionRef, index: number) => Promise<ActionResult | null>;
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

/** Auto-growing textarea that commits on blur / Escape / ⌘Enter. */
function EditText({ value, onDone, placeholder, className, single }: {
  value: string; onDone: (v: string) => void; placeholder?: string; className?: string; single?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [v, setV] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
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
      onBlur={() => onDone(v)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey || single))) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
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
    return (
      <div className={`hb-card hb-note${item.by === "h" ? " dm" : ""}`}>
        <h4><EditText single value={item.title ?? ""} placeholder={c.t("board.card.titlePh")}
          onDone={(v) => { if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null }); }} /></h4>
        <div className="body"><EditText value={text} placeholder={c.t("board.card.textPh")}
          onDone={(v) => { c.setEditing(null); if (v !== text) c.update(id, { text: v || null }); }} /></div>
      </div>
    );
  }
  return (
    <div className={`hb-card hb-note${quote ? " quote" : ""}${item.by === "h" ? " dm" : ""}`}>
      {item.title && <h4>{item.title}</h4>}
      {text ? <div className="body"><RichText text={text} /></div>
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
  return (
    <div className={`hb-card hb-todo${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 304 }}>
      {c.editing === id
        ? <div className="hd"><EditText single value={item.title ?? ""} onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} /></div>
        : <div className="hd">{item.title || c.t("board.todo.title")}<span className="n">{done}/{items.length}</span></div>}
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
              ? <span className="l"><EditText single value={x.t} onDone={(v) => {
                  setEditRow(null);
                  if (!v.trim()) set(items.filter((_, j) => j !== i));
                  else if (v !== x.t) set(items.map((y, j) => (j === i ? { ...y, t: v.trim() } : y)));
                }} /></span>
              : <span className="l" onDoubleClick={(e) => { e.stopPropagation(); setEditRow(i); }}>{x.t}</span>}
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
        ? <div className="hd"><EditText single value={item.title ?? ""} onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} /></div>
        : <div className="hd">{item.title || c.t("board.col.title")}<span className="n">{kids.length}</span>{item.by === "h" && <span className="n sig"><Cad /></span>}</div>}
      <div className={`track${dropIndex != null ? " drop" : ""}`} data-col={id}>
        {kids.map((k, i) => (
          <div key={k} style={{ display: "contents" }}>
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
          {!playing && (poster ? <img src={poster} alt="" draggable={false} /> : <div className="poster-empty">{site}</div>)}
          {!playing && <button className="play" data-nodrag="" onClick={() => c.setPlaying(id)}>{PLAY}{c.t("board.video.play")}</button>}
        </div>
      ) : (
        <VideoStage playId={id} c={c} src={direct} asset={asset} posterAsset={item.img} dur={item.dur} title={title} />
      )}
      <div className="hb-link"><div className="body">
        <div className="dom"><span>{site}</span></div>
        <h4>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" data-nodrag="">{title}</a> : title}</h4>
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
      {(thumb || waiting) && <div className={`thumb${waiting ? " skel-thumb" : ""}`}>{thumb && <img src={thumb} alt="" draggable={false} />}</div>}
      <div className="body">
        <div className="dom">{icon && <img src={icon} alt="" />}<span>{item.url ? hostOf(item.url) : site}</span></div>
        {waiting ? (
          <div className="skel"><i /><i /><i /></div>
        ) : (
          <>
            <h4><a href={item.url} target="_blank" rel="noopener noreferrer" data-nodrag="">
              {item.title || (failed ? site : item.url)}
            </a></h4>
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

export function ImageView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const url = useAsset(item.asset);
  const ratio = item.iw && item.ih ? item.ih / item.iw : 0.6;
  return (
    <div className={`hb-card hb-image${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 372 }}>
      <div className="art" style={!url ? { aspectRatio: `${1 / ratio}` } : undefined}>
        {url && <img src={url} alt={item.cap ?? ""} draggable={false} />}
      </div>
      <div className="cap">
        {c.editing === id
          ? <b style={{ flex: 1 }}><EditText single value={item.cap ?? ""} placeholder={c.t("board.image.capPh")}
              onDone={(v) => { c.setEditing(null); c.update(id, { cap: v.trim() || null }); }} /></b>
          : <b>{item.cap || (item.url ? hostOf(item.url) : "")}</b>}
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
  useEffect(() => {
    let live = true;
    if (item.asset) assetHtml(item.asset).then((h) => live && setHtml(h), () => live && setHtml(""));
    return () => { live = false; };
  }, [item.asset]);
  const Frame = c.Frame;
  const active = c.playing === id;
  const height = tall ? 520 : (item.h ? Math.max(120, item.h - 80) : 240);
  return (
    <div className={`hb-card hb-embed${item.by === "h" ? " dm" : ""}`} style={{ width: item.w ?? 452 }}>
      <div className="bar-e">
        <span className="file">{item.title || c.t("board.embed.title")}</span>
        <span className="sb">{c.t("board.embed.sandbox")}</span>
        <span className="tools">
          <button className="kbtn" data-nodrag="" data-tip={c.t("board.embed.reload")} aria-label={c.t("board.embed.reload")} onClick={() => setNonce((n) => n + 1)}><Icon name="reload" size={13} /></button>
          <button className="kbtn" data-nodrag="" data-tip={c.t("board.embed.taller")} aria-label={c.t("board.embed.taller")} onClick={() => setTall((v) => !v)}><Icon name="taller" size={13} /></button>
        </span>
      </div>
      <div data-nodrag="" style={{ height, position: "relative" }}>
        {/* Until it's clicked, a shield keeps the wheel and drags on the board (an iframe eats
            them); clicking hands it the pointer, clicking elsewhere takes it back. */}
        {!active && <button className="shield" aria-label={c.t("board.embed.activate")} onClick={() => c.setPlaying(id)}>
          <span>{c.t("board.embed.activate")}</span></button>}
        {html == null ? <div className="frame" style={{ height }} /> : Frame
          ? <Frame key={nonce} src={toDataUrl(html)} title={item.title || "embed"} className="frame" style={{ height }} />
          : <iframe key={nonce} className="frame" style={{ height }} sandbox="allow-scripts" srcDoc={html}
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
      <div className="pv"><BoardPreview doc={child} /></div>
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
        {c.editing === id
          ? <EditText single value={item.title ?? ""} onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} />
          : (item.title || c.t("board.frame.title"))}
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
          ? <b><EditText single value={item.title ?? ""} onDone={(v) => { c.setEditing(null); c.update(id, { title: v.trim() || null }); }} /></b>
          : <b>{item.title || "…"}</b>}
        {item.sub && <small>{item.sub}</small>}
      </span>
    </div>
  );
}

export function TextView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const size = item.size === "h" || item.size === "s" ? item.size : "p";
  if (c.editing === id) {
    return <div className={`hb-text ${size}`}><EditText single={size === "h"} value={item.text ?? ""}
      onDone={(v) => { c.setEditing(null); c.update(id, { text: v || null }); }} /></div>;
  }
  return <div className={`hb-text ${size}`}>{item.text || c.t("board.text.empty")}</div>;
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

/** Picks the renderer for an item. */
export function ItemBody({ id, item, c, dropIndex, selected }: {
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
    case "frame": return <FrameView id={id} item={item} c={c} />;
    case "box": return <BoxView id={id} item={item} c={c} />;
    case "text": return <TextView id={id} item={item} c={c} />;
    case "draw": return <DrawView item={item} selected={selected} erasing={c.erasing?.has(id)} />;
    case "live": return <LiveView id={id} item={item} c={c} />;
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
