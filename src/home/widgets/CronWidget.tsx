import { useState } from "react";
import type { CronJob } from "@/api-types";
import { HoverArrows } from "./HoverArrows";
import { useT } from "../i18n";

const PER_PAGE = 4;

function nextRunLabel(job: CronJob): string {
  if (!job.next_run_at) return "—";
  const d = new Date(job.next_run_at);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Upcoming enabled cron jobs, soonest first. Hover arrows page through them
 *  4 at a time. */
export function CronWidget({ cron }: { cron: CronJob[] | null }) {
  const t = useT();
  const [page, setPage] = useState(0);
  if (!cron) return <span className="dim">{t("common.loading")}</span>;
  const upcoming = cron
    .filter((j) => j.enabled && j.next_run_at)
    .sort((a, b) => (a.next_run_at ?? "").localeCompare(b.next_run_at ?? ""));
  if (upcoming.length === 0) return <span className="dim">{t("cron.empty")}</span>;
  const pages = Math.max(1, Math.ceil(upcoming.length / PER_PAGE));
  const p = Math.min(page, pages - 1);
  const slice = upcoming.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
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
      <div className="rows">
        {slice.map((j) => (
          <div className="row" key={j.id}>
            <span className="dim">{nextRunLabel(j)}</span>
            <span className="row-name" title={j.name ?? j.id}>{j.name ?? j.id}</span>
            <span className={j.last_error ? "werr" : "ok"}>
              {j.last_error ? t("cron.err") : t("cron.ok")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
