// The board page: title line, infinite table, status line, map, Hermes log and cursor.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT, type MessageKey } from "../home/i18n";
import { hostSandboxedFrame, newChatWithDraft, openSession } from "../sdk";
import { boardsApi, prepareImage, rememberPoster, uploadVideo, VIDEO_TYPES, type ActionResult } from "./api";
import type { LiveActionInfo, LiveActionRef } from "./live";
import { Cad, clock } from "./bits";
import { boardPrompt, sendToSession } from "./chat";
import { CHAT_MAX_W, CHAT_MIN_W, ChatPanel } from "./ChatPanel";
import { modKey, placeBar } from "./float";
import {
  boundsOf, fitView, intersects, RESIZE_H, resizePatch, strokePath, toStroke, wheelIntent, wheelZoomFactor,
  zoomView, ZOOM_MAX, ZOOM_MIN, type Rect, type View,
} from "./geometry";
import {
  arrowHead, eraseHits, euroFor, expandGroups, finishStroke, freehandOutline, INK_COLORS, inkWidth, isShape, lassoHits,
  newGroupId, OneEuro2D, outlinePath, parseInk, pressureDigits, shapePath, shapePoints, stepWidth,
  type InkSettings, type InkTool,
} from "./ink";
import { InkBar } from "./InkBar";
import { HermesCursor, type CursorHandle, type CursorStep } from "./HermesCursor";
import { Icon, type IconName } from "./icons";
import { ItemBody, itemForUrl, type ItemCtx } from "./items";
import { BoardMenu, type MenuEntry } from "./Menu";
import { installTips } from "./tips";
import { drawPreview } from "./preview";
import { approxRect, DEFAULT_SIZE, itemLabel, newRef, type BoardDoc, type Entry, type Item, type Op, type Point } from "./model";
import { extractUrl } from "./urlKind";
import { HERMES_ACTIVE_S, useBoard } from "./useBoard";
import { Wires } from "./Wires";

type Tool = "select" | "pan" | "note" | "todo" | "link" | "image" | "col" | "board" | "embed" | "arrow" | "draw";

const TOOLS: { tool: Tool; key: string; label: MessageKey; icon: IconName }[][] = [
  [{ tool: "select", key: "V", label: "board.tool.select", icon: "select" }, { tool: "pan", key: "H", label: "board.tool.pan", icon: "pan" }],
  [{ tool: "note", key: "N", label: "board.tool.note", icon: "note" }, { tool: "todo", key: "T", label: "board.tool.todo", icon: "todo" },
   { tool: "link", key: "L", label: "board.tool.link", icon: "link" }, { tool: "image", key: "I", label: "board.tool.image", icon: "image" },
   { tool: "col", key: "C", label: "board.tool.col", icon: "col" }, { tool: "board", key: "B", label: "board.tool.board", icon: "board" },
   { tool: "embed", key: "E", label: "board.tool.embed", icon: "embed" }],
  [{ tool: "arrow", key: "A", label: "board.tool.arrow", icon: "arrow" }, { tool: "draw", key: "D", label: "board.tool.draw", icon: "draw" }],
];
const TOOL_HINT: Partial<Record<Tool, MessageKey>> = {
  pan: "board.hint.pan", note: "board.hint.place", todo: "board.hint.place", col: "board.hint.place", board: "board.hint.place",
  arrow: "board.hint.arrow", draw: "board.hint.draw",
};
const VERB_ICON: Record<string, IconName> = {
  "board.verb.diagram": "diagram", "board.verb.sortDate": "sortDate", "board.verb.split": "split", "board.verb.expand": "expand",
  "board.verb.flow": "flow", "board.verb.group": "group", "board.verb.summarize": "summarize", "board.verb.improve": "improve",
};
const CHAT_OPEN_KEY = "hb.chat.open";
const CHAT_W_KEY = "hb.chat.w";
const readLocal = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const KEY_TOOL: Record<string, Tool> = Object.fromEntries(TOOLS.flat().map((x) => [x.key.toLowerCase(), x.tool]));
const PLACE: Tool[] = ["note", "todo", "col", "link", "board", "embed", "image"];
const EDITABLE = new Set(["card", "todo", "col", "frame", "box", "text", "image"]);
const INTO_COLUMN = new Set(["card", "todo", "link", "image", "video", "board"]);

interface Drag {
  kind: "pan" | "move" | "resize" | "marquee" | "ink" | "erase" | "lasso" | "arrow" | "kid";
  sx: number; sy: number; moved: boolean;
  view?: View; ids?: string[]; id?: string; w0?: number; h0?: number;
  pts?: Point[]; from?: string;
}

/** A stroke, shape or lasso in progress. Points are world coordinates; freehand points are
 *  already stabilised (One Euro on screen px), `raw`/`pred` are the pointer itself so the live
 *  ink always reaches it. */
interface InkStroke {
  tool: InkTool;
  pointerType: string;
  euro: OneEuro2D | null;
  pts: Point[];
  pr: number[];
  raw: Point | null;
  pred: Point | null;
  a: Point;
  b: Point;
  shift: boolean;
  alt: boolean;
  loop: Point[];
}

const INK_KEY = "hb.ink";
/** Eraser radius, screen px. */
const ERASER_R = 9;
const INK_HINT: Record<InkTool, MessageKey> = {
  pen: "board.hint.ink.pen", hl: "board.hint.ink.pen", eraser: "board.hint.ink.eraser", lasso: "board.hint.ink.lasso",
  line: "board.hint.ink.shape", arrow: "board.hint.ink.shape", rect: "board.hint.ink.shape", ellipse: "board.hint.ink.shape",
};
const sameSet = (a: Set<string>, b: string[]) => a.size === b.length && b.every((x) => a.has(x));

interface LogLine { key: string; t: number; who: "hermes" | "you"; msg: string; detail?: string; s?: number }

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export interface BoardViewProps {
  bid: string;
  onOpenBoard: (id: string | null) => void;
  onHome: () => void;
}

