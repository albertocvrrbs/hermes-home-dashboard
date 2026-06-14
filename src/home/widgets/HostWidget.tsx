import type { SystemStats } from "../../api-types";
import { HoverArrows } from "./HoverArrows";

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const VIEWS = ["meters", "detail"] as const;
type View = (typeof VIEWS)[number];

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

/** Host stats. Hover arrows flip between the meter view and a numeric detail
 *  breakdown (load, memory totals, disk free, process) — the extra fields the
 *  meters hide. The chosen view persists in the widget's layout props. */
export function HostWidget({ system, widgetProps, onWidgetPropsChange }: Props) {
  if (!system) return <span className="dim">loading…</span>;
  const view: View = widgetProps.view === "detail" ? "detail" : "meters";

  const cycle = (dir: 1 | -1) => {
    const i = (VIEWS.indexOf(view) + dir + VIEWS.length) % VIEWS.length;
    onWidgetPropsChange({ ...widgetProps, view: VIEWS[i] });
  };

  return (
    <div>
      <HoverArrows onPrev={() => cycle(-1)} onNext={() => cycle(1)} label={view} />
      {view === "meters" ? (
        <>
          <div className="meters">
            {system.cpu_percent !== undefined && (
              <Meter label="cpu" pct={system.cpu_percent} val={`${Math.round(system.cpu_percent)}%`} />
            )}
            {system.memory && (
              <Meter label="ram" pct={system.memory.percent} val={`${(system.memory.used / GB).toFixed(1)}G`} />
            )}
            {system.disk && (
              <Meter label="disk" pct={system.disk.percent} val={`${Math.round(system.disk.percent)}%`} />
            )}
          </div>
          <div className="row">
            <span className="dim">{system.hostname}</span>
            <span>{system.uptime_seconds !== undefined ? formatUptime(system.uptime_seconds) : "—"}</span>
          </div>
        </>
      ) : (
        <div className="rows">
          {system.load_avg && system.load_avg.length >= 3 && (
            <Row label="load" val={system.load_avg.slice(0, 3).map((n) => n.toFixed(2)).join(" ")} />
          )}
          {system.cpu_count !== null && <Row label="cores" val={String(system.cpu_count)} />}
          {system.memory && (
            <Row label="ram" val={`${(system.memory.used / GB).toFixed(1)} / ${(system.memory.total / GB).toFixed(1)}G`} />
          )}
          {system.disk && (
            <Row label="disk" val={`${(system.disk.free / GB).toFixed(0)}G free`} />
          )}
          {system.process && (
            <Row label="proc" val={`${(system.process.rss / MB).toFixed(0)}M · ${system.process.num_threads} thr`} />
          )}
          <Row label="os" val={`${system.platform} ${system.arch}`} />
        </div>
      )}
    </div>
  );
}
