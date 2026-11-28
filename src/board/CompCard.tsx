// Custom component cards (kind `comp`): HTML/JS Hermes wrote, kept in the user's component
// library, running in a sandboxed iframe with the `window.hb` bridge (componentBridge.ts). This is
// the host half: it loads the library entry, builds the frame document, answers the frame's
// requests (data files, actions, clock commands) and feeds it data and the shared clock.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { boardsApi, loadCompFile, type CompDoc } from "./api";
import { COMPONENT_CSP, HB_ACTION_REQ, HB_ACTION_RES, HB_ASSETS, HB_ASSET_REQ, HB_ASSET_RES, HB_CLOCK, HB_CLOCK_CMD, HB_DATA,
  componentDocument, type ClockCmd, type HbInit } from "./componentBridge";
import { READY_MSG, type EmbedTheme } from "./embedBridge";
import { Icon } from "./icons";
import { Sig } from "./bits";
import { readTheme, useEmbedBridge } from "./useEmbedBridge";
import type { ItemCtx } from "./items";
import type { Item } from "./model";
import type { ClockEvent, ClockState, GroupClock } from "./syncClock";

void COMPONENT_CSP;

function toDataUrl(html: string): string {
  const bytes = new TextEncoder().encode(html);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:text/html;charset=utf-8;base64,${btoa(bin)}`;
}

/** One loaded library entry per (name, version, stamp); the stamp changes when Hermes saves a new version. */
const libCache = new Map<string, Promise<CompDoc>>();
export function loadComponent(name: string, ver: string | undefined, stamp: number | undefined, fresh = false): Promise<CompDoc> {
  const key = `${name}@${ver ?? "latest"}#${stamp ?? 0}`;
  let p = fresh ? undefined : libCache.get(key);
  if (!p) {
    p = boardsApi.component(name, ver);
    p.catch(() => libCache.delete(key));
    libCache.set(key, p);
  }
  return p;
}

export function clockInit(s: ClockState, group: string | null): HbInit["clock"] {
  return { t: s.t, playing: s.playing, rate: s.rate, duration: s.duration, group, manual: s.manual, master: s.master };
}