export function BoardView({ bid, onOpenBoard, onHome }: BoardViewProps) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const ctxEl = useRef<HTMLDivElement>(null);
  const selRef = useRef<Rect | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<CursorHandle>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const view = useRef<View>({ x: 0, y: 0, z: 0.8 });
  const drag = useRef<Drag | null>(null);
  const space = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const fitted = useRef(false);
  const accentRef = useRef("");

  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [delta, setDelta] = useState<{ dx: number; dy: number } | null>(null);
  const [resize, setResize] = useState<{ id: string; w: number; h: number } | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [ink, setInkState] = useState<InkSettings>(() => parseInk(readLocal(INK_KEY)));
  const inkRef = useRef(ink);
  inkRef.current = ink;
  const setInk = useCallback((next: InkSettings) => { setInkState(next); writeLocal(INK_KEY, JSON.stringify(next)); }, []);
  const [erasing, setErasing] = useState<Set<string>>(new Set());
  const erasingRef = useRef(erasing);
  erasingRef.current = erasing;
  const stroke = useRef<InkStroke | null>(null);
  const eraser = useRef<{ trail: Point[]; sweep: boolean } | null>(null);
  const liveSvgRef = useRef<SVGSVGElement>(null);
  const livePathRef = useRef<SVGPathElement>(null);
  const liveHeadRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const liveRaf = useRef(0);
  const [draft, setDraft] = useState<{ from: Rect; to: Point } | null>(null);
  const [kidDrag, setKidDrag] = useState<{ id: string; x: number; y: number; col: string | null; index: number } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [layoutV, setLayoutV] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOn, setLogOn] = useState(false);
  const [ask, setAsk] = useState<null | { kind: "link" | "embed"; at: { x: number; y: number } }>(null);
  const [askValue, setAskValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(() => readLocal(CHAT_OPEN_KEY) === "1");
  const [chatW, setChatW] = useState(() => Math.min(CHAT_MAX_W, Math.max(CHAT_MIN_W, Number(readLocal(CHAT_W_KEY)) || 380)));
  const [chatSentAt, setChatSentAt] = useState(0);
  const [rootW, setRootW] = useState(1400);
  const [menu, setMenu] = useState<null | { x: number; y: number; at: { x: number; y: number }; onItem: boolean }>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [narrow, setNarrow] = useState<"" | "narrow" | "narrow tiny">("");
  const [cursorAct, setCursorAct] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [, setNow] = useState(0);
  const [liveActions, setLiveActions] = useState<Record<string, LiveActionInfo> | null>(null);
  const [liveActionsDown, setLiveActionsDown] = useState(false);
  const [confirmReq, setConfirmReq] = useState<null | {
    iid: string; ref: LiveActionRef; index: number; info: LiveActionInfo; resolve: (ok: boolean) => void;
  }>(null);
  const Frame = hostSandboxedFrame();

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  // ── live cards: the owner's action allowlist, refreshed now and then ─────
  const loadActions = useCallback(() => {
    boardsApi.liveActions()
      .then((r) => { setLiveActions(Object.fromEntries(r.actions.map((a) => [a.id, a]))); setLiveActionsDown(false); })
      .catch(() => { setLiveActions((cur) => cur ?? {}); setLiveActionsDown(true); });
  }, []);
  useEffect(() => {
    loadActions();
    const h = window.setInterval(() => { if (!document.hidden) loadActions(); }, 60000);
    return () => window.clearInterval(h);
  }, [loadActions]);

  const runLiveAction = useCallback(async (iid: string, ref: LiveActionRef, index: number): Promise<ActionResult | null> => {
    const info = liveActionsRef.current?.[ref.action];
    if (!info || !info.enabled) throw new Error(t("board.live.notRegistered", { id: ref.action }));
    let confirm = false;
    if (info.destructive) {
      confirm = await new Promise<boolean>((resolve) => setConfirmReq({ iid, ref, index, info, resolve }));
      setConfirmReq(null);
      if (!confirm) return null;
    }
    try {
      return await boardsApi.liveAction(bid, iid, ref.action, index, confirm);
    } catch (e) {
      loadActions();
      throw e;
    }
  }, [bid, loadActions, t]);
  const liveActionsRef = useRef(liveActions);
  liveActionsRef.current = liveActions;

  // ── Hermes' op stream drives his cursor ─────────────────────────────────
  const onHermes = useCallback((entries: Entry[], doc: BoardDoc) => {
    const steps: CursorStep[] = [];
    const hide = new Set<string>();
    let changes = 0;
    for (const e of entries) {
      for (const op of e.ops) {
        if (op.op === "board") continue;
        changes++;
        const id = op.op === "put" || op.op === "set" || op.op === "del" ? op.id : null;
        if (!id) continue;
        const it = doc.items[id];
        if (op.op === "put") hide.add(id);
        let act: string;
        if (op.op === "del") act = t("board.cursor.removing");
        else if (it?.k === "line") {
          const name = (end: unknown) => {
            if (typeof end !== "string") return "·";
            const x = doc.items[end];
            return x?.num || (x ? itemLabel(x).slice(0, 14) : "·");
          };
          act = t("board.cursor.connecting", { a: name(it.a), b: name(it.b) });
        } else if (op.op === "put") {
          act = it?.k === "box" && it.num ? t("board.cursor.placingStep", { n: it.num }) : t("board.cursor.adding", { kind: t(`board.kind.${it?.k ?? "card"}` as MessageKey) });
        } else if (op.op === "set" && ("x" in op.p || "y" in op.p)) {
          act = t("board.cursor.moving", { what: it ? itemLabel(it).slice(0, 18) : "" });
        } else {
          act = t("board.cursor.editing", { what: it ? itemLabel(it).slice(0, 18) : "" });
        }
        steps.push({
          id, act,
          locate: () => locateFor(id, doc),
          onArrive: () => {
            setHidden((h) => { if (!h.has(id)) return h; const n = new Set(h); n.delete(id); return n; });
            setFresh((f) => new Set(f).add(id));
            window.setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(id); return n; }), 900);
          },
        });
      }
      setLog((l) => [...l.slice(-3), {
        key: `h${e.s}`, t: e.t, who: "hermes", s: e.s,
        msg: e.note || t("board.log.changes", { n: e.ops.length }),
      }]);
      setLogOn(true);
    }
    if (hide.size) setHidden((h) => new Set([...h, ...hide]));
    cursorRef.current?.enqueue(steps, t("board.cursor.done", { n: changes }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const sync = useBoard(bid, onHermes);
  const doc = sync.doc;
  const docRef = useRef(doc);
  docRef.current = doc;

  // ── geometry ────────────────────────────────────────────────────────────
  const getRect = useCallback((id: string): Rect | null => {
    const el = els.current.get(id);
    const world = worldRef.current;
    const z = view.current.z;
    if (el && world && el.isConnected) {
      const a = el.getBoundingClientRect(), w = world.getBoundingClientRect();
      if (a.width || a.height) return { x: (a.left - w.left) / z, y: (a.top - w.top) / z, w: a.width / z, h: a.height / z };
    }
    const it = docRef.current?.items[id];
    return it ? approxRect(it) : null;
  }, []);

  function locateFor(id: string, fallback?: BoardDoc): { x: number; y: number } | null {
    const known = fallback?.items[id];
    const r = getRect(id) ?? (known ? approxRect(known) : null);
    const it = docRef.current?.items[id] ?? known;
    if (it?.k === "line") {
      const ends = [it.a, it.b].map((e) => (Array.isArray(e) ? { x: e[0], y: e[1], w: 0, h: 0 } : typeof e === "string" ? getRect(e) : null));
      if (ends[0] && ends[1]) {
        return { x: (ends[0].x + ends[0].w / 2 + ends[1].x + ends[1].w / 2) / 2, y: (ends[0].y + ends[0].h / 2 + ends[1].y + ends[1].h / 2) / 2 };
      }
      return null;
    }
    if (!r) return null;
    return { x: r.x + Math.min(r.w * 0.62, 168), y: r.y + Math.min(r.h * 0.62, 46) };
  }

  const toWorld = useCallback((cx: number, cy: number) => {
    const rect = vpRef.current!.getBoundingClientRect();
    const v = view.current;
    return { x: (cx - rect.left - v.x) / v.z, y: (cy - rect.top - v.y) / v.z };
  }, []);

  const drawMap = useCallback(() => {
    const canvas = mapRef.current, d = docRef.current, vp = vpRef.current;
    if (!canvas || !d || !vp) return;
    const v = view.current;
    const visible = { x: -v.x / v.z, y: -v.y / v.z, w: vp.clientWidth / v.z, h: vp.clientHeight / v.z };
    if (!accentRef.current) accentRef.current = accentColor(rootRef.current);
    drawPreview(canvas, d, { accent: accentRef.current, cell: 4, hermesAt: cursorRef.current?.position() ?? null });
    // viewport frame
    const ctx = canvas.getContext("2d");
    const rects = Object.values(d.items).map(approxRect).filter(Boolean) as Rect[];
    const b = boundsOf(rects) ?? visible;
    const W = canvas.clientWidth, H = canvas.clientHeight, pad = 30;
    const s = Math.min(W / (b.w + pad * 2), H / (b.h + pad * 2));
    const ox = (W - b.w * s) / 2 - b.x * s, oy = (H - b.h * s) / 2 - b.y * s;
    if (ctx) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = accentRef.current;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(ox + visible.x * s) + 0.5, Math.round(oy + visible.y * s) + 0.5, visible.w * s, visible.h * s);
      ctx.globalAlpha = 1;
    }
  }, []);

  // The selection bar lives in screen space (fixed size at every zoom), above the selection,
  // flipped below it when the top is covered, and clamped to the viewport.
  const placeCtx = useCallback(() => {
    const el = ctxEl.current, vp = vpRef.current, r = selRef.current;
    if (!el || !vp) return;
    const v = view.current;
    const p = r ? placeBar({ x: v.x + r.x * v.z, y: vp.offsetTop + v.y + r.y * v.z, w: r.w * v.z, h: r.h * v.z },
      { w: el.offsetWidth, h: el.offsetHeight }, { x: 0, y: vp.offsetTop, w: vp.clientWidth, h: vp.clientHeight }) : null;
    if (!p) { el.style.visibility = "hidden"; return; }
    el.style.visibility = "visible";
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    el.dataset.below = p.below ? "1" : "0";
  }, []);

  const applyView = useCallback(() => {
    const v = view.current, world = worldRef.current, grid = gridRef.current;
    if (!world || !grid) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    world.style.setProperty("--iz", String(1 / v.z));
    const g = 24 * v.z, G = g * 5, c = 4.5;
    if (!accentRef.current) accentRef.current = accentColor(rootRef.current);
    const cross = withAlpha(accentRef.current, 0.16);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${G}' height='${G}'><path d='M${-c} 0H${c}M0 ${-c}V${c}M${G - c} 0H${G + c}M${G} ${-c}V${c}M${-c} ${G}H${c}M0 ${G - c}V${G + c}M${G - c} ${G}H${G + c}M${G} ${G - c}V${G + c}' stroke='${cross}' stroke-width='1'/></svg>`;
    grid.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}"), radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent) .9px, transparent 1.2px)`;
    grid.style.backgroundSize = `${G}px ${G}px, ${g}px ${g}px`;
    grid.style.backgroundPosition = `${v.x}px ${v.y}px, ${v.x}px ${v.y}px`;
    if (pctRef.current) pctRef.current.textContent = `${Math.round(v.z * 100)}%`;
    drawMap();
    placeCtx();
  }, [drawMap, placeCtx]);

  const saveView = useCallback(() => {
    try { sessionStorage.setItem(`hb.view.${bid}`, JSON.stringify(view.current)); } catch { /* private mode */ }
  }, [bid]);

  const zoomAt = useCallback((f: number, sx: number, sy: number) => {
    view.current = zoomView(view.current, f, sx, sy);
    applyView();
    saveView();
  }, [applyView, saveView]);

  // Wheel zoom eases toward its target (~120 ms) around the pointer; notches accumulate.
  const zoomAnim = useRef<{ z: number; sx: number; sy: number; raf: number } | null>(null);
  const zoomSmooth = useCallback((f: number, sx: number, sy: number) => {
    if (reduced()) { zoomAt(f, sx, sy); return; }
    const a = zoomAnim.current;
    const base = a ? a.z : view.current.z;
    const target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, base * f));
    if (a) { cancelAnimationFrame(a.raf); }
    const anim = { z: target, sx, sy, raf: 0 };
    zoomAnim.current = anim;
    const step = () => {
      const v = view.current;
      const next = v.z + (anim.z - v.z) * 0.38;
      const done = Math.abs(anim.z - next) < anim.z * 0.002;
      view.current = zoomView(v, (done ? anim.z : next) / v.z, anim.sx, anim.sy);
      applyView();
      if (done) { zoomAnim.current = null; saveView(); return; }
      anim.raf = requestAnimationFrame(step);
    };
    anim.raf = requestAnimationFrame(step);
  }, [applyView, saveView, zoomAt]);
  useEffect(() => () => { if (zoomAnim.current) cancelAnimationFrame(zoomAnim.current.raf); }, []);

  const contentBounds = useCallback((): Rect | null => {
    const d = docRef.current;
    if (!d) return null;
    const rects = Object.entries(d.items).filter(([, it]) => !it.in && it.k !== "line").map(([id]) => getRect(id)).filter(Boolean) as Rect[];
    return boundsOf(rects);
  }, [getRect]);

  const fit = useCallback(() => {
    const vp = vpRef.current, b = contentBounds();
    if (!vp) return;
    view.current = b ? fitView(b, { w: vp.clientWidth, h: vp.clientHeight }, 60, 1.1) : { x: vp.clientWidth / 2 - 200, y: vp.clientHeight / 2 - 120, z: 0.9 };
    applyView();
    saveView();
  }, [applyView, contentBounds, saveView]);

  // initial view: saved, else fit
  useLayoutEffect(() => {
    if (!doc || fitted.current) return;
    fitted.current = true;
    let saved: View | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(`hb.view.${bid}`) || "null"); } catch { saved = null; }
    if (saved && Number.isFinite(saved.z)) { view.current = saved; applyView(); } else fit();
  }, [doc, bid, applyView, fit]);

  useEffect(() => { fitted.current = false; setSelected(new Set()); setEditing(null); setPlaying(null); }, [bid]);
  useEffect(() => { applyView(); }, [applyView, doc, layoutV]);

  // re-measure connectors when items change size
  useEffect(() => {
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!RO || !worldRef.current) return;
    let raf = 0;
    const ro = new RO(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setLayoutV((v) => v + 1)); });
    els.current.forEach((el) => ro.observe(el));
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [doc]);

  // narrow windows: keys only, names on hover
  useEffect(() => {
    const el = rootRef.current;
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!el || !RO) return;
    const ro = new RO(() => {
      setNarrow(el.clientWidth < 760 ? "narrow tiny" : el.clientWidth < 1180 ? "narrow" : "");
      setRootW(el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // clock for "saved hh:mm" / presence freshness
  useEffect(() => { const i = window.setInterval(() => setNow((n) => n + 1), 15000); return () => window.clearInterval(i); }, []);
  useEffect(() => {
    if (!logOn) return;
    const i = window.setTimeout(() => setLogOn(false), 16000);
    return () => window.clearTimeout(i);
  }, [logOn, log]);

  // ── commits ─────────────────────────────────────────────────────────────
  const commit = useCallback((ops: Op[], note?: string) => sync.commit(ops, { note }), [sync]);
  const update = useCallback((id: string, p: Record<string, unknown>) => commit([{ op: "set", id, p }]), [commit]);

  const center = useCallback(() => {
    const vp = vpRef.current!;
    const v = view.current;
    return { x: (vp.clientWidth / 2 - v.x) / v.z, y: (vp.clientHeight / 2 - v.y) / v.z };
  }, []);

  const add = useCallback((item: Item, at?: { x: number; y: number }, edit = false): string => {
    const ref = newRef();
    const p = at ?? lastPoint.current ?? center();
    const placed: Item = item.in ? item : { ...item, x: Math.round(p.x), y: Math.round(p.y) };
    commit([{ op: "add", ref, item: placed }]);
    setSelected(new Set([ref]));
    if (edit) setEditing(ref);
    return ref;
  }, [center, commit]);

  const addImageFiles = useCallback(async (files: File[], at?: { x: number; y: number }) => {
    let p = at ?? center();
    for (const f of files.slice(0, 8)) {
      if (VIDEO_TYPES.test(f.type)) {
        try {
          flash(t("board.toast.uploadingVideo", { pct: 0 }));
          const res = await uploadVideo(f, (fr) => setToast(t("board.toast.uploadingVideo", { pct: Math.round(fr * 100) })));
          rememberPoster({ asset: res.asset }, { st: res.st ?? "none", img: res.img, dur: res.dur, iw: res.iw, ih: res.ih });
          const item: Item = { k: "video", asset: res.asset, title: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200), w: 400 };
          if (res.img) item.img = res.img;
          if (res.dur) item.dur = res.dur;
          if (res.iw && res.ih) { item.iw = res.iw; item.ih = res.ih; }
          add(item, p);
          p = { x: p.x + 24, y: p.y + 24 };
          setToast(null);
        } catch (e) {
          flash(t("board.toast.videoFailed", { error: String((e as Error)?.message ?? e) }));
        }
        continue;
      }
      if (!f.type.startsWith("image/")) continue;
      try {
        flash(t("board.toast.uploading"));
        const img = await prepareImage(f);
        const res = await boardsApi.uploadImage(img.data);
        const w = Math.min(372, Math.max(160, img.w));
        add({ k: "image", asset: res.asset, iw: res.iw ?? img.w, ih: res.ih ?? img.h, w }, p);
        p = { x: p.x + 24, y: p.y + 24 };
        setToast(null);
      } catch (e) {
        flash(t("board.toast.imageFailed", { error: String((e as Error)?.message ?? e) }));
      }
    }
  }, [add, center, flash, t]);

  const addUrl = useCallback((url: string, at?: { x: number; y: number }) => {
    const item = itemForUrl(url);
    if (!item) return false;
    add(item, at);
    return true;
  }, [add]);

  const deleteSelection = useCallback(() => {
    const d = docRef.current;
    if (!d || !selected.size) return;
    const ops: Op[] = [...selected].filter((id) => d.items[id]).map((id) => ({ op: "del", id }));
    commit(ops);
    setSelected(new Set());
  }, [commit, selected]);

  const duplicate = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const ops: Op[] = [];
    const next = new Set<string>();
    const regroup = new Map<string, string>(); // copies of a group form a new group
    for (const id of selected) {
      const it = d.items[id];
      if (!it || it.k === "line" || it.k === "col") continue;
      const { by: _by, in: inCol, ...rest } = it;
      if (rest.g) {
        if (!regroup.has(rest.g)) regroup.set(rest.g, newGroupId());
        rest.g = regroup.get(rest.g);
      }
      const ref = newRef();
      next.add(ref);
      const r = getRect(id);
      ops.push({ op: "add", ref, item: inCol ? { ...rest, in: inCol } : { ...rest, x: (it.x ?? r?.x ?? 0) + 24, y: (it.y ?? r?.y ?? 0) + 24 } });
    }
    if (ops.length) { commit(ops); setSelected(next); }
  }, [commit, getRect, selected]);

  /** Groups the selected strokes (one shared `g`), or ungroups them when they already share one. */
  const toggleGroup = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const ids = [...selected].filter((id) => d.items[id]?.k === "draw");
    if (ids.length < 2 || ids.length !== selected.size) return;
    const gs = new Set(ids.map((id) => d.items[id].g));
    const g = gs.size === 1 && !gs.has(undefined) ? null : newGroupId();
    commit(ids.map((id) => ({ op: "set", id, p: { g } }) as Op));
  }, [commit, selected]);

  // ── Hermes prompt / session ─────────────────────────────────────────────
  const continueInSession = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    if (d.session?.id) { openSession(d.session.id); return; }
    const ok = await newChatWithDraft(t("board.session.draft", { name: d.name, marker: `[board:${d.id}]` }));
    if (!ok) flash(t("board.toast.promptCopied"));
  }, [flash, t]);

  const openChat = useCallback((focus: boolean) => {
    setChatOpen(true);
    writeLocal(CHAT_OPEN_KEY, "1");
    if (focus) window.setTimeout(() => chatInputRef.current?.focus(), 30);
  }, []);
  const closeChat = useCallback(() => {
    setChatOpen(false);
    writeLocal(CHAT_OPEN_KEY, "0");
    vpRef.current?.focus({ preventScroll: true });
  }, []);
  const resizeChat = useCallback((w: number) => {
    const max = Math.min(CHAT_MAX_W, Math.max(CHAT_MIN_W, (rootRef.current?.clientWidth ?? 1200) - 620));
    const next = Math.round(Math.min(max, Math.max(CHAT_MIN_W, w)));
    setChatW(next);
    writeLocal(CHAT_W_KEY, String(next));
  }, []);

  /** Context-bar verbs: send to the board's session and show the reply in the chat panel. */
  const sendToHermes = useCallback(async (text: string) => {
    const d = docRef.current;
    if (!d || !text.trim()) return;
    const how = await sendToSession(d, boardPrompt(d, text, [...selected], t("board.prompt.selection")));
    if (how === "sent") { openChat(false); setChatSentAt(Date.now()); }
    else flash(t("board.toast.promptCopied"));
  }, [flash, openChat, selected, t]);

  const onChatSent = useCallback((_text: string, how: "sent" | "handoff") => {
    if (how === "handoff") flash(t("board.toast.promptCopied"));
  }, [flash, t]);

  // ── ink: live stroke, eraser sweep (painted once per frame, never in pointermove) ──
  const drawLive = useCallback(() => {
    liveRaf.current = 0;
    const er = eraser.current, d = docRef.current;
    if (er && er.trail.length && d) {
      const r = ERASER_R / view.current.z;
      const hits = new Set(er.sweep ? erasingRef.current : []);
      for (const p of er.trail) for (const id of eraseHits(d.items, p, r)) hits.add(id);
      er.trail = er.trail.slice(-1);
      const list = [...hits];
      if (!sameSet(erasingRef.current, list)) { erasingRef.current = hits; setErasing(hits); }
    }
    const svg = liveSvgRef.current, path = livePathRef.current, head = liveHeadRef.current;
    if (!svg || !path || !head) return;
    const s = stroke.current;
    if (!s) { path.setAttribute("d", ""); head.setAttribute("d", ""); return; }
    const k = inkRef.current;
    const sw = inkWidth(k, s.tool);
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const fill = s.tool === "pen" && k.sm > 0 && !k.ds;
    svg.setAttribute("class", `hb-draw hb-live${s.tool === "lasso" ? " lasso" : ""}${s.tool === "hl" ? " hl" : ""}${k.c !== "ink" && s.tool !== "lasso" ? ` c-${k.c}` : ""}`);
    path.setAttribute("class", fill ? "fill" : "");
    path.setAttribute("stroke-width", String(s.tool === "lasso" ? 1.2 / view.current.z : sw));
    const dash = s.tool === "lasso" ? `${4 / view.current.z} ${3 / view.current.z}` : k.ds && !fill ? `${Math.max(4, sw * 3)} ${Math.max(4, sw * 2.4)}` : "";
    if (dash) path.setAttribute("stroke-dasharray", dash); else path.removeAttribute("stroke-dasharray");
    head.setAttribute("stroke-width", String(sw));
    if (s.tool === "lasso") {
      path.setAttribute("d", s.loop.length > 1 ? `M${s.loop.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z` : "");
      head.setAttribute("d", "");
      return;
    }
    if (isShape(s.tool)) {
      const [p0, p1] = shapePoints(s.tool, s.a, s.b, { shift: s.shift, alt: s.alt });
      path.setAttribute("d", shapePath(s.tool, p0, p1));
      head.setAttribute("d", s.tool === "arrow" ? arrowHead(p0, p1, sw) : "");
      return;
    }
    // stabilised points, then the raw pointer (and its prediction) so the ink never trails it
    const pts = s.pts.slice();
    const prs = s.pr.slice();
    for (const q of [s.raw, s.pred]) if (q) { pts.push(q); prs.push(prs[prs.length - 1] ?? 0.5); }
    head.setAttribute("d", "");
    if (fill) {
      const pen = s.pointerType === "pen" && Math.max(...prs) - Math.min(...prs) > 0.05;
      path.setAttribute("d", outlinePath(freehandOutline(pts, sw * 1.35, pen ? prs : undefined)));
    } else {
      path.setAttribute("d", strokePath(pts.map(([x, y]) => [r1(x), r1(y)] as Point)));
    }
  }, []);
  const scheduleLive = useCallback(() => {
    if (!liveRaf.current) liveRaf.current = requestAnimationFrame(drawLive);
  }, [drawLive]);
  useEffect(() => () => cancelAnimationFrame(liveRaf.current), []);
  useEffect(() => {
    if (tool !== "draw") { stroke.current = null; eraser.current = null; setErasing((cur) => (cur.size ? new Set() : cur)); }
    else if (ink.tool !== "eraser") { eraser.current = null; setErasing((cur) => (cur.size ? new Set() : cur)); }
  }, [tool, ink.tool]);

  /** Viewport-relative world mapper, measured once per event batch. */
  const worldMapper = () => {
    const rect = vpRef.current!.getBoundingClientRect();
    const v = view.current;
    return (cx: number, cy: number): Point => [(cx - rect.left - v.x) / v.z, (cy - rect.top - v.y) / v.z];
  };

  const onInkMove = (e: React.PointerEvent) => {
    const vp = vpRef.current;
    if (!vp) return;
    const W = worldMapper();
    const k = inkRef.current;
    const ring = ringRef.current;
    if (ring) {
      const rect = vp.getBoundingClientRect();
      ring.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
    }
    const native = e.nativeEvent as PointerEvent;
    const batch = native.getCoalescedEvents?.() ?? [];
    const events = batch.length ? batch : [native];
    if (k.tool === "eraser") {
      const er = eraser.current ?? (eraser.current = { trail: [], sweep: false });
      er.sweep = drag.current?.kind === "erase";
      if (!er.sweep) er.trail = [];
      for (const ev of events) er.trail.push(W(ev.clientX, ev.clientY));
      scheduleLive();
      return;
    }
    const s = stroke.current;
    if (!s || !drag.current) return;
    if (s.tool === "lasso") {
      for (const ev of events) s.loop.push(W(ev.clientX, ev.clientY));
    } else if (isShape(s.tool)) {
      s.b = W(e.clientX, e.clientY);
      s.shift = e.shiftKey;
      s.alt = e.altKey;
    } else {
      for (const ev of events) {
        const [fx, fy] = s.euro ? s.euro.filter(ev.clientX, ev.clientY, ev.timeStamp) : [ev.clientX, ev.clientY];
        s.pts.push(W(fx, fy));
        s.pr.push(ev.pressure || 0.5);
      }
      s.raw = W(e.clientX, e.clientY);
      const pred = native.getPredictedEvents?.() ?? [];
      s.pred = pred.length ? W(pred[pred.length - 1].clientX, pred[pred.length - 1].clientY) : null;
    }
    scheduleLive();
  };

  /** Ends the stroke in progress: shapes and freehand become one draw item each. */
  const finishInk = (d: BoardDoc) => {
    const s = stroke.current;
    stroke.current = null;
    scheduleLive();
    if (!s) return;
    const k = inkRef.current;
    const z = view.current.z;
    if (s.tool === "lasso") {
      setSelected(expandGroups(d.items, lassoHits(d.items, s.loop)));
      return;
    }
    const sw = inkWidth(k, s.tool);
    const style: Partial<Item> = {};
    if (k.c !== "ink") style.c = k.c;
    if (k.ds) style.ds = true;
    if (isShape(s.tool)) {
      const [p0, p1] = shapePoints(s.tool, s.a, s.b, { shift: s.shift, alt: s.alt });
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 3 / z) return;
      const st = toStroke([p0, p1]);
      commit([{ op: "add", ref: newRef(), item: { k: "draw", x: st.x, y: st.y, d: st.d, sw, tl: s.tool, ...style } }]);
      return;
    }
    // end exactly where the pointer was released, not where the filter had got to
    const raw = s.raw ? [...s.pts, s.raw] : s.pts;
    const prs = s.raw ? [...s.pr, s.pr[s.pr.length - 1] ?? 0.5] : s.pr;
    let pts = finishStroke(raw, z, s.pointerType, k.sm);
    if (!pts.length) return;
    if (pts.length === 1) pts = [pts[0], pts[0]];
    const st = toStroke(pts);
    const item: Item = { k: "draw", x: st.x, y: st.y, d: st.d, sw, ...style };
    if (s.tool === "hl") item.tl = "hl";
    else if (k.sm > 0 && !k.ds) {
      item.sm = true;
      if (s.pointerType === "pen") {
        const pr = pressureDigits(raw, prs, pts);
        if (pr) item.pr = pr;
      }
    }
    commit([{ op: "add", ref: newRef(), item }]);
  };

  // ── pointer interaction ─────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    const d = docRef.current;
    if (!d || e.button === 2) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-nodrag], .hb-ctx, input, textarea, a, iframe, video")) return;
    if (connectFrom) {
      const hit = target.closest("[data-kid], [data-iid]") as HTMLElement | null;
      const to = hit?.dataset.kid ?? hit?.dataset.iid;
      if (to && to !== connectFrom && d.items[connectFrom]) commit([{ op: "add", ref: newRef(), item: { k: "line", a: connectFrom, b: to } }]);
      setConnectFrom(null);
      return;
    }
    if (editing && !target.closest(`[data-iid="${editing}"]`)) setEditing(null);
    // an active embed gives the pointer back to the board when you click outside it
    if (playing && d.items[playing]?.k === "embed" && !target.closest(`[data-iid="${playing}"], [data-kid="${playing}"]`)) setPlaying(null);
    const w = toWorld(e.clientX, e.clientY);
    lastPoint.current = w;
    const itemEl = target.closest("[data-iid]") as HTMLElement | null;
    const kidEl = target.closest("[data-kid]") as HTMLElement | null;
    const base = { sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (e.button === 1 || space.current || tool === "pan") {
      drag.current = { ...base, kind: "pan", view: { ...view.current } };
      vpRef.current?.classList.add("panning");
      return;
    }
    if (tool === "draw") {
      const k = inkRef.current;
      const p: Point = [w.x, w.y];
      if (k.tool === "eraser") {
        drag.current = { ...base, kind: "erase" };
        eraser.current = { trail: [p], sweep: true };
        erasingRef.current = new Set();
        scheduleLive();
        return;
      }
      if (k.tool === "lasso" && selBounds && selected.size && intersects(selBounds, { x: w.x, y: w.y, w: 0.01, h: 0.01 })) {
        drag.current = { ...base, kind: "move", ids: [...selected].filter((x) => d.items[x] && !d.items[x].in && d.items[x].k !== "line") };
        return;
      }
      const prm = k.tool === "pen" || k.tool === "hl" ? euroFor(e.pointerType || "mouse", k.sm) : null;
      const euro = prm ? new OneEuro2D(prm) : null;
      if (euro) euro.filter(e.clientX, e.clientY, e.timeStamp);
      stroke.current = {
        tool: k.tool, pointerType: e.pointerType || "mouse", euro, pts: [p], pr: [e.pressure || 0.5], raw: null, pred: null,
        a: p, b: p, shift: e.shiftKey, alt: e.altKey, loop: [p],
      };
      if (k.tool === "lasso") setSelected(new Set());
      drag.current = { ...base, kind: k.tool === "lasso" ? "lasso" : "ink" };
      scheduleLive();
      return;
    }
    if (tool === "arrow") {
      const from = (kidEl?.dataset.kid ?? itemEl?.dataset.iid) || null;
      if (from) {
        drag.current = { ...base, kind: "arrow", from };
        const r = getRect(from);
        if (r) setDraft({ from: r, to: [w.x, w.y] });
      }
      return;
    }
    if (target.closest(".hb-crop.br") && itemEl) {
      const id = itemEl.dataset.iid!;
      const r = getRect(id);
      drag.current = { ...base, kind: "resize", id, w0: r?.w ?? 200, h0: r?.h ?? 100 };
      return;
    }
    if (kidEl && tool === "select") {
      const id = kidEl.dataset.kid!;
      setSelected(new Set([id]));
      drag.current = { ...base, kind: "kid", id };
      return;
    }
    if (itemEl && tool === "select") {
      const id = itemEl.dataset.iid!;
      let sel = selected;
      const group = expandGroups(d.items, [id]);
      if (e.shiftKey) { sel = new Set(selected); if (sel.has(id)) group.forEach((x) => sel.delete(x)); else group.forEach((x) => sel.add(x)); }
      else if (!selected.has(id)) sel = group;
      setSelected(sel);
      drag.current = { ...base, kind: "move", ids: [...sel].filter((x) => d.items[x] && !d.items[x].in && d.items[x].k !== "line") };
      return;
    }
    if (PLACE.includes(tool)) {
      drag.current = { ...base, kind: "pan", view: { ...view.current } };
      return;
    }
    // background, select tool: shift = marquee, plain drag = pan
    if (e.shiftKey) {
      drag.current = { ...base, kind: "marquee" };
      setMarquee({ x: w.x, y: w.y, w: 0, h: 0 });
    } else {
      drag.current = { ...base, kind: "pan", view: { ...view.current } };
    }
  };

  const columnUnder = (cx: number, cy: number, skip?: string): { col: string; index: number } | null => {
    const d = docRef.current;
    for (const el of document.elementsFromPoint(cx, cy)) {
      const track = (el as HTMLElement).closest?.("[data-col]") as HTMLElement | null;
      if (!track) continue;
      const col = track.dataset.col!;
      if (col === skip || !d?.items[col]) continue;
      const kids = (d.items[col].kids ?? []).filter((k) => k !== skip);
      let index = kids.length;
      for (let i = 0; i < kids.length; i++) {
        const kel = els.current.get(kids[i]);
        if (kel) {
          const r = kel.getBoundingClientRect();
          if (cy < r.top + r.height / 2) { index = i; break; }
        }
      }
      return { col, index };
    }
    return null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool === "draw") onInkMove(e);
    const g = drag.current;
    if (!g || g.kind === "ink" || g.kind === "erase" || g.kind === "lasso") return;
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dx, dy) > 3) g.moved = true;
    if (!g.moved) return;
    const z = view.current.z;
    const w = toWorld(e.clientX, e.clientY);
    switch (g.kind) {
      case "pan":
        view.current = { ...view.current, x: g.view!.x + dx, y: g.view!.y + dy };
        applyView();
        break;
      case "move":
        setDelta({ dx: dx / z, dy: dy / z });
        break;
      case "resize":
        setResize({ id: g.id!, w: Math.max(120, g.w0! + dx / z), h: Math.max(40, g.h0! + dy / z) });
        break;
      case "marquee": {
        const s = toWorld(g.sx, g.sy);
        setMarquee({ x: Math.min(s.x, w.x), y: Math.min(s.y, w.y), w: Math.abs(w.x - s.x), h: Math.abs(w.y - s.y) });
        break;
      }
      case "arrow": {
        const r = getRect(g.from!);
        if (r) setDraft({ from: r, to: [w.x, w.y] });
        break;
      }
      case "kid": {
        const under = columnUnder(e.clientX, e.clientY, undefined);
        setKidDrag({ id: g.id!, x: w.x, y: w.y, col: under?.col ?? null, index: under?.index ?? 0 });
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = drag.current;
    drag.current = null;
    vpRef.current?.classList.remove("panning");
    const d = docRef.current;
    if (!g || !d) return;
    const w = toWorld(e.clientX, e.clientY);
    if (g.kind === "pan") {
      if (g.moved) { saveView(); return; }
      if (PLACE.includes(tool)) { placeAt(w); return; }
      setSelected(new Set());
      return;
    }
    if (g.kind === "move") {
      const dd = delta;
      setDelta(null);
      if (!g.moved || !dd || !g.ids?.length) return;
      if (g.ids.length === 1 && INTO_COLUMN.has(d.items[g.ids[0]].k)) {
        const under = columnUnder(e.clientX, e.clientY, g.ids[0]);
        if (under) { commit([{ op: "set", id: g.ids[0], p: { in: under.col }, at: under.index }]); return; }
      }
      commit(g.ids.map((id) => {
        const it = d.items[id];
        return { op: "set", id, p: { x: Math.round((it.x ?? 0) + dd.dx), y: Math.round((it.y ?? 0) + dd.dy) } } as Op;
      }));
      return;
    }
    if (g.kind === "resize") {
      const r = resize;
      setResize(null);
      if (!r) return;
      commit([{ op: "set", id: r.id, p: resizePatch(d.items[r.id].k, r.w, r.h) }]);
      return;
    }
    if (g.kind === "marquee") {
      const m = marquee;
      setMarquee(null);
      if (!m) return;
      const sel = new Set<string>();
      for (const [id, it] of Object.entries(d.items)) {
        if (it.in || it.k === "line") continue;
        const r = getRect(id);
        if (r && intersects(r, m)) sel.add(id);
      }
      setSelected(expandGroups(d.items, sel));
      return;
    }
    if (g.kind === "ink" || g.kind === "lasso") { finishInk(d); return; }
    if (g.kind === "erase") {
      drawLive(); // fold in the last stretch of the sweep before reading it
      if (eraser.current) { eraser.current.sweep = false; eraser.current.trail = []; }
      const ids = [...erasingRef.current].filter((id) => d.items[id]);
      erasingRef.current = new Set();
      setErasing(new Set());
      if (ids.length) commit(ids.map((id) => ({ op: "del", id }) as Op));
      return;
    }
    if (g.kind === "arrow") {
      setDraft(null);
      if (!g.moved) return;
      let to: string | Point = [Math.round(w.x), Math.round(w.y)];
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        const hit = (el as HTMLElement).closest?.("[data-kid], [data-iid]") as HTMLElement | null;
        const id = hit?.dataset.kid ?? hit?.dataset.iid;
        if (id && id !== g.from) { to = id; break; }
      }
      commit([{ op: "add", ref: newRef(), item: { k: "line", a: g.from!, b: to } }]);
      return;
    }
    if (g.kind === "kid") {
      const k = kidDrag;
      setKidDrag(null);
      if (!g.moved || !k) return;
      const it = d.items[k.id];
      if (k.col && k.col === it.in) {
        const kids = (d.items[k.col].kids ?? []).filter((x) => x !== k.id);
        kids.splice(k.index, 0, k.id);
        commit([{ op: "set", id: k.col, p: { kids } }]);
      } else if (k.col) {
        commit([{ op: "set", id: k.id, p: { in: k.col }, at: k.index }]);
      } else {
        commit([{ op: "set", id: k.id, p: { in: null, x: Math.round(w.x - 20), y: Math.round(w.y - 12) } }]);
      }
    }
  };

  const placeAt = (w: { x: number; y: number }) => {
    const at = { x: Math.round(w.x), y: Math.round(w.y) };
    lastPoint.current = at;
    const kind = tool;
    setTool("select");
    if (kind === "note") add({ k: "card", w: 256 }, at, true);
    else if (kind === "todo") add({ k: "todo", title: t("board.todo.title"), items: [] }, at, false);
    else if (kind === "col") add({ k: "col", title: t("board.col.title") }, at, true);
    else if (kind === "link") { setAskValue(""); setAsk({ kind: "link", at }); }
    else if (kind === "embed") { setAskValue(""); setAsk({ kind: "embed", at }); }
    else if (kind === "image") fileRef.current?.click();
    else if (kind === "board") {
      void boardsApi.create(t("board.untitled"), bid).then((child) => add({ k: "board", ref: child.id }, at))
        .catch((e) => flash(String(e?.message ?? e)));
    }
  };

  // Mouse wheel and pinch zoom around the pointer; a two-finger trackpad scroll pans
  // (geometry.wheelIntent). Shift+wheel pans sideways. A scrollable textarea being edited
  // keeps its own scroll; an active embed or playing video gets the wheel inside its iframe.
  const lastTrackpad = useRef(0);
  const onWheel = useCallback((e: WheelEvent) => {
    const target = e.target as HTMLElement;
    const ta = target.closest?.("textarea") as HTMLTextAreaElement | null;
    if (ta && ta.scrollHeight > ta.clientHeight + 1 && !e.ctrlKey && !e.metaKey) return;
    // an active embed or a playing video owns the wheel (inactive ones sit behind a shield)
    if (target.tagName === "IFRAME" || target.tagName === "VIDEO") return;
    e.preventDefault();
    const rect = vpRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const now = performance.now();
    const intent = e.shiftKey && !e.ctrlKey && !e.metaKey ? "pan" : wheelIntent(e, now - lastTrackpad.current < 400);
    if (intent === "zoom") {
      if (e.ctrlKey || e.metaKey) zoomAt(wheelZoomFactor(e), sx, sy);
      else zoomSmooth(wheelZoomFactor(e), sx, sy);
      return;
    }
    if (!e.shiftKey) lastTrackpad.current = now;
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    view.current = { ...view.current, x: view.current.x - dx, y: view.current.y - dy };
    applyView();
    saveView();
  }, [applyView, saveView, zoomAt, zoomSmooth]);

  // The viewport only exists once the board has loaded: (re)attach then.
  const hasDoc = !!doc;
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [onWheel, hasDoc]);

  // ── keyboard, paste, drop ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current?.isConnected || ask || confirmReq) return;
      const live = stroke.current;
      if (live && isShape(live.tool) && (e.key === "Shift" || e.key === "Alt")) {
        live.shift = e.shiftKey;
        live.alt = e.altKey;
        if (e.key === "Alt") e.preventDefault();
        scheduleLive();
        return;
      }
      if (e.key === " " && !isTyping(e.target)) { space.current = e.type === "keydown"; if (e.type === "keydown") e.preventDefault(); return; }
      if (e.type !== "keydown" || isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) sync.redo(); else sync.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); sync.redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); return; }
      if (mod && e.key.toLowerCase() === "g") { e.preventDefault(); toggleGroup(); return; }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const d = docRef.current;
        if (d) setSelected(new Set(Object.keys(d.items).filter((id) => !d.items[id].in)));
        return;
      }
      if (mod && e.key === "Enter") { e.preventDefault(); void continueInSession(); return; }
      if (mod || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); return; }
      if (e.key === "Escape") {
        if (connectFrom) { setConnectFrom(null); return; }
        if (stroke.current) { stroke.current = null; drag.current = null; scheduleLive(); return; }
        setSelected(new Set()); setTool("select"); setEditing(null); return;
      }
      if (e.key === "Enter" && selected.size === 1) {
        const id = [...selected][0];
        const it = docRef.current?.items[id];
        if (it && EDITABLE.has(it.k)) { e.preventDefault(); setEditing(id); }
        return;
      }
      if (e.key === "/") { e.preventDefault(); openChat(true); return; }
      if (e.key === "f" || e.key === "F") { fit(); return; }
      if (e.key === "+" || e.key === "=") { const vp = vpRef.current!; zoomAt(1.2, vp.clientWidth / 2, vp.clientHeight / 2); return; }
      if (e.key === "-") { const vp = vpRef.current!; zoomAt(1 / 1.2, vp.clientWidth / 2, vp.clientHeight / 2); return; }
      if (e.key.startsWith("Arrow") && selected.size) {
        e.preventDefault();
        const d = docRef.current!;
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
        commit([...selected].filter((id) => d.items[id] && !d.items[id].in && d.items[id].k !== "line")
          .map((id) => ({ op: "set", id, p: { x: (d.items[id].x ?? 0) + dx, y: (d.items[id].y ?? 0) + dy } }) as Op));
        return;
      }
      // Draw tool keys. E is the eraser while drawing (the HTML-embed shortcut otherwise).
      if (e.key.toLowerCase() === "d" && e.shiftKey) { setTool("draw"); setInk({ ...inkRef.current, tool: "hl" }); return; }
      if (tool === "draw") {
        const k = inkRef.current;
        if (e.key === "[" || e.key === "]") { setInk(stepWidth(k, e.key === "]" ? 1 : -1)); return; }
        if (/^[1-6]$/.test(e.key)) { setInk({ ...k, c: INK_COLORS[Number(e.key) - 1] }); return; }
        if (e.key.toLowerCase() === "e") { setInk({ ...k, tool: "eraser" }); return; }
        if (e.key.toLowerCase() === "d") { setInk({ ...k, tool: "pen" }); return; }
      }
      const tl = KEY_TOOL[e.key.toLowerCase()];
      if (tl) {
        if (tl === "image") { fileRef.current?.click(); return; }
        if (tl === "link" || tl === "embed") { setAskValue(""); setAsk({ kind: tl, at: lastPoint.current ?? center() }); return; }
        setTool(tl);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, [ask, center, commit, confirmReq, connectFrom, continueInSession, deleteSelection, duplicate, fit, openChat, scheduleLive, selected, setInk, sync, tool, toggleGroup, zoomAt]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!rootRef.current?.isConnected || isTyping(e.target) || ask) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/") || VIDEO_TYPES.test(f.type));
      if (files.length) { e.preventDefault(); void addImageFiles(files); return; }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const url = extractUrl(text);
      if (url) { e.preventDefault(); addUrl(url); return; }
      if (text.trim()) { e.preventDefault(); add({ k: "card", text: text.trim().slice(0, 5000), w: 256 }); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [add, addImageFiles, addUrl, ask]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const at = toWorld(e.clientX, e.clientY);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/") || VIDEO_TYPES.test(f.type));
    if (files.length) { void addImageFiles(files, at); return; }
    const url = extractUrl(e.dataTransfer.getData("text/uri-list").split("\n")[0] || e.dataTransfer.getData("text/plain"));
    if (url) addUrl(url, at);
  };

  // ── render ──────────────────────────────────────────────────────────────
  const pres = sync.presence && (!doc?.hermes || sync.presence.at >= doc.hermes.at) ? sync.presence : doc?.hermes ?? null;
  const hermesActive = !!(pres && Date.now() / 1000 - pres.at < HERMES_ACTIVE_S) || !!cursorAct;
  const presenceLabel = (() => {
    if (!doc) return "";
    const on = pres?.on ? doc.items[pres.on] : null;
    const r = on ? approxRect(on) : null;
    const frame = r ? Object.values(doc.items).find((f) => {
      if (f.k !== "frame") return false;
      const fr = approxRect(f);
      return !!fr && r.x >= fr.x && r.y >= fr.y && r.x <= fr.x + fr.w && r.y <= fr.y + fr.h;
    }) : null;
    return frame?.title || (on ? itemLabel(on).slice(0, 28) : "") || doc.name;
  })();

  const regEl = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const ctx: ItemCtx | null = useMemo(() => (doc ? {
    doc, t, editing, setEditing, update, commit, playing, setPlaying, Frame, liveActions, liveActionsDown, runLiveAction, erasing,
    openBoard: (id) => onOpenBoard(id),
    addToColumn: (col) => {
      const ref = newRef();
      commit([{ op: "add", ref, item: { k: "card", in: col } }]);
      setSelected(new Set([ref]));
      setEditing(ref);
    },
    renderKid: (id) => {
      const it = doc.items[id];
      if (!it) return null;
      const cls = `hb-kid${selected.has(id) ? " sel" : ""}${kidDrag?.id === id ? " ghost" : ""}${hidden.has(id) ? " reveal-wait" : ""}`;
      return (
        <div key={id} className={cls} data-kid={id} ref={regEl(id)}
          onDoubleClick={(e) => { e.stopPropagation(); if (EDITABLE.has(it.k)) setEditing(id); }}>
          <ItemBody id={id} item={it} c={ctxRef.current!} dropIndex={null} selected={selected.has(id)} />
        </div>
      );
    },
  } : null), [Frame, commit, doc, editing, erasing, hidden, kidDrag, liveActions, liveActionsDown, onOpenBoard, playing, regEl, runLiveAction, selected, t, update]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const selBounds = useMemo(() => {
    if (!doc || !selected.size || delta || resize) return null;
    const rects = [...selected].map((id) => getRect(id)).filter(Boolean) as Rect[];
    return boundsOf(rects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, selected, delta, resize, layoutV, getRect]);

  const selKinds = doc ? [...selected].map((id) => doc.items[id]?.k).filter(Boolean) : [];
  const ctxLabel = (() => {
    if (!doc || !selKinds.length) return "";
    if (selKinds.length > 1) return t("board.ctx.items", { n: selKinds.length });
    const it = doc.items[[...selected][0]];
    if (it.k === "todo") return t("board.ctx.todo", { n: it.items?.length ?? 0 });
    if (it.k === "col") return t("board.ctx.col", { n: it.kids?.length ?? 0 });
    return t(`board.kind.${it.k}` as MessageKey);
  })();
  const hermesVerbs = (() => {
    if (!selKinds.length) return [] as MessageKey[];
    if (selKinds.length > 1 && selKinds.every((k) => k === "draw")) return ["board.verb.diagram"] as MessageKey[];
    if (selKinds.length > 1) return ["board.verb.group", "board.verb.summarize"] as MessageKey[];
    switch (selKinds[0]) {
      case "draw": return ["board.verb.diagram"] as MessageKey[];
      case "todo": return ["board.verb.sortDate", "board.verb.split"] as MessageKey[];
      case "card": return ["board.verb.expand", "board.verb.split"] as MessageKey[];
      case "col": return ["board.verb.flow"] as MessageKey[];
      case "link": case "video": case "live": return ["board.verb.summarize"] as MessageKey[];
      default: return ["board.verb.improve"] as MessageKey[];
    }
  })();

  // ── selection actions (shared by the selection bar and the right-click menu) ──
  const selIds = doc ? [...selected].filter((id) => doc.items[id]) : [];
  const single = selIds.length === 1 ? doc!.items[selIds[0]] : null;
  const canEdit = !!single && EDITABLE.has(single.k);
  const canDuplicate = !!doc && selIds.some((id) => doc.items[id].k !== "line" && doc.items[id].k !== "col");
  const canConnect = !!single && single.k !== "line";
  const openTarget: { board: string } | { url: string } | null = single?.k === "board" && single.ref ? { board: single.ref } : single && (single.k === "link" || single.k === "video") && (single.url || single.src) ? { url: (single.url || single.src)! } : null;
  const mod = modKey();
  const runOpen = () => {
    if (!openTarget) return;
    if ("board" in openTarget) onOpenBoard(openTarget.board);
    else window.open(openTarget.url, "_blank", "noopener,noreferrer");
  };
  const startConnect = () => { if (selIds.length === 1) { setConnectFrom(selIds[0]); setTool("select"); } };
  const canGroup = !!doc && selIds.length > 1 && selIds.every((id) => doc.items[id].k === "draw");
  const groupOf = new Set(selIds.map((id) => doc?.items[id]?.g));
  const isGrouped = canGroup && groupOf.size === 1 && !groupOf.has(undefined);

  useLayoutEffect(() => {
    const selecting = tool === "select" || (tool === "draw" && ink.tool === "lasso");
    selRef.current = selBounds && selKinds.length && selecting && !connectFrom && !menu ? selBounds : null;
    placeCtx();
  });
  useEffect(() => (rootRef.current ? installTips(rootRef.current) : undefined), [!!doc]);

  const onContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, a, iframe, video, [contenteditable]")) return;
    e.preventDefault();
    const d = docRef.current, root = rootRef.current;
    if (!d || !root) return;
    const hit = target.closest("[data-kid], [data-iid]") as HTMLElement | null;
    const id = hit?.dataset.kid ?? hit?.dataset.iid;
    if (id && d.items[id] && !selected.has(id)) setSelected(new Set([id]));
    if (!id && !target.closest(".hb-wires .hit")) setSelected(new Set());
    const rr = root.getBoundingClientRect();
    const at = toWorld(e.clientX, e.clientY);
    lastPoint.current = at;
    setTool("select");
    setEditing(null);
    setMenu({ x: e.clientX - rr.left, y: e.clientY - rr.top, at, onItem: !!id || selected.size > 0 && !!target.closest(".hb-wires .hit") });
  };

  const menuEntries = (): MenuEntry[] => {
    if (!menu) return [];
    if (menu.onItem && selIds.length) {
      const out: MenuEntry[] = [];
      if (hermesVerbs.length) {
        out.push({ head: t("board.menu.askHermes"), hermes: true });
        hermesVerbs.forEach((v) => out.push({ id: v, label: t(v), icon: VERB_ICON[v], hermes: true, run: () => void sendToHermes(t(v)) }));
        out.push({ sep: true });
      }
      if (canEdit) out.push({ id: "edit", label: t("board.ctx.edit"), icon: "edit", kbd: "↵", run: () => setEditing(selIds[0]) });
      if (openTarget) out.push({ id: "open", label: t("board.ctx.open"), icon: "board" in openTarget ? "openBoard" : "open", run: runOpen });
      if (canConnect) out.push({ id: "connect", label: t("board.ctx.connect"), icon: "connect", run: startConnect });
      if (canDuplicate) out.push({ id: "dup", label: t("board.ctx.duplicate"), icon: "duplicate", kbd: `${mod}D`, run: duplicate });
      if (canGroup) out.push({ id: "grp", label: t(isGrouped ? "board.ctx.ungroup" : "board.ctx.group"), icon: isGrouped ? "ungroup" : "group", kbd: `${mod}G`, run: toggleGroup });
      out.push({ sep: true });
      out.push({ id: "del", label: t("board.ctx.delete"), icon: "delete", kbd: "Del", danger: true, run: deleteSelection });
      return out;
    }
    const at = menu.at;
    const place = (tl: Tool) => () => {
      lastPoint.current = at;
      if (tl === "note") add({ k: "card", w: 256 }, at, true);
      else if (tl === "todo") add({ k: "todo", title: t("board.todo.title"), items: [] }, at, false);
      else if (tl === "col") add({ k: "col", title: t("board.col.title") }, at, true);
      else if (tl === "link" || tl === "embed") { setAskValue(""); setAsk({ kind: tl, at }); }
      else if (tl === "image") fileRef.current?.click();
      else if (tl === "board") void boardsApi.create(t("board.untitled"), bid).then((child) => add({ k: "board", ref: child.id }, at)).catch((err) => flash(String(err?.message ?? err)));
    };
    const out: MenuEntry[] = [{ head: t("board.menu.addHere") }];
    for (const x of TOOLS[1]) out.push({ id: x.tool, label: t(x.label), icon: x.icon, kbd: x.key, run: place(x.tool) });
    out.push({ sep: true });
    out.push({ id: "all", label: t("board.menu.selectAll"), icon: "selectAll", kbd: `${mod}A`, run: () => setSelected(new Set(Object.keys(docRef.current?.items ?? {}).filter((k) => !docRef.current!.items[k].in))) });
    out.push({ id: "fit", label: t("board.fit"), icon: "fit", kbd: "F", run: fit });
    out.push({ id: "chat", label: chatOpen ? t("board.chat.close") : t("board.chat.open"), icon: chatOpen ? "closePanel" : "chat", kbd: "/", run: () => (chatOpen ? closeChat() : openChat(true)) });
    return out;
  };

  // The board keeps at least 620 px beside the chat; below that the chat floats over it.
  const chatFloat = rootW - CHAT_MIN_W < 620;
  const chatWidth = chatFloat ? Math.min(chatW, Math.max(260, rootW - 48)) : Math.min(chatW, rootW - 620);
  const rootCls = `hb ${narrow}${chatOpen ? (chatFloat ? " chat-float" : " chat-open") : ""}`.trim();
  if (!doc || !ctx) {
    return (
      <div ref={rootRef} className={rootCls}>
        <header className="hb-top"><nav className="hb-path"><span className="mark"><Cad /></span>
          <button onClick={onHome}>{t("board.path.home")}</button><span className="sl">/</span>
          <button onClick={() => onOpenBoard(null)}>{t("board.path.boards")}</button><span className="sl">/</span></nav></header>
        <div className="hb-empty"><div className="hd">{sync.error ? t("board.loadFailed") : t("common.loading")}</div>
          {sync.error && <p>{sync.error}</p>}</div>
      </div>
    );
  }

  const items = Object.entries(doc.items).filter(([, it]) => !it.in && it.k !== "line");
  // frames at the back, highlighter strokes above them but under the ink, then everything else
  const layer = (it: Item) => (it.k === "frame" ? 0 : it.k === "draw" && it.tl === "hl" ? 1 : 2);
  items.sort(([, a], [, b]) => layer(a) - layer(b));
  const sessionShort = doc.session?.id ? doc.session.id.slice(-4) : null;
  const savedTs = sync.savedAt ? sync.savedAt / 1000 : doc.updated;
  const vpCls = `hb-viewport${tool === "pan" ? " tool-pan" : ""}${tool === "draw" ? ` tool-draw ink-${ink.tool}` : ""}${tool === "arrow" || connectFrom ? " tool-arrow" : ""}${PLACE.includes(tool) ? " tool-place" : ""}`;
  const hint = connectFrom ? t("board.hint.connect") : tool === "draw" ? t(INK_HINT[ink.tool]) : TOOL_HINT[tool] ? t(TOOL_HINT[tool]!) : "";
  const zoomBy = (f: number) => { const vp = vpRef.current!; zoomAt(f, vp.clientWidth / 2, vp.clientHeight / 2); };

  return (
    <div ref={rootRef} className={rootCls} style={{ ["--chat-w" as string]: `${chatWidth}px` }}>
      <div className={vpCls} ref={vpRef} tabIndex={-1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onContextMenu={onContextMenu}
        onDoubleClick={(e) => {
          if (tool === "draw") return;
          const target = e.target as HTMLElement;
          const iid = (target.closest("[data-iid]") as HTMLElement | null)?.dataset.iid;
          if (iid) { const it = doc.items[iid]; if (it && EDITABLE.has(it.k)) setEditing(iid); return; }
          if (target.closest("[data-nodrag], .hb-ctx")) return;
          add({ k: "card", w: 256 }, toWorld(e.clientX, e.clientY), true);
        }}
        onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <div className="hb-grid" ref={gridRef} />
        <div className="hb-world" ref={worldRef}>
          <Wires doc={doc} getRect={getRect} version={layoutV + (delta ? 1 : 0)} hidden={hidden} fresh={fresh}
            selected={selected} draft={draft}
            onSelect={(id, additive) => setSelected((s) => { const n = additive ? new Set(s) : new Set<string>(); n.add(id); return n; })} />
          {items.map(([id, it]) => {
            const sel = selected.has(id);
            const moving = delta && sel;
            const x = (it.x ?? 0) + (moving ? delta!.dx : 0);
            const y = (it.y ?? 0) + (moving ? delta!.dy : 0);
            const rs = resize?.id === id ? resize : null;
            const [dw] = DEFAULT_SIZE[it.k] ?? [200, 100];
            const width = it.k === "draw" ? undefined : (rs?.w ?? it.w ?? (it.k === "text" ? undefined : dw));
            const height = RESIZE_H.has(it.k) ? (rs?.h ?? it.h ?? (it.k === "frame" ? 320 : it.k === "box" ? 62 : undefined)) : undefined;
            const cls = `hb-item${sel ? " sel" : ""}${moving ? " dragging" : ""}${hidden.has(id) ? " reveal-wait" : ""}${fresh.has(id) && !reduced() ? " just-placed" : ""}${connectFrom === id ? " connect-from" : ""}`;
            const dropIndex = kidDrag?.col === id ? kidDrag.index : null;
            return (
              <div key={id} className={cls} data-iid={id} ref={regEl(id)}
                style={{ left: x, top: y, width, height, zIndex: layer(it) < 2 ? 0 : sel ? 3 : 1 }}>
                <ItemBody id={id} item={it} c={ctx} dropIndex={dropIndex} selected={sel} />
                {sel && it.k !== "draw" && selected.size === 1 && (
                  <><i className="hb-crop tl" /><i className="hb-crop tr" /><i className="hb-crop bl" /><i className="hb-crop br" /></>
                )}
              </div>
            );
          })}
          {kidDrag && doc.items[kidDrag.id] && (
            <div className="hb-ghost" style={{ left: kidDrag.x - 20, top: kidDrag.y - 12, width: 264 }}>
              <ItemBody id={kidDrag.id} item={doc.items[kidDrag.id]} c={ctx} dropIndex={null} selected />
            </div>
          )}
          {tool === "draw" && (
            <svg ref={liveSvgRef} className="hb-draw hb-live" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width="1" height="1">
              <path ref={livePathRef} d="" />
              <path ref={liveHeadRef} d="" />
            </svg>
          )}
          {marquee && <div className="hb-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
          <HermesCursor ref={cursorRef} reducedMotion={reduced()} onActive={(on, act) => setCursorAct(on ? act : null)} />
        </div>
        {tool === "draw" && ink.tool === "eraser" && <div className="hb-eraser" ref={ringRef} style={{ width: ERASER_R * 2, height: ERASER_R * 2 }} />}
        {items.length === 0 && (
          <div className="hb-empty">
            <span className="ico"><Icon name="note" size={18} /></span>
            <div className="hd">{t("board.empty.title")}</div>
            <p>{t("board.empty.body")}</p>
          </div>
        )}
      </div>

      {selKinds.length > 0 && (
        <div className="hb-ctx" ref={ctxEl} role="toolbar" aria-label={ctxLabel} style={{ visibility: "hidden" }}
          onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          <span className="kind">{ctxLabel}</span>
          {hermesVerbs.length > 0 && (
            <>
              <i className="sep" />
              <span className="hm-mark" data-tip={t("board.menu.askHermes")}><Cad /></span>
              {hermesVerbs.map((v) => (
                <button key={v} className="act hm" data-tip={t("board.ctx.askTip", { verb: t(v) })} onClick={() => void sendToHermes(t(v))}>
                  <Icon name={VERB_ICON[v]} />{t(v)}
                </button>
              ))}
            </>
          )}
          <i className="sep" />
          {canEdit && <button className="ib" data-tip={t("board.ctx.edit")} data-kbd="↵" aria-label={t("board.ctx.edit")} onClick={() => setEditing(selIds[0])}><Icon name="edit" /></button>}
          {openTarget && <button className="ib" data-tip={t("board.ctx.open")} aria-label={t("board.ctx.open")} onClick={runOpen}><Icon name={"board" in openTarget ? "openBoard" : "open"} /></button>}
          {canConnect && <button className="ib" data-tip={t("board.ctx.connect")} aria-label={t("board.ctx.connect")} onClick={startConnect}><Icon name="connect" /></button>}
          {canDuplicate && <button className="ib" data-tip={t("board.ctx.duplicate")} data-kbd={`${mod}D`} aria-label={t("board.ctx.duplicate")} onClick={duplicate}><Icon name="duplicate" /></button>}
          {canGroup && <button className="ib" data-tip={t(isGrouped ? "board.ctx.ungroup" : "board.ctx.group")} data-kbd={`${mod}G`} aria-label={t(isGrouped ? "board.ctx.ungroup" : "board.ctx.group")} onClick={toggleGroup}><Icon name={isGrouped ? "ungroup" : "group"} /></button>}
          <button className="ib danger" data-tip={t("board.ctx.delete")} data-kbd="Del" aria-label={t("board.ctx.delete")} onClick={deleteSelection}><Icon name="delete" /></button>
        </div>
      )}

      <header className="hb-top">
        <nav className="hb-path">
          <span className="mark"><Cad /></span>
          <button onClick={onHome}>{t("board.path.home")}</button><span className="sl">/</span>
          <button onClick={() => onOpenBoard(null)}>{t("board.path.boards")}</button><span className="sl">/</span>
          {doc.parent && <><button onClick={() => onOpenBoard(doc.parent)}>{t("board.path.parent")}</button><span className="sl">/</span></>}
        </nav>
        <span className="hb-btitle" onDoubleClick={() => setRenaming(true)} data-tip={t("board.renameHint")}>
          {renaming
            ? <input autoFocus defaultValue={doc.name}
                onBlur={(e) => { setRenaming(false); const v = e.target.value.trim(); if (v && v !== doc.name) commit([{ op: "board", p: { name: v } }]); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
            : doc.name}
        </span>
        {hermesActive && (
          <>
            <span className="vsep" />
            <span className="hb-presence"><span className="tagh"><Cad />HERMES</span>{t("board.presence.editing")} <b>{presenceLabel}</b></span>
          </>
        )}
        <span className="spacer" />
        <span className="hb-state">
          <span>{t("board.state.saved", { time: clock(savedTs) })}</span>
          <span className="sess">{sessionShort ? <>{t("board.state.session")} <b>#{sessionShort}</b></> : t("board.state.noSession")}</span>
        </span>
        <button className={`ib lg${chatOpen ? " on" : ""}`} aria-pressed={chatOpen} aria-label={chatOpen ? t("board.chat.close") : t("board.chat.open")}
          data-tip={chatOpen ? t("board.chat.close") : t("board.chat.open")} data-kbd="/"
          onClick={() => (chatOpen ? closeChat() : openChat(true))}>
          <Icon name="chat" size={15} />
        </button>
        <button className="btn primary" data-tip={t("board.continueTip")} data-kbd={`${mod}↵`} onClick={() => void continueInSession()}>
          <Icon name="open" />{t("board.continue")}
        </button>
      </header>

      {tool === "draw" && <InkBar ink={ink} onChange={setInk} t={t} />}

      <footer className="hb-status">
        {TOOLS.map((group, gi) => (
          <div className="seg" key={gi}>
            {group.map((x) => (
              <button key={x.tool} className={`tool${tool === x.tool ? " on" : ""}`} aria-label={t(x.label)} aria-pressed={tool === x.tool}
                data-tip={t(x.label)} data-kbd={x.key}
                onClick={() => {
                  setConnectFrom(null);
                  if (x.tool === "image") { fileRef.current?.click(); return; }
                  if (x.tool === "link" || x.tool === "embed") { setAskValue(""); setAsk({ kind: x.tool, at: center() }); return; }
                  setTool(x.tool);
                }}>
                <Icon name={x.icon} size={15} />
              </button>
            ))}
          </div>
        ))}
        <span className="hint" aria-live="polite">{hint}</span>
        <div className="seg">
          <button className="tool" disabled={!sync.canUndo} aria-label={t("board.undo")} data-tip={t("board.undo")} data-kbd={`${mod}Z`} onClick={sync.undo}><Icon name="undo" size={15} /></button>
          <button className="tool" disabled={!sync.canRedo} aria-label={t("board.redo")} data-tip={t("board.redo")} data-kbd={`${mod}⇧Z`} onClick={sync.redo}><Icon name="redo" size={15} /></button>
        </div>
        <div className="seg zoom">
          <button className="tool" aria-label={t("board.zoomOut")} data-tip={t("board.zoomOut")} data-kbd="−" onClick={() => zoomBy(1 / 1.2)}><Icon name="zoomOut" size={15} /></button>
          <span className="pct" ref={pctRef}>{Math.round(view.current.z * 100)}%</span>
          <button className="tool" aria-label={t("board.zoomIn")} data-tip={t("board.zoomIn")} data-kbd="+" onClick={() => zoomBy(1.2)}><Icon name="zoomIn" size={15} /></button>
          <button className="tool" aria-label={t("board.fit")} data-tip={t("board.fit")} data-kbd="F" onClick={fit}><Icon name="fit" size={15} /></button>
        </div>
      </footer>

      <div className={`hb-map${items.length ? "" : " off"}`} data-tip={t("board.map")} onClick={(e) => {
        const b = contentBounds();
        const canvas = mapRef.current, vp = vpRef.current;
        if (!b || !canvas || !vp) return;
        const r = canvas.getBoundingClientRect();
        const pad = 30, s = Math.min(r.width / (b.w + pad * 2), r.height / (b.h + pad * 2));
        const ox = (r.width - b.w * s) / 2 - b.x * s, oy = (r.height - b.h * s) / 2 - b.y * s;
        const wx = (e.clientX - r.left - ox) / s, wy = (e.clientY - r.top - oy) / s;
        const v = view.current;
        view.current = { ...v, x: vp.clientWidth / 2 - wx * v.z, y: vp.clientHeight / 2 - wy * v.z };
        applyView();
        saveView();
      }}>
        <canvas ref={mapRef} width={384} height={208} />
      </div>

      <div className={`hb-log${logOn && log.length ? "" : " off"}`} role="log">
        <button className="x ib" aria-label={t("board.log.close")} data-tip={t("board.log.close")} onClick={() => setLogOn(false)}><Icon name="close" size={13} /></button>
        {log.filter((l) => l.who === "hermes").slice(-2).map((l) => (
          <div className="row" key={l.key}>
            <span className="t">{clock(l.t)}</span>
            <span className="who"><Cad />hermes</span>
            <span className="msg">{l.msg}</span>
            <span className="acts">
              {l.s != null && <button onClick={() => sync.undoEntry(l.s!)}><Icon name="undo" size={13} />{t("board.log.undo")}</button>}
              <button onClick={() => openChat(false)}><Icon name="chat" size={13} />{t("board.log.openChat")}</button>
            </span>
          </div>
        ))}
      </div>

      {chatOpen && (
        <ChatPanel doc={doc} t={t} width={chatWidth} selected={selIds} sentAt={chatSentAt} inputRef={chatInputRef}
          onWidth={resizeChat} onClose={closeChat} onContinue={() => void continueInSession()} onSent={onChatSent} />
      )}

      {menu && rootRef.current && (
        <BoardMenu at={{ x: menu.x, y: menu.y }} entries={menuEntries()} onClose={() => setMenu(null)}
          bounds={{ x: 0, y: 0, w: rootRef.current.clientWidth, h: rootRef.current.clientHeight }} />
      )}

      {ask && (
        <div className="hb-ask" onPointerDown={(e) => e.stopPropagation()}>
          <div className="hd">{ask.kind === "link" ? t("board.ask.link") : t("board.ask.embed")}</div>
          {ask.kind === "link"
            ? <input autoFocus value={askValue} placeholder="https://" onChange={(e) => setAskValue(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") submitAsk(); if (e.key === "Escape") setAsk(null); }} />
            : <textarea autoFocus value={askValue} placeholder="<!doctype html>…" onChange={(e) => setAskValue(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setAsk(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAsk(); }} />}
          <div className="row">
            <span className="hint">{ask.kind === "link" ? t("board.ask.linkHint") : t("board.ask.embedHint", { mod })}</span>
            <button className="btn text" onClick={() => setAsk(null)}>{t("board.ask.cancel")}</button>
            <button className="btn primary" onClick={submitAsk}>{t("board.ask.add")}</button>
          </div>
        </div>
      )}
      {confirmReq && (
        <div className="hb-scrim" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) confirmReq.resolve(false); }}>
          <div className="hb-confirm" role="alertdialog" aria-modal="true" aria-labelledby="hb-confirm-t"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") confirmReq.resolve(false); }}>
            <div className="hd">{t("board.live.confirmHead")}</div>
            <h3 id="hb-confirm-t"><span className="ico"><Icon name="alert" size={16} /></span>
              {t("board.live.confirmTitle", { action: confirmReq.ref.label || confirmReq.info.label })}</h3>
            <p>{confirmReq.info.confirm || confirmReq.info.description || t("board.live.confirmBody")}</p>
            <div className="facts">
              <span>{t("board.live.confirmCard")} <b>{doc.items[confirmReq.iid]?.title || itemLabel(doc.items[confirmReq.iid] ?? { k: "live" }) || confirmReq.iid}</b></span>
              <span>{t("board.live.confirmId")} <b>{confirmReq.info.id}</b></span>
              <span>{t("board.live.confirmTimeout", { s: confirmReq.info.timeout })}</span>
            </div>
            <div className="row">
              <button className="btn text" autoFocus onClick={() => confirmReq.resolve(false)}>{t("board.ask.cancel")}</button>
              <button className="btn danger" onClick={() => confirmReq.resolve(true)}>
                <Icon name="alert" />{confirmReq.ref.label || confirmReq.info.label}</button>
            </div>
          </div>
        </div>
      )}
      {(toast || sync.error) && <div className="hb-toast" role="status">{toast || t("board.toast.offline")}</div>}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime" multiple hidden
        onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; void addImageFiles(files, lastPoint.current ?? undefined); }} />
    </div>
  );

  function submitAsk() {
    if (!ask) return;
    const v = askValue.trim();
    if (ask.kind === "link") {
      const url = extractUrl(v) ?? extractUrl(`https://${v}`);
      if (!url || !addUrl(url, ask.at)) { flash(t("board.toast.badUrl")); return; }
      setAsk(null);
      return;
    }
    if (!v) return;
    const at = ask.at;
    setAsk(null);
    void boardsApi.uploadHtml(v).then((r) => add({ k: "embed", asset: r.asset, title: t("board.embed.title") }, at))
      .catch((e) => flash(String(e?.message ?? e)));
  }
}

/** "rgb(r, g, b)" / "rgba(…)" → the same colour at `a` alpha (the grid crosses follow the theme). */
function withAlpha(color: string, a: number): string {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${a})` : `rgba(255,227,196,${a})`;
}

function accentColor(el: HTMLElement | null): string {
  if (!el) return "#ffe3c4";
  const probe = document.createElement("span");
  probe.style.color = "var(--accent)";
  probe.style.display = "none";
  el.appendChild(probe);
  const c = getComputedStyle(probe).color || "#ffe3c4";
  probe.remove();
  return c;
}

