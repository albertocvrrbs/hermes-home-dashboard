// The board page: title line, infinite table, status line, map, Hermes log and cursor.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT, type MessageKey } from "../home/i18n";
import { hostRpc, hostSandboxedFrame, newChatWithDraft, openSession } from "../sdk";
import { boardsApi, prepareImage } from "./api";
import { Cad, clock } from "./bits";
import { boundsOf, fitView, intersects, RESIZE_H, resizePatch, simplify, strokePath, toStroke, type Rect, type View } from "./geometry";
import { HermesCursor, type CursorHandle, type CursorStep } from "./HermesCursor";
import { ItemBody, itemForUrl, type ItemCtx } from "./items";
import { drawPreview } from "./preview";
import { approxRect, DEFAULT_SIZE, itemLabel, newRef, type BoardDoc, type Entry, type Item, type Op, type Point } from "./model";
import { extractUrl } from "./urlKind";
import { HERMES_ACTIVE_S, useBoard } from "./useBoard";
import { Wires } from "./Wires";

type Tool = "select" | "pan" | "note" | "todo" | "link" | "image" | "col" | "board" | "embed" | "arrow" | "draw";

const TOOLS: { tool: Tool; key: string; label: MessageKey }[][] = [
  [{ tool: "select", key: "V", label: "board.tool.select" }, { tool: "pan", key: "H", label: "board.tool.pan" }],
  [{ tool: "note", key: "N", label: "board.tool.note" }, { tool: "todo", key: "T", label: "board.tool.todo" },
   { tool: "link", key: "L", label: "board.tool.link" }, { tool: "image", key: "I", label: "board.tool.image" },
   { tool: "col", key: "C", label: "board.tool.col" }, { tool: "board", key: "B", label: "board.tool.board" },
   { tool: "embed", key: "E", label: "board.tool.embed" }],
  [{ tool: "arrow", key: "A", label: "board.tool.arrow" }, { tool: "draw", key: "D", label: "board.tool.draw" }],
];
const KEY_TOOL: Record<string, Tool> = Object.fromEntries(TOOLS.flat().map((x) => [x.key.toLowerCase(), x.tool]));
const PLACE: Tool[] = ["note", "todo", "col", "link", "board", "embed", "image"];
const EDITABLE = new Set(["card", "todo", "col", "frame", "box", "text", "image"]);
const INTO_COLUMN = new Set(["card", "todo", "link", "image", "video", "board"]);

