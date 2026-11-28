// Live card: a declarative block spec (header, progress, metrics, sparkline, media, log,
// actions) bound to a data bag that the agent or a script keeps updating. Values are
// resolved from `$key` bindings; anything missing simply isn't drawn. Buttons only name ids
// from the owner's action allowlist; destructive ones go through BoardView's confirm dialog.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MessageKey, Translate } from "../home/i18n";
import type { ActionResult } from "./api";
import { Cad, Sig } from "./bits";
import { Icon, LIVE_ICONS } from "./icons";
import { assetUrl } from "./api";
import type { ItemCtx } from "./items";
import { VideoStage } from "./video";
import {
  asStatus, fmtDelta, fmtValue, freshness, labelKey, mediaRef, numbers, present, progressOf, resolve, shortAge,
  sparkPaths, tailLines, type LiveActionRef, type LiveBlock, type LiveMetric, type LiveStatus,
} from "./live";
import type { Item } from "./model";

const LABELS = new Set(["success", "elapsed", "cost", "falls", "successTrend", "level", "eta", "progress", "steps", "log", "reward", "loss"]);

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function lbl(t: Translate, label: unknown): string {
  if (typeof label !== "string") return label == null ? "" : String(label);
  const k = labelKey(label);
  if (!k) return label;
  return LABELS.has(k) ? t(`board.live.l.${k}` as MessageKey) : k;
}

function ageText(t: Translate, age: number): string {
  const a = shortAge(age);
  return t(`board.live.age.${a.unit}` as MessageKey, { n: a.n });
}

function Pill({ status, stale, t }: { status: LiveStatus | null; stale: boolean; t: Translate }) {
  if (stale) return <span className="lv-pill stale" data-tip={t("board.live.staleTip")}><Icon name="alert" size={11} />{t("board.live.st.stale")}</span>;
  if (!status) return null;
  return (
    <span className={`lv-pill ${status}`}>
      {status === "running" && <i className="caret" />}
      {status === "paused" && <i className="bars" />}
      {status === "done" && <Icon name="check" size={11} />}
      {status === "error" && <Icon name="alert" size={11} />}
      {t(`board.live.st.${status}` as MessageKey)}
    </span>
  );
}

function Header({ b, data, status, stale, t, fallbackTitle }: {
  b: Extract<LiveBlock, { t: "header" }>; data: Record<string, unknown>; status: LiveStatus | null; stale: boolean; t: Translate; fallbackTitle: string;
}) {
  const title = resolve(b.title, data);
  const sub = resolve(b.sub, data);
  const node = LIVE_ICONS[b.icon ?? "activity"] ?? LIVE_ICONS.activity;
  return (
    <div className="lv-head">
      <span className="ico"><Icon node={node} size={15} /></span>
      <div className="tt">
        <b>{present(title) ? String(title) : fallbackTitle || t("board.kind.live")}</b>
        {present(sub) && <small>{String(sub)}</small>}
      </div>
      <Pill status={status} stale={stale} t={t} />
    </div>
  );
}

function Progress({ b, data, t }: { b: Extract<LiveBlock, { t: "progress" }>; data: Record<string, unknown>; t: Translate }) {
  const frac = progressOf(resolve(b.value, data), resolve(b.max, data));
  if (frac == null) return null;
  const label = resolve(b.label, data);
  const eta = resolve(b.eta, data);
  const cells = 24;
  const on = Math.round(frac * cells);
  return (
    <div className="lv-prog">
      <div className="row">
        <span className="lb">{present(label) ? lbl(t, label) : t("board.live.l.progress")}</span>
        <span className="pc">{Math.round(frac * 100)} %</span>
        {present(eta) && <span className="eta">{t("board.live.eta", { eta: typeof eta === "number" ? fmtValue(eta, "dur") : String(eta) })}</span>}
      </div>
      <div className="cells" role="progressbar" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: cells }, (_, i) => <i key={i} className={i < on ? "on" : undefined} />)}
      </div>
    </div>
  );
}

function Metric({ m, data, t }: { m: LiveMetric; data: Record<string, unknown>; t: Translate }) {
  const v = resolve(m.value, data);
  const d = fmtDelta(resolve(m.delta, data), m.fmt);
  const good = d && m.good && d.dir !== "flat" ? (d.dir === m.good ? "good" : "bad") : "";
  return (
    <div className="m">
      <span className="k">{lbl(t, resolve(m.label, data))}</span>
      <span className="v">{fmtValue(v, m.fmt)}{m.unit && present(v) && <em>{m.unit}</em>}</span>
      {d && <span className={`d ${good}`.trim()}>{d.text}</span>}
    </div>
  );
}

