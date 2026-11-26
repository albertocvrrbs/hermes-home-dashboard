import { enterTheater } from "../theater";
import type { HomeData } from "../useHomeData";
import { useAgentLive } from "./agent/agentLive";
import { LiveScene, useScene } from "./agent/LiveScene";
import { HoverCtl } from "./HoverArrows";
import { useT } from "../i18n";

interface Props {
  data: HomeData;
}

function fmtCost(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${(n * 1000).toFixed(2)}m`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtTok(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** The agent eye — compact live view with the animated scene and the
 *  take-control button. No emoji: pure type + CSS. */
export function AgentWidget({ data }: Props) {
  const t = useT();
  const live = useAgentLive();
  const scene = useScene(live);
  const totals = data.analytics?.totals;

  const statusLabel = live.busy
    ? live.currentTool ? t("agent.working") : t("agent.thinking")
    : t("agent.idle");

  return (
    <div className="home-agent">
      <div className="home-agent-head">
        <span className={`home-agent-dot ${live.busy ? "busy" : ""}`} aria-hidden="true" />
        <span className="home-agent-status">{statusLabel}</span>
      </div>

      <div className="home-agent-scene">
        <LiveScene scene={scene} />
      </div>

      {/* Same philosophy as the other widgets: floating control in the top
          right, faded in on hover, fully hidden in edit mode. */}
      <HoverCtl className="home-agent-ctl">
        <button
          className="home-agent-take"
          onClick={() => enterTheater()}
          title={t("agent.takeTitle")}
          aria-label={t("agent.takeAria")}
        >
          <span className="home-agent-take-ico" aria-hidden="true" />
          {t("agent.take")}
        </button>
      </HoverCtl>

      <div className="home-agent-stats">
        <span title={t("agent.inTitle")}>
          <i>{t("agent.in")}</i> {fmtTok(totals?.total_input)}
        </span>
        <span title={t("agent.outTitle")}>
          <i>{t("agent.out")}</i> {fmtTok(totals?.total_output)}
        </span>
        <span title={t("agent.estTitle")}>
          <i>{t("agent.est")}</i> {fmtCost(totals?.total_estimated_cost)}
        </span>
        <span title={t("agent.sesTitle")}>
          <i>{t("agent.ses")}</i> {totals?.total_sessions ?? "—"}
        </span>
      </div>

      {live.toolHistory.length > 0 && (
        <div className="home-agent-history">
          {live.toolHistory.slice(0, 4).map((t, i) => (
            <span key={`${t.name}-${t.startedAt}-${i}`} className="home-agent-hist">
              <span
                className={`home-agent-hist-dot ${t.status === "complete" ? "ok" : "bad"}`}
                aria-hidden="true"
              />
              {t.name}
              {t.duration !== undefined && <i>{t.duration.toFixed(0)}s</i>}
            </span>
          ))}
        </div>
      )}

      {!live.live && <div className="home-agent-dim">{t("agent.polling")}</div>}
    </div>
  );
}
