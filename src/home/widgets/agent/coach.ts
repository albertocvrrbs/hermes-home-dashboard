import type { HomeData } from "@/home/useHomeData";
import type { AgentLiveState, LiveToolCall } from "./agentLive";

export interface Recommendation {
  severity: "info" | "warn" | "crit";
  title: string;
  detail: string;
}

/** Heuristic coach — no LLM, just sharp eyes on the live + polled data.
 *  Each rule is cheap and explains itself. */
export function buildRecommendations(data: HomeData, live: AgentLiveState): Recommendation[] {
  const out: Recommendation[] = [];
  const totals = data.analytics?.totals;

  // ── Gateway health ──
  if (data.errors.size > 0) {
    out.push({
      severity: "crit",
      title: `${data.errors.size} data source(s) failing`,
      detail: `Polling errors on: ${[...data.errors].join(", ")}. Check the gateway and plugin API.`,
    });
  }

  const errorLogs = data.logs?.lines?.length ?? 0;
  if (errorLogs > 0) {
    out.push({
      severity: errorLogs > 10 ? "crit" : "warn",
      title: `${errorLogs} error line(s) in the gateway log`,
      detail: "Tail the log to see if a platform or plugin is throwing repeatedly.",
    });
  }

  // ── Cost & tokens ──
  const est = totals?.total_estimated_cost ?? 0;
  if (est > 0.5) {
    out.push({
      severity: est > 2 ? "crit" : "warn",
      title: `≈$${est.toFixed(2)} estimated today`,
      detail: est > 2
        ? "Cost is climbing. Consider a cheaper model, context compression, or capping long sessions."
        : "Spend is moderate — keep an eye on it if you're mid-migration.",
    });
  }

  const totalTok = (totals?.total_input ?? 0) + (totals?.total_output ?? 0);
  if (totalTok > 2_000_000) {
    out.push({
      severity: "warn",
      title: `${(totalTok / 1_000_000).toFixed(1)}M tokens today`,
      detail: "Heavy usage. /compact long sessions and reuse cached context to cut input tokens.",
    });
  }

  // ── Work patterns ──
  const repeated = mostRepeatedTool(live.toolHistory);
  if (repeated && repeated.count >= 5) {
    out.push({
      severity: "info",
      title: `"${repeated.name}" called ${repeated.count}× recently`,
      detail: "A repeated tool sequence is a skill in disguise — consider saving it with skill_manage.",
    });
  }

  const activeSessions = (data.sessions?.sessions ?? []).filter((s) => s.is_active).length;
  if (activeSessions >= 3) {
    out.push({
      severity: "info",
      title: `${activeSessions} sessions active at once`,
      detail: "Parallel work is running — delegate_task fans out well, but watch for tool conflicts on shared files.",
    });
  }

  if (live.subagents.some((a) => a.status === "running")) {
    out.push({
      severity: "info",
      title: `${live.subagents.filter((a) => a.status === "running").length} subagent(s) working`,
      detail: "Orchestration in flight. Check back for their consolidated reports.",
    });
  }

  const slow = live.currentTool && Date.now() - live.currentTool.startedAt > 120_000
    ? live.currentTool
    : null;
  if (slow) {
    out.push({
      severity: "warn",
      title: `"${slow.name}" running >2min`,
      detail: "Long tool call — it may be a build, a big search, or a hung process. Watch it.",
    });
  }

  // ── Session shape ──
  const active = (data.sessions?.sessions ?? []).find((s) => s.is_active);
  if (active) {
    if ((active.message_count ?? 0) > 80) {
      out.push({
        severity: "warn",
        title: `Active session at ${active.message_count} messages`,
        detail: "Long context costs more per turn and degrades focus. A fresh session or /compact resets the cache.",
      });
    }
    if ((active.tool_call_count ?? 0) > 40) {
      out.push({
        severity: "info",
        title: `${active.tool_call_count} tool calls in the active session`,
        detail: "High tool churn — the task may benefit from a dedicated skill or a subagent.",
      });
    }
  }

  // ── Skills usage ──
  const topSkill = data.analytics?.skills?.top_skills?.[0];
  if (topSkill && topSkill.total_count > 0 && topSkill.percentage < 5) {
    out.push({
      severity: "info",
      title: `Top skill "${topSkill.skill}" only ${topSkill.percentage}% of loads`,
      detail: "Your most-used skill is still under-leveraged — consider bundling related skills.",
    });
  }

  if (out.length === 0) {
    out.push({
      severity: "info",
      title: "All quiet on the home front",
      detail: "No anomalies right now. The coach stays silent until there's something worth saying.",
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