function Spark({ b, data, t }: { b: Extract<LiveBlock, { t: "spark" }>; data: Record<string, unknown>; t: Translate }) {
  const gid = useRef(`lvg${Math.random().toString(36).slice(2, 8)}`).current;
  const series = numbers(resolve(b.series, data));
  if (series.length < 2) return null;
  const lo = resolve(b.min, data), hi = resolve(b.max, data);
  const W = 300, H = 44;
  const s = sparkPaths(series, W, H, typeof lo === "number" ? lo : undefined, typeof hi === "number" ? hi : undefined);
  const last = series[series.length - 1];
  return (
    <div className="lv-spark">
      <div className="row">
        <span className="k">{lbl(t, resolve(b.label, data))}</span>
        <span className="sp" />
        <span className="rng">{fmtValue(s.min, b.fmt)} – {fmtValue(s.max, b.fmt)}</span>
        <b>{fmtValue(last, b.fmt)}</b>
      </div>
      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".22" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="area" d={s.area} fill={`url(#${gid})`} />
          <path className="line" d={s.line} vectorEffect="non-scaling-stroke" />
        </svg>
        {s.last && <i className="dot" style={{ left: `${(s.last[0] / W) * 100}%`, top: `${(s.last[1] / H) * 100}%` }} />}
      </div>
    </div>
  );
}

