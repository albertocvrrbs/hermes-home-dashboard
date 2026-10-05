import { useState } from "react";
import type { WidgetRenderProps } from "./registry";
import type { ProjectStatus } from "../../api-types";

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "healthy" || s === "online") return "ok";
  if (s === "warning" || s === "degraded") return "warn";
  if (s === "blocked" || s === "error" || s === "failed") return "err";
  return "dim";
}

function statusIcon(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "healthy" || s === "online") return "●";
  if (s === "warning" || s === "degraded") return "▲";
  if (s === "blocked" || s === "error" || s === "failed") return "✕";
  return "○";
}

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "unknown";
  }
}

/** Project status board — reads ~/projects/NAME/status.json (see the
 *  plugin's /projects backend route). Click a row to expand its next
 *  action and alerts inline; there is no dedicated core route to
 *  navigate to, so drill-down is a local accordion instead of
 *  WidgetShell's onClickThrough. */
export function ProjectsWidget({ data }: WidgetRenderProps) {
  const projects = data.projects;
  const [openId, setOpenId] = useState<string | null>(null);

  if (!projects) {
    return <div className="home-projects"><span className="dim">loading...</span></div>;
  }

  if (projects.length === 0) {
    return <div className="home-projects"><span className="dim">no projects — create ~/projects/&lt;name&gt;/status.json</span></div>;
  }

  return (
    <div className="home-projects">
      {projects.map((p: ProjectStatus) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className={`project-item${open ? " open" : ""}`}>
            <div
              className={`project-row ${statusColor(p.status)}`}
              onClick={() => setOpenId(open ? null : p.id)}
              role="button"
              tabIndex={0}
            >
              <span className="project-icon">{statusIcon(p.status)}</span>
              <span className="project-name">{p.project}</span>
              <span className="project-stats">{p.stats.inbox}📥 {p.stats.inProgress}🔄 {p.stats.completed}✅</span>
              <span className="project-time">{timeAgo(p.lastUpdated)}</span>
              <span className="project-caret">{open ? "▾" : "▸"}</span>
            </div>
            {open && (
              <div className="project-detail">
                <div className="project-detail-row">
                  <span className="dim">next:</span> {p.nextAction || "—"}
                </div>
                {p.alerts.length > 0 && (
                  <div className="project-detail-row project-alerts">
                    <span className="dim">alerts:</span>
                    <ul>
                      {p.alerts.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                <div className="project-detail-row dim">updated {p.lastUpdated}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