interface Drag {
  kind: "pan" | "move" | "resize" | "marquee" | "draw" | "arrow" | "kid";
  sx: number; sy: number; moved: boolean;
  view?: View; ids?: string[]; id?: string; w0?: number; h0?: number;
  pts?: Point[]; from?: string;
}

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
  const promptRef = useRef<HTMLInputElement>(null);
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
  const [live, setLive] = useState<Point[] | null>(null);
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
  const [prompt, setPrompt] = useState("");
  const [narrow, setNarrow] = useState<"" | "narrow" | "narrow tiny">("");
  const [cursorAct, setCursorAct] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [, setNow] = useState(0);
  const Frame = hostSandboxedFrame();

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

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

  const applyView = useCallback(() => {
    const v = view.current, world = worldRef.current, grid = gridRef.current;
    if (!world || !grid) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    world.style.setProperty("--iz", String(1 / v.z));
    const g = 24 * v.z, G = g * 5, c = 4.5;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${G}' height='${G}'><path d='M${-c} 0H${c}M0 ${-c}V${c}M${G - c} 0H${G + c}M${G} ${-c}V${c}M${-c} ${G}H${c}M0 ${G - c}V${G + c}M${G - c} ${G}H${G + c}M${G} ${G - c}V${G + c}' stroke='rgba(255,227,196,0.16)' stroke-width='1'/></svg>`;
    grid.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}"), radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent) .9px, transparent 1.2px)`;
    grid.style.backgroundSize = `${G}px ${G}px, ${g}px ${g}px`;
    grid.style.backgroundPosition = `${v.x}px ${v.y}px, ${v.x}px ${v.y}px`;
    if (pctRef.current) pctRef.current.textContent = `${Math.round(v.z * 100)}%`;
    drawMap();
  }, [drawMap]);

  const saveView = useCallback(() => {
    try { sessionStorage.setItem(`hb.view.${bid}`, JSON.stringify(view.current)); } catch { /* private mode */ }
  }, [bid]);

  const zoomAt = useCallback((f: number, sx: number, sy: number) => {
    const v = view.current;
    const nz = Math.min(2.4, Math.max(0.2, v.z * f));
    const wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
    view.current = { z: nz, x: sx - wx * nz, y: sy - wy * nz };
    applyView();
    saveView();
  }, [applyView, saveView]);

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
    const ro = new RO(() => setNarrow(el.clientWidth < 760 ? "narrow tiny" : el.clientWidth < 1180 ? "narrow" : ""));
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
    for (const id of selected) {
      const it = d.items[id];
      if (!it || it.k === "line" || it.k === "col") continue;
      const { by: _by, in: inCol, ...rest } = it;
      const ref = newRef();
      next.add(ref);
      const r = getRect(id);
      ops.push({ op: "add", ref, item: inCol ? { ...rest, in: inCol } : { ...rest, x: (it.x ?? r?.x ?? 0) + 24, y: (it.y ?? r?.y ?? 0) + 24 } });
    }
    if (ops.length) { commit(ops); setSelected(next); }
  }, [commit, getRect, selected]);

  // ── Hermes prompt / session ─────────────────────────────────────────────
  const continueInSession = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    if (d.session?.id) { openSession(d.session.id); return; }
    const ok = await newChatWithDraft(t("board.session.draft", { name: d.name, marker: `[board:${d.id}]` }));
    if (!ok) flash(t("board.toast.promptCopied"));
  }, [flash, t]);

  const sendToHermes = useCallback(async (text: string) => {
    const d = docRef.current;
    if (!d || !text.trim()) return;
    const sel = [...selected].filter((id) => d.items[id]);
    const body = `[board:${d.id}] ${text.trim()}${sel.length ? ` (${t("board.prompt.selection")}: ${sel.join(", ")})` : ""}`;
    setLog((l) => [...l.slice(-3), { key: `y${Date.now()}`, t: Date.now() / 1000, who: "you", msg: text.trim() }]);
    setLogOn(true);
    const rpc = hostRpc();
    if (rpc) {
      try {
        let sid: string | undefined;
        if (d.session?.id) {
          const r = await rpc<{ session_id?: string }>("session.resume", { session_id: d.session.id, omit_messages: true, lazy: true });
          sid = r?.session_id;
        } else {
          const r = await rpc<{ session_id?: string }>("session.create", {});
          sid = r?.session_id;
        }
        if (sid) {
          await rpc("prompt.submit", { session_id: sid, text: body });
          flash(t("board.toast.sent"));
          return;
        }
      } catch {
        // fall back to opening the chat with the prompt
      }
    }
    if (d.session?.id) {
      try { await navigator.clipboard?.writeText(body); } catch { /* ignore */ }
      openSession(d.session.id);
      flash(t("board.toast.promptCopied"));
    } else {
      const ok = await newChatWithDraft(body);
      if (!ok) flash(t("board.toast.promptCopied"));
    }
  }, [flash, selected, t]);

  // ── pointer interaction ─────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    const d = docRef.current;
    if (!d || e.button === 2) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-nodrag], .hb-ctx, input, textarea, a, iframe, video")) return;
    if (editing && !target.closest(`[data-iid="${editing}"]`)) setEditing(null);
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
      drag.current = { ...base, kind: "draw", pts: [[w.x, w.y]] };
      setLive([[w.x, w.y]]);
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
      if (e.shiftKey) { sel = new Set(selected); if (sel.has(id)) sel.delete(id); else sel.add(id); }
      else if (!selected.has(id)) sel = new Set([id]);
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
    const g = drag.current;
    if (!g) return;
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
      case "draw":
        g.pts!.push([w.x, w.y]);
        setLive(g.pts!.slice());
        break;
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
      setSelected(sel);
      return;
    }
    if (g.kind === "draw") {
      setLive(null);
      const pts = simplify(g.pts ?? [], 1.5);
      if (pts.length < 2) return;
      const s = toStroke(pts);
      commit([{ op: "add", ref: newRef(), item: { k: "draw", x: s.x, y: s.y, d: s.d, sw: 1.9 } }]);
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

  const onWheel = useCallback((e: WheelEvent) => {
    if ((e.target as HTMLElement).closest?.(".hb-embed .frame, .hb-video .stage, textarea")) return;
    e.preventDefault();
    const rect = vpRef.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
    else {
      view.current = { ...view.current, x: view.current.x - e.deltaX, y: view.current.y - e.deltaY };
      applyView();
      saveView();
    }
  }, [applyView, saveView, zoomAt]);

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── keyboard, paste, drop ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current?.isConnected || ask) return;
      if (e.key === " " && !isTyping(e.target)) { space.current = e.type === "keydown"; if (e.type === "keydown") e.preventDefault(); return; }
      if (e.type !== "keydown" || isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) sync.redo(); else sync.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); sync.redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); return; }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const d = docRef.current;
        if (d) setSelected(new Set(Object.keys(d.items).filter((id) => !d.items[id].in)));
        return;
      }
      if (mod && e.key === "Enter") { e.preventDefault(); void continueInSession(); return; }
      if (mod || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); return; }
      if (e.key === "Escape") { setSelected(new Set()); setTool("select"); setEditing(null); return; }
      if (e.key === "Enter" && selected.size === 1) {
        const id = [...selected][0];
        const it = docRef.current?.items[id];
        if (it && EDITABLE.has(it.k)) { e.preventDefault(); setEditing(id); }
        return;
      }
      if (e.key === "/") { e.preventDefault(); promptRef.current?.focus(); return; }
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
  }, [ask, center, commit, continueInSession, deleteSelection, duplicate, fit, selected, sync, zoomAt]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!rootRef.current?.isConnected || isTyping(e.target) || ask) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
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
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
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
    doc, t, editing, setEditing, update, commit, playing, setPlaying, Frame,
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
  } : null), [Frame, commit, doc, editing, hidden, kidDrag, onOpenBoard, playing, regEl, selected, t, update]);
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
    if (selKinds.length > 1) return ["board.verb.group", "board.verb.summarize"] as MessageKey[];
    switch (selKinds[0]) {
      case "draw": return ["board.verb.diagram"] as MessageKey[];
      case "todo": return ["board.verb.sortDate", "board.verb.split"] as MessageKey[];
      case "card": return ["board.verb.expand", "board.verb.split"] as MessageKey[];
      case "col": return ["board.verb.flow"] as MessageKey[];
      case "link": case "video": return ["board.verb.summarize"] as MessageKey[];
      default: return ["board.verb.improve"] as MessageKey[];
    }
  })();

  const rootCls = `hb ${narrow}`.trim();
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
  items.sort(([, a], [, b]) => (a.k === "frame" ? -1 : 0) - (b.k === "frame" ? -1 : 0));
  const sessionShort = doc.session?.id ? doc.session.id.slice(-4) : null;
  const savedTs = sync.savedAt ? sync.savedAt / 1000 : doc.updated;
  const vpCls = `hb-viewport${tool === "pan" ? " tool-pan" : ""}${tool === "draw" ? " tool-draw" : ""}${tool === "arrow" ? " tool-arrow" : ""}${PLACE.includes(tool) ? " tool-place" : ""}`;

  return (
    <div ref={rootRef} className={rootCls}>
      <div className={vpCls} ref={vpRef} tabIndex={-1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
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
            const cls = `hb-item${sel ? " sel" : ""}${moving ? " dragging" : ""}${hidden.has(id) ? " reveal-wait" : ""}${fresh.has(id) && !reduced() ? " just-placed" : ""}`;
            const dropIndex = kidDrag?.col === id ? kidDrag.index : null;
            return (
              <div key={id} className={cls} data-iid={id} ref={regEl(id)}
                style={{ left: x, top: y, width, height, zIndex: it.k === "frame" ? 0 : sel ? 3 : 1 }}>
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
          {live && live.length > 1 && (
            <svg className="hb-draw" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width="1" height="1">
              <path d={strokePath(live.map(([x, y]) => [Math.round(x), Math.round(y)] as Point))} strokeWidth={1.9} />
            </svg>
          )}
          {marquee && <div className="hb-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
          {selBounds && selKinds.length > 0 && tool === "select" && (
            <div className="hb-ctx" style={{ left: selBounds.x, top: selBounds.y - 8, transform: "translateY(-100%) scale(var(--iz, 1))" }}
              onPointerDown={(e) => e.stopPropagation()}>
              <span className="kind">{ctxLabel}</span>
              {hermesVerbs.length > 0 && (
                <span className="hm" style={{ padding: 0 }}>
                  {hermesVerbs.map((v, i) => (
                    <button key={v} style={{ height: "100%", padding: i === 0 ? "0 6px 0 10px" : "0 10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => void sendToHermes(t(v))}>
                      {i === 0 && <Cad />}{i > 0 && <em>/</em>}{t(v)}
                    </button>
                  ))}
                </span>
              )}
              <button onClick={duplicate}>{t("board.ctx.duplicate")}</button>
              <button onClick={deleteSelection}>{t("board.ctx.delete")}</button>
            </div>
          )}
          <HermesCursor ref={cursorRef} reducedMotion={reduced()} onActive={(on, act) => setCursorAct(on ? act : null)} />
        </div>
        {items.length === 0 && (
          <div className="hb-empty">
            <div className="hd">{t("board.empty.title")}</div>
            <p>{t("board.empty.body")}</p>
            <p>{t("board.empty.keys")}</p>
          </div>
        )}
      </div>

      <header className="hb-top">
        <nav className="hb-path">
          <span className="mark"><Cad /></span>
          <button onClick={onHome}>{t("board.path.home")}</button><span className="sl">/</span>
          <button onClick={() => onOpenBoard(null)}>{t("board.path.boards")}</button><span className="sl">/</span>
          {doc.parent && <><button onClick={() => onOpenBoard(doc.parent)}>{t("board.path.parent")}</button><span className="sl">/</span></>}
        </nav>
        <span className="hb-btitle" onDoubleClick={() => setRenaming(true)} title={t("board.renameHint")}>
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
        <button className="btn text" onClick={fit}>{t("board.fit")}</button>
        <button className="btn primary" onClick={() => void continueInSession()}>{t("board.continue")}<kbd>⌘↵</kbd></button>
      </header>

      <footer className="hb-status">
        {TOOLS.map((group, gi) => (
          <div className="seg" key={gi}>
            {group.map((x) => (
              <button key={x.tool} className={`tool${tool === x.tool ? " on" : ""}`} title={`${t(x.label)} (${x.key})`}
                onClick={() => {
                  if (x.tool === "image") { fileRef.current?.click(); return; }
                  if (x.tool === "link" || x.tool === "embed") { setAskValue(""); setAsk({ kind: x.tool, at: center() }); return; }
                  setTool(x.tool);
                }}>
                <u>{x.key}</u><span className="nm">{t(x.label)}</span>
              </button>
            ))}
          </div>
        ))}
        <label className="hb-prompt">
          <span className="who"><Cad />hermes ›</span>
          <span className="ph-block" />
          <input ref={promptRef} value={prompt} placeholder={t("board.prompt.placeholder")}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && prompt.trim()) { void sendToHermes(prompt); setPrompt(""); }
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            }} />
          <kbd>/</kbd>
        </label>
        <div className="seg zoom">
          <button className="tool" aria-label={t("board.zoomOut")} onClick={() => { const vp = vpRef.current!; zoomAt(1 / 1.2, vp.clientWidth / 2, vp.clientHeight / 2); }}>−</button>
          <span className="pct" ref={pctRef}>{Math.round(view.current.z * 100)}%</span>
          <button className="tool" aria-label={t("board.zoomIn")} onClick={() => { const vp = vpRef.current!; zoomAt(1.2, vp.clientWidth / 2, vp.clientHeight / 2); }}>+</button>
          <button className="tool" onClick={fit}><u>F</u><span className="nm">{t("board.fit")}</span></button>
        </div>
      </footer>

      <div className="hb-map" onClick={(e) => {
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
        <button className="x" aria-label={t("board.log.close")} onClick={() => setLogOn(false)}>×</button>
        {log.slice(-2).map((l) => (
          <div className="row" key={l.key}>
            <span className="t">{clock(l.t)}</span>
            <span className={`who${l.who === "you" ? " u" : ""}`}>{l.who === "you" ? t("board.log.you") : "hermes"}</span>
            <span className="msg">{l.msg}</span>
            {l.who === "hermes" && (
              <span className="acts">
                {l.s != null && <button onClick={() => sync.undoEntry(l.s!)}><u>Z</u> {t("board.log.undo")}</button>}
                <button onClick={() => void continueInSession()}>{t("board.log.openSession")}</button>
              </span>
            )}
          </div>
        ))}
      </div>

      {ask && (
        <div className="hb-ask" onPointerDown={(e) => e.stopPropagation()}>
          <div className="hd">{ask.kind === "link" ? t("board.ask.link") : t("board.ask.embed")}</div>
          {ask.kind === "link"
            ? <input autoFocus value={askValue} placeholder="https://" onChange={(e) => setAskValue(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") submitAsk(); if (e.key === "Escape") setAsk(null); }} />
            : <textarea autoFocus value={askValue} placeholder="<!doctype html>…" onChange={(e) => setAskValue(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setAsk(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAsk(); }} />}
          <div className="row">
            <span className="hint">{ask.kind === "link" ? t("board.ask.linkHint") : t("board.ask.embedHint")}</span>
            <button className="btn text" onClick={() => setAsk(null)}>{t("board.ask.cancel")}</button>
            <button className="btn primary" onClick={submitAsk}>{t("board.ask.add")}</button>
          </div>
        </div>
      )}
      {(toast || sync.error) && <div className="hb-toast" role="status">{toast || t("board.toast.offline")}</div>}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden
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

