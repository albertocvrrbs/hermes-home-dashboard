// The chat panel docked to the right of a board: the linked session's recent turns, styled with
// Hermes Desktop's own cues (your turns in the user bubble, Hermes' replies as plain text, tool
// calls folded into one quiet line), and a composer that sends into that session.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MessageKey, Translate } from "../home/i18n";
import { hostModelMenu, onGatewayEvent } from "../sdk";
import { Cad, clock } from "./bits";
import { boardPrompt, chatMode, readChat, sendToSession, type ChatRow } from "./chat";
import { modKey } from "./float";
import { Icon, type IconName } from "./icons";
import type { BoardDoc } from "./model";
import type { ToolAct } from "./chatRows";
import { modelDisplayName, sessionModelLabel } from "./sessionModel";
import { useSessionModel } from "./useSessionModel";

export const CHAT_MIN_W = 300;

/** The header's model: Desktop's own picker where this surface can switch the board's session,
 *  the model as quiet text where it can't (web dashboard, older Desktop builds). */
function SessionModelPill({ doc, t, refreshKey }: { doc: BoardDoc; t: Translate; refreshKey: number }) {
  const { model, sid, controller } = useSessionModel(doc, { refreshKey, failureMessage: t("board.chat.model.switchFailed") });
  const label = modelDisplayName(model.model);
  const menu = hostModelMenu();
  const detail = sessionModelLabel(model);
  const title = model.provider
    ? t("board.chat.model.title", { provider: model.provider, model: detail })
    : t("board.chat.model.titleNoProvider", { model: detail });
  if (controller && menu && sid && label) {
    const Picker = menu.Picker;
    return <Picker controller={controller} sessionId={sid} profile={doc.session?.profile || "default"} label={label} title={title} refreshLabel={t("board.chat.model.refresh")} />;
  }
  if (!label) return null;
  return <span className="hb-model ro" data-tip={`${title} — ${t("board.chat.model.readonly")}`} aria-label={title}>{label}</span>;
}
export const CHAT_MAX_W = 640;

/** One quiet line for a run of tool steps: an icon and what the work was, never the tool's id. The raw
 *  names stay in the tooltip for anyone debugging. */
function ToolLine({ acts, names, t }: { acts: ToolAct[]; names: string[]; t: Translate }) {
  if (!acts.length) return null;
  const label = (a: ToolAct) => (a.kind === "editBoard" && a.n ? t("board.chat.tool.editBoardN", { n: a.n }) : t(`board.chat.tool.${a.kind}` as MessageKey));
  // the board edit is the point of the run: lead with it
  const ordered = [...acts].sort((a, b) => Number(b.kind === "editBoard") - Number(a.kind === "editBoard"));
  const shown = ordered.slice(0, 2);
  const rest = ordered.length - shown.length;
  return (
    <div className="ch-tool" data-tip={names.join(" · ")}>
      <Icon name={`tool${ordered[0].kind[0].toUpperCase()}${ordered[0].kind.slice(1)}` as IconName} size={12} />
      <span className="txt">{shown.map(label).join(" · ")}{rest > 0 ? ` ${t("board.chat.more", { n: rest })}` : ""}</span>
    </div>
  );
}

