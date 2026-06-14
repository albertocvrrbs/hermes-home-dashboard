import type { LogsResponse } from "../../api-types";

export function ErrorsWidget({ logs }: { logs: LogsResponse | null }) {
  if (!logs) return <span className="dim">loading…</span>;
  const lines = logs.lines ?? [];
  const last = lines[lines.length - 1];
  return (
    <div>
      <span className={lines.length > 0 ? "bigval werr" : "bigval ok"}>
        {lines.length}
      </span>
      <span className="dim"> recent</span>
      {last && (
        <div className="row">
          <span className="werr">{last.slice(0, 60)}</span>
        </div>
      )}
    </div>
  );
}
