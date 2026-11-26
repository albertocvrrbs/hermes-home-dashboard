import { useEffect, useState } from "react";
import { onGatewayEvent, type GatewayRpcEvent } from "@/sdk";
import type { MessageKey } from "@/home/i18n";

/** Live tool call (current or recent). */
export interface LiveToolCall {
  name: string;
  args?: unknown;
  /** When the call started (epoch ms). */
  startedAt: number;
  status: "running" | "complete" | "failed";
  duration?: number;
}

/** One line of the chronological activity feed. */
export interface LiveFeedEntry {
  id: number;
  at: number;
  kind: "tool" | "message" | "subagent" | "session" | "system";
  label: string;
  /** Fixed label/detail phrases are stored as keys and translated at render
   *  time, so a language switch also updates the feed already on screen. */
  labelKey?: MessageKey;
  detail?: string;
  detailKey?: MessageKey;
  ok?: boolean;
}

export interface LiveSubagent {
  name: string;
  status: "running" | "done";
  goal?: string;
}

export interface AgentLiveState {
  /** True when a live gateway channel is available (desktop). */
  live: boolean;
  /** The agent is doing something right now. */
  busy: boolean;
  currentTool: LiveToolCall | null;
  /** Recent finished tool calls, newest first (max 12). */
  toolHistory: LiveToolCall[];
  /** Accumulated deltas of the assistant message currently streaming. */
  streamText: string;
  lastMessage: string | null;
  feed: LiveFeedEntry[];
  subagents: LiveSubagent[];
  activeSessionId: string | null;
  activeTitle: string | null;
  /** Last event wall-clock time (for "updates Xs ago"). */
  lastEventAt: number | null;
}

export const EMPTY_LIVE: AgentLiveState = {
  live: false,
  busy: false,
  currentTool: null,
  toolHistory: [],
  streamText: "",
  lastMessage: null,
  feed: [],
  subagents: [],
  activeSessionId: null,
  activeTitle: null,
  lastEventAt: null,
};

const MAX_TOOL_HISTORY = 12;
const MAX_FEED = 80;
const MAX_STREAM = 6000;

// ── module-level singleton store: the widget and the theater share one
//    live state, so the theater inherits everything accumulated so far ──

let liveState: AgentLiveState = EMPTY_LIVE;
const listeners = new Set<() => void>();
let subscribed = false;
let feedSeq = 0;

function setLive(fn: (s: AgentLiveState) => AgentLiveState): void {
  const next = fn(liveState);
  if (next === liveState) return;
  liveState = next;
  listeners.forEach((l) => l());
}

function pushFeed(entry: Omit<LiveFeedEntry, "id">): void {
  setLive((s) => {
    const e = { ...entry, id: ++feedSeq };
    const feed = [e, ...s.feed];
    return { ...s, feed: feed.length > MAX_FEED ? feed.slice(0, MAX_FEED) : feed };
  });
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asObj(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : undefined;
}

function pick(p: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!p) return undefined;
  for (const k of keys) {
    const v = str(p[k]);
    if (v) return v;
  }
  return undefined;
}

