import { useEffect, useMemo, useState } from "react";
import { exitTheater } from "@/home/theater";
import type { HomeData } from "@/home/useHomeData";
import { buildRecommendations, type Recommendation } from "./coach";
import { argPreview, useAgentLive, type LiveToolCall } from "./agentLive";
import { LiveScene, useScene } from "./LiveScene";
import { useT, type Translate } from "@/home/i18n";

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

function timeAgo(at: number, t: Translate): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) return t("time.now");
  if (s < 60) return t("time.secondsAgo", { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return t("time.minutesAgo", { n: m });
  return t("time.hoursAgo", { n: Math.round(m / 60) });
}

function hhmm(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/** Extract file paths from a tool call's args — the breadcrumbs of a project. */
function extractPaths(tools: LiveToolCall[]): string[] {
  const paths = new Set<string>();
  for (const t of tools) {
    const args = t.args;
    if (!args || typeof args !== "object") continue;
    const a = args as Record<string, unknown>;
    for (const key of ["path", "file", "output_path", "workdir", "cwd", "target"]) {
      const v = a[key];
      if (typeof v === "string" && v.length > 1) paths.add(v);
    }
    if (typeof a.command === "string") {
      const m = a.command.match(/["']([^"']+\.[a-zA-Z0-9_]+)["']/g);
      if (m) m.forEach((s) => paths.add(s.slice(1, -1)));
    }
  }
  return [...paths].slice(0, 8);
}

function fileGlyph(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "ts" || ext === "tsx") return "τ";
  if (ext === "js" || ext === "jsx" || ext === "mjs") return "JS";
  if (ext === "py") return "py";
  if (ext === "md") return "MD";
  if (ext === "json") return "{}";
  if (ext === "yaml" || ext === "yml") return "Y";
  if (ext === "css" || ext === "html") return "#";
  if (["png", "jpg", "webp", "gif", "svg"].includes(ext)) return "▣";
  return "·";
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <b className="home-theater-panel-title">{children}</b>;
}

// ── AHORA: animated scene + live process feed ─────────────────────────

function NowPanel({ data, live }: { data: HomeData; live: ReturnType<typeof useAgentLive> }) {
  const t = useT();
  const scene = useScene(live);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = live.busy
    ? live.currentTool ? t("agent.working") : t("agent.thinking")
    : data.status?.gateway_running ? t("agent.idle") : t("theater.gatewayDown");

  return (
    <section className="home-theater-panel home-theater-now">
      <PanelTitle>
        <span className={`home-agent-dot ${live.busy ? "busy" : ""}`} aria-hidden="true" />
        {t("theater.now", { status: status.toUpperCase() })}
        {live.activeTitle && <span className="home-theater-sub">— {live.activeTitle}</span>}
      </PanelTitle>

      <div className="home-theater-scene">
        <LiveScene scene={scene} />
      </div>

      <div className="home-theater-feed">
        {live.feed.length === 0 && (
          <div className="home-theater-dim">{t("theater.feedEmpty")}</div>
        )}
        {live.feed.slice(0, 40).map((e) => (
          <div key={e.id} className="home-theater-feed-row">
            <span className="home-theater-feed-time">{hhmm(e.at)}</span>
            <span
              className={`home-theater-feed-kind ${e.kind}${e.ok === false ? " bad" : ""}`}
              aria-hidden="true"
            />
            <span className="home-theater-feed-label">{e.labelKey ? t(e.labelKey) : e.label}</span>
            {(e.detailKey || e.detail) && (
              <span className="home-theater-feed-detail">{e.detailKey ? t(e.detailKey) : e.detail}</span>
            )}
          </div>
        ))}
      </div>

      <div className="home-theater-foot">
        <span>{t("theater.lastEvent", { when: live.lastEventAt ? timeAgo(live.lastEventAt, t) : "—" })}</span>
        <span>{live.live ? t("theater.live") : t("theater.polling")}</span>
        <span>{t("theater.updated", { when: timeAgo(now, t) })}</span>
      </div>
    </section>
  );
}

// ── FUNCIÓN: current + recent tool calls ──────────────────────────────

function ToolPanel({ live }: { live: ReturnType<typeof useAgentLive> }) {
  const t = useT();
  return (
    <section className="home-theater-panel">
      <PanelTitle>{t("theater.function")}</PanelTitle>

      {live.currentTool ? (
        <div className="home-theater-fn-current">
          <div className="home-theater-fn-name">
            <span className="home-theater-fn-dot running" aria-hidden="true" />
            {live.currentTool.name}
            <span className="home-theater-fn-state running">{t("scene.running")}</span>
          </div>
          <pre className="home-theater-fn-args">
            {argPreview(live.currentTool.args, 600) ?? t("theater.awaitingArgs")}
          </pre>
        </div>
      ) : (
        <div className="home-theater-dim">{t("theater.noTool")}</div>
      )}

      {live.toolHistory.length > 0 && (
        <div className="home-theater-fn-history">
          {live.toolHistory.slice(0, 8).map((t, i) => (
            <div key={`${t.name}-${t.startedAt}-${i}`} className="home-theater-fn-row">
              <span
                className={`home-theater-fn-dot ${t.status === "complete" ? "ok" : "bad"}`}
                aria-hidden="true"
              />
              <span className="home-theater-fn-hname">{t.name}</span>
              <span className="home-theater-fn-hargs">{argPreview(t.args, 90)}</span>
              {t.duration !== undefined && (
                <span className="home-theater-fn-hdur">{t.duration.toFixed(1)}s</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── TOKENS & COSTO ────────────────────────────────────────────────────

function TokenPanel({ data }: { data: HomeData }) {
  const t = useT();
  const totals = data.analytics?.totals;
  const byModel = data.analytics?.by_model ?? [];
  const active = (data.sessions?.sessions ?? []).find((s) => s.is_active);

  return (
    <section className="home-theater-panel">
      <PanelTitle>{t("theater.tokensCost")}</PanelTitle>

      <div className="home-theater-tok-grid">
        <div className="home-theater-tok-cell">
          <span className="home-theater-tok-num">{fmtTok(totals?.total_input)}</span>
          <span className="home-theater-tok-lbl">{t("theater.inputToday")}</span>
        </div>
        <div className="home-theater-tok-cell">
          <span className="home-theater-tok-num">{fmtTok(totals?.total_output)}</span>
          <span className="home-theater-tok-lbl">{t("theater.outputToday")}</span>
        </div>
        <div className="home-theater-tok-cell">
          <span className="home-theater-tok-num">{fmtTok(totals?.total_cache_read)}</span>
          <span className="home-theater-tok-lbl">{t("theater.cacheRead")}</span>
        </div>
        <div className="home-theater-tok-cell">
          <span className="home-theater-tok-num home-theater-money">{fmtCost(totals?.total_estimated_cost)}</span>
          <span className="home-theater-tok-lbl">{t("theater.costToday")}</span>
        </div>
      </div>

      {byModel.length > 0 && (
        <div className="home-theater-tok-models">
          {byModel.slice(0, 4).map((m) => (
            <div key={m.model} className="home-theater-tok-model">
              <span className="home-theater-tok-mname">{m.model}</span>
              <span className="home-theater-tok-mtok">
                {t("theater.tok", { n: fmtTok(m.input_tokens + m.output_tokens) })}
              </span>
              <span className="home-theater-tok-mcost">{fmtCost(m.estimated_cost)}</span>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div className="home-theater-tok-session">
          <span className="home-theater-tok-slbl">{t("theater.activeSession")}</span>
          <span className="home-theater-tok-stitle">{active.title ?? active.id}</span>
          <span className="home-theater-tok-snum">
            {t("theater.sessionNums", {
              tok: fmtTok((active.input_tokens ?? 0) + (active.output_tokens ?? 0)),
              msg: active.message_count ?? 0,
              tools: active.tool_call_count ?? 0,
            })}
          </span>
        </div>
      )}
    </section>
  );
}

// ── PROYECTO ─────────────────────────────────────────────────────────

function ProjectPanel({ data, live }: { data: HomeData; live: ReturnType<typeof useAgentLive> }) {
  const t = useT();
  const active = (data.sessions?.sessions ?? []).find((s) => s.is_active);
  const paths = useMemo(
    () => extractPaths([...(live.currentTool ? [live.currentTool] : []), ...live.toolHistory]),
    [live.currentTool, live.toolHistory],
  );

  return (
    <section className="home-theater-panel">
      <PanelTitle>{t("theater.project")}</PanelTitle>

      {active ? (
        <div className="home-theater-proj-session">
          <div className="home-theater-proj-title">{active.title ?? t("theater.untitled")}</div>
          <div className="home-theater-proj-meta">
            {active.model ?? "—"} · {active.source ?? "—"} · {t("theater.started", { when: timeAgo(active.started_at * 1000, t) })}
          </div>
        </div>
      ) : (
        <div className="home-theater-dim">{t("theater.noSession")}</div>
      )}

      {paths.length > 0 ? (
        <div className="home-theater-proj-files">
          {paths.map((p) => (
            <div key={p} className="home-theater-proj-file">
              <span className="home-theater-proj-glyph">{fileGlyph(p)}</span>
              <span className="home-theater-proj-path">{p}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="home-theater-dim">
          {t("theater.filesEmpty")}
        </div>
      )}

      {live.subagents.length > 0 && (
        <div className="home-theater-proj-subagents">
          {live.subagents.map((a) => (
            <div key={a.name} className="home-theater-proj-subagent">
              <span
                className={`home-theater-proj-subdot ${a.status === "running" ? "run" : "done"}`}
                aria-hidden="true"
              />
              <span className="home-theater-proj-subname">{a.name}</span>
              {a.goal && <span className="home-theater-proj-subgoal">— {a.goal}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── RECOMENDACIONES ──────────────────────────────────────────────────

function CoachPanel({ data, live }: { data: HomeData; live: ReturnType<typeof useAgentLive> }) {
  const t = useT();
  const recs: Recommendation[] = useMemo(
    () => buildRecommendations(data, live, t),
    [data, live, t],
  );
  return (
    <section className="home-theater-panel">
      <PanelTitle>{t("theater.recommendations")}</PanelTitle>
      <div className="home-theater-rec-list">
        {recs.map((r, i) => (
          <div key={i} className={`home-theater-rec ${r.severity}`}>
            <span className="home-theater-rec-tag">
              {r.severity === "crit" ? "!!" : r.severity === "warn" ? "!" : "i"}
            </span>
            <div className="home-theater-rec-body">
              <div className="home-theater-rec-title">{r.title}</div>
              <div className="home-theater-rec-detail">{r.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── THEATER ──────────────────────────────────────────────────────────

export function AgentTheater({ data }: Props) {
  const t = useT();
  const live = useAgentLive();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitTheater();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="home-theater" role="dialog" aria-label={t("theater.aria")}>
      <header className="home-theater-head">
        <span className={`home-agent-dot ${live.busy ? "busy" : ""}`} aria-hidden="true" />
        <span className="home-theater-title">{t("theater.title")}</span>
        <span className="home-theater-sub">
          {live.busy ? t("theater.working") : t("theater.idle")} · {live.live ? t("theater.liveFeed") : t("theater.polling")}
        </span>
        <button
          className="home-theater-release"
          onClick={() => exitTheater()}
          title={t("theater.releaseTitle")}
        >
          {t("theater.release")}
        </button>
      </header>

      <div className="home-theater-grid">
        <div className="home-theater-span-7"><NowPanel data={data} live={live} /></div>
        <div className="home-theater-span-5"><ToolPanel live={live} /></div>
        <div className="home-theater-span-5"><TokenPanel data={data} /></div>
        <div className="home-theater-span-7"><ProjectPanel data={data} live={live} /></div>
        <div className="home-theater-span-12"><CoachPanel data={data} live={live} /></div>
      </div>
    </div>
  );
}
