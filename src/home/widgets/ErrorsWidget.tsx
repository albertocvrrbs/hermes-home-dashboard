import { useEffect, useState } from "react";
import { api } from "../../sdk";
import type { LogsResponse } from "../../api-types";
import { HoverCtl } from "./HoverArrows";

// Hermes log line: "<date> <time>,<ms> <LEVEL>[<session>] <name>: <message>"
// (see hermes_logging.py _LOG_FORMAT). Continuation lines — traceback frames,
// multi-line messages — have no leading timestamp and belong to the record above.
const HEAD_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}),\d+\s+(\w+)\S*\s*(.*)$/;

const SHORT: Record<string, string> = {
  ERROR: "ERR", CRITICAL: "CRIT", FATAL: "FATAL",
  WARNING: "WARN", WARN: "WARN", INFO: "INFO", DEBUG: "DBG",
};

interface LogRecord {
  level: string;
  time: string;
  component: string;
  message: string;
  /** Full record (all physical lines) — shown in the row's hover title. */
  text: string;
}

function levelClass(level: string): string {
  if (level === "ERROR" || level === "CRITICAL" || level === "FATAL") return "lvl-error";
  if (level === "WARNING" || level === "WARN") return "lvl-warn";
  return "lvl-info";
}

/** Group physical log lines into logical records. Fixes the old bug where a
 *  single multi-line error (e.g. a stack trace) counted as many errors. */
function parseRecords(lines: string[]): LogRecord[] {
  const out: LogRecord[] = [];
  for (const raw of lines) {
    const m = HEAD_RE.exec(raw);
    if (m) {
      const rest = m[4];
      const ci = rest.indexOf(": ");
      const hasComp = ci > 0 && ci < 40;
      out.push({
        level: m[3].toUpperCase(),
        time: m[2],
        component: hasComp ? rest.slice(0, ci) : "",
        message: hasComp ? rest.slice(ci + 2) : rest,
        text: raw,
      });
    } else if (out.length) {
      out[out.length - 1].text += "\n" + raw;
    } else if (raw.trim()) {
      out.push({ level: "INFO", time: "", component: "", message: raw, text: raw });
    }
  }
  return out;
}

const FILTERS = [
  { key: "all", label: "all", match: () => true },
  { key: "error", label: "errors", match: (l: string) => l === "ERROR" || l === "CRITICAL" || l === "FATAL" },
  { key: "warn", label: "warnings", match: (l: string) => l === "WARNING" || l === "WARN" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

interface Props {
  /** Shared ERROR-level poll — a fallback until this widget's own fetch lands. */
  logs: LogsResponse | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Recent log records with a level filter (all / errors / warnings). Fetches the
 *  full log tail every 10s and groups multi-line records, so a stack trace shows
 *  as one row instead of many. The chosen filter persists in the layout props. */
export function ErrorsWidget({ logs, widgetProps, onWidgetPropsChange }: Props) {
  const filterKey: FilterKey =
    FILTERS.find((f) => f.key === widgetProps.filter)?.key ?? "all";
  const filter = FILTERS.find((f) => f.key === filterKey)!;

  const [recs, setRecs] = useState<LogRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getLogs({ lines: 200 })
        .then((r) => { if (!cancelled) { setRecs(parseRecords(r.lines ?? [])); setFailed(false); } })
        .catch(() => { if (!cancelled) setFailed(true); });
    };
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const setFilter = (key: FilterKey) =>
    onWidgetPropsChange({ ...widgetProps, filter: key });

  const controls = (
    <HoverCtl className="logs-ctl">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          className={`hv-opt${filterKey === f.key ? " on" : ""}`}
          onClick={() => setFilter(f.key)}
        >
          {f.label}
        </button>
      ))}
    </HoverCtl>
  );

  // Our own fetch, or the shared ERROR poll as a fallback until it lands.
  const all = recs ?? (logs ? parseRecords(logs.lines ?? []) : null);
  if (!all) {
    return (
      <div>
        {controls}
        <span className="dim">{failed ? "unavailable" : "loading…"}</span>
      </div>
    );
  }

  const filtered = all.filter((r) => filter.match(r.level)).reverse(); // newest first
  const count = filtered.length;
  const bigCls = count === 0 ? "bigval dim" : filterKey === "error" ? "bigval werr" : "bigval ok";

  return (
    <div>
      {controls}
      <span className={bigCls}>{count}</span>
      <span className="dim"> {filter.label}</span>
      <div className="home-logs">
        {count === 0 ? (
          <span className="dim">no records</span>
        ) : (
          filtered.map((r, i) => (
            <div className="log-row" key={`${r.time}-${i}`} title={r.text}>
              <span className={`log-lvl ${levelClass(r.level)}`}>{SHORT[r.level] ?? r.level.slice(0, 4)}</span>
              <span className="log-msg">{r.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