function useImage(ref: { asset: string } | { url: string } | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const key = ref ? ("asset" in ref ? ref.asset : ref.url) : "";
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (ref && "url" in ref) setUrl(ref.url);
    else if (ref) assetUrl(ref.asset).then((u) => live && setUrl(u), () => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

function Media({ id, b, data, c }: { id: string; b: Extract<LiveBlock, { t: "media" }>; data: Record<string, unknown>; c: ItemCtx }) {
  const video = mediaRef(resolve(b.video, data));
  const image = mediaRef(resolve(b.image, data));
  const poster = mediaRef(resolve(b.poster, data));
  const caption = resolve(b.caption, data);
  const img = useImage(!video ? image : null);
  if (!video && !image) return null;
  return (
    <div className="lv-media">
      {video
        ? <VideoStage playId={`${id}:media`} c={c} title={present(caption) ? String(caption) : ""}
            src={"url" in video ? video.url : undefined} asset={"asset" in video ? video.asset : undefined}
            posterAsset={poster && "asset" in poster ? poster.asset : undefined} posterUrl={poster && "url" in poster ? poster.url : undefined} />
        : <div className="still">{img && <img src={img} alt="" draggable={false} />}</div>}
      {present(caption) && <div className="cap">{String(caption)}</div>}
    </div>
  );
}

function Log({ b, data, t }: { b: Extract<LiveBlock, { t: "text" }>; data: Record<string, unknown>; t: Translate }) {
  const lines = tailLines(resolve(b.value, data), b.lines ?? 6);
  if (!lines.length || (lines.length === 1 && !lines[0].trim())) return null;
  return (
    <div className={`lv-log${b.mono === false ? " prose" : ""}`}>
      {b.label && <span className="k">{lbl(t, resolve(b.label, data))}</span>}
      <pre>{lines.map((l, i) => <span key={i} className={i === lines.length - 1 ? "last" : undefined}>{l}{"\n"}</span>)}</pre>
    </div>
  );
}

interface Toast { ok: boolean; text: string; key: number }

function ActionButton({ iid, a, index, c, onResult }: {
  iid: string; a: LiveActionRef; index: number; c: ItemCtx; onResult: (r: ActionResult | null, label: string, err?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const info = c.liveActions?.[a.action];
  const label = a.label || info?.label || a.action;
  const known = !!info;
  const disabled = !known || !info.enabled || busy;
  const tip = c.liveActionsDown ? c.t("board.live.actionsDown")
    : !c.liveActions ? c.t("board.live.actionsLoading")
    : !known ? c.t("board.live.notRegistered", { id: a.action })
    : !info.enabled ? (info.note ? c.t("board.live.disabledNote", { note: info.note }) : c.t("board.live.disabled"))
    : info.description || label;
  // without the action list we don't know what the button does: no icon rather than a wrong one
  const iconName = a.icon ?? info?.icon ?? (info ? (info.destructive ? "stop" : "play") : null);
  const node = iconName ? LIVE_ICONS[iconName] ?? LIVE_ICONS.play : null;
  return (
    <span className="lv-bw" data-tip={tip}>
      <button className={`lv-btn${info?.destructive ? " danger" : ""}${busy ? " busy" : ""}`} data-nodrag="" disabled={disabled}
        aria-label={label}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await c.runLiveAction(iid, a, index);
            onResult(r, label);
          } catch (e) {
            onResult(null, label, String((e as Error)?.message ?? e));
          } finally {
            setBusy(false);
          }
        }}>
        {busy ? <i className="spin" /> : node ? <Icon node={node} size={13} /> : null}
        <span>{label}</span>
      </button>
    </span>
  );
}

export function LiveView({ id, item, c }: { id: string; item: Item; c: ItemCtx }) {
  const t = c.t;
  const data = (item.data ?? {}) as Record<string, unknown>;
  const blocks = item.blocks ?? [];
  const now = useNow(1000);
  const header = blocks.find((b) => b.t === "header") as Extract<LiveBlock, { t: "header" }> | undefined;
  const status = asStatus(resolve(header?.status, data));
  const fresh = freshness(item.at, item.ttl, status, now);
  const acts = blocks.flatMap((b) => (b.t === "actions" ? b.items : []));
  const [tick, setTick] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const lastAt = useRef(item.at);
  useEffect(() => {
    if (item.at && lastAt.current && item.at !== lastAt.current) {
      setTick(true);
      const h = setTimeout(() => setTick(false), 900);
      lastAt.current = item.at;
      return () => clearTimeout(h);
    }
    lastAt.current = item.at;
  }, [item.at]);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), toast.ok ? 5000 : 9000);
    return () => clearTimeout(h);
  }, [toast]);

  const onResult = (r: ActionResult | null, label: string, err?: string) => {
    if (!r && !err) return; // cancelled in the confirm dialog
    const key = Date.now();
    if (err) { setToast({ ok: false, text: t("board.live.actionError", { action: label, error: err }), key }); return; }
    const secs = (r!.ms / 1000).toFixed(r!.ms < 10000 ? 1 : 0);
    const out = r!.out ? r!.out.split("\n").filter(Boolean).pop() ?? "" : "";
    setToast(r!.ok
      ? { ok: true, text: t("board.live.actionOk", { action: label, s: secs }) + (out ? ` · ${out.slice(0, 80)}` : ""), key }
      : { ok: false, text: t("board.live.actionFailed", { action: label, code: String(r!.code) }) + (out ? ` · ${out.slice(0, 80)}` : ""), key });
  };

  const body: ReactNode[] = [];
  let mediaSeen = 0;
  blocks.forEach((b, i) => {
    switch (b.t) {
      case "header": body.push(<Header key={i} b={b} data={data} status={status} stale={fresh.stale} t={t} fallbackTitle={item.title ?? ""} />); break;
      case "progress": body.push(<Progress key={i} b={b} data={data} t={t} />); break;
      case "metrics": body.push(<div key={i} className="lv-metrics" data-n={b.items.length}>{b.items.map((m, j) => <Metric key={j} m={m} data={data} t={t} />)}</div>); break;
      case "spark": body.push(<Spark key={i} b={b} data={data} t={t} />); break;
      case "media": body.push(<Media key={i} id={`${id}:${mediaSeen++}`} b={b} data={data} c={c} />); break;
      case "text": body.push(<Log key={i} b={b} data={data} t={t} />); break;
      default: break;
    }
  });

  const terminal = status === "done" || status === "error" || status === "idle";
  const age = fresh.age;
  return (
    <div className={`hb-card hb-live${item.by === "h" ? " dm" : ""}${fresh.stale ? " stale" : ""}${status ? ` st-${status}` : ""}`}
      style={{ width: item.w ?? 400 }}>
      {!header && <Header b={{ t: "header" }} data={data} status={status} stale={fresh.stale} t={t} fallbackTitle={item.title ?? ""} />}
      {body}
      <div className="lv-foot">
        <span className={`fr${tick ? " tick" : ""}${fresh.stale ? " stale" : terminal ? " rest" : ""}`}>
          <i />
          {age == null ? t("board.live.noData")
            : fresh.stale ? t("board.live.staleFor", { age: ageText(t, age) })
            : t("board.live.updated", { age: ageText(t, age) })}
        </span>
        <span className="sp" />
        {item.by === "h" && (acts.length ? <span className="sig"><Cad /></span> : <Sig />)}
        {acts.map((a, i) => <ActionButton key={`${a.action}${i}`} iid={id} a={a} index={i} c={c} onResult={onResult} />)}
      </div>
      {toast && (
        <div key={toast.key} className={`lv-toast${toast.ok ? "" : " err"}`} role="status" data-nodrag="" onClick={() => setToast(null)}>
          <Icon name={toast.ok ? "ok" : "alert"} size={14} />
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
