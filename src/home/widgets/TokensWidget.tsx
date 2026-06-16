import { useEffect, useMemo, useState } from "react";
import { api } from "../../sdk";
import type { AnalyticsResponse, AnalyticsDailyEntry } from "../../api-types";
import { formatTokenCount } from "../format";
import { HoverCtl } from "./HoverArrows";

const RANGES = [
  { key: "week", label: "7 days", days: 7, byMonth: false },
  { key: "month", label: "1 month", days: 30, byMonth: false },
  { key: "halfyear", label: "6 months", days: 180, byMonth: true },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

interface Bar {
  key: string;
  label: string;
  tokens: number;
  cost: number;
}

/** One chart point per day, or one per calendar month when the range groups
 *  (the 6-month view). `label` is what the hover tooltip shows. */
function toBars(daily: AnalyticsDailyEntry[], byMonth: boolean): Bar[] {
  if (!byMonth) {
    return daily.map((d) => {
      const date = new Date(d.day);
      const label = isNaN(date.getTime())
        ? d.day
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return { key: d.day, label, tokens: d.input_tokens + d.output_tokens, cost: d.estimated_cost };
    });
  }
  const months = new Map<string, Bar & { sort: number }>();
  for (const d of daily) {
    const date = new Date(d.day);
    const valid = !isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : d.day.slice(0, 7);
    const label = valid ? date.toLocaleDateString(undefined, { month: "short" }) : key;
    const sort = valid ? date.getFullYear() * 12 + date.getMonth() : 0;
    const cur = months.get(key) ?? { key, label, tokens: 0, cost: 0, sort };
    cur.tokens += d.input_tokens + d.output_tokens;
    cur.cost += d.estimated_cost;
    months.set(key, cur);
  }
  return [...months.values()].sort((a, b) => a.sort - b.sort).map(({ sort, ...b }) => b);
}

// Per-instance gradient id, so two tokens widgets never share a <defs> id (the
// shim'd React build has no useId, so this stays self-contained).
let gradSeq = 0;

interface Props {
  /** Shared 1-day analytics from the poll — used only as a failed-fetch fallback. */
  analytics: AnalyticsResponse | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Token usage with a hover range selector (7 days / 1 month / 6 months) plus a
 *  bars↔line chart toggle and a totals show/hide toggle. Each range fetches once
 *  on demand; hovering a point reveals an animated tooltip with that day's (or
 *  month's) tokens and cost. All choices persist in the widget's layout props. */
export function TokensWidget({ analytics, widgetProps, onWidgetPropsChange }: Props) {
  const rangeKey: RangeKey =
    RANGES.find((r) => r.key === widgetProps.range)?.key ?? "week";
  const range = RANGES.find((r) => r.key === rangeKey)!;
  const idx = RANGES.findIndex((r) => r.key === rangeKey);
  const chart: "bars" | "line" = widgetProps.chart === "bars" ? "bars" : "line";
  const statsOn = widgetProps.stats !== false; // totals visible unless turned off
  const [gid] = useState(() => `tok-grad-${gradSeq++}`);

  const [fetched, setFetched] = useState<AnalyticsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  // Hover tooltip. `tip` stays set through the fade-out (so disappearing is also
  // animated); `show` toggles the appear/disappear animation. `pt` is the line
  // point in viewBox units, used to draw the marker dot in line mode.
  const [tip, setTip] = useState<{ bar: Bar; frac: number; pt?: [number, number] } | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFetched(null); setFailed(false);
    api.getAnalytics(range.days)
      .then((r) => { if (!cancelled) setFetched(r); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [range.days]);

  const setProp = (patch: Record<string, unknown>) =>
    onWidgetPropsChange({ ...widgetProps, ...patch });
  const cycle = (dir: 1 | -1) =>
    setProp({ range: RANGES[(idx + dir + RANGES.length) % RANGES.length].key });

  const controls = (
    <HoverCtl className="tok-ctl">
      <button className="hv-arrow" aria-label="previous" onClick={() => cycle(-1)}>‹</button>
      <span className="hv-label">{range.label}</span>
      <button className="hv-arrow" aria-label="next" onClick={() => cycle(1)}>›</button>
      <span className="tok-div" />
      <button
        className={`hv-opt${chart === "line" ? " on" : ""}`}
        onClick={() => setProp({ chart: chart === "line" ? "bars" : "line" })}
        title="line / bars view"
      >
        line
      </button>
      <button
        className={`hv-opt${statsOn ? " on" : ""}`}
        onClick={() => setProp({ stats: !statsOn })}
        title="show / hide totals"
      >
        totals
      </button>
    </HoverCtl>
  );

  // On-demand fetch, or a failed-fetch fallback to the shared day poll.
  const view = fetched ?? (failed ? analytics : null);
  const bars = useMemo(
    () => toBars(view?.daily ?? [], range.byMonth),
    [view, range.byMonth],
  );

  if (!view) {
    return (
      <div>
        {controls}
        <span className="dim">{failed ? "unavailable" : "loading…"}</span>
      </div>
    );
  }

  const t = view.totals;
  const total = t.total_input + t.total_output;
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
      <span className="dim"> {range.label}{failed ? " · day*" : ""}</span>
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
          <span><span className="dim">in</span> {formatTokenCount(t.total_input)}</span>
          <span><span className="dim">out</span> {formatTokenCount(t.total_output)}</span>
          <span><span className="dim">cost</span> <span className="ok">${t.total_estimated_cost.toFixed(2)}</span></span>
        </div>
      )}
    </div>
  );
}
