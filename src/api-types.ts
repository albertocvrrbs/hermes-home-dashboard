// Type interfaces for core dashboard API responses, copied from
// hermes-agent web/src/lib/api.ts. The runtime client comes from the
// host SDK (window.__HERMES_PLUGIN_SDK__.api); these are just the shapes.

export interface PlatformStatus {
  error_code?: string;
  error_message?: string;
  state: string;
  updated_at: string;
}

export interface StatusResponse {
  active_sessions: number;
  /** Phase 7: ``true`` when the dashboard's OAuth gate is engaged
   * (public bind, no ``--insecure``). Read alongside ``auth_providers``
   * to render a "gated / loopback" badge. */
  auth_required?: boolean;
  /** Phase 7: registered ``DashboardAuthProvider`` names (e.g. ``["nous"]``).
   * Empty in loopback mode; empty + ``auth_required=true`` is a
   * fail-closed state (the dashboard will refuse to bind). */
  auth_providers?: string[];
  config_path: string;
  config_version: number;
  env_path: string;
  gateway_exit_reason: string | null;
  gateway_health_url: string | null;
  gateway_pid: number | null;
  gateway_platforms: Record<string, PlatformStatus>;
  gateway_running: boolean;
  gateway_state: string | null;
  gateway_updated_at: string | null;
  hermes_home: string;
  latest_config_version: number;
  release_date: string;
  version: string;
}

export interface SessionInfo {
  id: string;
  source: string | null;
  model: string | null;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  last_active: number;
  is_active: boolean;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  preview: string | null;
  parent_session_id?: string | null;
}

export interface PaginatedSessions {
  sessions: SessionInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface SystemStats {
  os: string;
  os_release: string;
  os_version: string;
  platform: string;
  arch: string;
  hostname: string;
  python_version: string;
  python_impl: string;
  hermes_version: string;
  cpu_count: number | null;
  psutil: boolean;
  cpu_percent?: number;
  load_avg?: number[];
  uptime_seconds?: number;
  memory?: { total: number; available: number; used: number; percent: number };
  disk?: { total: number; used: number; free: number; percent: number };
  process?: { pid: number; rss: number; create_time: number; num_threads: number };
}

export interface AnalyticsDailyEntry {
  day: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  reasoning_tokens: number;
  estimated_cost: number;
  actual_cost: number;
  sessions: number;
  api_calls: number;
}

export interface AnalyticsModelEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  sessions: number;
  api_calls: number;
}

/** One (model, provider) row of /api/analytics/models. `provider` is the
 *  billing provider and can be "" for sessions that never recorded one. */
export interface ModelsAnalyticsEntry {
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  sessions: number;
  api_calls: number;
}

export interface ModelsAnalyticsResponse {
  models: ModelsAnalyticsEntry[];
  period_days?: number;
}

/** One ~/projects/<id>/status.json, normalized by the plugin backend. */
export interface ProjectStatus {
  id: string;
  project: string;
  status: string;
  lastUpdated: string | null;
  stats: { inbox: number; inProgress: number; completed: number };
  alerts: string[];
  nextAction: string;
}

export interface ProjectsResponse {
  projects: ProjectStatus[];
}

export interface AnalyticsSkillsSummary {
  total_skill_loads: number;
  total_skill_edits: number;
  total_skill_actions: number;
  distinct_skills_used: number;
}

export interface AnalyticsSkillEntry {
  skill: string;
  view_count: number;
  manage_count: number;
  total_count: number;
  percentage: number;
  last_used_at: number | null;
}

export interface AnalyticsResponse {
  daily: AnalyticsDailyEntry[];
  by_model: AnalyticsModelEntry[];
  totals: {
    total_input: number;
    total_output: number;
    total_cache_read: number;
    total_reasoning: number;
    total_estimated_cost: number;
    total_actual_cost: number;
    total_sessions: number;
    total_api_calls: number;
  };
  skills: {
    summary: AnalyticsSkillsSummary;
    top_skills: AnalyticsSkillEntry[];
  };
}

export interface LogsResponse {
  file: string;
  lines: string[];
}

export interface CronJob {
  id: string;
  profile?: string | null;
  profile_name?: string | null;
  hermes_home?: string | null;
  is_default_profile?: boolean;
  name?: string | null;
  prompt?: string | null;
  script?: string | null;
  skills?: string[] | null;
  schedule?: { kind?: string; expr?: string; display?: string };
  schedule_display?: string | null;
  enabled: boolean;
  state?: string | null;
  deliver?: string | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
}
// ── Spend widget (this plugin's /spend route) ──

/** "metered" = real pay-per-use money; "subscription" = covered by a flat-fee
 *  plan (list-price value, not an invoice); "unclassified" = undecidable. */
export type SpendClass = "metered" | "subscription" | "unclassified";

export interface SpendProvider {
  provider: string;
  cost: number;
  estimated: number;
  actual: number;
  sessions: number;
  /** Why it was classified so: hermes | provider | oauth | api_key | ... */
  basis: string;
}

export interface SpendBucket {
  total: number;
  estimated: number;
  actual: number;
  by_provider: SpendProvider[];
}

export interface SpendSession {
  id: string;
  title: string | null;
  source: string | null;
  model: string | null;
  started_at: number | null;
  provider: string;
  cost: number;
  class: SpendClass | "mixed";
  actual: boolean;
}

export interface SpendResponse {
  period: "today" | "week" | "month";
  currency: "USD";
  window: { start: number; end: number };
  /** False when the session store could not be read. */
  available: boolean;
  /** True when at least one session in range has a cost. */
  has_data: boolean;
  real?: SpendBucket;
  covered?: SpendBucket;
  unclassified?: SpendBucket & { unknown_cost_sessions: number };
  month?: {
    start: number; end: number; days: number; elapsed_days: number;
    real: number; covered: number; unclassified: number; projection: number;
  };
  sessions?: { in_range: number; with_cost: number; without_cost: number };
  top?: SpendSession[];
  top_real?: SpendSession[];
  classification?: Record<string, string>;
}