/** Inline `**bold**` and `code`, as React text (never HTML). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

/** Just enough Markdown for chat replies: paragraphs, lists, headings, fenced code. */
function Md({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={blocks.length}>{code.join("\n")}</pre>);
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d/.test(line);
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const L = ordered ? "ol" : "ul";
      blocks.push(<L key={blocks.length}>{items.map((x, j) => <li key={j}>{inline(x)}</li>)}</L>);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```") && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++]);
    const h = /^#{1,4}\s+(.*)$/.exec(para[0]);
    if (h && para.length === 1) blocks.push(<p key={blocks.length} className="h">{inline(h[1])}</p>);
    else blocks.push(<p key={blocks.length}>{para.map((p, j) => <span key={j}>{j > 0 && <br />}{inline(p.replace(/^#{1,4}\s+/, ""))}</span>)}</p>);
  }
  return <>{blocks}</>;
}

interface Props {
  doc: BoardDoc;
  t: Translate;
  width: number;
  selected: string[];
  /** Bumped by the board when it sends a prompt itself (context-bar verbs). */
  sentAt: number;
  onWidth: (w: number) => void;
  onClose: () => void;
  onContinue: () => void;
  onSent: (text: string, how: "sent" | "handoff") => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatPanel({ doc, t, width, selected, sentAt, onWidth, onClose, onContinue, onSent, inputRef }: Props) {
  const [rows, setRows] = useState<ChatRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<ChatRow | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const docRef = useRef(doc);
  docRef.current = doc;
  const mode = chatMode();
  const sessionId = doc.session?.id ?? null;

  const load = useCallback(async () => {
    const r = await readChat(docRef.current);
    if (r === null) { setFailed(true); return; }
    setFailed(false);
    setRows(r);
  }, []);

  // poll while open: every 4 s, every 1.5 s while a reply is pending; paused in hidden tabs
  useEffect(() => {
    let live = true;
    const tick = () => { if (live && !document.hidden) void load(); };
    tick();
    const i = window.setInterval(tick, pendingSince ? 1500 : 4000);
    return () => { live = false; window.clearInterval(i); };
  }, [load, sessionId, pendingSince]);

  // while a reply is pending, gateway events (Desktop) nudge a refresh between polls
  const pendingRef = useRef(false);
  pendingRef.current = !!pendingSince;
  useEffect(() => {
    let timer = 0;
    const off = onGatewayEvent("*", (ev) => {
      if (!pendingRef.current || timer || !ev?.type || !/message|turn|complete|tool/.test(ev.type)) return;
      timer = window.setTimeout(() => { timer = 0; void load(); }, 700);
    });
    return () => { off?.(); window.clearTimeout(timer); };
  }, [load]);

  useEffect(() => { if (sentAt) setPendingSince(sentAt / 1000); }, [sentAt]);

  // a reply newer than the send ends the pending state (or 4 minutes)
  useEffect(() => {
    if (!pendingSince) return;
    const last = rows?.[rows.length - 1];
    if (last && last.role === "assistant" && (last.t ?? 0) >= pendingSince - 2) { setPendingSince(null); setOptimistic(null); }
    else if (rows?.some((r) => r.role === "user" && (r.t ?? 0) >= pendingSince - 2)) setOptimistic(null);
    const i = window.setTimeout(() => setPendingSince(null), 240000);
    return () => window.clearTimeout(i);
  }, [rows, pendingSince]);

  // keep pinned to the newest message unless the reader scrolled up
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [rows, optimistic, pendingSince]);

  useEffect(() => {
    const el = inputRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(160, el.scrollHeight)}px`; }
  }, [draft, inputRef]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const body = boardPrompt(docRef.current, text, selected, t("board.prompt.selection"));
    const now = Date.now() / 1000;
    setOptimistic({ key: `o${now}`, role: "user", text, t: now });
    setPendingSince(now);
    stick.current = true;
    const how = await sendToSession(docRef.current, body);
    if (how === "handoff") { setPendingSince(null); setOptimistic(null); }
    onSent(text, how);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = width;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onWidth(w0 + (x0 - ev.clientX));
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const shown = [...(rows ?? []), ...(optimistic && !rows?.some((r) => r.role === "user" && r.text === optimistic.text && (r.t ?? 0) >= (optimistic.t ?? 0) - 2) ? [optimistic] : [])];
  const sel = selected.filter((id) => doc.items[id]).length;

  return (
    <aside className="hb-chat" aria-label={t("board.chat.title")} style={{ width }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div className="grip" role="separator" aria-orientation="vertical" aria-label={t("board.chat.resize")} onPointerDown={startResize}
        onDoubleClick={() => onWidth(360)} />
      <header className="ch-top">
        <span className="hd" data-tip={sessionId ? t("board.chat.sessionTip", { id: sessionId }) : undefined}><span className="who"><Cad />hermes</span></span>
        {sessionId && <SessionModelPill doc={doc} t={t} refreshKey={mode === "live" ? 0 : sentAt} />}
        <button className="ib" data-tip={t("board.continue")} data-kbd={`${modKey()}↵`} aria-label={t("board.continue")} onClick={onContinue}>
          <Icon name="open" />
        </button>
        <button className="ib" data-tip={t("board.chat.close")} data-kbd="Esc" aria-label={t("board.chat.close")} onClick={onClose}>
          <Icon name="closePanel" />
        </button>
      </header>
      <div className="ch-list" ref={listRef} onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}>
        {shown.length === 0 && (
          <div className="ch-empty">
            <Icon name="chat" size={18} />
            <p>{failed ? t("board.chat.unreadable") : !sessionId ? t("board.chat.noSession") : rows ? t("board.chat.emptySession") : t("common.loading")}</p>
          </div>
        )}
        {shown.map((r) => r.role === "tool" ? (
          <ToolLine key={r.key} acts={r.acts ?? []} names={r.tools ?? []} t={t} />
        ) : r.role === "user" ? (
          <div key={r.key} className="ch-user"><div className="bubble">{r.text}</div>{r.t ? <time>{clock(r.t)}</time> : null}</div>
        ) : (
          <div key={r.key} className="ch-asst"><Md text={r.text} /></div>
        ))}
        {pendingSince && <div className="ch-working"><Cad />{t("board.chat.working")}<span className="caret" /></div>}
      </div>
      <div className="ch-compose">
        <div className="box">
          <textarea ref={inputRef} rows={1} value={draft} placeholder={t("board.chat.placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }} />
          <div className="row">
            {sel > 0 ? <span className="chip">{t("board.chat.withSelection", { n: sel })}</span>
              : <span className="hint">{mode === "live" ? t("board.chat.hintLive") : t("board.chat.hintHandoff")}</span>}
            <span className="sp" />
            <button className="send" disabled={!draft.trim()} data-tip={t("board.chat.send")} data-kbd="↵"
              aria-label={t("board.chat.send")} onClick={() => void send()}>
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