export interface CompBridgeArgs {
  box: RefObject<HTMLElement | null>;
  active: boolean;
  nonce: string;
  bid: string;
  iid: string;
  data: Record<string, unknown>;
  files: Record<string, { n: number; r: number }>;
  clock: GroupClock;
  group: string | null;
  runAction: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/** Host side of `window.hb`: replies to the frame and pushes data, data files and the clock to it. */
export function useCompBridge(a: CompBridgeArgs): void {
  const { box, active, nonce, bid, iid, clock, group } = a;
  const latest = useRef(a);
  latest.current = a;
  const win = useCallback(() => box.current?.querySelector("iframe")?.contentWindow ?? null, [box]);
  const post = useCallback((m: unknown, transfer?: Transferable[]) => {
    try { win()?.postMessage(m, "*", transfer); } catch { /* frame gone */ }
  }, [win]);

  // what the frame asks for
  useEffect(() => {
    if (!active) return;
    const reply = (type: string, id: number, ok: boolean, rest: Record<string, unknown>, transfer?: Transferable[]) => post({ type, id, ok, ...rest }, transfer);
    const onMessage = (e: MessageEvent) => {
      const w = win();
      if (!w || e.source !== w || !e.data || typeof e.data !== "object") return;
      const m = e.data as { type?: string; id?: number; name?: string; args?: Record<string, unknown>; cmd?: ClockCmd; v?: number };
      const cur = latest.current;
      switch (m.type) {
        case READY_MSG:
          post({ type: HB_DATA, data: cur.data, keys: Object.keys(cur.data) });
          post({ type: HB_ASSETS, assets: Object.fromEntries(Object.entries(cur.files).map(([k, v]) => [k, v.r])) });
          post({ type: HB_CLOCK, ev: "state", clock: clockInit(clock.state, group) });
          return;
        case HB_ASSET_REQ: {
          const id = Number(m.id), name = String(m.name ?? "");
          const rev = cur.files[name]?.r ?? 0;
          loadCompFile(bid, iid, name, rev).then(
            (buf) => { const copy = buf.slice(0); reply(HB_ASSET_RES, id, true, { body: copy }, [copy]); },
            (err) => reply(HB_ASSET_RES, id, false, { error: String(err?.message ?? err) }));
          return;
        }
        case HB_ACTION_REQ: {
          const id = Number(m.id);
          cur.runAction(String(m.name ?? ""), m.args && typeof m.args === "object" ? m.args : {}).then(
            (result) => reply(HB_ACTION_RES, id, true, { result }),
            (err) => reply(HB_ACTION_RES, id, false, { error: String(err?.message ?? err) }));
          return;
        }
        case HB_CLOCK_CMD:
          switch (m.cmd) {
            case "play": clock.play(); break;
            case "pause": clock.pause(); break;
            case "toggle": clock.toggle(); break;
            case "seek": void clock.seek(Number(m.v)); break;
            case "rate": clock.setRate(Number(m.v)); break;
            case "duration": clock.setDuration(Number(m.v)); break;
          }
          return;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active, bid, iid, clock, group, nonce, post, win]);

  // data and data files pushed while the frame is running
  const dataSig = useMemo(() => JSON.stringify(a.data), [a.data]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    post({ type: HB_DATA, data: latest.current.data, keys: Object.keys(latest.current.data) });
  }, [dataSig, post]);
  const filesSig = useMemo(() => JSON.stringify(Object.entries(a.files).map(([k, v]) => [k, v.r])), [a.files]);
  useEffect(() => {
    post({ type: HB_ASSETS, assets: Object.fromEntries(Object.entries(latest.current.files).map(([k, v]) => [k, v.r])) });
  }, [filesSig, post]);

  // the shared clock, at the rate it ticks (video frames, or rAF)
  useEffect(() => {
    if (!active) return;
    return clock.subscribe((ev: ClockEvent, s: ClockState) => post({ type: HB_CLOCK, ev, clock: clockInit(s, group) }));
  }, [active, clock, group, nonce, post]);
}

const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

export function CompView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const name = item.comp ?? "";
  const [lib, setLib] = useState<CompDoc | "missing" | null>(null);
  const [nonce, setNonce] = useState(0);
  const [base, setBase] = useState<EmbedTheme | null>(null);
  const [menu, setMenu] = useState<"ver" | null>(null);
  const [src, setSrc] = useState(false);
  const [scheme, setScheme] = useState<string | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const themed = item.nt !== true;

  useEffect(() => {
    let live = true;
    if (!name) { setLib("missing"); return; }
    loadComponent(name, item.ver, item.at).then((d) => live && setLib(d), () => live && setLib("missing"));
    return () => { live = false; };
  }, [name, item.ver, item.at]);

  useLayoutEffect(() => { if (!base && box.current) setBase(readTheme(box.current)); }, [base, lib]);

  const group = item.sync ?? null;
  const clock = c.sync.clock(group ?? `~${id}`);
  const data = useMemo(() => item.cdata ?? (lib && lib !== "missing" && lib.sample && typeof lib.sample === "object" ? lib.sample as Record<string, unknown> : {}), [item.cdata, lib]);
  const files = useMemo(() => item.files ?? {}, [item.files]);

  // The document is built once per load/reload/theme switch: data and clock reach a running frame
  // by message, never by reloading it.
  const boot = useRef({ data, files, item, group, clock });
  boot.current = { data, files, item, group, clock };
  const html = lib && lib !== "missing" ? lib.html : null;
  const version = lib && lib !== "missing" ? lib.version : "";
  const doc = useMemo(() => {
    if (html == null || !base) return null;
    const b = boot.current;
    const init: HbInit = {
      component: { name, version }, data: b.data, assets: Object.fromEntries(Object.entries(b.files).map(([k, v]) => [k, v.r])),
      actions: b.item.actions ?? [], clock: clockInit(b.clock.state, b.group),
    };
    return componentDocument(html, themed, base, init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, base, themed, nonce, name, version]);

  const runAction = useCallback(async (action: string, args: Record<string, unknown>) => {
    if (!(item.actions ?? []).includes(action)) throw new Error(c.t("board.comp.actionNotOnCard", { id: action }));
    const r = await c.runCompAction(id, action, args);
    if (!r) throw new Error(c.t("board.comp.actionCancelled"));
    return r;
  }, [c, id, item.actions]);

  useEmbedBridge(box, doc != null, themed, `${nonce}`, (t) => setScheme(t.scheme));
  useCompBridge({ box, active: doc != null, nonce: `${nonce}${themed}`, bid: c.bid, iid: id, data, files, clock, group, runAction });

  const Frame = c.Frame;
  const active = c.playing === id;
  const height = item.h ? Math.max(120, item.h - 80) : 240;
  const frameStyle = { height, ...(themed ? { colorScheme: scheme ?? base?.scheme } : {}) };
  const missing = lib === "missing";
  const current = lib && lib !== "missing" ? lib.current : "";
  const behind = !!item.ver && !!current && item.ver !== current;
  const title = item.title || (lib && lib !== "missing" ? lib.title : "") || name;
  const sync = group ? c.t("board.comp.syncTip", { group }) : "";

  return (
    <div className={`hb-card hb-embed hb-comp${item.by === "h" ? " dm" : ""}${group ? " synced" : ""}`} style={{ width: item.w ?? 480 }}>
      <div className="bar-e">
        <span className="file">{title}</span>
        {version && <span className="sb">{name} · {version}{item.ver ? "" : ` · ${c.t("board.comp.latest")}`}</span>}
        <span className="tools">
          {group && <span className="sync-chip" data-tip={sync} aria-label={sync}><Icon name="sync" size={12} />{group}</span>}
          {behind && (
            <button className="kbtn on" data-nodrag="" data-tip={c.t("board.comp.update", { v: current })} aria-label={c.t("board.comp.update", { v: current })}
              onClick={() => c.update(id, { ver: null })}><Icon name="upgrade" size={13} /></button>
          )}
          <button className={`kbtn${themed ? " on" : ""}`} data-nodrag="" data-tip={c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn")} aria-pressed={themed}
            aria-label={c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn")} onClick={() => c.update(id, { nt: themed ? true : null })}><Icon name="theme" size={13} /></button>
          <button className="kbtn" data-nodrag="" data-tip={c.t("board.embed.reload")} aria-label={c.t("board.embed.reload")}
            onClick={() => { setNonce((n) => n + 1); loadComponent(name, item.ver, item.at, true).then(setLib, () => undefined); }}><Icon name="reload" size={13} /></button>
          <button className={`kbtn${menu ? " on" : ""}`} data-nodrag="" data-tip={c.t("board.comp.versions")} aria-label={c.t("board.comp.versions")} aria-expanded={!!menu}
            onClick={() => setMenu((m) => (m ? null : "ver"))}><Icon name="versions" size={13} /></button>
          <button className={`kbtn${src ? " on" : ""}`} data-nodrag="" data-tip={c.t("board.comp.source")} aria-label={c.t("board.comp.source")} aria-pressed={src}
            onClick={() => setSrc((v) => !v)}><Icon name="embed" size={13} /></button>
        </span>
        {menu && lib && lib !== "missing" && (
          <div className="comp-menu" data-nodrag="" role="menu">
            <button role="menuitem" className={!item.ver ? "on" : ""} onClick={() => { c.update(id, { ver: null }); setMenu(null); }}>
              <b>{c.t("board.comp.followLatest")}</b><small>{current}</small></button>
            {[...lib.versions].reverse().slice(0, 12).map((v) => (
              <button role="menuitem" key={v.v} className={item.ver === v.v ? "on" : ""} onClick={() => { c.update(id, { ver: v.v }); setMenu(null); }}>
                <b>{v.v}</b><small>{v.note || new Date(v.at * 1000).toLocaleDateString()}</small></button>
            ))}
          </div>
        )}
      </div>
      <div ref={box} data-nodrag="" style={{ height, position: "relative" }}>
        {!active && !missing && !src && <button className="shield" aria-label={c.t("board.embed.activate")} onClick={() => c.setPlaying(id)}>
          <span>{c.t("board.embed.activate")}</span></button>}
        {missing ? <div className="comp-empty" style={{ height }}><Icon name="components" size={20} /><b>{c.t("board.comp.missing", { name })}</b><small>{c.t("board.comp.missingHint")}</small></div>
          : src ? <pre className="comp-src" style={{ height }}>{html ?? ""}</pre>
          : doc == null ? <div className="frame" style={{ height }} />
          : Frame
            ? <Frame key={`${nonce}${themed}${version}`} src={toDataUrl(doc)} title={title} className={themed ? "frame themed" : "frame"} style={frameStyle} />
            : <iframe key={`${nonce}${themed}${version}`} className={themed ? "frame themed" : "frame"} style={frameStyle} sandbox="allow-scripts" srcDoc={doc}
                title={title} referrerPolicy="no-referrer" />}
      </div>
      <div className="foot meta">
        <span>{Object.keys(files).length ? c.t("board.comp.dataFiles", { n: Object.keys(files).length, size: fmtBytes(Object.values(files).reduce((s, f) => s + f.n, 0)) }) : c.t("board.embed.live")}</span>
        <span className="sp" />{item.by === "h" && <Sig />}
      </div>
    </div>
  );
}