export function argPreview(args: unknown, max = 160): string | undefined {
  if (args === undefined || args === null) return undefined;
  let s: string;
  if (typeof args === "string") s = args;
  else {
    try { s = JSON.stringify(args); } catch { s = String(args); }
  }
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function handleEvent(event: GatewayRpcEvent): void {
  const { type, payload } = event;
  const p = asObj(payload);
  const now = Date.now();

  const bump = (s: AgentLiveState): AgentLiveState => ({ ...s, lastEventAt: now });

  if (type === "tool.generating") {
    const name = pick(p, "name") ?? "tool";
    setLive((s) => bump({
      ...s,
      busy: true,
      currentTool: { name, startedAt: now, status: "running" },
    }));
    pushFeed({ at: now, kind: "tool", label: name, detailKey: "feed.generating" });
    return;
  }

  if (type === "tool.start" || type === "tool.progress") {
    const name = pick(p, "name", "tool_name") ?? "tool";
    setLive((s) => bump({
      ...s,
      busy: true,
      currentTool: { name, args: p?.args ?? p, startedAt: now, status: "running" },
    }));
    pushFeed({
      at: now, kind: "tool", label: name,
      ...(type === "tool.progress" ? { detailKey: "feed.progress" as const } : { detail: argPreview(p?.args) }),
    });
    return;
  }

  if (type === "tool.complete") {
    const name = pick(p, "name", "tool_name") ?? "";
    const ok = p?.ok !== false && !str(p?.error);
    const duration = typeof p?.duration === "number" ? p.duration : undefined;
    setLive((s) => bump({
      ...s,
      currentTool: null,
      busy: s.subagents.some((a) => a.status === "running") || s.streamText.length > 0,
      toolHistory: [{
        name: name || s.currentTool?.name || "tool",
        args: p?.args ?? s.currentTool?.args,
        startedAt: s.currentTool?.startedAt ?? now,
        status: (ok ? "complete" : "failed") as LiveToolCall["status"],
        duration,
      }, ...s.toolHistory].slice(0, MAX_TOOL_HISTORY),
    }));
    pushFeed({
      at: now, kind: "tool", label: name || "tool", ok,
      detail: duration !== undefined ? `${duration.toFixed(1)}s` : undefined,
    });
    return;
  }

  if (type === "message.start") {
    setLive((s) => bump({ ...s, busy: true, streamText: "" }));
    return;
  }

  if (type === "message.delta") {
    const text = pick(p, "text", "delta", "content");
    if (!text) return;
    setLive((s) => bump({
      ...s,
      busy: true,
      streamText: (s.streamText + text).slice(-MAX_STREAM),
    }));
    return;
  }

  if (type === "message.interim") {
    const text = pick(p, "text", "content");
    if (!text) return;
    setLive((s) => bump({ ...s, lastMessage: text }));
    return;
  }

  if (type === "message.complete") {
    setLive((s) => {
      const done = s.streamText.trim();
      return bump({
        ...s,
        streamText: "",
        lastMessage: done.length > 0 ? done : s.lastMessage,
        busy: s.currentTool !== null || s.subagents.some((a) => a.status === "running"),
      });
    });
    return;
  }

  if (type === "subagent.start" || type === "subagent.progress") {
    const name = pick(p, "name", "role", "id") ?? "subagent";
    setLive((s) => bump({
      ...s,
      busy: true,
      subagents: [
        { name, status: "running" as const, goal: pick(p, "goal", "task") },
        ...s.subagents.filter((a) => a.name !== name),
      ].slice(0, 6),
    }));
    pushFeed({ at: now, kind: "subagent", label: name, detailKey: "feed.spawned" });
    return;
  }

  if (type === "subagent.complete") {
    const name = pick(p, "name", "role", "id");
    if (!name) return;
    setLive((s) => bump({
      ...s,
      subagents: s.subagents.map((a) => (a.name === name ? { ...a, status: "done" as const } : a)),
    }));
    pushFeed({ at: now, kind: "subagent", label: name, ok: true, detailKey: "feed.done" });
    return;
  }

  if (type === "subagent.thinking") {
    const name = pick(p, "name", "role", "id") ?? "subagent";
    pushFeed({ at: now, kind: "subagent", label: name, detailKey: "feed.thinking" });
    setLive(bump);
    return;
  }

  if (type === "session.new" || type === "session.info") {
    const sid = pick(p, "session_id", "id") ?? event.session_id;
    if (!sid) return;
    setLive((s) => bump({
      ...s,
      activeSessionId: sid,
      activeTitle: pick(p, "title") ?? s.activeTitle,
    }));
    pushFeed({ at: now, kind: "session", label: "session", labelKey: "feed.session", detailKey: "feed.new" });
    return;
  }

  if (type === "session.title") {
    const title = pick(p, "title");
    if (!title) return;
    setLive((s) => bump({ ...s, activeTitle: title }));
    return;
  }

  if (type === "session.status") {
    const sid = pick(p, "session_id", "id") ?? event.session_id;
    const status = pick(p, "status");
    if (status === "stopped" || status === "idle") {
      setLive((s) => (s.busy ? bump({ ...s, busy: false }) : s));
    }
    if (sid) setLive((s) => bump({ ...s, activeSessionId: sid }));
    return;
  }

  if (type === "error") {
    pushFeed({
      at: now, kind: "system", label: "error", labelKey: "feed.error",
      detail: pick(p, "error", "message"),
    });
    setLive(bump);
    return;
  }

  // Anything else that looks agent-ish → log to the feed.
  if (type.startsWith("tool.") || type.startsWith("message.") ||
      type.startsWith("subagent.") || type.startsWith("session.") ||
      type.startsWith("thinking.") || type.startsWith("reasoning.") ||
      type.startsWith("approval.") || type.startsWith("run.")) {
    pushFeed({ at: now, kind: "system", label: type });
    setLive(bump);
  }
}

function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  const all = onGatewayEvent("*", handleEvent);
  if (all) {
    setLive((s) => (s.live ? s : { ...s, live: true }));
    pushFeed({ at: Date.now(), kind: "system", label: "live", labelKey: "feed.live", detailKey: "feed.channelOpen" });
  }
}

/** Read the shared live agent state (widget and theater see the same data). */
export function useAgentLive(): AgentLiveState {
  const [state, setState] = useState<AgentLiveState>(liveState);

  useEffect(() => {
    ensureSubscribed();
    setState(liveState);
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange() {
    setState(liveState);
  }

  return state;
}
