import { useEffect, useState } from "react";
import { getProjects } from "@/sdk";
import type { ProjectStatus } from "@/api-types";
import { useT, type Translate } from "../i18n";

const POLL_MS = 30_000;

type Tone = "ok" | "warn" | "err" | "dim";

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === "active" || s === "healthy" || s === "online" || s === "ok") return "ok";
  if (s === "warning" || s === "warn" || s === "degraded") return "warn";
  if (s === "blocked" || s === "error" || s === "failed") return "err";
  return "dim";
}

const TONE_ICON: Record<Tone, string> = { ok: "●", warn: "▲", err: "✕", dim: "○" };

function timeAgo(iso: string | null, t: Translate): string {
  if (!iso) return t("common.none");
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t("common.none");
  const mins = Math.floor(Math.max(0, Date.now() - then) / 60_000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { n: hours });
  return t("time.daysAgo", { n: Math.floor(hours / 24) });
}

/** Project status board — one row per `~/projects/<name>/status.json`, read
 *  by this plugin's `/projects` backend route. Each row shows a status dot,
 *  inbox / in-progress / done counters and how long ago it was updated;
 *  click a row to expand its next action and alerts inline. Fetches on its
 *  own (every 30s, only while the widget is on the grid).
 *
 *  Contributed by @AgJavis-hub in #4. */
export function ProjectsWidget() {
  const t = useT();
  const [projects, setProjects] = useState<ProjectStatus[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getProjects()
        .then((r) => {
          if (cancelled) return;
          setProjects(Array.isArray(r?.projects) ? r.projects : []);
          setFailed(false);
        })
        .catch(() => { if (!cancelled) setFailed(true); });
    };
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!projects) {
    return <span className="dim">{failed ? t("common.unavailable") : t("common.loading")}</span>;
  }
  if (projects.length === 0) {
    return <span className="dim">{t("projects.empty")}</span>;
  }

  return (
    <div className="home-projects">
      {projects.map((p) => {
        const open = openId === p.id;
        const tone = statusTone(p.status);
        const toggle = () => setOpenId(open ? null : p.id);
        return (
          <div key={p.id} className={`project-item${open ? " open" : ""}`}>
            <div
              className={`project-row ${tone}`}
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
              role="button"
              tabIndex={0}
              aria-expanded={open}
              title={p.status}
            >
              <span className="project-icon" aria-hidden="true">{TONE_ICON[tone]}</span>
              <span className="project-name">{p.project || p.id}</span>
              <span className="project-stats">
                <span title={t("projects.inbox")}>{p.stats.inbox}</span>
                {" · "}
                <span title={t("projects.doing")}>{p.stats.inProgress}</span>
                {" · "}
                <span title={t("projects.done")}>{p.stats.completed}</span>
              </span>
              <span className="project-time">{timeAgo(p.lastUpdated, t)}</span>
              <span className="project-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
            </div>
            {open && (
              <div className="project-detail">
                <div className="project-detail-row">
                  <span className="dim">{t("projects.next")}</span> {p.nextAction || t("common.none")}
                </div>
                <div className="project-detail-row dim">
                  {t("projects.inbox")} {p.stats.inbox} · {t("projects.doing")} {p.stats.inProgress} · {t("projects.done")} {p.stats.completed}
                </div>
                {p.alerts.length > 0 && (
                  <div className="project-detail-row project-alerts">
                    <span className="dim">{t("projects.alerts")}</span>
                    <ul>
                      {p.alerts.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {p.lastUpdated && (
                  <div className="project-detail-row dim">
                    {t("projects.updated", { when: new Date(p.lastUpdated).toLocaleString() })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
