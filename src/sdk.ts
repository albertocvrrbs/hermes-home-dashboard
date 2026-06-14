// Typed access to the Hermes dashboard plugin SDK (window.__HERMES_PLUGIN_SDK__).
// The host exposes its React instance, an authenticated API client for core
// endpoints, and fetchJSON. We only declare the slice we use.
import type {
  StatusResponse, SystemStats, AnalyticsResponse,
  PaginatedSessions, LogsResponse, CronJob,
} from "./api-types";

export interface HermesApi {
  getStatus(): Promise<StatusResponse>;
  getSystemStats(): Promise<SystemStats>;
  getAnalytics(days: number): Promise<AnalyticsResponse>;
  getCronJobs(profile?: string): Promise<CronJob[]>;
  getSessions(limit?: number, offset?: number): Promise<PaginatedSessions>;
  getLogs(params: {
    file?: string; lines?: number; level?: string; component?: string;
  }): Promise<LogsResponse>;
}

interface HermesPluginSDK {
  api: HermesApi;
  fetchJSON: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
}

declare global {
  interface Window {
    __HERMES_PLUGIN_SDK__?: Record<string, unknown>;
    __HERMES_PLUGINS__?: {
      register: (name: string, component: unknown) => void;
    };
  }
}

function getSDK(): HermesPluginSDK {
  const sdk = window.__HERMES_PLUGIN_SDK__;
  if (!sdk) throw new Error("Hermes plugin SDK not available");
  return sdk as unknown as HermesPluginSDK;
}

export const api: HermesApi = getSDK().api;
export const fetchJSON = getSDK().fetchJSON;

/** Navigate to a core dashboard route. The SDK doesn't expose the host
 *  router, so this is a full-page navigation (fine for an occasional
 *  widget click-through). */
export function navigateTo(routePath: string): void {
  window.location.assign(routePath);
}
