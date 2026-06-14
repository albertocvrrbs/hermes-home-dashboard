import { useState } from "react";
import type { PaginatedSessions, StatusResponse } from "../../api-types";
import { HoverArrows } from "./HoverArrows";

const PER_PAGE = 3;

/** Active session count + recent sessions. Hover arrows page through the
 *  loaded list, 3 at a time. */
export function SessionsWidget({
  status, sessions,
}: { status: StatusResponse | null; sessions: PaginatedSessions | null }) {
  const [page, setPage] = useState(0);
  if (!status && !sessions) return <span className="dim">loading…</span>;
  const all = sessions?.sessions ?? [];
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const p = Math.min(page, pages - 1);
  const slice = all.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
  return (
    <div>
      {pages > 1 && (
        <HoverArrows
          onPrev={() => setPage(Math.max(0, p - 1))}
          onNext={() => setPage(Math.min(pages - 1, p + 1))}
          label={`${p + 1}/${pages}`}
          prevDisabled={p <= 0}
          nextDisabled={p >= pages - 1}
        />
      )}
      <span className="bigval">{status?.active_sessions ?? "—"}</span>
      <span className="dim"> active</span>
      <div className="rows">
        {slice.map((s) => (
          <div className="row" key={s.id}>
            <span className="dim">
              {(s.title ?? s.source ?? s.id).slice(0, 18)}
            </span>
            <span className={s.is_active ? "ok" : "dim"}>
              {s.is_active ? "live" : "idle"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
