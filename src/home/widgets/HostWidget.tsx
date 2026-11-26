import { useEffect, useRef, useState } from "react";
import type { SystemStats } from "@/api-types";
import { HoverArrows } from "./HoverArrows";
import { useT, type MessageKey } from "../i18n";
import {
  BUFFER_CAP, HOST_SIGNALS, HOST_VIEWS, SAMPLE_MS,
  areaPath, coerceHostView, pushSample, seriesOf, seriesPath, signalMax, toSample,
  type HostSample, type HostView,
} from "./hostSeries";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

interface Props {
  system: SystemStats | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

function Meter({ label, pct, val }: { label: string; pct: number; val: string }) {
  return (
    <div className="meter">
      <span className="lbl">{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <span className="val">{val}</span>
    </div>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="row">
      <span className="dim">{label}</span>
      <span>{val}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((seconds % 3_600) / 60)}m`;
}

// Per-instance gradient id namespace (same approach as the Tokens widget —
// the shim'd React build has no useId).
let gradSeq = 0;

/** One live sparkline: rolling window of a single signal, drawn with the
 *  Tokens line-chart geometry (area fill + non-scaling stroke). */
function Spark({ values, fixedMax, label, readout, gid }: {
  values: (number | null)[];
  fixedMax: number | undefined;
  label: string;
  readout: string;
  gid: string;
}) {
  const max = signalMax(values, fixedMax);
  const H = 100, W = 100, PAD = 6;
  const line = seriesPath(values, max, W, H, PAD);
  const area = areaPath(line, H);
  return (
    <div className="host-spark">
      <div className="host-spark-head">
        <span className="dim">{label}</span>
        <span className="val">{readout}</span>
      </div>
      <svg className="home-area" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--home-accent)", stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: "var(--home-accent)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gid})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke="var(--home-accent)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

/** Host stats. Hover arrows cycle meters → detail → graphs; the graphs view
 *  shows four live sparklines (cpu, ram, load, proc) over a rolling one-minute
 *  window sampled every 2s. The chosen view persists in the layout props. */
export function HostWidget({ system, widgetProps, onWidgetPropsChange }: Props) {
  const t = useT();
  const view: HostView = coerceHostView(widgetProps.view);
  const [buf, setBuf] = useState<HostSample[]>([]);
  const latest = useRef<SystemStats | null>(null);
  latest.current = system;
  const [gidBase] = useState(() => `host-grad-${gradSeq++}`);

  // Live sampler: the shared poll refreshes `system` every ~10s; between
  // polls we re-sample the latest payload every 2s so fast-moving signals
  // (cpu%) still draw a dense line. Runs only while the graphs view is up.
  useEffect(() => {
    if (view !== "graphs") return;
    setBuf([]);
    const tick = () => {
      const s = latest.current;
      if (!s) return;
      setBuf((prev) => pushSample(prev, toSample(s, Date.now()), BUFFER_CAP));
    };
    tick();
    const id = setInterval(tick, SAMPLE_MS);
    return () => clearInterval(id);
  }, [view]);

  if (!system) return <span className="dim">{t("common.loading")}</span>;

  const cycle = (dir: 1 | -1) => {
    const i = (HOST_VIEWS.indexOf(view) + dir + HOST_VIEWS.length) % HOST_VIEWS.length;
    onWidgetPropsChange({ ...widgetProps, view: HOST_VIEWS[i] });
  };

  return (
    <div>
      <HoverArrows onPrev={() => cycle(-1)} onNext={() => cycle(1)} label={t(`host.view.${view}`)} />
      {view === "meters" && (
        <>
          <div className="meters">
            {system.cpu_percent !== undefined && (
              <Meter label={t("host.cpu")} pct={system.cpu_percent} val={`${Math.round(system.cpu_percent)}%`} />
            )}
            {system.memory && (
              <Meter label={t("host.ram")} pct={system.memory.percent} val={`${(system.memory.used / GB).toFixed(1)}G`} />
            )}
            {system.disk && (
              <Meter label={t("host.disk")} pct={system.disk.percent} val={`${Math.round(system.disk.percent)}%`} />
            )}
          </div>
          <div className="row">
            <span className="dim">{system.hostname}</span>
            <span>{system.uptime_seconds !== undefined ? formatUptime(system.uptime_seconds) : "—"}</span>
          </div>
        </>
      )}
      {view === "detail" && (
        <div className="rows">
          {system.load_avg && system.load_avg.length >= 3 && (
            <Row label={t("host.load")} val={system.load_avg.slice(0, 3).map((n) => n.toFixed(2)).join(" ")} />
          )}
          {system.cpu_count !== null && <Row label={t("host.cores")} val={String(system.cpu_count)} />}
          {system.memory && (
            <Row label={t("host.ram")} val={`${(system.memory.used / GB).toFixed(1)} / ${(system.memory.total / GB).toFixed(1)}G`} />
          )}
          {system.disk && (
            <Row label={t("host.disk")} val={t("host.diskFree", { n: (system.disk.free / GB).toFixed(0) })} />
          )}
          {system.process && (
            <Row label={t("host.proc")} val={t("host.procValue", { mb: (system.process.rss / MB).toFixed(0), threads: system.process.num_threads })} />
          )}
          <Row label={t("host.os")} val={`${system.platform} ${system.arch}`} />
        </div>
      )}
      {view === "graphs" && (
        <div className="host-sparks">
          {HOST_SIGNALS.map((sig) => {
            const values = seriesOf(buf, sig.key);
            const last = [...values].reverse().find((v) => v !== null);
            return (
              <Spark
                key={sig.key}
                values={values}
                fixedMax={sig.fixedMax}
                label={t(`host.${sig.key}` as MessageKey)}
                readout={last === undefined || last === null ? "—" : sig.format(last)}
                gid={`${gidBase}-${sig.key}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
