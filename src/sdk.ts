// Typed access to the Hermes dashboard plugin SDK (window.__HERMES_PLUGIN_SDK__).
// The host exposes its React instance, an authenticated API client for core
// endpoints, and fetchJSON. We only declare the slice we use.
import type {
  StatusResponse, SystemStats, AnalyticsResponse, ModelsAnalyticsResponse,
  PaginatedSessions, LogsResponse, CronJob, ProjectsResponse,
} from "./api-types";

export interface HermesApi {
  getStatus(): Promise<StatusResponse>;
  getSystemStats(): Promise<SystemStats>;
  getAnalytics(days: number): Promise<AnalyticsResponse>;
  /** Per (model, provider) usage. Optional: older hosts don't expose it. */
  getModelsAnalytics?(days: number): Promise<ModelsAnalyticsResponse>;
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

export interface GatewayRpcEvent<T = unknown> {
  type: string;
  payload?: T;
  session_id?: string;
  profile?: string;
}

export interface HermesHomeHost extends HermesPluginSDK {
  navigateTo: (routePath: string) => void;
  /** Live gateway events (desktop only). Absent on the web dashboard. */
  onEvent?: (type: string, listener: (event: GatewayRpcEvent) => void) => () => void;
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

export const api: Required<HermesApi> = {
  getStatus: () => getHost().api.getStatus(),
  getSystemStats: () => getHost().api.getSystemStats(),
  getAnalytics: (days) => getHost().api.getAnalytics(days),
  getModelsAnalytics: (days) => {
    const host = getHost().api;
    return host.getModelsAnalytics
      ? host.getModelsAnalytics(days)
      : Promise.reject(new Error("model analytics not available on this Hermes"));
  },
  getCronJobs: (profile) => getHost().api.getCronJobs(profile),
  getSessions: (limit, offset) => getHost().api.getSessions(limit, offset),
  getLogs: (params) => getHost().api.getLogs(params),
};

export function fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  return getHost().fetchJSON<T>(url, init);
}

/** Project status board data, served by this plugin's own backend. */
export function getProjects(): Promise<ProjectsResponse> {
  return fetchJSON<ProjectsResponse>("/api/plugins/home-dashboard/projects");
}

/** Web dashboard only: the language chosen in the dashboard's own picker,
 *  read through the SDK's `useI18n` hook. Returns null on Desktop (it reports
 *  `display.language` through `ctx.i18n` instead) and on hosts without i18n.
 *  The hook's presence never changes during a page's life, so the
 *  conditional call keeps a stable hook order. */
export function useDashboardLocale(): string | null {
  if (configuredHost) return null;
  const sdk = window.__HERMES_PLUGIN_SDK__ as { useI18n?: () => unknown } | undefined;
  if (typeof sdk?.useI18n !== "function") return null;
  const value = sdk.useI18n() as { locale?: unknown } | null | undefined;
  return typeof value?.locale === "string" ? value.locale : null;
}

/** Navigate to a core dashboard route. The SDK doesn't expose the host
 *  router, so this is a full-page navigation (fine for an occasional
 *  widget click-through). */
export function navigateTo(routePath: string): void {
  getHost().navigateTo(routePath);
}

/** Subscribe to live gateway events (desktop only). Returns null on the web
 *  dashboard (no live channel) so callers can fall back to polling. */
export function onGatewayEvent(
  type: string,
  listener: (event: GatewayRpcEvent) => void,
): (() => void) | null {
  const h = getHost();
  if (!h.onEvent) return null;
  return h.onEvent(type, listener);
}
