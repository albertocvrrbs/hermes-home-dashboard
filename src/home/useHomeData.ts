import { useEffect, useRef, useState } from "react";
import { api } from "../sdk";
import { demoOn, demoSource } from "../demo";
import { withTimeout } from "./fetchGuard";
import type {
  StatusResponse,
  SystemStats,
  AnalyticsResponse,
  PaginatedSessions,
  LogsResponse,
  CronJob,
} from "../api-types";

const POLL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;

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
  sessions: () => api.getSessions(20),
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
    // One request per source at a time: a slow answer is not stacked under the next tick.
    const inflight = new Set<HomeDataSource>();
    const keys = Object.keys(SOURCES) as HomeDataSource[];
    // Each source lands in the state as soon as it answers. (They used to wait for the slowest one
    // via allSettled, so a single stalled request left every other widget on "loading…".)
    const fetchOne = (key: HomeDataSource) => {
      if (inflight.has(key)) return;
      inflight.add(key);
      withTimeout<unknown>(() => SOURCES[key]() as Promise<unknown>, REQUEST_TIMEOUT_MS).then(
        (value) => {
          inflight.delete(key);
          if (cancelled) return;
          const shown = demoOn() ? demoSource(key, value, Date.now()) : value;
          setData((prev) => {
            const errors = new Set(prev.errors);
            errors.delete(key);
            return { ...prev, [key]: shown, errors };
          });
        },
        () => {
          inflight.delete(key);
          if (cancelled) return;
          setData((prev) => (prev.errors.has(key) ? prev : { ...prev, errors: new Set(prev.errors).add(key) }));
        },
      );
    };
    const poll = (first = false) => {
      // The first round always runs: a tab that mounts in the background (prerender, a window that
      // is not focused yet) must not start empty. Later rounds pause while hidden.
      if (document.hidden && !first) return;
      keys.forEach(fetchOne);
    };
    poll(true);
    timer.current = setInterval(() => poll(), POLL_MS);
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
