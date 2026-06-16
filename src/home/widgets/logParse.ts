// Pure log-parsing helpers for the Logs widget, kept React-free so they can be
// unit-tested directly. The Hermes log line is
//   "<date> <time>,<ms> <LEVEL>[<session>] <name>: <message>"
// (see hermes_logging.py _LOG_FORMAT). Continuation lines — traceback frames,
// multi-line messages — have no leading timestamp and belong to the record above.

/** Log files the host exposes, matching the dashboard's LogsPage (FILES). */
export const FILES = ["agent", "errors", "gateway"] as const;
export type FileKey = (typeof FILES)[number];

const HEAD_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}),\d+\s+(\w+)\S*\s*(.*)$/;

export const SHORT: Record<string, string> = {
  ERROR: "ERR", CRITICAL: "CRIT", FATAL: "FATAL",
  WARNING: "WARN", WARN: "WARN", INFO: "INFO", DEBUG: "DBG",
};

export interface LogRecord {
  level: string;
  time: string;
  component: string;
  message: string;
  /** Full record (all physical lines) — shown in the row's hover title. */
  text: string;
}

export function levelClass(level: string): string {
  if (level === "ERROR" || level === "CRITICAL" || level === "FATAL") return "lvl-error";
  if (level === "WARNING" || level === "WARN") return "lvl-warn";
  return "lvl-info";
}

/** Group physical log lines into logical records. Fixes the old bug where a
 *  single multi-line error (e.g. a stack trace) counted as many. */
export function parseRecords(lines: string[]): LogRecord[] {
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
