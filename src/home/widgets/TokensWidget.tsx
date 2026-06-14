import { useEffect, useState } from "react";
import { api } from "../../sdk";
import type { AnalyticsResponse } from "../../api-types";
import { formatTokenCount } from "../format";
import { HoverArrows } from "./HoverArrows";

const RANGES = [
  { key: "day", label: "today", days: 1 },
  { key: "week", label: "7 days", days: 7 },
  { key: "month", label: "30 days", days: 30 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

interface Props {
  /** The shared 1-day analytics from the poll (used for the "day" range). */
  analytics: AnalyticsResponse | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Token usage with a hover range selector (day / week / month). The day view
 *  reuses the shared poll; week/month fetch once on demand and fall back to the
 *  day data if the fetch fails. The chosen range persists in the layout props. */
export function TokensWidget({ analytics, widgetProps, onWidgetPropsChange }: Props) {
  const rangeKey: RangeKey =
    RANGES.find((r) => r.key === widgetProps.range)?.key ?? "day";
  const range = RANGES.find((r) => r.key === rangeKey)!;
  const idx = RANGES.findIndex((r) => r.key === rangeKey);

  const [fetched, setFetched] = useState<AnalyticsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  // Day uses the shared poll; longer ranges fetch on demand when selected.
  useEffect(() => {
    if (range.days === 1) { setFetched(null); setFailed(false); return; }
    let cancelled = false;
    setFetched(null); setFailed(false);
    api.getAnalytics(range.days)
      .then((r) => { if (!cancelled) setFetched(r); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [range.days]);

  const cycle = (dir: 1 | -1) =>
    onWidgetPropsChange({
      ...widgetProps,
      range: RANGES[(idx + dir + RANGES.length) % RANGES.length].key,
    });

  const arrows = (
    <HoverArrows onPrev={() => cycle(-1)} onNext={() => cycle(1)} label={range.label} />
  );

  // For day, the poll feeds us; for week/month, the fetch (or a failed-fetch
  // fallback to the day data).
  const view = range.days === 1 ? analytics : fetched ?? (failed ? analytics : null);

  if (!view) {
    return (
      <div>
        {arrows}
        <span className="dim">{failed ? "unavailable" : "loading…"}</span>
      </div>
    );
  }

  const t = view.totals;
  const total = t.total_input + t.total_output;
  const daily = view.daily ?? [];
  const max = Math.max(1, ...daily.map((d) => d.input_tokens + d.output_tokens));
  return (
    <div>
      {arrows}
      <span className="bigval">{formatTokenCount(total)}</span>
      <span className="dim"> {range.label}{failed && range.days !== 1 ? " · day*" : ""}</span>
      <div className="home-spark">
        {daily.map((d) => (
          <i
            key={d.day}
            style={{ height: `${Math.max(8, ((d.input_tokens + d.output_tokens) / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="row">
        <span className="dim">in</span>
        <span>{formatTokenCount(t.total_input)}</span>
        <span className="dim">out</span>
        <span>{formatTokenCount(t.total_output)}</span>
        <span className="dim">$</span>
        <span className="ok">{t.total_estimated_cost.toFixed(2)}</span>
      </div>
    </div>
  );
}
