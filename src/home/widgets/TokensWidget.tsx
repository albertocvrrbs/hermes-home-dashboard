import { useEffect, useMemo, useState } from "react";
import { api } from "@/sdk";
import { Cancelled, fetchRetry } from "../fetchGuard";
import type { AnalyticsResponse, ModelsAnalyticsEntry } from "@/api-types";
import { formatTokenCount } from "../format";
import { fmtDate, useT, type MessageKey } from "../i18n";
import { HoverCtl } from "./HoverArrows";
import {
  GROUP_MODES, coerceGroupBy, groupUsage, toBars,
  type Bar, type GroupBy, type UsageGroup,
} from "./tokenSeries";

const RANGES = [
  { key: "week", label: "tokens.range.week", days: 7, byMonth: false },
  { key: "month", label: "tokens.range.month", days: 30, byMonth: false },
  { key: "halfyear", label: "tokens.range.halfyear", days: 180, byMonth: true },
] as const satisfies readonly { key: string; label: MessageKey; days: number; byMonth: boolean }[];
type RangeKey = (typeof RANGES)[number]["key"];

// Per-instance gradient id, so two tokens widgets never share a <defs> id (the
// shim'd React build has no useId, so this stays self-contained).
let gradSeq = 0;

interface Props {
  /** Shared 1-day analytics from the poll — used only as a failed-fetch fallback. */
  analytics: AnalyticsResponse | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
  gridSize: { gw: number; gh: number };
}

/** Rows the breakdown can show for a widget height (the "+N more" line
 *  takes one when the list overflows). */
function breakdownCap(gh: number): number {
  return Math.max(2, Math.min(8, gh * 2 - 5));
}

/** Token usage with a hover range selector (7 days / 1 month / 6 months) plus a
 *  bars↔line chart toggle, a totals show/hide toggle and a grouping switch
 *  (all / by provider / by model). Each range fetches once on demand; hovering
 *  a point reveals an animated tooltip with that day's (or month's) tokens and
 *  cost. All choices persist in the widget's layout props.
 *
 *  Grouping reads the host's per (model, provider) analytics. On a Hermes
 *  without it, both modes fall back to the per-model list in the usage
 *  payload, and provider mode says so. */
