import type { SystemStats } from "../../api-types";

const GB = 1024 ** 3;

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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((seconds % 3_600) / 60)}m`;
}

export function HostWidget({ system }: { system: SystemStats | null }) {
  if (!system) return <span className="dim">loading…</span>;
  return (
    <div>
      <div className="meters">
        {system.cpu_percent !== undefined && (
          <Meter label="cpu" pct={system.cpu_percent} val={`${Math.round(system.cpu_percent)}%`} />
        )}
        {system.memory && (
          <Meter
            label="ram"
            pct={system.memory.percent}
            val={`${(system.memory.used / GB).toFixed(1)}G`}
          />
        )}
        {system.disk && (
          <Meter label="disk" pct={system.disk.percent} val={`${Math.round(system.disk.percent)}%`} />
        )}
      </div>
      <div className="row">
        <span className="dim">{system.hostname}</span>
        <span>{system.uptime_seconds !== undefined ? formatUptime(system.uptime_seconds) : "—"}</span>
      </div>
    </div>
  );
}
