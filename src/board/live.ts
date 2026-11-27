// Live cards, the pure half: bindings, formatting, freshness and sparkline geometry.
// Mirrors dashboard/boardkit/live.py. Kept free of React/SDK imports so node --test can load it.

export type LiveStatus = "running" | "paused" | "done" | "error" | "idle";
export type LiveFmt = "num" | "int" | "pct" | "usd" | "dur" | "text";
export type LiveValue = string | number | boolean | number[] | string[] | null | undefined;

export interface LiveMetric { label: string; value: unknown; unit?: string; delta?: unknown; good?: "up" | "down"; fmt?: LiveFmt }
export interface LiveActionRef { action: string; label?: string; icon?: string; args?: Record<string, unknown> }

export type LiveBlock =
  | { t: "header"; title?: unknown; sub?: unknown; status?: unknown; icon?: string }
  | { t: "progress"; value: unknown; max?: unknown; label?: unknown; eta?: unknown }
  | { t: "metrics"; items: LiveMetric[] }
  | { t: "spark"; series: unknown; label?: string; unit?: string; fmt?: LiveFmt; min?: unknown; max?: unknown }
  | { t: "media"; video?: unknown; image?: unknown; poster?: unknown; caption?: unknown }
  | { t: "text"; value: unknown; label?: string; lines?: number; mono?: boolean }
  | { t: "actions"; items: LiveActionRef[] };

/** Public view of a registered action (GET /boards/live/actions). */
export interface LiveActionInfo {
  id: string; label: string; description: string; destructive: boolean; enabled: boolean; timeout: number;
  confirm?: string; note?: string; icon?: string; kind: string;
}

export const STATUSES: readonly LiveStatus[] = ["running", "paused", "done", "error", "idle"];
const KEY = /^[A-Za-z_][A-Za-z0-9_.-]{0,39}$/;

export function isBinding(v: unknown): v is string {
  return typeof v === "string" && v.length > 1 && v[0] === "$" && v[1] !== "$" && KEY.test(v.slice(1));
}

/** A block value after bindings: `$key` reads data (undefined when absent), `$$x` is literal `$x`. */
export function resolve(v: unknown, data: Record<string, unknown> | undefined): LiveValue {
  if (isBinding(v)) return (data?.[v.slice(1)] ?? undefined) as LiveValue;
  if (typeof v === "string" && v.startsWith("$$")) return v.slice(1);
  return v as LiveValue;
}

export function present(v: LiveValue): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function asStatus(v: LiveValue): LiveStatus | null {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v) ? (v as LiveStatus) : null;
}

/** Statuses that can go stale: a finished card doesn't need fresh data. */
export function canStale(status: LiveStatus | null): boolean {
  return status === null || status === "running" || status === "paused";
}

export interface Freshness { age: number | null; stale: boolean }

export function freshness(at: number | undefined, ttl: number | undefined, status: LiveStatus | null, now: number): Freshness {
  if (!at) return { age: null, stale: false };
  const age = Math.max(0, Math.round(now - at));
  return { age, stale: canStale(status) && age > (ttl ?? 300) };
}

/** "12 s", "4 min", "2 h", "3 d" — the age of the last update. */
export function shortAge(s: number): { n: number; unit: "s" | "min" | "h" | "d" } {
  if (s < 60) return { n: s, unit: "s" };
  if (s < 3600) return { n: Math.floor(s / 60), unit: "min" };
  if (s < 86400) return { n: Math.floor(s / 3600), unit: "h" };
  return { n: Math.floor(s / 86400), unit: "d" };
}

