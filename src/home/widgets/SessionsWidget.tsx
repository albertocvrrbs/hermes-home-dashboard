import type { PaginatedSessions, StatusResponse } from "../../api-types";

export function SessionsWidget({
  status, sessions,
}: { status: StatusResponse | null; sessions: PaginatedSessions | null }) {
  if (!status && !sessions) return <span className="dim">loading…</span>;
  const recent = sessions?.sessions?.slice(0, 3) ?? [];
  return (
    <div>
      <span className="bigval">{status?.active_sessions ?? "—"}</span>
      <span className="dim"> active</span>
      <div className="rows">
        {recent.map((s) => (
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
