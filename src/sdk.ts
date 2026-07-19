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

export interface HermesHomeHost extends HermesPluginSDK {
  navigateTo: (routePath: string) => void;
}

declare global {
  interface Window {
    __HERMES_PLUGIN_SDK__?: Record<string, unknown>;
    __HERMES_PLUGINS__?: {
      register: (name: string, component: unknown) => void;
    };
  }
}

function getDashboardHost(): HermesHomeHost {
  const sdk = window.__HERMES_PLUGIN_SDK__;
  if (!sdk) throw new Error("Hermes plugin SDK not available");
  const dashboard = sdk as unknown as HermesPluginSDK;
  return {
    ...dashboard,
    navigateTo: (routePath) => window.location.assign(routePath),
  };
}

let configuredHost: HermesHomeHost | null = null;

export function configureHomeHost(host: HermesHomeHost): void {
  configuredHost = host;
}

function getHost(): HermesHomeHost {
  return configuredHost ?? getDashboardHost();
}

export const api: HermesApi = {
  getStatus: () => getHost().api.getStatus(),
  getSystemStats: () => getHost().api.getSystemStats(),
  getAnalytics: (days) => getHost().api.getAnalytics(days),
  getCronJobs: (profile) => getHost().api.getCronJobs(profile),
  getSessions: (limit, offset) => getHost().api.getSessions(limit, offset),
  getLogs: (params) => getHost().api.getLogs(params),
};

export function fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  return getHost().fetchJSON<T>(url, init);
}

/** Navigate to a core dashboard route. The SDK doesn't expose the host
 *  router, so this is a full-page navigation (fine for an occasional
 *  widget click-through). */
export function navigateTo(routePath: string): void {
  getHost().navigateTo(routePath);
}
