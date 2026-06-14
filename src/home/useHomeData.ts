import { useEffect, useRef, useState } from "react";
import { api } from "../sdk";
import type {
  StatusResponse,
  SystemStats,
  AnalyticsResponse,
  PaginatedSessions,
  LogsResponse,
  CronJob,
} from "../api-types";

const POLL_MS = 10_000;

/** Slots stay null until the first response; `errors` flags failing sources.
 *  One polling loop feeds every widget — widgets never fetch on their own. */
export interface HomeData {
  status: StatusResponse | null;
  system: SystemStats | null;
  analytics: AnalyticsResponse | null;
  cron: CronJob[] | null;
  sessions: PaginatedSessions | null;
  logs: LogsResponse | null;
  errors: Set<HomeDataSource>;
}

export type HomeDataSource = "status" | "system" | "analytics" | "cron" | "sessions" | "logs";

const SOURCES = {
  status: () => api.getStatus(),
  system: () => api.getSystemStats(),
  analytics: () => api.getAnalytics(1),
  cron: () => api.getCronJobs(),
  sessions: () => api.getSessions(9),
  logs: () => api.getLogs({ lines: 50, level: "ERROR" }),
} as const;

export function useHomeData(): HomeData {
  const [data, setData] = useState<HomeData>({
    status: null, system: null, analytics: null,
    cron: null, sessions: null, logs: null, errors: new Set(),
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (document.hidden) return;
      const keys = Object.keys(SOURCES) as HomeDataSource[];
      const results = await Promise.allSettled(keys.map((k) => SOURCES[k]()));
      if (cancelled) return;
      setData((prev) => {
        const next = { ...prev, errors: new Set(prev.errors) };
        keys.forEach((key, i) => {
          const r = results[i];
          if (r.status === "fulfilled") {
            (next as unknown as Record<string, unknown>)[key] = r.value;
            next.errors.delete(key);
          } else {
            next.errors.add(key);
          }
        });
        return next;
      });
    }
    poll();
    timer.current = setInterval(poll, POLL_MS);
    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return data;
}
