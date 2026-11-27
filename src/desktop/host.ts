import type { GatewayRpcEvent, HermesApi, HermesHomeHost } from "../sdk";

interface DesktopPluginContext {
  rest<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T>;
}

interface DesktopSdkHost {
  status(): Promise<unknown>;
  logs(params: {
    file?: string;
    lines?: number;
    level?: string;
    component?: string;
  }): Promise<unknown>;
  navigate(path: string): void;
  /** Newer Desktop builds; feature-detected. */
  openSession?(id: string, options?: { profile?: string; intent?: string }): unknown;
  onEvent(type: string, listener: (event: GatewayRpcEvent) => void): () => void;
}

const PLUGIN_API_PREFIX = "/api/plugins/home-dashboard";

function query(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const suffix = search.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function desktopRoute(path: string): string {
  const routes: Record<string, string> = {
    "/system": "/command-center?section=system",
    "/sessions": "/",
    "/cron": "/cron",
    "/logs": "/command-center?section=logs",
  };
  return routes[path] ?? path;
}

export function createDesktopHomeHost(
  ctx: DesktopPluginContext,
  desktop: DesktopSdkHost,
): HermesHomeHost {
  const api: HermesApi = {
    getStatus: () => desktop.status() as ReturnType<HermesApi["getStatus"]>,
    getSystemStats: () => ctx.rest("/system"),
    getAnalytics: (days) => ctx.rest(query("/analytics", { days })),
    getModelsAnalytics: (days) => ctx.rest(query("/models", { days })),
    getCronJobs: (profile) => ctx.rest(query("/cron", { profile })),
    getSessions: (limit, offset) => ctx.rest(query("/sessions", { limit, offset })),
    getLogs: (params) => desktop.logs(params) as ReturnType<HermesApi["getLogs"]>,
  };

  return {
    api,
    async fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
      if (url !== PLUGIN_API_PREFIX && !url.startsWith(`${PLUGIN_API_PREFIX}/`)) {
        throw new Error(`Desktop Home cannot access API path: ${url}`);
      }

      const path = url.slice(PLUGIN_API_PREFIX.length) || "/";
      const options: { method?: string; body?: unknown } = {};
      if (init?.method) options.method = init.method;
      if (init?.body !== undefined && init.body !== null) {
        options.body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      }
      return ctx.rest<T>(path, options);
    },
    navigateTo: (path) => desktop.navigate(desktopRoute(path)),
    openSession: (id) => {
      if (typeof desktop.openSession === "function") {
        void Promise.resolve(desktop.openSession(id)).catch(() => desktop.navigate(desktopRoute("/sessions")));
      } else {
        desktop.navigate(desktopRoute("/sessions"));
      }
    },
    onEvent: (type, listener) => desktop.onEvent(type, listener),
  };
}