export function TokensWidget({ analytics, widgetProps, onWidgetPropsChange, gridSize }: Props) {
  const t = useT();
  const rangeKey: RangeKey =
    RANGES.find((r) => r.key === widgetProps.range)?.key ?? "week";
  const range = RANGES.find((r) => r.key === rangeKey)!;
  const idx = RANGES.findIndex((r) => r.key === rangeKey);
  const chart: "bars" | "line" = widgetProps.chart === "bars" ? "bars" : "line";
  const statsOn = widgetProps.stats !== false; // totals visible unless turned off
  const group: GroupBy = coerceGroupBy(widgetProps.group);
  const [gid] = useState(() => `tok-grad-${gradSeq++}`);

  const [fetched, setFetched] = useState<AnalyticsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  // Hover tooltip. `tip` stays set through the fade-out (so disappearing is also
  // animated); `show` toggles the appear/disappear animation. `pt` is the line
  // point in viewBox units, used to draw the marker dot in line mode.
  const [tip, setTip] = useState<{ bar: Bar; frac: number; pt?: [number, number] } | null>(null);
  const [show, setShow] = useState(false);
  // Per (model, provider) rows for the grouping switch; null = not loaded.
  const [models, setModels] = useState<ModelsAnalyticsEntry[] | null>(null);
  const [modelsFailed, setModelsFailed] = useState(false);

  useEffect(() => {
    if (group === "off") return;
    let cancelled = false;
    setModels(null); setModelsFailed(false);
    fetchRetry(() => api.getModelsAnalytics(range.days), { cancelled: () => cancelled })
      .then((r) => { if (!cancelled) setModels(Array.isArray(r?.models) ? r.models : []); })
      .catch((e) => { if (!cancelled && !(e instanceof Cancelled)) setModelsFailed(true); });
    return () => { cancelled = true; };
  }, [group, range.days]);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setFetched(null); setFailed(false);
    // Every attempt times out (a request the host never answers used to leave this on "loading…"
    // for good); once the quick retries are spent the shared day poll stands in, and we keep trying.
    const load = () => {
      fetchRetry(() => api.getAnalytics(range.days), { cancelled: () => cancelled })
        .then((r) => { if (!cancelled) { setFetched(r); setFailed(false); } })
        .catch((e) => {
          if (cancelled || e instanceof Cancelled) return;
          setFailed(true);
          retry = setTimeout(load, 20_000);
        });
    };
    load();
    return () => { cancelled = true; if (retry) clearTimeout(retry); };
  }, [range.days]);

  const setProp = (patch: Record<string, unknown>) =>
    onWidgetPropsChange({ ...widgetProps, ...patch });
  const cycle = (dir: 1 | -1) =>
    setProp({ range: RANGES[(idx + dir + RANGES.length) % RANGES.length].key });
  const cycleGroup = () =>
    setProp({ group: GROUP_MODES[(GROUP_MODES.indexOf(group) + 1) % GROUP_MODES.length] });

  const controls = (
    <HoverCtl className="tok-ctl">
      <button className="hv-arrow" aria-label={t("common.previous")} onClick={() => cycle(-1)}>‹</button>
      <span className="hv-label">{t(range.label)}</span>
      <button className="hv-arrow" aria-label={t("common.next")} onClick={() => cycle(1)}>›</button>
      <span className="tok-div" />
      <button
        className={`hv-opt${chart === "line" ? " on" : ""}`}
        onClick={() => setProp({ chart: chart === "line" ? "bars" : "line" })}
        title={t("tokens.lineTitle")}
      >
        {t("tokens.line")}
      </button>
      <button
        className={`hv-opt${statsOn ? " on" : ""}`}
        onClick={() => setProp({ stats: !statsOn })}
        title={t("tokens.totalsTitle")}
      >
        {t("tokens.totals")}
      </button>
      <span className="tok-div" />
      <button
        className={`hv-opt${group !== "off" ? " on" : ""}`}
        onClick={cycleGroup}
        title={t("tokens.groupTitle")}
        data-group={group}
      >
        {t(`tokens.group.${group}`)}
      </button>
    </HoverCtl>
  );

  // On-demand fetch, or a failed-fetch fallback to the shared day poll.
  const view = fetched ?? (failed ? analytics : null);
  const bars = useMemo(
    () => toBars(view?.daily ?? [], range.byMonth, fmtDate),
    [view, range.byMonth, t],
  );

  // Breakdown rows. Provider identity only exists in the per (model,
  // provider) analytics; without it we fall back to the usage payload's
  // per-model list (and say so in provider mode).
  const fallback = group !== "off" && modelsFailed;
  const groups: UsageGroup[] | null = useMemo(() => {
    if (group === "off") return null;
    if (models) return groupUsage(models, group);
    if (modelsFailed && view) return groupUsage(view.by_model ?? [], "model");
    return null;
  }, [group, models, modelsFailed, view]);

  if (!view) {
    return (
      <div>
        {controls}
        <span className="dim">{failed ? t("common.unavailable") : t("common.loading")}</span>
      </div>
    );
  }

  const tot = view.totals;
  const total = tot.total_input + tot.total_output;
  const n = bars.length;
  const max = Math.max(1, ...bars.map((b) => b.tokens));

  // Line/area geometry in a 100×100 viewBox (stretched to fit, non-scaling stroke).
  const H = 100, W = 100, PAD = 3;
  const coords: [number, number][] = bars.map((b, i) => [
    n <= 1 ? W / 2 : (i / (n - 1)) * W,
    H - PAD - (b.tokens / max) * (H - PAD * 2),
  ]);
  const linePath = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath = n ? `${linePath} L${coords[n - 1][0].toFixed(2)},${H} L${coords[0][0].toFixed(2)},${H} Z` : "";

  return (
    <div>
      {controls}
      <span className="bigval">{formatTokenCount(total)}</span>
      <span className="dim"> {t(range.label)}{failed ? ` · ${t("tokens.dayFallback")}` : ""}</span>
      <div className="home-spark-wrap" onMouseLeave={() => setShow(false)}>
        {tip && (
          <div
            className={`home-spark-tip${show ? " show" : ""}`}
            style={{ left: `${tip.frac * 100}%`, transform: `translateX(${-tip.frac * 100}%)` }}
          >
            <b>{tip.bar.label}</b> · {formatTokenCount(tip.bar.tokens)} · ${tip.bar.cost.toFixed(2)}
          </div>
        )}
        {chart === "line" ? (
          <svg className="home-area" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--home-accent)", stopOpacity: 0.5 }} />
                <stop offset="100%" style={{ stopColor: "var(--home-accent)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="var(--home-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {show && tip?.pt && (
              <circle cx={tip.pt[0]} cy={tip.pt[1]} r={2.4} fill="var(--home-accent)" vectorEffect="non-scaling-stroke" />
            )}
            {bars.map((b, i) => (
              <rect
                key={b.key}
                x={(i * W) / n} y={0} width={W / n} height={H} fill="transparent"
                onMouseEnter={() => { setTip({ bar: b, frac: n <= 1 ? 0.5 : i / (n - 1), pt: coords[i] }); setShow(true); }}
              />
            ))}
          </svg>
        ) : (
          <div className="home-spark">
            {bars.map((b, i) => (
              <i
                key={b.key}
                onMouseEnter={() => { setTip({ bar: b, frac: (i + 0.5) / n }); setShow(true); }}
                style={{ height: `${Math.max(8, (b.tokens / max) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </div>
      {statsOn && (
        <div className="tok-stats">
          <span><span className="dim">{t("tokens.in")}</span> {formatTokenCount(tot.total_input)}</span>
          <span><span className="dim">{t("tokens.out")}</span> {formatTokenCount(tot.total_output)}</span>
          <span><span className="dim">{t("tokens.cost")}</span> <span className="ok">${tot.total_estimated_cost.toFixed(2)}</span></span>
        </div>
      )}
      {group !== "off" && (
        <TokenBreakdown
          groups={groups}
          cap={breakdownCap(gridSize.gh)}
          note={fallback && group === "provider" ? t("tokens.providerFallback") : null}
        />
      )}
    </div>
  );
}

/** Grouped usage list under the chart: name, tokens and share, with a faint
 *  share bar behind each row. Hover a row for its cost. */
function TokenBreakdown({ groups, cap, note }: {
  groups: UsageGroup[] | null;
  cap: number;
  note: string | null;
}) {
  const t = useT();
  if (!groups) return <div className="tok-groups"><span className="dim">{t("common.loading")}</span></div>;
  if (groups.length === 0) return <div className="tok-groups"><span className="dim">{t("tokens.groupEmpty")}</span></div>;
  const overflow = groups.length > cap;
  const shown = overflow ? groups.slice(0, cap - 1) : groups;
  return (
    <div className="tok-groups">
      {note && <div className="tok-group-note dim">{note}</div>}
      <div className="rows">
        {shown.map((g) => {
          const name = g.key || t("tokens.unknownProvider");
          const share = Math.round(g.share);
          return (
            <div
              className="row tok-group"
              key={g.key || "\u0000"}
              style={{ "--share": `${Math.max(1, Math.min(100, g.share))}%` } as React.CSSProperties}
              title={t("tokens.rowTitle", {
                name, tokens: formatTokenCount(g.tokens), cost: g.cost.toFixed(2), share,
              })}
            >
              <span className="row-name">{name}</span>
              <span>{formatTokenCount(g.tokens)}</span>
              <span className="dim tok-share">{share}%</span>
            </div>
          );
        })}
      </div>
      {overflow && (
        <div className="dim tok-group-more">{t("tokens.groupMore", { n: groups.length - shown.length })}</div>
      )}
    </div>
  );
}
