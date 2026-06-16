// Pure series helper for the Tokens widget, kept React-free for unit testing.
import type { AnalyticsDailyEntry } from "../../api-types";

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
