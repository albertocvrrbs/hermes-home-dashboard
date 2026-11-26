// Pure series helper for the Tokens widget, kept React-free for unit testing.
import type { AnalyticsDailyEntry } from "@/api-types";

/** How the Tokens widget breaks usage down under the chart. */
export type GroupBy = "off" | "provider" | "model";
export const GROUP_MODES: readonly GroupBy[] = ["off", "provider", "model"];

/** Persisted layout props may hold anything — unknowns mean "off". */
export function coerceGroupBy(value: unknown): GroupBy {
  return GROUP_MODES.includes(value as GroupBy) ? (value as GroupBy) : "off";
}

/** Minimal usage row shape shared by /analytics/models (model + provider)
 *  and the older /analytics `by_model` (model only). */
export interface UsageRow {
  model?: string | null;
  provider?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost?: number | null;
}

export interface UsageGroup {
  /** Grouping key; "" = the row carried no provider/model. */
  key: string;
  tokens: number;
  cost: number;
  /** Share of the grouped total, 0–100. */
  share: number;
}

/** Sum usage rows by provider or by model, largest first. A model served by
 *  two providers is one row in "model" mode and two in "provider" mode. */
export function groupUsage(rows: readonly UsageRow[], by: Exclude<GroupBy, "off">): UsageGroup[] {
  const acc = new Map<string, { tokens: number; cost: number }>();
  for (const r of rows) {
    const key = ((by === "provider" ? r.provider : r.model) ?? "").trim();
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    const cost = r.estimated_cost ?? 0;
    const cur = acc.get(key) ?? { tokens: 0, cost: 0 };
    cur.tokens += Number.isFinite(tokens) ? tokens : 0;
    cur.cost += Number.isFinite(cost) ? cost : 0;
    acc.set(key, cur);
  }
  const total = [...acc.values()].reduce((n, g) => n + g.tokens, 0);
  return [...acc.entries()]
    .filter(([, g]) => g.tokens > 0 || g.cost > 0)
    .map(([key, g]) => ({ key, ...g, share: total > 0 ? (g.tokens / total) * 100 : 0 }))
    .sort((a, b) => b.tokens - a.tokens || b.cost - a.cost || a.key.localeCompare(b.key));
}

export interface Bar {
  key: string;
  label: string;
  tokens: number;
  cost: number;
}

/** Parse a "YYYY-MM-DD" day as a LOCAL calendar date. `new Date("2026-06-01")`
 *  parses as UTC midnight, which getMonth()/toLocaleDateString() then read in
 *  local time — shifting the day (and its month bucket) back a day in negative
 *  timezones. Building from components keeps the calendar day intact. */
function parseDay(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(day);
}

/** One chart point per day, or one per calendar month when the range groups
 *  (the 6-month view). `label` is what the hover tooltip shows. */
export function toBars(daily: AnalyticsDailyEntry[], byMonth: boolean): Bar[] {
  if (!byMonth) {
    return daily.map((d) => {
      const date = parseDay(d.day);
      const label = isNaN(date.getTime())
        ? d.day
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return { key: d.day, label, tokens: d.input_tokens + d.output_tokens, cost: d.estimated_cost };
    });
  }
  const months = new Map<string, Bar & { sort: number }>();
  for (const d of daily) {
    const date = parseDay(d.day);
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
