// Typed access to the Hermes dashboard plugin SDK (window.__HERMES_PLUGIN_SDK__).
// The host exposes its React instance, an authenticated API client for core
// endpoints, and fetchJSON. We only declare the slice we use.
import type {
  StatusResponse, SystemStats, AnalyticsResponse, ModelsAnalyticsResponse,
  PaginatedSessions, LogsResponse, CronJob, ProjectsResponse, SpendResponse,
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

/** Sandboxed frame from the Desktop SDK (opaque origin, allow-scripts). Absent on the web
 *  dashboard and on older Desktop builds. */
export type SandboxedFrameComponent = (props: {
  src: string; title: string; sandbox?: string; className?: string; style?: Record<string, string | number>;
}) => import("react").ReactNode;

export interface HermesHomeHost extends HermesPluginSDK {
  navigateTo: (routePath: string) => void;
  /** Open one stored session (chat resume on the web, the session view on
   *  Desktop). */
  openSession: (sessionId: string) => void;
  /** Live gateway events (desktop only). Absent on the web dashboard. */
  onEvent?: (type: string, listener: (event: GatewayRpcEvent) => void) => () => void;
  /** Boards: open the board page (null = the boards index). */
  openBoard?: (id: string | null) => void;
  /** Boards: start a fresh chat with `text` in its composer (Desktop/Webapp). */
  newChatWithDraft?: (text: string, opts?: { settleMs?: number }) => Promise<boolean>;
  /** Boards: gateway JSON-RPC (Desktop/Webapp), used to send board prompts to the linked session. */
  rpc?: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  /** Boards: the SDK's SandboxedFrame for HTML embeds. */
  SandboxedFrame?: SandboxedFrameComponent;
  /** Boards: Hermes Desktop's own model menu (`ModelCatalogMenu`), wrapped for the chat panel.
   *  Absent on the web dashboard and on Desktop builds that don't export it. */
  modelMenu?: ModelMenuHost;
}

/** What a pick means, in the shape of the Desktop SDK's `ModelMenuController`. */
export interface BoardModelController {
  allowSpeed?: boolean;
  current: { model: string; provider: string; effort: string; effortPending?: boolean; effortWire?: string; fast: boolean; serviceTier?: string };
  applyPreset: (preset: { effort?: string; fast?: boolean; serviceTier?: string }, row: { model: string; provider: string }) => void;
  presetFor: (provider: string, model: string) => { effort?: string; fast?: boolean; serviceTier?: string };
  select: (model: string, provider: string) => Promise<boolean | void> | void;
  setOptions: (patch: { effort?: string; fast?: boolean; serviceTier?: string }, row: { isActive: boolean; model: string; provider: string }) => void;
}

export interface ModelPickerProps {
  controller: BoardModelController;
  /** Runtime id of the board's live session (scopes the catalog like a chat tile). */
  sessionId: string;
  profile: string;
  /** Pill text (current model) and its tooltip. */
  label: string;
  title: string;
  /** Copy of the composer's "Refresh models" footer row. */
  refreshLabel: string;
  className?: string;
}

/** A guarded switch answered `confirm_required`: ask like Desktop does, resend when confirmed. */
export interface ModelSwitchConfirm {
  model: string;
  message?: string;
  failureMessage: string;
  requestConfirmed: () => Promise<{ confirm_required?: boolean; confirm_message?: string } | undefined>;
}

export interface ModelMenuHost {
  Picker: (props: ModelPickerProps) => import("react").ReactNode;
  confirm?: (opts: ModelSwitchConfirm) => Promise<boolean>;
  notifyError?: (error: unknown, fallback: string) => void;
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
    // Same target as the core Sessions page's "resume in chat" button.
    openSession: (id) => window.location.assign(`/chat?resume=${encodeURIComponent(id)}`),
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

/** Spend widget data (money spent vs value covered by subscriptions), served
 *  by this plugin's own backend. `utcOffset` is local minus UTC in minutes,
 *  so "today" and "this month" follow the viewer's clock. */
export function getSpend(period: string, utcOffset: number): Promise<SpendResponse> {
  const q = new URLSearchParams({ period, utc_offset: String(Math.round(utcOffset)) });
  return fetchJSON<SpendResponse>(`/api/plugins/home-dashboard/spend?${q}`);
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

/** Open a stored session from a widget row. */
export function openSession(sessionId: string): void {
  getHost().openSession(sessionId);
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

// ── Boards host doors ────────────────────────────────────────────────────

/** Web dashboard board routes live in the Home tab's hash: #boards, #board=<id>. */
export function webBoardHash(id: string | null): string {
  return id ? `#board=${id}` : "#boards";
}

/** Reads the board route from either surface: web `#board=<id>` / `#boards`, Desktop
 *  `#/boards?id=<id>` (hash router) or `?id=` in the search. `undefined` = not a board route. */
export function readBoardRoute(loc: { hash: string; search: string; pathname: string }): string | null | undefined {
  const hash = loc.hash || "";
  const web = /^#board=([a-z0-9]{8})$/.exec(hash);
  if (web) return web[1];
  if (hash === "#boards") return null;
  const routed = /^#\/boards(?:\?(.*))?$/.exec(hash);
  if (routed || /\/boards\/?$/.test(loc.pathname)) {
    const q = new URLSearchParams(routed?.[1] ?? loc.search.replace(/^\?/, ""));
    const id = q.get("id");
    return id && /^[a-z0-9]{8}$/.test(id) ? id : null;
  }
  return undefined;
}

export function openBoard(id: string | null): void {
  const h = getHost();
  if (h.openBoard) h.openBoard(id);
  else window.location.hash = webBoardHash(id);
}

/** Opens a new chat with a prepared prompt. On the web dashboard the prompt is copied and
 *  the chat page opened (no composer door there); returns false in that case. */
export async function newChatWithDraft(text: string): Promise<boolean> {
  const h = getHost();
  if (h.newChatWithDraft) return h.newChatWithDraft(text);
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // clipboard may be unavailable (insecure origin); the chat still opens
  }
  window.location.assign("/chat");
  return false;
}

export function hostRpc(): HermesHomeHost["rpc"] {
  return getHost().rpc;
}

export function hostSandboxedFrame(): SandboxedFrameComponent | undefined {
  return getHost().SandboxedFrame;
}

export function hostModelMenu(): ModelMenuHost | undefined {
  return getHost().modelMenu;
}
