// Pure rolling-series helpers for the Host widget's live "graphs" view,
// kept React-free for unit testing (same pattern as tokenSeries.ts).
import type { SystemStats } from "@/api-types";

const MB = 1024 ** 2;

/** One point in the rolling window: epoch ms + the four live signals.
 *  A signal is null when its source is missing from the stats payload
 *  (e.g. psutil not installed) — gaps, not zeros. */
export interface HostSample {
  t: number;
  cpu: number | null;
  ram: number | null;
  load: number | null;
  proc: number | null;
}

export type HostSignalKey = "cpu" | "ram" | "load" | "proc";

export interface HostSignal {
  key: HostSignalKey;
  label: string;
  /** Fixed y-scale ceiling (percent signals); undefined = autoscale to peak. */
  fixedMax: number | undefined;
  /** Latest-value readout shown next to the graph label. */
  format: (v: number) => string;
}

/** The four live graphs, in render order. */
export const HOST_SIGNALS: HostSignal[] = [
  { key: "cpu", label: "cpu", fixedMax: 100, format: (v) => `${Math.round(v)}%` },
  { key: "ram", label: "ram", fixedMax: 100, format: (v) => `${Math.round(v)}%` },
  { key: "load", label: "load", fixedMax: undefined, format: (v) => v.toFixed(2) },
  { key: "proc", label: "proc", fixedMax: undefined, format: (v) => `${Math.round(v / MB)}M` },
];

/** Live-view sampling: one point every 2s, 31 points = a rolling 60s window. */
export const SAMPLE_MS = 2_000;
export const BUFFER_CAP = 31;

export type HostView = "meters" | "detail" | "graphs";
export const HOST_VIEWS: HostView[] = ["meters", "detail", "graphs"];

/** Persisted layout props may hold anything (older versions knew only
 *  meters/detail) — coerce unknowns to the default instead of breaking. */
export function coerceHostView(value: unknown): HostView {
  return HOST_VIEWS.includes(value as HostView) ? (value as HostView) : "meters";
}

/** Extract the four signals from a stats payload. */
export function toSample(system: SystemStats, t: number): HostSample {
  return {
    t,
    cpu: system.cpu_percent ?? null,
    ram: system.memory ? system.memory.percent : null,
    load: system.load_avg && system.load_avg.length > 0 ? system.load_avg[0] : null,
    proc: system.process ? system.process.rss : null,
  };
}

/** Append a sample, trimming the window to `cap` points. Pure — returns a
 *  new array so React state updates see a new reference. */
export function pushSample(buf: HostSample[], sample: HostSample, cap: number): HostSample[] {
  const next = [...buf, sample];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** One signal's values across the window, in order. */
export function seriesOf(buf: HostSample[], key: HostSignalKey): (number | null)[] {
  return buf.map((s) => s[key]);
}

/** Y-scale for a window: the fixed ceiling when the signal has one, else the
 *  window peak. Always positive so division is safe. */
export function signalMax(values: (number | null)[], fixedMax: number | undefined): number {
  if (fixedMax !== undefined) return fixedMax;
  let peak = 0;
  for (const v of values) if (v !== null && v > peak) peak = v;
  return peak > 0 ? peak : 1;
}

/** Close a `seriesPath` line down to the viewbox floor for the gradient
 *  fill. Only contiguous lines (exactly one M, at least one L) fill —
 *  gappy windows would produce glitchy sliver subpath fills. */
export function areaPath(line: string, H: number): string {
  if (!line || !line.includes("L") || line.indexOf("M", 1) !== -1) return "";
  const firstX = line.slice(1, line.indexOf(","));
  const lastX = line.slice(line.lastIndexOf("L") + 1, line.lastIndexOf(","));
  return `${line} L${lastX},${H} L${firstX},${H} Z`;
}

/** SVG path for a series in a W×H viewbox with vertical padding, matching the
 *  Tokens line chart geometry. Null values break the line (M restarts). */
export function seriesPath(
  values: (number | null)[],
  max: number,
  W: number,
  H: number,
  pad: number,
): string {
  const n = values.length;
  if (n === 0) return "";
  const parts: string[] = [];
  let penDown = false;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null) { penDown = false; continue; }
    const x = n <= 1 ? W / 2 : (i / (n - 1)) * W;
    const y = H - pad - (Math.min(v, max) / max) * (H - pad * 2);
    parts.push(`${penDown ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`);
    penDown = true;
  }
  return parts.join(" ");
}
