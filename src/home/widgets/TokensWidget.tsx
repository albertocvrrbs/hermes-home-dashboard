import type { AnalyticsResponse } from "../../api-types";
import { formatTokenCount } from "../format";

export function TokensWidget({ analytics }: { analytics: AnalyticsResponse | null }) {
  if (!analytics) return <span className="dim">loading…</span>;
  const t = analytics.totals;
  const total = t.total_input + t.total_output;
  const daily = analytics.daily ?? [];
  const max = Math.max(1, ...daily.map((d) => d.input_tokens + d.output_tokens));
  return (
    <div>
      <span className="bigval">{formatTokenCount(total)}</span>
      <span className="dim"> today</span>
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
