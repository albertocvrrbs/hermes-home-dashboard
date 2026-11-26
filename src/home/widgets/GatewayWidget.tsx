import type { StatusResponse } from "@/api-types";
import { useT } from "../i18n";

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="row">
      <span className="dim">{label}</span>
      <span>{val}</span>
    </div>
  );
}

/** Gateway status + platforms. Hovering the widget expands a read-only detail
 *  block (pid, health, config version, exit reason) — no actions, just the
 *  fields the compact view hides. */
export function GatewayWidget({ status }: { status: StatusResponse | null }) {
  const t = useT();
  if (!status) return <span className="dim">{t("common.loading")}</span>;
  const platforms = Object.entries(status.gateway_platforms ?? {});
  const configStr = `v${status.config_version}${
    status.config_version !== status.latest_config_version ? ` → v${status.latest_config_version}` : ""
  }`;
  return (
    <div>
      <div className="rows">
        <div className="row">
          <span className="dim">{t("gateway.status")}</span>
          <span className={status.gateway_running ? "ok" : "werr"}>
            {status.gateway_running ? t("gateway.online") : t("gateway.offline")}
          </span>
        </div>
        <div className="row">
          <span className="dim">{t("gateway.state")}</span>
          <span>{status.gateway_state ?? "—"}</span>
        </div>
        {platforms.map(([name, p]) => (
          <div className="row" key={name}>
            <span className="dim">{name}</span>
            <span className={p.state === "running" ? "ok" : "dim"}>{p.state}</span>
          </div>
        ))}
      </div>
      <div className="hover-reveal">
        <div className="rows">
          {status.gateway_pid != null && <Row label={t("gateway.pid")} val={String(status.gateway_pid)} />}
          {status.gateway_exit_reason && (
            <Row label={t("gateway.exit")} val={status.gateway_exit_reason.slice(0, 28)} />
          )}
          {status.gateway_health_url && (
            <Row label={t("gateway.health")} val={hostOf(status.gateway_health_url)} />
          )}
          <Row label={t("gateway.config")} val={configStr} />
          <Row label={t("gateway.version")} val={`v${status.version}`} />
        </div>
      </div>
    </div>
  );
}