/** Compact, fits a metric cell: 6342 -> "1h 45m", 2280 -> "38m", 245 -> "4m 05s", 42 -> "42s". */
export function fmtDuration(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "—";
  s = Math.round(s);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m >= 10) return `${m}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

function trimNum(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0+$|(\.\d*?)0+$/, "$1");
}

/** Formats a metric value; strings pass through untouched (scripts may pre-format). */
export function fmtValue(v: LiveValue, fmt: LiveFmt | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? fmtValue(v[v.length - 1] as LiveValue, fmt) : "—";
  if (typeof v === "string") return v;
  switch (fmt) {
    case "int": return Math.round(v).toLocaleString("en-US");
    case "pct": return `${trimNum(v, Math.abs(v) >= 100 ? 0 : 1)} %`;
    case "usd": return `$${v.toFixed(2)}`;
    case "dur": return fmtDuration(v);
    case "text": return String(v);
    default: {
      const a = Math.abs(v);
      if (a >= 1e9) return `${trimNum(v / 1e9, 2)} B`;
      if (a >= 1e6) return `${trimNum(v / 1e6, 2)} M`;
      if (a >= 1e4) return `${trimNum(v / 1e3, 1)} k`;
      return trimNum(v, a >= 100 ? 0 : a >= 10 ? 1 : 2);
    }
  }
}

/** A delta: numbers get a sign and the metric's format; "+2.1" style strings pass through. */
export function fmtDelta(v: LiveValue, fmt: LiveFmt | undefined): { text: string; dir: "up" | "down" | "flat" } | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
    const body = fmt === "pct" ? `${trimNum(Math.abs(v), 1)}` : fmt === "usd" ? `$${Math.abs(v).toFixed(2)}` : fmt === "dur" ? fmtDuration(Math.abs(v)) : trimNum(Math.abs(v), 2);
    return { text: `${v > 0 ? "+" : v < 0 ? "−" : "±"}${body}`, dir };
  }
  const s = String(v).trim();
  return { text: s, dir: /^[+▲↑]/.test(s) ? "up" : /^[-−▼↓]/.test(s) ? "down" : "flat" };
}

/** Progress as 0..1: `value/max` when max is given, else a fraction (or a percent if > 1). */
export function progressOf(value: LiveValue, max: LiveValue): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const m = typeof max === "number" && max > 0 ? max : value > 1 ? 100 : 1;
  return Math.max(0, Math.min(1, value / m));
}

export function numbers(v: LiveValue): number[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is number => typeof x === "number" && Number.isFinite(x)) : [];
}

export interface Spark { line: string; area: string; last: [number, number] | null; min: number; max: number }

/** Sparkline paths in a w x h box (y down), padded so the stroke and the end dot fit. */
export function sparkPaths(series: number[], w: number, h: number, lo?: number, hi?: number, pad = 3): Spark {
  const pts = series.slice(-240);
  if (pts.length === 0) return { line: "", area: "", last: null, min: 0, max: 0 };
  let min = lo ?? Math.min(...pts), max = hi ?? Math.max(...pts);
  if (max - min < 1e-9) { min -= 1; max += 1; }
  const n = pts.length;
  const xy = pts.map((v, i): [number, number] => {
    const x = n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1);
    const y = pad + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min)) * (h - pad * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const area = n > 1 ? `${line} L${xy[n - 1][0]} ${h} L${xy[0][0]} ${h} Z` : "";
  return { line, area, last: xy[n - 1], min: lo ?? Math.min(...pts), max: hi ?? Math.max(...pts) };
}

/** Text block lines: a string splits on newlines, an array is already lines; keeps the tail. */
export function tailLines(v: LiveValue, n: number): string[] {
  const lines = Array.isArray(v) ? (v as unknown[]).map(String) : typeof v === "string" ? v.replace(/\s+$/, "").split("\n") : [];
  return lines.slice(-Math.max(1, n));
}

/** Media source: a board asset id, or an http(s) URL. */
export function mediaRef(v: LiveValue): { asset: string } | { url: string } | null {
  if (typeof v !== "string") return null;
  if (/^[a-f0-9]{16}\.(png|jpg|gif|webp|mp4|webm|mov)$/.test(v)) return { asset: v };
  if (/^https?:\/\//i.test(v)) return { url: v };
  return null;
}

/** Template labels: "@success" is a UI string, anything else is shown as written. */
export function labelKey(label: string): string | null {
  return /^@[A-Za-z]{1,32}$/.test(label) ? label.slice(1) : null;
}
