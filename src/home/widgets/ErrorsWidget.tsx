import { useState } from "react";
import type { LogsResponse } from "../../api-types";
import { HoverArrows } from "./HoverArrows";

/** Recent error count + the selected error line. Hover arrows walk the already
 *  loaded history ("n / total"); the label jumps back to the latest. */
export function ErrorsWidget({ logs }: { logs: LogsResponse | null }) {
  const [pos, setPos] = useState<number | null>(null); // null = follow latest
  if (!logs) return <span className="dim">loading…</span>;
  const lines = logs.lines ?? [];
  const n = lines.length;
  const eff = n === 0 ? 0 : pos === null ? n - 1 : Math.min(Math.max(pos, 0), n - 1);
  const current = lines[eff];
  return (
    <div>
      {n > 1 && (
        <HoverArrows
          onPrev={() => setPos(Math.max(0, eff - 1))}
          onNext={() => setPos(Math.min(n - 1, eff + 1))}
          label={`${eff + 1}/${n}`}
          onLabelClick={pos === null ? undefined : () => setPos(null)}
          prevDisabled={eff <= 0}
          nextDisabled={eff >= n - 1}
        />
      )}
      <span className={n > 0 ? "bigval werr" : "bigval ok"}>{n}</span>
      <span className="dim"> recent</span>
      {current && (
        <div className="row">
          <span className="werr">{current.slice(0, 90)}</span>
        </div>
      )}
    </div>
  );
}
