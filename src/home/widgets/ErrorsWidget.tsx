import { useEffect, useState } from "react";
import { api } from "../../sdk";
import type { LogsResponse } from "../../api-types";
import { HoverArrows } from "./HoverArrows";
import { FILES, SHORT, levelClass, parseRecords, type FileKey, type LogRecord } from "./logParse";

interface Props {
  /** Shared ERROR-level poll (agent file) — a fallback until our fetch lands. */
  logs: LogsResponse | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Recent log records from one of the host's log files (agent / errors /
 *  gateway), picked with hover arrows. Multi-line records are grouped so a stack
 *  trace shows as one row. The chosen file persists in the layout props. */
export function ErrorsWidget({ logs, widgetProps, onWidgetPropsChange }: Props) {
  const fileKey: FileKey =
    FILES.find((f) => f === widgetProps.file) ?? "agent";
  const idx = FILES.indexOf(fileKey);

  const [recs, setRecs] = useState<LogRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecs(null); setFailed(false);
    const load = () => {
      api.getLogs({ file: fileKey, lines: 200 })
        .then((r) => { if (!cancelled) { setRecs(parseRecords(r.lines ?? [])); setFailed(false); } })
        .catch(() => { if (!cancelled) setFailed(true); });
    };
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [fileKey]);

  const cycle = (dir: 1 | -1) =>
    onWidgetPropsChange({ ...widgetProps, file: FILES[(idx + dir + FILES.length) % FILES.length] });

  const arrows = (
    <HoverArrows onPrev={() => cycle(-1)} onNext={() => cycle(1)} label={fileKey.toUpperCase()} />
  );

  // Our own fetch, or the shared ERROR poll (agent file) as a fallback.
  const all = recs ?? (fileKey === "agent" && logs ? parseRecords(logs.lines ?? []) : null);
  if (!all) {
    return (
      <div>
        {arrows}
        <span className="dim">{failed ? "unavailable" : "loading…"}</span>
      </div>
    );
  }

  const records = [...all].reverse(); // newest first
  return (
    <div>
      {arrows}
      <div className="logs-sub">
        <span className="logs-file">{fileKey.toUpperCase()}</span>
        <span className="dim">{records.length} rec</span>
      </div>
      <div className="home-logs">
        {records.length === 0 ? (
          <span className="dim">no records</span>
        ) : (
          records.map((r, i) => (
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
