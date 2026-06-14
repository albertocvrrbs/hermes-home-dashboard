import type { CronJob } from "../../api-types";

function nextRunLabel(job: CronJob): string {
  if (!job.next_run_at) return "—";
  const d = new Date(job.next_run_at);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CronWidget({ cron }: { cron: CronJob[] | null }) {
  if (!cron) return <span className="dim">loading…</span>;
  const upcoming = cron
    .filter((j) => j.enabled && j.next_run_at)
    .sort((a, b) => (a.next_run_at ?? "").localeCompare(b.next_run_at ?? ""))
    .slice(0, 4);
  if (upcoming.length === 0) return <span className="dim">no scheduled jobs</span>;
  return (
    <div className="rows">
      {upcoming.map((j) => (
        <div className="row" key={j.id}>
          <span className="dim">{nextRunLabel(j)}</span>
          <span>{(j.name ?? j.id).slice(0, 16)}</span>
          <span className={j.last_error ? "werr" : "ok"}>
            {j.last_error ? "err" : "ok"}
          </span>
        </div>
      ))}
    </div>
  );
}
