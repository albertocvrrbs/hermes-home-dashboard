import type { HomeData } from "@/home/useHomeData";
import type { AgentLiveState, LiveToolCall } from "./agentLive";
import type { Translate } from "@/home/i18n";

export interface Recommendation {
  severity: "info" | "warn" | "crit";
  title: string;
  detail: string;
}

/** Heuristic coach — no LLM, just sharp eyes on the live + polled data.
 *  Each rule is cheap and explains itself. */
export function buildRecommendations(
  data: HomeData,
  live: AgentLiveState,
  t: Translate,
): Recommendation[] {
  const out: Recommendation[] = [];
  const totals = data.analytics?.totals;

  // ── Gateway health ──
  if (data.errors.size > 0) {
    out.push({
      severity: "crit",
      title: t("coach.sourcesFailing.title", { n: data.errors.size }),
      detail: t("coach.sourcesFailing.detail", { sources: [...data.errors].join(", ") }),
    });
  }

  const errorLogs = data.logs?.lines?.length ?? 0;
  if (errorLogs > 0) {
    out.push({
      severity: errorLogs > 10 ? "crit" : "warn",
      title: t("coach.errorLines.title", { n: errorLogs }),
      detail: t("coach.errorLines.detail"),
    });
  }

  // ── Cost & tokens ──
  const est = totals?.total_estimated_cost ?? 0;
  if (est > 0.5) {
    out.push({
      severity: est > 2 ? "crit" : "warn",
      title: t("coach.cost.title", { cost: est.toFixed(2) }),
      detail: est > 2 ? t("coach.cost.high") : t("coach.cost.moderate"),
    });
  }

  const totalTok = (totals?.total_input ?? 0) + (totals?.total_output ?? 0);
  if (totalTok > 2_000_000) {
    out.push({
      severity: "warn",
      title: t("coach.tokens.title", { n: (totalTok / 1_000_000).toFixed(1) }),
      detail: t("coach.tokens.detail"),
    });
  }

  // ── Work patterns ──
  const repeated = mostRepeatedTool(live.toolHistory);
  if (repeated && repeated.count >= 5) {
    out.push({
      severity: "info",
      title: t("coach.repeated.title", { name: repeated.name, n: repeated.count }),
      detail: t("coach.repeated.detail"),
    });
  }

  const activeSessions = (data.sessions?.sessions ?? []).filter((s) => s.is_active).length;
  if (activeSessions >= 3) {
    out.push({
      severity: "info",
      title: t("coach.parallel.title", { n: activeSessions }),
      detail: t("coach.parallel.detail"),
    });
  }

  if (live.subagents.some((a) => a.status === "running")) {
    out.push({
      severity: "info",
      title: t("coach.subagents.title", { n: live.subagents.filter((a) => a.status === "running").length }),
      detail: t("coach.subagents.detail"),
    });
  }

  const slow = live.currentTool && Date.now() - live.currentTool.startedAt > 120_000
    ? live.currentTool
    : null;
  if (slow) {
    out.push({
      severity: "warn",
      title: t("coach.slow.title", { name: slow.name }),
      detail: t("coach.slow.detail"),
    });
  }

  // ── Session shape ──
  const active = (data.sessions?.sessions ?? []).find((s) => s.is_active);
  if (active) {
    if ((active.message_count ?? 0) > 80) {
      out.push({
        severity: "warn",
        title: t("coach.longSession.title", { n: active.message_count }),
        detail: t("coach.longSession.detail"),
      });
    }
    if ((active.tool_call_count ?? 0) > 40) {
      out.push({
        severity: "info",
        title: t("coach.toolChurn.title", { n: active.tool_call_count }),
        detail: t("coach.toolChurn.detail"),
      });
    }
  }

  // ── Skills usage ──
  const topSkill = data.analytics?.skills?.top_skills?.[0];
  if (topSkill && topSkill.total_count > 0 && topSkill.percentage < 5) {
    out.push({
      severity: "info",
      title: t("coach.skill.title", { name: topSkill.skill, n: topSkill.percentage }),
      detail: t("coach.skill.detail"),
    });
  }

  if (out.length === 0) {
    out.push({
      severity: "info",
      title: t("coach.quiet.title"),
      detail: t("coach.quiet.detail"),
    });
  }

  return out;
}

function mostRepeatedTool(history: LiveToolCall[]): { name: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const t of history) {
    counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
  }
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  return best && best.count >= 2 ? best : null;
}
