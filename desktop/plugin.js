import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import * as PluginSdk from "@hermes/plugin-sdk";
import { host } from "@hermes/plugin-sdk";
import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle, useLayoutEffect, memo } from "react";
const DEMO_KEY = "hb.demo";
const OFF = { on: false, now: null, tick: false, nomap: false };
const FLAG = (v) => v !== null && !/^(0|false|off|no)$/i.test(v);
function parseMoment(v) {
  if (!v) return null;
  if (/^\d{10}$/.test(v)) return Number(v) * 1e3;
  if (/^\d{12,14}$/.test(v)) return Number(v);
  const t2 = new Date(v).getTime();
  return Number.isFinite(t2) ? t2 : null;
}
function parseDemo(search, stored) {
  const q = new URLSearchParams(search);
  if (q.has("demo")) {
    if (!FLAG(q.get("demo"))) return OFF;
    return { on: true, now: parseMoment(q.get("now")), tick: FLAG(q.get("tick")), nomap: FLAG(q.get("nomap")) };
  }
  if (!stored) return OFF;
  try {
    const s = JSON.parse(stored);
    if (s === true || s === 1) return { ...OFF, on: true };
    if (!s || typeof s !== "object" || !s.on) return OFF;
    return { on: true, now: typeof s.now === "number" ? s.now : null, tick: !!s.tick, nomap: !!s.nomap };
  } catch {
    return stored === "1" ? { ...OFF, on: true } : OFF;
  }
}
function makeClock(start, tick, real) {
  let base = start, since = real();
  return {
    now: () => tick ? base + (real() - since) : base,
    set: (ms) => {
      base = ms;
      since = real();
    },
    advance: (ms) => {
      base = tick ? base + (real() - since) + ms : base + ms;
      since = real();
    }
  };
}
function makeDate(Real, clock2) {
  const Demo = function(...args) {
    if (!new.target) return new Real(clock2.now()).toString();
    return args.length === 0 ? new Real(clock2.now()) : new Real(...args);
  };
  Object.setPrototypeOf(Demo, Real);
  Demo.prototype = Real.prototype;
  Demo.now = () => clock2.now();
  return Demo;
}
let config = OFF;
let realNowFn = () => Date.now();
const realNow = () => realNowFn();
let clock$2 = null;
const demoOn = () => config.on;
const demoNomap = () => config.on && config.nomap;
function installDemo(win = window) {
  let stored = null;
  try {
    stored = win.localStorage?.getItem(DEMO_KEY) ?? null;
  } catch {
    stored = null;
  }
  const next = parseDemo(win.location.search, stored);
  try {
    if (new URLSearchParams(win.location.search).has("demo")) {
      if (next.on) win.localStorage?.setItem(DEMO_KEY, JSON.stringify(next));
      else win.localStorage?.removeItem(DEMO_KEY);
    }
  } catch {
  }
  const first = !clock$2;
  config = next;
  if (next.on && first) {
    const RealDate = win.Date;
    const real = () => RealDate.now();
    realNowFn = real;
    clock$2 = makeClock(next.now ?? real(), next.tick, real);
    win.Date = makeDate(RealDate, clock$2);
  }
  const api2 = {
    get on() {
      return config.on;
    },
    config: () => ({ ...config }),
    enable: (o = {}) => {
      const cfg = { on: true, now: typeof o.now === "string" ? parseMoment(o.now) : o.now ?? null, tick: !!o.tick, nomap: !!o.nomap };
      try {
        win.localStorage?.setItem(DEMO_KEY, JSON.stringify(cfg));
      } catch {
      }
      win.location.reload();
    },
    disable: () => {
      try {
        win.localStorage?.removeItem(DEMO_KEY);
      } catch {
      }
      win.location.reload();
    },
    setNow: (v) => {
      const ms = typeof v === "number" ? v : parseMoment(v);
      if (clock$2 && ms != null) clock$2.set(ms);
    },
    advance: (ms) => clock$2?.advance(ms),
    now: () => clock$2 ? clock$2.now() : Date.now()
  };
  win.__hbDemo = api2;
  return config;
}
const pad$1 = (n) => String(n).padStart(2, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad$1(d.getMonth() + 1)}-${pad$1(d.getDate())} ${pad$1(d.getHours())}:${pad$1(d.getMinutes())}:${pad$1(d.getSeconds())},120`;
};
function demoSource(key, value, now) {
  const v = value;
  if (!v) return value;
  switch (key) {
    case "status":
      return { ...v, hermes_home: "~/.hermes", config_path: "~/.hermes/config.yaml", env_path: "~/.hermes/.env", gateway_health_url: null };
    case "system":
      return { ...v, hostname: "demo-host" };
    case "analytics": {
      const a = v;
      const zero = (r) => ({ ...r, estimated_cost: 0, actual_cost: 0 });
      return {
        ...a,
        daily: a.daily?.map(zero),
        by_model: a.by_model?.map(zero),
        totals: a.totals && { ...a.totals, total_estimated_cost: 0, total_actual_cost: 0 }
      };
    }
    case "cron": {
      const jobs = [
        ["Morning briefing", "every day 08:00", 25 * 6e4],
        ["Nightly backup check", "every day 23:30", 2.4 * 36e5],
        ["Weekly digest", "mondays 09:00", 5.1 * 36e5],
        ["Inbox triage", "every hour", 11 * 6e4],
        ["Release notes draft", "fridays 17:00", 20 * 36e5]
      ];
      return jobs.map(([name, display, ahead], i) => ({
        id: `demo-${i}`,
        name,
        enabled: true,
        state: "scheduled",
        schedule_display: display,
        next_run_at: new Date(now + ahead).toISOString(),
        last_run_at: new Date(now - 36e5 * (i + 1)).toISOString(),
        last_error: null
      }));
    }
    case "sessions": {
      const titles = ["Plan the launch board", "Tidy the training notes", "Draft the release notes", "Review the spider sim", "Sketch the exam circuit", "Weekly summary"];
      const s = titles.map((title, i) => ({
        id: `demo-s${i}`,
        source: "cli",
        model: "demo-model",
        title,
        started_at: now / 1e3 - 3600 * (i + 1),
        ended_at: i ? now / 1e3 - 3e3 * i : null,
        last_active: now / 1e3 - 420 * (i + 1),
        is_active: i === 0,
        message_count: 14 + i * 5,
        tool_call_count: 3 + i,
        input_tokens: 42e3 + i * 31e3,
        output_tokens: 9e3 + i * 6500,
        preview: title
      }));
      return { sessions: s, total: s.length, limit: 20, offset: 0 };
    }
    case "logs":
      return {
        file: "errors",
        lines: [
          `${stamp(now - 14 * 6e4)} ERROR demo.worker: Upstream request timed out, retrying in 5s`,
          `${stamp(now - 9 * 6e4)} WARNING demo.gateway: Connection reset by peer`,
          `${stamp(now - 3 * 6e4)} ERROR demo.worker: Retry limit reached, giving up on job`
        ]
      };
    default:
      return value;
  }
}
function getDashboardHost() {
  const sdk = window.__HERMES_PLUGIN_SDK__;
  if (!sdk) throw new Error("Hermes plugin SDK not available");
  const dashboard = sdk;
  return {
    ...dashboard,
    navigateTo: (routePath) => window.location.assign(routePath),
    // Same target as the core Sessions page's "resume in chat" button.
    openSession: (id) => window.location.assign(`/chat?resume=${encodeURIComponent(id)}`)
  };
}
let configuredHost = null;
function configureHomeHost(host2) {
  configuredHost = host2;
}
function getHost() {
  return configuredHost ?? getDashboardHost();
}
const api = {
  getStatus: () => getHost().api.getStatus(),
  getSystemStats: () => getHost().api.getSystemStats(),
  getAnalytics: (days) => getHost().api.getAnalytics(days),
  getModelsAnalytics: (days) => {
    const host2 = getHost().api;
    return host2.getModelsAnalytics ? host2.getModelsAnalytics(days) : Promise.reject(new Error("model analytics not available on this Hermes"));
  },
  getCronJobs: (profile) => getHost().api.getCronJobs(profile),
  getSessions: (limit, offset) => getHost().api.getSessions(limit, offset),
  getLogs: (params) => getHost().api.getLogs(params).then((r) => demoOn() ? demoSource("logs", r, Date.now()) : r)
};
function fetchJSON(url, init) {
  return getHost().fetchJSON(url, init);
}
function getProjects() {
  return fetchJSON("/api/plugins/home-dashboard/projects");
}
function getSpend(period, utcOffset) {
  const q = new URLSearchParams({ period, utc_offset: String(Math.round(utcOffset)) });
  return fetchJSON(`/api/plugins/home-dashboard/spend?${q}`);
}
function useDashboardLocale() {
  if (configuredHost) return null;
  const sdk = window.__HERMES_PLUGIN_SDK__;
  if (typeof sdk?.useI18n !== "function") return null;
  const value = sdk.useI18n();
  return typeof value?.locale === "string" ? value.locale : null;
}
function navigateTo(routePath) {
  getHost().navigateTo(routePath);
}
function openSession(sessionId) {
  getHost().openSession(sessionId);
}
function onGatewayEvent(type, listener) {
  const h = getHost();
  if (!h.onEvent) return null;
  return h.onEvent(type, listener);
}
function webBoardHash(id) {
  return id ? `#board=${id}` : "#boards";
}
function readBoardRoute(loc) {
  const hash = loc.hash || "";
  const web = /^#board=([a-z0-9]{8})$/.exec(hash);
  if (web) return web[1];
  if (hash === "#boards") return null;
  const routed = /^#\/boards(?:\?(.*))?$/.exec(hash);
  if (routed || /\/boards\/?$/.test(loc.pathname)) {
    const q = new URLSearchParams(routed?.[1] ?? loc.search.replace(/^\?/, ""));
    const id = q.get("id");
    return id && /^[a-z0-9]{8}$/.test(id) ? id : null;
  }
  return void 0;
}
function openBoard(id) {
  const h = getHost();
  if (h.openBoard) h.openBoard(id);
  else window.location.hash = webBoardHash(id);
}
async function newChatWithDraft(text) {
  const h = getHost();
  if (h.newChatWithDraft) return h.newChatWithDraft(text);
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
  }
  window.location.assign("/chat");
  return false;
}
function hostRpc() {
  return getHost().rpc;
}
function hostSandboxedFrame() {
  return getHost().SandboxedFrame;
}
function hostModelMenu() {
  return getHost().modelMenu;
}
const en = {
  // ── shared ──
  "common.loading": "loading…",
  "common.unavailable": "unavailable",
  "common.previous": "previous",
  "common.next": "next",
  "common.today": "today",
  "common.done": "done",
  "common.none": "—",
  "time.now": "now",
  "time.justNow": "just now",
  "time.secondsAgo": "{n}s ago",
  "time.minutesAgo": "{n}m ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",
  // ── home chrome: edit mode, catalog, widget shell ──
  "nav.home": "Home",
  "nav.open": "Open Home",
  "home.saveFailed": "Could not save the layout — it is kept for this session",
  "home.restoreDefault": "Restore default layout",
  "home.editLayout": "Edit layout",
  "home.doneEditing": "Done editing",
  "catalog.hint": "drag a widget here to remove it",
  "shell.offline": "offline · Hermes backend unreachable",
  "shell.unavailable": "unavailable · this source is not responding",
  "shell.stale": "stale",
  "shell.staleTitle": "Last update failed — showing previous data",
  "shell.remove": "Remove {title}",
  // ── widget titles (header + catalog chip) ──
  "widget.ascii": "hermes",
  "widget.clock": "clock",
  "widget.matrix": "matrix",
  "widget.gateway": "gateway",
  "widget.sessions": "sessions",
  "widget.tokens": "tokens",
  "widget.host": "host",
  "widget.cron": "cron",
  "widget.notes": "notes",
  "widget.errors": "logs",
  "widget.moon": "moon",
  "widget.heartbeat": "heartbeat",
  "widget.life": "life",
  "widget.pomodoro": "pomodoro",
  "widget.countdown": "countdown",
  "widget.calendar": "calendar",
  "widget.projects": "projects",
  "widget.spend": "spend",
  // ── ascii ──
  "ascii.art.caduceus": "caduceus",
  "ascii.art.winged-caduceus": "kerykeion",
  "ascii.art.talaria": "talaria",
  "ascii.art.petasos": "petasos",
  "ascii.art.lyre": "lyre",
  "ascii.art.tortoise": "tortoise",
  "ascii.art.drachma": "drachma",
  "ascii.art.wing": "wing",
  // ── clock ──
  "clock.seconds": "s",
  "clock.secondsTitle": "show / hide seconds",
  "clock.formatTitle": "12 / 24 hour clock",
  // ── cron ──
  "cron.empty": "no scheduled jobs",
  "cron.ok": "ok",
  "cron.err": "err",
  // ── logs ──
  "logs.record": "{n} record",
  "logs.records": "{n} records",
  "logs.empty": "no records",
  // ── gateway ──
  "gateway.status": "status",
  "gateway.state": "state",
  "gateway.online": "● online",
  "gateway.offline": "● offline",
  "gateway.pid": "pid",
  "gateway.exit": "exit",
  "gateway.health": "health",
  "gateway.config": "config",
  "gateway.version": "version",
  "gateway.s.running": "running",
  "gateway.s.starting": "starting",
  "gateway.s.stopped": "stopped",
  "gateway.s.startup_failed": "failed to start",
  "gateway.s.draining": "draining",
  "gateway.s.connected": "connected",
  "gateway.s.connecting": "connecting",
  "gateway.s.disconnected": "disconnected",
  "gateway.s.degraded": "degraded",
  "gateway.s.disabled": "disabled",
  "gateway.s.fatal": "fatal error",
  "gateway.s.paused": "paused",
  "gateway.s.retrying": "retrying",
  "gateway.s.error": "error",
  // ── host ──
  "host.view.meters": "meters",
  "host.view.detail": "detail",
  "host.view.graphs": "graphs",
  "host.cpu": "cpu",
  "host.ram": "ram",
  "host.disk": "disk",
  "host.load": "load",
  "host.cores": "cores",
  "host.proc": "proc",
  "host.os": "os",
  "host.diskFree": "{n}G free",
  "host.procValue": "{mb}M · {threads} thr",
  // ── moon ──
  "moon.phase.0": "new moon",
  "moon.phase.1": "waxing crescent",
  "moon.phase.2": "first quarter",
  "moon.phase.3": "waxing gibbous",
  "moon.phase.4": "full moon",
  "moon.phase.5": "waning gibbous",
  "moon.phase.6": "last quarter",
  "moon.phase.7": "waning crescent",
  "moon.offset": "{n}d",
  // ── notes ──
  "notes.clearDone": "clear done",
  "notes.empty": "no notes — add one with +",
  "notes.restore": "restore",
  "notes.strike": "strike through",
  "notes.add": "Add note",
  // ── pomodoro ──
  "pomo.work": "work",
  "pomo.break": "break",
  "pomo.running": "running",
  "pomo.paused": "paused",
  "pomo.toggleTitle": "click: start / pause",
  "pomo.nameTitle": "click to name this timer",
  // ── countdown ──
  "count.month": "month",
  "count.day": "day",
  "count.year": "year",
  "count.hour": "hour",
  "count.minute": "minute",
  "count.up": "{field} up",
  "count.down": "{field} down",
  "count.setDate": "set date",
  "count.setTitle": "click to set the date & time",
  "count.labelTitle": "click to edit the label",
  "count.namePrompt": "click to name this countdown",
  // ── life ──
  "life.play": "play",
  "life.pause": "pause",
  "life.seed": "seed",
  "life.clear": "clear",
  // ── tokens ──
  "tokens.range.week": "7 days",
  "tokens.range.month": "1 month",
  "tokens.range.halfyear": "6 months",
  "tokens.line": "line",
  "tokens.lineTitle": "line / bars view",
  "tokens.totals": "totals",
  "tokens.totalsTitle": "show / hide totals",
  "tokens.in": "in",
  "tokens.out": "out",
  "tokens.cost": "cost",
  "tokens.dayFallback": "day*",
  "tokens.group.off": "all",
  "tokens.group.provider": "provider",
  "tokens.group.model": "model",
  "tokens.groupTitle": "group usage: all / by provider / by model",
  "tokens.groupEmpty": "no usage in this range",
  "tokens.groupMore": "+{n} more",
  "tokens.unknownProvider": "unknown",
  "tokens.providerFallback": "provider data unavailable — showing models",
  "tokens.rowTitle": "{name} · {tokens} tokens · ${cost} · {share}%",
  // ── sessions ──
  "sessions.active": "active",
  "sessions.live": "live",
  "sessions.idle": "idle",
  "sessions.sort.recent": "recent",
  "sessions.sort.tokens": "tokens",
  "sessions.sortTitle": "sort: most recent / most tokens",
  "sessions.filter.all": "all",
  "sessions.filterTitle": "minimum tokens (in + out)",
  "sessions.noneMatch": "no sessions above {n} tokens",
  "sessions.tokensTitle": "{input} in · {output} out",
  // ── projects ──
  "projects.empty": "no projects — add ~/projects/<name>/status.json",
  "projects.inbox": "inbox",
  "projects.doing": "doing",
  "projects.done": "done",
  "projects.next": "next:",
  "projects.alerts": "alerts:",
  "projects.updated": "updated {when}",
  // ── spend ──
  "spend.range.today": "today",
  "spend.range.week": "7 days",
  "spend.range.month": "this month",
  "spend.real": "real spend",
  "spend.realTitle": "pay-per-use money (API keys), split by provider",
  "spend.est": "est.",
  "spend.estTitle": "estimated from list prices, not an invoice",
  "spend.partEst": "part est.",
  "spend.partEstTitle": "some providers reported invoiced costs, the rest is estimated",
  "spend.noReal": "no pay-per-use spend in this range",
  "spend.plan": "{brand} subscription",
  "spend.covered": "{plan} covered {amount}",
  "spend.coveredTitle": "what these calls would cost at API list prices; paid by your plan, not per token",
  "spend.month": "month {spent}",
  "spend.projected": "→ {amount} projected",
  "spend.projectedTitle": "real spend so far, extrapolated to the end of the month",
  "spend.cap": "cap",
  "spend.capOf": "of {cap}",
  "spend.capTitle": "monthly cap for real spend",
  "spend.capOff": "off",
  "spend.state.near": "near cap",
  "spend.state.pace": "on pace to pass cap",
  "spend.state.over": "over cap",
  "spend.top.all": "top: all",
  "spend.top.real": "top: real",
  "spend.topTitle": "rank sessions by every cost / by real spend only",
  "spend.topHead": "most expensive sessions",
  "spend.topHeadReal": "most real spend",
  "spend.topEmpty": "no costed sessions in this range",
  "spend.tag.metered": "real",
  "spend.tag.subscription": "plan",
  "spend.tag.unclassified": "?",
  "spend.tag.mixed": "mix",
  "spend.openTitle": "{title} · {cost} · {provider} — open session",
  "spend.untitled": "untitled",
  "spend.unclassified": "unclassified {amount}",
  "spend.unclassifiedTitle": "cost from providers whose billing could not be told apart (mixed or removed credentials)",
  "spend.unpriced": "{n} unpriced",
  "spend.unpricedTitle": "sessions Hermes could not price",
  "spend.noCost": "{n} sessions without cost data",
  "spend.empty": "no cost data in this range",
  "spend.noStore": "session store unavailable",
  // ── boards ──
  "widget.board": "board",
  "nav.boards": "Boards",
  "nav.openBoards": "Open boards",
  "board.untitled": "Untitled board",
  "board.loadFailed": "board unavailable",
  "board.path.home": "home",
  "board.path.boards": "boards",
  "board.path.parent": "parent",
  "board.renameHint": "Double-click to rename",
  "board.presence.editing": "is editing",
  "board.state.saved": "saved {time}",
  "board.state.session": "session linked",
  "board.state.noSession": "no session yet",
  "board.continue": "Continue in session",
  "board.ctx.zoomTo": "Zoom to selection",
  "board.fit": "Fit to content",
  "board.zoomIn": "Zoom in",
  "board.zoomOut": "Zoom out",
  "board.tool.select": "Select",
  "board.tool.pan": "Pan",
  "board.tool.note": "Note",
  "board.tool.todo": "To-do",
  "board.tool.link": "Link",
  "board.tool.image": "Image",
  "board.tool.col": "Column",
  "board.tool.board": "Board",
  "board.tool.embed": "HTML embed",
  "board.tool.arrow": "Arrow",
  "board.tool.draw": "Draw",
  "board.prompt.selection": "selected",
  "board.kind.card": "card",
  "board.kind.todo": "to-do",
  "board.kind.col": "column",
  "board.kind.link": "link",
  "board.kind.image": "image",
  "board.kind.embed": "embed",
  "board.kind.video": "video",
  "board.kind.board": "board",
  "board.kind.frame": "frame",
  "board.kind.box": "box",
  "board.kind.text": "text",
  "board.kind.draw": "sketch",
  "board.kind.line": "arrow",
  "board.ctx.items": "{n} items",
  "board.ctx.todo": "to-do, {n} items",
  "board.ctx.col": "column, {n} cards",
  "board.ctx.duplicate": "Duplicate",
  "board.ctx.delete": "Delete",
  "board.verb.diagram": "Turn into a diagram",
  "board.verb.sortDate": "Sort by date",
  "board.verb.split": "Split into cards",
  "board.verb.expand": "Expand",
  "board.verb.flow": "Turn into a flow",
  "board.verb.group": "Group",
  "board.verb.summarize": "Summarize",
  "board.verb.improve": "Tidy up",
  "board.cursor.adding": "adding {kind}",
  "board.cursor.placingStep": "placing step {n}",
  "board.cursor.connecting": "connecting {a} → {b}",
  "board.cursor.moving": "moving {what}",
  "board.cursor.editing": "editing {what}",
  "board.cursor.removing": "removing",
  "board.cursor.done": "done, {n} changes",
  "board.log.changes": "Made {n} changes.",
  "board.log.undo": "Undo",
  "board.log.close": "Close",
  "board.card.titlePh": "Title",
  "board.card.textPh": "Write something…",
  "board.card.empty": "Empty note",
  "board.todo.title": "To-do",
  "board.todo.left": "{n} left.",
  "board.todo.allDone": "All done.",
  "board.todo.add": "add item",
  "board.todo.remove": "Remove item",
  "board.col.title": "Column",
  "board.col.add": "add card",
  "board.video.play": "Play",
  "board.video.untitled": "Video",
  "board.image.capPh": "Caption",
  "board.file.open": "Open the PDF",
  "board.file.download": "Download the model",
  "board.file.pages": "{n} p.",
  "board.mark.ok": "OK",
  "board.mark.fail": "Failed",
  "board.mark.wait": "Waiting",
  "board.embed.title": "embed.html",
  "board.embed.sandbox": "sandbox: scripts only, no network",
  "board.embed.reload": "Reload",
  "board.embed.taller": "Taller",
  "board.embed.themeOn": "Use Hermes theme",
  "board.embed.themeOff": "Original look",
  "board.embed.activate": "Click to interact",
  "board.embed.live": "live html",
  "board.comp.gallery": "Components",
  "board.comp.close": "Close",
  "board.comp.emptyTitle": "No components yet",
  "board.comp.emptyBody": "Ask Hermes for a view you need (a gauge, a network, a timeline). It writes the component, saves it here and reuses it on any board.",
  "board.comp.downTitle": "Components unavailable",
  "board.comp.downBody": "The backend serving this page does not have the component library yet. Restart the gateway after updating the plugin.",
  "board.comp.latest": "latest",
  "board.comp.update": "Update to {v}",
  "board.comp.versions": "Versions",
  "board.comp.followLatest": "Follow latest",
  "board.comp.source": "Source",
  "board.comp.missing": "Component {name} is not in the library",
  "board.comp.missingHint": "It was deleted or never created. Ask Hermes to create it again.",
  "board.comp.dataFiles": "{n} data files · {size}",
  "board.comp.syncTip": "Linked to the shared clock {group}",
  "board.comp.actionNotOnCard": "This card is not allowed to run {id}",
  "board.comp.actionCancelled": "Cancelled",
  "board.sync.link": "Link to one clock",
  "board.sync.unlink": "Unlink clock",
  "board.sync.group": "Shared clock {group}",
  "board.sync.master": "Follows the video",
  "board.sync.free": "Own clock (no video in the group)",
  "board.sync.rewind": "Back to start",
  "board.sync.play": "Play",
  "board.sync.pause": "Pause",
  "board.sync.seek": "Position",
  "board.sync.rate": "Speed",
  "board.sync.manual": "Manual clock: stepped by a script",
  "board.ref.open": "open",
  "board.ref.meta": "{n} cards · {when}",
  "board.ref.missing": "Board not found",
  "board.frame.title": "Frame",
  "board.text.empty": "Text",
  "board.dueToday": "due today",
  "board.time.now": "just now",
  "board.time.min": "{n} min ago",
  "board.time.h": "{n} h ago",
  "board.time.yesterday": "yesterday",
  "board.empty.title": "Empty board",
  "board.empty.body": "Double-click to write a note, paste a link or an image, or ask Hermes in the chat.",
  "board.ask.link": "Add a link",
  "board.ask.embed": "Embed HTML",
  "board.ask.linkHint": "Pages become cards with a preview; YouTube, Vimeo, Loom and X become players.",
  "board.ask.embedHint": "Runs in a sandbox: scripts only, no network. {mod}↵ to add.",
  "board.ask.cancel": "Cancel",
  "board.ask.add": "Add",
  "board.toast.uploading": "uploading image…",
  "board.toast.imageFailed": "image not added: {error}",
  "board.toast.badUrl": "that is not an http(s) link",
  "board.toast.promptCopied": "prompt copied: paste it in the chat",
  "board.toast.offline": "board offline, retrying",
  "board.session.draft": `Let's work on my board "{name}" {marker}. `,
  "board.index.title": "Boards",
  "board.index.lead": "One board per idea. Hermes draws on it with you, and every board keeps its own session.",
  "board.index.new": "New board",
  "board.index.newHint": "N inside a board for a note",
  "board.index.delete": "Delete board",
  "board.index.confirmDelete": 'Delete the board "{name}"? It moves to the trash folder.',
  "board.continueTip": "Open the linked session in the main chat",
  "board.undo": "Undo",
  "board.redo": "Redo",
  "board.map": "Overview: click to jump",
  "board.present.label": "Presentation controls",
  "board.present.start": "Present",
  "board.present.prev": "Previous stop",
  "board.present.next": "Next stop",
  "board.present.finish": "Finish",
  "board.present.auto": "Auto-play",
  "board.present.exit": "Exit presentation",
  "board.present.empty": "Nothing to present yet: add frames or tour stops",
  "board.tour.fromFrames": "Build tour from frames",
  "board.tour.addSel": "Add to tour",
  "board.tour.addView": "Add this view to tour",
  "board.tour.clear": "Clear tour",
  "board.tour.built": "Tour: {n} stops",
  "board.tour.added": "Added to the tour ({n} stops)",
  "board.tour.cleared": "Tour cleared",
  "board.tour.noFrames": "No frames to build a tour from",
  "board.map.toggle": "Overview map",
  "demo.masked": "hidden in demo mode",
  "board.hint.pan": "Drag to move around the board",
  "board.hint.place": "Click on the board to place it · Esc to cancel",
  "board.hint.arrow": "Drag from one card to another",
  "board.hint.draw": "Draw freely · Esc to stop",
  "board.hint.connect": "Click the card to connect to · Esc to cancel",
  "board.ink.bar": "Draw options",
  "board.ink.pen": "Pen",
  "board.ink.hl": "Highlighter",
  "board.ink.eraser": "Eraser",
  "board.ink.lasso": "Lasso select",
  "board.ink.line": "Line",
  "board.ink.arrow": "Arrow",
  "board.ink.rect": "Rectangle",
  "board.ink.ellipse": "Ellipse",
  "board.ink.thin": "Thin",
  "board.ink.medium": "Medium",
  "board.ink.thick": "Thick",
  "board.ink.color.ink": "Ink",
  "board.ink.color.accent": "Accent",
  "board.ink.color.sage": "Sage",
  "board.ink.color.clay": "Clay",
  "board.ink.color.slate": "Slate",
  "board.ink.color.sand": "Sand",
  "board.ink.dashed": "Dashed",
  "board.ink.smoothOff": "Smoothing off",
  "board.ink.smoothOn": "Smoothing on",
  "board.ink.smoothStrong": "Smoothing strong",
  "board.hint.ink.pen": "Draw · [ ] width · 1-6 colour · Esc to stop",
  "board.hint.ink.shape": "Drag · Shift straight or even · Alt from the centre",
  "board.hint.ink.eraser": "Drag over strokes to erase them",
  "board.hint.ink.lasso": "Loop around strokes · drag the selection to move it",
  "board.ctx.group": "Group",
  "board.ctx.ungroup": "Ungroup",
  "board.tidy": "Arrange",
  "board.tidy.selection": "Arrange selection",
  "board.tidy.all": "Arrange whole board",
  "board.tidy.none": "Already arranged",
  "board.resolve": "Resolve overlaps",
  "board.resolve.selection": "Resolve overlaps in selection",
  "board.resolve.none": "Nothing overlaps",
  "board.push": "Make room",
  "board.snap": "Snap to grid and neighbours",
  "board.snap.hold": "Hold {mod} to place freely",
  "board.kind.shape": "shape",
  "board.shape.ph": "Text",
  "board.shape.rect": "Rectangle",
  "board.shape.diamond": "Diamond (decision)",
  "board.shape.pill": "Pill (start / end)",
  "board.shape.circle": "Circle",
  "board.shape.text": "Text",
  "board.insert.title": "Insert",
  "board.insert.hint": "Insert in the middle of this connection",
  "board.insert.more": "More…",
  "board.edge.label": "Connector label",
  "board.hint.insert": "Pick what goes in the middle · Esc to cancel",
  "board.ctx.edit": "Edit",
  "board.ctx.open": "Open",
  "board.ctx.connect": "Connect to…",
  "board.ctx.askTip": "Ask Hermes: {verb}",
  "board.menu.askHermes": "Ask Hermes",
  "board.menu.addHere": "Add here",
  "board.menu.selectAll": "Select all",
  "board.log.openChat": "Chat",
  "board.chat.title": "Chat with Hermes",
  "board.chat.open": "Chat with Hermes",
  "board.chat.close": "Close chat",
  "board.chat.resize": "Resize the chat",
  "board.chat.noSession": "No session yet. Write below and Hermes starts one for this board.",
  "board.chat.emptySession": "Nothing in this session yet.",
  "board.chat.unreadable": "This session can't be read from here. Continue in session to see it.",
  "board.chat.working": "Hermes is working",
  "board.chat.placeholder": "Ask Hermes about this board",
  "board.chat.withSelection": "with {n} selected",
  "board.chat.hintLive": "Enter sends · Shift+Enter new line",
  "board.chat.hintHandoff": "Send opens the session, message copied",
  "board.chat.send": "Send",
  "board.chat.tool.readBoard": "reading the board",
  "board.chat.tool.editBoard": "editing the board",
  "board.chat.tool.editBoardN": "editing the board · {n} changes",
  "board.chat.tool.viewBoard": "looking at the board",
  "board.chat.tool.skill": "consulting a skill",
  "board.chat.tool.command": "running a command",
  "board.chat.tool.readFile": "reading a file",
  "board.chat.tool.editFile": "editing a file",
  "board.chat.tool.search": "searching",
  "board.chat.tool.web": "browsing the web",
  "board.chat.tool.image": "looking at an image",
  "board.chat.tool.plan": "updating the plan",
  "board.chat.tool.memory": "checking memory",
  "board.chat.tool.delegate": "delegating to a helper",
  "board.chat.tool.other": "working",
  "board.chat.sessionTip": "Session {id}",
  "board.chat.more": "+{n} more",
  "board.chat.model.title": "Model · {provider}: {model}",
  "board.chat.model.titleNoProvider": "Model · {model}",
  "board.chat.model.readonly": "switch it from Hermes Desktop or the Webapp",
  "board.chat.model.refresh": "Refresh models",
  "board.chat.model.switchFailed": "Couldn't switch the model",
  "board.index.open": "Open board",
  "board.widget.empty": "No boards yet.",
  "board.kind.live": "live card",
  "board.video.uploaded": "uploaded video",
  "board.video.noPoster": "no preview yet",
  "board.video.loading": "Loading…",
  "board.toast.uploadingVideo": "uploading video… {pct} %",
  "board.toast.rejected": "change not saved, undone: {error}",
  "board.toast.videoFailed": "video not added: {error}",
  "board.live.st.running": "running",
  "board.live.st.paused": "paused",
  "board.live.st.done": "done",
  "board.live.st.error": "error",
  "board.live.st.idle": "idle",
  "board.live.st.stale": "stale",
  "board.live.staleTip": "No update within this card's time limit; the job may have stopped reporting",
  "board.live.updated": "updated {age} ago",
  "board.live.staleFor": "no update for {age}",
  "board.live.noData": "waiting for data",
  "board.live.age.s": "{n} s",
  "board.live.age.min": "{n} min",
  "board.live.age.h": "{n} h",
  "board.live.age.d": "{n} d",
  "board.live.eta": "ETA {eta}",
  "board.live.l.success": "Success",
  "board.live.l.elapsed": "Elapsed",
  "board.live.l.cost": "Cost",
  "board.live.l.falls": "Falls",
  "board.live.l.successTrend": "Success over time",
  "board.live.l.level": "Level",
  "board.live.l.eta": "ETA",
  "board.live.l.progress": "Progress",
  "board.live.l.steps": "Steps",
  "board.live.l.log": "Log",
  "board.live.l.reward": "Reward",
  "board.live.l.loss": "Loss",
  "board.live.actionsDown": "The action list can't be read here yet: the server answering this page runs an older plugin backend (restart Hermes to load it)",
  "board.live.actionsLoading": "Checking the action list…",
  "board.live.notRegistered": "Not in the action list: {id}",
  "board.live.disabled": "Turned off in the action list",
  "board.live.disabledNote": "Turned off: {note}",
  "board.live.actionOk": "{action}: done in {s} s",
  "board.live.actionFailed": "{action} failed ({code})",
  "board.live.actionError": "{action} not run: {error}",
  "board.live.confirmHead": "Confirm action",
  "board.live.confirmTitle": "{action}?",
  "board.live.confirmBody": "This action can't be undone from the board.",
  "board.live.confirmCard": "card",
  "board.live.confirmId": "action",
  "board.live.confirmTimeout": "stops after {s} s"
};
const __vite_glob_0_0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: en
}, Symbol.toStringTag, { value: "Module" }));
const es = {
  // ── shared ──
  "common.loading": "cargando…",
  "common.unavailable": "no disponible",
  "common.previous": "anterior",
  "common.next": "siguiente",
  "common.today": "hoy",
  "common.done": "listo",
  "common.none": "—",
  "time.now": "ahora",
  "time.justNow": "justo ahora",
  "time.secondsAgo": "hace {n} s",
  "time.minutesAgo": "hace {n} min",
  "time.hoursAgo": "hace {n} h",
  "time.daysAgo": "hace {n} d",
  // ── home chrome: edit mode, catalog, widget shell ──
  "nav.home": "Inicio",
  "nav.open": "Abrir Inicio",
  "home.saveFailed": "No se pudo guardar el diseño; se conserva durante esta sesión",
  "home.restoreDefault": "Restaurar el diseño predeterminado",
  "home.editLayout": "Editar diseño",
  "home.doneEditing": "Terminar de editar",
  "catalog.hint": "arrastra un widget aquí para quitarlo",
  "shell.offline": "sin conexión · no se alcanza el backend de Hermes",
  "shell.unavailable": "no disponible · esta fuente no responde",
  "shell.stale": "desactualizado",
  "shell.staleTitle": "Falló la última actualización; se muestran los datos anteriores",
  "shell.remove": "Quitar {title}",
  // ── widget titles (header + catalog chip) ──
  "widget.ascii": "hermes",
  "widget.clock": "reloj",
  "widget.matrix": "matrix",
  "widget.gateway": "gateway",
  "widget.sessions": "sesiones",
  "widget.tokens": "tokens",
  "widget.host": "servidor",
  "widget.cron": "cron",
  "widget.notes": "notas",
  "widget.errors": "registros",
  "widget.moon": "luna",
  "widget.heartbeat": "latido",
  "widget.life": "vida",
  "widget.pomodoro": "pomodoro",
  "widget.countdown": "cuenta regresiva",
  "widget.calendar": "calendario",
  "widget.projects": "proyectos",
  "widget.spend": "gasto",
  // ── ascii ──
  "ascii.art.caduceus": "caduceo",
  "ascii.art.winged-caduceus": "kerykeion",
  "ascii.art.talaria": "talarias",
  "ascii.art.petasos": "pétaso",
  "ascii.art.lyre": "lira",
  "ascii.art.tortoise": "tortuga",
  "ascii.art.drachma": "dracma",
  "ascii.art.wing": "ala",
  // ── clock ──
  "clock.seconds": "s",
  "clock.secondsTitle": "mostrar / ocultar segundos",
  "clock.formatTitle": "reloj de 12 / 24 horas",
  // ── cron ──
  "cron.empty": "no hay tareas programadas",
  "cron.ok": "ok",
  "cron.err": "error",
  // ── logs ──
  "logs.record": "{n} registro",
  "logs.records": "{n} registros",
  "logs.empty": "sin registros",
  // ── gateway ──
  "gateway.status": "estado",
  "gateway.state": "fase",
  "gateway.online": "● en línea",
  "gateway.offline": "● sin conexión",
  "gateway.pid": "pid",
  "gateway.exit": "salida",
  "gateway.health": "salud",
  "gateway.config": "config",
  "gateway.version": "versión",
  "gateway.s.running": "en ejecución",
  "gateway.s.starting": "iniciando",
  "gateway.s.stopped": "detenido",
  "gateway.s.startup_failed": "falló al iniciar",
  "gateway.s.draining": "drenando",
  "gateway.s.connected": "conectado",
  "gateway.s.connecting": "conectando",
  "gateway.s.disconnected": "desconectado",
  "gateway.s.degraded": "degradado",
  "gateway.s.disabled": "desactivado",
  "gateway.s.fatal": "error fatal",
  "gateway.s.paused": "en pausa",
  "gateway.s.retrying": "reintentando",
  "gateway.s.error": "error",
  // ── host ──
  "host.view.meters": "medidores",
  "host.view.detail": "detalle",
  "host.view.graphs": "gráficas",
  "host.cpu": "cpu",
  "host.ram": "ram",
  "host.disk": "disco",
  "host.load": "carga",
  "host.cores": "núcleos",
  "host.proc": "proceso",
  "host.os": "so",
  "host.diskFree": "{n}G libres",
  "host.procValue": "{mb}M · {threads} hilos",
  // ── moon ──
  "moon.phase.0": "luna nueva",
  "moon.phase.1": "luna creciente",
  "moon.phase.2": "cuarto creciente",
  "moon.phase.3": "gibosa creciente",
  "moon.phase.4": "luna llena",
  "moon.phase.5": "gibosa menguante",
  "moon.phase.6": "cuarto menguante",
  "moon.phase.7": "luna menguante",
  "moon.offset": "{n} d",
  // ── notes ──
  "notes.clearDone": "borrar hechas",
  "notes.empty": "sin notas; agrega una con +",
  "notes.restore": "restaurar",
  "notes.strike": "tachar",
  "notes.add": "Agregar nota",
  // ── pomodoro ──
  "pomo.work": "trabajo",
  "pomo.break": "descanso",
  "pomo.running": "en marcha",
  "pomo.paused": "en pausa",
  "pomo.toggleTitle": "clic: iniciar / pausar",
  "pomo.nameTitle": "haz clic para nombrar este temporizador",
  // ── countdown ──
  "count.month": "mes",
  "count.day": "día",
  "count.year": "año",
  "count.hour": "hora",
  "count.minute": "minuto",
  "count.up": "subir {field}",
  "count.down": "bajar {field}",
  "count.setDate": "elegir fecha",
  "count.setTitle": "haz clic para elegir la fecha y la hora",
  "count.labelTitle": "haz clic para editar la etiqueta",
  "count.namePrompt": "haz clic para nombrar esta cuenta regresiva",
  // ── life ──
  "life.play": "reanudar",
  "life.pause": "pausa",
  "life.seed": "sembrar",
  "life.clear": "limpiar",
  // ── tokens ──
  "tokens.range.week": "7 días",
  "tokens.range.month": "1 mes",
  "tokens.range.halfyear": "6 meses",
  "tokens.line": "línea",
  "tokens.lineTitle": "vista de línea / barras",
  "tokens.totals": "totales",
  "tokens.totalsTitle": "mostrar / ocultar totales",
  "tokens.in": "ent",
  "tokens.out": "sal",
  "tokens.cost": "costo",
  "tokens.dayFallback": "día*",
  "tokens.group.off": "todo",
  "tokens.group.provider": "proveedor",
  "tokens.group.model": "modelo",
  "tokens.groupTitle": "agrupar uso: todo / por proveedor / por modelo",
  "tokens.groupEmpty": "sin uso en este periodo",
  "tokens.groupMore": "+{n} más",
  "tokens.unknownProvider": "desconocido",
  "tokens.providerFallback": "sin datos de proveedor; se muestran modelos",
  "tokens.rowTitle": "{name} · {tokens} tokens · ${cost} · {share} %",
  // ── sessions ──
  "sessions.active": "activas",
  "sessions.live": "en vivo",
  "sessions.idle": "inactiva",
  "sessions.sort.recent": "recientes",
  "sessions.sort.tokens": "tokens",
  "sessions.sortTitle": "ordenar: más recientes / más tokens",
  "sessions.filter.all": "todas",
  "sessions.filterTitle": "mínimo de tokens (entrada + salida)",
  "sessions.noneMatch": "ninguna sesión supera {n} tokens",
  "sessions.tokensTitle": "{input} de entrada · {output} de salida",
  // ── projects ──
  "projects.empty": "sin proyectos; agrega ~/projects/<nombre>/status.json",
  "projects.inbox": "entrada",
  "projects.doing": "en curso",
  "projects.done": "hechas",
  "projects.next": "sigue:",
  "projects.alerts": "alertas:",
  "projects.updated": "actualizado {when}",
  // ── spend ──
  "spend.range.today": "hoy",
  "spend.range.week": "7 días",
  "spend.range.month": "este mes",
  "spend.real": "gasto real",
  "spend.realTitle": "dinero de pago por uso (llaves de API), por proveedor",
  "spend.est": "est.",
  "spend.estTitle": "estimado con precios de lista, no es una factura",
  "spend.partEst": "parte est.",
  "spend.partEstTitle": "algunos proveedores reportaron costos facturados; el resto es estimado",
  "spend.noReal": "sin gasto de pago por uso en este rango",
  "spend.plan": "suscripción de {brand}",
  "spend.covered": "{plan} cubrió {amount}",
  "spend.coveredTitle": "lo que costarían estas llamadas a precio de lista de la API; lo paga tu plan, no por token",
  "spend.month": "mes {spent}",
  "spend.projected": "→ {amount} proyectado",
  "spend.projectedTitle": "gasto real hasta hoy, extrapolado al fin de mes",
  "spend.cap": "tope",
  "spend.capOf": "de {cap}",
  "spend.capTitle": "tope mensual de gasto real",
  "spend.capOff": "sin tope",
  "spend.state.near": "cerca del tope",
  "spend.state.pace": "vas a pasar el tope",
  "spend.state.over": "tope rebasado",
  "spend.top.all": "top: todo",
  "spend.top.real": "top: real",
  "spend.topTitle": "ordenar sesiones por todo el costo / solo por gasto real",
  "spend.topHead": "sesiones más caras",
  "spend.topHeadReal": "más gasto real",
  "spend.topEmpty": "sin sesiones con costo en este rango",
  "spend.tag.metered": "real",
  "spend.tag.subscription": "plan",
  "spend.tag.unclassified": "?",
  "spend.tag.mixed": "mixto",
  "spend.openTitle": "{title} · {cost} · {provider} — abrir sesión",
  "spend.untitled": "sin título",
  "spend.unclassified": "sin clasificar {amount}",
  "spend.unclassifiedTitle": "costo de proveedores cuyo cobro no se pudo distinguir (credenciales mixtas o eliminadas)",
  "spend.unpriced": "{n} sin precio",
  "spend.unpricedTitle": "sesiones a las que Hermes no pudo ponerles precio",
  "spend.noCost": "{n} sesiones sin datos de costo",
  "spend.empty": "sin datos de costo en este rango",
  "spend.noStore": "almacén de sesiones no disponible",
  // ── boards ──
  "widget.board": "pizarrón",
  "nav.boards": "Pizarrones",
  "nav.openBoards": "Abrir pizarrones",
  "board.untitled": "Pizarrón sin título",
  "board.loadFailed": "pizarrón no disponible",
  "board.path.home": "inicio",
  "board.path.boards": "pizarrones",
  "board.path.parent": "superior",
  "board.renameHint": "Doble clic para renombrar",
  "board.presence.editing": "está editando",
  "board.state.saved": "guardado {time}",
  "board.state.session": "sesión vinculada",
  "board.state.noSession": "sin sesión todavía",
  "board.continue": "Continuar en sesión",
  "board.ctx.zoomTo": "Acercar a la selección",
  "board.fit": "Ajustar al contenido",
  "board.zoomIn": "Acercar",
  "board.zoomOut": "Alejar",
  "board.tool.select": "Elegir",
  "board.tool.pan": "Mover",
  "board.tool.note": "Nota",
  "board.tool.todo": "Pendientes",
  "board.tool.link": "Liga",
  "board.tool.image": "Imagen",
  "board.tool.col": "Columna",
  "board.tool.board": "Pizarrón",
  "board.tool.embed": "HTML incrustado",
  "board.tool.arrow": "Flecha",
  "board.tool.draw": "Dibujar",
  "board.prompt.selection": "seleccionado",
  "board.kind.card": "tarjeta",
  "board.kind.todo": "pendientes",
  "board.kind.col": "columna",
  "board.kind.link": "liga",
  "board.kind.image": "imagen",
  "board.kind.embed": "html",
  "board.kind.video": "video",
  "board.kind.board": "pizarrón",
  "board.kind.frame": "marco",
  "board.kind.box": "caja",
  "board.kind.text": "texto",
  "board.kind.draw": "boceto",
  "board.kind.line": "flecha",
  "board.ctx.items": "{n} elementos",
  "board.ctx.todo": "pendientes, {n} elementos",
  "board.ctx.col": "columna, {n} tarjetas",
  "board.ctx.duplicate": "Duplicar",
  "board.ctx.delete": "Borrar",
  "board.verb.diagram": "Pasar a diagrama",
  "board.verb.sortDate": "Ordenar por fecha",
  "board.verb.split": "Separar en tarjetas",
  "board.verb.expand": "Desarrollar",
  "board.verb.flow": "Convertir en flujo",
  "board.verb.group": "Agrupar",
  "board.verb.summarize": "Resumir",
  "board.verb.improve": "Acomodar",
  "board.cursor.adding": "agregando {kind}",
  "board.cursor.placingStep": "colocando paso {n}",
  "board.cursor.connecting": "conectando {a} → {b}",
  "board.cursor.moving": "moviendo {what}",
  "board.cursor.editing": "editando {what}",
  "board.cursor.removing": "quitando",
  "board.cursor.done": "listo, {n} cambios",
  "board.log.changes": "Hizo {n} cambios.",
  "board.log.undo": "Deshacer",
  "board.log.close": "Cerrar",
  "board.card.titlePh": "Título",
  "board.card.textPh": "Escribe algo…",
  "board.card.empty": "Nota vacía",
  "board.todo.title": "Pendientes",
  "board.todo.left": "Faltan {n}.",
  "board.todo.allDone": "Todo listo.",
  "board.todo.add": "agregar pendiente",
  "board.todo.remove": "Quitar pendiente",
  "board.col.title": "Columna",
  "board.col.add": "agregar tarjeta",
  "board.video.play": "Reproducir",
  "board.video.untitled": "Video",
  "board.image.capPh": "Pie de imagen",
  "board.file.open": "Abrir el PDF",
  "board.file.download": "Descargar el modelo",
  "board.file.pages": "{n} pág.",
  "board.mark.ok": "Bien",
  "board.mark.fail": "Falló",
  "board.mark.wait": "En espera",
  "board.embed.title": "embed.html",
  "board.embed.sandbox": "aislado: solo scripts, sin red",
  "board.embed.reload": "Recargar",
  "board.embed.taller": "Más alto",
  "board.embed.themeOn": "Usar tema de Hermes",
  "board.embed.themeOff": "Aspecto original",
  "board.embed.activate": "Clic para usar",
  "board.embed.live": "html en vivo",
  "board.comp.gallery": "Componentes",
  "board.comp.close": "Cerrar",
  "board.comp.emptyTitle": "Aún no hay componentes",
  "board.comp.emptyBody": "Pídele a Hermes la vista que necesites (un medidor, una red, una línea de tiempo). Escribe el componente, lo guarda aquí y lo reutiliza en cualquier tablero.",
  "board.comp.downTitle": "Componentes no disponibles",
  "board.comp.downBody": "El servidor de esta página aún no tiene la biblioteca de componentes. Reinicia el gateway después de actualizar el plugin.",
  "board.comp.latest": "última",
  "board.comp.update": "Actualizar a {v}",
  "board.comp.versions": "Versiones",
  "board.comp.followLatest": "Seguir la última",
  "board.comp.source": "Código",
  "board.comp.missing": "El componente {name} no está en la biblioteca",
  "board.comp.missingHint": "Se borró o nunca se creó. Pídele a Hermes que lo cree otra vez.",
  "board.comp.dataFiles": "{n} archivos de datos · {size}",
  "board.comp.syncTip": "Enlazada al reloj compartido {group}",
  "board.comp.actionNotOnCard": "Esta tarjeta no tiene permiso para ejecutar {id}",
  "board.comp.actionCancelled": "Cancelado",
  "board.sync.link": "Enlazar a un reloj",
  "board.sync.unlink": "Desenlazar reloj",
  "board.sync.group": "Reloj compartido {group}",
  "board.sync.master": "Sigue al video",
  "board.sync.free": "Reloj propio (sin video en el grupo)",
  "board.sync.rewind": "Al inicio",
  "board.sync.play": "Reproducir",
  "board.sync.pause": "Pausar",
  "board.sync.seek": "Posición",
  "board.sync.rate": "Velocidad",
  "board.sync.manual": "Reloj manual: lo avanza un script",
  "board.ref.open": "abrir",
  "board.ref.meta": "{n} tarjetas · {when}",
  "board.ref.missing": "Pizarrón no encontrado",
  "board.frame.title": "Marco",
  "board.text.empty": "Texto",
  "board.dueToday": "vence hoy",
  "board.time.now": "ahora",
  "board.time.min": "hace {n} min",
  "board.time.h": "hace {n} h",
  "board.time.yesterday": "ayer",
  "board.empty.title": "Pizarrón vacío",
  "board.empty.body": "Da doble clic para escribir una nota, pega una liga o una imagen, o pídele algo a Hermes en el chat.",
  "board.ask.link": "Agregar una liga",
  "board.ask.embed": "Incrustar HTML",
  "board.ask.linkHint": "Las páginas se vuelven tarjetas con vista previa; YouTube, Vimeo, Loom y X, reproductores.",
  "board.ask.embedHint": "Corre aislado: solo scripts, sin red. {mod}↵ para agregar.",
  "board.ask.cancel": "Cancelar",
  "board.ask.add": "Agregar",
  "board.toast.uploading": "subiendo imagen…",
  "board.toast.imageFailed": "no se agregó la imagen: {error}",
  "board.toast.badUrl": "eso no es una liga http(s)",
  "board.toast.promptCopied": "mensaje copiado: pégalo en el chat",
  "board.toast.offline": "pizarrón sin conexión, reintentando",
  "board.session.draft": "Trabajemos en mi pizarrón «{name}» {marker}. ",
  "board.index.title": "Pizarrones",
  "board.index.lead": "Un pizarrón por idea. Hermes dibuja en él contigo y cada pizarrón tiene su propia sesión.",
  "board.index.new": "Nuevo pizarrón",
  "board.index.newHint": "N dentro de un pizarrón para una nota",
  "board.index.delete": "Borrar pizarrón",
  "board.index.confirmDelete": "¿Borrar el pizarrón «{name}»? Se mueve a la carpeta de papelera.",
  "board.continueTip": "Abrir la sesión ligada en el chat principal",
  "board.undo": "Deshacer",
  "board.redo": "Rehacer",
  "board.map": "Vista general: clic para ir",
  "board.present.label": "Controles de la presentación",
  "board.present.start": "Presentar",
  "board.present.prev": "Parada anterior",
  "board.present.next": "Siguiente parada",
  "board.present.finish": "Terminar",
  "board.present.auto": "Reproducción automática",
  "board.present.exit": "Salir de la presentación",
  "board.present.empty": "Aún no hay nada que presentar: agrega marcos o paradas",
  "board.tour.fromFrames": "Armar recorrido con los marcos",
  "board.tour.addSel": "Agregar al recorrido",
  "board.tour.addView": "Agregar esta vista al recorrido",
  "board.tour.clear": "Quitar recorrido",
  "board.tour.built": "Recorrido: {n} paradas",
  "board.tour.added": "Agregado al recorrido ({n} paradas)",
  "board.tour.cleared": "Recorrido quitado",
  "board.tour.noFrames": "No hay marcos para armar un recorrido",
  "board.map.toggle": "Mapa de vista general",
  "demo.masked": "oculto en modo demo",
  "board.hint.pan": "Arrastra para moverte por el pizarrón",
  "board.hint.place": "Haz clic en el pizarrón para colocarlo · Esc para cancelar",
  "board.hint.arrow": "Arrastra de una tarjeta a otra",
  "board.hint.draw": "Dibuja libre · Esc para terminar",
  "board.hint.connect": "Haz clic en la tarjeta a conectar · Esc para cancelar",
  "board.ink.bar": "Opciones de dibujo",
  "board.ink.pen": "Pluma",
  "board.ink.hl": "Resaltador",
  "board.ink.eraser": "Borrador",
  "board.ink.lasso": "Selección con lazo",
  "board.ink.line": "Línea",
  "board.ink.arrow": "Flecha",
  "board.ink.rect": "Rectángulo",
  "board.ink.ellipse": "Elipse",
  "board.ink.thin": "Delgado",
  "board.ink.medium": "Medio",
  "board.ink.thick": "Grueso",
  "board.ink.color.ink": "Tinta",
  "board.ink.color.accent": "Acento",
  "board.ink.color.sage": "Salvia",
  "board.ink.color.clay": "Barro",
  "board.ink.color.slate": "Pizarra",
  "board.ink.color.sand": "Arena",
  "board.ink.dashed": "Punteado",
  "board.ink.smoothOff": "Suavizado apagado",
  "board.ink.smoothOn": "Suavizado activo",
  "board.ink.smoothStrong": "Suavizado fuerte",
  "board.hint.ink.pen": "Dibuja · [ ] grosor · 1-6 color · Esc para terminar",
  "board.hint.ink.shape": "Arrastra · Shift recto o parejo · Alt desde el centro",
  "board.hint.ink.eraser": "Pasa sobre los trazos para borrarlos",
  "board.hint.ink.lasso": "Rodea los trazos · arrastra la selección para moverla",
  "board.ctx.group": "Agrupar",
  "board.ctx.ungroup": "Desagrupar",
  "board.tidy": "Ordenar",
  "board.tidy.selection": "Ordenar selección",
  "board.tidy.all": "Ordenar todo el pizarrón",
  "board.tidy.none": "Ya está ordenado",
  "board.resolve": "Separar lo encimado",
  "board.resolve.selection": "Separar lo encimado en la selección",
  "board.resolve.none": "Nada está encimado",
  "board.push": "Hacer espacio",
  "board.snap": "Imán a la retícula y a los vecinos",
  "board.snap.hold": "Mantén {mod} para colocar libre",
  "board.kind.shape": "forma",
  "board.shape.ph": "Texto",
  "board.shape.rect": "Rectángulo",
  "board.shape.diamond": "Rombo (decisión)",
  "board.shape.pill": "Píldora (inicio / fin)",
  "board.shape.circle": "Círculo",
  "board.shape.text": "Texto",
  "board.insert.title": "Insertar",
  "board.insert.hint": "Insertar en medio de esta conexión",
  "board.insert.more": "Más…",
  "board.edge.label": "Etiqueta del conector",
  "board.hint.insert": "Elige qué va en medio · Esc para cancelar",
  "board.ctx.edit": "Editar",
  "board.ctx.open": "Abrir",
  "board.ctx.connect": "Conectar con…",
  "board.ctx.askTip": "Pedirle a Hermes: {verb}",
  "board.menu.askHermes": "Pedirle a Hermes",
  "board.menu.addHere": "Agregar aquí",
  "board.menu.selectAll": "Elegir todo",
  "board.log.openChat": "Chat",
  "board.chat.title": "Chat con Hermes",
  "board.chat.open": "Chat con Hermes",
  "board.chat.close": "Cerrar chat",
  "board.chat.resize": "Cambiar el ancho del chat",
  "board.chat.noSession": "Todavía no hay sesión. Escribe abajo y Hermes abre una para este pizarrón.",
  "board.chat.emptySession": "Esta sesión aún no tiene mensajes.",
  "board.chat.unreadable": "No se puede leer esta sesión desde aquí. Continúa en la sesión para verla.",
  "board.chat.working": "Hermes está trabajando",
  "board.chat.placeholder": "Pídele algo a Hermes sobre este pizarrón",
  "board.chat.withSelection": "con {n} elegidos",
  "board.chat.hintLive": "Enter envía · Shift+Enter nueva línea",
  "board.chat.hintHandoff": "Enviar abre la sesión con el mensaje copiado",
  "board.chat.send": "Enviar",
  "board.chat.tool.readBoard": "leyendo el pizarrón",
  "board.chat.tool.editBoard": "editando el pizarrón",
  "board.chat.tool.editBoardN": "dibujando {n} cambios",
  "board.chat.tool.viewBoard": "mirando el pizarrón",
  "board.chat.tool.skill": "consultando una skill",
  "board.chat.tool.command": "ejecutando un comando",
  "board.chat.tool.readFile": "leyendo un archivo",
  "board.chat.tool.editFile": "editando un archivo",
  "board.chat.tool.search": "buscando",
  "board.chat.tool.web": "navegando la web",
  "board.chat.tool.image": "mirando una imagen",
  "board.chat.tool.plan": "actualizando el plan",
  "board.chat.tool.memory": "consultando la memoria",
  "board.chat.tool.delegate": "delegando a un ayudante",
  "board.chat.tool.other": "trabajando",
  "board.chat.sessionTip": "Sesión {id}",
  "board.chat.more": "+{n} más",
  "board.chat.model.title": "Modelo · {provider}: {model}",
  "board.chat.model.titleNoProvider": "Modelo · {model}",
  "board.chat.model.readonly": "cámbialo desde Hermes Desktop o la Webapp",
  "board.chat.model.refresh": "Actualizar modelos",
  "board.chat.model.switchFailed": "No se pudo cambiar de modelo",
  "board.index.open": "Abrir pizarrón",
  "board.widget.empty": "Todavía no hay pizarrones.",
  "board.kind.live": "tarjeta viva",
  "board.video.uploaded": "video subido",
  "board.video.noPoster": "sin vista previa aún",
  "board.video.loading": "Cargando…",
  "board.toast.uploadingVideo": "subiendo video… {pct} %",
  "board.toast.rejected": "no se guardó el cambio, se deshizo: {error}",
  "board.toast.videoFailed": "no se agregó el video: {error}",
  "board.live.st.running": "corriendo",
  "board.live.st.paused": "en pausa",
  "board.live.st.done": "terminado",
  "board.live.st.error": "error",
  "board.live.st.idle": "inactivo",
  "board.live.st.stale": "sin señal",
  "board.live.staleTip": "No llegó ninguna actualización dentro del límite de esta tarjeta; puede que el proceso dejó de reportar",
  "board.live.updated": "actualizado hace {age}",
  "board.live.staleFor": "sin actualizar desde hace {age}",
  "board.live.noData": "esperando datos",
  "board.live.age.s": "{n} s",
  "board.live.age.min": "{n} min",
  "board.live.age.h": "{n} h",
  "board.live.age.d": "{n} d",
  "board.live.eta": "faltan {eta}",
  "board.live.l.success": "Éxito",
  "board.live.l.elapsed": "Tiempo",
  "board.live.l.cost": "Costo",
  "board.live.l.falls": "Caídas",
  "board.live.l.successTrend": "Éxito en el tiempo",
  "board.live.l.level": "Nivel",
  "board.live.l.eta": "Falta",
  "board.live.l.progress": "Avance",
  "board.live.l.steps": "Pasos",
  "board.live.l.log": "Registro",
  "board.live.l.reward": "Recompensa",
  "board.live.l.loss": "Pérdida",
  "board.live.actionsDown": "Aún no se puede leer la lista de acciones aquí: el servidor de esta página corre un backend anterior del plugin (reinicia Hermes para cargarlo)",
  "board.live.actionsLoading": "Revisando la lista de acciones…",
  "board.live.notRegistered": "No está en la lista de acciones: {id}",
  "board.live.disabled": "Apagada en la lista de acciones",
  "board.live.disabledNote": "Apagada: {note}",
  "board.live.actionOk": "{action}: listo en {s} s",
  "board.live.actionFailed": "{action} falló ({code})",
  "board.live.actionError": "{action} no se ejecutó: {error}",
  "board.live.confirmHead": "Confirmar acción",
  "board.live.confirmTitle": "¿{action}?",
  "board.live.confirmBody": "Esta acción no se puede deshacer desde el pizarrón.",
  "board.live.confirmCard": "tarjeta",
  "board.live.confirmId": "acción",
  "board.live.confirmTimeout": "se corta a los {s} s"
};
const __vite_glob_0_1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: es
}, Symbol.toStringTag, { value: "Module" }));
const FALLBACK_LANGUAGE = "en";
function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(
    /\{(\w+)\}/g,
    (slot, name) => Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : slot
  );
}
function translate(dictionaries, language, key, vars) {
  const text = dictionaries[language]?.[key] ?? dictionaries[FALLBACK_LANGUAGE]?.[key] ?? key;
  return interpolate(text, vars);
}
function resolveLanguage(candidates, available) {
  const have = new Set(available.map((a) => a.toLowerCase()));
  for (const raw of candidates) {
    if (!raw) continue;
    const tag = raw.trim().toLowerCase().replace(/_/g, "-");
    if (!tag) continue;
    if (have.has(tag)) return tag;
    const base = tag.split("-")[0];
    if (have.has(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}
let locale;
function setDateLocale(language) {
  locale = language;
}
function fmtDate(date, options) {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(void 0, options).format(date);
  }
}
const modules = /* @__PURE__ */ Object.assign({
  "./locales/en.ts": __vite_glob_0_0,
  "./locales/es.ts": __vite_glob_0_1
});
const DICTIONARIES = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [
    path.replace(/^.*\//, "").replace(/\.ts$/, "").toLowerCase(),
    mod.default
  ])
);
const LANGUAGES = Object.keys(DICTIONARIES);
let hostLanguage = null;
const listeners = /* @__PURE__ */ new Set();
function browserLanguages() {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}
function computeLanguage() {
  return resolveLanguage([hostLanguage, ...browserLanguages()], LANGUAGES);
}
let current$1 = computeLanguage();
setDateLocale(current$1);
function setHostLanguage(language) {
  hostLanguage = language ?? null;
  const next = computeLanguage();
  if (next === current$1) return;
  current$1 = next;
  setDateLocale(next);
  listeners.forEach((l) => l());
}
const translators = /* @__PURE__ */ new Map();
function translatorFor(language) {
  let fn2 = translators.get(language);
  if (!fn2) {
    fn2 = (key, vars) => translate(DICTIONARIES, language, key, vars);
    translators.set(language, fn2);
  }
  return fn2;
}
const t = (key, vars) => translatorFor(current$1)(key, vars);
function useT() {
  const [language, setLanguage] = useState(current$1);
  useEffect(() => {
    const onChange = () => setLanguage(current$1);
    listeners.add(onChange);
    onChange();
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return translatorFor(language);
}
const GRID_COLS = 12;
function collide(a, b) {
  return a.gx < b.gx + b.gw && a.gx + a.gw > b.gx && a.gy < b.gy + b.gh && a.gy + a.gh > b.gy;
}
function reflow(box2, others) {
  const moved = /* @__PURE__ */ new Map();
  const rest = others.map((i) => ({ ...i })).sort((a, b) => a.gy - b.gy);
  const placed = [box2];
  for (const r of rest) {
    let guard = 0;
    while (placed.some((p) => collide(r, p)) && guard++ < 100) {
      const blocker = placed.find((p) => collide(r, p));
      r.gy = blocker.gy + blocker.gh;
    }
    placed.push(r);
    const original = others.find((o) => o.id === r.id);
    if (r.gy !== original.gy) moved.set(r.id, r.gy);
  }
  return moved;
}
function findSwapTarget(pgx, pgy, dragged, others) {
  for (const t2 of others) {
    if (t2.id === dragged.id || t2.gw !== dragged.gw || t2.gh !== dragged.gh) continue;
    if (pgx >= t2.gx && pgx < t2.gx + t2.gw && pgy >= t2.gy && pgy < t2.gy + t2.gh) {
      return t2;
    }
  }
  return null;
}
function findFreeSlot(layout, size, cols = GRID_COLS) {
  const maxRow = layout.reduce((m, w) => Math.max(m, w.gy + w.gh), 0);
  for (let gy = 0; gy <= maxRow; gy++) {
    for (let gx = 0; gx <= cols - size.gw; gx++) {
      const box2 = { gx, gy, gw: size.gw, gh: size.gh };
      if (!layout.some((w) => collide(box2, w))) return { gx, gy };
    }
  }
  return { gx: 0, gy: maxRow };
}
function clampPosition(gx, gy, gw, _gh, cols = GRID_COLS) {
  return {
    gx: Math.max(0, Math.min(cols - gw, Math.round(gx))),
    gy: Math.max(0, Math.round(gy))
  };
}
function fitCellHeight(fitHeight, rows, o) {
  if (!(fitHeight > 0) || rows <= 0) return o.base;
  const fit = (fitHeight - o.pad * 2 + o.gap) / rows - o.gap;
  return Math.round(Math.min(o.base * o.maxStretch, Math.max(o.base, fit)));
}
function swallow(e) {
  e.stopPropagation();
}
function HoverCtl({ children, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const widget = el?.closest(".home-widget");
    if (!el || !widget || el.classList.contains("pomo-set")) return;
    const measure = () => {
      const w = el.scrollWidth;
      widget.style.setProperty("--ctl-w", `${w}px`);
      const title = widget.querySelector(".hd .hd-t");
      const inner = widget.clientWidth - 24;
      const need = 12 + 10 + (title?.offsetWidth ?? 0) + 16 + w;
      if (need > inner) widget.setAttribute("data-ctl-tight", "");
      else widget.removeAttribute("data-ctl-tight");
    };
    measure();
    const RO = globalThis.ResizeObserver;
    const ro = RO ? new RO(measure) : null;
    ro?.observe(el);
    ro?.observe(widget);
    return () => {
      ro?.disconnect();
      widget.style.removeProperty("--ctl-w");
      widget.removeAttribute("data-ctl-tight");
    };
  });
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: `hover-ctl${className ? ` ${className}` : ""}`,
      onClick: swallow,
      onPointerDown: swallow,
      children
    }
  );
}
function HoverArrows({
  onPrev,
  onNext,
  label,
  onLabelClick,
  prevDisabled,
  nextDisabled,
  className
}) {
  const t2 = useT();
  return /* @__PURE__ */ jsxs(HoverCtl, { className: `hover-arrows${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "hv-arrow",
        "aria-label": t2("common.previous"),
        disabled: prevDisabled,
        onClick: (e) => {
          swallow(e);
          onPrev();
        },
        children: "‹"
      }
    ),
    label !== void 0 && (onLabelClick ? /* @__PURE__ */ jsx(
      "button",
      {
        className: "hv-label hv-label-btn",
        onClick: (e) => {
          swallow(e);
          onLabelClick();
        },
        children: label
      }
    ) : /* @__PURE__ */ jsx("span", { className: "hv-label", children: label })),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "hv-arrow",
        "aria-label": t2("common.next"),
        disabled: nextDisabled,
        onClick: (e) => {
          swallow(e);
          onNext();
        },
        children: "›"
      }
    )
  ] });
}
function readNotes(p) {
  if (!Array.isArray(p.notes)) return [];
  return p.notes.filter(
    (n) => typeof n === "object" && n !== null && typeof n.id === "string" && typeof n.text === "string" && typeof n.done === "boolean"
  );
}
function NotesWidget({ widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const notes = readNotes(widgetProps);
  const [editingId, setEditingId] = useState(null);
  const commit = (next) => onWidgetPropsChange({ ...widgetProps, notes: next });
  const add = () => {
    const note = { id: crypto.randomUUID(), text: "", done: false };
    commit([...notes, note]);
    setEditingId(note.id);
  };
  const toggle = (id) => commit(notes.map((n) => n.id === id ? { ...n, done: !n.done } : n));
  const save = (id, raw) => {
    const text = raw.trim();
    setEditingId(null);
    commit(text === "" ? notes.filter((n) => n.id !== id) : notes.map((n) => n.id === id ? { ...n, text } : n));
  };
  const doneCount = notes.filter((n) => n.done).length;
  return /* @__PURE__ */ jsxs("div", { className: "home-notes", children: [
    doneCount > 0 && /* @__PURE__ */ jsx(HoverCtl, { children: /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: () => commit(notes.filter((n) => !n.done)), children: t2("notes.clearDone") }) }),
    notes.length === 0 && editingId === null && /* @__PURE__ */ jsx("span", { className: "dim", children: t2("notes.empty") }),
    notes.map(
      (n) => editingId === n.id ? /* @__PURE__ */ jsxs("div", { className: "note-row", children: [
        /* @__PURE__ */ jsx("span", { className: "note-mark dim", children: "·" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "note-input",
            autoFocus: true,
            defaultValue: n.text,
            onBlur: (e) => save(n.id, e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") save(n.id, e.currentTarget.value);
              if (e.key === "Escape") save(n.id, n.text);
            }
          }
        )
      ] }, n.id) : /* @__PURE__ */ jsxs("div", { className: "note-row", children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            className: `note-mark${n.done ? " done" : ""}`,
            onClick: () => toggle(n.id),
            title: n.done ? t2("notes.restore") : t2("notes.strike"),
            children: n.done ? "✕" : "·"
          }
        ),
        /* @__PURE__ */ jsx(
          "span",
          {
            className: `note-text${n.done ? " done" : ""}`,
            onClick: () => setEditingId(n.id),
            children: n.text
          }
        )
      ] }, n.id)
    ),
    /* @__PURE__ */ jsx("button", { className: "note-add", onClick: add, "aria-label": t2("notes.add"), children: "+" })
  ] });
}
const EMBLEM_IDS = [
  "caduceus",
  "winged-caduceus",
  "talaria",
  "petasos",
  "lyre",
  "tortoise",
  "drachma",
  "wing"
];
const LEGACY_INDEX = ["caduceus", "petasos", "drachma"];
function emblemFromProps(props) {
  const art = props.art;
  if (typeof art === "string" && EMBLEM_IDS.includes(art)) return art;
  const idx2 = props.artIndex;
  if (typeof idx2 === "number" && Number.isFinite(idx2)) {
    const n = LEGACY_INDEX.length;
    return LEGACY_INDEX[(Math.trunc(idx2) % n + n) % n];
  }
  return "caduceus";
}
function stepEmblem(props, dir) {
  const n = EMBLEM_IDS.length;
  const i = EMBLEM_IDS.indexOf(emblemFromProps(props));
  const next = { ...props, art: EMBLEM_IDS[(i + dir + n) % n] };
  delete next.artIndex;
  return next;
}
function fitGrid(w, h, dpr, o = {}) {
  const W = Math.max(0, Math.floor(w * dpr)), H = Math.max(0, Math.floor(h * dpr));
  const fixed = !!(o.cols && o.rows);
  let pitch;
  if (fixed) {
    pitch = Math.floor(Math.min(W / o.cols, H / o.rows));
  } else {
    const target = o.target ?? 72;
    const lo = Math.max(2, Math.round((o.minCss ?? 2.8) * dpr));
    const hi = Math.max(lo, Math.round((o.maxCss ?? 4.2) * dpr));
    pitch = Math.min(hi, Math.max(lo, Math.round(Math.min(W, H) / target)));
  }
  pitch = Math.max(2, pitch);
  const cols = fixed ? o.cols : Math.floor(W / pitch);
  const rows = fixed ? o.rows : Math.floor(H / pitch);
  return { pitch, cols, rows, ox: Math.floor((W - cols * pitch) / 2), oy: Math.floor((H - rows * pitch) / 2) };
}
function fitBox(bw, bh, cols, rows, margin = 1) {
  const aw = Math.max(1, cols - 2 * margin), ah = Math.max(1, rows - 2 * margin);
  const s = Math.min(aw / bw, ah / bh);
  return { s, x: (cols - bw * s) / 2, y: (rows - bh * s) / 2 };
}
function floydSteinberg(lum, cols, rows, threshold = 0.5) {
  const buf = Float32Array.from(lum);
  const out = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    const ltr = y % 2 === 0;
    const dx = ltr ? 1 : -1;
    for (let k = 0; k < cols; k++) {
      const x = ltr ? k : cols - 1 - k;
      const i = y * cols + x;
      const v = buf[i];
      const on = v >= threshold ? 1 : 0;
      out[i] = on;
      const err = v - on;
      const fwd = x + dx >= 0 && x + dx < cols;
      const back = x - dx >= 0 && x - dx < cols;
      if (fwd) buf[i + dx] += err * 7 / 16;
      if (y + 1 < rows) {
        if (back) buf[i + cols - dx] += err * 3 / 16;
        buf[i + cols] += err * 5 / 16;
        if (fwd) buf[i + cols + dx] += err / 16;
      }
    }
  }
  return out;
}
function bayerMatrix(n = 2) {
  let m = [[0]];
  for (let k = 0; k < n; k++) {
    const s = m.length;
    const next = Array.from({ length: s * 2 }, () => new Array(s * 2).fill(0));
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = 4 * m[y][x];
        next[y][x] = v;
        next[y][x + s] = v + 2;
        next[y + s][x] = v + 3;
        next[y + s][x + s] = v + 1;
      }
    }
    m = next;
  }
  return m;
}
const BAYER4 = bayerMatrix(2);
function bayerDither(lum, cols, rows) {
  const out = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t2 = (BAYER4[y & 3][x & 3] + 0.5) / 16;
      out[y * cols + x] = lum[y * cols + x] > t2 ? 1 : 0;
    }
  }
  return out;
}
const BRAILLE_DOTS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];
function brailleToBits(art) {
  const lines2 = art.split("\n");
  const width = Math.max(0, ...lines2.map((l) => [...l].length));
  const cols = width * 2, rows = lines2.length * 4;
  const bits = new Uint8Array(cols * rows);
  lines2.forEach((line2, ly) => {
    [...line2].forEach((ch, lx) => {
      const code = ch.codePointAt(0) - 10240;
      if (code <= 0 || code > 255) return;
      BRAILLE_DOTS.forEach(([dx, dy], k) => {
        if (code & 1 << k) bits[(ly * 4 + dy) * cols + lx * 2 + dx] = 1;
      });
    });
  });
  return { cols, rows, bits };
}
function trimBits(b) {
  let x0 = b.cols, y0 = b.rows, x1 = -1, y1 = -1;
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      if (!b.bits[y * b.cols + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { cols: 0, rows: 0, bits: new Uint8Array(0) };
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  const bits = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) bits.set(b.bits.subarray((y + y0) * b.cols + x0, (y + y0) * b.cols + x0 + cols), y * cols);
  return { cols, rows, bits };
}
function coverage(rgba, cols, rows, s) {
  const out = new Float32Array(cols * rows);
  const W = cols * s;
  const n = s * s * 255 * 255;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let acc = 0;
      for (let yy = 0; yy < s; yy++) {
        let p = ((y * s + yy) * W + x * s) * 4;
        for (let xx = 0; xx < s; xx++, p += 4) {
          const luma = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
          acc += luma * rgba[p + 3];
        }
      }
      out[y * cols + x] = acc / n;
    }
  }
  return out;
}
function dotRank(i) {
  let h = i + 2654435769 | 0;
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const OFFICIAL_CADUCEUS = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⡀⠀⣀⣀⠀⢀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢀⣠⣴⣾⣿⣿⣇⠸⣿⣿⠇⣸⣿⣿⣷⣦⣄⡀⠀⠀⠀⠀⠀⠀
⠀⢀⣠⣴⣶⠿⠋⣩⡿⣿⡿⠻⣿⡇⢠⡄⢸⣿⠟⢿⣿⢿⣍⠙⠿⣶⣦⣄⡀⠀
⠀⠀⠉⠉⠁⠶⠟⠋⠀⠉⠀⢀⣈⣁⡈⢁⣈⣁⡀⠀⠉⠀⠙⠻⠶⠈⠉⠉⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣴⣿⡿⠛⢁⡈⠛⢿⣿⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠿⣿⣦⣤⣈⠁⢠⣴⣿⠿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠻⢿⣿⣦⡉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢷⣦⣈⠛⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣴⠦⠈⠙⠿⣦⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣿⣤⡈⠁⢤⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠷⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⠑⢶⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠁⢰⡆⠈⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠳⠈⣡⠞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`;
const ink = (v) => `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`;
const BLACK = "#000";
const rad = (deg) => deg * Math.PI / 180;
function feather(g, x, y, deg, len, wid, shade, gap = 2.2, curl = 0) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  const P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  g.beginPath();
  g.moveTo(...P(0, -wid * 0.42));
  g.bezierCurveTo(...P(len * 0.3, -wid * 0.62), ...P(len * 0.75, -wid * 0.4 + curl), ...P(len, curl));
  g.bezierCurveTo(...P(len * 0.78, wid * 0.42 + curl), ...P(len * 0.3, wid * 0.6), ...P(0, wid * 0.42));
  g.arc(x, y, wid * 0.42, a + Math.PI / 2, a + Math.PI * 1.5);
  g.closePath();
  g.lineJoin = "round";
  g.lineWidth = gap;
  g.strokeStyle = BLACK;
  g.stroke();
  const grad = g.createLinearGradient(...P(0, 0), ...P(len, 0));
  grad.addColorStop(0, ink(shade));
  grad.addColorStop(1, ink(shade * 0.9));
  g.fillStyle = grad;
  g.fill();
}
function ellipse(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}
function radial(g, x, y, r, inner, outer) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, ink(inner));
  grad.addColorStop(1, ink(outer));
  return grad;
}
function line(g, pts, w, color) {
  g.beginPath();
  g.moveTo(...pts[0]);
  for (const p of pts.slice(1)) g.lineTo(...p);
  g.lineWidth = w;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = color;
  g.stroke();
}
function drawCaduceus(g) {
  const cx2 = 60;
  placeWing(g, cx2 - 4, 34, 0.44, -1, -4);
  placeWing(g, cx2 + 4, 34, 0.44, 1, -4);
  const y0 = 44, y1 = 124, turns = 2;
  const runs = [];
  const N = 160;
  for (const phase of [0, Math.PI]) {
    let run = null;
    for (let i = 0; i <= N; i++) {
      const t2 = i / N;
      const th = phase + Math.PI / 2 + t2 * turns * Math.PI * 2;
      const A = 18 - 9 * t2;
      const pt = { p: [cx2 + A * Math.sin(th), y0 + (y1 - y0) * t2], z: Math.cos(th), w: 8 - 4.4 * t2 };
      const front = pt.z >= 0;
      if (!run || run.front !== front) {
        const prev = run ? run.pts[run.pts.length - 1] : void 0;
        run = { front, pts: prev ? [prev] : [] };
        runs.push(run);
      }
      run.pts.push(pt);
    }
  }
  const paintRun = (pts, front) => {
    for (let i = 1; i < pts.length; i++) line(g, [pts[i - 1].p, pts[i].p], pts[i].w + 3.2, BLACK);
    for (let i = 1; i < pts.length; i++) {
      const z = pts[i].z;
      line(g, [pts[i - 1].p, pts[i].p], pts[i].w, ink(front ? 1 : 0.5 + 0.15 * (1 + z)));
    }
  };
  for (const r of runs) if (!r.front) paintRun(r.pts, false);
  g.fillStyle = BLACK;
  g.fillRect(cx2 - 4, 20, 8, 112);
  const staff = g.createLinearGradient(cx2 - 3, 0, cx2 + 3, 0);
  staff.addColorStop(0, ink(0.7));
  staff.addColorStop(0.45, ink(1));
  staff.addColorStop(1, ink(0.75));
  g.fillStyle = staff;
  g.beginPath();
  g.moveTo(cx2 - 2.6, 20);
  g.lineTo(cx2 + 2.6, 20);
  g.lineTo(cx2 + 1.8, 128);
  g.lineTo(cx2, 132);
  g.lineTo(cx2 - 1.8, 128);
  g.closePath();
  g.fill();
  for (const r of runs) if (r.front) paintRun(r.pts, true);
  for (const side of [-1, 1]) {
    const hx = cx2 + side * 18, hy = y0 - 1;
    g.save();
    g.translate(hx, hy);
    g.scale(-side, 1);
    g.beginPath();
    g.moveTo(-2, -4.6);
    g.bezierCurveTo(4, -6.2, 9, -3.4, 10.5, -0.6);
    g.bezierCurveTo(9.5, 2.2, 4, 3.8, -2, 4.2);
    g.closePath();
    g.lineWidth = 2.6;
    g.strokeStyle = BLACK;
    g.stroke();
    g.fillStyle = ink(1);
    g.fill();
    ellipse(g, 4.2, -1.4, 1.3, 1.1, BLACK);
    g.restore();
  }
  ellipse(g, cx2, 16, 7.6, 7.6, BLACK);
  ellipse(g, cx2, 16, 6, 6, radial(g, cx2 - 2, 14, 8, 1, 0.6));
  ellipse(g, cx2, 7.4, 3.2, 3, ink(0.9));
}
function drawTalaria(g) {
  g.translate(12, -6);
  g.beginPath();
  g.moveTo(31, 30);
  g.bezierCurveTo(31, 25, 52, 25, 52, 30);
  g.bezierCurveTo(52, 40, 55, 46, 66, 52);
  g.bezierCurveTo(80, 60, 100, 62, 113, 66);
  g.bezierCurveTo(119, 68, 119, 76, 112, 77);
  g.lineTo(28, 77);
  g.bezierCurveTo(22, 77, 22, 68, 26, 60);
  g.bezierCurveTo(29, 50, 31, 40, 31, 30);
  g.closePath();
  const foot = g.createLinearGradient(30, 26, 100, 76);
  foot.addColorStop(0, ink(1));
  foot.addColorStop(1, ink(0.97));
  g.fillStyle = foot;
  g.fill();
  g.save();
  g.clip();
  for (const [a, b] of [
    [[24, 38], [58, 36]],
    [[26, 58], [68, 66]],
    [[26, 70], [64, 54]],
    [[66, 54], [82, 78]],
    [[86, 59], [98, 78]]
  ]) {
    line(g, [a, b], 3, BLACK);
  }
  g.restore();
  g.beginPath();
  g.moveTo(22, 76);
  g.lineTo(112, 76);
  g.bezierCurveTo(121, 76, 123, 82, 116, 85);
  g.lineTo(26, 86);
  g.bezierCurveTo(18, 86, 17, 76, 22, 76);
  g.closePath();
  g.fillStyle = ink(1);
  g.fill();
  line(g, [[22, 76], [114, 76]], 2.6, BLACK);
  line(g, [[26, 81], [114, 81]], 1.6, BLACK);
  for (let i = 4; i >= 0; i--) {
    feather(g, 31, 58 - i * 5, 180 + i * 7.5, 30 + i * 7, 9.4, 0.96, 2.6, -2.6);
  }
  for (let i = 0; i < 3; i++) feather(g, 33, 55 - i * 5.5, 184 + i * 9, 14, 10, 1, 2.4, -1);
  ellipse(g, 32, 51, 5, 8, ink(1));
}
function drawPetasos(g) {
  const cx2 = 60;
  placeWing(g, cx2 - 20, 52, 0.4, -1, -14);
  placeWing(g, cx2 + 20, 52, 0.4, 1, -14);
  g.beginPath();
  g.ellipse(cx2, 66, 28, 36, 0, Math.PI, 0);
  g.closePath();
  g.lineWidth = 3;
  g.strokeStyle = BLACK;
  g.stroke();
  const dome = g.createRadialGradient(cx2 - 10, 40, 2, cx2, 56, 40);
  dome.addColorStop(0, ink(1));
  dome.addColorStop(0.55, ink(0.9));
  dome.addColorStop(1, ink(0.66));
  g.fillStyle = dome;
  g.fill();
  g.fillStyle = BLACK;
  g.fillRect(cx2 - 30, 58, 60, 8.5);
  g.fillStyle = ink(0.95);
  g.fillRect(cx2 - 28, 60.4, 56, 3.8);
  ellipse(g, cx2, 72, 58, 13, BLACK);
  const brim = g.createLinearGradient(0, 60, 0, 84);
  brim.addColorStop(0, ink(1));
  brim.addColorStop(1, ink(0.82));
  ellipse(g, cx2, 72, 56, 11.2, brim);
  g.beginPath();
  g.ellipse(cx2, 67.5, 29, 4.6, 0, 0, Math.PI);
  g.lineWidth = 2.4;
  g.strokeStyle = BLACK;
  g.stroke();
}
function drawLyre(g) {
  const cx2 = 50;
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t2 = i / 40;
      const u = 1 - t2;
      const p0 = [cx2 + side * 14, 92], p1 = [cx2 + side * 40, 76], p2 = [cx2 + side * 38, 30], p3 = [cx2 + side * 24, 14];
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t2 * p1[0] + 3 * u * t2 * t2 * p2[0] + t2 * t2 * t2 * p3[0],
        u * u * u * p0[1] + 3 * u * u * t2 * p1[1] + 3 * u * t2 * t2 * p2[1] + t2 * t2 * t2 * p3[1]
      ]);
    }
    line(g, pts, 10, BLACK);
    for (let i = 1; i < pts.length; i++) {
      const t2 = i / pts.length;
      line(g, [pts[i - 1], pts[i]], 7.2 - 3 * t2, ink(0.95 - 0.1 * t2));
    }
    line(g, [[cx2 + side * 24, 14], [cx2 + side * 29, 9], [cx2 + side * 33, 10]], 4, ink(1));
  }
  line(g, [[cx2 - 30, 24], [cx2 + 30, 24]], 8.4, BLACK);
  line(g, [[cx2 - 29, 24], [cx2 + 29, 24]], 5.2, ink(1));
  ellipse(g, cx2, 100, 28, 20, BLACK);
  ellipse(g, cx2, 100, 26, 18, radial(g, cx2 - 6, 94, 30, 1, 0.78));
  g.lineWidth = 2.4;
  g.strokeStyle = BLACK;
  for (const [x, y] of [[cx2, 94], [cx2 - 13, 103], [cx2 + 13, 103], [cx2, 108]]) {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = rad(30 + k * 60);
      const px = x + Math.cos(a) * 7.2, py = y + Math.sin(a) * 6.2;
      if (k) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = cx2 - 12 + i * 4;
    line(g, [[x, 26], [x + (x - cx2) * 0.15, 96]], 1.9, ink(1));
  }
  line(g, [[cx2 - 15, 96.5], [cx2 + 15, 96.5]], 4, BLACK);
  line(g, [[cx2 - 14, 96.5], [cx2 + 14, 96.5]], 2.4, ink(1));
}
function drawTortoise(g) {
  const cx2 = 55, cy2 = 54;
  ellipse(g, cx2, 12, 8.5, 10.5, radial(g, cx2 - 2, 9, 12, 1, 0.7));
  ellipse(g, cx2 - 3.4, 9, 1.4, 1.6, BLACK);
  ellipse(g, cx2 + 3.4, 9, 1.4, 1.6, BLACK);
  for (const [sx, sy, rot] of [[-1, -1, -0.6], [1, -1, 0.6], [-1, 1, 0.7], [1, 1, -0.7]]) {
    ellipse(g, cx2 + sx * 31, cy2 + sy * 24, 9.5, 13, ink(0.85), rot);
    for (let k = -1; k <= 1; k++) {
      const a = Math.atan2(sy, sx) + k * 0.36;
      ellipse(g, cx2 + sx * 31 + Math.cos(a) * 11, cy2 + sy * 24 + Math.sin(a) * 12, 1.8, 1.8, BLACK);
    }
  }
  g.beginPath();
  g.moveTo(cx2 - 4, cy2 + 34);
  g.lineTo(cx2, cy2 + 46);
  g.lineTo(cx2 + 4, cy2 + 34);
  g.fillStyle = ink(0.85);
  g.fill();
  ellipse(g, cx2, cy2, 33, 38, BLACK);
  ellipse(g, cx2, cy2, 31, 36, radial(g, cx2 - 8, cy2 - 10, 44, 0.95, 0.55));
  g.beginPath();
  g.ellipse(cx2, cy2, 25.5, 30.5, 0, 0, Math.PI * 2);
  g.lineWidth = 2.2;
  g.strokeStyle = BLACK;
  g.stroke();
  for (let k = 0; k < 22; k++) {
    const a = k / 22 * Math.PI * 2;
    line(g, [[cx2 + Math.cos(a) * 25.5, cy2 + Math.sin(a) * 30.5], [cx2 + Math.cos(a) * 31.5, cy2 + Math.sin(a) * 36.5]], 1.6, BLACK);
  }
  const hex = (x, y, rx, ry) => {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = rad(k * 60);
      const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
      if (k) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
    g.lineWidth = 2.4;
    g.strokeStyle = BLACK;
    g.fillStyle = radial(g, x - rx * 0.3, y - ry * 0.35, Math.max(rx, ry) * 1.3, 1, 0.62);
    g.fill();
    g.stroke();
  };
  for (const y of [cy2 - 18, cy2, cy2 + 18]) hex(cx2, y, 10.2, 9.4);
  for (const side of [-1, 1]) {
    hex(cx2 + side * 18.5, cy2 - 9, 8.6, 8.8);
    hex(cx2 + side * 18.5, cy2 + 9.5, 8.6, 8.8);
  }
}
function drawDrachma(g) {
  const cx2 = 50, cy2 = 50;
  g.beginPath();
  for (let k = 0; k <= 60; k++) {
    const a = k / 60 * Math.PI * 2;
    const r = 46.5 + 1.1 * Math.sin(a * 3 + 0.6) + 0.7 * Math.sin(a * 5);
    const px = cx2 + Math.cos(a) * r, py = cy2 + Math.sin(a) * r;
    if (k) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.closePath();
  g.lineWidth = 2.6;
  g.strokeStyle = ink(0.9);
  g.stroke();
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * Math.PI * 2;
    ellipse(g, cx2 + Math.cos(a) * 41, cy2 + Math.sin(a) * 41, 2.7, 2.7, ink(1));
  }
  g.save();
  g.beginPath();
  g.arc(cx2, cy2, 37, 0, Math.PI * 2);
  g.clip();
  g.translate(cx2 + 1, cy2 + 3);
  g.scale(1.12, 1.12);
  g.translate(-55, -58);
  const head = new Path2D(
    "M36 88 C38 80 38 73 35 67 C31 61 30 51 34 44 L68 43 L70 47 L77.5 59 L72.6 60.6 L73.8 63 L71 64.3 L72.8 66.5 L70 68.5 C72.2 71 71.6 74.4 68 75.6 C64.5 76.6 62 76.2 60.4 77.4 L61 88 Z"
  );
  g.lineJoin = "round";
  g.fillStyle = ink(1);
  g.fill(head);
  g.fillStyle = BLACK;
  g.beginPath();
  g.moveTo(62.6, 52.6);
  g.quadraticCurveTo(65.4, 50.4, 68, 52.4);
  g.quadraticCurveTo(65.2, 54, 62.6, 52.6);
  g.fill();
  line(g, [[61.6, 49.4], [68.4, 48.6]], 1.5, BLACK);
  g.beginPath();
  g.arc(47.5, 58, 3.6, rad(-60), rad(130));
  g.lineWidth = 1.8;
  g.strokeStyle = BLACK;
  g.stroke();
  line(g, [[36, 88], [61, 88]], 2, BLACK);
  placeWing(g, 44, 34, 0.3, -1, -30);
  g.beginPath();
  g.ellipse(53, 42, 17, 15, 0, Math.PI, 0);
  g.closePath();
  g.lineWidth = 2.4;
  g.strokeStyle = BLACK;
  g.stroke();
  g.fillStyle = ink(1);
  g.fill();
  ellipse(g, 53, 43.4, 26.5, 5.2, BLACK);
  ellipse(g, 53, 43, 25, 3.6, ink(1));
  g.restore();
}
function wingShape(g, k = 1) {
  const edge = (t2) => {
    const u = 1 - t2;
    const p0 = [8, 82], p1 = [20, 12], p2 = [70, 2], p3 = [100, 24];
    return [
      u * u * u * p0[0] + 3 * u * u * t2 * p1[0] + 3 * u * t2 * t2 * p2[0] + t2 * t2 * t2 * p3[0],
      u * u * u * p0[1] + 3 * u * u * t2 * p1[1] + 3 * u * t2 * t2 * p2[1] + t2 * t2 * t2 * p3[1]
    ];
  };
  const n = 11;
  for (let i = n - 1; i >= 0; i--) {
    const t2 = 0.12 + i / (n - 1) * 0.86;
    const [x, y] = edge(t2);
    feather(g, x, y + 6, 100 - t2 * 74, 24 + 22 * Math.sin(t2 * Math.PI * 0.62), 13, 0.9 - 0.12 * (1 - t2), 2 * k, 2);
  }
  for (let i = 9; i >= 0; i--) {
    const t2 = 0.08 + i / 9 * 0.8;
    const [x, y] = edge(t2);
    feather(g, x, y + 2, 96 - t2 * 80, 22 - 6 * t2, 9.5, 0.96, 2.2 * k, 1);
  }
  for (let i = 14; i >= 0; i--) {
    const t2 = 0.04 + i / 14 * 0.78;
    const [x, y] = edge(t2);
    feather(g, x, y, 92 - t2 * 76, 10.5, 7.4, 1, 1.9 * k, 0);
  }
  const pts = [];
  for (let i = 0; i <= 30; i++) pts.push(edge(i / 30 * 0.86));
  line(g, pts, 4.2 * Math.min(k, 1.6), ink(1));
}
function placeWing(g, x, y, s, side, deg) {
  g.save();
  g.translate(x, y);
  g.scale(side, 1);
  g.rotate(rad(deg));
  g.scale(s, s);
  g.translate(-8, -82);
  wingShape(g, Math.min(2.2, 0.7 / s));
  g.restore();
}
function drawWing(g) {
  wingShape(g);
}
const EMBLEMS = {
  "caduceus": { kind: "braille", art: OFFICIAL_CADUCEUS },
  "winged-caduceus": { kind: "vector", w: 120, h: 134, dither: "fs", draw: drawCaduceus },
  "talaria": { kind: "vector", w: 136, h: 84, dither: "fs", draw: drawTalaria },
  "petasos": { kind: "vector", w: 120, h: 88, dither: "fs", draw: drawPetasos },
  "lyre": { kind: "vector", w: 100, h: 124, dither: "fs", draw: drawLyre },
  "tortoise": { kind: "vector", w: 110, h: 104, dither: "fs", draw: drawTortoise },
  "drachma": { kind: "vector", w: 100, h: 100, dither: "fs", draw: drawDrachma },
  "wing": { kind: "vector", w: 146, h: 112, dither: "fs", draw: drawWing }
};
const SUPER = 4;
const bitmapCache = /* @__PURE__ */ new Map();
function inkRows(bits, cols, rows) {
  let top = rows, bottom = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (bits[y * cols + x]) {
        if (y < top) top = y;
        bottom = y;
        break;
      }
    }
  }
  return bottom < 0 ? [0, rows - 1] : [top, bottom];
}
function rasterize(e, w, h, dpr) {
  if (w < 8 || h < 8) return null;
  if (e.kind === "braille") {
    let bm = bitmapCache.get(e.art);
    if (!bm) {
      bm = trimBits(brailleToBits(e.art));
      bitmapCache.set(e.art, bm);
    }
    const cols2 = bm.cols + 2, rows2 = bm.rows + 2;
    const grid2 = fitGrid(w, h, dpr, { cols: cols2, rows: rows2 });
    const bits2 = new Uint8Array(cols2 * rows2);
    for (let y = 0; y < bm.rows; y++) bits2.set(bm.bits.subarray(y * bm.cols, (y + 1) * bm.cols), (y + 1) * cols2 + 1);
    const [top2, bottom2] = inkRows(bits2, cols2, rows2);
    return { ...grid2, bits: bits2, top: top2, bottom: bottom2 };
  }
  const grid = fitGrid(w, h, dpr, { target: 72, minCss: 2.8, maxCss: 4.2 });
  const { cols, rows } = grid;
  if (cols < 4 || rows < 4) return null;
  const off = document.createElement("canvas");
  off.width = cols * SUPER;
  off.height = rows * SUPER;
  const g = off.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.fillStyle = "#000";
  g.fillRect(0, 0, off.width, off.height);
  const box2 = fitBox(e.w, e.h, cols, rows, 1);
  g.setTransform(box2.s * SUPER, 0, 0, box2.s * SUPER, box2.x * SUPER, box2.y * SUPER);
  e.draw(g);
  const lum = coverage(g.getImageData(0, 0, off.width, off.height).data, cols, rows, SUPER);
  const bits = e.dither === "bayer" ? bayerDither(lum, cols, rows) : floydSteinberg(lum, cols, rows);
  const [top, bottom] = inkRows(bits, cols, rows);
  return { ...grid, bits, top, bottom };
}
function paint(canvas, r, c, s) {
  const g = canvas.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const { pitch, cols, rows, ox, oy, bits } = r;
  const y0 = oy + r.top * pitch, y1 = oy + (r.bottom + 1) * pitch;
  const grad = g.createLinearGradient(0, y0, 0, Math.max(y0 + 1, y1));
  grad.addColorStop(0, c.dim);
  grad.addColorStop(0.4, c.accent);
  grad.addColorStop(0.6, c.accent);
  grad.addColorStop(1, c.dim);
  const round2 = pitch >= 5;
  const size = round2 ? pitch * 0.34 : Math.max(1, Math.round(pitch * 0.67));
  const inset = Math.floor((pitch - size) / 2);
  const band = 0.09;
  const span = cols + rows * 0.7;
  const base = new Path2D(), hot = new Path2D();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!bits[i]) continue;
      if (s.reveal < 1 && dotRank(i) >= s.reveal) continue;
      const lit = s.glint !== null && Math.abs((x + y * 0.7) / span - s.glint) < band;
      const p = lit ? hot : base;
      if (round2) {
        const cx2 = ox + (x + 0.5) * pitch, cy2 = oy + (y + 0.5) * pitch;
        p.moveTo(cx2 + size, cy2);
        p.arc(cx2, cy2, size, 0, Math.PI * 2);
      } else {
        p.rect(ox + x * pitch + inset, oy + y * pitch + inset, size, size);
      }
    }
  }
  g.fillStyle = grad;
  g.fill(base);
  if (s.glint !== null) {
    g.fillStyle = c.glint;
    g.fill(hot);
  }
}
function parseRgb(color) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function readColors(el) {
  const accent = getComputedStyle(el).color || "rgb(255, 215, 0)";
  const rgb = parseRgb(accent) ?? [255, 215, 0];
  const mix = (k, to) => rgb.map((v) => Math.round(v * k + to * (1 - k))).join(",");
  return { accent, dim: `rgb(${mix(0.55, 0)})`, glint: `rgb(${mix(0.45, 255)})` };
}
const REVEAL_MS = 520;
const GLINT_MS = 1700;
const GLINT_EVERY_MS = 15e3;
function AsciiWidget({ status, widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const version = status?.version;
  const id = emblemFromProps(widgetProps);
  const slotRef = useRef(null);
  const canvasRef = useRef(null);
  const [noCanvas, setNoCanvas] = useState(false);
  const label = t2(`ascii.art.${id}`);
  useEffect(() => {
    const slot = slotRef.current, canvas = canvasRef.current;
    if (!slot || !canvas) return;
    if (!canvas.getContext("2d")) {
      setNoCanvas(true);
      return;
    }
    return mountEmblem(slot, canvas, id);
  }, [id]);
  return /* @__PURE__ */ jsxs("div", { className: "home-ascii-wrap", children: [
    /* @__PURE__ */ jsx(
      HoverArrows,
      {
        onPrev: () => onWidgetPropsChange(stepEmblem(widgetProps, -1)),
        onNext: () => onWidgetPropsChange(stepEmblem(widgetProps, 1)),
        label
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "home-emblem", ref: slotRef, children: noCanvas ? /* @__PURE__ */ jsx("div", { className: "home-ascii", children: OFFICIAL_CADUCEUS }) : /* @__PURE__ */ jsx("canvas", { ref: canvasRef, role: "img", "aria-label": label }) }),
    /* @__PURE__ */ jsxs("div", { className: "home-ascii-ver", children: [
      "HERMES-AGENT",
      version ? ` · v${version}` : ""
    ] })
  ] });
}
function mountEmblem(slot, canvas, id) {
  const emblem = EMBLEMS[id];
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const motion = () => !motionQuery?.matches;
  let raster = null;
  let colors = readColors(canvas);
  let reveal = motion() ? 0 : 1;
  let glint = null;
  let visible = true;
  let raf = 0, layoutRaf = 0, timer = 0;
  let sized = "";
  const draw = () => {
    if (raster) paint(canvas, raster, colors, { reveal, glint });
  };
  const layout = () => {
    layoutRaf = 0;
    const r = slot.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const key = `${Math.round(r.width)}x${Math.round(r.height)}@${dpr}`;
    if (key === sized) return;
    sized = key;
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    raster = rasterize(emblem, r.width, r.height, dpr);
    draw();
  };
  const animate = (ms, step, done) => {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      step(p);
      draw();
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        done();
      }
    };
    raf = requestAnimationFrame(tick);
  };
  const scheduleGlint = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!motion() || !visible || document.hidden || !raster) {
        scheduleGlint();
        return;
      }
      animate(GLINT_MS, (p) => {
        glint = -0.15 + 1.3 * p;
      }, () => {
        glint = null;
        draw();
        scheduleGlint();
      });
    }, GLINT_EVERY_MS);
  };
  layout();
  if (reveal < 1) {
    animate(REVEAL_MS, (p) => {
      reveal = 1 - (1 - p) ** 3;
    }, () => {
      reveal = 1;
      scheduleGlint();
    });
  } else {
    scheduleGlint();
  }
  const ro = new ResizeObserver(() => {
    if (!layoutRaf) layoutRaf = requestAnimationFrame(layout);
  });
  ro.observe(slot);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  });
  io.observe(slot);
  const mo = new MutationObserver(() => {
    const next = readColors(canvas);
    if (next.accent !== colors.accent) {
      colors = next;
      draw();
    }
  });
  for (const el of [document.documentElement, document.body]) {
    mo.observe(el, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  }
  const onMotion = () => {
    if (!motion()) {
      cancelAnimationFrame(raf);
      raf = 0;
      reveal = 1;
      glint = null;
      draw();
    }
  };
  motionQuery?.addEventListener?.("change", onMotion);
  return () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(layoutRaf);
    clearTimeout(timer);
    ro.disconnect();
    io.disconnect();
    mo.disconnect();
    motionQuery?.removeEventListener?.("change", onMotion);
  };
}
function ClockWidget({ widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const is12 = widgetProps.format === "12";
  const showSeconds = widgetProps.showSeconds === true;
  const [now, setNow] = useState(() => /* @__PURE__ */ new Date());
  useEffect(() => {
    const t22 = setInterval(() => setNow(/* @__PURE__ */ new Date()), showSeconds ? 1e3 : 5e3);
    return () => clearInterval(t22);
  }, [showSeconds]);
  const set = (patch) => onWidgetPropsChange({ ...widgetProps, ...patch });
  let h = now.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  if (is12) {
    h = h % 12 || 12;
  }
  const hh = String(h).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return /* @__PURE__ */ jsxs("div", { className: "home-clock-wrap", children: [
    /* @__PURE__ */ jsxs(HoverCtl, { children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "hv-opt",
          onClick: () => set({ format: is12 ? "24" : "12" }),
          title: t2("clock.formatTitle"),
          children: is12 ? "12h" : "24h"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `hv-opt${showSeconds ? " on" : ""}`,
          onClick: () => set({ showSeconds: !showSeconds }),
          title: t2("clock.secondsTitle"),
          children: t2("clock.seconds")
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "home-clock", children: [
      hh,
      ":",
      mm,
      showSeconds && /* @__PURE__ */ jsxs(Fragment, { children: [
        ":",
        ss
      ] }),
      is12 && /* @__PURE__ */ jsx("span", { className: "home-clock-ampm", children: ampm })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "home-clock-sub", children: fmtDate(now, { weekday: "long", day: "numeric", month: "long" }) })
  ] });
}
function matrixRows(height, rowH) {
  const rows = Math.max(0, Math.floor(height / rowH));
  return { rows, paintHeight: rows * rowH };
}
const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01☿";
const COL_W = 13;
const ROW_H = 14;
const TICK_MS$1 = 66;
const SPEEDS$1 = [0.5, 1, 2];
function MatrixWidget({ widgetProps, onWidgetPropsChange }) {
  const ref = useRef(null);
  const speedRef = useRef(1);
  const speed = typeof widgetProps.speed === "number" ? widgetProps.speed : 1;
  speedRef.current = speed;
  const stepSpeed = (dir) => {
    const i = (SPEEDS$1.indexOf(speed) + dir + SPEEDS$1.length) % SPEEDS$1.length;
    onWidgetPropsChange({ ...widgetProps, speed: SPEEDS$1[i] });
  };
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let drops = [];
    let accent = "#d4af37";
    const fit = () => {
      const slot = cv.parentElement.getBoundingClientRect();
      const avail = slot.height - cv.offsetTop - 6;
      const { paintHeight } = matrixRows(avail, ROW_H);
      cv.width = Math.max(10, Math.floor(slot.width));
      cv.height = Math.max(ROW_H, paintHeight);
      cv.style.height = `${cv.height}px`;
      accent = getComputedStyle(cv).getPropertyValue("--home-accent").trim() || accent;
      drops = Array.from(
        { length: Math.floor(cv.width / COL_W) },
        () => Math.floor(Math.random() * -30)
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv.parentElement);
    const t2 = setInterval(() => {
      if (document.hidden) return;
      const step = speedRef.current;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.font = "12px monospace";
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() < 0.12 ? "#ffffff" : accent;
        ctx.fillText(
          GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          i * COL_W,
          y * ROW_H
        );
        drops[i] = y * ROW_H > cv.height && Math.random() > 0.975 ? 0 : y + step;
      });
    }, TICK_MS$1);
    return () => {
      ro.disconnect();
      clearInterval(t2);
    };
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      HoverArrows,
      {
        onPrev: () => stepSpeed(-1),
        onNext: () => stepSpeed(1),
        label: `${speed}×`
      }
    ),
    /* @__PURE__ */ jsx("canvas", { ref, className: "home-matrix-c" })
  ] });
}
const GATEWAY_STATES = [
  "running",
  "starting",
  "stopped",
  "startup_failed",
  "draining",
  "connected",
  "connecting",
  "disconnected",
  "degraded",
  "disabled",
  "fatal",
  "paused",
  "retrying",
  "error"
];
const KNOWN = new Set(GATEWAY_STATES);
function stateLabel(t2, raw) {
  if (!raw) return "—";
  return KNOWN.has(raw) ? t2(`gateway.s.${raw}`) : raw;
}
function hostOf$1(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
function Row$2({ label, val }) {
  return /* @__PURE__ */ jsxs("div", { className: "row", children: [
    /* @__PURE__ */ jsx("span", { className: "dim", children: label }),
    /* @__PURE__ */ jsx("span", { children: val })
  ] });
}
function GatewayWidget({ status }) {
  const t2 = useT();
  if (!status) return /* @__PURE__ */ jsx("span", { className: "dim", children: t2("common.loading") });
  const platforms = Object.entries(status.gateway_platforms ?? {});
  const configStr = `v${status.config_version}${status.config_version !== status.latest_config_version ? ` → v${status.latest_config_version}` : ""}`;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: t2("gateway.status") }),
        /* @__PURE__ */ jsx("span", { className: status.gateway_running ? "ok" : "werr", children: status.gateway_running ? t2("gateway.online") : t2("gateway.offline") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: t2("gateway.state") }),
        /* @__PURE__ */ jsx("span", { children: stateLabel(t2, status.gateway_state) })
      ] }),
      platforms.map(([name, p]) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: name }),
        /* @__PURE__ */ jsx("span", { className: p.state === "running" || p.state === "connected" ? "ok" : "dim", children: stateLabel(t2, p.state) })
      ] }, name))
    ] }),
    /* @__PURE__ */ jsx("div", { className: "hover-reveal", children: /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      status.gateway_pid != null && /* @__PURE__ */ jsx(Row$2, { label: t2("gateway.pid"), val: String(status.gateway_pid) }),
      status.gateway_exit_reason && /* @__PURE__ */ jsx(Row$2, { label: t2("gateway.exit"), val: status.gateway_exit_reason.slice(0, 28) }),
      status.gateway_health_url && /* @__PURE__ */ jsx(Row$2, { label: t2("gateway.health"), val: hostOf$1(status.gateway_health_url) }),
      /* @__PURE__ */ jsx(Row$2, { label: t2("gateway.config"), val: configStr }),
      /* @__PURE__ */ jsx(Row$2, { label: t2("gateway.version"), val: `v${status.version}` })
    ] }) })
  ] });
}
function formatTokenCount(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return String(n);
}
const SESSION_SORTS = ["recent", "tokens"];
const TOKEN_FLOORS = [0, 1e4, 1e5, 1e6];
function coerceSessionSort(value) {
  return SESSION_SORTS.includes(value) ? value : "recent";
}
function coerceTokenFloor(value) {
  return TOKEN_FLOORS.includes(value) ? value : 0;
}
function sessionTokens(s) {
  return (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
}
function arrangeSessions(sessions, sort, minTokens) {
  const kept = sessions.map((s, i) => ({ s, i })).filter(({ s }) => sessionTokens(s) >= minTokens);
  if (sort === "tokens") {
    kept.sort((a, b) => sessionTokens(b.s) - sessionTokens(a.s) || a.i - b.i);
  }
  return kept.map(({ s }) => s);
}
const PER_PAGE$1 = 3;
function SessionsWidget({ status, sessions, widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const [page, setPage] = useState(0);
  if (!status && !sessions) return /* @__PURE__ */ jsx("span", { className: "dim", children: t2("common.loading") });
  const sort = coerceSessionSort(widgetProps.sort);
  const minTokens = coerceTokenFloor(widgetProps.minTokens);
  const setProp = (patch) => {
    setPage(0);
    onWidgetPropsChange({ ...widgetProps, ...patch });
  };
  const nextSort = () => setProp({ sort: SESSION_SORTS[(SESSION_SORTS.indexOf(sort) + 1) % SESSION_SORTS.length] });
  const nextFloor = () => setProp({ minTokens: TOKEN_FLOORS[(TOKEN_FLOORS.indexOf(minTokens) + 1) % TOKEN_FLOORS.length] });
  const all = arrangeSessions(sessions?.sessions ?? [], sort, minTokens);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE$1));
  const p = Math.min(page, pages - 1);
  const slice = all.slice(p * PER_PAGE$1, p * PER_PAGE$1 + PER_PAGE$1);
  const showTokens = sort === "tokens" || minTokens > 0;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(HoverCtl, { className: "tok-ctl", children: [
      pages > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "hv-arrow",
            "aria-label": t2("common.previous"),
            disabled: p <= 0,
            onClick: () => setPage(Math.max(0, p - 1)),
            children: "‹"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "hv-label", children: [
          p + 1,
          "/",
          pages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "hv-arrow",
            "aria-label": t2("common.next"),
            disabled: p >= pages - 1,
            onClick: () => setPage(Math.min(pages - 1, p + 1)),
            children: "›"
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "tok-div" })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `hv-opt${sort === "tokens" ? " on" : ""}`,
          onClick: nextSort,
          title: t2("sessions.sortTitle"),
          "data-sort": sort,
          children: t2(`sessions.sort.${sort}`)
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `hv-opt${minTokens > 0 ? " on" : ""}`,
          onClick: nextFloor,
          title: t2("sessions.filterTitle"),
          "data-min-tokens": minTokens,
          children: minTokens > 0 ? `≥${formatTokenCount(minTokens)}` : t2("sessions.filter.all")
        }
      )
    ] }),
    /* @__PURE__ */ jsx("span", { className: "bigval", children: status?.active_sessions ?? "—" }),
    /* @__PURE__ */ jsxs("span", { className: "dim", children: [
      " ",
      t2("sessions.active")
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      slice.length === 0 && minTokens > 0 && /* @__PURE__ */ jsx("span", { className: "dim", children: t2("sessions.noneMatch", { n: formatTokenCount(minTokens) }) }),
      slice.map((s) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim row-name", title: s.title ?? s.source ?? s.id, children: s.title ?? s.source ?? s.id }),
        showTokens && /* @__PURE__ */ jsx(
          "span",
          {
            className: "ses-tok",
            title: t2("sessions.tokensTitle", {
              input: formatTokenCount(s.input_tokens ?? 0),
              output: formatTokenCount(s.output_tokens ?? 0)
            }),
            children: formatTokenCount(sessionTokens(s))
          }
        ),
        /* @__PURE__ */ jsx("span", { className: s.is_active ? "ok" : "dim", children: s.is_active ? t2("sessions.live") : t2("sessions.idle") })
      ] }, s.id))
    ] })
  ] });
}
class TimeoutError extends Error {
  constructor(ms) {
    super(`no response after ${ms} ms`);
    this.name = "TimeoutError";
  }
}
function withTimeout(run, ms) {
  return new Promise((resolve2, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    let p;
    try {
      p = run();
    } catch (e) {
      clearTimeout(timer);
      reject(e);
      return;
    }
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve2(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Cancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "Cancelled";
  }
}
async function fetchRetry(run, opts = {}) {
  const { timeoutMs = 12e3, tries = 3, backoffMs = 800, cancelled } = opts;
  let last;
  for (let n = 1; n <= tries; n++) {
    if (cancelled?.()) throw new Cancelled();
    try {
      return await withTimeout(run, timeoutMs);
    } catch (e) {
      last = e;
      if (n < tries) await sleep(backoffMs * n);
    }
  }
  if (cancelled?.()) throw new Cancelled();
  throw last;
}
const runtimeFmt = (date, options) => date.toLocaleDateString(void 0, options);
const GROUP_MODES = ["off", "provider", "model"];
function coerceGroupBy(value) {
  return GROUP_MODES.includes(value) ? value : "off";
}
function groupUsage(rows, by) {
  const acc = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const key = ((by === "provider" ? r.provider : r.model) ?? "").trim();
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    const cost = r.estimated_cost ?? 0;
    const cur = acc.get(key) ?? { tokens: 0, cost: 0 };
    cur.tokens += Number.isFinite(tokens) ? tokens : 0;
    cur.cost += Number.isFinite(cost) ? cost : 0;
    acc.set(key, cur);
  }
  const total = [...acc.values()].reduce((n, g) => n + g.tokens, 0);
  return [...acc.entries()].filter(([, g]) => g.tokens > 0 || g.cost > 0).map(([key, g]) => ({ key, ...g, share: total > 0 ? g.tokens / total * 100 : 0 })).sort((a, b) => b.tokens - a.tokens || b.cost - a.cost || a.key.localeCompare(b.key));
}
function parseDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(day);
}
function toBars(daily, byMonth, fmtDate2 = runtimeFmt) {
  if (!byMonth) {
    return daily.map((d) => {
      const date = parseDay(d.day);
      const label = isNaN(date.getTime()) ? d.day : fmtDate2(date, { month: "short", day: "numeric" });
      return { key: d.day, label, tokens: d.input_tokens + d.output_tokens, cost: d.estimated_cost };
    });
  }
  const months = /* @__PURE__ */ new Map();
  for (const d of daily) {
    const date = parseDay(d.day);
    const valid = !isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : d.day.slice(0, 7);
    const label = valid ? fmtDate2(date, { month: "short" }) : key;
    const sort = valid ? date.getFullYear() * 12 + date.getMonth() : 0;
    const cur = months.get(key) ?? { key, label, tokens: 0, cost: 0, sort };
    cur.tokens += d.input_tokens + d.output_tokens;
    cur.cost += d.estimated_cost;
    months.set(key, cur);
  }
  return [...months.values()].sort((a, b) => a.sort - b.sort).map(({ sort, ...b }) => b);
}
const RANGES = [
  { key: "week", label: "tokens.range.week", days: 7, byMonth: false },
  { key: "month", label: "tokens.range.month", days: 30, byMonth: false },
  { key: "halfyear", label: "tokens.range.halfyear", days: 180, byMonth: true }
];
let gradSeq$1 = 0;
function breakdownCap(gh) {
  return Math.max(2, Math.min(8, gh * 2 - 5));
}
function TokensWidget({ analytics, widgetProps, onWidgetPropsChange, gridSize }) {
  const t2 = useT();
  const rangeKey = RANGES.find((r) => r.key === widgetProps.range)?.key ?? "week";
  const range = RANGES.find((r) => r.key === rangeKey);
  const idx2 = RANGES.findIndex((r) => r.key === rangeKey);
  const chart = widgetProps.chart === "bars" ? "bars" : "line";
  const statsOn = widgetProps.stats !== false;
  const group = coerceGroupBy(widgetProps.group);
  const [gid] = useState(() => `tok-grad-${gradSeq$1++}`);
  const [fetched, setFetched] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState(null);
  const [show2, setShow] = useState(false);
  const [models, setModels] = useState(null);
  const [modelsFailed, setModelsFailed] = useState(false);
  useEffect(() => {
    if (group === "off") return;
    let cancelled = false;
    setModels(null);
    setModelsFailed(false);
    fetchRetry(() => api.getModelsAnalytics(range.days), { cancelled: () => cancelled }).then((r) => {
      if (!cancelled) setModels(Array.isArray(r?.models) ? r.models : []);
    }).catch((e) => {
      if (!cancelled && !(e instanceof Cancelled)) setModelsFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [group, range.days]);
  useEffect(() => {
    let cancelled = false;
    let retry;
    setFetched(null);
    setFailed(false);
    const load = () => {
      fetchRetry(() => api.getAnalytics(range.days), { cancelled: () => cancelled }).then((r) => {
        if (!cancelled) {
          setFetched(r);
          setFailed(false);
        }
      }).catch((e) => {
        if (cancelled || e instanceof Cancelled) return;
        setFailed(true);
        retry = setTimeout(load, 2e4);
      });
    };
    load();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [range.days]);
  const setProp = (patch) => onWidgetPropsChange({ ...widgetProps, ...patch });
  const cycle = (dir) => setProp({ range: RANGES[(idx2 + dir + RANGES.length) % RANGES.length].key });
  const cycleGroup = () => setProp({ group: GROUP_MODES[(GROUP_MODES.indexOf(group) + 1) % GROUP_MODES.length] });
  const controls = /* @__PURE__ */ jsxs(HoverCtl, { className: "tok-ctl", children: [
    /* @__PURE__ */ jsx("button", { className: "hv-arrow", "aria-label": t2("common.previous"), onClick: () => cycle(-1), children: "‹" }),
    /* @__PURE__ */ jsx("span", { className: "hv-label", children: t2(range.label) }),
    /* @__PURE__ */ jsx("button", { className: "hv-arrow", "aria-label": t2("common.next"), onClick: () => cycle(1), children: "›" }),
    /* @__PURE__ */ jsx("span", { className: "tok-div" }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `hv-opt${chart === "line" ? " on" : ""}`,
        onClick: () => setProp({ chart: chart === "line" ? "bars" : "line" }),
        title: t2("tokens.lineTitle"),
        children: t2("tokens.line")
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `hv-opt${statsOn ? " on" : ""}`,
        onClick: () => setProp({ stats: !statsOn }),
        title: t2("tokens.totalsTitle"),
        children: t2("tokens.totals")
      }
    ),
    /* @__PURE__ */ jsx("span", { className: "tok-div" }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `hv-opt${group !== "off" ? " on" : ""}`,
        onClick: cycleGroup,
        title: t2("tokens.groupTitle"),
        "data-group": group,
        children: t2(`tokens.group.${group}`)
      }
    )
  ] });
  const view = fetched ?? (failed ? analytics : null);
  const bars = useMemo(
    () => toBars(view?.daily ?? [], range.byMonth, fmtDate),
    [view, range.byMonth, t2]
  );
  const fallback = group !== "off" && modelsFailed;
  const groups = useMemo(() => {
    if (group === "off") return null;
    if (models) return groupUsage(models, group);
    if (modelsFailed && view) return groupUsage(view.by_model ?? [], "model");
    return null;
  }, [group, models, modelsFailed, view]);
  if (!view) {
    return /* @__PURE__ */ jsxs("div", { children: [
      controls,
      /* @__PURE__ */ jsx("span", { className: "dim", children: failed ? t2("common.unavailable") : t2("common.loading") })
    ] });
  }
  const tot = view.totals;
  const total = tot.total_input + tot.total_output;
  const n = bars.length;
  const max = Math.max(1, ...bars.map((b) => b.tokens));
  const H = 100, W = 100, PAD2 = 3;
  const coords = bars.map((b, i) => [
    n <= 1 ? W / 2 : i / (n - 1) * W,
    H - PAD2 - b.tokens / max * (H - PAD2 * 2)
  ]);
  const linePath = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath2 = n ? `${linePath} L${coords[n - 1][0].toFixed(2)},${H} L${coords[0][0].toFixed(2)},${H} Z` : "";
  return /* @__PURE__ */ jsxs("div", { children: [
    controls,
    /* @__PURE__ */ jsx("span", { className: "bigval", children: formatTokenCount(total) }),
    /* @__PURE__ */ jsxs("span", { className: "dim", children: [
      " ",
      t2(range.label),
      failed ? ` · ${t2("tokens.dayFallback")}` : ""
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "home-spark-wrap", onMouseLeave: () => setShow(false), children: [
      tip && /* @__PURE__ */ jsxs(
        "div",
        {
          className: `home-spark-tip${show2 ? " show" : ""}`,
          style: { left: `${tip.frac * 100}%`, transform: `translateX(${-tip.frac * 100}%)` },
          children: [
            /* @__PURE__ */ jsx("b", { children: tip.bar.label }),
            " · ",
            formatTokenCount(tip.bar.tokens),
            demoOn() ? "" : ` · $${tip.bar.cost.toFixed(2)}`
          ]
        }
      ),
      chart === "line" ? /* @__PURE__ */ jsxs("svg", { className: "home-area", viewBox: "0 0 100 100", preserveAspectRatio: "none", children: [
        /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ jsx("stop", { offset: "0%", style: { stopColor: "var(--home-accent)", stopOpacity: 0.5 } }),
          /* @__PURE__ */ jsx("stop", { offset: "100%", style: { stopColor: "var(--home-accent)", stopOpacity: 0 } })
        ] }) }),
        areaPath2 && /* @__PURE__ */ jsx("path", { d: areaPath2, fill: `url(#${gid})` }),
        linePath && /* @__PURE__ */ jsx(
          "path",
          {
            d: linePath,
            fill: "none",
            stroke: "var(--home-accent)",
            strokeWidth: 1.5,
            strokeLinejoin: "round",
            strokeLinecap: "round",
            vectorEffect: "non-scaling-stroke"
          }
        ),
        show2 && tip?.pt && /* @__PURE__ */ jsx("circle", { cx: tip.pt[0], cy: tip.pt[1], r: 2.4, fill: "var(--home-accent)", vectorEffect: "non-scaling-stroke" }),
        bars.map((b, i) => /* @__PURE__ */ jsx(
          "rect",
          {
            x: i * W / n,
            y: 0,
            width: W / n,
            height: H,
            fill: "transparent",
            onMouseEnter: () => {
              setTip({ bar: b, frac: n <= 1 ? 0.5 : i / (n - 1), pt: coords[i] });
              setShow(true);
            }
          },
          b.key
        ))
      ] }) : /* @__PURE__ */ jsx("div", { className: "home-spark", children: bars.map((b, i) => /* @__PURE__ */ jsx(
        "i",
        {
          onMouseEnter: () => {
            setTip({ bar: b, frac: (i + 0.5) / n });
            setShow(true);
          },
          style: { height: `${Math.max(8, b.tokens / max * 100)}%` }
        },
        b.key
      )) })
    ] }),
    statsOn && /* @__PURE__ */ jsxs("div", { className: "tok-stats", children: [
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: t2("tokens.in") }),
        " ",
        formatTokenCount(tot.total_input)
      ] }),
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: t2("tokens.out") }),
        " ",
        formatTokenCount(tot.total_output)
      ] }),
      !demoOn() && /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: t2("tokens.cost") }),
        " ",
        /* @__PURE__ */ jsxs("span", { className: "ok", children: [
          "$",
          tot.total_estimated_cost.toFixed(2)
        ] })
      ] })
    ] }),
    group !== "off" && /* @__PURE__ */ jsx(
      TokenBreakdown,
      {
        groups,
        cap: breakdownCap(gridSize.gh),
        note: fallback && group === "provider" ? t2("tokens.providerFallback") : null
      }
    )
  ] });
}
function TokenBreakdown({ groups, cap, note }) {
  const t2 = useT();
  if (!groups) return /* @__PURE__ */ jsx("div", { className: "tok-groups", children: /* @__PURE__ */ jsx("span", { className: "dim", children: t2("common.loading") }) });
  if (groups.length === 0) return /* @__PURE__ */ jsx("div", { className: "tok-groups", children: /* @__PURE__ */ jsx("span", { className: "dim", children: t2("tokens.groupEmpty") }) });
  const overflow = groups.length > cap;
  const shown = overflow ? groups.slice(0, cap - 1) : groups;
  return /* @__PURE__ */ jsxs("div", { className: "tok-groups", children: [
    note && /* @__PURE__ */ jsx("div", { className: "tok-group-note dim", children: note }),
    /* @__PURE__ */ jsx("div", { className: "rows", children: shown.map((g) => {
      const name = g.key || t2("tokens.unknownProvider");
      const share = Math.round(g.share);
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "row tok-group",
          style: { "--share": `${Math.max(1, Math.min(100, g.share))}%` },
          title: demoOn() ? void 0 : t2("tokens.rowTitle", {
            name,
            tokens: formatTokenCount(g.tokens),
            cost: g.cost.toFixed(2),
            share
          }),
          children: [
            /* @__PURE__ */ jsx("span", { className: "row-name", children: name }),
            /* @__PURE__ */ jsx("span", { children: formatTokenCount(g.tokens) }),
            /* @__PURE__ */ jsxs("span", { className: "dim tok-share", children: [
              share,
              "%"
            ] })
          ]
        },
        g.key || "\0"
      );
    }) }),
    overflow && /* @__PURE__ */ jsx("div", { className: "dim tok-group-more", children: t2("tokens.groupMore", { n: groups.length - shown.length }) })
  ] });
}
const MB$1 = 1024 ** 2;
const HOST_SIGNALS = [
  { key: "cpu", label: "cpu", fixedMax: 100, format: (v) => `${Math.round(v)}%` },
  { key: "ram", label: "ram", fixedMax: 100, format: (v) => `${Math.round(v)}%` },
  { key: "load", label: "load", fixedMax: void 0, format: (v) => v.toFixed(2) },
  { key: "proc", label: "proc", fixedMax: void 0, format: (v) => `${Math.round(v / MB$1)}M` }
];
const SAMPLE_MS = 2e3;
const BUFFER_CAP = 31;
const HOST_VIEWS = ["meters", "detail", "graphs"];
function coerceHostView(value) {
  return HOST_VIEWS.includes(value) ? value : "meters";
}
function toSample(system, t2) {
  return {
    t: t2,
    cpu: system.cpu_percent ?? null,
    ram: system.memory ? system.memory.percent : null,
    load: system.load_avg && system.load_avg.length > 0 ? system.load_avg[0] : null,
    proc: system.process ? system.process.rss : null
  };
}
function pushSample(buf, sample, cap) {
  const next = [...buf, sample];
  return next.length > cap ? next.slice(next.length - cap) : next;
}
function seriesOf(buf, key) {
  return buf.map((s) => s[key]);
}
function signalMax(values, fixedMax) {
  if (fixedMax !== void 0) return fixedMax;
  let peak = 0;
  for (const v of values) if (v !== null && v > peak) peak = v;
  return peak > 0 ? peak : 1;
}
function areaPath(line2, H) {
  if (!line2 || !line2.includes("L") || line2.indexOf("M", 1) !== -1) return "";
  const firstX = line2.slice(1, line2.indexOf(","));
  const lastX = line2.slice(line2.lastIndexOf("L") + 1, line2.lastIndexOf(","));
  return `${line2} L${lastX},${H} L${firstX},${H} Z`;
}
function seriesPath(values, max, W, H, pad2) {
  const n = values.length;
  if (n === 0) return "";
  const parts = [];
  let penDown = false;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null) {
      penDown = false;
      continue;
    }
    const x = n <= 1 ? W / 2 : i / (n - 1) * W;
    const y = H - pad2 - Math.min(v, max) / max * (H - pad2 * 2);
    parts.push(`${penDown ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`);
    penDown = true;
  }
  return parts.join(" ");
}
const GB = 1024 ** 3;
const MB = 1024 ** 2;
function Meter({ label, pct, val }) {
  return /* @__PURE__ */ jsxs("div", { className: "meter", children: [
    /* @__PURE__ */ jsx("span", { className: "lbl", children: label }),
    /* @__PURE__ */ jsx("div", { className: "track", children: /* @__PURE__ */ jsx("div", { className: "fill", style: { width: `${Math.min(100, Math.max(0, pct))}%` } }) }),
    /* @__PURE__ */ jsx("span", { className: "val", children: val })
  ] });
}
function Row$1({ label, val }) {
  return /* @__PURE__ */ jsxs("div", { className: "row", children: [
    /* @__PURE__ */ jsx("span", { className: "dim", children: label }),
    /* @__PURE__ */ jsx("span", { children: val })
  ] });
}
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor(seconds % 86400 / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor(seconds % 3600 / 60)}m`;
}
let gradSeq = 0;
function Spark$1({ values, fixedMax, label, readout, gid }) {
  const max = signalMax(values, fixedMax);
  const H = 100, W = 100, PAD2 = 6;
  const line2 = seriesPath(values, max, W, H, PAD2);
  const area = areaPath(line2, H);
  return /* @__PURE__ */ jsxs("div", { className: "host-spark", children: [
    /* @__PURE__ */ jsxs("div", { className: "host-spark-head", children: [
      /* @__PURE__ */ jsx("span", { className: "dim", children: label }),
      /* @__PURE__ */ jsx("span", { className: "val", children: readout })
    ] }),
    /* @__PURE__ */ jsxs("svg", { className: "home-area", viewBox: "0 0 100 100", preserveAspectRatio: "none", children: [
      /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1", children: [
        /* @__PURE__ */ jsx("stop", { offset: "0%", style: { stopColor: "var(--home-accent)", stopOpacity: 0.4 } }),
        /* @__PURE__ */ jsx("stop", { offset: "100%", style: { stopColor: "var(--home-accent)", stopOpacity: 0 } })
      ] }) }),
      area && /* @__PURE__ */ jsx("path", { d: area, fill: `url(#${gid})` }),
      line2 && /* @__PURE__ */ jsx(
        "path",
        {
          d: line2,
          fill: "none",
          stroke: "var(--home-accent)",
          strokeWidth: 1.5,
          strokeLinejoin: "round",
          strokeLinecap: "round",
          vectorEffect: "non-scaling-stroke"
        }
      )
    ] })
  ] });
}
function HostWidget({ system, widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const view = coerceHostView(widgetProps.view);
  const [buf, setBuf] = useState([]);
  const latest = useRef(null);
  latest.current = system;
  const [gidBase] = useState(() => `host-grad-${gradSeq++}`);
  useEffect(() => {
    if (view !== "graphs") return;
    setBuf([]);
    const tick = () => {
      const s = latest.current;
      if (!s) return;
      setBuf((prev) => pushSample(prev, toSample(s, realNow()), BUFFER_CAP));
    };
    tick();
    const id = setInterval(tick, SAMPLE_MS);
    return () => clearInterval(id);
  }, [view]);
  if (!system) return /* @__PURE__ */ jsx("span", { className: "dim", children: t2("common.loading") });
  const cycle = (dir) => {
    const i = (HOST_VIEWS.indexOf(view) + dir + HOST_VIEWS.length) % HOST_VIEWS.length;
    onWidgetPropsChange({ ...widgetProps, view: HOST_VIEWS[i] });
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => cycle(-1), onNext: () => cycle(1), label: t2(`host.view.${view}`) }),
    view === "meters" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "meters", children: [
        system.cpu_percent !== void 0 && /* @__PURE__ */ jsx(Meter, { label: t2("host.cpu"), pct: system.cpu_percent, val: `${Math.round(system.cpu_percent)}%` }),
        system.memory && /* @__PURE__ */ jsx(Meter, { label: t2("host.ram"), pct: system.memory.percent, val: `${(system.memory.used / GB).toFixed(1)}G` }),
        system.disk && /* @__PURE__ */ jsx(Meter, { label: t2("host.disk"), pct: system.disk.percent, val: `${Math.round(system.disk.percent)}%` })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: system.hostname }),
        /* @__PURE__ */ jsx("span", { children: system.uptime_seconds !== void 0 ? formatUptime(system.uptime_seconds) : "—" })
      ] })
    ] }),
    view === "detail" && /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      system.load_avg && system.load_avg.length >= 3 && /* @__PURE__ */ jsx(Row$1, { label: t2("host.load"), val: system.load_avg.slice(0, 3).map((n) => n.toFixed(2)).join(" ") }),
      system.cpu_count !== null && /* @__PURE__ */ jsx(Row$1, { label: t2("host.cores"), val: String(system.cpu_count) }),
      system.memory && /* @__PURE__ */ jsx(Row$1, { label: t2("host.ram"), val: `${(system.memory.used / GB).toFixed(1)} / ${(system.memory.total / GB).toFixed(1)}G` }),
      system.disk && /* @__PURE__ */ jsx(Row$1, { label: t2("host.disk"), val: t2("host.diskFree", { n: (system.disk.free / GB).toFixed(0) }) }),
      system.process && /* @__PURE__ */ jsx(Row$1, { label: t2("host.proc"), val: t2("host.procValue", { mb: (system.process.rss / MB).toFixed(0), threads: system.process.num_threads }) }),
      /* @__PURE__ */ jsx(Row$1, { label: t2("host.os"), val: `${system.platform} ${system.arch}` })
    ] }),
    view === "graphs" && /* @__PURE__ */ jsx("div", { className: "host-sparks", children: HOST_SIGNALS.map((sig) => {
      const values = seriesOf(buf, sig.key);
      const last = [...values].reverse().find((v) => v !== null);
      return /* @__PURE__ */ jsx(
        Spark$1,
        {
          values,
          fixedMax: sig.fixedMax,
          label: t2(`host.${sig.key}`),
          readout: last === void 0 || last === null ? "—" : sig.format(last),
          gid: `${gidBase}-${sig.key}`
        },
        sig.key
      );
    }) })
  ] });
}
const PER_PAGE = 4;
function nextRunLabel(job) {
  if (!job.next_run_at) return "—";
  const d = new Date(job.next_run_at);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function CronWidget({ cron }) {
  const t2 = useT();
  const [page, setPage] = useState(0);
  if (!cron) return /* @__PURE__ */ jsx("span", { className: "dim", children: t2("common.loading") });
  const upcoming = cron.filter((j) => j.enabled && j.next_run_at).sort((a, b) => (a.next_run_at ?? "").localeCompare(b.next_run_at ?? ""));
  if (upcoming.length === 0) return /* @__PURE__ */ jsx("span", { className: "dim", children: t2("cron.empty") });
  const pages = Math.max(1, Math.ceil(upcoming.length / PER_PAGE));
  const p = Math.min(page, pages - 1);
  const slice = upcoming.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
  return /* @__PURE__ */ jsxs("div", { children: [
    pages > 1 && /* @__PURE__ */ jsx(
      HoverArrows,
      {
        onPrev: () => setPage(Math.max(0, p - 1)),
        onNext: () => setPage(Math.min(pages - 1, p + 1)),
        label: `${p + 1}/${pages}`,
        prevDisabled: p <= 0,
        nextDisabled: p >= pages - 1
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "rows", children: slice.map((j) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
      /* @__PURE__ */ jsx("span", { className: "dim", children: nextRunLabel(j) }),
      /* @__PURE__ */ jsx("span", { className: "row-name", title: j.name ?? j.id, children: j.name ?? j.id }),
      /* @__PURE__ */ jsx("span", { className: j.last_error ? "werr" : "ok", children: j.last_error ? t2("cron.err") : t2("cron.ok") })
    ] }, j.id)) })
  ] });
}
const FILES = ["agent", "errors", "gateway"];
const HEAD_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}),\d+\s+(\w+)(?:\s*\[[^\]]*\])?\s*(.*)$/;
const SHORT = {
  ERROR: "ERR",
  CRITICAL: "CRIT",
  FATAL: "FATAL",
  WARNING: "WARN",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DBG"
};
function levelClass(level) {
  if (level === "ERROR" || level === "CRITICAL" || level === "FATAL") return "lvl-error";
  if (level === "WARNING" || level === "WARN") return "lvl-warn";
  return "lvl-info";
}
function parseRecords(lines2) {
  const out = [];
  for (const line2 of lines2) {
    const raw = line2.replace(/[\r\n]+$/, "");
    const m = HEAD_RE.exec(raw);
    if (m) {
      const rest = m[4];
      const ci = rest.indexOf(": ");
      const hasComp = ci > 0 && ci < 60 && !/\s/.test(rest.slice(0, ci));
      out.push({
        level: m[3].toUpperCase(),
        time: m[2],
        component: hasComp ? rest.slice(0, ci) : "",
        message: hasComp ? rest.slice(ci + 2) : rest,
        text: raw
      });
    } else if (out.length) {
      out[out.length - 1].text += "\n" + raw;
    } else if (raw.trim()) {
      out.push({ level: "INFO", time: "", component: "", message: raw, text: raw });
    }
  }
  return out;
}
function ErrorsWidget({ logs, widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const fileKey = FILES.find((f) => f === widgetProps.file) ?? "agent";
  const idx2 = FILES.indexOf(fileKey);
  const [recs, setRecs] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setRecs(null);
    setFailed(false);
    const load = () => {
      api.getLogs({ file: fileKey, lines: 200 }).then((r) => {
        if (!cancelled) {
          setRecs(parseRecords(r.lines ?? []));
          setFailed(false);
        }
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 1e4);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fileKey]);
  const cycle = (dir) => onWidgetPropsChange({ ...widgetProps, file: FILES[(idx2 + dir + FILES.length) % FILES.length] });
  const arrows = /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => cycle(-1), onNext: () => cycle(1), label: fileKey.toUpperCase() });
  const all = recs ?? (fileKey === "agent" && logs ? parseRecords(logs.lines ?? []) : null);
  if (!all) {
    return /* @__PURE__ */ jsxs("div", { children: [
      arrows,
      /* @__PURE__ */ jsx("span", { className: "dim", children: failed ? t2("common.unavailable") : t2("common.loading") })
    ] });
  }
  const records = [...all].reverse();
  return /* @__PURE__ */ jsxs("div", { className: "home-logs-wrap", children: [
    arrows,
    /* @__PURE__ */ jsxs("div", { className: "logs-sub", children: [
      /* @__PURE__ */ jsx("span", { className: "logs-file", children: fileKey.toUpperCase() }),
      /* @__PURE__ */ jsx("span", { className: "dim", children: t2(records.length === 1 ? "logs.record" : "logs.records", { n: records.length }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "home-logs", children: records.length === 0 ? /* @__PURE__ */ jsx("span", { className: "dim", children: t2("logs.empty") }) : records.map((r, i) => /* @__PURE__ */ jsxs("div", { className: "log-row", title: r.text, children: [
      /* @__PURE__ */ jsx("span", { className: `log-lvl ${levelClass(r.level)}`, children: SHORT[r.level] ?? r.level.slice(0, 4) }),
      r.time && /* @__PURE__ */ jsx("span", { className: "log-time", children: r.time }),
      /* @__PURE__ */ jsx("span", { className: "log-msg", children: r.message })
    ] }, `${r.time}-${i}`)) })
  ] });
}
const SYNODIC_DAYS = 29.53058867;
const NEW_MOON_MS = Date.UTC(2e3, 0, 6, 18, 14);
const DAY_MS = 864e5;
function moonPhase(now) {
  const days = (now - NEW_MOON_MS) / DAY_MS;
  return (days % SYNODIC_DAYS + SYNODIC_DAYS) % SYNODIC_DAYS / SYNODIC_DAYS;
}
function phaseName(phase, t2) {
  const i = Math.round(phase * 8) % 8;
  return t2(`moon.phase.${i}`);
}
function MoonWidget({ widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const ref = useRef(null);
  const [label, setLabel] = useState("");
  const offset = typeof widgetProps.offsetDays === "number" ? widgetProps.offsetDays : 0;
  const setOffset = (next) => onWidgetPropsChange({ ...widgetProps, offsetDays: next });
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(10, rect.width);
      cv.height = Math.max(10, rect.height);
      const accent = getComputedStyle(cv).getPropertyValue("--home-accent").trim() || "#d4af37";
      const phase = moonPhase(Date.now() + offset * DAY_MS);
      setLabel(`${phaseName(phase, t2)} · ${Math.round(
        (1 - Math.cos(2 * Math.PI * phase)) / 2 * 100
      )}%`);
      const r = Math.min(cv.width, cv.height) / 2 - 6;
      const cx2 = cv.width / 2;
      const cy2 = cv.height / 2;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx2, cy2, r, 0, 2 * Math.PI);
      ctx.fill();
      const waxing = phase < 0.5;
      const a = r * Math.cos(2 * Math.PI * phase);
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(cx2, cy2, r, -Math.PI / 2, Math.PI / 2, !waxing);
      ctx.ellipse(cx2, cy2, Math.abs(a), r, 0, Math.PI / 2, -Math.PI / 2, a > 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    const timer = setInterval(draw, 36e5);
    return () => {
      ro.disconnect();
      clearInterval(timer);
    };
  }, [offset, t2]);
  const offLabel = offset === 0 ? void 0 : t2("moon.offset", { n: offset > 0 ? `+${offset}` : String(offset) });
  return /* @__PURE__ */ jsxs("div", { className: "home-moon-wrap", children: [
    /* @__PURE__ */ jsx(
      HoverArrows,
      {
        onPrev: () => setOffset(offset - 1),
        onNext: () => setOffset(offset + 1),
        label: offLabel,
        onLabelClick: offset === 0 ? void 0 : () => setOffset(0)
      }
    ),
    /* @__PURE__ */ jsx("canvas", { ref, className: "home-moon-c" }),
    /* @__PURE__ */ jsx("div", { className: "home-moon-label", children: label })
  ] });
}
const SPEED_PX = 2;
const TICK_MS = 33;
const BEAT_S = 1;
const SPEEDS = [0.5, 1, 1.5, 2];
function beatY(t2) {
  if (t2 > 0.1 && t2 < 0.18) return 0.12 * Math.sin((t2 - 0.1) / 0.08 * Math.PI);
  if (t2 > 0.22 && t2 < 0.25) return -0.12;
  if (t2 >= 0.25 && t2 < 0.29) return 1 * Math.sin((t2 - 0.25) / 0.04 * Math.PI);
  if (t2 >= 0.29 && t2 < 0.33) return -0.28;
  if (t2 > 0.42 && t2 < 0.54) return 0.2 * Math.sin((t2 - 0.42) / 0.12 * Math.PI);
  return 0;
}
function HeartbeatWidget({ status, widgetProps, onWidgetPropsChange }) {
  const ref = useRef(null);
  const online = useRef(false);
  const speedRef = useRef(1);
  useEffect(() => {
    online.current = status?.gateway_running ?? false;
  }, [status]);
  const speed = typeof widgetProps.speed === "number" ? widgetProps.speed : 1;
  speedRef.current = speed;
  const stepSpeed = (dir) => {
    const i = (SPEEDS.indexOf(speed) + dir + SPEEDS.length) % SPEEDS.length;
    onWidgetPropsChange({ ...widgetProps, speed: SPEEDS[i] });
  };
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let x = 0;
    let clock2 = 0;
    let prevY = null;
    let accent = "#d4af37";
    let errColor = "#e25555";
    const fit = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(10, rect.width);
      cv.height = Math.max(10, rect.height);
      const cs = getComputedStyle(cv);
      accent = cs.getPropertyValue("--home-accent").trim() || accent;
      errColor = cs.getPropertyValue("--home-error").trim() || errColor;
      x = 0;
      prevY = null;
      ctx.clearRect(0, 0, cv.width, cv.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    const t2 = setInterval(() => {
      if (document.hidden || cv.width < 20) return;
      const mult = speedRef.current;
      const px = SPEED_PX * mult;
      clock2 += TICK_MS / 1e3 * mult;
      const base = cv.height * 0.62;
      const amp = cv.height * 0.42;
      const y = online.current ? base - beatY(clock2 % BEAT_S / BEAT_S) * amp : base;
      ctx.clearRect(x, 0, 14, cv.height);
      if (prevY !== null) {
        ctx.strokeStyle = online.current ? accent : errColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - px, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      prevY = y;
      x += px;
      if (x > cv.width) {
        x = 0;
        prevY = null;
      }
    }, TICK_MS);
    return () => {
      ro.disconnect();
      clearInterval(t2);
    };
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      HoverArrows,
      {
        onPrev: () => stepSpeed(-1),
        onNext: () => stepSpeed(1),
        label: `${speed}×`
      }
    ),
    /* @__PURE__ */ jsx("canvas", { ref, className: "home-canvas" })
  ] });
}
const CELL = 7;
const STEP_MS = 160;
const SEED_DENSITY = 0.22;
const RESEED_STEPS = 400;
function LifeWidget({ editing }) {
  const t2 = useT();
  const ref = useRef(null);
  const gridRef = useRef(new Uint8Array(0));
  const dimsRef = useRef({ cols: 0, rows: 0 });
  const stepsRef = useRef(0);
  const pausedRef = useRef(false);
  const userComposedRef = useRef(false);
  const editingRef = useRef(editing);
  const [paused, setPaused] = useState(false);
  editingRef.current = editing;
  pausedRef.current = paused;
  const seedGrid = () => {
    const { cols, rows } = dimsRef.current;
    const g = new Uint8Array(cols * rows);
    for (let i = 0; i < g.length; i++) g[i] = Math.random() < SEED_DENSITY ? 1 : 0;
    gridRef.current = g;
    stepsRef.current = 0;
    userComposedRef.current = false;
  };
  const clearGrid = () => {
    const { cols, rows } = dimsRef.current;
    gridRef.current = new Uint8Array(cols * rows);
    stepsRef.current = 0;
    userComposedRef.current = true;
  };
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let accent = "#d4af37";
    const fit = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(10, rect.width);
      cv.height = Math.max(10, rect.height);
      accent = getComputedStyle(cv).getPropertyValue("--home-accent").trim() || accent;
      dimsRef.current = {
        cols: Math.max(4, Math.floor(cv.width / CELL)),
        rows: Math.max(4, Math.floor(cv.height / CELL))
      };
      seedGrid();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    const render = () => {
      const { cols, rows } = dimsRef.current;
      const g = gridRef.current;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.75;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (g[y * cols + x]) ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
      ctx.globalAlpha = 1;
    };
    const t22 = setInterval(() => {
      if (document.hidden) return;
      const g = gridRef.current;
      if (g.length === 0) return;
      const { cols, rows } = dimsRef.current;
      if (!pausedRef.current) {
        const next = new Uint8Array(g.length);
        let alive = 0;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const yy = (y + dy + rows) % rows;
                const xx = (x + dx + cols) % cols;
                n += g[yy * cols + xx];
              }
            }
            const i = y * cols + x;
            next[i] = g[i] ? n === 2 || n === 3 ? 1 : 0 : n === 3 ? 1 : 0;
            alive += next[i];
          }
        }
        gridRef.current = next;
        stepsRef.current++;
        if (!userComposedRef.current && (alive === 0 || alive < next.length * 0.02 || stepsRef.current > RESEED_STEPS)) seedGrid();
      }
      render();
    }, STEP_MS);
    let drawing = false;
    const paint2 = (e) => {
      const { cols, rows } = dimsRef.current;
      const rect = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / CELL);
      const y = Math.floor((e.clientY - rect.top) / CELL);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      gridRef.current[y * cols + x] = 1;
      userComposedRef.current = true;
      render();
    };
    const onDown = (e) => {
      if (editingRef.current) return;
      drawing = true;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
      }
      paint2(e);
    };
    const onMove = (e) => {
      if (drawing) paint2(e);
    };
    const onUp = (e) => {
      drawing = false;
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch {
      }
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    return () => {
      ro.disconnect();
      clearInterval(t22);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
    };
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(HoverCtl, { children: [
      /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: () => setPaused((p) => !p), children: paused ? t2("life.play") : t2("life.pause") }),
      /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: seedGrid, children: t2("life.seed") }),
      /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: clearGrid, children: t2("life.clear") })
    ] }),
    /* @__PURE__ */ jsx("canvas", { ref, className: "home-canvas home-life" })
  ] });
}
function readState(p) {
  const s = p.pomodoro;
  const workMin = typeof s?.workMin === "number" ? s.workMin : 25;
  const breakMin = typeof s?.breakMin === "number" ? s.breakMin : 5;
  if (s && (s.mode === "work" || s.mode === "break")) {
    return {
      mode: s.mode,
      endsAt: typeof s.endsAt === "number" ? s.endsAt : null,
      remaining: typeof s.remaining === "number" ? s.remaining : workMin * 60,
      workMin,
      breakMin
    };
  }
  return { mode: "work", endsAt: null, remaining: workMin * 60, workMin, breakMin };
}
const clampMin = (n) => Math.max(1, Math.min(180, Math.round(n)));
function PomodoroWidget({ widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const state = readState(widgetProps);
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const commit = (next) => onWidgetPropsChange({ ...widgetProps, pomodoro: next });
  const secondsLeft = state.endsAt !== null ? Math.max(0, Math.round((state.endsAt - now) / 1e3)) : state.remaining;
  const running = state.endsAt !== null;
  useEffect(() => {
    if (state.endsAt === null) return;
    const t22 = setInterval(() => {
      if (state.endsAt !== null && state.endsAt - Date.now() <= 0) {
        const mode = state.mode === "work" ? "break" : "work";
        const remaining = (mode === "work" ? state.workMin : state.breakMin) * 60;
        commit({ ...state, mode, endsAt: null, remaining });
      } else {
        setNow(Date.now());
      }
    }, 1e3);
    return () => clearInterval(t22);
  }, [state.endsAt, state.mode]);
  const toggle = () => {
    setNow(Date.now());
    if (state.endsAt === null) {
      commit({ ...state, endsAt: Date.now() + state.remaining * 1e3 });
    } else {
      commit({ ...state, endsAt: null, remaining: secondsLeft });
    }
  };
  const setWork = (n) => commit({ ...state, workMin: clampMin(n), mode: "work", endsAt: null, remaining: clampMin(n) * 60 });
  const setBreak = (n) => commit({ ...state, breakMin: clampMin(n) });
  const saveName = (value) => {
    setEditing(false);
    onWidgetPropsChange({ ...widgetProps, label: value.trim() });
  };
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return /* @__PURE__ */ jsxs("div", { className: "home-clock-wrap home-pomo", children: [
    /* @__PURE__ */ jsxs(HoverCtl, { className: "pomo-set", children: [
      /* @__PURE__ */ jsxs("div", { className: "pomo-stepper", children: [
        /* @__PURE__ */ jsx("span", { className: "hv-label", children: t2("pomo.work") }),
        /* @__PURE__ */ jsx("button", { className: "hv-arrow", disabled: running, onClick: () => setWork(state.workMin - 1), children: "‹" }),
        /* @__PURE__ */ jsx("span", { className: "hv-label", children: state.workMin }),
        /* @__PURE__ */ jsx("button", { className: "hv-arrow", disabled: running, onClick: () => setWork(state.workMin + 1), children: "›" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "pomo-stepper", children: [
        /* @__PURE__ */ jsx("span", { className: "hv-label", children: t2("pomo.break") }),
        /* @__PURE__ */ jsx("button", { className: "hv-arrow", onClick: () => setBreak(state.breakMin - 1), children: "‹" }),
        /* @__PURE__ */ jsx("span", { className: "hv-label", children: state.breakMin }),
        /* @__PURE__ */ jsx("button", { className: "hv-arrow", onClick: () => setBreak(state.breakMin + 1), children: "›" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: `home-clock${running ? "" : " paused"}`,
        onClick: toggle,
        title: t2("pomo.toggleTitle"),
        children: [
          mm,
          ":",
          ss
        ]
      }
    ),
    editing ? /* @__PURE__ */ jsx(
      "input",
      {
        className: "note-input count-input",
        autoFocus: true,
        defaultValue: label,
        onBlur: (e) => saveName(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") saveName(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }
      }
    ) : /* @__PURE__ */ jsxs(
      "div",
      {
        className: "home-clock-sub pomo-sub",
        onClick: () => setEditing(true),
        title: t2("pomo.nameTitle"),
        children: [
          label ? `${label} · ` : "",
          t2(state.mode === "work" ? "pomo.work" : "pomo.break"),
          " · ",
          running ? t2("pomo.running") : t2("pomo.paused")
        ]
      }
    )
  ] });
}
const pad = (n) => String(n).padStart(2, "0");
const monthName = (mo) => fmtDate(new Date(2024, mo, 1), { month: "short" }).replace(/\.$/, "").toUpperCase();
const buildISO = (s) => `${s.y}-${pad(s.mo + 1)}-${pad(s.d)}T${pad(s.h)}:${pad(s.mi)}`;
const fromDate = (dt) => ({ y: dt.getFullYear(), mo: dt.getMonth(), d: dt.getDate(), h: dt.getHours(), mi: dt.getMinutes() });
const daysIn = (y, mo) => new Date(y, mo + 1, 0).getDate();
function parseTargetMs(target) {
  if (!target) return NaN;
  return new Date(target.length === 10 ? `${target}T00:00:00` : target).getTime();
}
function parseSeg(target) {
  const ms = parseTargetMs(target);
  return Number.isNaN(ms) ? null : fromDate(new Date(ms));
}
function NumSeg({
  value,
  width,
  label,
  onStep,
  onCommit
}) {
  const t2 = useT();
  const [buf, setBuf] = useState(null);
  return /* @__PURE__ */ jsxs("div", { className: "count-seg", onWheel: (e) => {
    e.preventDefault();
    onStep(e.deltaY < 0 ? 1 : -1);
  }, children: [
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": t2("count.up", { field: label }), onClick: () => {
      setBuf(null);
      onStep(1);
    }, children: "▲" }),
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "seg-val",
        style: { width },
        value: buf ?? pad(value),
        inputMode: "numeric",
        "aria-label": label,
        onChange: (e) => setBuf(e.target.value.replace(/[^0-9]/g, "")),
        onBlur: () => {
          if (buf !== null) {
            const n = parseInt(buf, 10);
            if (!Number.isNaN(n)) onCommit(n);
            setBuf(null);
          }
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === "Escape") e.target.blur();
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setBuf(null);
            onStep(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setBuf(null);
            onStep(-1);
          }
        }
      }
    ),
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": t2("count.down", { field: label }), onClick: () => {
      setBuf(null);
      onStep(-1);
    }, children: "▼" })
  ] });
}
function MonSeg({ value, onStep }) {
  const t2 = useT();
  const field = t2("count.month");
  return /* @__PURE__ */ jsxs("div", { className: "count-seg", onWheel: (e) => {
    e.preventDefault();
    onStep(e.deltaY < 0 ? 1 : -1);
  }, children: [
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": t2("count.up", { field }), onClick: () => onStep(1), children: "▲" }),
    /* @__PURE__ */ jsx("div", { className: "seg-val seg-static", style: { width: 36 }, children: monthName(value) }),
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": t2("count.down", { field }), onClick: () => onStep(-1), children: "▼" })
  ] });
}
function CountdownWidget({ widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const target = typeof widgetProps.target === "string" ? widgetProps.target : "";
  const [mode, setMode] = useState("none");
  const [seg, setSeg] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t22 = setInterval(() => setNow(Date.now()), 3e4);
    return () => clearInterval(t22);
  }, []);
  const targetMs = parseTargetMs(target);
  const commitSeg = (s) => {
    setSeg(s);
    onWidgetPropsChange({ ...widgetProps, target: buildISO(s) });
  };
  const openDatetime = () => {
    setSeg(parseSeg(target) ?? fromDate(/* @__PURE__ */ new Date()));
    setMode("datetime");
  };
  const stepField = (field, delta) => {
    if (!seg) return;
    if (field === "year") {
      const y = seg.y + delta;
      commitSeg({ ...seg, y, d: Math.min(seg.d, daysIn(y, seg.mo)) });
    } else if (field === "month") {
      const mo = (seg.mo + delta + 12) % 12;
      commitSeg({ ...seg, mo, d: Math.min(seg.d, daysIn(seg.y, mo)) });
    } else {
      const dt = new Date(seg.y, seg.mo, seg.d, seg.h, seg.mi);
      if (field === "day") dt.setDate(dt.getDate() + delta);
      if (field === "hour") dt.setHours(dt.getHours() + delta);
      if (field === "min") dt.setMinutes(dt.getMinutes() + delta);
      commitSeg(fromDate(dt));
    }
  };
  const commitField = (field, n) => {
    if (!seg) return;
    if (field === "year") {
      const y = Math.min(2200, Math.max(1970, n));
      commitSeg({ ...seg, y, d: Math.min(seg.d, daysIn(y, seg.mo)) });
    } else if (field === "day") {
      commitSeg({ ...seg, d: Math.min(daysIn(seg.y, seg.mo), Math.max(1, n)) });
    } else if (field === "hour") {
      commitSeg({ ...seg, h: Math.min(23, Math.max(0, n)) });
    } else {
      commitSeg({ ...seg, mi: Math.min(59, Math.max(0, n)) });
    }
  };
  const shiftDays = (delta) => {
    const base = !Number.isNaN(targetMs) ? new Date(targetMs) : /* @__PURE__ */ new Date();
    base.setDate(base.getDate() + delta);
    onWidgetPropsChange({ ...widgetProps, target: buildISO(fromDate(base)) });
  };
  const saveLabel = (value) => {
    setMode("none");
    onWidgetPropsChange({ ...widgetProps, label: value.trim() });
  };
  if (mode === "datetime" && seg) {
    return /* @__PURE__ */ jsx("div", { className: "home-clock-wrap home-count", children: /* @__PURE__ */ jsxs("div", { className: "count-edit", children: [
      /* @__PURE__ */ jsxs("div", { className: "count-edit-row", children: [
        /* @__PURE__ */ jsx(MonSeg, { value: seg.mo, onStep: (d) => stepField("month", d) }),
        /* @__PURE__ */ jsx(
          NumSeg,
          {
            value: seg.d,
            width: 22,
            label: t2("count.day"),
            onStep: (d) => stepField("day", d),
            onCommit: (n) => commitField("day", n)
          }
        ),
        /* @__PURE__ */ jsx(
          NumSeg,
          {
            value: seg.y,
            width: 42,
            label: t2("count.year"),
            onStep: (d) => stepField("year", d),
            onCommit: (n) => commitField("year", n)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "count-edit-row", children: [
        /* @__PURE__ */ jsx(
          NumSeg,
          {
            value: seg.h,
            width: 22,
            label: t2("count.hour"),
            onStep: (d) => stepField("hour", d),
            onCommit: (n) => commitField("hour", n)
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "count-colon", children: ":" }),
        /* @__PURE__ */ jsx(
          NumSeg,
          {
            value: seg.mi,
            width: 22,
            label: t2("count.minute"),
            onStep: (d) => stepField("min", d),
            onCommit: (n) => commitField("min", n)
          }
        )
      ] }),
      /* @__PURE__ */ jsx("button", { className: "count-done", onClick: () => {
        setMode("none");
        setSeg(null);
      }, children: t2("common.done") })
    ] }) });
  }
  let big = "—";
  if (!Number.isNaN(targetMs)) {
    const diff = targetMs - now;
    const abs = Math.abs(diff);
    const d = Math.floor(abs / 864e5);
    const h = Math.floor(abs % 864e5 / 36e5);
    const m = Math.floor(abs % 36e5 / 6e4);
    big = `${diff < 0 ? "+" : ""}${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}`;
  }
  const dateLabel = !Number.isNaN(targetMs) ? fmtDate(new Date(targetMs), { month: "short", day: "numeric" }) : t2("count.setDate");
  return /* @__PURE__ */ jsxs("div", { className: "home-clock-wrap home-count", children: [
    /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => shiftDays(-1), onNext: () => shiftDays(1), label: dateLabel }),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "home-clock count-big",
        onClick: openDatetime,
        title: t2("count.setTitle"),
        children: big
      }
    ),
    mode === "label" ? /* @__PURE__ */ jsx(
      "input",
      {
        className: "note-input count-input",
        autoFocus: true,
        defaultValue: label,
        onBlur: (e) => saveLabel(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") saveLabel(e.currentTarget.value);
          if (e.key === "Escape") setMode("none");
        }
      }
    ) : /* @__PURE__ */ jsx(
      "div",
      {
        className: "home-clock-sub count-label",
        onClick: () => setMode("label"),
        title: t2("count.labelTitle"),
        children: label || t2("count.namePrompt")
      }
    )
  ] });
}
function CalendarWidget({ gridSize }) {
  const t2 = useT();
  const [now, setNow] = useState(() => /* @__PURE__ */ new Date());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t22 = setInterval(() => setNow(/* @__PURE__ */ new Date()), 6e4);
    return () => clearInterval(t22);
  }, []);
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstCol = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthLabel = fmtDate(view, { month: "long", year: "numeric" });
  const dayLetters = Array.from(
    { length: 7 },
    (_, i) => fmtDate(new Date(2024, 0, i + 1), { weekday: "narrow" })
    // 2024-01-01 was a Monday
  );
  const tier = gridSize.gw <= 2 ? "mini" : gridSize.gw >= 4 ? "large" : "normal";
  return /* @__PURE__ */ jsxs("div", { className: `home-cal tier-${tier}`, children: [
    /* @__PURE__ */ jsx(
      HoverArrows,
      {
        onPrev: () => setOffset(offset - 1),
        onNext: () => setOffset(offset + 1),
        label: offset === 0 ? void 0 : t2("common.today"),
        onLabelClick: offset === 0 ? void 0 : () => setOffset(0)
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "home-cal-month", children: monthLabel }),
    /* @__PURE__ */ jsxs("div", { className: "home-cal-grid", children: [
      tier !== "mini" && dayLetters.map((l, i) => /* @__PURE__ */ jsx("span", { className: "home-cal-h", children: l }, `h${i}`)),
      Array.from({ length: firstCol }, (_, i) => /* @__PURE__ */ jsx("span", {}, `p${i}`)),
      Array.from({ length: daysInMonth }, (_, i) => /* @__PURE__ */ jsx(
        "span",
        {
          className: isCurrentMonth && i + 1 === today ? "home-cal-today" : "home-cal-d",
          children: i + 1
        },
        i + 1
      ))
    ] })
  ] });
}
const POLL_MS$2 = 3e4;
function statusTone(status) {
  const s = status.toLowerCase();
  if (s === "active" || s === "healthy" || s === "online" || s === "ok") return "ok";
  if (s === "warning" || s === "warn" || s === "degraded") return "warn";
  if (s === "blocked" || s === "error" || s === "failed") return "err";
  return "dim";
}
const TONE_ICON = { ok: "●", warn: "▲", err: "✕", dim: "○" };
function timeAgo(iso, t2) {
  if (!iso) return t2("common.none");
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t2("common.none");
  const mins = Math.floor(Math.max(0, Date.now() - then) / 6e4);
  if (mins < 1) return t2("time.justNow");
  if (mins < 60) return t2("time.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t2("time.hoursAgo", { n: hours });
  return t2("time.daysAgo", { n: Math.floor(hours / 24) });
}
function ProjectsWidget() {
  const t2 = useT();
  const [projects, setProjects] = useState(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getProjects().then((r) => {
        if (cancelled) return;
        setProjects(Array.isArray(r?.projects) ? r.projects : []);
        setFailed(false);
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS$2);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  if (!projects) {
    return /* @__PURE__ */ jsx("span", { className: "dim", children: failed ? t2("common.unavailable") : t2("common.loading") });
  }
  if (projects.length === 0) {
    return /* @__PURE__ */ jsx("span", { className: "dim", children: t2("projects.empty") });
  }
  return /* @__PURE__ */ jsx("div", { className: "home-projects", children: projects.map((p) => {
    const open = openId === p.id;
    const tone = statusTone(p.status);
    const toggle = () => setOpenId(open ? null : p.id);
    return /* @__PURE__ */ jsxs("div", { className: `project-item${open ? " open" : ""}`, children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: `project-row ${tone}`,
          onClick: (e) => {
            e.stopPropagation();
            toggle();
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          },
          role: "button",
          tabIndex: 0,
          "aria-expanded": open,
          title: p.status,
          children: [
            /* @__PURE__ */ jsx("span", { className: "project-icon", "aria-hidden": "true", children: TONE_ICON[tone] }),
            /* @__PURE__ */ jsx("span", { className: "project-name", children: p.project || p.id }),
            /* @__PURE__ */ jsxs("span", { className: "project-stats", children: [
              /* @__PURE__ */ jsx("span", { title: t2("projects.inbox"), children: p.stats.inbox }),
              " · ",
              /* @__PURE__ */ jsx("span", { title: t2("projects.doing"), children: p.stats.inProgress }),
              " · ",
              /* @__PURE__ */ jsx("span", { title: t2("projects.done"), children: p.stats.completed })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "project-time", children: timeAgo(p.lastUpdated, t2) }),
            /* @__PURE__ */ jsx("span", { className: "project-caret", "aria-hidden": "true", children: open ? "▾" : "▸" })
          ]
        }
      ),
      open && /* @__PURE__ */ jsxs("div", { className: "project-detail", children: [
        /* @__PURE__ */ jsxs("div", { className: "project-detail-row", children: [
          /* @__PURE__ */ jsx("span", { className: "dim", children: t2("projects.next") }),
          " ",
          p.nextAction || t2("common.none")
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "project-detail-row dim", children: [
          t2("projects.inbox"),
          " ",
          p.stats.inbox,
          " · ",
          t2("projects.doing"),
          " ",
          p.stats.inProgress,
          " · ",
          t2("projects.done"),
          " ",
          p.stats.completed
        ] }),
        p.alerts.length > 0 && /* @__PURE__ */ jsxs("div", { className: "project-detail-row project-alerts", children: [
          /* @__PURE__ */ jsx("span", { className: "dim", children: t2("projects.alerts") }),
          /* @__PURE__ */ jsx("ul", { children: p.alerts.map((a, i) => /* @__PURE__ */ jsx("li", { children: a }, i)) })
        ] }),
        p.lastUpdated && /* @__PURE__ */ jsx("div", { className: "project-detail-row dim", children: t2("projects.updated", { when: fmtDate(new Date(p.lastUpdated), { dateStyle: "medium", timeStyle: "short" }) }) })
      ] })
    ] }, p.id);
  }) });
}
const SPEND_RANGES = ["today", "week", "month"];
function coerceSpendRange(value) {
  return SPEND_RANGES.includes(value) ? value : "month";
}
const TOP_MODES = ["all", "real"];
function coerceTopMode(value) {
  return TOP_MODES.includes(value) ? value : "all";
}
const CAP_STEPS = [0, 5, 10, 25, 50, 100, 250, 500, 1e3, 2500];
function coerceCap(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function stepCap(current2, dir) {
  if (dir > 0) return CAP_STEPS.find((s) => s > current2) ?? CAP_STEPS[CAP_STEPS.length - 1];
  for (let i = CAP_STEPS.length - 1; i >= 0; i--) if (CAP_STEPS[i] < current2) return CAP_STEPS[i];
  return 0;
}
const NEAR_CAP = 0.8;
function capState(spent, projection, cap) {
  if (!(cap > 0)) return "off";
  if (spent >= cap) return "over";
  if (projection >= cap) return "pace";
  if (spent >= cap * NEAR_CAP) return "near";
  return "ok";
}
function formatUsd(n) {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n >= 1e3) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(2)}`;
}
function formatCap(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
const PLAN_BRANDS = {
  anthropic: "Claude",
  "claude-code": "Claude",
  "openai-codex": "ChatGPT",
  copilot: "Copilot",
  "copilot-acp": "Copilot"
};
function planBrand(provider) {
  const p = provider.trim().toLowerCase();
  if (PLAN_BRANDS[p]) return PLAN_BRANDS[p];
  if (p.includes("claude")) return "Claude";
  return provider || "?";
}
function coveredByBrand(rows) {
  const acc = /* @__PURE__ */ new Map();
  for (const r of rows) acc.set(planBrand(r.provider), (acc.get(planBrand(r.provider)) ?? 0) + (r.cost ?? 0));
  return [...acc.entries()].map(([brand, cost]) => ({ brand, cost })).filter((r) => r.cost > 0).sort((a, b) => b.cost - a.cost);
}
function amountBasis(b) {
  if (b.actual > 0 && b.estimated > 0) return "mixed";
  return b.actual > 0 ? "actual" : "estimated";
}
const POLL_MS$1 = 6e4;
const RANGE_LABEL = {
  today: "spend.range.today",
  week: "spend.range.week",
  month: "spend.range.month"
};
function SpendWidgetLive({ widgetProps, onWidgetPropsChange, editing, gridSize }) {
  const t2 = useT();
  const range = coerceSpendRange(widgetProps.range);
  const topMode = coerceTopMode(widgetProps.top);
  const cap = coerceCap(widgetProps.cap);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    const load = () => {
      getSpend(range, -(/* @__PURE__ */ new Date()).getTimezoneOffset()).then((r) => {
        if (!cancelled) {
          setData(r);
          setFailed(false);
        }
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS$1);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [range]);
  const setProp = (patch) => onWidgetPropsChange({ ...widgetProps, ...patch });
  const idx2 = SPEND_RANGES.indexOf(range);
  const cycle = (dir) => setProp({ range: SPEND_RANGES[(idx2 + dir + SPEND_RANGES.length) % SPEND_RANGES.length] });
  const controls = /* @__PURE__ */ jsxs(HoverCtl, { className: "tok-ctl", children: [
    /* @__PURE__ */ jsx("button", { className: "hv-arrow", "aria-label": t2("common.previous"), onClick: () => cycle(-1), children: "‹" }),
    /* @__PURE__ */ jsx("span", { className: "hv-label", children: t2(RANGE_LABEL[range]) }),
    /* @__PURE__ */ jsx("button", { className: "hv-arrow", "aria-label": t2("common.next"), onClick: () => cycle(1), children: "›" }),
    /* @__PURE__ */ jsx("span", { className: "tok-div" }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `hv-opt${topMode === "real" ? " on" : ""}`,
        onClick: () => setProp({ top: TOP_MODES[(TOP_MODES.indexOf(topMode) + 1) % TOP_MODES.length] }),
        title: t2("spend.topTitle"),
        "data-top": topMode,
        children: t2(`spend.top.${topMode}`)
      }
    ),
    /* @__PURE__ */ jsx("span", { className: "tok-div" }),
    /* @__PURE__ */ jsx("span", { className: "hv-label", title: t2("spend.capTitle"), children: t2("spend.cap") }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "hv-arrow",
        "aria-label": t2("common.previous"),
        disabled: cap <= 0,
        onClick: () => setProp({ cap: stepCap(cap, -1) }),
        children: "‹"
      }
    ),
    /* @__PURE__ */ jsx("span", { className: "hv-label spend-cap-val", "data-cap": cap, children: cap > 0 ? formatCap(cap) : t2("spend.capOff") }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "hv-arrow",
        "aria-label": t2("common.next"),
        onClick: () => setProp({ cap: stepCap(cap, 1) }),
        children: "›"
      }
    )
  ] });
  if (!data) {
    return /* @__PURE__ */ jsxs("div", { children: [
      controls,
      /* @__PURE__ */ jsx("span", { className: "dim", children: failed ? t2("common.unavailable") : t2("common.loading") })
    ] });
  }
  if (!data.available) {
    return /* @__PURE__ */ jsxs("div", { children: [
      controls,
      /* @__PURE__ */ jsx("span", { className: "dim", children: t2("spend.noStore") })
    ] });
  }
  const real = data.real;
  const covered = data.covered;
  const unclassified = data.unclassified;
  const month = data.month;
  const state = capState(month.real, month.projection, cap);
  const top = (topMode === "real" ? data.top_real : data.top) ?? [];
  const providerRows = gridSize.gh >= 4 ? Math.min(3, real.by_provider.length) : 0;
  const topRows = Math.max(0, Math.min(5, gridSize.gh * 2 - 6 - providerRows));
  const plans = coveredByBrand(covered.by_provider);
  const noCost = data.sessions?.without_cost ?? 0;
  return /* @__PURE__ */ jsxs("div", { className: "home-spend", "data-cap-state": state, children: [
    controls,
    /* @__PURE__ */ jsxs("div", { className: "spend-head", children: [
      /* @__PURE__ */ jsx("span", { className: "bigval", children: formatUsd(real.total) }),
      /* @__PURE__ */ jsxs("span", { className: "dim", title: t2("spend.realTitle"), children: [
        " ",
        t2("spend.real"),
        " · ",
        t2(RANGE_LABEL[range])
      ] }),
      real.total > 0 && /* @__PURE__ */ jsx(BasisTag, { bucket: real })
    ] }),
    !data.has_data ? /* @__PURE__ */ jsx("div", { className: "dim", children: t2("spend.empty") }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      providerRows > 0 && real.by_provider.length > 0 && /* @__PURE__ */ jsx("div", { className: "spend-providers", children: real.by_provider.slice(0, providerRows).map((p) => /* @__PURE__ */ jsxs(
        "div",
        {
          className: "row tok-group",
          style: { "--share": `${Math.max(1, Math.min(100, real.total > 0 ? p.cost / real.total * 100 : 0))}%` },
          title: `${p.provider} · ${p.sessions} · ${p.basis}`,
          children: [
            /* @__PURE__ */ jsx("span", { className: "row-name", children: p.provider || t2("tokens.unknownProvider") }),
            /* @__PURE__ */ jsx("span", { children: formatUsd(p.cost) })
          ]
        },
        p.provider || "\0"
      )) }),
      real.total <= 0 && /* @__PURE__ */ jsx("div", { className: "dim", children: t2("spend.noReal") }),
      plans.length > 0 && /* @__PURE__ */ jsx("div", { className: "spend-covered", title: t2("spend.coveredTitle"), children: plans.map((p) => /* @__PURE__ */ jsxs("div", { children: [
        t2("spend.covered", {
          plan: t2("spend.plan", { brand: p.brand }),
          amount: formatUsd(p.cost)
        }),
        covered.actual <= 0 && /* @__PURE__ */ jsxs("span", { className: "dim", children: [
          " · ",
          t2("spend.est")
        ] })
      ] }, p.brand)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `spend-month spend-${state}`, children: [
      /* @__PURE__ */ jsx("span", { children: t2("spend.month", { spent: formatUsd(month.real) }) }),
      /* @__PURE__ */ jsxs("span", { className: "dim", title: t2("spend.projectedTitle"), children: [
        " ",
        t2("spend.projected", { amount: formatUsd(month.projection) })
      ] }),
      cap > 0 && /* @__PURE__ */ jsxs("span", { className: "dim", children: [
        " ",
        t2("spend.capOf", { cap: formatCap(cap) })
      ] }),
      (state === "near" || state === "pace" || state === "over") && /* @__PURE__ */ jsxs("span", { className: "spend-flag", children: [
        " · ",
        t2(`spend.state.${state}`)
      ] })
    ] }),
    topRows > 0 && data.has_data && /* @__PURE__ */ jsx(TopSessions, { sessions: top.slice(0, topRows), editing, real: topMode === "real" }),
    (unclassified.total > 0 || unclassified.unknown_cost_sessions > 0 || gridSize.gh >= 6 && noCost > 0) && /* @__PURE__ */ jsxs("div", { className: "spend-foot dim", children: [
      unclassified.total > 0 && /* @__PURE__ */ jsx("span", { title: t2("spend.unclassifiedTitle"), children: t2("spend.unclassified", { amount: formatUsd(unclassified.total) }) }),
      unclassified.unknown_cost_sessions > 0 && /* @__PURE__ */ jsx("span", { title: t2("spend.unpricedTitle"), children: t2("spend.unpriced", { n: unclassified.unknown_cost_sessions }) }),
      gridSize.gh >= 6 && noCost > 0 && /* @__PURE__ */ jsx("span", { children: t2("spend.noCost", { n: noCost }) })
    ] })
  ] });
}
function BasisTag({ bucket }) {
  const t2 = useT();
  const basis = amountBasis(bucket);
  if (basis === "actual") return null;
  return basis === "mixed" ? /* @__PURE__ */ jsx("span", { className: "spend-est", title: t2("spend.partEstTitle"), children: t2("spend.partEst") }) : /* @__PURE__ */ jsx("span", { className: "spend-est", title: t2("spend.estTitle"), children: t2("spend.est") });
}
function TopSessions({ sessions, editing, real }) {
  const t2 = useT();
  if (sessions.length === 0) return /* @__PURE__ */ jsx("div", { className: "spend-top dim", children: t2("spend.topEmpty") });
  return /* @__PURE__ */ jsxs("div", { className: "spend-top", children: [
    /* @__PURE__ */ jsx("div", { className: "spend-top-head dim", children: t2(real ? "spend.topHeadReal" : "spend.topHead") }),
    sessions.map((s) => {
      const title = s.title || s.source || t2("spend.untitled");
      const open = () => {
        if (!editing) openSession(s.id);
      };
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "row spend-session",
          role: "button",
          tabIndex: editing ? -1 : 0,
          onClick: (e) => {
            e.stopPropagation();
            open();
          },
          onPointerDown: (e) => {
            if (!editing) e.stopPropagation();
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          },
          title: t2("spend.openTitle", { title, cost: formatUsd(s.cost), provider: s.provider || "?" }),
          "data-session-id": s.id,
          children: [
            /* @__PURE__ */ jsx("span", { className: "row-name", children: title }),
            /* @__PURE__ */ jsx("span", { className: `spend-tag spend-tag-${s.class}`, children: t2(`spend.tag.${s.class}`) }),
            /* @__PURE__ */ jsx("span", { className: "spend-cost", children: formatUsd(s.cost) })
          ]
        },
        s.id
      );
    })
  ] });
}
function SpendWidget(props) {
  const t2 = useT();
  if (demoOn()) return /* @__PURE__ */ jsx("span", { className: "dim", children: t2("demo.masked") });
  return /* @__PURE__ */ jsx(SpendWidgetLive, { ...props });
}
const BASE = "/api/plugins/home-dashboard/boards";
const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === void 0 ? void 0 : JSON.stringify(body)
});
const boardsApi = {
  list: () => fetchJSON(BASE).then((r) => r.boards),
  create: (name, parent = null) => fetchJSON(BASE, json("POST", { name, parent })).then((r) => r.board),
  since: (bid, seq = -1) => fetchJSON(`${BASE}/${bid}?since=${seq}`),
  ops: (bid, ops, note) => fetchJSON(`${BASE}/${bid}/ops`, json("POST", { ops, note: note ?? null })),
  undo: (bid, s) => fetchJSON(`${BASE}/${bid}/undo`, json("POST", { s })),
  remove: (bid) => fetchJSON(`${BASE}/${bid}`, json("DELETE")),
  uploadImage: (data) => fetchJSON(`${BASE}/assets`, json("POST", { data })),
  uploadHtml: (html) => fetchJSON(`${BASE}/assets`, json("POST", { html })),
  asset: (aid) => fetchJSON(`${BASE}/assets/${aid}`),
  preview: (url) => fetchJSON(`${BASE}/link-preview`, json("POST", { url })).then((r) => r.preview),
  poster: (ref) => fetchJSON(`${BASE}/video-poster`, json("POST", ref)).then((r) => r.poster),
  posterFromClient: (ref, data, dur) => fetchJSON(`${BASE}/video-poster`, json("PUT", { ...ref, data, dur: dur ?? null })).then((r) => r.poster),
  videoChunk: (upload, i, n, data) => fetchJSON(`${BASE}/assets/video`, json("POST", { upload, i, n, data })),
  media: (aid, off, n) => fetchJSON(`${BASE}/media/${aid}?off=${off}&n=${n}`),
  liveActions: () => fetchJSON(`${BASE}/live/actions`),
  components: () => fetchJSON(`${BASE}/components`).then((r) => r.components),
  component: (name, ver) => fetchJSON(`${BASE}/components/${encodeURIComponent(name)}${ver ? `?ver=${encodeURIComponent(ver)}` : ""}`),
  compFile: (bid, iid, name, off, n) => fetchJSON(`${BASE}/${bid}/comp/${iid}/files/${encodeURIComponent(name)}?off=${off}&n=${n}`),
  compAction: (bid, iid, action, args, confirm) => fetchJSON(`${BASE}/${bid}/comp/${iid}/action`, json("POST", { action, args, confirm })).then((r) => r.result),
  liveAction: (bid, iid, action, index, confirm) => fetchJSON(`${BASE}/${bid}/live/${iid}/action`, json("POST", { action, index, confirm })).then((r) => r.result)
};
const posterCache = /* @__PURE__ */ new Map();
function videoPoster(ref) {
  const key = ref.asset ? `a:${ref.asset}` : `u:${ref.src}`;
  let p = posterCache.get(key);
  if (!p) {
    p = boardsApi.poster(ref);
    p.catch(() => posterCache.delete(key));
    posterCache.set(key, p);
  }
  return p;
}
function rememberPoster(ref, poster) {
  posterCache.set(ref.asset ? `a:${ref.asset}` : `u:${ref.src}`, Promise.resolve(poster));
}
const mediaCache = /* @__PURE__ */ new Map();
const RANGE = 4 * 1024 * 1024;
function mediaUrl(aid) {
  let p = mediaCache.get(aid);
  if (!p) {
    p = (async () => {
      const parts = [];
      let off = 0, size = Infinity, mime = "video/mp4";
      while (off < size) {
        const r = await boardsApi.media(aid, off, RANGE);
        size = r.size;
        mime = r.mime;
        if (!r.data) break;
        parts.push(b64ToBlob(r.data, r.mime));
        off += parts[parts.length - 1].size;
      }
      return URL.createObjectURL(new Blob(parts, { type: mime }));
    })();
    p.catch(() => mediaCache.delete(aid));
    mediaCache.set(aid, p);
  }
  return p;
}
const compFileCache = /* @__PURE__ */ new Map();
function loadCompFile(bid, iid, name, rev) {
  const key = `${bid}/${iid}/${name}@${rev}`;
  let p = compFileCache.get(key);
  if (!p) {
    p = (async () => {
      const parts = [];
      let off = 0, size = Infinity, total = 0;
      while (off < size) {
        const r = await boardsApi.compFile(bid, iid, name, off, RANGE);
        size = r.size;
        if (!r.data) break;
        const bin = atob(r.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        parts.push(bytes);
        off += bytes.length;
        total += bytes.length;
      }
      const out = new Uint8Array(total);
      let at = 0;
      for (const part of parts) {
        out.set(part, at);
        at += part.length;
      }
      return out.buffer;
    })();
    p.catch(() => compFileCache.delete(key));
    compFileCache.set(key, p);
  }
  return p;
}
const VIDEO_TYPES = /^video\/(mp4|webm|quicktime)$/;
const MAX_VIDEO = 100 * 1024 * 1024;
const CHUNK = 3 * 1024 * 1024;
async function uploadVideo(file, onProgress) {
  if (!VIDEO_TYPES.test(file.type)) throw new Error("unsupported video type");
  if (file.size > MAX_VIDEO) throw new Error("video is over 100 MB");
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const upload = [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const n = Math.max(1, Math.ceil(file.size / CHUNK));
  for (let i = 0; i < n; i++) {
    const data = await blobToB64(file.slice(i * CHUNK, (i + 1) * CHUNK));
    const r = await boardsApi.videoChunk(upload, i, n, data);
    onProgress?.((i + 1) / n);
    if (r.asset) return r;
  }
  throw new Error("upload did not finish");
}
function grabFrame(src) {
  return new Promise((resolve2, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    const done = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 15e3);
    const cleanup = () => {
      clearTimeout(done);
      v.removeAttribute("src");
      v.load();
    };
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      v.currentTime = d > 0 && d < 10 ? d * 0.1 : Math.min(1, d || 1);
    };
    v.onseeked = () => {
      try {
        const w = Math.min(960, v.videoWidth || 640), h = Math.round(w * ((v.videoHeight || 360) / (v.videoWidth || 640)));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(v, 0, 0, w, h);
        const data = c.toDataURL("image/jpeg", 0.82).split(",", 2)[1] ?? "";
        const dur = Number.isFinite(v.duration) ? v.duration : 0;
        cleanup();
        if (!data) reject(new Error("empty frame"));
        else resolve2({ data, dur });
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("video failed to load"));
    };
    v.src = src;
  });
}
const imageCache = /* @__PURE__ */ new Map();
const htmlCache = /* @__PURE__ */ new Map();
function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
function assetUrl(aid) {
  let p = imageCache.get(aid);
  if (!p) {
    p = boardsApi.asset(aid).then((r) => {
      if (!r.data) throw new Error("not an image");
      return URL.createObjectURL(b64ToBlob(r.data, r.mime));
    });
    p.catch(() => imageCache.delete(aid));
    imageCache.set(aid, p);
  }
  return p;
}
async function openAsset(aid, name) {
  const r = await boardsApi.asset(aid);
  if (!r.data) throw new Error("not a file");
  const url = URL.createObjectURL(b64ToBlob(r.data, r.mime));
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener noreferrer";
  if (r.mime === "application/pdf") a.target = "_blank";
  else a.download = `${name.replace(/[\\/:*?"<>|]+/g, "_") || "model"}.${aid.split(".")[1] ?? "bin"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 12e4);
}
function assetHtml(aid) {
  let p = htmlCache.get(aid);
  if (!p) {
    p = boardsApi.asset(aid).then((r) => r.text ?? "");
    p.catch(() => htmlCache.delete(aid));
    htmlCache.set(aid, p);
  }
  return p;
}
const MAX_SIDE = 2560;
const MAX_BYTES = 3 * 1024 * 1024;
function blobToB64(blob) {
  return new Promise((resolve2, reject) => {
    const r = new FileReader();
    r.onload = () => resolve2(String(r.result).split(",", 2)[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function prepareImage(file) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error("unsupported image type");
  const bmp = await createImageBitmap(file);
  let { width: w, height: h } = bmp;
  const animated = file.type === "image/gif";
  if (!animated && (w > MAX_SIDE || h > MAX_SIDE || file.size > MAX_BYTES)) {
    const s = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.round(w * s);
    h = Math.round(h * s);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    let blob = null;
    for (const q of [0.9, 0.82, 0.7, 0.55]) {
      blob = await new Promise((res) => canvas.toBlob(res, "image/webp", q));
      if (blob && blob.size <= MAX_BYTES) break;
    }
    if (!blob) throw new Error("could not encode image");
    bmp.close();
    return { data: await blobToB64(blob), w, h };
  }
  bmp.close();
  if (file.size > 5 * 1024 * 1024) throw new Error("image too large");
  return { data: await blobToB64(file), w, h };
}
const CAD = [
  [4, 0, 1, 11],
  [0, 1, 3, 1],
  [6, 1, 3, 1],
  [1, 2, 2, 1],
  [6, 2, 2, 1],
  [2, 3, 5, 1],
  [2, 5, 2, 1],
  [5, 4, 2, 1],
  [2, 6, 1, 1],
  [6, 5, 1, 2],
  [5, 7, 1, 1],
  [3, 7, 1, 1],
  [2, 8, 1, 1],
  [6, 8, 1, 1],
  [3, 9, 1, 1],
  [5, 9, 1, 1]
];
function Cad({ className = "px", size }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className,
      viewBox: "0 0 9 11",
      "aria-hidden": "true",
      style: size ? { width: size[0], height: size[1] } : void 0,
      children: CAD.map(([x, y, w, h], i) => /* @__PURE__ */ jsx("rect", { x, y, width: w, height: h }, i))
    }
  );
}
function Sig({ label = "hermes" }) {
  return /* @__PURE__ */ jsxs("span", { className: "sig", children: [
    /* @__PURE__ */ jsx(Cad, {}),
    label
  ] });
}
function ago(t2, ts, now = Date.now() / 1e3) {
  if (!ts) return "";
  const s = Math.max(0, now - ts);
  if (s < 45) return t2("board.time.now");
  if (s < 3600) return t2("board.time.min", { n: Math.round(s / 60) });
  if (s < 86400) return t2("board.time.h", { n: Math.round(s / 3600) });
  if (s < 172800) return t2("board.time.yesterday");
  const d = new Date(ts * 1e3);
  return fmtDate(d, { month: "short", day: "numeric" }).toLowerCase();
}
function clock$1(ts) {
  const d = new Date(ts * 1e3);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function RichText({ text }) {
  if (text.includes("```")) {
    const chunks = text.split(/```[^\n]*\n([\s\S]*?)(?:\n```|$)/g);
    return /* @__PURE__ */ jsx(Fragment, { children: chunks.map((c, i) => i % 2 === 1 ? /* @__PURE__ */ jsx("pre", { className: "code", children: c }, i) : c ? /* @__PURE__ */ jsx(RichText, { text: c.replace(/^\n+|\n+$/g, "") }, i) : null) });
  }
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return /* @__PURE__ */ jsx(Fragment, { children: parts.map((p, i) => p.startsWith("**") && p.endsWith("**") && p.length > 4 ? /* @__PURE__ */ jsx("b", { children: p.slice(2, -2) }, i) : /* @__PURE__ */ jsx("span", { children: p }, i)) });
}
function dueLabel(t2, due) {
  const today = /* @__PURE__ */ new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (due === iso || due.toLowerCase() === "today") return { text: t2("board.dueToday"), today: true };
  return { text: due, today: false };
}
const MARKER = /^\s*\[board:[a-z0-9]{8}\]\s*/;
const SELECTION_TAIL = /\s*\([^():\n]{1,24}: [a-z0-9$]{1,12}(?:, [a-z0-9$]{1,12})*\)\s*$/;
const QUIET = /* @__PURE__ */ new Set(["tool_describe", "tool_search"]);
function parseArgs(a) {
  if (typeof a !== "string") return a;
  try {
    return JSON.parse(a);
  } catch {
    return null;
  }
}
function toolCalls(name, args) {
  if (!name || QUIET.has(name)) return [];
  if (name === "tool_call") {
    const calls = args?.calls;
    const inner = Array.isArray(calls) ? calls.filter((c) => typeof c?.name === "string" && c.name).map((c) => ({ name: c.name, args: parseArgs(c.arguments) })) : [];
    return inner.length ? inner : [{ name, args }];
  }
  return [{ name, args }];
}
function textOf(r) {
  if (typeof r.text === "string") return r.text;
  const c = r.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c.map((p) => p && typeof p === "object" && typeof p.text === "string" ? p.text : "").filter(Boolean).join("\n");
  }
  return "";
}
function foldTools(out, key, t2, calls) {
  let row = out[out.length - 1];
  if (row?.role !== "tool") {
    row = { key, role: "tool", text: "", t: t2, tools: [], acts: [] };
    out.push(row);
  }
  calls.forEach((c) => {
    if (!row.tools.includes(c.name)) row.tools.push(c.name);
  });
  mergeActs(row.acts, calls.map((c) => toolAct(c.name, c.args)));
}
function toChatRows(raw) {
  const out = [];
  raw.forEach((r, i) => {
    const role = r.role;
    const key = r.row_id != null ? `r${r.row_id}` : `i${i}-${r.timestamp ?? ""}`;
    const t2 = typeof r.timestamp === "number" ? r.timestamp : void 0;
    if (r.row_kind === "compaction") return;
    if (role === "tool") {
      const calls2 = toolCalls(r.name || r.tool_name || "tool", r.args);
      if (!calls2.length) return;
      foldTools(out, key, t2, calls2);
      return;
    }
    if (role !== "user" && role !== "assistant") return;
    let text = textOf(r).trim();
    if (role === "user") text = text.replace(MARKER, "").replace(SELECTION_TAIL, "");
    const calls = (r.tool_calls ?? []).flatMap((c) => toolCalls(c?.function?.name || c?.name || "", parseArgs(c?.function?.arguments)));
    if (text) out.push({ key, role, text, t: t2 });
    if (calls.length) foldTools(out, `${key}c`, t2, calls);
  });
  return out;
}
function boardPrompt(doc, text, selected, selectedLabel) {
  const sel = selected.filter((id) => doc.items[id]);
  return `[board:${doc.id}] ${text.trim()}${sel.length ? ` (${selectedLabel}: ${sel.join(", ")})` : ""}`;
}
const EXACT = {
  board_read: "readBoard",
  board_apply: "editBoard",
  board_render: "viewBoard",
  board_component: "editBoard",
  skill_view: "skill",
  skills_list: "skill",
  skill_manage: "skill",
  terminal: "command",
  process_manage: "command",
  execute_code: "command",
  read_file: "readFile",
  write_file: "editFile",
  patch: "editFile",
  search_files: "search",
  web_search: "web",
  web_extract: "web",
  vision_analyze: "image",
  image_generate: "image",
  todo: "plan",
  todo_list: "plan",
  memory: "memory",
  delegate_task: "delegate"
};
function bare(name) {
  const parts = name.split("__").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}
function toolKind(name) {
  const n = name.trim().toLowerCase();
  if (EXACT[n]) return EXACT[n];
  const b = bare(n);
  if (EXACT[b]) return EXACT[b];
  if (/^browser_|^firecrawl_|^web_/.test(b) || /^firecrawl/.test(n)) return "web";
  if (/^(read|view|get)_/.test(b)) return "readFile";
  return "other";
}
function opCount(args) {
  let a = args;
  if (typeof a === "string") {
    try {
      a = JSON.parse(a);
    } catch {
      return void 0;
    }
  }
  const ops = a?.ops;
  if (Array.isArray(ops)) return ops.length || void 0;
  if (typeof ops === "string") {
    try {
      const p = JSON.parse(ops);
      return Array.isArray(p) && p.length ? p.length : void 0;
    } catch {
      return void 0;
    }
  }
  return void 0;
}
function toolAct(name, args) {
  const kind = toolKind(name);
  return kind === "editBoard" ? { kind, n: opCount(args) } : { kind };
}
function mergeActs(into, more) {
  for (const a of more) {
    const cur = into.find((x) => x.kind === a.kind);
    if (!cur) into.push({ ...a });
    else if ((a.n ?? 0) > (cur.n ?? 0)) cur.n = a.n;
  }
}
function chatMode() {
  return hostRpc() ? "live" : "handoff";
}
async function readChat(doc, limit = 60) {
  const sid = doc.session?.id;
  if (!sid) return [];
  const rpc = hostRpc();
  if (rpc) {
    try {
      const r = await rpc("session.transcript", { session_id: sid, order: "latest", limit });
      return toChatRows(r?.rows ?? []);
    } catch {
      try {
        const profile = doc.session?.profile;
        const r = await rpc("session.transcript", { session_id: sid, order: "latest", limit, profile });
        return toChatRows(r?.rows ?? []);
      } catch {
        return null;
      }
    }
  }
  try {
    const r = await fetchJSON(`/api/sessions/${encodeURIComponent(sid)}/messages?limit=${limit}&order=latest&inline_images=false`);
    return toChatRows(r?.messages ?? []);
  } catch {
    return null;
  }
}
const liveSessions = /* @__PURE__ */ new Map();
const liveKey = (doc) => `${doc.id}:${doc.session?.id ?? ""}`;
async function liveSession(doc, opts = {}) {
  const rpc = hostRpc();
  if (!rpc || !doc.session?.id) return null;
  const key = liveKey(doc);
  const known = liveSessions.get(key);
  if (known && !opts.fresh) return known;
  const r = await rpc("session.resume", { session_id: doc.session.id, omit_messages: true, lazy: true });
  if (!r?.session_id) return null;
  const live = { sid: r.session_id, info: r.info ?? null };
  liveSessions.set(key, live);
  return live;
}
function dropLiveSession(doc) {
  liveSessions.delete(liveKey(doc));
}
async function sendToSession(doc, body) {
  const rpc = hostRpc();
  if (rpc) {
    const submit = async (sid) => {
      await rpc("prompt.submit", { session_id: sid, text: body });
    };
    try {
      const key = liveKey(doc);
      const known = liveSessions.get(key);
      if (known) {
        try {
          await submit(known.sid);
          return "sent";
        } catch {
          liveSessions.delete(key);
        }
      }
      let sid;
      if (doc.session?.id) {
        sid = (await liveSession(doc, { fresh: true }))?.sid;
      } else {
        const r = await rpc("session.create", {});
        sid = r?.session_id;
        if (sid) liveSessions.set(key, { sid, info: null });
      }
      if (sid) {
        await submit(sid);
        return "sent";
      }
    } catch {
    }
  }
  if (doc.session?.id) {
    try {
      await navigator.clipboard?.writeText(body);
    } catch {
    }
    openSession(doc.session.id);
  } else {
    await newChatWithDraft(body);
  }
  return "handoff";
}
function clampBox(x, y, size, bounds, pad2 = 8) {
  const maxX = bounds.x + bounds.w - size.w - pad2;
  const maxY = bounds.y + bounds.h - size.h - pad2;
  return {
    x: Math.round(Math.max(bounds.x + pad2, Math.min(x, maxX))),
    y: Math.round(Math.max(bounds.y + pad2, Math.min(y, maxY)))
  };
}
function placeTip(trigger, tip, bounds, gap = 6) {
  const cx2 = trigger.x + trigger.w / 2 - tip.w / 2;
  const above = trigger.y - gap - tip.h;
  const below = trigger.y + trigger.h + gap;
  const preferBelow = trigger.y + trigger.h / 2 < bounds.y + Math.min(120, bounds.h / 3);
  let side = preferBelow ? "bottom" : "top";
  if (side === "top" && above < bounds.y + 4) side = "bottom";
  else if (side === "bottom" && below + tip.h > bounds.y + bounds.h - 4) side = "top";
  const p = clampBox(cx2, side === "top" ? above : below, tip, bounds, 6);
  return { ...p, side };
}
function placeBar(sel, bar, bounds, gap = 14) {
  if (sel.x > bounds.x + bounds.w || sel.x + sel.w < bounds.x || sel.y > bounds.y + bounds.h || sel.y + sel.h < bounds.y) return null;
  const above = sel.y - gap - bar.h;
  const below = sel.y + sel.h + gap;
  let y = above, isBelow = false;
  if (above < bounds.y + 8) {
    if (below + bar.h <= bounds.y + bounds.h - 8) {
      y = below;
      isBelow = true;
    } else y = bounds.y + 8;
  }
  const p = clampBox(sel.x, y, bar, bounds, 8);
  return { x: p.x, y: p.y, below: isBelow };
}
function placeMenu(at, menu, bounds) {
  const x = at.x + menu.w > bounds.x + bounds.w - 8 ? at.x - menu.w : at.x;
  const y = at.y + menu.h > bounds.y + bounds.h - 8 ? at.y - menu.h : at.y;
  return clampBox(x, y, menu, bounds, 8);
}
function modKey(platform = typeof navigator !== "undefined" ? navigator.platform || "" : "") {
  return /mac|iphone|ipad/i.test(platform) ? "⌘" : "Ctrl+";
}
const Activity = [
  [
    "path",
    {
      d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
    }
  ]
];
const ArrowUpRight = [
  ["path", { d: "M7 7h10v10" }],
  ["path", { d: "M7 17 17 7" }]
];
const ArrowUp = [
  ["path", { d: "m5 12 7-7 7 7" }],
  ["path", { d: "M12 19V5" }]
];
const Bell = [
  ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
  [
    "path",
    {
      d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
    }
  ]
];
const Blocks = [
  [
    "path",
    {
      d: "M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"
    }
  ],
  ["rect", { x: "14", y: "2", width: "8", height: "8", rx: "1" }]
];
const BookOpen = [
  ["path", { d: "M12 7v14" }],
  [
    "path",
    {
      d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
    }
  ]
];
const Bot = [
  ["path", { d: "M12 8V4H8" }],
  ["rect", { width: "16", height: "12", x: "4", y: "8", rx: "2" }],
  ["path", { d: "M2 14h2" }],
  ["path", { d: "M20 14h2" }],
  ["path", { d: "M15 13v2" }],
  ["path", { d: "M9 13v2" }]
];
const Box = [
  [
    "path",
    {
      d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
    }
  ],
  ["path", { d: "m3.3 7 8.7 5 8.7-5" }],
  ["path", { d: "M12 22V12" }]
];
const Brain = [
  ["path", { d: "M12 18V5" }],
  ["path", { d: "M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" }],
  ["path", { d: "M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" }],
  ["path", { d: "M17.997 5.125a4 4 0 0 1 2.526 5.77" }],
  ["path", { d: "M18 18a4 4 0 0 0 2-7.464" }],
  ["path", { d: "M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" }],
  ["path", { d: "M6 18a4 4 0 0 1-2-7.464" }],
  ["path", { d: "M6.003 5.125a4 4 0 0 0-2.526 5.77" }]
];
const BrushCleaning = [
  ["path", { d: "m16 22-1-4" }],
  [
    "path",
    {
      d: "M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1"
    }
  ],
  ["path", { d: "M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z" }],
  ["path", { d: "m8 22 1-4" }]
];
const CalendarArrowDown = [
  ["path", { d: "m14 18 4 4 4-4" }],
  ["path", { d: "M16 2v4" }],
  ["path", { d: "M18 14v8" }],
  ["path", { d: "M21 11.354V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.343" }],
  ["path", { d: "M3 10h18" }],
  ["path", { d: "M8 2v4" }]
];
const ChartLine = [
  ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }],
  ["path", { d: "m19 9-5 5-4-4-3 3" }]
];
const Check = [["path", { d: "M20 6 9 17l-5-5" }]];
const ChevronRight = [["path", { d: "m9 18 6-6-6-6" }]];
const ChevronLeft = [["path", { d: "m15 18-6-6 6-6" }]];
const CircleAlert = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16" }]
];
const CircleArrowUp = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "m16 12-4-4-4 4" }],
  ["path", { d: "M12 16V8" }]
];
const CircleCheck = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "m9 12 2 2 4-4" }]
];
const Circle = [["circle", { cx: "12", cy: "12", r: "10" }]];
const Clock = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "M12 6v6l4 2" }]
];
const CodeXml = [
  ["path", { d: "m18 16 4-4-4-4" }],
  ["path", { d: "m6 8-4 4 4 4" }],
  ["path", { d: "m14.5 4-5 16" }]
];
const Columns3 = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
  ["path", { d: "M9 3v18" }],
  ["path", { d: "M15 3v18" }]
];
const Copy = [
  ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }],
  ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }]
];
const Cpu = [
  ["path", { d: "M12 20v2" }],
  ["path", { d: "M12 2v2" }],
  ["path", { d: "M17 20v2" }],
  ["path", { d: "M17 2v2" }],
  ["path", { d: "M2 12h2" }],
  ["path", { d: "M2 17h2" }],
  ["path", { d: "M2 7h2" }],
  ["path", { d: "M20 12h2" }],
  ["path", { d: "M20 17h2" }],
  ["path", { d: "M20 7h2" }],
  ["path", { d: "M7 20v2" }],
  ["path", { d: "M7 2v2" }],
  ["rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }],
  ["rect", { x: "8", y: "8", width: "8", height: "8", rx: "1" }]
];
const Database = [
  ["ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }],
  ["path", { d: "M3 5V19A9 3 0 0 0 21 19V5" }],
  ["path", { d: "M3 12A9 3 0 0 0 21 12" }]
];
const Diamond = [
  [
    "path",
    {
      d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"
    }
  ]
];
const Download = [
  ["path", { d: "M12 15V3" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
  ["path", { d: "m7 10 5 5 5-5" }]
];
const Ellipsis = [
  ["circle", { cx: "12", cy: "12", r: "1" }],
  ["circle", { cx: "19", cy: "12", r: "1" }],
  ["circle", { cx: "5", cy: "12", r: "1" }]
];
const Eraser = [
  [
    "path",
    {
      d: "M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"
    }
  ],
  ["path", { d: "m5.082 11.09 8.828 8.828" }]
];
const Eye = [
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3" }]
];
const FilePen = [
  [
    "path",
    {
      d: "M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34"
    }
  ],
  ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }],
  [
    "path",
    {
      d: "M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z"
    }
  ]
];
const FileText = [
  [
    "path",
    {
      d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
    }
  ],
  ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }],
  ["path", { d: "M10 9H8" }],
  ["path", { d: "M16 13H8" }],
  ["path", { d: "M16 17H8" }]
];
const FlaskConical = [
  [
    "path",
    {
      d: "M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"
    }
  ],
  ["path", { d: "M6.453 15h11.094" }],
  ["path", { d: "M8.5 2h7" }]
];
const Focus = [
  ["circle", { cx: "12", cy: "12", r: "3" }],
  ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2" }],
  ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2" }],
  ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2" }],
  ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2" }]
];
const Gauge = [
  ["path", { d: "m12 14 4-4" }],
  ["path", { d: "M3.34 19a10 10 0 1 1 17.32 0" }]
];
const GitBranch = [
  ["path", { d: "M15 6a9 9 0 0 0-9 9V3" }],
  ["circle", { cx: "18", cy: "6", r: "3" }],
  ["circle", { cx: "6", cy: "18", r: "3" }]
];
const Globe = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
  ["path", { d: "M2 12h20" }]
];
const Group = [
  ["path", { d: "M3 7V5c0-1.1.9-2 2-2h2" }],
  ["path", { d: "M17 3h2c1.1 0 2 .9 2 2v2" }],
  ["path", { d: "M21 17v2c0 1.1-.9 2-2 2h-2" }],
  ["path", { d: "M7 21H5c-1.1 0-2-.9-2-2v-2" }],
  ["rect", { width: "7", height: "5", x: "7", y: "7", rx: "1" }],
  ["rect", { width: "7", height: "5", x: "10", y: "12", rx: "1" }]
];
const Hand = [
  ["path", { d: "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" }],
  ["path", { d: "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" }],
  ["path", { d: "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" }],
  [
    "path",
    {
      d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
    }
  ]
];
const HardDrive = [
  ["path", { d: "M10 16h.01" }],
  [
    "path",
    {
      d: "M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
    }
  ],
  ["path", { d: "M21.946 12.013H2.054" }],
  ["path", { d: "M6 16h.01" }]
];
const Highlighter = [
  ["path", { d: "m9 11-6 6v3h9l3-3" }],
  ["path", { d: "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" }]
];
const History = [
  ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
  ["path", { d: "M3 3v5h5" }],
  ["path", { d: "M12 7v5l4 2" }]
];
const Image = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
  ["circle", { cx: "9", cy: "9", r: "2" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
];
const LassoSelect = [
  ["path", { d: "M7 22a5 5 0 0 1-2-4" }],
  ["path", { d: "M7 16.93c.96.43 1.96.74 2.99.91" }],
  [
    "path",
    { d: "M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8a7.19 7.19 0 0 1-.33 2" }
  ],
  ["path", { d: "M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" }],
  [
    "path",
    {
      d: "M14.33 22h-.09a.35.35 0 0 1-.24-.32v-10a.34.34 0 0 1 .33-.34c.08 0 .15.03.21.08l7.34 6a.33.33 0 0 1-.21.59h-4.49l-2.57 3.85a.35.35 0 0 1-.28.14z"
    }
  ]
];
const LayoutGrid = [
  ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1" }],
  ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1" }],
  ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1" }],
  ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1" }]
];
const LayoutDashboard = [
  ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1" }],
  ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1" }],
  ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1" }],
  ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1" }]
];
const Link2 = [
  ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2" }],
  ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2" }],
  ["line", { x1: "8", x2: "16", y1: "12", y2: "12" }]
];
const Link = [
  ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
  ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }]
];
const ListPlus = [
  ["path", { d: "M16 5H3" }],
  ["path", { d: "M11 12H3" }],
  ["path", { d: "M16 19H3" }],
  ["path", { d: "M18 9v6" }],
  ["path", { d: "M21 12h-6" }]
];
const ListTodo = [
  ["path", { d: "M13 5h8" }],
  ["path", { d: "M13 12h8" }],
  ["path", { d: "M13 19h8" }],
  ["path", { d: "m3 17 2 2 4-4" }],
  ["rect", { x: "3", y: "4", width: "6", height: "6", rx: "1" }]
];
const Magnet = [
  ["path", { d: "m12 15 4 4" }],
  [
    "path",
    {
      d: "M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"
    }
  ],
  ["path", { d: "m5 8 4 4" }]
];
const Map$1 = [
  [
    "path",
    {
      d: "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"
    }
  ],
  ["path", { d: "M15 5.764v15" }],
  ["path", { d: "M9 3.236v15" }]
];
const Maximize2 = [
  ["path", { d: "M15 3h6v6" }],
  ["path", { d: "m21 3-7 7" }],
  ["path", { d: "m3 21 7-7" }],
  ["path", { d: "M9 21H3v-6" }]
];
const MessageSquareText = [
  [
    "path",
    {
      d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"
    }
  ],
  ["path", { d: "M7 11h10" }],
  ["path", { d: "M7 15h6" }],
  ["path", { d: "M7 7h8" }]
];
const MousePointer2 = [
  [
    "path",
    {
      d: "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
    }
  ]
];
const MoveUpRight = [
  ["path", { d: "M13 5H19V11" }],
  ["path", { d: "M19 5L5 19" }]
];
const Palette = [
  [
    "path",
    {
      d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
    }
  ],
  ["circle", { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor" }],
  ["circle", { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor" }],
  ["circle", { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor" }],
  ["circle", { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor" }]
];
const PanelRightClose = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
  ["path", { d: "M15 3v18" }],
  ["path", { d: "m8 9 3 3-3 3" }]
];
const Pause = [
  ["rect", { x: "14", y: "3", width: "5", height: "18", rx: "1" }],
  ["rect", { x: "5", y: "3", width: "5", height: "18", rx: "1" }]
];
const Pen = [
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
    }
  ]
];
const PencilLine = [
  ["path", { d: "M13 21h8" }],
  ["path", { d: "m15 5 4 4" }],
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
    }
  ]
];
const Pencil = [
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
    }
  ],
  ["path", { d: "m15 5 4 4" }]
];
const Play = [
  [
    "path",
    { d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" }
  ]
];
const Plus = [
  ["path", { d: "M5 12h14" }],
  ["path", { d: "M12 5v14" }]
];
const Power = [
  ["path", { d: "M12 2v10" }],
  ["path", { d: "M18.4 6.6a9 9 0 1 1-12.77.04" }]
];
const Presentation = [
  ["path", { d: "M2 3h20" }],
  ["path", { d: "M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" }],
  ["path", { d: "m7 21 5-5 5 5" }]
];
const RectangleHorizontal = [
  ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "2" }]
];
const Redo2 = [
  ["path", { d: "m15 14 5-5-5-5" }],
  ["path", { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" }]
];
const RefreshCw = [
  ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }],
  ["path", { d: "M21 3v5h-5" }],
  ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }],
  ["path", { d: "M8 16H3v5" }]
];
const Rocket = [
  ["path", { d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" }],
  [
    "path",
    {
      d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
    }
  ],
  [
    "path",
    {
      d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
    }
  ],
  ["path", { d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" }]
];
const RotateCcw = [
  ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
  ["path", { d: "M3 3v5h5" }]
];
const RotateCw = [
  ["path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }],
  ["path", { d: "M21 3v5h-5" }]
];
const Route = [
  ["circle", { cx: "6", cy: "19", r: "3" }],
  ["path", { d: "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" }],
  ["circle", { cx: "18", cy: "5", r: "3" }]
];
const Scan = [
  ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2" }],
  ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2" }],
  ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2" }],
  ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2" }]
];
const Search = [
  ["path", { d: "m21 21-4.34-4.34" }],
  ["circle", { cx: "11", cy: "11", r: "8" }]
];
const Server = [
  ["rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2" }],
  ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2" }],
  ["line", { x1: "6", x2: "6.01", y1: "6", y2: "6" }],
  ["line", { x1: "6", x2: "6.01", y1: "18", y2: "18" }]
];
const SkipBack = [
  [
    "path",
    {
      d: "M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"
    }
  ],
  ["path", { d: "M3 20V4" }]
];
const Slash = [["path", { d: "M22 2 2 22" }]];
const Spline = [
  ["circle", { cx: "19", cy: "5", r: "2" }],
  ["circle", { cx: "5", cy: "19", r: "2" }],
  ["path", { d: "M5 17A12 12 0 0 1 17 5" }]
];
const Split = [
  ["path", { d: "M16 3h5v5" }],
  ["path", { d: "M8 3H3v5" }],
  ["path", { d: "M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" }],
  ["path", { d: "m15 9 6-6" }]
];
const SquareArrowOutUpRight = [
  ["path", { d: "M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" }],
  ["path", { d: "m21 3-9 9" }],
  ["path", { d: "M15 3h6v6" }]
];
const SquareDashedMousePointer = [
  [
    "path",
    {
      d: "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"
    }
  ],
  ["path", { d: "M5 3a2 2 0 0 0-2 2" }],
  ["path", { d: "M19 3a2 2 0 0 1 2 2" }],
  ["path", { d: "M5 21a2 2 0 0 1-2-2" }],
  ["path", { d: "M9 3h1" }],
  ["path", { d: "M9 21h2" }],
  ["path", { d: "M14 3h1" }],
  ["path", { d: "M3 9v1" }],
  ["path", { d: "M21 9v2" }],
  ["path", { d: "M3 14v1" }]
];
const SquareDashed = [
  ["path", { d: "M5 3a2 2 0 0 0-2 2" }],
  ["path", { d: "M19 3a2 2 0 0 1 2 2" }],
  ["path", { d: "M21 19a2 2 0 0 1-2 2" }],
  ["path", { d: "M5 21a2 2 0 0 1-2-2" }],
  ["path", { d: "M9 3h1" }],
  ["path", { d: "M9 21h1" }],
  ["path", { d: "M14 3h1" }],
  ["path", { d: "M14 21h1" }],
  ["path", { d: "M3 9v1" }],
  ["path", { d: "M21 9v1" }],
  ["path", { d: "M3 14v1" }],
  ["path", { d: "M21 14v1" }]
];
const SquareTerminal = [
  ["path", { d: "m7 11 2-2-2-2" }],
  ["path", { d: "M11 13h4" }],
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }]
];
const Square = [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]];
const SquaresExclude = [
  [
    "path",
    {
      d: "M16 12v2a2 2 0 0 1-2 2H9a1 1 0 0 0-1 1v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h0"
    }
  ],
  [
    "path",
    {
      d: "M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-5a2 2 0 0 0-2 2v2"
    }
  ]
];
const StickyNote = [
  [
    "path",
    {
      d: "M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"
    }
  ],
  ["path", { d: "M15 3v5a1 1 0 0 0 1 1h5" }]
];
const TextQuote = [
  ["path", { d: "M17 5H3" }],
  ["path", { d: "M21 12H8" }],
  ["path", { d: "M21 19H8" }],
  ["path", { d: "M3 12v7" }]
];
const Timer = [
  ["line", { x1: "10", x2: "14", y1: "2", y2: "2" }],
  ["line", { x1: "12", x2: "15", y1: "14", y2: "11" }],
  ["circle", { cx: "12", cy: "14", r: "8" }]
];
const Trash2 = [
  ["path", { d: "M10 11v6" }],
  ["path", { d: "M14 11v6" }],
  ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
  ["path", { d: "M3 6h18" }],
  ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
];
const Type = [
  ["path", { d: "M12 4v16" }],
  ["path", { d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" }],
  ["path", { d: "M9 20h6" }]
];
const Undo2 = [
  ["path", { d: "M9 14 4 9l5-5" }],
  ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" }]
];
const Ungroup = [
  ["rect", { width: "8", height: "6", x: "5", y: "4", rx: "1" }],
  ["rect", { width: "8", height: "6", x: "11", y: "14", rx: "1" }]
];
const Upload = [
  ["path", { d: "M12 3v12" }],
  ["path", { d: "m17 8-5-5-5 5" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }]
];
const Video = [
  ["path", { d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" }],
  ["rect", { x: "2", y: "6", width: "14", height: "12", rx: "2" }]
];
const Workflow = [
  ["rect", { width: "8", height: "8", x: "3", y: "3", rx: "2" }],
  ["path", { d: "M7 11v4a2 2 0 0 0 2 2h4" }],
  ["rect", { width: "8", height: "8", x: "13", y: "13", rx: "2" }]
];
const Wrench = [
  [
    "path",
    {
      d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"
    }
  ]
];
const X = [
  ["path", { d: "M18 6 6 18" }],
  ["path", { d: "m6 6 12 12" }]
];
const Zap = [
  [
    "path",
    {
      d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
    }
  ]
];
const ZoomIn = [
  ["circle", { cx: "11", cy: "11", r: "8" }],
  ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65" }],
  ["line", { x1: "11", x2: "11", y1: "8", y2: "14" }],
  ["line", { x1: "8", x2: "14", y1: "11", y2: "11" }]
];
const ZoomOut = [
  ["circle", { cx: "11", cy: "11", r: "8" }],
  ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65" }],
  ["line", { x1: "8", x2: "14", y1: "11", y2: "11" }]
];
const PILL$1 = [["rect", { x: 2, y: 7, width: 20, height: 10, rx: 5 }]];
const ICONS = {
  select: MousePointer2,
  pan: Hand,
  note: StickyNote,
  todo: ListTodo,
  link: Link,
  image: Image,
  col: Columns3,
  board: LayoutDashboard,
  embed: CodeXml,
  arrow: MoveUpRight,
  draw: PencilLine,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  fit: Scan,
  focus: Focus,
  undo: Undo2,
  redo: Redo2,
  edit: Pencil,
  duplicate: Copy,
  delete: Trash2,
  connect: MoveUpRight,
  open: SquareArrowOutUpRight,
  openBoard: ArrowUpRight,
  reset: RotateCcw,
  chat: MessageSquareText,
  toolReadBoard: Eye,
  toolEditBoard: PencilLine,
  toolViewBoard: Eye,
  toolSkill: BookOpen,
  toolCommand: SquareTerminal,
  toolReadFile: FileText,
  toolEditFile: FilePen,
  toolSearch: Search,
  toolWeb: Globe,
  toolImage: Image,
  toolPlan: ListTodo,
  toolMemory: Brain,
  toolDelegate: Bot,
  toolOther: Wrench,
  closePanel: PanelRightClose,
  send: ArrowUp,
  close: X,
  plus: Plus,
  prev: ChevronLeft,
  next: ChevronRight,
  reload: RotateCw,
  taller: Maximize2,
  theme: Palette,
  // Hermes verbs
  expand: ListPlus,
  split: Split,
  diagram: Workflow,
  sortDate: CalendarArrowDown,
  flow: Route,
  group: Group,
  summarize: TextQuote,
  improve: BrushCleaning,
  selectAll: SquareDashedMousePointer,
  video: Video,
  ok: CircleCheck,
  markOk: Check,
  markFail: X,
  markWait: Clock,
  fileDoc: FileText,
  model3d: Box,
  fileOpen: SquareArrowOutUpRight,
  fileGet: Download,
  alert: CircleAlert,
  check: Check,
  // presentation
  present: Presentation,
  play: Play,
  pause: Pause,
  map: Map$1,
  // Draw tool
  pen: Pen,
  highlighter: Highlighter,
  eraser: Eraser,
  lasso: LassoSelect,
  line: Slash,
  inkArrow: ArrowUpRight,
  rect: Square,
  ellipse: Circle,
  dashed: SquareDashed,
  smooth: Spline,
  ungroup: Ungroup,
  // layout
  tidy: LayoutGrid,
  unoverlap: SquaresExclude,
  snap: Magnet,
  more: Ellipsis,
  text: Type,
  shapeRect: RectangleHorizontal,
  shapeDiamond: Diamond,
  shapePill: PILL$1,
  shapeCircle: Circle,
  // components + sync
  components: Blocks,
  sync: Link2,
  upgrade: CircleArrowUp,
  versions: History,
  skipBack: SkipBack,
  playIcon: Play,
  pauseIcon: Pause
};
const LIVE_ICONS = {
  activity: Activity,
  gauge: Gauge,
  cpu: Cpu,
  "square-terminal": SquareTerminal,
  terminal: SquareTerminal,
  timer: Timer,
  rocket: Rocket,
  bot: Bot,
  brain: Brain,
  server: Server,
  database: Database,
  "flask-conical": FlaskConical,
  flask: FlaskConical,
  "chart-line": ChartLine,
  chart: ChartLine,
  "hard-drive": HardDrive,
  "git-branch": GitBranch,
  bell: Bell,
  zap: Zap,
  video: Video,
  square: Square,
  stop: Square,
  play: Play,
  pause: Pause,
  "refresh-cw": RefreshCw,
  refresh: RefreshCw,
  power: Power,
  upload: Upload,
  download: Download,
  check: Check
};
function Icon({ name, size = 14, className, node: given }) {
  const node2 = given ?? ICONS[name ?? "plus"];
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: `ic${className ? ` ${className}` : ""}`,
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: node2.map(([tag, attrs], i) => {
        const Tag = tag;
        return /* @__PURE__ */ jsx(Tag, { ...attrs }, i);
      })
    }
  );
}
const NO_MODEL = {
  model: "",
  provider: "",
  effort: "",
  effortPending: true,
  effortWire: "",
  fast: false,
  serviceTier: ""
};
const str = (v) => typeof v === "string" ? v.trim() : "";
function mergeSessionInfo(prev, info) {
  if (!info || typeof info !== "object") return prev;
  const r = info;
  const next = { ...prev };
  if (str(r.model)) next.model = str(r.model);
  if ("provider" in r && str(r.provider)) next.provider = str(r.provider);
  if (typeof r.reasoning_effort === "string") {
    next.effort = r.reasoning_effort.trim();
    next.effortPending = false;
    next.effortWire = str(r.reasoning_effort_wire);
  }
  if (typeof r.fast === "boolean") next.fast = r.fast;
  if (typeof r.service_tier === "string") next.serviceTier = r.service_tier.trim();
  return next;
}
function modelFromSessionRow(row) {
  if (!row || typeof row !== "object") return NO_MODEL;
  const r = row;
  let effort = "";
  let pending2 = true;
  try {
    const cfg = typeof r.model_config === "string" ? JSON.parse(r.model_config) : r.model_config;
    const rc = cfg && typeof cfg === "object" ? cfg.reasoning_config : null;
    if (rc && typeof rc === "object") {
      const o = rc;
      effort = o.enabled === false ? "none" : str(o.effort);
      pending2 = false;
    }
  } catch {
  }
  return { ...NO_MODEL, model: str(r.model), provider: str(r.billing_provider), effort, effortPending: pending2 };
}
function modelSwitchValue(model, provider) {
  const m = model.trim();
  const p = provider.trim();
  return p ? `${m} --provider ${p} --session` : `${m} --session`;
}
function speedValue(tier) {
  return tier === "priority" ? "fast" : tier || "normal";
}
const VARIANTS = [
  [/-fast$/i, "Fast"],
  [/-flash$/i, "Flash"],
  [/-thinking$/i, "Thinking"],
  [/-preview$/i, "Preview"],
  [/-latest$/i, "Latest"]
];
const VENDOR = [
  [/\bDeepseek\b/g, "DeepSeek"],
  [/\bGlm\b/g, "GLM"],
  [/\bMinimax\b/g, "MiniMax"],
  [/\bOpenai\b/g, "OpenAI"],
  [/\bErnie\b/g, "ERNIE"],
  [/\bMimo\b/g, "MiMo"],
  [/\bVl\b/g, "VL"],
  [/\bFp8\b/g, "FP8"],
  [/\bAi\b/g, "AI"]
];
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
function vendorCase(s) {
  let out = s.replace(/\b(a?)(\d+(?:\.\d+)?)b\b/gi, (_m, a, n) => `${a.toUpperCase()}${n}B`);
  for (const [re, to] of VENDOR) out = out.replace(re, to);
  return out;
}
function prettify(base) {
  if (/^claude-/i.test(base)) return vendorCase(titleCase(base.replace(/^claude-/i, "").replace(/(\d)-(?=\d)/g, "$1.").replace(/-/g, " ")));
  if (/^gpt-/i.test(base)) return base.replace(/^gpt-/i, "GPT-");
  if (/^gemini-/i.test(base)) return vendorCase(titleCase(base.replace(/^gemini-/i, "Gemini ").replace(/-/g, " ")));
  return vendorCase(titleCase(base.replace(/-/g, " ")));
}
function modelDisplayName(model) {
  const id = model.trim();
  if (!id) return "";
  let base = id.slice(id.lastIndexOf("/") + 1);
  let variant = "";
  for (const [re, label] of VARIANTS) {
    if (re.test(base)) {
      variant = label;
      base = base.replace(re, "");
      break;
    }
  }
  const ctx = base.match(/\[(\d+[mk])\]$/i);
  const tags = [variant];
  if (ctx) {
    tags.push(ctx[1].toUpperCase());
    base = base.slice(0, -ctx[0].length);
  }
  base = base.replace(/-\d{8}$/, "");
  const name = prettify(base) || id;
  const tag = tags.filter(Boolean).join(" ");
  return tag ? `${name} · ${tag}` : name;
}
const EFFORT_LABELS = {
  none: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
  ultra: "Ultra"
};
function effortLabel(m) {
  if (m.effortPending || !m.effort) return "";
  return EFFORT_LABELS[m.effort.toLowerCase()] ?? m.effort;
}
function sessionModelLabel(m) {
  const name = modelDisplayName(m.model);
  if (!name) return "";
  const effort = effortLabel(m);
  return effort ? `${name} · ${effort}` : name;
}
const PRESETS_KEY = "hb.modelPresets";
const presetKey = (provider, model) => `${provider.trim().toLowerCase()}::${model.trim()}`;
function readPresets(storage) {
  try {
    const v = JSON.parse(storage?.getItem(PRESETS_KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
function writePreset(storage, provider, model, patch) {
  if (!storage) return;
  const all = readPresets(storage);
  const key = presetKey(provider, model);
  all[key] = { ...all[key], ...patch };
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete all[k];
  try {
    storage.setItem(PRESETS_KEY, JSON.stringify(all));
  } catch {
  }
}
const store = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
function useSessionModel(doc, opts) {
  const storedId = doc.session?.id ?? null;
  const [model, setModel] = useState(NO_MODEL);
  const [sid, setSid] = useState(null);
  const [busy, setBusy] = useState(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const modelRef = useRef(model);
  modelRef.current = model;
  const live = !!hostRpc();
  useEffect(() => {
    let on = true;
    setModel(NO_MODEL);
    setSid(null);
    if (!storedId) return;
    if (live) {
      let timer = 0;
      const attempt = (n) => {
        liveSession(docRef.current).then((r) => {
          if (!on || !r) return;
          setSid(r.sid);
          setModel((m) => mergeSessionInfo(m, r.info));
        }).catch((err) => {
          if (!on) return;
          if (n >= 4) {
            console.warn("[home-dashboard] board session model unavailable:", err);
            return;
          }
          timer = window.setTimeout(() => attempt(n + 1), 1500 * 2 ** n);
        });
      };
      attempt(0);
      return () => {
        on = false;
        window.clearTimeout(timer);
      };
    } else {
      fetchJSON(`/api/sessions/${encodeURIComponent(storedId)}`).then((row) => {
        if (on) setModel(modelFromSessionRow(row));
      }).catch(() => {
      });
    }
    return () => {
      on = false;
    };
  }, [storedId, live, opts.refreshKey]);
  useEffect(() => {
    if (!sid) return;
    const off = onGatewayEvent("session.info", (ev) => {
      if (ev?.session_id === sid) setModel((m) => mergeSessionInfo(m, ev.payload));
    });
    return () => {
      off?.();
    };
  }, [sid]);
  const request = useCallback(async (method, params) => {
    const rpc = hostRpc();
    if (!rpc) throw new Error("no gateway");
    const d = docRef.current;
    let cur = sid ?? (await liveSession(d))?.sid;
    if (!cur) throw new Error("no live session");
    try {
      return await rpc(method, { ...params, session_id: cur });
    } catch (err) {
      if (!/session not found|4001/i.test(String(err?.message ?? err))) throw err;
      dropLiveSession(d);
      const again = await liveSession(d, { fresh: true });
      if (!again || again.sid === cur) throw err;
      cur = again.sid;
      setSid(cur);
      return rpc(method, { ...params, session_id: cur });
    }
  }, [sid]);
  const writeOption = useCallback(async (patch) => {
    const before = modelRef.current;
    if (patch.effort) {
      setModel((m) => ({ ...m, effort: patch.effort, effortPending: false, effortWire: "" }));
      try {
        await request("config.set", { key: "reasoning", value: patch.effort });
      } catch (err) {
        setModel((m) => ({ ...m, effort: before.effort, effortPending: before.effortPending }));
        hostModelMenu()?.notifyError?.(err, opts.failureMessage);
      }
    }
    const tier = patch.serviceTier ?? (patch.fast === void 0 ? void 0 : patch.fast ? "priority" : "normal");
    if (tier !== void 0) {
      setModel((m) => ({ ...m, serviceTier: tier, fast: tier !== "normal" }));
      try {
        await request("config.set", { key: "fast", value: speedValue(tier) });
      } catch (err) {
        setModel((m) => ({ ...m, serviceTier: before.serviceTier, fast: before.fast }));
        hostModelMenu()?.notifyError?.(err, opts.failureMessage);
      }
    }
  }, [request, opts.failureMessage]);
  const select = useCallback(async (next, provider) => {
    const before = modelRef.current;
    const paint2 = () => setModel((m) => ({ ...m, model: next, provider, effortWire: "" }));
    const rollback = () => setModel(before);
    const send = (confirm = false) => request("config.set", {
      key: "model",
      value: modelSwitchValue(next, provider),
      ...confirm ? { confirm_expensive_model: true } : {}
    });
    paint2();
    setBusy(true);
    try {
      const r = await send();
      if (r?.confirm_required) {
        rollback();
        const menu = hostModelMenu();
        if (!menu?.confirm) return false;
        const ok = await menu.confirm({
          model: next,
          message: r.confirm_message,
          failureMessage: opts.failureMessage,
          requestConfirmed: async () => {
            paint2();
            return send(true);
          }
        });
        if (!ok) rollback();
        return ok;
      }
      return true;
    } catch (err) {
      rollback();
      hostModelMenu()?.notifyError?.(err, opts.failureMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }, [request, opts.failureMessage]);
  const canSwitch = live && !!storedId && !!sid && !!hostModelMenu();
  const controller = canSwitch ? {
    allowSpeed: true,
    current: {
      model: model.model,
      provider: model.provider,
      effort: model.effort,
      effortPending: model.effortPending,
      effortWire: model.effortWire,
      fast: model.fast,
      serviceTier: model.serviceTier
    },
    // Selecting a row restores what this board last used for that model (the menu passes the
    // preset it read from presetFor, or the defaults). Only what differs is written.
    applyPreset: (preset, row) => {
      const m = modelRef.current;
      const patch = {};
      if (preset.effort !== void 0 && preset.effort !== m.effort) patch.effort = preset.effort;
      const tier = preset.serviceTier ?? (preset.fast === void 0 ? void 0 : preset.fast ? "priority" : "normal");
      if (tier !== void 0 && tier !== (m.serviceTier || "normal")) patch.serviceTier = tier;
      writePreset(store(), row.provider, row.model, preset);
      if (Object.keys(patch).length) void writeOption(patch);
    },
    presetFor: (provider, m) => readPresets(store())[presetKey(provider, m)] ?? {},
    select,
    // Like the composer: an edit on the active row goes to the session; on another row it is
    // only remembered for when that model is picked.
    setOptions: (patch, row) => {
      writePreset(store(), row.provider, row.model, patch);
      if (row.isActive) void writeOption(patch);
    }
  } : null;
  return { model, sid, controller, busy };
}
const CHAT_MIN_W = 300;
function SessionModelPill({ doc, t: t2, refreshKey }) {
  const { model, sid, controller } = useSessionModel(doc, { refreshKey, failureMessage: t2("board.chat.model.switchFailed") });
  const label = modelDisplayName(model.model);
  const menu = hostModelMenu();
  const detail = sessionModelLabel(model);
  const title = model.provider ? t2("board.chat.model.title", { provider: model.provider, model: detail }) : t2("board.chat.model.titleNoProvider", { model: detail });
  if (controller && menu && sid && label) {
    const Picker = menu.Picker;
    return /* @__PURE__ */ jsx(Picker, { controller, sessionId: sid, profile: doc.session?.profile || "default", label, title, refreshLabel: t2("board.chat.model.refresh") });
  }
  if (!label) return null;
  return /* @__PURE__ */ jsx("span", { className: "hb-model ro", "data-tip": `${title} — ${t2("board.chat.model.readonly")}`, "aria-label": title, children: label });
}
const CHAT_MAX_W = 640;
function ToolLine({ acts, names, t: t2 }) {
  if (demoOn()) acts = acts.filter((a) => a.kind !== "skill" && a.kind !== "command" && a.kind !== "other");
  if (!acts.length) return null;
  const label = (a) => a.kind === "editBoard" && a.n ? t2("board.chat.tool.editBoardN", { n: a.n }) : t2(`board.chat.tool.${a.kind}`);
  const ordered = [...acts].sort((a, b) => Number(b.kind === "editBoard") - Number(a.kind === "editBoard"));
  const shown = ordered.slice(0, 2);
  const rest = ordered.length - shown.length;
  return /* @__PURE__ */ jsxs("div", { className: "ch-tool", "data-tip": demoOn() ? void 0 : names.join(" · "), children: [
    /* @__PURE__ */ jsx(Icon, { name: `tool${ordered[0].kind[0].toUpperCase()}${ordered[0].kind.slice(1)}`, size: 12 }),
    /* @__PURE__ */ jsxs("span", { className: "txt", children: [
      shown.map(label).join(" · "),
      rest > 0 ? ` ${t2("board.chat.more", { n: rest })}` : ""
    ] })
  ] });
}
function inline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return /* @__PURE__ */ jsx("b", { children: p.slice(2, -2) }, i);
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return /* @__PURE__ */ jsx("code", { children: p.slice(1, -1) }, i);
    return /* @__PURE__ */ jsx("span", { children: p }, i);
  });
}
function Md({ text }) {
  const blocks = [];
  const lines2 = text.replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines2.length) {
    const line2 = lines2[i];
    if (line2.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines2.length && !lines2[i].startsWith("```")) code.push(lines2[i++]);
      i++;
      blocks.push(/* @__PURE__ */ jsx("pre", { children: code.join("\n") }, blocks.length));
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line2)) {
      const items = [];
      const ordered = /^\s*\d/.test(line2);
      while (i < lines2.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines2[i])) items.push(lines2[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const L = ordered ? "ol" : "ul";
      blocks.push(/* @__PURE__ */ jsx(L, { children: items.map((x, j) => /* @__PURE__ */ jsx("li", { children: inline(x) }, j)) }, blocks.length));
      continue;
    }
    if (!line2.trim()) {
      i++;
      continue;
    }
    const para = [];
    while (i < lines2.length && lines2[i].trim() && !lines2[i].startsWith("```") && !/^\s*([-*•]|\d+[.)])\s+/.test(lines2[i])) para.push(lines2[i++]);
    const h = /^#{1,4}\s+(.*)$/.exec(para[0]);
    if (h && para.length === 1) blocks.push(/* @__PURE__ */ jsx("p", { className: "h", children: inline(h[1]) }, blocks.length));
    else blocks.push(/* @__PURE__ */ jsx("p", { children: para.map((p, j) => /* @__PURE__ */ jsxs("span", { children: [
      j > 0 && /* @__PURE__ */ jsx("br", {}),
      inline(p.replace(/^#{1,4}\s+/, ""))
    ] }, j)) }, blocks.length));
  }
  return /* @__PURE__ */ jsx(Fragment, { children: blocks });
}
function ChatPanel({ doc, t: t2, width, selected, sentAt, onWidth, onClose, onContinue, onSent, inputRef }) {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingSince, setPendingSince] = useState(null);
  const [optimistic, setOptimistic] = useState(null);
  const listRef = useRef(null);
  const stick = useRef(true);
  const docRef = useRef(doc);
  docRef.current = doc;
  const mode = chatMode();
  const sessionId = doc.session?.id ?? null;
  const load = useCallback(async () => {
    const r = await readChat(docRef.current);
    if (r === null) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setRows(r);
  }, []);
  useEffect(() => {
    let live = true;
    const tick = () => {
      if (live && !document.hidden) void load();
    };
    tick();
    const i = window.setInterval(tick, pendingSince ? 1500 : 4e3);
    return () => {
      live = false;
      window.clearInterval(i);
    };
  }, [load, sessionId, pendingSince]);
  const pendingRef = useRef(false);
  pendingRef.current = !!pendingSince;
  useEffect(() => {
    let timer = 0;
    const off = onGatewayEvent("*", (ev) => {
      if (!pendingRef.current || timer || !ev?.type || !/message|turn|complete|tool/.test(ev.type)) return;
      timer = window.setTimeout(() => {
        timer = 0;
        void load();
      }, 700);
    });
    return () => {
      off?.();
      window.clearTimeout(timer);
    };
  }, [load]);
  useEffect(() => {
    if (sentAt) setPendingSince(sentAt / 1e3);
  }, [sentAt]);
  useEffect(() => {
    if (!pendingSince) return;
    const last = rows?.[rows.length - 1];
    if (last && last.role === "assistant" && (last.t ?? 0) >= pendingSince - 2) {
      setPendingSince(null);
      setOptimistic(null);
    } else if (rows?.some((r) => r.role === "user" && (r.t ?? 0) >= pendingSince - 2)) setOptimistic(null);
    const i = window.setTimeout(() => setPendingSince(null), 24e4);
    return () => window.clearTimeout(i);
  }, [rows, pendingSince]);
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [rows, optimistic, pendingSince]);
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(160, el.scrollHeight)}px`;
    }
  }, [draft, inputRef]);
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const body = boardPrompt(docRef.current, text, selected, t2("board.prompt.selection"));
    const now = Date.now() / 1e3;
    setOptimistic({ key: `o${now}`, role: "user", text, t: now });
    setPendingSince(now);
    stick.current = true;
    const how = await sendToSession(docRef.current, body);
    if (how === "handoff") {
      setPendingSince(null);
      setOptimistic(null);
    }
    onSent(text, how);
  };
  const startResize = (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = width;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => onWidth(w0 + (x0 - ev.clientX));
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const shown = [...rows ?? [], ...optimistic && !rows?.some((r) => r.role === "user" && r.text === optimistic.text && (r.t ?? 0) >= (optimistic.t ?? 0) - 2) ? [optimistic] : []];
  const sel = selected.filter((id) => doc.items[id]).length;
  return /* @__PURE__ */ jsxs(
    "aside",
    {
      className: "hb-chat",
      "aria-label": t2("board.chat.title"),
      style: { width },
      onKeyDown: (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      },
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "grip",
            role: "separator",
            "aria-orientation": "vertical",
            "aria-label": t2("board.chat.resize"),
            onPointerDown: startResize,
            onDoubleClick: () => onWidth(360)
          }
        ),
        /* @__PURE__ */ jsxs("header", { className: "ch-top", children: [
          /* @__PURE__ */ jsx("span", { className: "hd", "data-tip": sessionId && !demoOn() ? t2("board.chat.sessionTip", { id: sessionId }) : void 0, children: /* @__PURE__ */ jsxs("span", { className: "who", children: [
            /* @__PURE__ */ jsx(Cad, {}),
            "hermes"
          ] }) }),
          sessionId && /* @__PURE__ */ jsx(SessionModelPill, { doc, t: t2, refreshKey: mode === "live" ? 0 : sentAt }),
          /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.continue"), "data-kbd": `${modKey()}↵`, "aria-label": t2("board.continue"), onClick: onContinue, children: /* @__PURE__ */ jsx(Icon, { name: "open" }) }),
          /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.chat.close"), "data-kbd": "Esc", "aria-label": t2("board.chat.close"), onClick: onClose, children: /* @__PURE__ */ jsx(Icon, { name: "closePanel" }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "ch-list", ref: listRef, onScroll: (e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }, children: [
          shown.length === 0 && /* @__PURE__ */ jsxs("div", { className: "ch-empty", children: [
            /* @__PURE__ */ jsx(Icon, { name: "chat", size: 18 }),
            /* @__PURE__ */ jsx("p", { children: failed ? t2("board.chat.unreadable") : !sessionId ? t2("board.chat.noSession") : rows ? t2("board.chat.emptySession") : t2("common.loading") })
          ] }),
          shown.map((r) => r.role === "tool" ? /* @__PURE__ */ jsx(ToolLine, { acts: r.acts ?? [], names: r.tools ?? [], t: t2 }, r.key) : r.role === "user" ? /* @__PURE__ */ jsxs("div", { className: "ch-user", children: [
            /* @__PURE__ */ jsx("div", { className: "bubble", children: r.text }),
            r.t ? /* @__PURE__ */ jsx("time", { children: clock$1(r.t) }) : null
          ] }, r.key) : /* @__PURE__ */ jsx("div", { className: "ch-asst", children: /* @__PURE__ */ jsx(Md, { text: r.text }) }, r.key)),
          pendingSince && /* @__PURE__ */ jsxs("div", { className: "ch-working", children: [
            /* @__PURE__ */ jsx(Cad, {}),
            t2("board.chat.working"),
            /* @__PURE__ */ jsx("span", { className: "caret" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "ch-compose", children: /* @__PURE__ */ jsxs("div", { className: "box", children: [
          /* @__PURE__ */ jsx(
            "textarea",
            {
              ref: inputRef,
              rows: 1,
              value: draft,
              placeholder: t2("board.chat.placeholder"),
              onChange: (e) => setDraft(e.target.value),
              onKeyDown: (e) => {
                e.stopPropagation();
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "row", children: [
            sel > 0 ? /* @__PURE__ */ jsx("span", { className: "chip", children: t2("board.chat.withSelection", { n: sel }) }) : /* @__PURE__ */ jsx("span", { className: "hint", children: mode === "live" ? t2("board.chat.hintLive") : t2("board.chat.hintHandoff") }),
            /* @__PURE__ */ jsx("span", { className: "sp" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                className: "send",
                disabled: !draft.trim(),
                "data-tip": t2("board.chat.send"),
                "data-kbd": "↵",
                "aria-label": t2("board.chat.send"),
                onClick: () => void send(),
                children: /* @__PURE__ */ jsx(Icon, { name: "send", size: 15 })
              }
            )
          ] })
        ] }) })
      ]
    }
  );
}
function toStroke(pts) {
  const r = pts.map(([x2, y2]) => [Math.round(x2), Math.round(y2)]);
  const x = Math.min(...r.map((p) => p[0]));
  const y = Math.min(...r.map((p) => p[1]));
  return { x, y, d: r.map(([px, py]) => `${px - x},${py - y}`).join(" ") };
}
function strokePath(pts) {
  if (!pts.length) return "";
  if (pts.length < 3) return `M${pts.map((p) => p.join(" ")).join(" L")}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}
const cx = (r) => r.x + r.w / 2;
const cy = (r) => r.y + r.h / 2;
function route(a, b) {
  const hgap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const vgap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  let s, e, dir, horizontal;
  if (hgap > 0 && hgap >= vgap) {
    horizontal = true;
    if (b.x >= a.x + a.w) {
      s = [a.x + a.w, cy(a)];
      e = [b.x, cy(b)];
      dir = "r";
    } else {
      s = [a.x, cy(a)];
      e = [b.x + b.w, cy(b)];
      dir = "l";
    }
  } else {
    horizontal = false;
    if (cy(b) >= cy(a)) {
      s = [cx(a), a.y + a.h];
      e = [cx(b), b.y];
      dir = "d";
    } else {
      s = [cx(a), a.y];
      e = [cx(b), b.y + b.h];
      dir = "u";
    }
  }
  s = [Math.round(s[0]), Math.round(s[1])];
  e = [Math.round(e[0]), Math.round(e[1])];
  if (horizontal ? s[1] === e[1] : s[0] === e[0]) return { points: [s, e], dir };
  if (horizontal) {
    const mx = Math.round((s[0] + e[0]) / 2);
    return { points: [s, [mx, s[1]], [mx, e[1]], e], dir };
  }
  const my = Math.round((s[1] + e[1]) / 2);
  return { points: [s, [s[0], my], [e[0], my], e], dir };
}
function elbowPath(pts, r = 7) {
  if (!pts.length) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const p1 = [b[0] + (a[0] - b[0]) * rr / d1, b[1] + (a[1] - b[1]) * rr / d1];
    const p2 = [b[0] + (c[0] - b[0]) * rr / d2, b[1] + (c[1] - b[1]) * rr / d2];
    d += ` L${p1[0]} ${p1[1]} Q${b[0]} ${b[1]} ${p2[0]} ${p2[1]}`;
  }
  const z = pts[pts.length - 1];
  return `${d} L${z[0]} ${z[1]}`;
}
function headPath(x, y, dir, L = 7, W = 4) {
  const [dx, dy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[dir];
  return `M${x} ${y} L${x - dx * L - dy * W} ${y - dy * L + dx * W} L${x - dx * L + dy * W} ${y - dy * L - dx * W}Z`;
}
function samplePolyline(pts, step) {
  const out = [];
  let carry2 = step / 2;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let s = carry2;
    while (s <= len) {
      const t2 = s / len;
      out.push([Math.round((ax + (bx - ax) * t2) * 10) / 10, Math.round((ay + (by - ay) * t2) * 10) / 10]);
      s += step;
    }
    carry2 = s - len;
  }
  return out;
}
function pointAtT(pts, t2) {
  if (pts.length < 2) return pts[0] ?? [0, 0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let want = Math.max(0, Math.min(1, t2)) * total;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= len || i === pts.length - 1) {
      const u = len ? want / len : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    }
    want -= len;
  }
  return pts[pts.length - 1];
}
function boundsOf(rects) {
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function fitView(b, vp, pad2 = 60, maxZ = 1.25) {
  const z = Math.max(0.15, Math.min(maxZ, (vp.w - 2 * pad2) / Math.max(1, b.w), (vp.h - 2 * pad2) / Math.max(1, b.h)));
  return { z, x: vp.w / 2 - (b.x + b.w / 2) * z, y: vp.h / 2 - (b.y + b.h / 2) * z };
}
function intersects(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
const RESIZE_H = /* @__PURE__ */ new Set(["frame", "box", "embed", "comp", "text", "shape"]);
function resizePatch(kind, w, h) {
  const p = { w: Math.round(Math.max(kind === "shape" ? 40 : 120, w)) };
  if (RESIZE_H.has(kind)) p.h = Math.round(Math.max(40, h));
  return p;
}
const ZOOM_MIN$1 = 0.2;
const ZOOM_MAX$1 = 2.4;
function wheelIntent(e, trackpadRecent = false) {
  if (e.ctrlKey || e.metaKey) return "zoom";
  if (e.deltaMode !== 0) return "zoom";
  const notch = e.deltaX === 0 && e.deltaY !== 0 && (typeof e.wheelDeltaY === "number" && e.wheelDeltaY !== 0 && Math.abs(e.wheelDeltaY) % 120 === 0 || Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50);
  if (notch && !trackpadRecent) return "zoom";
  return "pan";
}
function wheelZoomFactor(e) {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
  const px = Math.max(-240, Math.min(240, e.deltaY * unit));
  const modNotch = (e.ctrlKey || e.metaKey) && e.deltaMode === 0 && e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50;
  const k = modNotch ? 25e-4 : e.ctrlKey || e.metaKey ? 0.01 : 15e-4;
  return Math.exp(-px * k);
}
function zoomView$1(v, f, sx, sy, min = ZOOM_MIN$1, max = ZOOM_MAX$1) {
  const z = Math.min(max, Math.max(min, v.z * f));
  const wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
  return { z, x: sx - wx * z, y: sy - wy * z };
}
function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = len ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      if (d > far) {
        far = d;
        best = i;
      }
    }
    if (best > 0 && far > eps) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
const SHAPES$1 = ["line", "arrow", "rect", "ellipse"];
const isShape = (t2) => !!t2 && SHAPES$1.includes(t2);
const INK_COLORS = ["ink", "accent", "sage", "clay", "slate", "sand"];
const PEN_WIDTHS = [1.9, 3.5, 6];
const HL_WIDTHS = [10, 16, 24];
const DEFAULT_INK = { tool: "pen", w: { pen: 0, hl: 1 }, c: "ink" };
const TOOLS$2 = ["pen", "hl", "eraser", "lasso", ...SHAPES$1];
const idx = (v, d) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2 ? v : d;
function parseInk(raw) {
  let o = {};
  try {
    o = raw ? JSON.parse(raw) : {};
  } catch {
    o = {};
  }
  if (!o || typeof o !== "object") o = {};
  const w = o.w ?? {};
  return {
    tool: TOOLS$2.includes(o.tool) ? o.tool : DEFAULT_INK.tool,
    w: { pen: idx(w.pen, DEFAULT_INK.w.pen), hl: idx(w.hl, DEFAULT_INK.w.hl) },
    c: INK_COLORS.includes(o.c) ? o.c : DEFAULT_INK.c,
    ds: o.ds === true,
    sm: o.sm === 0 || o.sm === 2 ? o.sm : 1
  };
}
function inkWidth(s, tool = s.tool) {
  return tool === "hl" ? HL_WIDTHS[s.w.hl] : PEN_WIDTHS[s.w.pen];
}
function stepWidth(s, dir) {
  const key = s.tool === "hl" ? "hl" : "pen";
  return { ...s, w: { ...s.w, [key]: Math.max(0, Math.min(2, s.w[key] + dir)) } };
}
const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
class OneEuro2D {
  x = 0;
  y = 0;
  dx = 0;
  dy = 0;
  rx = 0;
  ry = 0;
  t = -1;
  p;
  constructor(p) {
    this.p = p;
  }
  filter(x, y, tMs) {
    if (this.t < 0) {
      this.t = tMs;
      this.x = this.rx = x;
      this.y = this.ry = y;
      return [x, y];
    }
    const dt = Math.max(1 / 1e3, (tMs - this.t) / 1e3 || 1 / 240);
    this.t = tMs;
    const ad = alpha(this.p.dCutoff, dt);
    this.dx += ad * ((x - this.rx) / dt - this.dx);
    this.dy += ad * ((y - this.ry) / dt - this.dy);
    this.rx = x;
    this.ry = y;
    const a = alpha(this.p.minCutoff + this.p.beta * Math.hypot(this.dx, this.dy), dt);
    this.x += a * (x - this.x);
    this.y += a * (y - this.y);
    return [this.x, this.y];
  }
}
function euroFor(pointerType, sm) {
  if (sm === 0) return null;
  const strong = sm === 2;
  if (pointerType === "pen") return strong ? { minCutoff: 3, beta: 0.03, dCutoff: 1 } : { minCutoff: 6, beta: 0.05, dCutoff: 1 };
  if (pointerType === "touch") return strong ? { minCutoff: 1.4, beta: 0.015, dCutoff: 1 } : { minCutoff: 2.8, beta: 0.025, dCutoff: 1 };
  return strong ? { minCutoff: 0.8, beta: 0.01, dCutoff: 1 } : { minCutoff: 1.6, beta: 0.018, dCutoff: 1 };
}
function catmullRom(pts, step) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const knot = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 1; k <= n; k++) {
      const t4 = t1 + (t2 - t1) * k / n;
      const lerp = (a, b, ta, tb) => {
        const u = tb - ta < 1e-9 ? 0 : (t4 - ta) / (tb - ta);
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      };
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
      out.push(lerp(B1, B2, t1, t2));
    }
  }
  return out;
}
const MAX_POINTS = 400;
function finishStroke(pts, zoom, pointerType = "mouse", smooth2 = 1) {
  if (pts.length < 2) return pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const z = Math.max(0.05, zoom);
  const screenEps = smooth2 === 0 ? 0.6 : pointerType === "pen" ? 0.6 : pointerType === "touch" ? 1 : smooth2 === 2 ? 1.8 : 1.2;
  let pts1 = simplify(pts, screenEps / z);
  if (smooth2 > 0 && pts1.length >= 3) pts1 = catmullRom(pts1, 5 / z);
  const ints = [];
  for (const [x, y] of pts1) {
    const p = [Math.round(x), Math.round(y)];
    const last = ints[ints.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) ints.push(p);
  }
  let eps = 0.45;
  let out = simplify(ints, eps);
  while (out.length > MAX_POINTS) {
    eps *= 1.6;
    out = simplify(ints, eps);
  }
  return out;
}
function pressureDigits(raw, pressures, done) {
  if (raw.length < 2 || pressures.length !== raw.length || done.length < 2) return void 0;
  const lo = Math.min(...pressures), hi = Math.max(...pressures);
  if (hi - lo < 0.05) return void 0;
  const cum = (pts) => {
    const c = [0];
    for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = c[c.length - 1] || 1;
    return c.map((v) => v / total);
  };
  const cr = cum(raw), cd = cum(done);
  let j = 0;
  return cd.map((u) => {
    while (j < cr.length - 2 && cr[j + 1] < u) j++;
    const span = cr[j + 1] - cr[j] || 1;
    const k = Math.max(0, Math.min(1, (u - cr[j]) / span));
    const p = pressures[j] + (pressures[j + 1] - pressures[j]) * k;
    return String(Math.max(0, Math.min(9, Math.round(p * 9))));
  }).join("");
}
function shapePoints(tool, a, b, mods = {}) {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  if (mods.shift) {
    if (tool === "line" || tool === "arrow") {
      const len = Math.hypot(dx, dy);
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      dx = Math.round(Math.cos(ang) * len * 1e3) / 1e3;
      dy = Math.round(Math.sin(ang) * len * 1e3) / 1e3;
    } else {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * side;
      dy = (dy < 0 ? -1 : 1) * side;
    }
  }
  if (mods.alt) return [[a[0] - dx, a[1] - dy], [a[0] + dx, a[1] + dy]];
  return [a, [a[0] + dx, a[1] + dy]];
}
function arrowHead(from, tip, sw) {
  const L = Math.max(9, sw * 4.2), W = L * 0.55;
  const dx = tip[0] - from[0], dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const bx = tip[0] - ux * L, by = tip[1] - uy * L;
  const r = (v) => Math.round(v * 10) / 10;
  return `M${r(bx - uy * W)} ${r(by + ux * W)} L${tip[0]} ${tip[1]} L${r(bx + uy * W)} ${r(by - ux * W)}`;
}
function shapePath(tool, p0, p1) {
  const [x0, y0] = p0, [x1, y1] = p1;
  if (tool === "line" || tool === "arrow") return `M${x0} ${y0} L${x1} ${y1}`;
  const l = Math.min(x0, x1), t2 = Math.min(y0, y1), r = Math.max(x0, x1), b = Math.max(y0, y1);
  if (tool === "rect") return `M${l} ${t2} H${r} V${b} H${l} Z`;
  const rx = (r - l) / 2, ry = (b - t2) / 2, cx2 = l + rx, cy2 = t2 + ry;
  return `M${cx2 - rx} ${cy2} A${rx} ${ry} 0 1 0 ${cx2 + rx} ${cy2} A${rx} ${ry} 0 1 0 ${cx2 - rx} ${cy2} Z`;
}
function freehandOutline(pts, size, pressures) {
  const n = pts.length;
  if (n === 0) return [];
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1];
  const taper = Math.min(total * 0.3, size * 7);
  const radius = (i) => {
    const p = pressures?.[i];
    const w = p === void 0 ? size : size * (0.3 + 0.95 * p);
    const ease2 = (v) => 1 - (1 - Math.min(1, v)) ** 2;
    const f = taper > 0 ? Math.min(ease2(cum[i] / taper), ease2((total - cum[i]) / taper)) : 1;
    return Math.max(0.35, w / 2 * (0.22 + 0.78 * f));
  };
  if (n === 1 || total < 0.5) {
    const r = Math.max(0.5, size / 2);
    return Array.from({ length: 12 }, (_, k) => [pts[0][0] + Math.cos(k / 12 * Math.PI * 2) * r, pts[0][1] + Math.sin(k / 12 * Math.PI * 2) * r]);
  }
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const r = radius(i);
    left.push([pts[i][0] - ty * r, pts[i][1] + tx * r]);
    right.push([pts[i][0] + ty * r, pts[i][1] - tx * r]);
  }
  const cap = (c, from, r, steps = 5) => {
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    return Array.from({ length: steps - 1 }, (_, k) => {
      const a = a0 - Math.PI * (k + 1) / steps;
      return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
    });
  };
  const end = cap(pts[n - 1], left[n - 1], radius(n - 1));
  const start = cap(pts[0], right[0], radius(0));
  return [...left, ...end, ...right.reverse(), ...start];
}
function outlinePath(poly) {
  if (poly.length < 3) return "";
  const r = (v) => Math.round(v * 100) / 100;
  const mid = (a, b) => `${r((a[0] + b[0]) / 2)} ${r((a[1] + b[1]) / 2)}`;
  let d = `M${mid(poly[0], poly[1])}`;
  for (let i = 1; i <= poly.length; i++) {
    const p = poly[i % poly.length], q = poly[(i + 1) % poly.length];
    d += ` Q${r(p[0])} ${r(p[1])} ${mid(p, q)}`;
  }
  return `${d}Z`;
}
function parsePressure(pr, n) {
  if (!pr || !/^[0-9]+$/.test(pr)) return void 0;
  if (pr.length === n) return [...pr].map((c) => Number(c) / 9);
  return Array.from({ length: n }, (_, i) => Number(pr[Math.round(i / Math.max(1, n - 1) * (pr.length - 1))]) / 9);
}
function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t2 = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t2 * dx), p[1] - (a[1] + t2 * dy));
}
function itemPolyline(item) {
  const ox = item.x ?? 0, oy = item.y ?? 0;
  const pts = (item.d ?? "").split(" ").map((p) => p.split(",").map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)).map(([x, y]) => [x + ox, y + oy]);
  if (pts.length < 2 || !isShape(item.tl)) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (item.tl === "line" || item.tl === "arrow") return [a, b];
  const l = Math.min(a[0], b[0]), t2 = Math.min(a[1], b[1]), r = Math.max(a[0], b[0]), bt = Math.max(a[1], b[1]);
  if (item.tl === "rect") return [[l, t2], [r, t2], [r, bt], [l, bt], [l, t2]];
  const cx2 = (l + r) / 2, cy2 = (t2 + bt) / 2, rx = (r - l) / 2, ry = (bt - t2) / 2;
  return Array.from({ length: 49 }, (_, k) => [cx2 + Math.cos(k / 48 * Math.PI * 2) * rx, cy2 + Math.sin(k / 48 * Math.PI * 2) * ry]);
}
function strokeHit(item, p, r) {
  const pts = itemPolyline(item);
  const reach = r + Math.max(1, (item.sw ?? 1.9) / 2);
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= reach;
  for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= reach) return true;
  return false;
}
function eraseHits(items, p, r) {
  const out = [];
  for (const [id, it] of Object.entries(items)) if (it.k === "draw" && !it.in && strokeHit(it, p, r)) out.push(id);
  return out;
}
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}
function lassoHits(items, loop) {
  if (loop.length < 3) return [];
  const out = [];
  for (const [id, it] of Object.entries(items)) {
    if (it.k !== "draw" || it.in) continue;
    const pts = itemPolyline(it);
    if (!pts.length) continue;
    const inside = pts.filter((q) => pointInPolygon(q, loop)).length;
    if (inside / pts.length >= 0.6) out.push(id);
  }
  return out;
}
function expandGroups(items, ids) {
  const sel = new Set(ids);
  const groups = new Set([...sel].map((id) => items[id]?.g).filter(Boolean));
  if (groups.size) {
    for (const [id, it] of Object.entries(items)) if (it.g && groups.has(it.g)) sel.add(id);
  }
  return sel;
}
function newGroupId() {
  return Math.random().toString(36).slice(2, 10).padEnd(4, "0");
}
function inkGeometry(item, strokePath2) {
  const pts = (item.d ?? "").split(" ").map((p) => p.split(",").map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
  if (!pts.length) return null;
  const sw = item.sw ?? 1.9;
  const dashed = !!item.ds;
  const paths = [];
  let pad2 = Math.max(6, sw);
  if (isShape(item.tl) && pts.length >= 2) {
    const a = pts[0], b = pts[pts.length - 1];
    paths.push({ d: shapePath(item.tl, a, b), fill: false, dashed });
    if (item.tl === "arrow") {
      paths.push({ d: arrowHead(a, b, sw), fill: false, dashed: false });
      pad2 += Math.max(9, sw * 4.2);
    }
  } else if (item.sm && item.tl !== "hl" && !dashed) {
    paths.push({ d: outlinePath(freehandOutline(pts, sw * 1.35, parsePressure(item.pr, pts.length))), fill: true, dashed: false });
  } else {
    paths.push({ d: strokePath2(pts), fill: false, dashed });
  }
  const xs2 = pts.map((p) => p[0]), ys2 = pts.map((p) => p[1]);
  const x = Math.min(...xs2) - pad2, y = Math.min(...ys2) - pad2;
  return { paths, box: { x, y, w: Math.max(...xs2) - x + pad2, h: Math.max(...ys2) - y + pad2 } };
}
const TOOLS$1 = [
  { tool: "pen", icon: "pen", label: "board.ink.pen", kbd: "D" },
  { tool: "hl", icon: "highlighter", label: "board.ink.hl", kbd: "⇧D" },
  { tool: "eraser", icon: "eraser", label: "board.ink.eraser", kbd: "E" },
  { tool: "lasso", icon: "lasso", label: "board.ink.lasso" }
];
const SHAPE_TOOLS = [
  { tool: "line", icon: "line", label: "board.ink.line" },
  { tool: "arrow", icon: "inkArrow", label: "board.ink.arrow" },
  { tool: "rect", icon: "rect", label: "board.ink.rect" },
  { tool: "ellipse", icon: "ellipse", label: "board.ink.ellipse" }
];
const WIDTH_LABEL = ["board.ink.thin", "board.ink.medium", "board.ink.thick"];
const SMOOTH_LABEL = ["board.ink.smoothOff", "board.ink.smoothOn", "board.ink.smoothStrong"];
function InkBar({ ink: ink2, onChange, t: t2 }) {
  const hl = ink2.tool === "hl";
  const widths = hl ? HL_WIDTHS : PEN_WIDTHS;
  const wIdx = hl ? ink2.w.hl : ink2.w.pen;
  const inkless = ink2.tool === "eraser" || ink2.tool === "lasso";
  const set = (p) => onChange({ ...ink2, ...p });
  const toolBtn = (x) => /* @__PURE__ */ jsx(
    "button",
    {
      className: `tool${ink2.tool === x.tool ? " on" : ""}`,
      "aria-pressed": ink2.tool === x.tool,
      "aria-label": t2(x.label),
      "data-tip": t2(x.label),
      "data-kbd": x.kbd,
      onClick: () => set({ tool: x.tool }),
      children: /* @__PURE__ */ jsx(Icon, { name: x.icon, size: 15 })
    },
    x.tool
  );
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "hb-inkbar",
      role: "toolbar",
      "aria-label": t2("board.ink.bar"),
      "data-nodrag": true,
      onPointerDown: (e) => e.stopPropagation(),
      onContextMenu: (e) => e.preventDefault(),
      children: [
        /* @__PURE__ */ jsx("div", { className: "seg", children: TOOLS$1.map(toolBtn) }),
        /* @__PURE__ */ jsx("div", { className: "seg", children: SHAPE_TOOLS.map(toolBtn) }),
        /* @__PURE__ */ jsx("div", { className: `seg${inkless ? " off" : ""}`, children: widths.map((_, i) => /* @__PURE__ */ jsx(
          "button",
          {
            className: `tool sw${wIdx === i ? " on" : ""}`,
            "aria-pressed": wIdx === i,
            disabled: inkless,
            "aria-label": t2(WIDTH_LABEL[i]),
            "data-tip": t2(WIDTH_LABEL[i]),
            "data-kbd": "[ ]",
            onClick: () => set({ w: { ...ink2.w, [hl ? "hl" : "pen"]: i } }),
            children: /* @__PURE__ */ jsx("i", { style: { width: 4 + i * 4, height: 4 + i * 4 } })
          },
          i
        )) }),
        /* @__PURE__ */ jsx("div", { className: `seg${inkless ? " off" : ""}`, children: INK_COLORS.map((c, i) => /* @__PURE__ */ jsx(
          "button",
          {
            className: `tool sw-c c-${c}${ink2.c === c ? " on" : ""}`,
            "aria-pressed": ink2.c === c,
            disabled: inkless,
            "aria-label": t2(`board.ink.color.${c}`),
            "data-tip": t2(`board.ink.color.${c}`),
            "data-kbd": String(i + 1),
            onClick: () => set({ c }),
            children: /* @__PURE__ */ jsx("i", {})
          },
          c
        )) }),
        /* @__PURE__ */ jsxs("div", { className: `seg${inkless ? " off" : ""}`, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              className: `tool${ink2.ds ? " on" : ""}`,
              "aria-pressed": ink2.ds,
              disabled: inkless,
              "aria-label": t2("board.ink.dashed"),
              "data-tip": t2("board.ink.dashed"),
              onClick: () => set({ ds: !ink2.ds }),
              children: /* @__PURE__ */ jsx(Icon, { name: "dashed", size: 15 })
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              className: `tool smooth${ink2.sm ? " on" : ""} lv${ink2.sm}`,
              "aria-pressed": ink2.sm > 0,
              disabled: inkless,
              "aria-label": t2(SMOOTH_LABEL[ink2.sm]),
              "data-tip": t2(SMOOTH_LABEL[ink2.sm]),
              onClick: () => set({ sm: (ink2.sm + 1) % 3 }),
              children: [
                /* @__PURE__ */ jsx(Icon, { name: "smooth", size: 15 }),
                /* @__PURE__ */ jsx("b", { "aria-hidden": "true", children: ink2.sm === 2 ? "2" : "" })
              ]
            }
          )
        ] })
      ]
    }
  );
}
const MOVE_MS = 300;
const DWELL_MS = 110;
const TRAIL = 16;
const ease$1 = (t2) => t2 < 0.5 ? 4 * t2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 3) / 2;
const HermesCursor = forwardRef(
  function HermesCursor2({ reducedMotion, onActive }, ref) {
    const el = useRef(null);
    const actEl = useRef(null);
    const trailEl = useRef(null);
    const state = useRef({
      pos: null,
      queue: [],
      doneLabel: "",
      running: false,
      trail: [],
      idleTimer: 0,
      raf: 0
    });
    const activeCb = useRef(onActive);
    activeCb.current = onActive;
    const paint2 = (x, y, act) => {
      const s = state.current;
      s.pos = { x, y };
      if (el.current) el.current.style.transform = `translate(${x}px, ${y}px) scale(var(--iz, 1))`;
      if (act !== void 0 && actEl.current && actEl.current.textContent !== act) actEl.current.textContent = act;
      const now = performance.now();
      s.trail.push({ x, y, t: now });
      while (s.trail.length && now - s.trail[0].t > 1e3) s.trail.shift();
      const dots = trailEl.current?.children;
      if (dots) {
        const recent = s.trail.slice(-TRAIL * 3).filter((_, i, a) => (a.length - i) % 3 === 0);
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          const p = recent[recent.length - 1 - i];
          if (!p || Math.hypot(p.x - x, p.y - y) < 6) {
            d.style.opacity = "0";
            continue;
          }
          d.style.opacity = String(Math.max(0, (1 - (now - p.t) / 1e3) * 0.55));
          d.style.transform = `translate(${p.x}px, ${p.y}px) scale(var(--iz, 1))`;
        }
      }
    };
    const fadeTrail = () => {
      const s = state.current;
      const step = () => {
        if (!s.pos) return;
        paint2(s.pos.x, s.pos.y);
        if (s.trail.length > 1 && !s.running) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    };
    const setIdle = (idle) => {
      el.current?.classList.toggle("idle", idle);
    };
    const run = () => {
      const s = state.current;
      if (s.running) return;
      const next = s.queue.shift();
      if (!next) {
        if (actEl.current) actEl.current.textContent = s.doneLabel;
        activeCb.current?.(false, s.doneLabel);
        clearTimeout(s.idleTimer);
        s.idleTimer = setTimeout(() => setIdle(true), 4e3);
        fadeTrail();
        return;
      }
      const target = next.locate();
      if (!target) {
        next.onArrive?.();
        run();
        return;
      }
      s.running = true;
      clearTimeout(s.idleTimer);
      setIdle(false);
      activeCb.current?.(true, next.act);
      const from = s.pos ?? { x: target.x + 180, y: target.y - 90 };
      if (reducedMotion) {
        paint2(target.x, target.y, next.act);
        next.onArrive?.();
        s.running = false;
        setTimeout(run, 60);
        return;
      }
      const t0 = performance.now();
      const frame = (now) => {
        const k = Math.min(1, (now - t0) / MOVE_MS);
        const e = ease$1(k);
        paint2(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e, next.act);
        if (k < 1) {
          s.raf = requestAnimationFrame(frame);
          return;
        }
        next.onArrive?.();
        setTimeout(() => {
          s.running = false;
          run();
        }, DWELL_MS);
      };
      s.raf = requestAnimationFrame(frame);
    };
    useImperativeHandle(ref, () => ({
      enqueue: (steps, doneLabel) => {
        state.current.queue.push(...steps);
        state.current.doneLabel = doneLabel;
        requestAnimationFrame(() => requestAnimationFrame(run));
      },
      position: () => state.current.pos,
      active: () => state.current.running || state.current.queue.length > 0
    }));
    useEffect(() => () => {
      cancelAnimationFrame(state.current.raf);
      clearTimeout(state.current.idleTimer);
    }, []);
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "hb-trail", ref: trailEl, "aria-hidden": "true", children: Array.from({ length: TRAIL }, (_, i) => /* @__PURE__ */ jsx("i", { style: { position: "absolute", left: -1.5, top: -1.5, width: 3, height: 3, background: "var(--accent)", opacity: 0, transformOrigin: "1.5px 1.5px" } }, i)) }),
      /* @__PURE__ */ jsxs("div", { className: "hb-hcur idle", ref: el, "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx("svg", { className: "arrow", width: "20", height: "22", viewBox: "0 0 20 22", children: /* @__PURE__ */ jsx("path", { d: "M2.5 2 17 10.4 10 11.9 6.6 18.8z", fill: "var(--accent)", stroke: "var(--bg)", strokeWidth: "1.5", strokeLinejoin: "round" }) }),
        /* @__PURE__ */ jsxs("div", { className: "label", children: [
          /* @__PURE__ */ jsxs("span", { className: "name", children: [
            /* @__PURE__ */ jsx(Cad, { size: [8, 10] }),
            "HERMES"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "act", children: [
            /* @__PURE__ */ jsx("span", { ref: actEl }),
            /* @__PURE__ */ jsx("span", { className: "caret" })
          ] })
        ] })
      ] })
    ] });
  }
);
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.4;
function zoomView(v, f, sx, sy) {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * f));
  const wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
  return { z, x: sx - wx * z, y: sy - wy * z };
}
function cubicBezier(x1, y1, x2, y2) {
  const cx2 = 3 * x1, bx = 3 * (x2 - x1) - cx2, ax = 1 - cx2 - bx;
  const cy2 = 3 * y1, by = 3 * (y2 - y1) - cy2, ay = 1 - cy2 - by;
  const X2 = (s) => ((ax * s + bx) * s + cx2) * s;
  const Y = (s) => ((ay * s + by) * s + cy2) * s;
  const dX = (s) => (3 * ax * s + 2 * bx) * s + cx2;
  return (t2) => {
    if (t2 <= 0) return 0;
    if (t2 >= 1) return 1;
    let s = t2;
    for (let i = 0; i < 6; i++) {
      const err = X2(s) - t2;
      if (Math.abs(err) < 1e-6) return Y(s);
      const d = dX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0, hi = 1;
    s = t2;
    for (let i = 0; i < 24; i++) {
      const x = X2(s);
      if (Math.abs(x - t2) < 1e-6) break;
      if (x < t2) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return Y(s);
  };
}
function springEase(omega = 9) {
  const end = 1 - (1 + omega) * Math.exp(-omega);
  return (t2) => t2 <= 0 ? 0 : t2 >= 1 ? 1 : (1 - (1 + omega * t2) * Math.exp(-omega * t2)) / end;
}
const EASES = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.5, 0, 0.75, 0),
  linear: (t2) => Math.min(1, Math.max(0, t2)),
  spring: springEase()
};
function resolveEase(e, fallback = "inOut") {
  if (typeof e === "function") return e;
  if (Array.isArray(e)) return cubicBezier(e[0], e[1], e[2], e[3]);
  return EASES[e ?? fallback] ?? EASES[fallback];
}
function viewForRect(r, vp, o = {}) {
  const pad2 = o.pad ?? 60, minZ = o.minZ ?? ZOOM_MIN, maxZ = o.maxZ ?? ZOOM_MAX;
  const z = Math.max(minZ, Math.min(maxZ, (vp.w - 2 * pad2) / Math.max(1, r.w), (vp.h - 2 * pad2) / Math.max(1, r.h)));
  return { z, x: vp.w / 2 - (r.x + r.w / 2) * z, y: vp.h / 2 - (r.y + r.h / 2) * z };
}
function viewEquals(a, b, eps = 1e-3) {
  return Math.abs(a.z - b.z) < eps * Math.max(a.z, b.z) && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}
function mixView(a, b, u, vp) {
  if (u <= 0) return { ...a };
  if (u >= 1) return { ...b };
  const z = a.z * Math.pow(b.z / a.z, u);
  const cax = (vp.w / 2 - a.x) / a.z, cay = (vp.h / 2 - a.y) / a.z;
  const cbx = (vp.w / 2 - b.x) / b.z, cby = (vp.h / 2 - b.y) / b.z;
  const ia = 1 / a.z, ib = 1 / b.z;
  const p = Math.abs(ia - ib) < 1e-9 ? u : (1 / z - ia) / (ib - ia);
  const cx2 = cax + (cbx - cax) * p, cy2 = cay + (cby - cay) * p;
  return { z, x: vp.w / 2 - cx2 * z, y: vp.h / 2 - cy2 * z };
}
function flightDuration(a, b, vp) {
  const dz = Math.abs(Math.log2(b.z / a.z));
  const cax = (vp.w / 2 - a.x) / a.z, cay = (vp.h / 2 - a.y) / a.z;
  const cbx = (vp.w / 2 - b.x) / b.z, cby = (vp.h / 2 - b.y) / b.z;
  const dist = Math.hypot(cbx - cax, cby - cay) * Math.min(a.z, b.z) / Math.max(1, Math.hypot(vp.w, vp.h));
  return Math.round(Math.max(300, Math.min(650, 330 + 70 * dz + 220 * Math.min(1, dist))));
}
const realClock = {
  now: () => typeof performance !== "undefined" ? performance.now() : Date.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id)
};
class ManualClock {
  t = 0;
  id = 0;
  queue = /* @__PURE__ */ new Map();
  now() {
    return this.t;
  }
  request(cb) {
    const id = ++this.id;
    this.queue.set(id, cb);
    return id;
  }
  cancel(id) {
    this.queue.delete(id);
  }
  /** Advance `ms` in frames of `step` ms (the last one may be shorter), running what each frame queued. */
  advance(ms, step = 1e3 / 60) {
    let left = ms, frames = 0;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      left -= dt;
      this.t += dt;
      const run = [...this.queue.values()];
      this.queue.clear();
      for (const cb of run) cb(this.t);
      frames++;
    }
    return frames;
  }
  pending() {
    return this.queue.size;
  }
}
let clock = realClock;
const getCameraClock = () => clock;
function setCameraClock(c) {
  clock = c ?? realClock;
}
class Camera {
  flight = null;
  io;
  constructor(io) {
    this.io = io;
  }
  get moving() {
    return this.flight !== null;
  }
  /** Where the running move ends (null at rest). */
  get target() {
    return this.flight ? { ...this.flight.to } : null;
  }
  /** Moves to `to`; resolves true when it arrives, false when something cut it short. */
  flyTo(to, o = {}) {
    this.stop(false);
    const from = this.io.get();
    const size = this.io.size();
    const dur = this.io.reduced?.() ? 0 : o.duration ?? flightDuration(from, to, size);
    if (dur <= 0 || viewEquals(from, to)) {
      this.io.set({ ...to });
      o.onFrame?.(1, to);
      return Promise.resolve(true);
    }
    return new Promise((resolve2) => {
      const c = getCameraClock();
      const f = { from, to: { ...to }, t0: c.now(), dur, ease: resolveEase(o.ease), id: 0, done: resolve2, onFrame: o.onFrame, clock: c };
      this.flight = f;
      this.io.onMoving?.(true);
      const step = (now) => {
        if (this.flight !== f) return;
        const u = Math.min(1, Math.max(0, (now - f.t0) / f.dur));
        const e = f.ease(u);
        const v = u >= 1 ? { ...f.to } : mixView(f.from, f.to, e, this.io.size());
        this.io.set(v);
        f.onFrame?.(e, v);
        if (u >= 1) {
          this.flight = null;
          this.io.onMoving?.(false);
          f.done(true);
          return;
        }
        f.id = f.clock.request(step);
      };
      f.id = c.request(step);
    });
  }
  /** Zoom by factor `f` around a screen point, building on the running move's target so
   *  repeated presses accumulate. */
  zoomBy(f, sx, sy, o = {}) {
    const base = this.target ?? this.io.get();
    return this.flyTo(zoomView(base, f, sx, sy), { duration: 220, ease: "out", ...o });
  }
  /** Cuts the running move where it is (user input wins). */
  cancel() {
    this.stop(true);
  }
  stop(notify) {
    const f = this.flight;
    if (!f) return;
    this.flight = null;
    f.clock.cancel(f.id);
    if (notify) this.io.onMoving?.(false);
    f.done(false);
  }
}
let manual = null;
const cameraClockApi = {
  manual: (on) => {
    if (on) {
      manual = manual ?? new ManualClock();
      setCameraClock(manual);
    } else {
      manual = null;
      setCameraClock(null);
    }
  },
  advance: (ms, step) => manual ? manual.advance(ms, step) : 0,
  now: () => getCameraClock().now()
};
function installClockApi(win = window) {
  win.__hbClock = cameraClockApi;
}
function installCameraApi(api2, win = window) {
  win.__hbCamera = api2;
  installClockApi(win);
  const onReq = (e) => {
    const d = e.detail ?? {};
    void api2.flyTo(d).then((completed) => {
      win.dispatchEvent?.(new CustomEvent("hb:camera:end", { detail: { id: d.id, completed, view: api2.getView() } }));
    });
  };
  win.addEventListener?.("hb:camera", onReq);
  return () => {
    if (win.__hbCamera === api2) delete win.__hbCamera;
    win.removeEventListener?.("hb:camera", onReq);
  };
}
const IDLE_MS = 2600;
function PresenterHud({ p, t: t2, board }) {
  const [idle, setIdle] = useState(false);
  const timer = useRef(0);
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      window.clearTimeout(timer.current);
    };
  }, []);
  if (!p.hud || !p.stops.length) return null;
  const n = p.stops.length, i = Math.min(p.ps.i, n - 1);
  const last = i >= n - 1;
  return /* @__PURE__ */ jsxs("div", { className: `hb-present${idle ? " idle" : ""}`, role: "toolbar", "aria-label": t2("board.present.label"), onPointerDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsx("button", { className: "ib", "aria-label": t2("board.present.prev"), "data-tip": t2("board.present.prev"), "data-kbd": "←", disabled: i === 0 && !p.tour?.loop, onClick: p.prev, children: /* @__PURE__ */ jsx(Icon, { name: "prev", size: 15 }) }),
    /* @__PURE__ */ jsxs("div", { className: "who", "aria-live": "polite", children: [
      /* @__PURE__ */ jsxs("span", { className: "k", children: [
        p.depth > 0 ? `${board} · ` : "",
        String(i + 1).padStart(2, "0"),
        /* @__PURE__ */ jsx("i", { children: "/" }),
        String(n).padStart(2, "0")
      ] }),
      /* @__PURE__ */ jsx("b", { children: p.title }),
      p.note && /* @__PURE__ */ jsx("span", { className: "note", children: p.note })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "cells", "aria-hidden": "true", children: p.stops.map((_, j) => /* @__PURE__ */ jsx("i", { className: j < i ? "past" : j === i ? "on" : "" }, j)) }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "ib",
        "aria-label": last && !p.tour?.loop ? t2("board.present.finish") : t2("board.present.next"),
        "data-tip": last && !p.tour?.loop ? t2("board.present.finish") : t2("board.present.next"),
        "data-kbd": "→",
        onClick: p.next,
        children: /* @__PURE__ */ jsx(Icon, { name: "next", size: 15 })
      }
    ),
    /* @__PURE__ */ jsx("i", { className: "sep" }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `ib${p.ps.auto ? " on" : ""}`,
        "aria-pressed": p.ps.auto,
        "aria-label": t2("board.present.auto"),
        "data-tip": t2("board.present.auto"),
        "data-kbd": "P",
        onClick: p.toggleAuto,
        children: /* @__PURE__ */ jsx(Icon, { name: p.ps.auto ? "pause" : "play", size: 15 })
      }
    ),
    /* @__PURE__ */ jsx("button", { className: "ib", "aria-label": t2("board.present.exit"), "data-tip": t2("board.present.exit"), "data-kbd": "Esc", onClick: p.stop, children: /* @__PURE__ */ jsx(Icon, { name: "close", size: 15 }) })
  ] });
}
const DEFAULT_DWELL_S = 4;
function liveStops(doc) {
  const tour = doc?.tour;
  if (!tour) return [];
  return tour.stops.filter((s) => s.id ? !!doc.items[s.id] && doc.items[s.id].k !== "line" : !!(s.r || s.v));
}
function itemTitle(it) {
  return ((it?.title || it?.text || it?.cap || it?.label || it?.note || "").trim().split("\n")[0] ?? "").slice(0, 80);
}
function stopTitle(stop, doc, n) {
  if (stop.t) return stop.t;
  const it = stop.id ? doc?.items[stop.id] : void 0;
  return itemTitle(it) || String(n);
}
function stopNote(stop, doc) {
  const it = stop.id ? doc?.items[stop.id] : void 0;
  return it?.k === "frame" ? (it.note ?? "").trim().split("\n")[0].slice(0, 120) : "";
}
const hasDwell = (tour) => !!tour && (!!tour.dw || tour.stops.some((s) => !!s.dw));
const dwellOf = (stop, tour) => stop.dw ?? tour?.dw ?? DEFAULT_DWELL_S;
function framesAsStops(doc, rectOf) {
  const rows = [];
  const all = Object.entries(doc.items).filter(([, it]) => it.k === "frame" && !it.in).map(([id]) => ({ id, r: rectOf(id) })).filter((f) => !!f.r).sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);
  for (const f of all) {
    const row = rows.find((r) => Math.abs(f.r.y - r[0].r.y) <= Math.max(40, 0.5 * Math.min(f.r.h, r[0].r.h)));
    if (row) row.push(f);
    else rows.push([f]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.r.x - b.r.x)).map((f) => ({ k: "frame", id: f.id }));
}
function withStop(tour, stop) {
  return { ...tour ?? { stops: [] }, stops: [...tour?.stops ?? [], stop] };
}
class TourPlayer {
  io;
  token = 0;
  timer = null;
  duration;
  state = { on: false, i: 0, n: 0, auto: false, flying: false, done: false };
  constructor(io) {
    this.io = io;
  }
  set(p) {
    this.state = { ...this.state, ...p };
    this.io.onState?.(this.state);
  }
  clearTimer() {
    if (this.timer) {
      this.timer.clock.cancel(this.timer.id);
      this.timer = null;
    }
  }
  /** Begins at stop `index` (default 0). Resolves when the camera arrives. */
  start(index = 0, o = {}) {
    const stops = this.io.stops();
    this.duration = o.duration;
    this.set({ on: true, n: stops.length, auto: o.auto ?? hasDwell(this.io.tour()), done: false });
    if (!stops.length) {
      this.finish("end");
      return Promise.resolve(false);
    }
    return this.goto(index);
  }
  /** Flies to stop `index`, skipping any that cannot be shown (`dir` says which way to look on). */
  async goto(index, dir = 1) {
    const stops = this.io.stops();
    const n = stops.length;
    this.clearTimer();
    const tok = ++this.token;
    let i = Math.max(0, Math.min(n - 1, index));
    let view = n ? this.io.view(stops[i]) : null;
    while (!view && i + dir >= 0 && i + dir < n) {
      i += dir;
      view = this.io.view(stops[i]);
    }
    if (!view) {
      this.finish("end");
      return false;
    }
    this.set({ i, n, flying: true, done: false });
    const ok = await this.io.fly(view, { duration: this.duration });
    if (tok !== this.token) return false;
    this.set({ flying: false });
    if (ok) this.arm(tok);
    return ok;
  }
  /** Waits the stop's dwell on the camera clock (so a manual clock steps it), then moves on. */
  arm(tok) {
    if (!this.state.auto || !this.state.on) return;
    const stop = this.io.stops()[this.state.i];
    if (!stop) return;
    const clock2 = this.io.clock();
    const deadline = clock2.now() + dwellOf(stop, this.io.tour()) * 1e3;
    const tick = (t2) => {
      if (tok !== this.token || !this.state.auto) return;
      if (t2 >= deadline) {
        this.timer = null;
        void this.next();
        return;
      }
      this.timer = { id: clock2.request(tick), clock: clock2 };
    };
    this.timer = { id: clock2.request(tick), clock: clock2 };
  }
  next() {
    if (!this.state.on) return Promise.resolve(false);
    const stops = this.io.stops();
    const cur = stops[this.state.i];
    if (cur?.k === "board" && !this.state.flying && this.io.enter?.(cur, this.state.i, this.state.auto)) {
      this.token++;
      this.clearTimer();
      this.set({ on: false });
      return Promise.resolve(true);
    }
    if (this.state.i >= stops.length - 1) {
      if (this.io.tour()?.loop && stops.length > 1) return this.goto(0);
      this.finish("end");
      return Promise.resolve(false);
    }
    return this.goto(this.state.i + 1, 1);
  }
  prev() {
    if (!this.state.on) return Promise.resolve(false);
    return this.state.i > 0 ? this.goto(this.state.i - 1, -1) : this.goto(0);
  }
  setAuto(on) {
    this.set({ auto: on });
    if (!on) this.clearTimer();
    else if (this.state.on && !this.state.flying && !this.timer) this.arm(this.token);
  }
  toggleAuto() {
    this.setAuto(!this.state.auto);
  }
  /** Silently drops timers and in-flight work (the board unmounted); no onEnd. */
  dispose() {
    this.token++;
    this.clearTimer();
  }
  /** Stops at the current stop and hands control back. */
  stop() {
    this.finish("stop");
  }
  finish(why) {
    this.token++;
    this.clearTimer();
    if (why === "stop") this.io.cancel();
    this.set({ on: false, flying: false, done: why === "end" });
    this.io.onEnd?.(why);
  }
}
let carry = null;
const peekCarry = () => carry;
const clearCarry = () => {
  carry = null;
};
function carryInto(from, index, child, auto, duration) {
  carry = { stack: [...carry?.stack ?? [], { board: from, index, auto }], phase: "in", target: child, duration };
}
function carryOut() {
  if (!carry || !carry.stack.length) {
    carry = null;
    return null;
  }
  carry = { ...carry, phase: "out", target: carry.stack[carry.stack.length - 1].board };
  return carry.target;
}
function claimCarry(bid) {
  const c = carry;
  if (!c) return null;
  if (c.target !== bid) {
    carry = null;
    return null;
  }
  if (c.phase === "in") return { role: "child", depth: c.stack.length, auto: c.stack[c.stack.length - 1]?.auto ?? false, duration: c.duration };
  const top = c.stack[c.stack.length - 1];
  const rest = c.stack.slice(0, -1);
  carry = rest.length ? { ...c, stack: rest, phase: "in", target: bid } : null;
  return { role: "resume", index: top.index + 1, auto: top.auto, depth: rest.length, duration: c.duration };
}
function installTourApi(api2, win = window) {
  win.__hbTour = api2;
  return () => {
    if (win.__hbTour === api2) delete win.__hbTour;
  };
}
const INITIAL = { on: false, i: 0, n: 0, auto: false, flying: false, done: false };
const CINEMA = 1.9;
function usePresentation(d) {
  const [ps, setPs] = useState(INITIAL);
  const [presenting, setPresenting] = useState(() => {
    const c = peekCarry();
    return !!c && c.target === d.bid;
  });
  const presentingRef = useRef(presenting);
  presentingRef.current = presenting;
  const [hud, setHud] = useState(true);
  const [depth, setDepth] = useState(0);
  const depthRef = useRef(0);
  const dep = useRef(d);
  dep.current = d;
  const doc = d.doc;
  const tour = doc?.tour;
  const stored = !!tour?.stops.length;
  const stopsNow = useCallback(() => {
    const { docRef, getRect, contentBounds } = dep.current;
    const cur2 = docRef.current;
    if (!cur2) return [];
    const own = liveStops(cur2);
    if (own.length) return own;
    if (!cur2.tour?.stops.length) {
      const frames = framesAsStops(cur2, getRect);
      if (frames.length) return frames;
    }
    if (depthRef.current > 0) {
      const b = contentBounds();
      if (b) return [{ k: "view", r: { x: b.x - 140, y: b.y - 120, w: b.w + 280, h: b.h + 240 } }];
    }
    return [];
  }, []);
  const viewOf = useCallback((stop2) => {
    const { vpRef, getRect } = dep.current;
    const vp = vpRef.current;
    if (!vp) return null;
    if (stop2.v) return { ...stop2.v };
    const r = stop2.r ?? (stop2.id ? getRect(stop2.id) : null);
    if (!r) return null;
    const size = { w: vp.clientWidth, h: vp.clientHeight };
    const frame = stop2.k === "frame" || stop2.k === "view";
    return viewForRect(r, size, { pad: frame ? 64 : 120, maxZ: frame ? 2.2 : 1.4, minZ: 0.05 });
  }, []);
  const playerRef = useRef(null);
  const hudRef = useRef(true);
  const fsRef = useRef(false);
  const arrived = useRef(null);
  const exitFullscreen = useCallback(() => {
    if (fsRef.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {
    });
    fsRef.current = false;
  }, []);
  const player = useMemo(() => {
    const p = new TourPlayer({
      stops: () => stopsNow(),
      tour: () => dep.current.docRef.current?.tour,
      view: (s) => viewOf(s),
      fly: (to, o) => {
        const c = dep.current.cam.current;
        const from = dep.current.view.current;
        const vp = dep.current.vpRef.current;
        const size = { w: vp?.clientWidth ?? 1, h: vp?.clientHeight ?? 1 };
        const dur = o.duration ?? Math.round(Math.min(1700, Math.max(700, flightDuration(from, to, size) * CINEMA)));
        return c.flyTo(to, { duration: dur, ease: "inOut" });
      },
      cancel: () => dep.current.cam.current?.cancel(),
      clock: () => getCameraClock(),
      enter: (stop2, index, auto) => {
        const ref = dep.current.docRef.current?.items[stop2.id ?? ""]?.ref;
        if (!ref) return false;
        carryInto(dep.current.bid, index, ref, auto, void 0);
        dep.current.openChild(ref);
        return true;
      },
      onEnd: (why) => {
        if (why === "end" && depthRef.current > 0) {
          const parent = carryOut();
          if (parent) {
            dep.current.closeToParent(parent);
            return;
          }
        }
        clearCarry();
        exitFullscreen();
        depthRef.current = 0;
        setDepth(0);
        setPresenting(false);
        arrived.current?.(false);
      },
      onState: (s) => setPs(s)
    });
    playerRef.current = p;
    return p;
  }, [exitFullscreen, stopsNow, viewOf]);
  const rectBefore = useRef(null);
  const markViewport = () => {
    rectBefore.current = dep.current.vpRef.current?.getBoundingClientRect() ?? null;
  };
  const pending2 = useRef(null);
  useLayoutEffect(() => {
    const vp = dep.current.vpRef.current, before = rectBefore.current;
    rectBefore.current = null;
    if (vp && before) {
      const after = vp.getBoundingClientRect();
      const v = dep.current.view.current;
      if (after.left !== before.left || after.top !== before.top) {
        dep.current.view.current = { ...v, x: v.x + before.left - after.left, y: v.y + before.top - after.top };
        dep.current.applyView();
      }
    }
    const p = pending2.current;
    if (presenting && p) {
      pending2.current = null;
      void player.start(p.from, { auto: p.o.auto, duration: p.o.duration }).then((ok) => arrived.current?.(ok));
    }
  }, [presenting, player]);
  const begin = useCallback((from, o, sub = 0) => {
    depthRef.current = sub;
    setDepth(sub);
    hudRef.current = o.hud !== false;
    setHud(hudRef.current);
    dep.current.stopCamera();
    pending2.current = { from, o };
    if (presentingRef.current) {
      pending2.current = null;
      return player.start(from, { auto: o.auto, duration: o.duration });
    }
    markViewport();
    setPresenting(true);
    return new Promise((res) => {
      arrived.current = res;
    });
  }, [player]);
  const start = useCallback((o = {}) => {
    if (!stopsNow().length) return Promise.resolve(false);
    clearCarry();
    if (o.fullscreen) {
      fsRef.current = true;
      void document.documentElement.requestFullscreen?.().catch(() => {
        fsRef.current = false;
      });
    }
    return begin(o.from ?? 0, o, 0);
  }, [begin, stopsNow]);
  const stop = useCallback(() => player.stop(), [player]);
  const next = useCallback(() => {
    void player.next();
  }, [player]);
  const prev = useCallback(() => {
    void player.prev();
  }, [player]);
  const toggleAuto = useCallback(() => player.toggleAuto(), [player]);
  const claimed = useRef(null);
  useEffect(() => {
    if (!d.ready || claimed.current === d.bid) return;
    claimed.current = d.bid;
    const role = claimCarry(d.bid);
    if (!role) return;
    const go = () => {
      if (role.role === "child") {
        void begin(0, { auto: role.auto || void 0, duration: role.duration }, role.depth);
        return;
      }
      const n = stopsNow().length;
      depthRef.current = role.depth;
      if (role.index >= n) {
        if (role.depth > 0) {
          const parent = carryOut();
          if (parent) {
            dep.current.closeToParent(parent);
            return;
          }
        }
        setPresenting(false);
        return;
      }
      void begin(role.index, { auto: role.auto, duration: role.duration }, role.depth);
    };
    const wait2 = d.arrival.current;
    if (wait2) void wait2.then(go, go);
    else go();
  }, [begin, d.arrival, d.bid, d.ready, stopsNow]);
  useEffect(() => {
    claimed.current = null;
  }, [d.bid]);
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const eat = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      if (e.type === "keyup") {
        if (k === " ") eat();
        return;
      }
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === "Enter") {
        eat();
        next();
      } else if (k === " ") {
        eat();
        if (playerRef.current?.state.auto) toggleAuto();
        else next();
      } else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") {
        eat();
        prev();
      } else if (k === "Home") {
        eat();
        void player.goto(0);
      } else if (k === "End") {
        eat();
        void player.goto(Math.max(0, stopsNow().length - 1));
      } else if (k === "Escape") {
        eat();
        stop();
      } else if (k === "p" || k === "P") {
        eat();
        toggleAuto();
      } else if (k === "h" || k === "H") {
        eat();
        hudRef.current = !hudRef.current;
        setHud(hudRef.current);
      } else if (k === "f" || k === "F") {
        eat();
        if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {
        });
        else {
          fsRef.current = true;
          void document.documentElement.requestFullscreen?.().catch(() => {
            fsRef.current = false;
          });
        }
      } else eat();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [next, player, presenting, prev, stop, stopsNow, toggleAuto]);
  useEffect(() => {
    if (!presenting) return;
    const onFs = () => {
      if (fsRef.current && !document.fullscreenElement) {
        fsRef.current = false;
        stop();
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [presenting, stop]);
  useEffect(() => () => {
    playerRef.current?.dispose();
  }, []);
  useEffect(() => {
    if (!d.ready) return;
    const api2 = {
      version: 1,
      board: d.bid,
      stops: () => stopsNow().map((stop2, i) => ({ stop: stop2, title: stopTitle(stop2, dep.current.docRef.current, i + 1), view: viewOf(stop2) })),
      state: () => playerRef.current?.state ?? INITIAL,
      start: (o) => start(o),
      next: () => player.next(),
      prev: () => player.prev(),
      goto: (i) => player.goto(i),
      auto: (on) => player.setAuto(on),
      stop: () => player.stop(),
      hud: (on) => {
        hudRef.current = on;
        setHud(on);
      }
    };
    return installTourApi(api2);
  }, [d.bid, d.ready, player, start, stopsNow, viewOf]);
  const stops = useMemo(() => stopsNow(), [stopsNow, doc, presenting, ps.n, ps.on]);
  const cur = stops[ps.i];
  return {
    presenting,
    ps,
    hud,
    stops,
    tour,
    stored,
    depth,
    title: cur ? stopTitle(cur, doc, ps.i + 1) : "",
    note: cur ? stopNote(cur, doc) : "",
    count: () => stopsNow().length,
    start,
    stop,
    next,
    prev,
    toggleAuto
  };
}
const clone = (v) => v === void 0 ? v : JSON.parse(JSON.stringify(v));
function insertKid(items, col, id, at) {
  const c = items[col];
  if (!c || c.k !== "col") return;
  const kids = c.kids ?? (c.kids = []);
  if (kids.includes(id)) return;
  const idx2 = at == null ? kids.length : Math.max(0, Math.min(kids.length, Math.round(at)));
  kids.splice(idx2, 0, id);
}
function removeKid(items, id) {
  const col = items[id]?.in;
  const c = col ? items[col] : void 0;
  if (c?.kids) c.kids = c.kids.filter((k) => k !== id);
}
function putItem(doc, id, raw, at) {
  const item = clone(raw);
  doc.items[id] = item;
  if (/^[a-z0-9]{1,8}$/.test(id)) doc.n = Math.max(doc.n, parseInt(id, 36) + 1);
  if (item.in) {
    delete item.x;
    delete item.y;
    insertKid(doc.items, item.in, id, at);
  }
}
function applyOp(doc, op) {
  const items = doc.items;
  switch (op.op) {
    case "put":
      putItem(doc, op.id, op.item, op.at);
      return;
    case "add": {
      const id = op.ref ?? `$local${Object.keys(items).length}`;
      const item = clone(op.item);
      if (item.k === "col" && !item.kids) item.kids = [];
      putItem(doc, id, item, op.at);
      return;
    }
    case "set": {
      const it = items[op.id];
      if (!it) return;
      const p = op.p;
      if ("in" in p) {
        const next = p.in;
        if (next !== (it.in ?? null)) {
          removeKid(items, op.id);
          if (next) {
            it.in = next;
            delete it.x;
            delete it.y;
            insertKid(items, next, op.id, op.at);
          } else {
            delete it.in;
          }
        }
      }
      for (const [key, value] of Object.entries(p)) {
        if (key === "in" || key === "k" || key === "by") continue;
        if (key === "x" || key === "y") {
          if (it.in) continue;
        }
        if (value === null || value === void 0) delete it[key];
        else it[key] = clone(value);
      }
      return;
    }
    case "del": {
      const it = items[op.id];
      if (!it) return;
      const doomed = /* @__PURE__ */ new Set([op.id, ...it.k === "col" ? it.kids ?? [] : []]);
      for (const [k, v] of Object.entries(items)) {
        if (v.k === "line" && [v.a, v.b].some((e) => typeof e === "string" && doomed.has(e))) doomed.add(k);
      }
      removeKid(items, op.id);
      for (const k of doomed) delete items[k];
      return;
    }
    case "tour":
      if (op.tour && op.tour.stops) doc.tour = clone(op.tour);
      else delete doc.tour;
      return;
    case "board":
      if (typeof op.p.name === "string") doc.name = op.p.name;
      return;
  }
}
function normalizeDeletes(doc, ids) {
  const want = [...new Set(ids)].filter((id) => doc.items[id]);
  const set = new Set(want);
  const gone = /* @__PURE__ */ new Set();
  for (const id of want) {
    const it = doc.items[id];
    if (it.in && set.has(it.in)) gone.add(id);
    if (it.k === "col") for (const kid of it.kids ?? []) gone.add(kid);
  }
  const removed = new Set([...set].filter((id) => !(doc.items[id].in && set.has(doc.items[id].in))));
  for (const id of want) if (doc.items[id].k === "col") for (const kid of doc.items[id].kids ?? []) removed.add(kid);
  return want.filter((id) => {
    const it = doc.items[id];
    if (gone.has(id)) return false;
    if (it.k === "line") return ![it.a, it.b].some((e) => typeof e === "string" && removed.has(e));
    return true;
  });
}
function applyOps(doc, ops) {
  const next = clone(doc);
  for (const op of ops) applyOp(next, op);
  return next;
}
function applyEntries(doc, entries) {
  let next = doc;
  for (const e of entries) {
    if (e.s <= next.seq) continue;
    next = applyOps(next, e.ops);
    next.seq = e.s;
    next.updated = e.t;
  }
  return next;
}
function remapIds(ops, ids) {
  const map = (v) => typeof v === "string" && v in ids ? ids[v] : v;
  return ops.map((op) => {
    const o = clone(op);
    if ("id" in o) o.id = map(o.id);
    const bag = o.item ?? o.p;
    if (bag) {
      for (const key of ["a", "b", "in"]) if (key in bag) bag[key] = map(bag[key]);
      if (Array.isArray(bag.kids)) bag.kids = bag.kids.map(map);
    }
    return o;
  });
}
let refCounter = 0;
function newRef() {
  refCounter = (refCounter + 1) % 1e9;
  return `$u${Date.now().toString(36).slice(-4)}${refCounter.toString(36)}`;
}
function itemLabel(item) {
  return (item.title || item.text || item.cap || item.url || item.src || item.label || item.note || "").trim();
}
const DEFAULT_SIZE = {
  card: [256, 120],
  todo: [304, 240],
  col: [276, 320],
  link: [276, 250],
  image: [372, 260],
  embed: [452, 320],
  video: [400, 260],
  board: [212, 170],
  frame: [480, 320],
  box: [196, 62],
  text: [420, 40],
  draw: [120, 80],
  live: [400, 300],
  shape: [160, 56],
  comp: [480, 320]
};
function liveMetricRows(n, w) {
  if (n <= 0) return 1;
  const cols = w < 380 ? Math.min(n, 2) : n <= 4 ? n : n <= 6 ? 3 : 4;
  return Math.ceil(n / cols);
}
const SHAPE_SIZE = { rect: [160, 56], diamond: [150, 100], pill: [150, 48], circle: [72, 72] };
function liveHeight(item) {
  const w = item.w ?? 400;
  let h = 40;
  for (const b of item.blocks ?? []) {
    h += { header: 60, progress: 46, metrics: 74 * (b.t === "metrics" ? liveMetricRows(b.items?.length ?? 0, w) : 1), spark: 66, media: Math.round(w * 9 / 16) + 26, text: 22 + 16 * (b.t === "text" ? b.lines ?? 6 : 0), actions: 46 }[b.t] ?? 40;
  }
  return h;
}
function approxRect(item) {
  if (item.k === "line" || item.in || item.x == null || item.y == null) return null;
  const [dw, dh] = (item.k === "shape" ? SHAPE_SIZE[item.sh ?? "rect"] : void 0) ?? DEFAULT_SIZE[item.k] ?? [200, 100];
  let h = item.h ?? dh;
  if (item.k === "col") h = 60 + 96 * (item.kids?.length ?? 0);
  if (item.k === "todo") h = 110 + 26 * (item.items?.length ?? 0);
  if (item.k === "live") h = item.h ?? liveHeight(item);
  if (item.k === "image" && item.h == null && item.iw && item.ih) h = Math.round(((item.w ?? dw) - 14) * item.ih / item.iw + 56);
  if (item.k === "draw" && item.d) {
    const pts = item.d.split(" ").map((p) => p.split(",").map(Number));
    const xs2 = pts.map((p) => p[0]), ys2 = pts.map((p) => p[1]);
    return { x: item.x + Math.min(...xs2), y: item.y + Math.min(...ys2), w: Math.max(...xs2) - Math.min(...xs2) + 1, h: Math.max(...ys2) - Math.min(...ys2) + 1 };
  }
  return { x: item.x, y: item.y, w: item.w ?? dw, h };
}
function previewRects(doc) {
  const out = [];
  for (const it of Object.values(doc.items)) {
    const r = approxRect(it);
    if (r) out.push({ r, h: it.by === "h", frame: it.k === "frame" || it.k === "text" });
  }
  return out;
}
function previewGeometry(doc, W, H, pad2 = 30) {
  const rects = doc ? previewRects(doc) : [];
  const b = boundsOf(rects.map((x) => x.r)) ?? { x: 0, y: 0, w: 1, h: 1 };
  const s = Math.min(W / (b.w + pad2 * 2), H / (b.h + pad2 * 2));
  return { s, ox: (W - b.w * s) / 2 - b.x * s, oy: (H - b.h * s) / 2 - b.y * s, b };
}
function drawPreview(canvas, doc, opts) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cell = opts.cell ?? 6;
  const rects = doc ? previewRects(doc) : [];
  const { s, ox, oy } = previewGeometry(doc, W, H);
  ctx.fillStyle = opts.accent;
  for (let y = cell / 2; y < H; y += cell) {
    for (let x = cell / 2; x < W; x += cell) {
      const wx = (x - ox) / s, wy = (y - oy) / s;
      let hit = null;
      for (const it of rects) {
        if (wx >= it.r.x && wx <= it.r.x + it.r.w && wy >= it.r.y && wy <= it.r.y + it.r.h) {
          if (!it.frame || !hit) hit = it;
        }
      }
      let a = 0.07, sz = 1.2;
      if (hit) {
        a = hit.frame ? 0.16 : hit.h ? 0.85 : 0.5;
        sz = hit.frame ? 1.2 : cell * 0.62;
      }
      ctx.globalAlpha = a;
      ctx.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
    }
  }
  if (opts.hermesAt) {
    const hx = ox + opts.hermesAt.x * s, hy = oy + opts.hermesAt.y * s;
    ctx.globalAlpha = 1;
    ctx.fillRect(Math.round(hx - cell * 0.8), Math.round(hy - cell * 0.8), cell * 1.6, cell * 1.6);
    ctx.clearRect(Math.round(hx - cell * 0.3), Math.round(hy - cell * 0.3), cell * 0.6, cell * 0.6);
  }
  ctx.globalAlpha = 1;
}
function accentOf(el, fallback = "#ffe3c4") {
  if (!el) return fallback;
  const v = getComputedStyle(el).getPropertyValue("--accent").trim() || getComputedStyle(el).getPropertyValue("--home-accent").trim();
  if (!v) return fallback;
  const probe = document.createElement("span");
  probe.style.color = v;
  probe.style.display = "none";
  el.appendChild(probe);
  const c = getComputedStyle(probe).color || fallback;
  probe.remove();
  return c;
}
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = /* @__PURE__ */ new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com"
]);
const X_HOSTS = /* @__PURE__ */ new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "mobile.x.com"]);
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
function classifyUrl(raw) {
  if (typeof raw !== "string") return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:" || !u.hostname) return null;
  const host2 = u.hostname.toLowerCase();
  const segs = u.pathname.split("/").filter(Boolean);
  if (YT_HOSTS.has(host2)) {
    let id = null;
    let vert = false;
    if (segs[0] === "watch") id = u.searchParams.get("v");
    else if (segs.length >= 2 && ["shorts", "embed", "live", "v"].includes(segs[0])) {
      id = segs[1];
      vert = segs[0] === "shorts";
    }
    if (id && YT_ID.test(id)) return vert ? { kind: "video", p: "youtube", id, vert: true } : { kind: "video", p: "youtube", id };
  } else if (host2 === "youtu.be" || host2 === "www.youtu.be") {
    if (segs[0] && YT_ID.test(segs[0])) return { kind: "video", p: "youtube", id: segs[0] };
  } else if (host2 === "vimeo.com" || host2 === "www.vimeo.com" || host2 === "player.vimeo.com") {
    const num = segs.find((s) => /^\d+$/.test(s));
    if (num && (host2 !== "player.vimeo.com" || segs[0] === "video")) return { kind: "video", p: "vimeo", id: num };
  } else if (host2 === "loom.com" || host2 === "www.loom.com") {
    if (segs.length >= 2 && (segs[0] === "share" || segs[0] === "embed") && /^[A-Za-z0-9]{8,64}$/.test(segs[1])) {
      return { kind: "video", p: "loom", id: segs[1] };
    }
  } else if (X_HOSTS.has(host2)) {
    if (segs.length >= 3 && segs[1] === "status" && /^\d{1,25}$/.test(segs[2])) return { kind: "video", p: "x", id: segs[2] };
  }
  if (VIDEO_EXT.test(u.pathname)) return { kind: "file-video" };
  if (IMAGE_EXT.test(u.pathname)) return { kind: "image" };
  return { kind: "page" };
}
const PLAYER_ID = {
  youtube: YT_ID,
  vimeo: /^\d{1,20}$/,
  loom: /^[A-Za-z0-9]{8,64}$/,
  x: /^\d{1,25}$/
};
function playerUrl(v) {
  const re = PLAYER_ID[v.p];
  if (!re || !re.test(v.id)) return null;
  switch (v.p) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
    case "vimeo":
      return `https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1`;
    case "loom":
      return `https://www.loom.com/embed/${v.id}?autoplay=1`;
    case "x":
      return `https://platform.twitter.com/embed/Tweet.html?id=${v.id}&dnt=true&theme=dark`;
  }
  return null;
}
function extractUrl(text) {
  const s = (text || "").trim();
  if (!s || /\s/.test(s) || s.length > 2048) return null;
  return classifyUrl(s) ? s : null;
}
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
const PLAY$1 = /* @__PURE__ */ jsx("svg", { viewBox: "0 0 10 12", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M0 0 10 6 0 12z" }) });
function clockDuration(s) {
  if (!s || !Number.isFinite(s) || s <= 0) return "";
  const t2 = Math.round(s), h = Math.floor(t2 / 3600), m = Math.floor(t2 % 3600 / 60), sec = t2 % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
function useVideoPoster(src, asset, posterAsset, posterUrl, knownDur) {
  const [st, setSt] = useState({ url: posterUrl ?? null, dur: knownDur });
  useEffect(() => {
    let live = true;
    setSt({ url: posterUrl ?? null, dur: knownDur });
    const set = (p) => {
      if (live) setSt((s) => ({ ...s, ...p }));
    };
    if (posterAsset) {
      assetUrl(posterAsset).then((u) => set({ url: u }), () => void 0);
      if (knownDur || !src && !asset) return () => {
        live = false;
      };
    }
    if (!src && !asset) return () => {
      live = false;
    };
    const ref = asset ? { asset } : { src };
    const fromPoster = (p) => {
      if (p.dur) set({ dur: p.dur });
      if (p.st === "ok" && p.img && !posterAsset && !posterUrl) assetUrl(p.img).then((u) => set({ url: u }), () => void 0);
    };
    videoPoster(ref).then(async (p) => {
      if (p.st === "ok") {
        fromPoster(p);
        return;
      }
      if (posterAsset || posterUrl) return;
      try {
        const url = asset ? await mediaUrl(asset) : src;
        const f = await grabFrame(url);
        const saved = await boardsApi.posterFromClient(ref, f.data, f.dur);
        rememberPoster(ref, saved);
        fromPoster(saved);
      } catch {
        if (src) set({ live: src });
      }
    }, () => {
      if (src && !posterAsset && !posterUrl) set({ live: src });
    });
    return () => {
      live = false;
    };
  }, [src, asset, posterAsset, posterUrl, knownDur]);
  return { ...st, setDur: (d) => setSt((s) => s.dur ? s : { ...s, dur: d }) };
}
function VideoStage({ playId, c, src, asset, posterAsset, posterUrl, dur, title, vert, syncGroup, style }) {
  const poster = useVideoPoster(src, asset, posterAsset, posterUrl, dur);
  const synced = !!syncGroup && !!(src || asset);
  const playing = c.playing === playId || synced;
  const [vel, setVel] = useState(null);
  const clock2 = syncGroup ? c.sync.clock(syncGroup) : null;
  useEffect(() => vel && clock2 ? clock2.attachVideo(vel) : void 0, [vel, clock2]);
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!playing || !asset || blob) return;
    let live = true;
    setLoading(true);
    mediaUrl(asset).then((u) => {
      if (live) {
        setBlob(u);
        setLoading(false);
      }
    }, () => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [playing, asset, blob]);
  const playable = src || asset;
  const length = clockDuration(poster.dur);
  const url = asset ? blob : src;
  return /* @__PURE__ */ jsxs("div", { className: `stage${vert ? " vert" : ""}`, style, children: [
    playing && url && /* @__PURE__ */ jsx("video", { ref: setVel, src: url, controls: true, autoPlay: !synced, preload: "metadata", "data-nodrag": "", title, poster: synced ? poster.url ?? void 0 : void 0 }),
    synced && /* @__PURE__ */ jsxs("span", { className: "sync-chip over", "data-tip": c.t("board.comp.syncTip", { group: syncGroup }), children: [
      /* @__PURE__ */ jsx(Icon, { name: "sync", size: 12 }),
      syncGroup
    ] }),
    !(playing && url) && (poster.url ? /* @__PURE__ */ jsx("img", { src: poster.url, alt: "", draggable: false }) : poster.live ? /* @__PURE__ */ jsx(
      "video",
      {
        className: "still",
        src: `${poster.live}#t=1`,
        preload: "metadata",
        muted: true,
        playsInline: true,
        tabIndex: -1,
        "aria-hidden": "true",
        onLoadedMetadata: (e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) poster.setDur(d);
        }
      }
    ) : /* @__PURE__ */ jsx("div", { className: "poster-empty", children: c.t("board.video.noPoster") })),
    !(playing && url) && length && /* @__PURE__ */ jsx("span", { className: "dur", children: length }),
    !(playing && url) && playable && /* @__PURE__ */ jsxs("button", { className: "play", "data-nodrag": "", onClick: () => c.setPlaying(playId), disabled: loading, children: [
      PLAY$1,
      loading ? c.t("board.video.loading") : c.t("board.video.play")
    ] })
  ] });
}
const STATUSES = ["running", "paused", "done", "error", "idle"];
const KEY = /^[A-Za-z_][A-Za-z0-9_.-]{0,39}$/;
function isBinding(v) {
  return typeof v === "string" && v.length > 1 && v[0] === "$" && v[1] !== "$" && KEY.test(v.slice(1));
}
function resolve(v, data) {
  if (isBinding(v)) return data?.[v.slice(1)] ?? void 0;
  if (typeof v === "string" && v.startsWith("$$")) return v.slice(1);
  return v;
}
function present(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
function asStatus(v) {
  return typeof v === "string" && STATUSES.includes(v) ? v : null;
}
function canStale(status) {
  return status === null || status === "running" || status === "paused";
}
function freshness(at, ttl, status, now) {
  if (!at) return { age: null, stale: false };
  const age = Math.max(0, Math.round(now - at));
  return { age, stale: canStale(status) && age > (ttl ?? 300) };
}
function shortAge(s) {
  if (s < 60) return { n: s, unit: "s" };
  if (s < 3600) return { n: Math.floor(s / 60), unit: "min" };
  if (s < 86400) return { n: Math.floor(s / 3600), unit: "h" };
  return { n: Math.floor(s / 86400), unit: "d" };
}
function fmtDuration(s) {
  if (!Number.isFinite(s) || s < 0) return "—";
  s = Math.round(s);
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m >= 10) return `${m}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
function trimNum(n, digits) {
  return n.toFixed(digits).replace(/\.0+$|(\.\d*?)0+$/, "$1");
}
function fmtValue(v, fmt) {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? fmtValue(v[v.length - 1], fmt) : "—";
  if (typeof v === "string") return v;
  switch (fmt) {
    case "int":
      return Math.round(v).toLocaleString("en-US");
    case "pct":
      return `${trimNum(v, Math.abs(v) >= 100 ? 0 : 1)} %`;
    case "usd":
      return `$${v.toFixed(2)}`;
    case "dur":
      return fmtDuration(v);
    case "text":
      return String(v);
    default: {
      const a = Math.abs(v);
      if (a >= 1e9) return `${trimNum(v / 1e9, 2)} B`;
      if (a >= 1e6) return `${trimNum(v / 1e6, 2)} M`;
      if (a >= 1e4) return `${trimNum(v / 1e3, 1)} k`;
      return trimNum(v, a >= 100 ? 0 : a >= 10 ? 1 : 2);
    }
  }
}
function fmtDelta(v, fmt) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
    const body = fmt === "pct" ? `${trimNum(Math.abs(v), 1)} %` : fmt === "usd" ? `$${Math.abs(v).toFixed(2)}` : fmt === "dur" ? fmtDuration(Math.abs(v)) : trimNum(Math.abs(v), 2);
    return { text: `${v > 0 ? "+" : v < 0 ? "−" : "±"}${body}`, dir };
  }
  const s = String(v).trim();
  return { text: s, dir: /^[+▲↑]/.test(s) ? "up" : /^[-−▼↓]/.test(s) ? "down" : "flat" };
}
function progressOf(value, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const m = typeof max === "number" && max > 0 ? max : value > 1 ? 100 : 1;
  return Math.max(0, Math.min(1, value / m));
}
function numbers(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "number" && Number.isFinite(x)) : [];
}
function sparkPaths(series, w, h, lo, hi, pad2 = 3) {
  const pts = series.slice(-240);
  if (pts.length === 0) return { line: "", area: "", last: null, min: 0, max: 0 };
  let min = lo ?? Math.min(...pts), max = hi ?? Math.max(...pts);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const n = pts.length;
  const xy = pts.map((v, i) => {
    const x = n === 1 ? w / 2 : pad2 + i * (w - pad2 * 2) / (n - 1);
    const y = pad2 + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min)) * (h - pad2 * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const line2 = xy.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const area = n > 1 ? `${line2} L${xy[n - 1][0]} ${h} L${xy[0][0]} ${h} Z` : "";
  return { line: line2, area, last: xy[n - 1], min: lo ?? Math.min(...pts), max: hi ?? Math.max(...pts) };
}
function tailLines(v, n) {
  const lines2 = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.replace(/\s+$/, "").split("\n") : [];
  return lines2.slice(-Math.max(1, n));
}
function mediaRef(v) {
  if (typeof v !== "string") return null;
  if (/^[a-f0-9]{16}\.(png|jpg|gif|webp|mp4|webm|mov)$/.test(v)) return { asset: v };
  if (/^https?:\/\//i.test(v)) return { url: v };
  return null;
}
function labelKey(label) {
  return /^@[A-Za-z]{1,32}$/.test(label) ? label.slice(1) : null;
}
const LABELS = /* @__PURE__ */ new Set(["success", "elapsed", "cost", "falls", "successTrend", "level", "eta", "progress", "steps", "log", "reward", "loss"]);
function useNow(ms) {
  const [now, setNow] = useState(() => Date.now() / 1e3);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1e3), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
function lbl(t2, label) {
  if (typeof label !== "string") return label == null ? "" : String(label);
  const k = labelKey(label);
  if (!k) return label;
  return LABELS.has(k) ? t2(`board.live.l.${k}`) : k;
}
function ageText(t2, age) {
  const a = shortAge(age);
  return t2(`board.live.age.${a.unit}`, { n: a.n });
}
function Pill({ status, stale, t: t2 }) {
  if (stale) return /* @__PURE__ */ jsxs("span", { className: "lv-pill stale", "data-tip": t2("board.live.staleTip"), children: [
    /* @__PURE__ */ jsx(Icon, { name: "alert", size: 11 }),
    t2("board.live.st.stale")
  ] });
  if (!status) return null;
  return /* @__PURE__ */ jsxs("span", { className: `lv-pill ${status}`, children: [
    status === "running" && /* @__PURE__ */ jsx("i", { className: "caret" }),
    status === "paused" && /* @__PURE__ */ jsx("i", { className: "bars" }),
    status === "done" && /* @__PURE__ */ jsx(Icon, { name: "check", size: 11 }),
    status === "error" && /* @__PURE__ */ jsx(Icon, { name: "alert", size: 11 }),
    t2(`board.live.st.${status}`)
  ] });
}
function Header({ b, data, status, stale, t: t2, fallbackTitle }) {
  const title = resolve(b.title, data);
  const sub = resolve(b.sub, data);
  const node2 = LIVE_ICONS[b.icon ?? "activity"] ?? LIVE_ICONS.activity;
  return /* @__PURE__ */ jsxs("div", { className: "lv-head", children: [
    /* @__PURE__ */ jsx("span", { className: "ico", children: /* @__PURE__ */ jsx(Icon, { node: node2, size: 15 }) }),
    /* @__PURE__ */ jsxs("div", { className: "tt", children: [
      /* @__PURE__ */ jsx("b", { children: present(title) ? String(title) : fallbackTitle || t2("board.kind.live") }),
      present(sub) && /* @__PURE__ */ jsx("small", { children: String(sub) })
    ] }),
    /* @__PURE__ */ jsx(Pill, { status, stale, t: t2 })
  ] });
}
function Progress({ b, data, t: t2 }) {
  const frac = progressOf(resolve(b.value, data), resolve(b.max, data));
  if (frac == null) return null;
  const label = resolve(b.label, data);
  const eta = resolve(b.eta, data);
  const cells = 24;
  const on = Math.round(frac * cells);
  return /* @__PURE__ */ jsxs("div", { className: "lv-prog", children: [
    /* @__PURE__ */ jsxs("div", { className: "row", children: [
      /* @__PURE__ */ jsx("span", { className: "lb", children: present(label) ? lbl(t2, label) : t2("board.live.l.progress") }),
      /* @__PURE__ */ jsxs("span", { className: "pc", children: [
        Math.round(frac * 100),
        " %"
      ] }),
      present(eta) && /* @__PURE__ */ jsx("span", { className: "eta", children: t2("board.live.eta", { eta: typeof eta === "number" ? fmtValue(eta, "dur") : String(eta) }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "cells", role: "progressbar", "aria-valuenow": Math.round(frac * 100), "aria-valuemin": 0, "aria-valuemax": 100, children: Array.from({ length: cells }, (_, i) => /* @__PURE__ */ jsx("i", { className: i < on ? "on" : void 0 }, i)) })
  ] });
}
function Metric({ m, data, t: t2 }) {
  const v = resolve(m.value, data);
  const d = fmtDelta(resolve(m.delta, data), m.fmt);
  const good = d && m.good && d.dir !== "flat" ? d.dir === m.good ? "good" : "bad" : "";
  return /* @__PURE__ */ jsxs("div", { className: "m", children: [
    /* @__PURE__ */ jsx("span", { className: "k", children: lbl(t2, resolve(m.label, data)) }),
    /* @__PURE__ */ jsxs("span", { className: "v", children: [
      fmtValue(v, m.fmt),
      m.unit && present(v) && /* @__PURE__ */ jsx("em", { children: m.unit })
    ] }),
    d && /* @__PURE__ */ jsx("span", { className: `d ${good}`.trim(), children: d.text })
  ] });
}
function Spark({ b, data, t: t2 }) {
  const gid = useRef(`lvg${Math.random().toString(36).slice(2, 8)}`).current;
  const series = numbers(resolve(b.series, data));
  if (series.length < 2) return null;
  const lo = resolve(b.min, data), hi = resolve(b.max, data);
  const W = 300, H = 44;
  const s = sparkPaths(series, W, H, typeof lo === "number" ? lo : void 0, typeof hi === "number" ? hi : void 0);
  const last = series[series.length - 1];
  return /* @__PURE__ */ jsxs("div", { className: "lv-spark", children: [
    /* @__PURE__ */ jsxs("div", { className: "row", children: [
      /* @__PURE__ */ jsx("span", { className: "k", children: lbl(t2, resolve(b.label, data)) }),
      /* @__PURE__ */ jsx("span", { className: "sp" }),
      /* @__PURE__ */ jsxs("span", { className: "rng", children: [
        fmtValue(s.min, b.fmt),
        " – ",
        fmtValue(s.max, b.fmt)
      ] }),
      /* @__PURE__ */ jsx("b", { children: fmtValue(last, b.fmt) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "plot", children: [
      /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ jsx("stop", { offset: "0", stopColor: "currentColor", stopOpacity: ".22" }),
          /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "currentColor", stopOpacity: "0" })
        ] }) }),
        /* @__PURE__ */ jsx("path", { className: "area", d: s.area, fill: `url(#${gid})` }),
        /* @__PURE__ */ jsx("path", { className: "line", d: s.line, vectorEffect: "non-scaling-stroke" })
      ] }),
      s.last && /* @__PURE__ */ jsx("i", { className: "dot", style: { left: `${s.last[0] / W * 100}%`, top: `${s.last[1] / H * 100}%` } })
    ] })
  ] });
}
function useImage(ref) {
  const [url, setUrl] = useState(null);
  const key = ref ? "asset" in ref ? ref.asset : ref.url : "";
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (ref && "url" in ref) setUrl(ref.url);
    else if (ref) assetUrl(ref.asset).then((u) => live && setUrl(u), () => void 0);
    return () => {
      live = false;
    };
  }, [key]);
  return url;
}
function Media({ id, b, data, c }) {
  const video = mediaRef(resolve(b.video, data));
  const image = mediaRef(resolve(b.image, data));
  const poster = mediaRef(resolve(b.poster, data));
  const caption = resolve(b.caption, data);
  const img = useImage(!video ? image : null);
  if (!video && !image) return null;
  return /* @__PURE__ */ jsxs("div", { className: "lv-media", children: [
    video ? /* @__PURE__ */ jsx(
      VideoStage,
      {
        playId: `${id}:media`,
        c,
        title: present(caption) ? String(caption) : "",
        src: "url" in video ? video.url : void 0,
        asset: "asset" in video ? video.asset : void 0,
        posterAsset: poster && "asset" in poster ? poster.asset : void 0,
        posterUrl: poster && "url" in poster ? poster.url : void 0
      }
    ) : /* @__PURE__ */ jsx("div", { className: "still", children: img && /* @__PURE__ */ jsx("img", { src: img, alt: "", draggable: false }) }),
    present(caption) && /* @__PURE__ */ jsx("div", { className: "cap", children: String(caption) })
  ] });
}
function Log({ b, data, t: t2 }) {
  const lines2 = tailLines(resolve(b.value, data), b.lines ?? 6);
  if (!lines2.length || lines2.length === 1 && !lines2[0].trim()) return null;
  return /* @__PURE__ */ jsxs("div", { className: `lv-log${b.mono === false ? " prose" : ""}`, children: [
    b.label && /* @__PURE__ */ jsx("span", { className: "k", children: lbl(t2, resolve(b.label, data)) }),
    /* @__PURE__ */ jsx("pre", { children: lines2.map((l, i) => /* @__PURE__ */ jsxs("span", { className: i === lines2.length - 1 ? "last" : void 0, children: [
      l,
      "\n"
    ] }, i)) })
  ] });
}
function ActionButton({ iid, a, index, c, onResult }) {
  const [busy, setBusy] = useState(false);
  const info = c.liveActions?.[a.action];
  const label = a.label || info?.label || a.action;
  const known = !!info;
  const disabled = !known || !info.enabled || busy;
  const tip = c.liveActionsDown ? c.t("board.live.actionsDown") : !c.liveActions ? c.t("board.live.actionsLoading") : !known ? c.t("board.live.notRegistered", { id: a.action }) : !info.enabled ? info.note ? c.t("board.live.disabledNote", { note: info.note }) : c.t("board.live.disabled") : info.description || label;
  const iconName = a.icon ?? info?.icon ?? (info ? info.destructive ? "stop" : "play" : null);
  const node2 = iconName ? LIVE_ICONS[iconName] ?? LIVE_ICONS.play : null;
  return /* @__PURE__ */ jsx("span", { className: "lv-bw", "data-tip": tip, children: /* @__PURE__ */ jsxs(
    "button",
    {
      className: `lv-btn${info?.destructive ? " danger" : ""}${busy ? " busy" : ""}`,
      "data-nodrag": "",
      disabled,
      "aria-label": label,
      onClick: async () => {
        setBusy(true);
        try {
          const r = await c.runLiveAction(iid, a, index);
          onResult(r, label);
        } catch (e) {
          onResult(null, label, String(e?.message ?? e));
        } finally {
          setBusy(false);
        }
      },
      children: [
        busy ? /* @__PURE__ */ jsx("i", { className: "spin" }) : node2 ? /* @__PURE__ */ jsx(Icon, { node: node2, size: 13 }) : null,
        /* @__PURE__ */ jsx("span", { children: label })
      ]
    }
  ) });
}
function LiveView({ id, item, c }) {
  const t2 = c.t;
  const data = item.data ?? {};
  const blocks = item.blocks ?? [];
  const now = useNow(1e3);
  const header = blocks.find((b) => b.t === "header");
  const status = asStatus(resolve(header?.status, data));
  const fresh = freshness(item.at, item.ttl, status, now);
  const acts = blocks.flatMap((b) => b.t === "actions" ? b.items : []);
  const [tick, setTick] = useState(false);
  const [toast, setToast] = useState(null);
  const lastAt = useRef(item.at);
  useEffect(() => {
    if (item.at && lastAt.current && item.at !== lastAt.current) {
      setTick(true);
      const h = setTimeout(() => setTick(false), 900);
      lastAt.current = item.at;
      return () => clearTimeout(h);
    }
    lastAt.current = item.at;
  }, [item.at]);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), toast.ok ? 5e3 : 9e3);
    return () => clearTimeout(h);
  }, [toast]);
  const onResult = (r, label, err) => {
    if (!r && !err) return;
    const key = Date.now();
    if (err) {
      setToast({ ok: false, text: t2("board.live.actionError", { action: label, error: err }), key });
      return;
    }
    const secs = (r.ms / 1e3).toFixed(r.ms < 1e4 ? 1 : 0);
    const out = r.out ? r.out.split("\n").filter(Boolean).pop() ?? "" : "";
    setToast(r.ok ? { ok: true, text: t2("board.live.actionOk", { action: label, s: secs }) + (out ? ` · ${out.slice(0, 80)}` : ""), key } : { ok: false, text: t2("board.live.actionFailed", { action: label, code: String(r.code) }) + (out ? ` · ${out.slice(0, 80)}` : ""), key });
  };
  const body = [];
  let mediaSeen = 0;
  blocks.forEach((b, i) => {
    switch (b.t) {
      case "header":
        body.push(/* @__PURE__ */ jsx(Header, { b, data, status, stale: fresh.stale, t: t2, fallbackTitle: item.title ?? "" }, i));
        break;
      case "progress":
        body.push(/* @__PURE__ */ jsx(Progress, { b, data, t: t2 }, i));
        break;
      case "metrics":
        body.push(/* @__PURE__ */ jsx("div", { className: "lv-metrics", "data-n": b.items.length, children: b.items.map((m, j) => /* @__PURE__ */ jsx(Metric, { m, data, t: t2 }, j)) }, i));
        break;
      case "spark":
        body.push(/* @__PURE__ */ jsx(Spark, { b, data, t: t2 }, i));
        break;
      case "media":
        body.push(/* @__PURE__ */ jsx(Media, { id: `${id}:${mediaSeen++}`, b, data, c }, i));
        break;
      case "text":
        body.push(/* @__PURE__ */ jsx(Log, { b, data, t: t2 }, i));
        break;
    }
  });
  const terminal = status === "done" || status === "error" || status === "idle";
  const age = fresh.age;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `hb-card hb-live${item.by === "h" ? " dm" : ""}${fresh.stale ? " stale" : ""}${status ? ` st-${status}` : ""}`,
      style: { width: item.w ?? 400 },
      children: [
        !header && /* @__PURE__ */ jsx(Header, { b: { t: "header" }, data, status, stale: fresh.stale, t: t2, fallbackTitle: item.title ?? "" }),
        body,
        /* @__PURE__ */ jsxs("div", { className: "lv-foot", children: [
          /* @__PURE__ */ jsxs("span", { className: `fr${tick ? " tick" : ""}${fresh.stale ? " stale" : terminal ? " rest" : ""}`, children: [
            /* @__PURE__ */ jsx("i", {}),
            age == null ? t2("board.live.noData") : fresh.stale ? t2("board.live.staleFor", { age: ageText(t2, age) }) : t2("board.live.updated", { age: ageText(t2, age) })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "sp" }),
          item.by === "h" && (acts.length ? /* @__PURE__ */ jsx("span", { className: "sig", children: /* @__PURE__ */ jsx(Cad, {}) }) : /* @__PURE__ */ jsx(Sig, {})),
          acts.map((a, i) => /* @__PURE__ */ jsx(ActionButton, { iid: id, a, index: i, c, onResult }, `${a.action}${i}`))
        ] }),
        toast && /* @__PURE__ */ jsxs("div", { className: `lv-toast${toast.ok ? "" : " err"}`, role: "status", "data-nodrag": "", onClick: () => setToast(null), children: [
          /* @__PURE__ */ jsx(Icon, { name: toast.ok ? "ok" : "alert", size: 14 }),
          /* @__PURE__ */ jsx("span", { children: toast.text })
        ] }, toast.key)
      ]
    }
  );
}
const SIZE_MSG = "hermes:size";
const THEME_MSG = "hermes:theme";
const READY_MSG = "hermes:ready";
function parseColor(input) {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    };
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const n = parts.slice(0, 4).map((p) => p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p));
  if (n.some((v) => Number.isNaN(v))) return null;
  const ch = (i) => Math.max(0, Math.min(255, Math.round(parts[i].endsWith("%") ? n[i] * 255 : n[i])));
  return { r: ch(0), g: ch(1), b: ch(2), a: n[3] === void 0 ? 1 : Math.max(0, Math.min(1, n[3])) };
}
function luminance(c) {
  const f = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function toHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn, l = (mx + mn) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === R ? (G - B) / d % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
function chartPalette(accent, scheme) {
  const c = parseColor(accent) ?? { r: 255, g: 227, b: 196 };
  const [h, s0, l0] = toHsl(c);
  const lo = scheme === "dark" ? 0.58 : 0.38, hi = scheme === "dark" ? 0.72 : 0.5;
  const s = Math.max(0.45, Math.min(0.8, s0));
  const out = [`#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`];
  [[150, 0], [45, 0.03], [-70, -0.02], [215, 0.02]].forEach(([dh, dl]) => {
    out.push(fromHsl((h + dh + 360) % 360, s, Math.max(lo, Math.min(hi, l0 + dl))));
  });
  return out;
}
function makeTheme(raw) {
  const bg = parseColor(raw.background);
  const scheme = bg && luminance(bg) > 0.5 ? "light" : "dark";
  return { ...raw, scheme, chart: chartPalette(raw.accent, scheme) };
}
function themeVars(t2) {
  const v = {
    "--foreground": t2.foreground,
    "--muted-foreground": t2.mutedForeground,
    "--accent": t2.accent,
    "--border": t2.border,
    "--card": t2.card,
    "--background": t2.background,
    "--font-sans": t2.fontSans,
    "--font-mono": t2.fontMono
  };
  t2.chart.forEach((c, i) => {
    v[`--chart-${i + 1}`] = c;
  });
  return v;
}
function baseCss(t2) {
  const vars = Object.entries(themeVars(t2)).map(([k, v]) => `${k}:${v.replace(/[<>{};]/g, "")}`).join(";");
  return `:root{${vars};color-scheme:${t2.scheme}}*,*::before,*::after{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;color:var(--foreground);font:13px/1.45 var(--font-sans);-webkit-font-smoothing:antialiased}body{display:flow-root}img,video,canvas,svg{max-width:100%}code,pre,kbd,samp{font-family:var(--font-mono)}*{scrollbar-width:thin;scrollbar-color:var(--border) transparent}`;
}
const BRIDGE_JS = `(function(){
var W=window,D=document,P=W.parent,H=W.hermes={size:{w:0,h:0,dpr:W.devicePixelRatio||1,zoom:1},theme:__HERMES_THEME__,_r:[],_t:[]};
var VARS={foreground:'--foreground',mutedForeground:'--muted-foreground',accent:'--accent',border:'--border',card:'--card',background:'--background',fontSans:'--font-sans',fontMono:'--font-mono'};
function sub(list,f){list.push(f);return function(){var i=list.indexOf(f);if(i>=0)list.splice(i,1)}}
function call(list,v){list.slice().forEach(function(f){try{f(v)}catch(e){}})}
H.onResize=function(f){var u=sub(H._r,f);if(H.size.w)try{f(H.size)}catch(e){}return u};
H.onTheme=function(f){return sub(H._t,f)};
H.alpha=function(c,a){var m=/^#([0-9a-f]{6})$/i.exec(c);if(!m)return c;var n=parseInt(m[1],16);return'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'};
try{Object.defineProperty(W,'devicePixelRatio',{configurable:true,get:function(){return H.size.dpr}})}catch(e){}
function paint(t){var s=D.documentElement.style;for(var k in VARS)if(t[k])s.setProperty(VARS[k],t[k]);
(t.chart||[]).forEach(function(c,i){s.setProperty('--chart-'+(i+1),c)});s.colorScheme=t.scheme}
function chartJs(C){try{var d=C.defaults,t=H.theme;d.color=t.mutedForeground;d.borderColor=t.border;d.font.family=t.fontMono;
d.responsive=true;d.maintainAspectRatio=false;
if(!C.__hermes&&C.register){C.__hermes=1;C.register({id:'hermesPalette',beforeUpdate:function(ch){
var pal=H.theme.chart,type=ch.config.type,ds=ch.config.data.datasets||[];
ds.forEach(function(s,i){var c=pal[i%pal.length],many=type==='pie'||type==='doughnut'||type==='polarArea';
if(many){if(s.backgroundColor==null)s.backgroundColor=(s.data||[]).map(function(_,j){return pal[j%pal.length]});if(s.borderColor==null)s.borderColor='transparent'}
else{if(s.borderColor==null)s.borderColor=c;if(s.backgroundColor==null)s.backgroundColor=type==='line'||type==='radar'?H.alpha(c,.18):H.alpha(c,.8)}})}})}}catch(e){}}
function echarts(E){try{var t=H.theme,ax={axisLine:{lineStyle:{color:t.border}},axisTick:{lineStyle:{color:t.border}},splitLine:{lineStyle:{color:t.border}},axisLabel:{color:t.mutedForeground}};
E.registerTheme('hermes',{color:t.chart,backgroundColor:'transparent',textStyle:{color:t.mutedForeground,fontFamily:t.fontMono},
title:{textStyle:{color:t.foreground}},legend:{textStyle:{color:t.mutedForeground}},categoryAxis:ax,valueAxis:ax,logAxis:ax,timeAxis:ax,
tooltip:{backgroundColor:t.card,borderColor:t.border,textStyle:{color:t.foreground}}});
if(!E.__hermes){E.__hermes=1;var init=E.init;E.init=function(el,th,o){return init.call(E,el,th==null?'hermes':th,o)}}}catch(e){}}
H.chartDefaults=chartJs;
function trap(name,fn){var v;try{Object.defineProperty(W,name,{configurable:true,get:function(){return v},set:function(x){v=x;if(x)fn(x)}})}catch(e){}}
trap('Chart',chartJs);trap('echarts',echarts);
var raf=0;
function fire(){raf=0;var s=H.size,st=D.documentElement.style;st.setProperty('--card-w',s.w+'px');st.setProperty('--card-h',s.h+'px');
call(H._r,s);try{W.dispatchEvent(new Event('resize'))}catch(e){}}
W.addEventListener('message',function(e){if(e.source!==P)return;var m=e.data;if(!m||typeof m!=='object')return;
if(m.type==='${THEME_MSG}'&&m.theme){H.theme=m.theme;paint(m.theme);if(W.Chart&&W.Chart.defaults)chartJs(W.Chart);if(W.echarts)echarts(W.echarts);call(H._t,m.theme);
try{W.dispatchEvent(new Event('hermes:theme'))}catch(x){}}
else if(m.type==='${SIZE_MSG}'){H.size={w:m.w,h:m.h,dpr:m.dpr||1,zoom:m.zoom||1};if(!raf)raf=W.requestAnimationFrame(fire)}});
try{P.postMessage({type:'${READY_MSG}'},'*')}catch(e){}
})();`;
function jsonForScript$1(v) {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function insertAtHead(html, block) {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + block + html.slice(head.index + head[0].length);
  const root = /<html(\s[^>]*)?>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + `<head>${block}</head>` + html.slice(root.index + root[0].length);
  const dt = /^\s*<!doctype[^>]*>/i.exec(html);
  if (dt) return dt[0] + block + html.slice(dt[0].length);
  return block + html;
}
const SCRIPT_OPEN$1 = String.fromCharCode(60) + "script";
const SCRIPT_CLOSE$1 = String.fromCharCode(60) + "/script>";
function embedDocument(html, themed, theme) {
  if (!themed || !theme) return html;
  const block = `<style id="hermes-base">${baseCss(theme)}</style>${SCRIPT_OPEN$1} id="hermes-bridge">${BRIDGE_JS.replace("__HERMES_THEME__", () => jsonForScript$1(theme))}${SCRIPT_CLOSE$1}`;
  return insertAtHead(html, block);
}
function sizeMessage(w, h, devicePixelRatio, zoom) {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const dpr = Math.min(4, Math.round(Math.max(1, devicePixelRatio || 1) * Math.max(1, z) * 100) / 100);
  return { type: SIZE_MSG, w: Math.round(w), h: Math.round(h), dpr, zoom: Math.round(z * 100) / 100 };
}
const HB_VERSION = 1;
const HB_ASSET_REQ = "hb:asset";
const HB_ACTION_REQ = "hb:action";
const HB_CLOCK_CMD = "hb:clock-cmd";
const HB_DATA = "hb:data";
const HB_CLOCK = "hb:clock";
const HB_ASSETS = "hb:assets";
const HB_ASSET_RES = "hb:asset-res";
const HB_ACTION_RES = "hb:action-res";
const COMPONENT_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const HB_JS = `(function(){
var W=window,P=W.parent,H=W.hermes,I=__HB_INIT__;
function bag(){var l=[];return{add:function(f){if(typeof f==='function')l.push(f);return function(){var i=l.indexOf(f);if(i>=0)l.splice(i,1)}},
fire:function(a,b){l.slice().forEach(function(f){try{f(a,b)}catch(e){try{console.error(e)}catch(x){}}})},n:function(){return l.length}}}
var dataS=bag(),tickS=bag(),seekS=bag(),stateS=bag(),pend={},seq=0,cache={};
function post(m){try{P.postMessage(m,'*')}catch(e){}}
function cmd(c,v){post({type:'${HB_CLOCK_CMD}',cmd:c,v:v})}
var C={t:0,playing:false,rate:1,duration:0,group:null,manual:false,master:false,
onTick:function(f){return tickS.add(f)},onSeek:function(f){return seekS.add(f)},onState:function(f){return stateS.add(f)},
play:function(){cmd('play')},pause:function(){cmd('pause')},toggle:function(){cmd('toggle')},
seek:function(t){cmd('seek',+t||0)},setRate:function(r){cmd('rate',+r||1)},setDuration:function(d){cmd('duration',+d||0)}};
function setClock(c){for(var k in c)if(k in C&&typeof C[k]!=='function')C[k]=c[k]}
setClock(I.clock||{});
var hb=W.hb={version:${HB_VERSION},component:I.component,data:I.data||{},assets:Object.keys(I.assets||{}),assetRev:I.assets||{},actions:I.actions||[],clock:C,
onData:function(f){var off=dataS.add(f);if(Object.keys(hb.data).length)try{f(hb.data,Object.keys(hb.data))}catch(e){}return off},
onResize:function(f){return H.onResize(f)},onTheme:function(f){return H.onTheme(f)},
asset:function(name,o){if(I.preview)return Promise.reject(new Error('no data in the preview'));var as=(o&&o.as)||(/\\.json$/i.test(name)?'json':'arraybuffer'),key=name+'@'+(hb.assetRev[name]||0);
var p=cache[key];if(!p){p=cache[key]=new Promise(function(res,rej){var id=++seq;pend[id]={res:res,rej:rej};post({type:'${HB_ASSET_REQ}',id:id,name:name})});p.catch(function(){delete cache[key]})}
return p.then(function(buf){if(as==='arraybuffer')return buf.slice(0);if(as==='blob')return new Blob([buf]);var s=new TextDecoder().decode(buf);return as==='json'?JSON.parse(s):s})},
action:function(name,args){if(I.preview)return Promise.reject(new Error('actions are off in the preview'));return new Promise(function(res,rej){var id=++seq;pend[id]={res:res,rej:rej};post({type:'${HB_ACTION_REQ}',id:id,name:String(name),args:args||{}})})}};
Object.defineProperty(hb,'size',{enumerable:true,get:function(){return H.size}});
Object.defineProperty(hb,'theme',{enumerable:true,get:function(){return H.theme}});
hb.ready=new Promise(function(res){var off=H.onResize(function(){res();try{off&&off()}catch(e){}})});
W.addEventListener('message',function(e){if(e.source!==P)return;var m=e.data;if(!m||typeof m!=='object')return;
if(m.type==='${HB_DATA}'){hb.data=m.data||{};dataS.fire(hb.data,m.keys||Object.keys(hb.data))}
else if(m.type==='${HB_ASSETS}'){hb.assetRev=m.assets||{};hb.assets=Object.keys(hb.assetRev)}
else if(m.type==='${HB_CLOCK}'){var was=C.playing,wr=C.rate,wd=C.duration;setClock(m.clock||{});
if(m.ev==='seek')seekS.fire(C.t,C);if(m.ev==='tick'||m.ev==='seek')tickS.fire(C.t,C);
if(m.ev==='state'||was!==C.playing||wr!==C.rate||wd!==C.duration)stateS.fire(C,C)}
else if(m.type==='${HB_ASSET_RES}'||m.type==='${HB_ACTION_RES}'){var q=pend[m.id];if(!q)return;delete pend[m.id];
if(m.ok)q.res(m.type==='${HB_ASSET_RES}'?m.body:m.result);else q.rej(new Error(m.error||'failed'))}});
})();`;
function jsonForScript(v) {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
const SCRIPT_OPEN = String.fromCharCode(60) + "script";
const SCRIPT_CLOSE = String.fromCharCode(60) + "/script>";
function componentDocument(html, themed, theme, init) {
  const csp = `<meta http-equiv="Content-Security-Policy" content="${COMPONENT_CSP}">`;
  const style = themed ? `<style id="hermes-base">${baseCss(theme)}</style>` : "";
  const bridge = `${SCRIPT_OPEN} id="hermes-bridge">${BRIDGE_JS.replace("__HERMES_THEME__", () => jsonForScript(theme))}${SCRIPT_CLOSE}`;
  const hb = `${SCRIPT_OPEN} id="hb-bridge">${HB_JS.replace("__HB_INIT__", () => jsonForScript(init))}${SCRIPT_CLOSE}`;
  return insertAtHead(html, csp + style + bridge + hb);
}
function normalise(ctx, css, fallback) {
  if (!ctx) return css || fallback;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return d[3] === 255 ? `rgb(${d[0]} ${d[1]} ${d[2]})` : `rgb(${d[0]} ${d[1]} ${d[2]} / ${Math.round(d[3] / 255 * 100) / 100})`;
}
function readTheme(at) {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  at.appendChild(probe);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const colour = (value, fallback) => {
    probe.style.color = "";
    probe.style.color = value;
    return normalise(ctx, getComputedStyle(probe).color, fallback);
  };
  const font = (value, fallback) => {
    probe.style.fontFamily = value;
    return getComputedStyle(probe).fontFamily || fallback;
  };
  const raw = {
    foreground: colour("var(--ink)", "rgb(243 236 227)"),
    mutedForeground: colour("var(--ink-3)", "rgb(160 155 150)"),
    accent: colour("var(--accent)", "rgb(255 227 196)"),
    border: colour("color-mix(in srgb, var(--ink) 14%, transparent)", "rgb(255 255 255 / 0.14)"),
    card: colour("var(--sheet)", "rgb(20 30 30)"),
    background: colour("var(--bg)", "rgb(3 25 25)"),
    fontSans: font("var(--sans)", "system-ui, sans-serif"),
    fontMono: font("var(--mono)", "ui-monospace, monospace")
  };
  probe.remove();
  return makeTheme(raw);
}
function useEmbedBridge(box2, active, themed, key, onTheme) {
  const theme = useRef(null);
  useEffect(() => {
    const el = box2.current;
    if (!el || !active) return;
    const win = () => el.querySelector("iframe")?.contentWindow ?? null;
    const post = (m) => {
      try {
        win()?.postMessage(m, "*");
      } catch {
      }
    };
    let lastSize = "";
    const size = (force = false) => {
      const r = el.getBoundingClientRect();
      const zoom = el.offsetWidth ? r.width / el.offsetWidth : 1;
      const m = sizeMessage(el.clientWidth, el.clientHeight, window.devicePixelRatio, zoom);
      const sig = `${m.w}x${m.h}@${m.dpr}`;
      if (force || sig !== lastSize) {
        lastSize = sig;
        post(m);
      }
    };
    const sendTheme = () => {
      if (!themed) return;
      const t2 = readTheme(el);
      if (JSON.stringify(t2) === JSON.stringify(theme.current)) return;
      theme.current = t2;
      onTheme?.(t2);
      post({ type: THEME_MSG, theme: t2 });
    };
    const onMessage = (e) => {
      if (e.source !== win() || !e.data || e.data.type !== READY_MSG) return;
      theme.current = null;
      sendTheme();
      size(true);
    };
    window.addEventListener("message", onMessage);
    let frame = null;
    const hook = () => {
      const f = el.querySelector("iframe");
      if (f && f !== frame) {
        frame?.removeEventListener("load", onLoad);
        frame = f;
        f.addEventListener("load", onLoad);
      }
    };
    const onLoad = () => size(true);
    hook();
    const RO = globalThis.ResizeObserver;
    const ro = RO ? new RO(() => {
      hook();
      size();
    }) : null;
    ro?.observe(el);
    let seen = "", settled = "", n = 0;
    const tick = window.setInterval(() => {
      hook();
      const r = el.getBoundingClientRect();
      const z = (el.offsetWidth ? r.width / el.offsetWidth : 1).toFixed(2);
      if (z === seen && z !== settled) {
        settled = z;
        size();
      }
      seen = z;
      if (++n % 4 === 0) sendTheme();
    }, 450);
    const mo = typeof MutationObserver === "function" ? new MutationObserver(sendTheme) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const first = window.setTimeout(() => {
      sendTheme();
      size(true);
    }, 120);
    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", onLoad);
      ro?.disconnect();
      mo?.disconnect();
      window.clearInterval(tick);
      window.clearTimeout(first);
    };
  }, [box2, active, themed, key]);
}
function toDataUrl$1(html) {
  const bytes = new TextEncoder().encode(html);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:text/html;charset=utf-8;base64,${btoa(bin)}`;
}
const libCache = /* @__PURE__ */ new Map();
function loadComponent(name, ver, stamp2, fresh = false) {
  const key = `${name}@${ver ?? "latest"}#${stamp2 ?? 0}`;
  let p = fresh ? void 0 : libCache.get(key);
  if (!p) {
    p = boardsApi.component(name, ver);
    p.catch(() => libCache.delete(key));
    libCache.set(key, p);
  }
  return p;
}
function clockInit(s, group) {
  return { t: s.t, playing: s.playing, rate: s.rate, duration: s.duration, group, manual: s.manual, master: s.master };
}
function useCompBridge(a) {
  const { box: box2, active, nonce, bid, iid, clock: clock2, group } = a;
  const latest = useRef(a);
  latest.current = a;
  const win = useCallback(() => box2.current?.querySelector("iframe")?.contentWindow ?? null, [box2]);
  const post = useCallback((m, transfer) => {
    try {
      win()?.postMessage(m, "*", transfer);
    } catch {
    }
  }, [win]);
  useEffect(() => {
    if (!active) return;
    const reply = (type, id, ok, rest, transfer) => post({ type, id, ok, ...rest }, transfer);
    const onMessage = (e) => {
      const w = win();
      if (!w || e.source !== w || !e.data || typeof e.data !== "object") return;
      const m = e.data;
      const cur = latest.current;
      switch (m.type) {
        case READY_MSG:
          post({ type: HB_DATA, data: cur.data, keys: Object.keys(cur.data) });
          post({ type: HB_ASSETS, assets: Object.fromEntries(Object.entries(cur.files).map(([k, v]) => [k, v.r])) });
          post({ type: HB_CLOCK, ev: "state", clock: clockInit(clock2.state, group) });
          return;
        case HB_ASSET_REQ: {
          const id = Number(m.id), name = String(m.name ?? "");
          const rev = cur.files[name]?.r ?? 0;
          loadCompFile(bid, iid, name, rev).then(
            (buf) => {
              const copy = buf.slice(0);
              reply(HB_ASSET_RES, id, true, { body: copy }, [copy]);
            },
            (err) => reply(HB_ASSET_RES, id, false, { error: String(err?.message ?? err) })
          );
          return;
        }
        case HB_ACTION_REQ: {
          const id = Number(m.id);
          cur.runAction(String(m.name ?? ""), m.args && typeof m.args === "object" ? m.args : {}).then(
            (result) => reply(HB_ACTION_RES, id, true, { result }),
            (err) => reply(HB_ACTION_RES, id, false, { error: String(err?.message ?? err) })
          );
          return;
        }
        case HB_CLOCK_CMD:
          switch (m.cmd) {
            case "play":
              clock2.play();
              break;
            case "pause":
              clock2.pause();
              break;
            case "toggle":
              clock2.toggle();
              break;
            case "seek":
              void clock2.seek(Number(m.v));
              break;
            case "rate":
              clock2.setRate(Number(m.v));
              break;
            case "duration":
              clock2.setDuration(Number(m.v));
              break;
          }
          return;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active, bid, iid, clock2, group, nonce, post, win]);
  const dataSig = useMemo(() => JSON.stringify(a.data), [a.data]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    post({ type: HB_DATA, data: latest.current.data, keys: Object.keys(latest.current.data) });
  }, [dataSig, post]);
  const filesSig = useMemo(() => JSON.stringify(Object.entries(a.files).map(([k, v]) => [k, v.r])), [a.files]);
  useEffect(() => {
    post({ type: HB_ASSETS, assets: Object.fromEntries(Object.entries(latest.current.files).map(([k, v]) => [k, v.r])) });
  }, [filesSig, post]);
  useEffect(() => {
    if (!active) return;
    return clock2.subscribe((ev, s) => post({ type: HB_CLOCK, ev, clock: clockInit(s, group) }));
  }, [active, clock2, group, nonce, post]);
}
const fmtBytes = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
function CompView({ id, item, c }) {
  const name = item.comp ?? "";
  const [lib, setLib] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [base, setBase] = useState(null);
  const [menu, setMenu] = useState(null);
  const [src, setSrc] = useState(false);
  const [scheme, setScheme] = useState(void 0);
  const box2 = useRef(null);
  const themed = item.nt !== true;
  useEffect(() => {
    let live = true;
    if (!name) {
      setLib("missing");
      return;
    }
    loadComponent(name, item.ver, item.at).then((d) => live && setLib(d), () => live && setLib("missing"));
    return () => {
      live = false;
    };
  }, [name, item.ver, item.at]);
  useLayoutEffect(() => {
    if (!base && box2.current) setBase(readTheme(box2.current));
  }, [base, lib]);
  const group = item.sync ?? null;
  const clock2 = c.sync.clock(group ?? `~${id}`);
  const data = useMemo(() => item.cdata ?? (lib && lib !== "missing" && lib.sample && typeof lib.sample === "object" ? lib.sample : {}), [item.cdata, lib]);
  const files = useMemo(() => item.files ?? {}, [item.files]);
  const boot = useRef({ data, files, item, group, clock: clock2 });
  boot.current = { data, files, item, group, clock: clock2 };
  const html = lib && lib !== "missing" ? lib.html : null;
  const version = lib && lib !== "missing" ? lib.version : "";
  const doc = useMemo(() => {
    if (html == null || !base) return null;
    const b = boot.current;
    const init = {
      component: { name, version },
      data: b.data,
      assets: Object.fromEntries(Object.entries(b.files).map(([k, v]) => [k, v.r])),
      actions: b.item.actions ?? [],
      clock: clockInit(b.clock.state, b.group)
    };
    return componentDocument(html, themed, base, init);
  }, [html, base, themed, nonce, name, version]);
  const runAction = useCallback(async (action, args) => {
    if (!(item.actions ?? []).includes(action)) throw new Error(c.t("board.comp.actionNotOnCard", { id: action }));
    const r = await c.runCompAction(id, action, args);
    if (!r) throw new Error(c.t("board.comp.actionCancelled"));
    return r;
  }, [c, id, item.actions]);
  useEmbedBridge(box2, doc != null, themed, `${nonce}`, (t2) => setScheme(t2.scheme));
  useCompBridge({ box: box2, active: doc != null, nonce: `${nonce}${themed}`, bid: c.bid, iid: id, data, files, clock: clock2, group, runAction });
  const Frame = c.Frame;
  const active = c.playing === id;
  const height = item.h ? Math.max(120, item.h - 80) : 240;
  const frameStyle = { height, ...themed ? { colorScheme: scheme ?? base?.scheme } : {} };
  const missing = lib === "missing";
  const current2 = lib && lib !== "missing" ? lib.current : "";
  const behind = !!item.ver && !!current2 && item.ver !== current2;
  const title = item.title || (lib && lib !== "missing" ? lib.title : "") || name;
  const sync = group ? c.t("board.comp.syncTip", { group }) : "";
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-embed hb-comp${item.by === "h" ? " dm" : ""}${group ? " synced" : ""}`, style: { width: item.w ?? 480 }, children: [
    /* @__PURE__ */ jsxs("div", { className: "bar-e", children: [
      /* @__PURE__ */ jsx("span", { className: "file", children: title }),
      version && /* @__PURE__ */ jsxs("span", { className: "sb", children: [
        name,
        " · ",
        version,
        item.ver ? "" : ` · ${c.t("board.comp.latest")}`
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "tools", children: [
        group && /* @__PURE__ */ jsxs("span", { className: "sync-chip", "data-tip": sync, "aria-label": sync, children: [
          /* @__PURE__ */ jsx(Icon, { name: "sync", size: 12 }),
          group
        ] }),
        behind && /* @__PURE__ */ jsx(
          "button",
          {
            className: "kbtn on",
            "data-nodrag": "",
            "data-tip": c.t("board.comp.update", { v: current2 }),
            "aria-label": c.t("board.comp.update", { v: current2 }),
            onClick: () => c.update(id, { ver: null }),
            children: /* @__PURE__ */ jsx(Icon, { name: "upgrade", size: 13 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `kbtn${themed ? " on" : ""}`,
            "data-nodrag": "",
            "data-tip": c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn"),
            "aria-pressed": themed,
            "aria-label": c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn"),
            onClick: () => c.update(id, { nt: themed ? true : null }),
            children: /* @__PURE__ */ jsx(Icon, { name: "theme", size: 13 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "kbtn",
            "data-nodrag": "",
            "data-tip": c.t("board.embed.reload"),
            "aria-label": c.t("board.embed.reload"),
            onClick: () => {
              setNonce((n) => n + 1);
              loadComponent(name, item.ver, item.at, true).then(setLib, () => void 0);
            },
            children: /* @__PURE__ */ jsx(Icon, { name: "reload", size: 13 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `kbtn${menu ? " on" : ""}`,
            "data-nodrag": "",
            "data-tip": c.t("board.comp.versions"),
            "aria-label": c.t("board.comp.versions"),
            "aria-expanded": !!menu,
            onClick: () => setMenu((m) => m ? null : "ver"),
            children: /* @__PURE__ */ jsx(Icon, { name: "versions", size: 13 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `kbtn${src ? " on" : ""}`,
            "data-nodrag": "",
            "data-tip": c.t("board.comp.source"),
            "aria-label": c.t("board.comp.source"),
            "aria-pressed": src,
            onClick: () => setSrc((v) => !v),
            children: /* @__PURE__ */ jsx(Icon, { name: "embed", size: 13 })
          }
        )
      ] }),
      menu && lib && lib !== "missing" && /* @__PURE__ */ jsxs("div", { className: "comp-menu", "data-nodrag": "", role: "menu", children: [
        /* @__PURE__ */ jsxs("button", { role: "menuitem", className: !item.ver ? "on" : "", onClick: () => {
          c.update(id, { ver: null });
          setMenu(null);
        }, children: [
          /* @__PURE__ */ jsx("b", { children: c.t("board.comp.followLatest") }),
          /* @__PURE__ */ jsx("small", { children: current2 })
        ] }),
        [...lib.versions].reverse().slice(0, 12).map((v) => /* @__PURE__ */ jsxs("button", { role: "menuitem", className: item.ver === v.v ? "on" : "", onClick: () => {
          c.update(id, { ver: v.v });
          setMenu(null);
        }, children: [
          /* @__PURE__ */ jsx("b", { children: v.v }),
          /* @__PURE__ */ jsx("small", { children: v.note || new Date(v.at * 1e3).toLocaleDateString() })
        ] }, v.v))
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { ref: box2, "data-nodrag": "", style: { height, position: "relative" }, children: [
      !active && !missing && !src && /* @__PURE__ */ jsx("button", { className: "shield", "aria-label": c.t("board.embed.activate"), onClick: () => c.setPlaying(id), children: /* @__PURE__ */ jsx("span", { children: c.t("board.embed.activate") }) }),
      missing ? /* @__PURE__ */ jsxs("div", { className: "comp-empty", style: { height }, children: [
        /* @__PURE__ */ jsx(Icon, { name: "components", size: 20 }),
        /* @__PURE__ */ jsx("b", { children: c.t("board.comp.missing", { name }) }),
        /* @__PURE__ */ jsx("small", { children: c.t("board.comp.missingHint") })
      ] }) : src ? /* @__PURE__ */ jsx("pre", { className: "comp-src", style: { height }, children: html ?? "" }) : doc == null ? /* @__PURE__ */ jsx("div", { className: "frame", style: { height } }) : Frame ? /* @__PURE__ */ jsx(Frame, { src: toDataUrl$1(doc), title, className: themed ? "frame themed" : "frame", style: frameStyle }, `${nonce}${themed}${version}`) : /* @__PURE__ */ jsx(
        "iframe",
        {
          className: themed ? "frame themed" : "frame",
          style: frameStyle,
          sandbox: "allow-scripts",
          srcDoc: doc,
          title,
          referrerPolicy: "no-referrer"
        },
        `${nonce}${themed}${version}`
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "foot meta", children: [
      /* @__PURE__ */ jsx("span", { children: Object.keys(files).length ? c.t("board.comp.dataFiles", { n: Object.keys(files).length, size: fmtBytes(Object.values(files).reduce((s, f) => s + f.n, 0)) }) : c.t("board.embed.live") }),
      /* @__PURE__ */ jsx("span", { className: "sp" }),
      item.by === "h" && /* @__PURE__ */ jsx(Sig, {})
    ] })
  ] });
}
const SIZES = {
  card: [256, 120],
  todo: [304, 240],
  col: [276, 320],
  link: [276, 250],
  image: [372, 260],
  embed: [452, 320],
  video: [400, 260],
  board: [212, 170],
  frame: [480, 320],
  box: [196, 62],
  text: [420, 40],
  draw: [120, 80],
  live: [400, 300],
  shape: [160, 56],
  comp: [480, 320]
};
const SHAPES = { rect: [160, 56], diamond: [150, 100], pill: [150, 48], circle: [72, 72] };
const PLACE_GAP = 24;
const MOVABLE = /* @__PURE__ */ new Set(["card", "todo", "col", "link", "image", "embed", "video", "board", "live", "comp"]);
const round$1 = (n) => Math.round(n) + 0;
function aspectOf(item) {
  const { iw, ih } = item;
  return iw && ih && iw > 0 && ih > 0 ? iw / ih : null;
}
function stageRatio(item) {
  if (item.video) return item.video.vert ? 9 / 16 : 16 / 9;
  const r = aspectOf(item);
  return r === null ? 16 / 9 : Math.min(2.4, Math.max(0.5, r));
}
function stageAspect(item) {
  if (item.video || aspectOf(item) === null) return void 0;
  return { aspectRatio: `${stageRatio(item)}` };
}
const THUMB_MIN = 96, THUMB_MAX = 200, THUMB_DEFAULT = 128;
function thumbAspect(item) {
  const r = aspectOf(item);
  return r === null ? void 0 : { aspectRatio: `${item.iw} / ${item.ih}` };
}
const lines = (chars, perLine) => Math.max(1, Math.ceil(chars / Math.max(1, perLine)));
const IMAGE_CHROME = 2 + 6, CAP_LINE = 15.6;
function estimateSize(item) {
  const k = item.k;
  const [dw, dh] = (k === "shape" ? SHAPES[item.sh ?? "rect"] : void 0) ?? SIZES[k] ?? [200, 100];
  const w = item.w ?? dw;
  switch (k) {
    case "image": {
      const r = aspectOf(item) ?? 4 / 3;
      const art = Math.max(aspectOf(item) === null ? 60 : 0, (w - 14) / r);
      const cap = item.cap ?? "";
      const capLines = cap ? lines(cap.length * 7.4, w - 24) : 0;
      return { w, h: round$1(IMAGE_CHROME + art + 21 + CAP_LINE * capLines) };
    }
    case "video": {
      const stage = (w - 2) / stageRatio(item);
      const title = item.title || "";
      const body = 24 + 10.5 + 7 + 18.85 * lines(title.length * 7.6, w - 28) + (item.desc ? 4 + 17.75 * Math.min(3, lines(item.desc.length * 6.4, w - 28)) : 0) + (item.by === "h" ? 29 : 0);
      return { w, h: round$1(2 + stage + 1 + body) };
    }
    case "link": {
      const r = aspectOf(item);
      const thumb = item.st === "wait" || item.img ? (r === null ? THUMB_DEFAULT : Math.min(THUMB_MAX, Math.max(THUMB_MIN, (w - 2) / r))) + 1 : 0;
      const dom = 10.5;
      let body;
      if (item.st === "wait") body = 112;
      else {
        const title = item.title || (item.st === "fail" ? item.site || "" : item.url || "");
        body = 24 + dom + 7 + 18.85 * lines(title.length * 7.6, w - 28);
        if (item.desc) body += 4 + 17.75 * Math.min(3, lines(item.desc.length * 6.4, w - 28));
        if ((item.st === "fail" || !item.title) && item.url) body += 6 + 14 * lines(item.url.length * 6.3, w - 28);
        if (item.by === "h") body += 29;
      }
      return { w, h: round$1(2 + thumb + body) };
    }
    case "card": {
      const text = item.text ?? "";
      const quote = !item.title && text.length > 0 && text.length <= 160 && !text.includes("\n");
      let h = 28;
      if (item.title) h += 18.5 * lines(item.title.length * 7.6, w - 54);
      if (text) {
        const per = quote ? 8.6 : 6.5, inner = quote ? w - 48 : w - 34;
        const rows = text.split("\n").reduce((n, ln) => n + lines(ln.length * per, inner), 0);
        h += (quote ? 22.7 : 18.1) * rows + (item.title ? 4 : 0);
      }
      if (item.by === "h") h += 23;
      if (item.tags?.length || item.due) h += 24;
      return { w, h: round$1(Math.max(h, 40)) };
    }
    case "col":
      return { w, h: 60 + 96 * (item.kids?.length ?? 0) };
    case "todo":
      return { w, h: 110 + 26 * (item.items?.length ?? 0) };
    case "live":
      return { w, h: item.h ?? dh };
    default:
      return { w, h: item.h ?? dh };
  }
}
function collides(a, b, gap = 0) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}
function overlaps(a, b, tol = 1) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > tol && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > tol;
}
const NEAR = 100, UP = 3;
function freePlace(want, size, obstacles, opts = {}) {
  const gap = opts.gap ?? PLACE_GAP;
  const wx = round$1(want.x), wy = round$1(want.y);
  let order = obstacles;
  const free = (x, y) => !order.some((o) => collides({ x, y, w: size.w, h: size.h }, o, gap));
  const inside = (x, y) => !opts.within || x >= opts.within.x && y >= opts.within.y && x + size.w <= opts.within.x + opts.within.w && y + size.h <= opts.within.y + opts.within.h;
  if (free(wx, wy) && inside(wx, wy)) return { x: wx, y: wy };
  const cx2 = wx + size.w / 2, cy2 = wy + size.h / 2;
  const near = obstacles.map((o) => ({ o, d: (o.x + o.w / 2 - cx2) ** 2 + (o.y + o.h / 2 - cy2) ** 2 })).sort((p, q) => p.d - q.d || p.o.y - q.o.y || p.o.x - q.o.x).slice(0, NEAR).map((p) => p.o);
  const nearSet = new Set(near);
  order = [...near, ...obstacles.filter((o) => !nearSet.has(o))];
  const xs2 = /* @__PURE__ */ new Set([wx]), ys2 = /* @__PURE__ */ new Set([wy]);
  for (const o of near) {
    xs2.add(round$1(o.x + o.w + gap));
    xs2.add(round$1(o.x - size.w - gap));
    xs2.add(round$1(o.x));
    ys2.add(round$1(o.y + o.h + gap));
    ys2.add(round$1(o.y - size.h - gap));
    ys2.add(round$1(o.y));
  }
  const cands = [];
  for (const x of xs2) for (const y of ys2) cands.push({ x, y, d: (UP * Math.min(0, x - wx) + Math.max(0, x - wx)) ** 2 + (UP * Math.min(0, y - wy) + Math.max(0, y - wy)) ** 2 });
  cands.sort((p, q) => p.d - q.d || p.y - q.y || p.x - q.x);
  if (opts.within) {
    const hit2 = cands.find((c) => inside(c.x, c.y) && free(c.x, c.y));
    if (hit2) return { x: hit2.x, y: hit2.y };
  }
  const hit = cands.find((c) => free(c.x, c.y));
  if (hit) return { x: hit.x, y: hit.y };
  const bottom = Math.max(wy, ...obstacles.map((o) => o.y + o.h));
  return { x: wx, y: round$1(bottom + gap) };
}
function resolvePlan(entries, opts = {}) {
  const gap = opts.gap ?? PLACE_GAP, tol = opts.tol ?? 1;
  const settled = entries.filter((e) => e.anchored).map((e) => e.rect);
  const order = entries.filter((e) => !e.anchored).sort((p, q) => p.rect.y - q.rect.y || p.rect.x - q.rect.x || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  const pending2 = new Map(order.map((e) => [e.id, e.rect]));
  const out = [];
  for (const e of order) {
    pending2.delete(e.id);
    const hit = settled.some((s) => overlaps(e.rect, s, tol));
    let rect = e.rect;
    if (hit) {
      const others = [...settled, ...pending2.values()];
      const p = freePlace({ x: e.rect.x, y: e.rect.y }, e.rect, others, { gap, within: e.within });
      rect = { x: p.x, y: p.y, w: e.rect.w, h: e.rect.h };
      out.push({ id: e.id, x: p.x, y: p.y });
    }
    settled.push(rect);
  }
  return out;
}
function pushPlan(entries, grown, opts = {}) {
  const gap = opts.gap ?? PLACE_GAP, tol = opts.tol ?? 1;
  const rects = new Map(entries.map((e) => [e.id, { ...e.rect }]));
  const anchored = new Set(entries.filter((e) => e.anchored).map((e) => e.id));
  const origin = new Map(entries.map((e) => [e.id, { x: e.rect.x, y: e.rect.y }]));
  const order = entries.map((e) => e.id).sort();
  const blocked = /* @__PURE__ */ new Set();
  const queue = [grown];
  const seen = /* @__PURE__ */ new Set([grown]);
  for (let guard = 0; queue.length && guard < 400; guard++) {
    const sid = queue.shift();
    const s = rects.get(sid);
    if (!s) continue;
    for (const id of order) {
      if (id === sid || id === grown && sid !== grown) continue;
      const m = rects.get(id);
      if (!overlaps(s, m, tol)) continue;
      if (anchored.has(id)) {
        blocked.add(id);
        continue;
      }
      const below = m.y + m.h / 2 >= s.y + s.h / 2, right = m.x + m.w / 2 >= s.x + s.w / 2;
      const dy = below ? s.y + s.h + gap - m.y : m.y + m.h + gap - s.y;
      const dx = right ? s.x + s.w + gap - m.x : m.x + m.w + gap - s.x;
      if (dy <= dx * 1.6) m.y = round$1(below ? m.y + dy : m.y - dy);
      else m.x = round$1(right ? m.x + dx : m.x - dx);
      if (!seen.has(id)) {
        seen.add(id);
      }
      queue.push(id);
    }
  }
  const moves = [];
  for (const id of order) {
    if (id === grown) continue;
    const r = rects.get(id), o = origin.get(id);
    if (r.x !== o.x || r.y !== o.y) moves.push({ id, x: r.x, y: r.y });
  }
  return { moves, blocked: [...blocked].sort() };
}
function useAsset(aid) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (aid) assetUrl(aid).then((u) => live && setUrl(u), () => void 0);
    return () => {
      live = false;
    };
  }, [aid]);
  return url;
}
function fieldHint(c, id, field, dflt = false) {
  const h = c.hint && c.hint.id === id ? c.hint : null;
  const mine = h?.field ? h.field === field : dflt;
  return { caret: mine ? h?.caret : void 0, seed: mine ? h?.seed : void 0, focus: mine };
}
function Pic({ src, alt = "" }) {
  return /* @__PURE__ */ jsx("img", { src, alt, draggable: false });
}
function EditText({ value, onDone, placeholder, className, single, caret, seed, focus = true, onEnter }) {
  const ref = useRef(null);
  const [v, setV] = useState(seed ? value + seed : value);
  useEffect(() => {
    const el = ref.current;
    if (!el || !focus) return;
    el.focus({ preventScroll: true });
    const at = seed ? el.value.length : Math.max(0, Math.min(el.value.length, caret ?? el.value.length));
    el.setSelectionRange(at, at);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [v]);
  return /* @__PURE__ */ jsx(
    "textarea",
    {
      ref,
      className: `edit${className ? ` ${className}` : ""}`,
      value: v,
      rows: 1,
      placeholder,
      "data-nodrag": "",
      onChange: (e) => setV(single ? e.target.value.replace(/\n/g, " ") : e.target.value),
      onBlur: (e) => {
        const to = e.relatedTarget;
        const card = e.currentTarget.closest("[data-iid], [data-kid]");
        onDone(v, !(to && card?.contains(to)));
      },
      onKeyDown: (e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.target.blur();
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (onEnter && !e.metaKey && !e.ctrlKey) onEnter();
          else e.target.blur();
        }
      }
    }
  );
}
function Meta({ item, t: t2, extra }) {
  const due = item.due ? dueLabel(t2, item.due) : null;
  if (!item.tags?.length && !due && item.by !== "h" && !extra) return null;
  return /* @__PURE__ */ jsxs("div", { className: "meta", children: [
    item.tags?.map((tag) => /* @__PURE__ */ jsx("span", { className: "tag", children: tag }, tag)),
    extra,
    /* @__PURE__ */ jsx("span", { className: "sp" }),
    due && /* @__PURE__ */ jsx("span", { className: due.today ? "due" : void 0, children: due.text }),
    item.by === "h" && /* @__PURE__ */ jsx(Sig, {})
  ] });
}
function CardView({ id, item, c }) {
  const editing = c.editing === id;
  const text = item.text ?? "";
  const quote = !item.title && text.length > 0 && text.length <= 160 && !text.includes("\n");
  if (editing) {
    const th = fieldHint(c, id, "title"), bh = fieldHint(c, id, "text", true);
    return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-note${item.by === "h" ? " dm" : ""}`, children: [
      /* @__PURE__ */ jsx("h4", { children: /* @__PURE__ */ jsx(
        EditText,
        {
          single: true,
          value: item.title ?? "",
          placeholder: c.t("board.card.titlePh"),
          caret: th.caret,
          seed: th.seed,
          focus: th.focus,
          onEnter: () => document.querySelector(`[data-iid="${id}"] .body textarea, [data-kid="${id}"] .body textarea`)?.focus(),
          onDone: (v, leaving) => {
            if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null });
            if (leaving) c.setEditing(null);
          }
        }
      ) }),
      /* @__PURE__ */ jsx("div", { className: "body", children: /* @__PURE__ */ jsx(
        EditText,
        {
          value: text,
          placeholder: c.t("board.card.textPh"),
          caret: bh.caret,
          seed: bh.seed,
          focus: bh.focus,
          onDone: (v, leaving) => {
            if (leaving) c.setEditing(null);
            if (v !== text) c.update(id, { text: v || null });
          }
        }
      ) })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-note${quote ? " quote" : ""}${item.h ? " capped" : ""}${item.by === "h" ? " dm" : ""}`, children: [
    item.title && /* @__PURE__ */ jsx("h4", { "data-field": "title", children: item.title }),
    text ? /* @__PURE__ */ jsx("div", { className: "body", "data-field": "text", children: /* @__PURE__ */ jsx(RichText, { text }) }) : !item.title && /* @__PURE__ */ jsx("div", { className: "body", style: { opacity: 0.5 }, children: c.t("board.card.empty") }),
    /* @__PURE__ */ jsx(Meta, { item, t: c.t })
  ] });
}
function TodoView({ id, item, c }) {
  const items = item.items ?? [];
  const done = items.filter((x) => x.done).length;
  const left = items.length - done;
  const [editRow, setEditRow] = useState(null);
  const [draft, setDraft] = useState("");
  const set = (next) => c.update(id, { items: next });
  const rowHint = c.hint && c.hint.id === id && c.hint.field?.startsWith("row:") ? c.hint : null;
  useEffect(() => {
    if (rowHint && c.editing === id) setEditRow(Number(rowHint.field.slice(4)));
  }, [rowHint, c.editing, id]);
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-todo${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 304 }, children: [
    c.editing === id && !(c.hint?.id === id && c.hint.field?.startsWith("row:")) ? /* @__PURE__ */ jsx("div", { className: "hd", children: /* @__PURE__ */ jsx(
      EditText,
      {
        single: true,
        value: item.title ?? "",
        caret: fieldHint(c, id, "title", true).caret,
        seed: fieldHint(c, id, "title", true).seed,
        onDone: (v) => {
          c.setEditing(null);
          c.update(id, { title: v.trim() || null });
        }
      }
    ) }) : /* @__PURE__ */ jsxs("div", { className: "hd", children: [
      /* @__PURE__ */ jsx("span", { className: "t", "data-field": "title", children: item.title || c.t("board.todo.title") }),
      /* @__PURE__ */ jsxs("span", { className: "n", children: [
        done,
        "/",
        items.length
      ] })
    ] }),
    items.length > 0 && items.length <= 40 && /* @__PURE__ */ jsx("div", { className: "cells", children: items.map((x, i) => /* @__PURE__ */ jsx("i", { className: x.done ? "on" : void 0 }, i)) }),
    items.length > 0 && /* @__PURE__ */ jsx("div", { className: "sum", children: left === 0 ? /* @__PURE__ */ jsx("b", { children: c.t("board.todo.allDone") }) : /* @__PURE__ */ jsx("b", { children: c.t("board.todo.left", { n: left }) }) }),
    /* @__PURE__ */ jsx("ul", { children: items.map((x, i) => /* @__PURE__ */ jsxs("li", { className: x.done ? "x" : void 0, children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: "box",
          role: "checkbox",
          "aria-checked": !!x.done,
          tabIndex: 0,
          "data-nodrag": "",
          onClick: () => set(items.map((y, j) => j === i ? { ...y, done: !y.done || void 0 } : y)),
          onKeyDown: (e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              set(items.map((y, j) => j === i ? { ...y, done: !y.done || void 0 } : y));
            }
          }
        }
      ),
      editRow === i ? /* @__PURE__ */ jsx("span", { className: "l", children: /* @__PURE__ */ jsx(EditText, { single: true, value: x.t, caret: rowHint?.field === `row:${i}` ? rowHint.caret : void 0, onDone: (v) => {
        setEditRow(null);
        if (c.editing === id) c.setEditing(null);
        if (!v.trim()) set(items.filter((_, j) => j !== i));
        else if (v !== x.t) set(items.map((y, j) => j === i ? { ...y, t: v.trim() } : y));
      } }) }) : /* @__PURE__ */ jsx("span", { className: "l", "data-field": `row:${i}`, children: x.t }),
      x.due ? /* @__PURE__ */ jsx("span", { className: `side${dueLabel(c.t, x.due).today ? " due" : ""}`, children: dueLabel(c.t, x.due).text }) : x.by === "h" ? /* @__PURE__ */ jsx("span", { className: "side sig", children: /* @__PURE__ */ jsx(Cad, {}) }) : null,
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "rm",
          "data-nodrag": "",
          "aria-label": c.t("board.todo.remove"),
          onClick: () => set(items.filter((_, j) => j !== i)),
          children: /* @__PURE__ */ jsx(Icon, { name: "close", size: 12 })
        }
      )
    ] }, i)) }),
    /* @__PURE__ */ jsxs("label", { className: "addrow", "data-nodrag": "", children: [
      /* @__PURE__ */ jsx("b", { children: /* @__PURE__ */ jsx(Icon, { name: "plus", size: 13 }) }),
      /* @__PURE__ */ jsx(
        "input",
        {
          value: draft,
          placeholder: c.t("board.todo.add"),
          onChange: (e) => setDraft(e.target.value),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter" && draft.trim()) {
              set([...items, { t: draft.trim() }]);
              setDraft("");
            }
            if (e.key === "Escape") e.target.blur();
          }
        }
      )
    ] })
  ] });
}
function ColumnView({ id, item, c, dropIndex }) {
  const kids = item.kids ?? [];
  return /* @__PURE__ */ jsxs("div", { className: "hb-col", style: item.w ? { width: item.w } : void 0, children: [
    c.editing === id ? /* @__PURE__ */ jsx("div", { className: "hd", children: /* @__PURE__ */ jsx(
      EditText,
      {
        single: true,
        value: item.title ?? "",
        caret: fieldHint(c, id, "title", true).caret,
        seed: fieldHint(c, id, "title", true).seed,
        onDone: (v) => {
          c.setEditing(null);
          c.update(id, { title: v.trim() || null });
        }
      }
    ) }) : /* @__PURE__ */ jsxs("div", { className: "hd", children: [
      /* @__PURE__ */ jsx("span", { className: "t", "data-field": "title", children: item.title || c.t("board.col.title") }),
      /* @__PURE__ */ jsx("span", { className: "n", children: kids.length }),
      item.by === "h" && /* @__PURE__ */ jsx("span", { className: "n sig", children: /* @__PURE__ */ jsx(Cad, {}) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `track${dropIndex != null ? " drop" : ""}`, "data-col": id, children: [
      kids.map((k, i) => /* @__PURE__ */ jsxs("div", { style: { display: "contents" }, children: [
        dropIndex === i && /* @__PURE__ */ jsx("div", { className: "drop-line" }),
        c.renderKid(k)
      ] }, c.keyOf(k))),
      dropIndex != null && dropIndex >= kids.length && /* @__PURE__ */ jsx("div", { className: "drop-line" })
    ] }),
    /* @__PURE__ */ jsxs("button", { className: "add", "data-nodrag": "", onClick: () => c.addToColumn(id), children: [
      /* @__PURE__ */ jsx(Icon, { name: "plus", size: 13 }),
      c.t("board.col.add")
    ] })
  ] });
}
const PLAY = /* @__PURE__ */ jsx("svg", { viewBox: "0 0 10 12", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M0 0 10 6 0 12z" }) });
function VideoView({ id, item, c }) {
  const poster = useAsset(item.video ? item.img : void 0);
  const playing = c.playing === id;
  const direct = item.k === "video" ? item.src : void 0;
  const asset = item.k === "video" ? item.asset : void 0;
  const player = item.video ? playerUrl(item.video) : null;
  const vert = !!item.video?.vert;
  const stageStyle = stageAspect(item);
  const site = item.site || (item.url ? hostOf(item.url) : direct ? hostOf(direct) : asset ? c.t("board.video.uploaded") : "");
  const title = item.title || (direct ? direct.split("/").pop() : "") || c.t("board.video.untitled");
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-video${vert ? " vert" : ""}${item.by === "h" ? " dm" : ""}`, children: [
    player ? /* @__PURE__ */ jsxs("div", { className: "stage", style: stageStyle, children: [
      playing && /* @__PURE__ */ jsx(
        "iframe",
        {
          src: player,
          title,
          "data-nodrag": "",
          sandbox: "allow-scripts allow-same-origin allow-presentation",
          allow: "autoplay; fullscreen; picture-in-picture; encrypted-media",
          allowFullScreen: true,
          referrerPolicy: "strict-origin-when-cross-origin"
        }
      ),
      !playing && (poster ? /* @__PURE__ */ jsx(Pic, { src: poster }) : /* @__PURE__ */ jsx("div", { className: "poster-empty", children: site })),
      !playing && /* @__PURE__ */ jsxs("button", { className: "play", "data-nodrag": "", onClick: () => c.setPlaying(id), children: [
        PLAY,
        c.t("board.video.play")
      ] })
    ] }) : /* @__PURE__ */ jsx(VideoStage, { playId: id, c, src: direct, asset, posterAsset: item.img, dur: item.dur, title, syncGroup: item.sync, style: stageStyle }),
    /* @__PURE__ */ jsx("div", { className: "hb-link", children: /* @__PURE__ */ jsxs("div", { className: "body", children: [
      /* @__PURE__ */ jsx("div", { className: "dom", children: /* @__PURE__ */ jsx("span", { children: site }) }),
      c.editing === id ? /* @__PURE__ */ jsx("h4", { children: /* @__PURE__ */ jsx(
        EditText,
        {
          single: true,
          value: item.title ?? "",
          placeholder: title,
          caret: fieldHint(c, id, "title", true).caret,
          seed: fieldHint(c, id, "title", true).seed,
          onDone: (v) => {
            c.setEditing(null);
            if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null });
          }
        }
      ) }) : /* @__PURE__ */ jsx("h4", { "data-field": "title", children: item.url ? /* @__PURE__ */ jsx("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", draggable: false, children: title }) : title }),
      item.desc && /* @__PURE__ */ jsx("p", { children: item.desc }),
      item.by === "h" && /* @__PURE__ */ jsxs("div", { className: "meta", style: { marginTop: 9 }, children: [
        /* @__PURE__ */ jsx("span", { className: "sp" }),
        /* @__PURE__ */ jsx(Sig, {})
      ] })
    ] }) })
  ] });
}
function LinkView({ id, item, c }) {
  const thumb = useAsset(item.img);
  const icon = useAsset(item.icon);
  if (item.video) return /* @__PURE__ */ jsx(VideoView, { id, item, c });
  const waiting = item.st === "wait";
  const failed = item.st === "fail";
  const site = item.site || (item.url ? hostOf(item.url) : "");
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-link${item.by === "h" ? " dm" : ""}`, children: [
    (thumb || waiting || item.img) && /* @__PURE__ */ jsx("div", { className: `thumb${waiting ? " skel-thumb" : ""}`, style: thumbAspect(item), children: thumb && /* @__PURE__ */ jsx(Pic, { src: thumb }) }),
    /* @__PURE__ */ jsxs("div", { className: `body${waiting ? " wait" : ""}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "dom", children: [
        icon && /* @__PURE__ */ jsx("img", { src: icon, alt: "" }),
        /* @__PURE__ */ jsx("span", { children: item.url ? hostOf(item.url) : site })
      ] }),
      waiting ? /* @__PURE__ */ jsxs("div", { className: "skel", children: [
        /* @__PURE__ */ jsx("i", {}),
        /* @__PURE__ */ jsx("i", {}),
        /* @__PURE__ */ jsx("i", {})
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        c.editing === id ? /* @__PURE__ */ jsx("h4", { children: /* @__PURE__ */ jsx(
          EditText,
          {
            single: true,
            value: item.title ?? "",
            placeholder: failed ? site : item.url,
            caret: fieldHint(c, id, "title", true).caret,
            seed: fieldHint(c, id, "title", true).seed,
            onDone: (v) => {
              c.setEditing(null);
              if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null });
            }
          }
        ) }) : /* @__PURE__ */ jsx("h4", { "data-field": "title", children: /* @__PURE__ */ jsx("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", draggable: false, children: item.title || (failed ? site : item.url) }) }),
        item.desc && /* @__PURE__ */ jsx("p", { children: item.desc }),
        (failed || !item.title) && item.url && /* @__PURE__ */ jsx("div", { className: "url", children: item.url })
      ] }),
      item.by === "h" && /* @__PURE__ */ jsxs("div", { className: "meta", style: { marginTop: 9 }, children: [
        /* @__PURE__ */ jsx("span", { className: "sp" }),
        /* @__PURE__ */ jsx(Sig, {})
      ] })
    ] })
  ] });
}
const FILE_LABEL = { pdf: "PDF", stl: "STL", obj: "OBJ", "3mf": "3MF" };
function ImageView({ id, item, c }) {
  const url = useAsset(item.asset);
  const ratio = aspectOf(item);
  const fk = item.file ? item.fk ?? "pdf" : null;
  const isPdf = fk === "pdf";
  const [busy, setBusy] = useState(false);
  const getFile = () => {
    if (!item.file || busy) return;
    setBusy(true);
    openAsset(item.file, item.cap || "model").catch(() => void 0).finally(() => setBusy(false));
  };
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-image${fk ? " has-file" : ""}${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 372 }, children: [
    /* @__PURE__ */ jsxs("div", { className: `art${ratio ? " fit" : ""}`, style: ratio ? { aspectRatio: `${ratio}` } : !url ? { aspectRatio: "4 / 3" } : void 0, children: [
      url ? /* @__PURE__ */ jsx(Pic, { src: url, alt: item.cap ?? "" }) : fk && /* @__PURE__ */ jsx("span", { className: "file-ph", children: /* @__PURE__ */ jsx(Icon, { name: isPdf ? "fileDoc" : "model3d", size: 34 }) }),
      fk && /* @__PURE__ */ jsxs("span", { className: "fbadge", children: [
        FILE_LABEL[fk],
        isPdf && item.pg ? ` · ${c.t("board.file.pages", { n: item.pg })}` : ""
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "cap", children: [
      c.editing === id ? /* @__PURE__ */ jsx("b", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
        EditText,
        {
          single: true,
          value: item.cap ?? "",
          placeholder: c.t("board.image.capPh"),
          caret: fieldHint(c, id, "cap", true).caret,
          onDone: (v) => {
            c.setEditing(null);
            c.update(id, { cap: v.trim() || null });
          }
        }
      ) }) : /* @__PURE__ */ jsx("b", { "data-field": "cap", children: item.cap || (item.url ? hostOf(item.url) : "") }),
      fk && /* @__PURE__ */ jsx(
        "button",
        {
          className: "kbtn",
          "data-nodrag": "",
          "data-tip": c.t(isPdf ? "board.file.open" : "board.file.download"),
          "aria-label": c.t(isPdf ? "board.file.open" : "board.file.download"),
          disabled: busy,
          onClick: getFile,
          children: /* @__PURE__ */ jsx(Icon, { name: isPdf ? "fileOpen" : "fileGet", size: 13 })
        }
      ),
      item.by === "h" && /* @__PURE__ */ jsx(Sig, {})
    ] })
  ] });
}
function toDataUrl(html) {
  const bytes = new TextEncoder().encode(html);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:text/html;charset=utf-8;base64,${btoa(bin)}`;
}
function EmbedView({ id, item, c }) {
  const [html, setHtml] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [tall, setTall] = useState(false);
  const [base, setBase] = useState(null);
  const box2 = useRef(null);
  const themed = item.theme === true;
  useEffect(() => {
    let live = true;
    if (item.asset) assetHtml(item.asset).then((h) => live && setHtml(h), () => live && setHtml(""));
    return () => {
      live = false;
    };
  }, [item.asset]);
  useLayoutEffect(() => {
    if (themed && !base && box2.current) setBase(readTheme(box2.current));
  }, [themed, base]);
  const doc = useMemo(() => html == null ? null : embedDocument(html, themed, base), [html, themed, base]);
  const [scheme, setScheme] = useState(void 0);
  useEmbedBridge(box2, doc != null, themed, `${nonce}`, (t2) => setScheme(t2.scheme));
  const Frame = c.Frame;
  const active = c.playing === id;
  const height = tall ? 520 : item.h ? Math.max(120, item.h - 80) : 240;
  const frameStyle = { height, ...themed ? { colorScheme: scheme ?? base?.scheme } : {} };
  const waiting = doc == null || themed && !base;
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-embed${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 452 }, children: [
    /* @__PURE__ */ jsxs("div", { className: "bar-e", children: [
      /* @__PURE__ */ jsx("span", { className: "file", children: item.title || c.t("board.embed.title") }),
      /* @__PURE__ */ jsx("span", { className: "sb", children: c.t("board.embed.sandbox") }),
      /* @__PURE__ */ jsxs("span", { className: "tools", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `kbtn${themed ? " on" : ""}`,
            "data-nodrag": "",
            "data-tip": c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn"),
            "aria-label": c.t(themed ? "board.embed.themeOff" : "board.embed.themeOn"),
            "aria-pressed": themed,
            onClick: () => c.update(id, { theme: themed ? null : true }),
            children: /* @__PURE__ */ jsx(Icon, { name: "theme", size: 13 })
          }
        ),
        /* @__PURE__ */ jsx("button", { className: "kbtn", "data-nodrag": "", "data-tip": c.t("board.embed.reload"), "aria-label": c.t("board.embed.reload"), onClick: () => setNonce((n) => n + 1), children: /* @__PURE__ */ jsx(Icon, { name: "reload", size: 13 }) }),
        /* @__PURE__ */ jsx("button", { className: "kbtn", "data-nodrag": "", "data-tip": c.t("board.embed.taller"), "aria-label": c.t("board.embed.taller"), onClick: () => setTall((v) => !v), children: /* @__PURE__ */ jsx(Icon, { name: "taller", size: 13 }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { ref: box2, "data-nodrag": "", style: { height, position: "relative" }, children: [
      !active && /* @__PURE__ */ jsx("button", { className: "shield", "aria-label": c.t("board.embed.activate"), onClick: () => c.setPlaying(id), children: /* @__PURE__ */ jsx("span", { children: c.t("board.embed.activate") }) }),
      waiting ? /* @__PURE__ */ jsx("div", { className: "frame", style: { height } }) : Frame ? /* @__PURE__ */ jsx(Frame, { src: toDataUrl(doc), title: item.title || "embed", className: themed ? "frame themed" : "frame", style: frameStyle }, `${nonce}${themed}`) : /* @__PURE__ */ jsx(
        "iframe",
        {
          className: themed ? "frame themed" : "frame",
          style: frameStyle,
          sandbox: "allow-scripts",
          srcDoc: doc,
          title: item.title || "embed",
          referrerPolicy: "no-referrer"
        },
        `${nonce}${themed}`
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "foot meta", children: [
      /* @__PURE__ */ jsx("span", { children: c.t("board.embed.live") }),
      /* @__PURE__ */ jsx("span", { className: "sp" }),
      item.by === "h" && /* @__PURE__ */ jsx(Sig, {})
    ] })
  ] });
}
const childCache = /* @__PURE__ */ new Map();
const CHILD_POLL_MS = 5e3;
function loadBoardDoc(bid, fresh = false) {
  let p = fresh ? void 0 : childCache.get(bid);
  if (!p) {
    p = boardsApi.since(bid, -1).then((r) => r.doc ?? null, () => null);
    childCache.set(bid, p);
  }
  return p;
}
function BoardPreview({ doc, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => drawPreview(el, doc, { accent: accentOf(el), cell: 5 });
    draw();
    const RO = globalThis.ResizeObserver;
    const ro = RO ? new RO(draw) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [doc]);
  return /* @__PURE__ */ jsx("canvas", { ref, className, style: { position: "absolute", inset: 0, width: "100%", height: "100%" } });
}
function BoardRefView({ item, c }) {
  const [child, setChild] = useState(null);
  useEffect(() => {
    if (!item.ref) return;
    const ref = item.ref;
    let live = true;
    let seq = -1;
    const load = () => loadBoardDoc(ref, true).then((d) => {
      if (live) {
        seq = d?.seq ?? -1;
        setChild(d);
      }
    });
    void load();
    const check = async () => {
      if (document.hidden || seq < 0) return;
      try {
        const r = await boardsApi.since(ref, seq);
        if (live && (r.entries?.length || r.doc)) await load();
      } catch {
      }
    };
    const i = window.setInterval(check, CHILD_POLL_MS);
    const onVis = () => {
      void check();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      live = false;
      window.clearInterval(i);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [item.ref]);
  const count = child ? Object.values(child.items).filter((x) => x.k !== "line").length : 0;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `hb-card hb-boardref${item.by === "h" ? " dm" : ""}`,
      style: { width: item.w ?? 212 },
      onDoubleClick: (e) => {
        e.stopPropagation();
        if (item.ref) c.openBoard(item.ref);
      },
      children: [
        /* @__PURE__ */ jsx("div", { className: "pv", children: /* @__PURE__ */ jsx(MiniBoard, { doc: child, id: item.ref }) }),
        /* @__PURE__ */ jsxs("div", { className: "ttl", children: [
          /* @__PURE__ */ jsx("b", { "data-tip": child?.name ?? item.title ?? void 0, children: child?.name ?? item.title ?? c.t("board.ref.missing") }),
          /* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx("button", { "data-nodrag": "", "data-tip": c.t("board.index.open"), "aria-label": c.t("board.index.open"), onClick: () => item.ref && c.openBoard(item.ref), children: /* @__PURE__ */ jsx(Icon, { name: "openBoard", size: 13 }) }) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "meta", children: /* @__PURE__ */ jsx("span", { children: c.t("board.ref.meta", { n: count, when: ago(c.t, child?.updated) }) }) })
      ]
    }
  );
}
function FrameView({ id, item, c }) {
  return /* @__PURE__ */ jsxs("div", { className: `hb-frame${item.by === "h" ? " dm soft" : ""}`, children: [
    item.by !== "h" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("i", {}),
      /* @__PURE__ */ jsx("i", {}),
      /* @__PURE__ */ jsx("i", {}),
      /* @__PURE__ */ jsx("i", {})
    ] }),
    /* @__PURE__ */ jsxs("span", { className: "lbl", children: [
      item.by === "h" && /* @__PURE__ */ jsx(Cad, {}),
      /* @__PURE__ */ jsx("span", { className: "t", children: c.editing === id ? /* @__PURE__ */ jsx(
        EditText,
        {
          single: true,
          value: item.title ?? "",
          caret: fieldHint(c, id, "title", true).caret,
          seed: fieldHint(c, id, "title", true).seed,
          onDone: (v) => {
            c.setEditing(null);
            c.update(id, { title: v.trim() || null });
          }
        }
      ) : /* @__PURE__ */ jsx("span", { "data-field": "title", children: item.title || c.t("board.frame.title") }) }),
      item.note && /* @__PURE__ */ jsx("em", { children: item.note })
    ] })
  ] });
}
function BoxView({ id, item, c }) {
  return /* @__PURE__ */ jsxs("div", { className: "hb-box", children: [
    item.num && /* @__PURE__ */ jsx("span", { className: "num", children: item.num }),
    /* @__PURE__ */ jsxs("span", { style: { minWidth: 0 }, children: [
      c.editing === id ? /* @__PURE__ */ jsx("b", { children: /* @__PURE__ */ jsx(
        EditText,
        {
          single: true,
          value: item.title ?? "",
          caret: fieldHint(c, id, "title", true).caret,
          seed: fieldHint(c, id, "title", true).seed,
          onDone: (v) => {
            c.setEditing(null);
            c.update(id, { title: v.trim() || null });
          }
        }
      ) }) : /* @__PURE__ */ jsx("b", { "data-field": "title", children: item.title || "…" }),
      item.sub && /* @__PURE__ */ jsx("small", { children: item.sub })
    ] })
  ] });
}
function TextView({ id, item, c }) {
  const size = item.size === "h" || item.size === "s" ? item.size : "p";
  if (c.editing === id) {
    const h = fieldHint(c, id, "text", true);
    return /* @__PURE__ */ jsx("div", { className: `hb-text ${size}`, children: /* @__PURE__ */ jsx(
      EditText,
      {
        single: size === "h",
        value: item.text ?? "",
        caret: h.caret,
        seed: h.seed,
        onDone: (v) => {
          c.setEditing(null);
          c.update(id, { text: v || null });
        }
      }
    ) });
  }
  return /* @__PURE__ */ jsx("div", { className: `hb-text ${size}`, "data-field": "text", children: item.text || c.t("board.text.empty") });
}
const SHAPE_DEFAULT = { rect: [160, 56], diamond: [150, 100], pill: [150, 48], circle: [72, 72] };
function shapeOutline(sh, w, h) {
  const x0 = 0.75, y0 = 0.75, x1 = w - 0.75, y1 = h - 0.75, mx = w / 2, my = h / 2;
  if (sh === "diamond") return `M${mx} ${y0} L${x1} ${my} L${mx} ${y1} L${x0} ${my}Z`;
  if (sh === "circle") return `M${x0} ${my} A${mx - 0.75} ${my - 0.75} 0 1 0 ${x1} ${my} A${mx - 0.75} ${my - 0.75} 0 1 0 ${x0} ${my}Z`;
  const r = sh === "pill" ? Math.min(mx, my) - 0.75 : 5;
  return `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}
function ShapeView({ id, item, c }) {
  const sh = item.sh ?? "rect";
  const [dw, dh] = SHAPE_DEFAULT[sh] ?? SHAPE_DEFAULT.rect;
  const ref = useRef(null);
  const [box2, setBox] = useState({ w: item.w ?? dw, h: item.h ?? dh });
  useEffect(() => {
    const el = ref.current;
    const RO = globalThis.ResizeObserver;
    if (!el || !RO) return;
    const ro = new RO(() => setBox((b) => b.w === el.offsetWidth && b.h === el.offsetHeight ? b : { w: el.offsetWidth || b.w, h: el.offsetHeight || b.h }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const hint = fieldHint(c, id, "title", true);
  return /* @__PURE__ */ jsxs("div", { ref, className: `hb-shape ${sh}${item.by === "h" ? " by-h" : ""}`, children: [
    /* @__PURE__ */ jsx("svg", { className: "o", width: box2.w, height: box2.h, viewBox: `0 0 ${box2.w} ${box2.h}`, "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: shapeOutline(sh, box2.w, box2.h) }) }),
    /* @__PURE__ */ jsx("span", { className: "t", children: c.editing === id ? /* @__PURE__ */ jsx(
      EditText,
      {
        value: item.title ?? "",
        placeholder: c.t("board.shape.ph"),
        caret: hint.caret,
        seed: hint.seed,
        onDone: (v) => {
          c.setEditing(null);
          if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null });
        }
      }
    ) : /* @__PURE__ */ jsx("span", { "data-field": "title", children: item.title || "" }) })
  ] });
}
function DrawView({ item, selected, erasing }) {
  const geo = inkGeometry(item, strokePath);
  if (!geo) return null;
  const { box: box2 } = geo;
  const sw = item.sw ?? 1.9;
  const cls = `hb-draw${selected ? " sel" : ""}${erasing ? " erasing" : ""}${item.tl === "hl" ? " hl" : ""}${item.c ? ` c-${item.c}` : ""}`;
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: cls,
      width: box2.w,
      height: box2.h,
      viewBox: `${box2.x} ${box2.y} ${box2.w} ${box2.h}`,
      style: { position: "absolute", left: box2.x, top: box2.y },
      children: geo.paths.map((p, i) => /* @__PURE__ */ jsx(
        "path",
        {
          d: p.d,
          className: p.fill ? "fill" : void 0,
          strokeWidth: p.fill ? void 0 : sw,
          strokeDasharray: p.dashed ? `${Math.max(4, sw * 3)} ${Math.max(4, sw * 2.4)}` : void 0
        },
        i
      ))
    }
  );
}
const MARK_ICON = { ok: "markOk", fail: "markFail", wait: "markWait" };
function Mark({ mark, t: t2 }) {
  return /* @__PURE__ */ jsx("i", { className: `hb-mark ${mark}`, role: "img", "aria-label": t2(`board.mark.${mark}`), "data-tip": t2(`board.mark.${mark}`), children: /* @__PURE__ */ jsx(Icon, { name: MARK_ICON[mark], size: 11 }) });
}
function ItemBody(props) {
  const mark = props.item.mark;
  if (!mark || props.item.k === "line" || props.item.k === "draw" || props.item.k === "frame") return /* @__PURE__ */ jsx(ItemKind, { ...props });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(ItemKind, { ...props }),
    /* @__PURE__ */ jsx(Mark, { mark, t: props.c.t })
  ] });
}
function ItemKind({ id, item, c, dropIndex, selected }) {
  switch (item.k) {
    case "card":
      return /* @__PURE__ */ jsx(CardView, { id, item, c });
    case "todo":
      return /* @__PURE__ */ jsx(TodoView, { id, item, c });
    case "col":
      return /* @__PURE__ */ jsx(ColumnView, { id, item, c, dropIndex });
    case "link":
      return /* @__PURE__ */ jsx(LinkView, { id, item, c });
    case "video":
      return /* @__PURE__ */ jsx(VideoView, { id, item, c });
    case "image":
      return /* @__PURE__ */ jsx(ImageView, { id, item, c });
    case "embed":
      return /* @__PURE__ */ jsx(EmbedView, { id, item, c });
    case "board":
      return /* @__PURE__ */ jsx(BoardRefView, { item, c });
    case "shape":
      return /* @__PURE__ */ jsx(ShapeView, { id, item, c });
    case "frame":
      return /* @__PURE__ */ jsx(FrameView, { id, item, c });
    case "box":
      return /* @__PURE__ */ jsx(BoxView, { id, item, c });
    case "text":
      return /* @__PURE__ */ jsx(TextView, { id, item, c });
    case "draw":
      return /* @__PURE__ */ jsx(DrawView, { item, selected, erasing: c.erasing?.has(id) });
    case "live":
      return /* @__PURE__ */ jsx(LiveView, { id, item, c });
    case "comp":
      return /* @__PURE__ */ jsx(CompView, { id, item, c });
    default:
      return null;
  }
}
function itemForUrl(url) {
  const k = classifyUrl(url);
  if (!k) return null;
  if (k.kind === "image") return { k: "image", url };
  if (k.kind === "file-video") return { k: "video", src: url, w: 400 };
  if (k.kind === "video") {
    const video = k.vert ? { p: k.p, id: k.id, vert: true } : { p: k.p, id: k.id };
    return { k: "link", url, video, w: k.vert ? 260 : 400 };
  }
  return { k: "link", url };
}
const DBL_MS = { mouse: 380, pen: 420, touch: 480 };
const DBL_PX = { mouse: 6, pen: 10, touch: 28 };
const TAP_SLOP = { mouse: 3, pen: 5, touch: 10 };
const TAP_MS = 700;
function pointerKind(type) {
  return type === "touch" ? "touch" : type === "pen" ? "pen" : "mouse";
}
function isTap(down, up) {
  return up.t - down.t < TAP_MS && Math.hypot(up.x - down.x, up.y - down.y) <= TAP_SLOP[down.type];
}
function nextTap(prev, cur) {
  if (prev && prev.type === cur.type && cur.t - prev.t <= DBL_MS[cur.type] && Math.hypot(cur.x - prev.x, cur.y - prev.y) <= DBL_PX[cur.type]) {
    return { double: true, last: null };
  }
  return { double: false, last: cur };
}
const EDITABLE = /* @__PURE__ */ new Set(["card", "todo", "col", "frame", "box", "text", "image", "link", "video", "shape"]);
const TYPE_TO_EDIT = /* @__PURE__ */ new Set(["card", "text", "box", "shape"]);
function dblAction(h) {
  if (h.tool === "draw" || h.chrome) return "none";
  if (h.wire) return "label";
  if (!h.kind) return "new";
  if (h.kind === "board") return "open";
  return EDITABLE.has(h.kind) ? "edit" : "none";
}
function typeToEditChar(e, kind) {
  if (!kind || !TYPE_TO_EDIT.has(kind)) return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const chars = [...e.key];
  if (chars.length !== 1 || e.key === " " || e.key.trim() === "") return null;
  return e.key;
}
function mapCaret(rendered, offset, source) {
  const o = Math.max(0, Math.min(rendered.length, Math.round(offset)));
  if (rendered === source) return o;
  if (!source.length) return 0;
  if (o >= rendered.length) return source.length;
  if (o === 0) return 0;
  for (const n of [14, 8, 4, 2]) {
    const ctx = rendered.slice(Math.max(0, o - n), o);
    if (ctx.length < Math.min(n, o)) continue;
    const at = source.indexOf(ctx);
    if (at >= 0 && source.indexOf(ctx, at + 1) < 0) return at + ctx.length;
  }
  return Math.round(o / rendered.length * source.length);
}
function endRect(end, getRect) {
  if (end == null) return null;
  if (Array.isArray(end)) return { x: end[0], y: end[1], w: 0, h: 0 };
  return getRect(end);
}
const r1 = (n) => Math.round(n * 10) / 10;
function build(id, it, getRect, fresh, prev) {
  const a = endRect(it.a, getRect), b = endRect(it.b, getRect);
  if (!a || !b) return null;
  const hermes = it.by === "h";
  const sig = `${r1(a.x)},${r1(a.y)},${r1(a.w)},${r1(a.h)}|${r1(b.x)},${r1(b.y)},${r1(b.w)},${r1(b.h)}|${it.label ?? ""}|${hermes ? 1 : 0}|${fresh ? 1 : 0}`;
  if (prev && prev.sig === sig) return prev;
  const r = route(a, b);
  const pts = r.points.slice();
  const end = pts[pts.length - 1];
  const tip = [end[0] + { r: -2, l: 2, d: 0, u: 0 }[r.dir], end[1] + { r: 0, l: 0, d: -2, u: 2 }[r.dir]];
  pts[pts.length - 1] = tip;
  const mi = Math.floor(pts.length / 2);
  const mid = pts.length === 2 ? [(pts[0][0] + tip[0]) / 2, (pts[0][1] + tip[1]) / 2] : [(pts[mi - 1][0] + pts[mi][0]) / 2, (pts[mi - 1][1] + pts[mi][1]) / 2];
  return {
    id,
    hermes,
    label: it.label,
    mid,
    fresh,
    sig,
    pts,
    d: elbowPath(pts, 7),
    dots: hermes ? samplePolyline(pts, 4).filter(([x, y]) => Math.hypot(x - tip[0], y - tip[1]) > 6) : null,
    head: headPath(tip[0], tip[1], r.dir),
    port: pts[0]
  };
}
const WireView = memo(function WireView2({ w, selected, sole, showHandle, editing, insertLabel, onSelect, onLabel, onDouble, onInsert, onHover }) {
  const lastTap = useRef(null);
  const ink2 = w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 55%, transparent)";
  const plus = () => {
    if (!w.label) return w.mid;
    const total = w.pts.reduce((n, p, i) => i ? n + Math.hypot(p[0] - w.pts[i - 1][0], p[1] - w.pts[i - 1][1]) : 0, 0) || 1;
    return pointAtT(w.pts, Math.min(0.92, 0.5 + (w.label.length * 3.3 + 26) / total));
  };
  const handleAt = showHandle?.id === w.id || sole ? plus() : null;
  return /* @__PURE__ */ jsxs("g", { className: w.fresh ? "fresh" : void 0, children: [
    /* @__PURE__ */ jsx(
      "path",
      {
        className: "hit",
        d: w.d,
        stroke: "transparent",
        strokeWidth: 12,
        fill: "none",
        "data-line": w.id,
        style: { pointerEvents: "stroke" },
        onPointerEnter: (e) => {
          if (e.pointerType !== "touch") onHover({ id: w.id });
        },
        onPointerLeave: () => onHover(null, true),
        onPointerDown: (e) => {
          e.stopPropagation();
          onSelect(w.id, e.shiftKey);
          const r = nextTap(lastTap.current, { t: e.timeStamp, x: e.clientX, y: e.clientY, type: pointerKind(e.pointerType) });
          lastTap.current = r.last;
          if (r.double) window.setTimeout(() => onDouble(w.id), 0);
        }
      }
    ),
    selected && /* @__PURE__ */ jsx("path", { className: "line-sel", d: w.d }),
    w.dots ? w.dots.map(([x, y], i) => /* @__PURE__ */ jsx(
      "rect",
      {
        className: "d",
        x: x - 1.15,
        y: y - 1.15,
        width: 2.3,
        height: 2.3,
        fill: ink2,
        style: w.fresh ? { animationDelay: `${i * 14}ms` } : void 0
      },
      i
    )) : /* @__PURE__ */ jsx("path", { d: w.d, fill: "none", stroke: ink2, strokeWidth: 1.3 }),
    /* @__PURE__ */ jsx("rect", { x: w.port[0] - 2.5, y: w.port[1] - 2.5, width: 5, height: 5, fill: ink2 }),
    /* @__PURE__ */ jsx(
      "path",
      {
        d: w.head,
        fill: w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 72%, transparent)",
        style: w.fresh && w.dots ? { animation: "hb-dot-in .2s both", animationDelay: `${w.dots.length * 14}ms` } : void 0
      }
    ),
    editing && /* @__PURE__ */ jsx("foreignObject", { x: w.mid[0] - 70, y: w.mid[1] - 11, width: 140, height: 22, children: /* @__PURE__ */ jsx(
      "input",
      {
        className: "hb-lbl-edit",
        autoFocus: true,
        defaultValue: w.label ?? "",
        "data-nodrag": "",
        maxLength: 200,
        ref: (el) => {
          if (el && document.activeElement !== el) {
            el.focus({ preventScroll: true });
            el.select();
          }
        },
        onPointerDown: (e) => e.stopPropagation(),
        onBlur: (e) => {
          if (!e.currentTarget.dataset.cancel) onLabel(w.id, e.currentTarget.value);
        },
        onKeyDown: (e) => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.dataset.cancel = "1";
            onLabel(w.id, null);
          }
        }
      }
    ) }),
    handleAt && !editing && /* @__PURE__ */ jsxs(
      "g",
      {
        className: "hb-eplus",
        "data-tip": insertLabel,
        "aria-label": insertLabel,
        role: "button",
        style: { transform: `translate(${handleAt[0]}px, ${handleAt[1]}px) scale(var(--iz, 1))` },
        onPointerEnter: () => onHover({ id: w.id }),
        onPointerLeave: () => onHover(null, true),
        onPointerDown: (e) => e.stopPropagation(),
        onClick: (e) => {
          e.stopPropagation();
          onInsert(w.id, { x: e.clientX, y: e.clientY });
        },
        children: [
          /* @__PURE__ */ jsx("circle", { r: 13, className: "pad" }),
          /* @__PURE__ */ jsx("circle", { r: 9, className: "dot" }),
          /* @__PURE__ */ jsx("path", { className: "pl", d: "M-4 0H4M0 -4V4" })
        ]
      }
    )
  ] });
});
const Wires = forwardRef(function Wires2(props, ref) {
  const { doc, getRect, version, hidden, fresh, selected, draft, editLabel, insertLabel } = props;
  const [wires, setWires] = useState([]);
  const [hover, setHover] = useState(null);
  const cache = useRef(/* @__PURE__ */ new Map());
  const live = useRef(props);
  live.current = props;
  const raf = useRef(0);
  const pending2 = useRef(null);
  const hideTimer = useRef(0);
  const compute = useCallback((only) => {
    const { doc: d, getRect: gr, hidden: hid, fresh: fr } = live.current;
    const next = [];
    const keep = /* @__PURE__ */ new Map();
    for (const [id, it] of Object.entries(d.items)) {
      if (it.k !== "line" || hid.has(id)) continue;
      if ([it.a, it.b].some((e) => typeof e === "string" && hid.has(e))) continue;
      const prev = cache.current.get(id);
      const touched = !only || !prev || [it.a, it.b].some((e) => typeof e === "string" && only.has(e));
      const w = touched ? build(id, it, gr, fr.has(id), prev) : prev ?? null;
      if (w) {
        next.push(w);
        keep.set(id, w);
      }
    }
    cache.current = keep;
    setWires((cur) => cur.length === next.length && cur.every((w, i) => w === next[i]) ? cur : next);
  }, []);
  useLayoutEffect(() => {
    compute(null);
  }, [doc, version, hidden, fresh, getRect, compute]);
  useImperativeHandle(ref, () => ({
    refresh: (ids) => {
      if (!ids) pending2.current = "all";
      else if (pending2.current !== "all") {
        const set = pending2.current ?? (pending2.current = /* @__PURE__ */ new Set());
        for (const id of ids) set.add(id);
      }
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const p = pending2.current;
        pending2.current = null;
        compute(p === "all" || !p ? null : p);
      });
    }
  }), [compute]);
  useLayoutEffect(() => () => {
    cancelAnimationFrame(raf.current);
    window.clearTimeout(hideTimer.current);
  }, []);
  const onHover = useCallback((h, soon) => {
    window.clearTimeout(hideTimer.current);
    if (h) {
      setHover(h);
      return;
    }
    if (soon) hideTimer.current = window.setTimeout(() => setHover(null), 260);
    else setHover(null);
  }, []);
  const stable = useRef({
    onSelect: (id, add) => live.current.onSelect(id, add),
    onLabel: (id, v) => live.current.onLabel(id, v),
    onDouble: (id) => live.current.onDouble(id),
    onInsert: (id, at) => live.current.onInsert(id, at)
  }).current;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("svg", { className: "hb-wires", width: "1", height: "1", children: [
      wires.map((w) => /* @__PURE__ */ jsx(
        WireView,
        {
          w,
          selected: selected.has(w.id),
          sole: selected.size === 1 && selected.has(w.id),
          showHandle: hover?.id === w.id ? hover : null,
          editing: editLabel === w.id,
          insertLabel,
          onSelect: stable.onSelect,
          onLabel: stable.onLabel,
          onDouble: stable.onDouble,
          onInsert: stable.onInsert,
          onHover
        },
        w.id
      )),
      draft && (() => {
        const r = route(draft.from, { x: draft.to[0], y: draft.to[1], w: 0, h: 0 });
        return /* @__PURE__ */ jsx("path", { className: "draft", d: elbowPath(r.points, 7) });
      })()
    ] }),
    /* @__PURE__ */ jsx("svg", { className: "hb-wires hb-wire-labels", width: "1", height: "1", "aria-hidden": "true", children: wires.filter((w) => w.label && editLabel !== w.id).map((w) => /* @__PURE__ */ jsx("text", { className: "lbl", x: w.mid[0], y: w.mid[1] + 3.5, textAnchor: "middle", children: w.label }, w.id)) })
  ] });
});
function browserTime() {
  const g = globalThis;
  return {
    now: () => g.performance ? g.performance.now() : Date.now(),
    raf: (fn2) => g.requestAnimationFrame ? g.requestAnimationFrame(fn2) : setTimeout(() => fn2(Date.now()), 16),
    caf: (id) => g.cancelAnimationFrame ? g.cancelAnimationFrame(id) : clearTimeout(id)
  };
}
const RATES = [0.25, 0.5, 1, 1.5, 2];
const clampRate = (r) => Number.isFinite(r) ? Math.max(0.1, Math.min(8, r)) : 1;
const finite = (n, d = 0) => Number.isFinite(n) ? n : d;
class GroupClock {
  name;
  s;
  subs = /* @__PURE__ */ new Set();
  video = null;
  offVideo = null;
  loop = 0;
  vloop = 0;
  wall = 0;
  // time source ms when the free-running clock last advanced
  pendingSeek = [];
  time;
  hub;
  constructor(name, time, hub) {
    this.name = name;
    this.time = time;
    this.hub = hub;
    this.s = { t: 0, playing: false, rate: 1, duration: 0, master: false, manual: false };
  }
  get state() {
    return { ...this.s };
  }
  get hasVideo() {
    return this.video !== null;
  }
  subscribe(fn2) {
    this.subs.add(fn2);
    return () => {
      this.subs.delete(fn2);
    };
  }
  emit(ev) {
    const st = this.state;
    for (const fn2 of [...this.subs]) {
      try {
        fn2(ev, st);
      } catch {
      }
    }
    this.hub?.changed(this.name);
  }
  // ── the video master ──────────────────────────────────────────────────
  attachVideo(v) {
    if (this.video === v) return () => this.detach(v);
    this.detachCurrent();
    this.video = v;
    this.s.master = true;
    const ev = (name, f) => {
      v.addEventListener(name, f);
      return () => v.removeEventListener(name, f);
    };
    const dur = () => {
      const d = finite(v.duration);
      if (d > 0 && d !== this.s.duration) {
        this.s.duration = d;
        this.emit("state");
      }
    };
    const offs = [
      ev("loadedmetadata", dur),
      ev("durationchange", dur),
      ev("play", () => {
        if (this.s.manual) return;
        this.freeze();
        this.s.playing = true;
        this.s.t = finite(v.currentTime);
        this.startLoop();
        this.emit("state");
      }),
      ev("pause", () => {
        if (this.s.manual) return;
        this.s.playing = false;
        this.s.t = finite(v.currentTime);
        this.stopLoop();
        this.emit("state");
      }),
      ev("ended", () => {
        this.s.playing = false;
        this.s.t = finite(v.currentTime);
        this.stopLoop();
        this.emit("state");
      }),
      ev("ratechange", () => {
        this.s.rate = clampRate(v.playbackRate);
        this.emit("state");
      }),
      ev("seeked", () => {
        this.s.t = finite(v.currentTime);
        this.emit("tick");
        const waiting = this.pendingSeek;
        this.pendingSeek = [];
        waiting.forEach((f) => f());
      }),
      ev("seeking", () => {
        if (!this.s.manual) {
          this.s.t = finite(v.currentTime);
          this.emit("seek");
        }
      })
    ];
    this.offVideo = () => offs.forEach((o) => o());
    const had = this.s;
    dur();
    if (had.t > 0 && Math.abs(v.currentTime - had.t) > 0.05) {
      try {
        v.currentTime = had.t;
      } catch {
      }
    }
    this.s.rate = clampRate(had.rate);
    try {
      v.playbackRate = this.s.rate;
    } catch {
    }
    if (had.playing && !had.manual) {
      this.stopLoop();
      this.startVideo(v);
    } else {
      this.s.t = had.t;
    }
    this.emit("state");
    return () => this.detach(v);
  }
  detach(v) {
    if (this.video === v) {
      this.detachCurrent();
      this.emit("state");
    }
  }
  detachCurrent() {
    this.stopLoop();
    this.offVideo?.();
    this.offVideo = null;
    this.video = null;
    this.s.master = false;
    const waiting = this.pendingSeek;
    this.pendingSeek = [];
    waiting.forEach((f) => f());
  }
  // ── the loop ──────────────────────────────────────────────────────────
  freeze() {
    this.wall = this.time.now();
  }
  startLoop() {
    if (this.s.manual || this.loop || this.vloop) return;
    const v = this.video;
    if (v && v.requestVideoFrameCallback) {
      const onFrame = (_n, meta) => {
        this.vloop = 0;
        if (!this.s.playing || !this.video) return;
        this.s.t = finite(meta.mediaTime, this.video.currentTime);
        this.emit("tick");
        this.vloop = this.video.requestVideoFrameCallback(onFrame);
      };
      this.vloop = v.requestVideoFrameCallback(onFrame);
      return;
    }
    const step = () => {
      this.loop = 0;
      if (!this.s.playing) return;
      if (this.video) this.s.t = finite(this.video.currentTime);
      else {
        const now = this.time.now();
        this.s.t += (now - this.wall) / 1e3 * this.s.rate;
        this.wall = now;
        if (this.s.duration > 0 && this.s.t >= this.s.duration) {
          this.s.t = this.s.duration;
          this.s.playing = false;
          this.emit("state");
          this.emit("tick");
          return;
        }
      }
      this.emit("tick");
      this.loop = this.time.raf(step);
    };
    this.loop = this.time.raf(step);
  }
  stopLoop() {
    if (this.loop) {
      this.time.caf(this.loop);
      this.loop = 0;
    }
    if (this.vloop) {
      try {
        this.video?.cancelVideoFrameCallback?.(this.vloop);
      } catch {
      }
      this.vloop = 0;
    }
  }
  // ── commands (from any linked card, the transport or a script) ────────
  play() {
    if (this.s.playing) return;
    if (this.s.duration > 0 && this.s.t >= this.s.duration - 1e-3) this.s.t = 0;
    this.s.playing = true;
    if (this.video && !this.s.manual) {
      try {
        this.video.currentTime = this.s.t;
      } catch {
      }
      this.startVideo(this.video);
    } else {
      this.freeze();
      this.startLoop();
    }
    this.emit("state");
  }
  /** play() can be refused (autoplay policy, codec): the group must not claim to play then. */
  startVideo(v) {
    let res;
    try {
      res = v.play();
    } catch {
      res = Promise.reject(new Error("play failed"));
    }
    if (res && typeof res.catch === "function") {
      res.catch(() => {
        if (this.video !== v || !this.s.playing) return;
        this.s.playing = false;
        this.stopLoop();
        this.emit("state");
      });
    }
  }
  pause() {
    if (!this.s.playing) return;
    this.s.playing = false;
    this.stopLoop();
    if (this.video && !this.s.manual) {
      this.video.pause();
      this.s.t = finite(this.video.currentTime, this.s.t);
    }
    this.emit("state");
  }
  toggle() {
    if (this.s.playing) this.pause();
    else this.play();
  }
  /** Moves the playhead. Resolves once the video (if any) shows that frame. */
  seek(t2) {
    let to = Math.max(0, finite(t2));
    if (this.s.duration > 0) to = Math.min(to, this.s.duration);
    this.s.t = to;
    if (!this.s.playing) this.freeze();
    this.emit("seek");
    const v = this.video;
    if (!v) {
      this.emit("tick");
      return Promise.resolve();
    }
    return new Promise((resolve2) => {
      this.pendingSeek.push(resolve2);
      try {
        v.currentTime = to;
      } catch {
        this.pendingSeek = this.pendingSeek.filter((f) => f !== resolve2);
        this.emit("tick");
        resolve2();
        return;
      }
      this.time.raf(() => {
        if (Math.abs(finite(v.currentTime) - to) < 1e-6 && !v.seeking) {
          const i = this.pendingSeek.indexOf(resolve2);
          if (i >= 0) {
            this.pendingSeek.splice(i, 1);
            this.emit("tick");
            resolve2();
          }
        }
      });
    });
  }
  setRate(r) {
    this.s.rate = clampRate(r);
    if (this.video) {
      try {
        this.video.playbackRate = this.s.rate;
      } catch {
      }
    }
    this.freeze();
    this.emit("state");
  }
  /** Free-running groups only (a video knows its own length). */
  setDuration(d) {
    if (this.video) return;
    this.s.duration = Math.max(0, finite(d));
    this.emit("state");
  }
  setManual(on) {
    if (this.s.manual === on) return;
    this.s.manual = on;
    if (on) {
      this.stopLoop();
      this.video?.pause();
      if (this.video) this.s.t = finite(this.video.currentTime, this.s.t);
    } else if (this.s.playing) {
      if (this.video) this.startVideo(this.video);
      else {
        this.freeze();
        this.startLoop();
      }
    }
    this.emit("state");
  }
  /** Manual mode: move time by `ms` of real time at the current rate (only while "playing"). */
  async advance(ms) {
    if (!this.s.manual) return this.s.t;
    if (this.s.playing) await this.seek(this.s.t + ms / 1e3 * this.s.rate);
    return this.s.t;
  }
  destroy() {
    this.stopLoop();
    this.offVideo?.();
    this.subs.clear();
  }
}
class SyncHub {
  clocks = /* @__PURE__ */ new Map();
  watchers = /* @__PURE__ */ new Set();
  manualOn = false;
  time;
  constructor(time = browserTime()) {
    this.time = time;
  }
  clock(name) {
    let c = this.clocks.get(name);
    if (!c) {
      c = new GroupClock(name, this.time, this);
      if (this.manualOn) c.setManual(true);
      this.clocks.set(name, c);
    }
    return c;
  }
  has(name) {
    return this.clocks.has(name);
  }
  names() {
    return [...this.clocks.keys()].filter((n) => !n.startsWith("~")).sort();
  }
  /** Anything about any clock changed (the transport re-renders from this). */
  watch(fn2) {
    this.watchers.add(fn2);
    return () => {
      this.watchers.delete(fn2);
    };
  }
  changed(group) {
    for (const w of [...this.watchers]) {
      try {
        w(group);
      } catch {
      }
    }
  }
  get manual() {
    return this.manualOn;
  }
  setManual(on) {
    this.manualOn = on;
    this.clocks.forEach((c) => c.setManual(on));
  }
  async advance(ms) {
    await Promise.all([...this.clocks.values()].map((c) => c.advance(ms)));
  }
  destroy() {
    this.clocks.forEach((c) => c.destroy());
    this.clocks.clear();
    this.watchers.clear();
  }
}
function makeSyncApi(hub, board, defaultGroup) {
  const pick = (g) => {
    const n = g ?? defaultGroup() ?? hub.names()[0];
    return n ? hub.clock(n) : null;
  };
  return {
    version: 1,
    board,
    groups: () => hub.names(),
    state: (g) => pick(g)?.state ?? null,
    play: (g) => pick(g)?.play(),
    pause: (g) => pick(g)?.pause(),
    seek: (t2, g) => pick(g)?.seek(t2) ?? Promise.resolve(),
    rate: (r, g) => pick(g)?.setRate(r),
    manual: (on) => hub.setManual(on),
    step: async (frames = 1, fps = 30, g) => {
      const c = pick(g);
      if (!c) return 0;
      const rate = Math.max(1, fps);
      await c.seek((Math.round(c.state.t * rate) + frames) / rate);
      return c.state.t;
    },
    advance: (ms) => hub.advance(ms)
  };
}
function installSyncApi(api2, win = window) {
  win.__hbSync = api2;
  return () => {
    if (win.__hbSync === api2) delete win.__hbSync;
  };
}
function formatClock(t2, fps = 0) {
  const s = Math.max(0, finite(t2));
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const whole = Math.floor(sec);
  const tail = fps > 0 ? `:${String(Math.floor((sec - whole) * fps)).padStart(2, "0")}` : `.${String(Math.floor((sec - whole) * 10))}`;
  return `${m}:${String(whole).padStart(2, "0")}${tail}`;
}
function groupsOf(items) {
  const out = [];
  for (const it of Object.values(items)) if (it.sync && !out.includes(it.sync)) out.push(it.sync);
  return out;
}
const fits = /* @__PURE__ */ new WeakMap();
const miniFitOf = (el) => el ? fits.get(el) ?? null : null;
const miniPad = (w, h) => Math.max(6, Math.min(22, Math.round(Math.min(w, h) * 0.09)));
const NONE = /* @__PURE__ */ new Set();
const noop = () => void 0;
const MINI_HUB = new SyncHub();
const layer = (it) => it.k === "frame" ? 0 : it.k === "draw" && it.tl === "hl" ? 1 : 2;
function box(it) {
  const [dw] = DEFAULT_SIZE[it.k] ?? [200, 100];
  return {
    x: it.x ?? 0,
    y: it.y ?? 0,
    width: it.k === "draw" ? void 0 : it.w ?? (it.k === "text" ? void 0 : dw),
    height: RESIZE_H.has(it.k) ? it.h ?? (it.k === "frame" ? 320 : it.k === "box" ? 62 : void 0) : void 0
  };
}
function MiniBoard({ doc, id, className }) {
  const t2 = useT();
  const rootRef = useRef(null);
  const worldRef = useRef(null);
  const els = useRef(/* @__PURE__ */ new Map());
  const rects = useRef(/* @__PURE__ */ new Map());
  const sig = useRef("");
  const [ver, setVer] = useState(0);
  const ctx = useMemo(() => {
    if (!doc) return null;
    const c = {
      doc,
      t: t2,
      editing: null,
      hint: null,
      keyOf: (k) => k,
      setEditing: noop,
      update: noop,
      commit: noop,
      playing: null,
      setPlaying: noop,
      openBoard: noop,
      addToColumn: noop,
      liveActions: null,
      liveActionsDown: false,
      runLiveAction: async () => null,
      bid: "",
      sync: MINI_HUB,
      runCompAction: async () => null,
      renderKid: (kid) => {
        const it = doc.items[kid];
        return it ? /* @__PURE__ */ jsx("div", { className: "hb-kid", children: /* @__PURE__ */ jsx(MiniBody, { id: kid, item: it, c }) }, kid) : null;
      }
    };
    return c;
  }, [doc, t2]);
  const items = useMemo(() => {
    if (!doc) return [];
    return Object.entries(doc.items).filter(([, it]) => !it.in && it.k !== "line").sort(([, a], [, b]) => layer(a) - layer(b));
  }, [doc]);
  const getRect = useCallback((rid) => {
    const r = rects.current.get(rid);
    if (r) return r;
    const it = doc?.items[rid];
    return it ? approxRect(it) : null;
  }, [doc]);
  const place = useCallback(() => {
    const root = rootRef.current, world = worldRef.current;
    if (!root || !world) return;
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    const tops = [...rects.current.entries()].filter(([rid]) => doc?.items[rid] && !doc.items[rid].in && doc.items[rid].k !== "line").map(([, r]) => r);
    if (!tops.length) {
      world.style.transform = "none";
      fits.delete(root);
      return;
    }
    const x0 = Math.min(...tops.map((r) => r.x)), y0 = Math.min(...tops.map((r) => r.y));
    const x1 = Math.max(...tops.map((r) => r.x + r.w)), y1 = Math.max(...tops.map((r) => r.y + r.h));
    const b = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const view = fitView(b, { w, h }, miniPad(w, h), 1.1);
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
    fits.set(root, { view, w, h, b });
  }, [doc]);
  const measure = useCallback(() => {
    const next = /* @__PURE__ */ new Map();
    let s = "";
    els.current.forEach((el, rid) => {
      const r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      next.set(rid, r);
      s += `${rid}:${r.x},${r.y},${r.w},${r.h};`;
    });
    rects.current = next;
    place();
    if (s !== sig.current) {
      sig.current = s;
      setVer((v) => v + 1);
    }
  }, [place]);
  useLayoutEffect(() => {
    measure();
  }, [measure, doc, ctx]);
  useLayoutEffect(() => {
    const RO = globalThis.ResizeObserver;
    const root = rootRef.current;
    if (!RO || !root) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const ro = new RO(schedule);
    ro.observe(root);
    els.current.forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [measure, items]);
  const reg = (rid) => (el) => {
    if (el) els.current.set(rid, el);
    else els.current.delete(rid);
  };
  return /* @__PURE__ */ jsx("div", { ref: rootRef, className: `hb hb-mini${className ? ` ${className}` : ""}`, "data-mini": id, "aria-hidden": "true", children: /* @__PURE__ */ jsxs("div", { className: "hb-world", ref: worldRef, children: [
    doc && /* @__PURE__ */ jsx(
      Wires,
      {
        doc,
        getRect,
        version: ver,
        hidden: NONE,
        fresh: NONE,
        selected: NONE,
        draft: null,
        onSelect: noop,
        editLabel: null,
        insertLabel: "",
        onLabel: noop,
        onDouble: noop,
        onInsert: noop
      }
    ),
    ctx && items.map(([rid, it]) => {
      const b = box(it);
      return /* @__PURE__ */ jsx("div", { className: "hb-item", ref: reg(rid), style: { left: b.x, top: b.y, width: b.width, height: b.height, zIndex: layer(it) < 2 ? 0 : 1 }, children: /* @__PURE__ */ jsx(MiniBody, { id: rid, item: it, c: ctx }) }, rid);
    })
  ] }) });
}
function MiniBody({ id, item, c }) {
  if (item.k === "embed") {
    return /* @__PURE__ */ jsxs("div", { className: "hb-card hb-embed", style: { width: item.w ?? 452 }, children: [
      /* @__PURE__ */ jsx("div", { className: "bar-e", children: /* @__PURE__ */ jsx("span", { className: "file", children: item.title || c.t("board.embed.title") }) }),
      /* @__PURE__ */ jsx("div", { className: "frame", style: { height: item.h ? Math.max(120, item.h - 80) : 240 } })
    ] });
  }
  if (item.k === "comp") {
    return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-embed hb-comp${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 480 }, children: [
      /* @__PURE__ */ jsx("div", { className: "bar-e", children: /* @__PURE__ */ jsx("span", { className: "file", children: item.title || item.comp }) }),
      /* @__PURE__ */ jsx("div", { className: "frame", style: { height: item.h ? Math.max(120, item.h - 80) : 240 } })
    ] });
  }
  if (item.k === "video" && item.sync) return /* @__PURE__ */ jsx(ItemBody, { id, item: { ...item, sync: void 0 }, c, dropIndex: null, selected: false });
  if (item.k === "board") {
    return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-boardref${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 212 }, children: [
      /* @__PURE__ */ jsx("div", { className: "pv" }),
      /* @__PURE__ */ jsx("div", { className: "ttl", children: /* @__PURE__ */ jsx("b", { children: item.title || itemLabel(item) }) }),
      /* @__PURE__ */ jsx("div", { className: "meta", children: /* @__PURE__ */ jsx("span", { children: " " }) })
    ] });
  }
  return /* @__PURE__ */ jsx(ItemBody, { id, item, c, dropIndex: null, selected: false });
}
function matchTransform(from, to) {
  const k = to.z / from.z;
  return { k, tx: to.x - k * from.x, ty: to.y - k * from.y };
}
const affineCss = (a) => `translate(${a.tx.toFixed(2)}px, ${a.ty.toFixed(2)}px) scale(${a.k.toFixed(5)})`;
const toPage = (v, origin) => ({ z: v.z, x: v.x + origin.left, y: v.y + origin.top });
const fromPage = (v, origin) => ({ z: v.z, x: v.x - origin.left, y: v.y - origin.top });
const smooth = (a, b, u) => {
  const t2 = Math.min(1, Math.max(0, (u - a) / (b - a)));
  return t2 * t2 * (3 - 2 * t2);
};
const leavingOpacity = (u) => 1 - smooth(0.34, 0.94, u);
const arrivingOpacity = (u) => smooth(0.1, 0.62, u);
const ZOOM_IN_MS = 560;
const ZOOM_OUT_MS = 480;
const ZOOM_EASE = [0.62, 0, 0.18, 1];
let pending = null;
const reduced$1 = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function snapshot(root) {
  const r = root.getBoundingClientRect();
  const wrap = document.createElement("div");
  wrap.className = "hb-xfade";
  wrap.setAttribute("inert", "");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  const clone2 = root.cloneNode(true);
  clone2.style.width = `${r.width}px`;
  clone2.style.height = `${r.height}px`;
  clone2.style.margin = "0";
  clone2.style.transformOrigin = "0 0";
  const src = root.querySelectorAll("canvas"), dst = clone2.querySelectorAll("canvas");
  src.forEach((c, i) => {
    try {
      dst[i]?.getContext("2d")?.drawImage(c, 0, 0);
    } catch {
    }
  });
  clone2.querySelectorAll("iframe").forEach((f) => {
    const d = document.createElement("div");
    d.className = f.className;
    d.style.cssText = f.style.cssText;
    f.replaceWith(d);
  });
  clone2.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
  wrap.appendChild(clone2);
  document.body.appendChild(wrap);
  const a = [root, ...root.querySelectorAll("*")], b = [clone2, ...clone2.querySelectorAll("*")];
  for (let i = 0; i < a.length; i++) if (a[i].scrollTop || a[i].scrollLeft) {
    b[i].scrollTop = a[i].scrollTop;
    b[i].scrollLeft = a[i].scrollLeft;
  }
  return wrap;
}
function disposeHandoff(h) {
  window.clearTimeout(h.guard);
  h.overlay.remove();
  if (pending === h) pending = null;
}
function stash(h) {
  if (pending) disposeHandoff(pending);
  pending = h;
  h.guard = window.setTimeout(() => disposeHandoff(h), 5e3);
  return true;
}
function prepareZoomIn(to, root, source) {
  if (reduced$1() || !root || !source) return false;
  const fit = miniFitOf(source);
  if (!fit) return false;
  const r = source.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const from = toPage(fit.view, r);
  return stash({ kind: "in", to, overlay: snapshot(root), from, at: performance.now(), guard: 0 });
}
function prepareZoomOut(parent, child, root, vp, cur) {
  if (reduced$1() || !root || !vp) return false;
  const r = vp.getBoundingClientRect();
  return stash({ kind: "out", to: parent, child, overlay: snapshot(root), from: toPage(cur, r), at: performance.now(), guard: 0 });
}
function takeHandoff(bid) {
  const h = pending;
  if (!h) return null;
  if (h.to !== bid || performance.now() - h.at > 5e3) return null;
  pending = null;
  window.clearTimeout(h.guard);
  return h;
}
const setOverlay = (h, page, u) => {
  const child = h.overlay.firstElementChild;
  if (child) child.style.transform = affineCss(matchTransform(h.from, page));
  h.overlay.style.opacity = String(leavingOpacity(u));
};
function arriveZoomIn(h, io, setStart) {
  const o = io.vp.getBoundingClientRect();
  const start = fromPage(h.from, o);
  io.root.style.opacity = "0";
  setStart(start);
  setOverlay(h, h.from, 0);
  return io.cam.flyTo(io.target, {
    duration: ZOOM_IN_MS,
    ease: ZOOM_EASE,
    onFrame: (u, v) => {
      setOverlay(h, toPage(v, io.vp.getBoundingClientRect()), u);
      io.root.style.opacity = String(arrivingOpacity(u));
    }
  }).then((ok) => {
    io.root.style.opacity = "";
    disposeHandoff(h);
    return ok;
  });
}
async function arriveZoomOut(h, find, size) {
  let source = null;
  let fit = null;
  for (let i = 0; i < 25 && !fit; i++) {
    source = find();
    fit = miniFitOf(source);
    if (!fit) await new Promise((r2) => window.setTimeout(r2, 40));
  }
  const r = source?.getBoundingClientRect();
  if (!fit || !r || !r.width || r.bottom < 0 || r.top > size.h || r.right < 0 || r.left > size.w) {
    h.overlay.style.transition = "opacity .26s ease-out";
    h.overlay.style.opacity = "0";
    return new Promise((res) => window.setTimeout(() => {
      disposeHandoff(h);
      res(true);
    }, 280));
  }
  const dest = toPage(fit.view, r);
  let v = h.from;
  const cam = new Camera({ get: () => v, set: (n) => {
    v = n;
  }, size: () => size });
  return cam.flyTo(dest, {
    duration: ZOOM_OUT_MS,
    ease: ZOOM_EASE,
    onFrame: (u, cur) => setOverlay(h, cur, u)
  }).then((ok) => {
    disposeHandoff(h);
    return ok;
  });
}
function BoardMenu({ at, entries, bounds, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeMenu(at, { w: el.offsetWidth, h: el.offsetHeight }, bounds));
    el.querySelector("button")?.focus({ preventScroll: true });
  }, [at, bounds]);
  useEffect(() => {
    const down = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const blur = () => onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", blur);
    };
  }, [onClose]);
  const move = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation();
    const btns = [...ref.current?.querySelectorAll("button") ?? []];
    const i = btns.indexOf(document.activeElement);
    const n = btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length];
    n?.focus();
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      className: "hb-menu",
      role: "menu",
      onKeyDown: move,
      onContextMenu: (e) => e.preventDefault(),
      onPointerDown: (e) => e.stopPropagation(),
      style: pos ? { left: pos.x, top: pos.y } : { left: at.x, top: at.y, visibility: "hidden" },
      children: entries.map((m, i) => {
        if ("sep" in m) return /* @__PURE__ */ jsx("div", { className: "sep", role: "separator" }, i);
        if ("head" in m) return /* @__PURE__ */ jsxs("div", { className: "head", children: [
          m.hermes && /* @__PURE__ */ jsx(Cad, {}),
          m.head
        ] }, i);
        return /* @__PURE__ */ jsxs(
          "button",
          {
            role: "menuitem",
            className: `${m.danger ? "danger" : ""}${m.hermes ? " hm" : ""}`.trim() || void 0,
            onClick: () => {
              onClose();
              m.run();
            },
            children: [
              /* @__PURE__ */ jsx("span", { className: "ico", children: m.icon && /* @__PURE__ */ jsx(Icon, { name: m.icon }) }),
              /* @__PURE__ */ jsx("span", { className: "lb", children: m.label }),
              m.kbd && /* @__PURE__ */ jsx("kbd", { children: m.kbd })
            ]
          },
          m.id
        );
      })
    }
  );
}
const DELAY_MS = 300;
const WARM_MS = 300;
let tipEl = null;
let showTimer = 0;
let warmUntil = 0;
let current = null;
function node() {
  if (tipEl?.isConnected) return tipEl;
  tipEl = document.createElement("div");
  tipEl.className = "hb-tip";
  tipEl.setAttribute("role", "tooltip");
  document.body.appendChild(tipEl);
  return tipEl;
}
function show(target) {
  const label = target.dataset.tip;
  if (!label || !target.isConnected) return;
  const el = node();
  el.textContent = "";
  const span = document.createElement("span");
  span.textContent = label;
  el.appendChild(span);
  const kbd = target.dataset.kbd;
  if (kbd) {
    for (const k of kbd.split(" ")) {
      const k1 = document.createElement("kbd");
      k1.textContent = k;
      el.appendChild(k1);
    }
  }
  el.classList.remove("on");
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.display = "flex";
  const r = target.getBoundingClientRect();
  const size = { w: el.offsetWidth, h: el.offsetHeight };
  const p = placeTip(
    { x: r.left, y: r.top, w: r.width, h: r.height },
    size,
    { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }
  );
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  el.dataset.side = p.side;
  requestAnimationFrame(() => el.classList.add("on"));
}
function hide(warm) {
  window.clearTimeout(showTimer);
  if (tipEl && tipEl.classList.contains("on") && warm) warmUntil = Date.now() + WARM_MS;
  if (tipEl) {
    tipEl.classList.remove("on");
    tipEl.style.display = "none";
  }
  current = null;
}
function tipTarget(e) {
  const t2 = e.target;
  return t2?.closest?.("[data-tip]") ?? null;
}
function installTips(root) {
  const over = (e) => {
    if (e.pointerType === "touch") return;
    const t2 = tipTarget(e);
    if (t2 === current) return;
    if (!t2) {
      if (current) hide(true);
      return;
    }
    hide(true);
    current = t2;
    const wait2 = Date.now() < warmUntil ? 0 : DELAY_MS;
    showTimer = window.setTimeout(() => {
      if (current === t2) show(t2);
    }, wait2);
  };
  const leave = () => hide(true);
  const down = () => hide(false);
  const focus = (e) => {
    const t2 = tipTarget(e);
    if (!t2 || !t2.matches?.(":focus-visible")) return;
    current = t2;
    show(t2);
  };
  const blur = () => hide(false);
  root.addEventListener("pointerover", over);
  root.addEventListener("pointerleave", leave);
  root.addEventListener("pointerdown", down, true);
  root.addEventListener("wheel", down, { passive: true });
  root.addEventListener("focusin", focus);
  root.addEventListener("focusout", blur);
  window.addEventListener("keydown", down, true);
  return () => {
    root.removeEventListener("pointerover", over);
    root.removeEventListener("pointerleave", leave);
    root.removeEventListener("pointerdown", down, true);
    root.removeEventListener("wheel", down);
    root.removeEventListener("focusin", focus);
    root.removeEventListener("focusout", blur);
    window.removeEventListener("keydown", down, true);
    hide(false);
  };
}
const HERMES_ACTIVE_S = 30;
function useBoard(bid, onHermesEntries, onRemap, onReject) {
  const [confirmed, setConfirmed] = useState(null);
  const [pending2, setPending] = useState([]);
  const [error, setError] = useState(null);
  const [presence, setPresence] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [stacks, setStacks] = useState({ undo: [], redo: [] });
  const confirmedRef = useRef(null);
  const pendingRef = useRef([]);
  const inflight = useRef(false);
  const pulling = useRef(null);
  const hermesCb = useRef(onHermesEntries);
  hermesCb.current = onHermesEntries;
  const remapCb = useRef(onRemap);
  remapCb.current = onRemap;
  const rejectCb = useRef(onReject);
  rejectCb.current = onReject;
  const alive = useRef(true);
  const setDoc = (d) => {
    confirmedRef.current = d;
    setConfirmed(d);
  };
  const setQueue = (q) => {
    pendingRef.current = q;
    setPending(q);
  };
  const pull = useCallback(() => {
    if (pulling.current) return pulling.current;
    const run = (async () => {
      const cur = confirmedRef.current;
      try {
        const r = await boardsApi.since(bid, cur ? cur.seq : -1);
        if (!alive.current) return;
        setError(null);
        if (r.hermes) setPresence(r.hermes);
        let next = cur;
        if (r.doc) {
          next = r.doc;
        } else if (r.entries && cur) {
          next = applyEntries(cur, r.entries);
          const hermes = r.entries.filter((e) => e.by === "h");
          if (hermes.length) hermesCb.current?.(hermes, next);
        }
        if (next && next !== cur) {
          setDoc(next);
          const left = pendingRef.current.filter((p) => !(p.confirmedAt && p.confirmedAt <= next.seq));
          if (left.length !== pendingRef.current.length) setQueue(left);
        }
      } catch (e) {
        if (alive.current) setError(String(e?.message ?? e));
      }
    })();
    pulling.current = run.finally(() => {
      pulling.current = null;
    });
    return pulling.current;
  }, [bid]);
  const flush = useCallback(async () => {
    if (inflight.current) return;
    const batch = pendingRef.current.find((p) => !p.confirmedAt);
    if (!batch) return;
    inflight.current = true;
    try {
      const res = await boardsApi.ops(bid, batch.ops, batch.note);
      if (!alive.current) return;
      const ids = res.entry.ids ?? {};
      if (Object.keys(ids).length) remapCb.current?.(ids);
      const cur = confirmedRef.current;
      let q = pendingRef.current.map((p) => p === batch || p.confirmedAt ? p : { ...p, ops: remapIds(p.ops, ids) });
      if (res.entry.noop) {
        q = q.filter((p) => p !== batch);
      } else if (cur && res.entry.s === cur.seq + 1) {
        setDoc(applyEntries(cur, [res.entry]));
        q = q.filter((p) => p !== batch);
      } else {
        q = q.map((p) => p === batch ? { ...p, confirmedAt: res.entry.s } : p);
        void pull();
      }
      setQueue(q);
      setSavedAt(Date.now());
      if (batch.undoable && !res.entry.noop) setStacks((s) => ({ undo: [...s.undo.slice(-99), res.entry.s], redo: [] }));
    } catch (e) {
      if (!alive.current) return;
      const msg = String(e?.message ?? e);
      setError(msg);
      rejectCb.current?.(msg);
      setQueue(pendingRef.current.filter((p) => p !== batch));
      void pull();
    } finally {
      inflight.current = false;
      if (alive.current && pendingRef.current.some((p) => !p.confirmedAt)) void flush();
    }
  }, [bid, pull]);
  const commit = useCallback((ops, opts) => {
    if (!ops.length) return;
    setQueue([...pendingRef.current, { ops, note: opts?.note, undoable: opts?.undoable !== false }]);
    void flush();
  }, [flush]);
  const runUndo = useCallback(async (s, push) => {
    try {
      const res = await boardsApi.undo(bid, s);
      if (push && !res.entry.noop) {
        setStacks((st) => push === "redo" ? { undo: st.undo, redo: [...st.redo, res.entry.s] } : { undo: [...st.undo, res.entry.s], redo: st.redo });
      }
      await pull();
    } catch (e) {
      setError(String(e?.message ?? e));
    }
  }, [bid, pull]);
  const stacksRef = useRef(stacks);
  stacksRef.current = stacks;
  const undo = useCallback(() => {
    const st = stacksRef.current;
    const s = st.undo[st.undo.length - 1];
    if (s == null) return;
    setStacks({ undo: st.undo.slice(0, -1), redo: st.redo });
    void runUndo(s, "redo");
  }, [runUndo]);
  const redo = useCallback(() => {
    const st = stacksRef.current;
    const s = st.redo[st.redo.length - 1];
    if (s == null) return;
    setStacks({ undo: st.undo, redo: st.redo.slice(0, -1) });
    void runUndo(s, "undo");
  }, [runUndo]);
  const undoEntry = useCallback((s) => {
    void runUndo(s, "redo");
  }, [runUndo]);
  useEffect(() => {
    alive.current = true;
    setDoc(null);
    setQueue([]);
    setStacks({ undo: [], redo: [] });
    let timer = null;
    let first = true;
    const tick = async () => {
      if (first || !document.hidden) await pull();
      first = false;
      if (!alive.current) return;
      const p = presenceRef.current;
      const active = p && Date.now() / 1e3 - p.at < HERMES_ACTIVE_S;
      timer = setTimeout(tick, active ? 1500 : 3e3);
    };
    void tick();
    const onVis = () => {
      if (!document.hidden) void pull();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bid, pull]);
  const presenceRef = useRef(null);
  presenceRef.current = presence;
  const doc = useMemo(() => {
    if (!confirmed) return null;
    const ops = pending2.flatMap((p) => p.ops);
    return ops.length ? applyOps(confirmed, ops) : confirmed;
  }, [confirmed, pending2]);
  return {
    doc,
    error,
    presence,
    savedAt,
    commit,
    undo,
    redo,
    undoEntry,
    canUndo: stacks.undo.length > 0,
    canRedo: stacks.redo.length > 0,
    refresh: () => {
      void pull();
    }
  };
}
const GRID = 24;
const TIDY_GAP = 24;
const INSERT_GAP = 48;
const round = (n) => Math.round(n) + 0;
const snapTo = (n, g) => Math.round(n / g) * g;
function tidyPlan(blocks, opts = {}) {
  if (!blocks.length) return [];
  const gap = opts.gap ?? TIDY_GAP, grid = opts.grid ?? GRID;
  const x0 = Math.min(...blocks.map((b) => b.rect.x)), y0 = Math.min(...blocks.map((b) => b.rect.y));
  const x1 = Math.max(...blocks.map((b) => b.rect.x + b.rect.w));
  const maxW = opts.maxW ?? Math.min(2400, Math.max(640, x1 - x0));
  const sorted = blocks.slice().sort((p, q) => p.rect.y - q.rect.y || p.rect.x - q.rect.x || (p.ids[0] < q.ids[0] ? -1 : 1));
  const rows = [];
  for (const b of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const overlap = Math.min(row.bottom, b.rect.y + b.rect.h) - Math.max(row.top, b.rect.y);
      if (overlap >= 0.4 * Math.min(b.rect.h, row.bottom - row.top)) {
        row.items.push(b);
        row.top = Math.min(row.top, b.rect.y);
        row.bottom = Math.max(row.bottom, b.rect.y + b.rect.h);
        continue;
      }
    }
    rows.push({ top: b.rect.y, bottom: b.rect.y + b.rect.h, items: [b] });
  }
  const lines2 = [];
  for (const row of rows) {
    const items = row.items.slice().sort((p, q) => p.rect.x - q.rect.x || (p.ids[0] < q.ids[0] ? -1 : 1));
    let cur = [], w = 0;
    for (const b of items) {
      if (cur.length && w + gap + b.rect.w > maxW) {
        lines2.push(cur);
        cur = [];
        w = 0;
      }
      w += (cur.length ? gap : 0) + b.rect.w;
      cur.push(b);
    }
    if (cur.length) lines2.push(cur);
  }
  const out = [];
  let y = snapTo(y0, grid);
  const left = snapTo(x0, grid);
  for (const line2 of lines2) {
    let x = left;
    for (const b of line2) {
      out.push({ ids: b.ids, x: round(x), y: round(y) });
      x += b.rect.w + gap;
    }
    y += Math.max(...line2.map((b) => b.rect.h)) + gap;
  }
  const fixed = opts.fixed ?? [];
  if (fixed.length) {
    const size = new Map(blocks.map((b) => [b.ids[0], b.rect]));
    for (let pass = 0; pass < 20; pass++) {
      let bottom = -Infinity;
      for (const o of out) {
        const r = size.get(o.ids[0]);
        for (const f of fixed) {
          if (o.x < f.x + f.w && o.x + r.w > f.x && o.y < f.y + f.h && o.y + r.h > f.y) bottom = Math.max(bottom, f.y + f.h);
        }
      }
      if (bottom === -Infinity) break;
      const top = Math.min(...out.map((o) => o.y));
      const dy = snapTo(bottom + gap - top, grid);
      for (const o of out) o.y = round(o.y + Math.max(dy, grid));
    }
  }
  return out;
}
const xs = (r) => [r.x, r.x + r.w / 2, r.x + r.w];
const ys = (r) => [r.y, r.y + r.h / 2, r.y + r.h];
function bestAlign(mov, others, thr) {
  let best = null;
  for (const o of others) for (const oc of o) for (const mc of mov) {
    const d = oc - mc;
    if (Math.abs(d) <= thr && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best;
}
function snapMove(mov, others, o) {
  const grid = o.grid ?? GRID;
  let dx = bestAlign(xs(mov), others.map(xs), o.thr);
  let dy = bestAlign(ys(mov), others.map(ys), o.thr);
  if (dx === null) dx = o.toGrid === false ? 0 : snapTo(mov.x, grid) - mov.x;
  if (dy === null) dy = o.toGrid === false ? 0 : snapTo(mov.y, grid) - mov.y;
  const m = { x: mov.x + dx, y: mov.y + dy, w: mov.w, h: mov.h };
  const guides = [];
  const eq = (a, b) => Math.abs(a - b) < 0.5;
  for (const r of others) {
    const vx = xs(r).find((c) => xs(m).some((mc) => eq(c, mc)));
    if (vx !== void 0) guides.push({ axis: "x", pos: vx, from: Math.min(m.y, r.y), to: Math.max(m.y + m.h, r.y + r.h) });
    const vy = ys(r).find((c) => ys(m).some((mc) => eq(c, mc)));
    if (vy !== void 0) guides.push({ axis: "y", pos: vy, from: Math.min(m.x, r.x), to: Math.max(m.x + m.w, r.x + r.w) });
  }
  return { dx, dy, guides };
}
function insertPlan(a, b, size, o = {}) {
  const gap = o.gap ?? INSERT_GAP;
  const hgap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const vgap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const horizontal = hgap > 0 && hgap >= vgap;
  let shift = { dx: 0, dy: 0 };
  let x, y;
  if (horizontal) {
    const fwd = b.x >= a.x + a.w;
    const space = fwd ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
    const more = o.shiftB === false ? 0 : Math.max(0, size.w + 2 * gap - space);
    shift = { dx: round((fwd ? 1 : -1) * more), dy: 0 };
    const edgeA = fwd ? a.x + a.w : a.x;
    const edgeB = fwd ? b.x + shift.dx : b.x + b.w + shift.dx;
    x = (edgeA + edgeB) / 2 - size.w / 2;
    y = (a.y + a.h / 2 + b.y + b.h / 2) / 2 - size.h / 2;
  } else {
    const fwd = b.y + b.h / 2 >= a.y + a.h / 2;
    const space = fwd ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
    const more = o.shiftB === false ? 0 : Math.max(0, size.h + 2 * gap - space);
    shift = { dx: 0, dy: round((fwd ? 1 : -1) * more) };
    const edgeA = fwd ? a.y + a.h : a.y;
    const edgeB = fwd ? b.y + shift.dy : b.y + b.h + shift.dy;
    y = (edgeA + edgeB) / 2 - size.h / 2;
    x = (a.x + a.w / 2 + b.x + b.w / 2) / 2 - size.w / 2;
  }
  return { x: round(x), y: round(y), shift };
}
function downstream(edges, start, stop) {
  const next = /* @__PURE__ */ new Map();
  for (const [a, b] of edges) next.set(a, [...next.get(a) ?? [], b]);
  const seen = /* @__PURE__ */ new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of next.get(cur) ?? []) {
      if (n === stop) return [start];
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return [...seen].sort();
}
function pickerEntries(t2) {
  return {
    main: [
      { id: "rect", icon: "shapeRect", label: t2("board.shape.rect"), item: { k: "shape", sh: "rect" } },
      { id: "diamond", icon: "shapeDiamond", label: t2("board.shape.diamond"), item: { k: "shape", sh: "diamond" } },
      { id: "pill", icon: "shapePill", label: t2("board.shape.pill"), item: { k: "shape", sh: "pill" } },
      { id: "circle", icon: "shapeCircle", label: t2("board.shape.circle"), item: { k: "shape", sh: "circle" } },
      { id: "text", icon: "text", label: t2("board.shape.text"), item: { k: "text", size: "p" } },
      { id: "note", icon: "note", label: t2("board.tool.note"), item: { k: "card", w: 256 } },
      { id: "todo", icon: "todo", label: t2("board.tool.todo"), item: { k: "todo", title: t2("board.todo.title"), items: [] } }
    ],
    more: [
      { id: "col", icon: "col", label: t2("board.tool.col"), item: { k: "col", title: t2("board.col.title") } },
      { id: "link", icon: "link", label: t2("board.tool.link"), ask: "link" },
      { id: "image", icon: "image", label: t2("board.tool.image"), ask: "image" },
      { id: "board", icon: "board", label: t2("board.tool.board"), ask: "board" },
      { id: "embed", icon: "embed", label: t2("board.tool.embed"), ask: "embed" }
    ]
  };
}
function EdgePicker({ at, bounds, t: t2, onPick, onClose }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  const [pos, setPos] = useState({ x: at.x, y: at.y });
  const { main, more: rest } = pickerEntries(t2);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    setPos({
      x: Math.max(8, Math.min(bounds.w - w - 8, at.x - w / 2)),
      y: Math.max(52, Math.min(bounds.h - h - 48, at.y + 18))
    });
  }, [at.x, at.y, bounds.w, bounds.h, more]);
  useEffect(() => {
    const down = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [onClose]);
  const btn = (s) => /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": s.label, "aria-label": s.label, onClick: () => onPick(s), children: /* @__PURE__ */ jsx(Icon, { name: s.icon, size: 15 }) }, s.id);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref,
      className: "hb-epick",
      role: "toolbar",
      "aria-label": t2("board.insert.title"),
      style: { left: pos.x, top: pos.y },
      onPointerDown: (e) => e.stopPropagation(),
      onContextMenu: (e) => e.preventDefault(),
      children: [
        /* @__PURE__ */ jsx("span", { className: "kind", children: t2("board.insert.title") }),
        /* @__PURE__ */ jsx("i", { className: "sep" }),
        main.map(btn),
        /* @__PURE__ */ jsx("i", { className: "sep" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `ib${more ? " on" : ""}`,
            "data-tip": t2("board.insert.more"),
            "aria-label": t2("board.insert.more"),
            "aria-expanded": more,
            onClick: () => setMore((v) => !v),
            children: /* @__PURE__ */ jsx(Icon, { name: "more", size: 15 })
          }
        ),
        more && /* @__PURE__ */ jsx("div", { className: "row2", children: rest.map(btn) })
      ]
    }
  );
}
const THUMB_W = 480, THUMB_H = 320, SHOW_W = 196;
function Thumb({ row, base }) {
  const [doc, setDoc] = useState(null);
  const box2 = useRef(null);
  useEffect(() => {
    let live = true;
    boardsApi.component(row.name).then((d) => live && setDoc(d), () => live && setDoc("fail"));
    return () => {
      live = false;
    };
  }, [row.name, row.current]);
  const html = useMemo(() => {
    if (!doc || doc === "fail") return null;
    const init = {
      component: { name: row.name, version: doc.version },
      assets: {},
      actions: [],
      data: doc.sample && typeof doc.sample === "object" ? doc.sample : {},
      clock: { t: 0, playing: false, rate: 1, duration: 0, group: null, manual: false, master: false },
      preview: true
    };
    return componentDocument(doc.html, true, base, init);
  }, [doc, base, row.name]);
  useEmbedBridge(box2, html != null, true, row.current);
  return /* @__PURE__ */ jsxs("div", { className: "gal-thumb", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("div", { className: "gal-scale", ref: box2, style: { width: THUMB_W, height: THUMB_H, transform: `scale(${SHOW_W / THUMB_W})` }, children: html != null && /* @__PURE__ */ jsx("iframe", { className: "frame themed", sandbox: "allow-scripts", srcDoc: html, title: row.title, tabIndex: -1, referrerPolicy: "no-referrer" }) }),
    doc === "fail" && /* @__PURE__ */ jsx("span", { className: "gal-nofile", children: /* @__PURE__ */ jsx(Icon, { name: "alert", size: 16 }) })
  ] });
}
function CompGallery({ t: t2, onPick, onClose }) {
  const [rows, setRows] = useState(null);
  const [down, setDown] = useState(false);
  const [base, setBase] = useState(null);
  const root = useRef(null);
  useEffect(() => {
    let live = true;
    boardsApi.components().then((r) => live && setRows(r), () => live && (setRows([]), setDown(true)));
    return () => {
      live = false;
    };
  }, []);
  useLayoutEffect(() => {
    if (!base && root.current) setBase(readTheme(root.current));
  }, [base, rows]);
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  return /* @__PURE__ */ jsxs("div", { className: "hb-gallery", ref: root, role: "dialog", "aria-label": t2("board.comp.gallery"), "data-nodrag": "", children: [
    /* @__PURE__ */ jsxs("div", { className: "gal-hd", children: [
      /* @__PURE__ */ jsx(Icon, { name: "components", size: 13 }),
      /* @__PURE__ */ jsx("span", { children: t2("board.comp.gallery") }),
      /* @__PURE__ */ jsx("button", { className: "kbtn", "aria-label": t2("board.comp.close"), onClick: onClose, children: /* @__PURE__ */ jsx(Icon, { name: "close", size: 13 }) })
    ] }),
    rows === null && /* @__PURE__ */ jsx("div", { className: "gal-empty", children: t2("common.loading") }),
    rows && rows.length === 0 && /* @__PURE__ */ jsxs("div", { className: "gal-empty", children: [
      /* @__PURE__ */ jsx("b", { children: down ? t2("board.comp.downTitle") : t2("board.comp.emptyTitle") }),
      /* @__PURE__ */ jsx("span", { children: down ? t2("board.comp.downBody") : t2("board.comp.emptyBody") })
    ] }),
    rows && rows.length > 0 && /* @__PURE__ */ jsx("div", { className: "gal-grid", children: rows.slice(0, 24).map((r) => /* @__PURE__ */ jsxs("button", { className: "gal-tile", onClick: () => onPick(r.name, r.title === r.name ? "" : r.title), children: [
      base ? /* @__PURE__ */ jsx(Thumb, { row: r, base }) : /* @__PURE__ */ jsx("div", { className: "gal-thumb" }),
      /* @__PURE__ */ jsx("b", { children: r.title }),
      /* @__PURE__ */ jsxs("small", { children: [
        r.name,
        " · ",
        r.current,
        r.desc ? ` · ${r.desc}` : ""
      ] })
    ] }, r.name)) })
  ] });
}
function Row({ clock: clock2, t: t2 }) {
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  useEffect(() => {
    let raf = 0;
    const off = clock2.subscribe(() => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        bump();
      });
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [clock2]);
  const s = clock2.state;
  const next = RATES[(Math.max(0, RATES.findIndex((r) => r === s.rate)) + 1) % RATES.length];
  return /* @__PURE__ */ jsxs("div", { className: "row", role: "group", "aria-label": t2("board.sync.group", { group: clock2.name }), children: [
    /* @__PURE__ */ jsxs("span", { className: "grp", "data-tip": t2(s.master ? "board.sync.master" : "board.sync.free"), children: [
      /* @__PURE__ */ jsx(Icon, { name: "sync", size: 12 }),
      clock2.name
    ] }),
    /* @__PURE__ */ jsx("button", { className: "tool", "data-nodrag": "", "aria-label": t2("board.sync.rewind"), "data-tip": t2("board.sync.rewind"), onClick: () => void clock2.seek(0), children: /* @__PURE__ */ jsx(Icon, { name: "skipBack", size: 13 }) }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "tool on",
        "data-nodrag": "",
        "aria-label": t2(s.playing ? "board.sync.pause" : "board.sync.play"),
        "data-tip": t2(s.playing ? "board.sync.pause" : "board.sync.play"),
        "aria-pressed": s.playing,
        onClick: () => clock2.toggle(),
        children: /* @__PURE__ */ jsx(Icon, { name: s.playing ? "pauseIcon" : "playIcon", size: 13 })
      }
    ),
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "scrub",
        "data-nodrag": "",
        type: "range",
        min: 0,
        max: s.duration > 0 ? s.duration : Math.max(10, s.t * 1.25),
        step: 0.01,
        value: Math.min(s.t, s.duration > 0 ? s.duration : Infinity),
        "aria-label": t2("board.sync.seek"),
        onChange: (e) => void clock2.seek(Number(e.currentTarget.value))
      }
    ),
    /* @__PURE__ */ jsxs("span", { className: "time", children: [
      formatClock(s.t),
      s.duration > 0 ? ` / ${formatClock(s.duration)}` : ""
    ] }),
    /* @__PURE__ */ jsxs("button", { className: "rate", "data-nodrag": "", "aria-label": t2("board.sync.rate"), "data-tip": t2("board.sync.rate"), onClick: () => clock2.setRate(next), children: [
      s.rate,
      "×"
    ] }),
    s.manual && /* @__PURE__ */ jsx("span", { className: "manual", "data-tip": t2("board.sync.manual"), children: "M" })
  ] });
}
function SyncTransport({ hub, groups, t: t2 }) {
  return /* @__PURE__ */ jsx("div", { className: "hb-sync", "data-nodrag": "", children: groups.map((g) => /* @__PURE__ */ jsx(Row, { clock: hub.clock(g), t: t2 }, g)) });
}
const TOOLS = [
  [{ tool: "select", key: "V", label: "board.tool.select", icon: "select" }, { tool: "pan", key: "H", label: "board.tool.pan", icon: "pan" }],
  [
    { tool: "note", key: "N", label: "board.tool.note", icon: "note" },
    { tool: "todo", key: "T", label: "board.tool.todo", icon: "todo" },
    { tool: "link", key: "L", label: "board.tool.link", icon: "link" },
    { tool: "image", key: "I", label: "board.tool.image", icon: "image" },
    { tool: "col", key: "C", label: "board.tool.col", icon: "col" },
    { tool: "board", key: "B", label: "board.tool.board", icon: "board" },
    { tool: "embed", key: "E", label: "board.tool.embed", icon: "embed" }
  ],
  [{ tool: "arrow", key: "A", label: "board.tool.arrow", icon: "arrow" }, { tool: "draw", key: "D", label: "board.tool.draw", icon: "draw" }]
];
const TOOL_HINT = {
  pan: "board.hint.pan",
  note: "board.hint.place",
  todo: "board.hint.place",
  col: "board.hint.place",
  board: "board.hint.place",
  arrow: "board.hint.arrow",
  draw: "board.hint.draw"
};
const VERB_ICON = {
  "board.verb.diagram": "diagram",
  "board.verb.sortDate": "sortDate",
  "board.verb.split": "split",
  "board.verb.expand": "expand",
  "board.verb.flow": "flow",
  "board.verb.group": "group",
  "board.verb.summarize": "summarize",
  "board.verb.improve": "improve"
};
const CHAT_OPEN_KEY = "hb.chat.open";
const CHAT_W_KEY = "hb.chat.w";
const readLocal = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLocal = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
  }
};
const KEY_TOOL = Object.fromEntries(TOOLS.flat().map((x) => [x.key.toLowerCase(), x.tool]));
const PLACE = ["note", "todo", "col", "link", "board", "embed", "image"];
const GROW_MIN = 6, PUSH_WAIT = 320;
const SNAP_KEY = "hb.snap";
const SNAP_PX = 6;
const TIDY_MS = 260;
const ease = (t2) => 1 - Math.pow(1 - t2, 3);
const INTO_COLUMN = /* @__PURE__ */ new Set(["card", "todo", "link", "image", "video", "board"]);
const INK_KEY = "hb.ink";
const ERASER_R = 9;
const INK_HINT = {
  pen: "board.hint.ink.pen",
  hl: "board.hint.ink.pen",
  eraser: "board.hint.ink.eraser",
  lasso: "board.hint.ink.lasso",
  line: "board.hint.ink.shape",
  arrow: "board.hint.ink.shape",
  rect: "board.hint.ink.shape",
  ellipse: "board.hint.ink.shape"
};
const sameSet = (a, b) => a.size === b.length && b.every((x) => a.has(x));
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function isTyping(target) {
  const el = target;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
function BoardView({ bid, onOpenBoard, onHome }) {
  const t2 = useT();
  const rootRef = useRef(null);
  const vpRef = useRef(null);
  const worldRef = useRef(null);
  const gridRef = useRef(null);
  const pctRef = useRef(null);
  const mapRef = useRef(null);
  const chatInputRef = useRef(null);
  const ctxEl = useRef(null);
  const selRef = useRef(null);
  const fileRef = useRef(null);
  const cursorRef = useRef(null);
  const els = useRef(/* @__PURE__ */ new Map());
  const view = useRef({ x: 0, y: 0, z: 0.8 });
  const drag = useRef(null);
  const space = useRef(false);
  const lastPoint = useRef(null);
  const fitted = useRef(false);
  const accentRef = useRef("");
  const cam = useRef(null);
  const mapViewRef = useRef(null);
  const mapHermesRef = useRef(null);
  const mapGeo = useRef(null);
  const chromeRaf = useRef(0);
  const gestureT = useRef(0);
  const gridKey = useRef("");
  const saveT = useRef(0);
  const autoFit = useRef(false);
  const autoFitUntil = useRef(0);
  const handoffRef = useRef(null);
  const arrival = useRef(null);
  const [mapOff, setMapOff] = useState(() => readLocal("hb.map.off") === "1" || demoNomap());
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState(/* @__PURE__ */ new Set());
  const [editing, setEditingRaw] = useState(null);
  const [editHint, setEditHint] = useState(null);
  const [editLabel, setEditLabel] = useState(null);
  const [edgePick, setEdgePick] = useState(null);
  const [snapOn, setSnapOn] = useState(() => readLocal(SNAP_KEY) !== "0");
  const snapRef = useRef(snapOn);
  snapRef.current = snapOn;
  const downAt = useRef(null);
  const lastTap = useRef(null);
  const wiresRef = useRef(null);
  const guidesRef = useRef(null);
  const liveRects = useRef(/* @__PURE__ */ new Map());
  const flip = useRef(null);
  const flipRaf = useRef(0);
  const pendingEdge = useRef(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [playing, setPlaying] = useState(null);
  const [delta, setDelta] = useState(null);
  const [resize, setResize] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [ink2, setInkState] = useState(() => parseInk(readLocal(INK_KEY)));
  const inkRef = useRef(ink2);
  inkRef.current = ink2;
  const setInk = useCallback((next) => {
    setInkState(next);
    writeLocal(INK_KEY, JSON.stringify(next));
  }, []);
  const [erasing, setErasing] = useState(/* @__PURE__ */ new Set());
  const erasingRef = useRef(erasing);
  erasingRef.current = erasing;
  const stroke = useRef(null);
  const eraser = useRef(null);
  const liveSvgRef = useRef(null);
  const livePathRef = useRef(null);
  const liveHeadRef = useRef(null);
  const ringRef = useRef(null);
  const liveRaf = useRef(0);
  const [draft, setDraft] = useState(null);
  const [kidDrag, setKidDrag] = useState(null);
  const [hidden, setHidden] = useState(/* @__PURE__ */ new Set());
  const [fresh, setFresh] = useState(/* @__PURE__ */ new Set());
  const [layoutV, setLayoutV] = useState(0);
  const [log, setLog] = useState([]);
  const [logOn, setLogOn] = useState(false);
  const [ask, setAsk] = useState(null);
  const [askValue, setAskValue] = useState("");
  const [toast, setToast] = useState(null);
  const flashRef = useRef(() => {
  });
  const [chatOpen, setChatOpen] = useState(() => readLocal(CHAT_OPEN_KEY) === "1");
  const [chatW, setChatW] = useState(() => Math.min(CHAT_MAX_W, Math.max(CHAT_MIN_W, Number(readLocal(CHAT_W_KEY)) || 380)));
  const [chatSentAt, setChatSentAt] = useState(0);
  const [rootW, setRootW] = useState(1400);
  const [menu, setMenu] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [narrow, setNarrow] = useState("");
  const [cursorAct, setCursorAct] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [, setNow] = useState(0);
  const [liveActions, setLiveActions] = useState(null);
  const [liveActionsDown, setLiveActionsDown] = useState(false);
  const [confirmReq, setConfirmReq] = useState(null);
  const Frame = hostSandboxedFrame();
  const setEditing = useCallback((id) => {
    setEditingRaw(id);
    if (!id) setEditHint(null);
  }, []);
  const startEdit = useCallback((id, hint2) => {
    setEditHint(hint2 ? { id, ...hint2 } : null);
    setEditingRaw(id);
    setSelected(/* @__PURE__ */ new Set([id]));
  }, []);
  const flash = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => cur === msg ? null : cur), 3200);
  }, []);
  flashRef.current = flash;
  const loadActions = useCallback(() => {
    boardsApi.liveActions().then((r) => {
      setLiveActions(Object.fromEntries(r.actions.map((a) => [a.id, a])));
      setLiveActionsDown(false);
    }).catch(() => {
      setLiveActions((cur) => cur ?? {});
      setLiveActionsDown(true);
    });
  }, []);
  useEffect(() => {
    loadActions();
    const h = window.setInterval(() => {
      if (!document.hidden) loadActions();
    }, 6e4);
    return () => window.clearInterval(h);
  }, [loadActions]);
  const runLiveAction = useCallback(async (iid, ref, index) => {
    const info = liveActionsRef.current?.[ref.action];
    if (!info || !info.enabled) throw new Error(t2("board.live.notRegistered", { id: ref.action }));
    let confirm = false;
    if (info.destructive) {
      confirm = await new Promise((resolve2) => setConfirmReq({ iid, ref, index, info, resolve: resolve2 }));
      setConfirmReq(null);
      if (!confirm) return null;
    }
    try {
      return await boardsApi.liveAction(bid, iid, ref.action, index, confirm);
    } catch (e) {
      loadActions();
      throw e;
    }
  }, [bid, loadActions, t2]);
  const liveActionsRef = useRef(liveActions);
  liveActionsRef.current = liveActions;
  const syncHub = useMemo(() => new SyncHub(), [bid]);
  useEffect(() => () => syncHub.destroy(), [syncHub]);
  const runCompAction = useCallback(async (iid, action, args) => {
    const info = liveActionsRef.current?.[action];
    if (!info || !info.enabled) throw new Error(t2("board.live.notRegistered", { id: action }));
    let confirm = false;
    if (info.destructive) {
      confirm = await new Promise((resolve2) => setConfirmReq({ iid, ref: { action }, index: -1, info, resolve: resolve2 }));
      setConfirmReq(null);
      if (!confirm) return null;
    }
    return boardsApi.compAction(bid, iid, action, args, confirm);
  }, [bid, t2]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const onHermes = useCallback((entries, doc2) => {
    const steps = [];
    const hide2 = /* @__PURE__ */ new Set();
    let changes = 0;
    for (const e of entries) {
      for (const op of e.ops) {
        if (op.op === "board" || op.op === "tour") continue;
        changes++;
        const id = op.op === "put" || op.op === "set" || op.op === "del" ? op.id : null;
        if (!id) continue;
        const it = doc2.items[id];
        if (op.op === "put") hide2.add(id);
        let act;
        if (op.op === "del") act = t2("board.cursor.removing");
        else if (it?.k === "line") {
          const name = (end) => {
            if (typeof end !== "string") return "·";
            const x = doc2.items[end];
            return x?.num || (x ? itemLabel(x).slice(0, 14) : "·");
          };
          act = t2("board.cursor.connecting", { a: name(it.a), b: name(it.b) });
        } else if (op.op === "put") {
          act = it?.k === "box" && it.num ? t2("board.cursor.placingStep", { n: it.num }) : t2("board.cursor.adding", { kind: t2(`board.kind.${it?.k ?? "card"}`) });
        } else if (op.op === "set" && ("x" in op.p || "y" in op.p)) {
          act = t2("board.cursor.moving", { what: it ? itemLabel(it).slice(0, 18) : "" });
        } else {
          act = t2("board.cursor.editing", { what: it ? itemLabel(it).slice(0, 18) : "" });
        }
        steps.push({
          id,
          act,
          locate: () => locateFor(id, doc2),
          onArrive: () => {
            setHidden((h) => {
              if (!h.has(id)) return h;
              const n = new Set(h);
              n.delete(id);
              return n;
            });
            setFresh((f) => new Set(f).add(id));
            window.setTimeout(() => setFresh((f) => {
              const n = new Set(f);
              n.delete(id);
              return n;
            }), 900);
          }
        });
      }
      setLog((l) => [...l.slice(-3), {
        key: `h${e.s}`,
        t: e.t,
        who: "hermes",
        s: e.s,
        msg: e.note || t2("board.log.changes", { n: e.ops.length })
      }]);
      setLogOn(true);
    }
    if (hide2.size) setHidden((h) => /* @__PURE__ */ new Set([...h, ...hide2]));
    cursorRef.current?.enqueue(steps, t2("board.cursor.done", { n: changes }));
  }, [t2]);
  const keyAlias = useRef(/* @__PURE__ */ new Map());
  const keyOf = useCallback((id) => keyAlias.current.get(id) ?? id, []);
  const onRemap = useCallback((ids) => {
    for (const [ref, id] of Object.entries(ids)) keyAlias.current.set(id, keyAlias.current.get(ref) ?? ref);
    const swap = (id) => ids[id] ?? id;
    setSelected((s) => Object.keys(ids).some((r) => s.has(r)) ? new Set([...s].map(swap)) : s);
    setEditingRaw((e) => e ? swap(e) : e);
    setEditHint((h) => h && ids[h.id] ? { ...h, id: ids[h.id] } : h);
    setEditLabel((l) => l ? swap(l) : l);
  }, []);
  const onReject = useCallback((msg) => flashRef.current(t2("board.toast.rejected", { error: msg })), [t2]);
  const sync = useBoard(bid, onHermes, onRemap, onReject);
  const doc = sync.doc;
  const docRef = useRef(doc);
  docRef.current = doc;
  const openChild = useCallback((child) => {
    const card = vpRef.current?.querySelector(`[data-mini="${child}"]`);
    prepareZoomIn(child, rootRef.current, card);
    onOpenBoard(child);
  }, [onOpenBoard]);
  const closeToParent = useCallback((parent) => {
    prepareZoomOut(parent, bid, rootRef.current, vpRef.current, view.current);
    onOpenBoard(parent);
  }, [bid, onOpenBoard]);
  const getRect = useCallback((id) => {
    const el = els.current.get(id);
    const world = worldRef.current;
    const z = view.current.z;
    if (el && world && el.isConnected) {
      const a = el.getBoundingClientRect(), w = world.getBoundingClientRect();
      if (a.width || a.height) return { x: (a.left - w.left) / z, y: (a.top - w.top) / z, w: a.width / z, h: a.height / z };
    }
    const it = docRef.current?.items[id];
    return it ? approxRect(it) : null;
  }, []);
  const getRectLive = useCallback((id) => liveRects.current.get(id) ?? getRect(id), [getRect]);
  function locateFor(id, fallback) {
    const known = fallback?.items[id];
    const r = getRect(id) ?? (known ? approxRect(known) : null);
    const it = docRef.current?.items[id] ?? known;
    if (it?.k === "line") {
      const ends = [it.a, it.b].map((e) => Array.isArray(e) ? { x: e[0], y: e[1], w: 0, h: 0 } : typeof e === "string" ? getRect(e) : null);
      if (ends[0] && ends[1]) {
        return { x: (ends[0].x + ends[0].w / 2 + ends[1].x + ends[1].w / 2) / 2, y: (ends[0].y + ends[0].h / 2 + ends[1].y + ends[1].h / 2) / 2 };
      }
      return null;
    }
    if (!r) return null;
    return { x: r.x + Math.min(r.w * 0.62, 168), y: r.y + Math.min(r.h * 0.62, 46) };
  }
  const toWorld = useCallback((cx2, cy2) => {
    const rect = vpRef.current.getBoundingClientRect();
    const v = view.current;
    return { x: (cx2 - rect.left - v.x) / v.z, y: (cy2 - rect.top - v.y) / v.z };
  }, []);
  const drawMap = useCallback(() => {
    const d = docRef.current, vp = vpRef.current, el = mapViewRef.current, canvas = mapRef.current;
    if (!d || !vp || !el || !canvas) return;
    const g = mapGeo.current;
    if (!g || g.W !== canvas.clientWidth || g.H !== canvas.clientHeight) {
      drawMapLayerRef.current();
      return;
    }
    const v = view.current;
    el.style.transform = `translate(${Math.round(g.ox + -v.x / v.z * g.s)}px, ${Math.round(g.oy + -v.y / v.z * g.s)}px)`;
    el.style.width = `${Math.round(vp.clientWidth / v.z * g.s)}px`;
    el.style.height = `${Math.round(vp.clientHeight / v.z * g.s)}px`;
    const hm = mapHermesRef.current, pos = cursorRef.current?.position();
    if (hm) {
      if (pos) {
        hm.style.display = "block";
        hm.style.transform = `translate(${g.ox + pos.x * g.s}px, ${g.oy + pos.y * g.s}px)`;
      } else hm.style.display = "none";
    }
  }, []);
  const drawMapLayer = useCallback(() => {
    const canvas = mapRef.current, d = docRef.current;
    if (!canvas || !d) return;
    if (!accentRef.current) accentRef.current = accentColor(rootRef.current);
    drawPreview(canvas, d, { accent: accentRef.current, cell: 4 });
    const W = canvas.clientWidth, H = canvas.clientHeight;
    mapGeo.current = { ...previewGeometry(d, W, H), W, H };
    drawMap();
  }, [drawMap]);
  const drawMapLayerRef = useRef(drawMapLayer);
  drawMapLayerRef.current = drawMapLayer;
  const placeCtx = useCallback(() => {
    const el = ctxEl.current, vp = vpRef.current, r = selRef.current;
    if (!el || !vp) return;
    const v = view.current;
    const p = r ? placeBar(
      { x: v.x + r.x * v.z, y: vp.offsetTop + v.y + r.y * v.z, w: r.w * v.z, h: r.h * v.z },
      { w: el.offsetWidth, h: el.offsetHeight },
      { x: 0, y: vp.offsetTop, w: vp.clientWidth, h: vp.clientHeight }
    ) : null;
    if (!p) {
      el.style.visibility = "hidden";
      return;
    }
    el.style.visibility = "visible";
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    el.dataset.below = p.below ? "1" : "0";
  }, []);
  const applyChrome = useCallback(() => {
    chromeRaf.current = 0;
    const v = view.current, grid = gridRef.current;
    if (!grid) return;
    const g = 24 * v.z, G = g * 5;
    const key = `${Math.round(v.z * 1e3)}`;
    if (gridKey.current !== key) {
      gridKey.current = key;
      if (!accentRef.current) accentRef.current = accentColor(rootRef.current);
      const cross = withAlpha(accentRef.current, 0.16), c = 4.5;
      const arm = (dir) => `linear-gradient(${dir}, ${cross} 0 ${c}px, transparent ${c}px calc(100% - ${c}px), ${cross} calc(100% - ${c}px) 100%)`;
      grid.style.backgroundImage = `${arm("90deg")}, ${arm("180deg")}, radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent) .9px, transparent 1.2px)`;
      grid.style.backgroundSize = `${G}px 1px, 1px ${G}px, ${g}px ${g}px`;
      grid.style.backgroundRepeat = "repeat-x, repeat-y, repeat";
      grid.style.setProperty("--gp", `${G}px`);
    }
    grid.style.transform = `translate(${(v.x % G + G) % G}px, ${(v.y % G + G) % G}px)`;
    if (pctRef.current) {
      const txt = `${Math.round(v.z * 100)}%`;
      if (pctRef.current.textContent !== txt) pctRef.current.textContent = txt;
    }
    drawMap();
    placeCtx();
  }, [drawMap, placeCtx]);
  const applyView = useCallback(() => {
    const v = view.current, world = worldRef.current;
    if (!world) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    world.style.setProperty("--iz", String(Math.round(1e3 / v.z) / 1e3));
    const vp = vpRef.current;
    if (vp) {
      vp.classList.add("gesturing");
      window.clearTimeout(gestureT.current);
      gestureT.current = window.setTimeout(() => vp.classList.remove("gesturing"), 180);
    }
    if (!chromeRaf.current) chromeRaf.current = requestAnimationFrame(applyChrome);
  }, [applyChrome]);
  useEffect(() => () => {
    cancelAnimationFrame(chromeRaf.current);
    window.clearTimeout(gestureT.current);
  }, []);
  const saveNow = useCallback(() => {
    window.clearTimeout(saveT.current);
    try {
      sessionStorage.setItem(`hb.view.${bid}`, JSON.stringify(view.current));
    } catch {
    }
  }, [bid]);
  const saveView = useCallback(() => {
    window.clearTimeout(saveT.current);
    saveT.current = window.setTimeout(saveNow, 220);
  }, [saveNow]);
  useEffect(() => () => {
    if (view.current) saveNow();
  }, [saveNow]);
  const applyViewRef = useRef(applyView);
  applyViewRef.current = applyView;
  const saveViewRef = useRef(saveView);
  saveViewRef.current = saveView;
  if (!cam.current) {
    cam.current = new Camera({
      get: () => view.current,
      set: (v) => {
        view.current = v;
        applyViewRef.current();
      },
      size: () => ({ w: vpRef.current?.clientWidth ?? 1, h: vpRef.current?.clientHeight ?? 1 }),
      reduced,
      onMoving: (m) => {
        if (!m) saveViewRef.current();
      }
    });
  }
  const stopCamera = useCallback(() => {
    autoFit.current = false;
    cam.current?.cancel();
  }, []);
  const zoomAt = useCallback((f, sx, sy) => {
    stopCamera();
    view.current = zoomView$1(view.current, f, sx, sy);
    applyView();
    saveView();
  }, [applyView, saveView, stopCamera]);
  const zoomAnim = useRef(null);
  const zoomSmooth = useCallback((f, sx, sy) => {
    stopCamera();
    if (reduced()) {
      zoomAt(f, sx, sy);
      return;
    }
    const a = zoomAnim.current;
    const base = a ? a.z : view.current.z;
    const target = Math.min(ZOOM_MAX$1, Math.max(ZOOM_MIN$1, base * f));
    if (a) {
      cancelAnimationFrame(a.raf);
    }
    const anim = { z: target, sx, sy, raf: 0 };
    zoomAnim.current = anim;
    const step = () => {
      const v = view.current;
      const next = v.z + (anim.z - v.z) * 0.38;
      const done = Math.abs(anim.z - next) < anim.z * 2e-3;
      view.current = zoomView$1(v, (done ? anim.z : next) / v.z, anim.sx, anim.sy);
      applyView();
      if (done) {
        zoomAnim.current = null;
        saveView();
        return;
      }
      anim.raf = requestAnimationFrame(step);
    };
    anim.raf = requestAnimationFrame(step);
  }, [applyView, saveView, stopCamera, zoomAt]);
  useEffect(() => () => {
    if (zoomAnim.current) cancelAnimationFrame(zoomAnim.current.raf);
  }, []);
  const contentBounds = useCallback(() => {
    const d = docRef.current;
    if (!d) return null;
    const rects = Object.entries(d.items).filter(([, it]) => !it.in && it.k !== "line").map(([id]) => getRect(id)).filter(Boolean);
    return boundsOf(rects);
  }, [getRect]);
  const fitTarget = useCallback(() => {
    const vp = vpRef.current, b = contentBounds();
    if (!vp) return null;
    return b ? fitView(b, { w: vp.clientWidth, h: vp.clientHeight }, 60, 1.1) : { x: vp.clientWidth / 2 - 200, y: vp.clientHeight / 2 - 120, z: 0.9 };
  }, [contentBounds]);
  const fit = useCallback((animate = true, duration) => {
    const target = fitTarget();
    if (!target) return;
    if (animate) {
      autoFit.current = false;
      void cam.current.flyTo(target, { duration, ease: "inOut" });
      return;
    }
    cam.current?.cancel();
    view.current = target;
    applyView();
    saveView();
  }, [applyView, fitTarget, saveView]);
  const zoomToSelection = useCallback(() => {
    const vp = vpRef.current;
    const rects = [...selectedRef.current].map((id) => getRect(id)).filter(Boolean);
    const b = boundsOf(rects);
    if (!vp || !b) {
      fit();
      return;
    }
    autoFit.current = false;
    void cam.current.flyTo(viewForRect(b, { w: vp.clientWidth, h: vp.clientHeight }, { pad: 90, maxZ: 1.5 }), { ease: "inOut" });
  }, [fit, getRect]);
  useLayoutEffect(() => {
    if (!doc || fitted.current) return;
    fitted.current = true;
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(`hb.view.${bid}`) || "null");
    } catch {
      saved = null;
    }
    if (saved && Number.isFinite(saved.z)) {
      view.current = saved;
      applyView();
    } else {
      fit(false);
      autoFit.current = true;
      autoFitUntil.current = performance.now() + 3500;
    }
    const h = takeHandoff(bid);
    const vp = vpRef.current, root = rootRef.current;
    if (!h || !vp || !root) {
      if (h) h.overlay.remove();
      return;
    }
    handoffRef.current = h;
    if (h.kind === "in") {
      autoFit.current = false;
      arrival.current = arriveZoomIn(h, { cam: cam.current, vp, root, target: view.current }, (start) => {
        view.current = start;
        applyView();
      });
    } else {
      arrival.current = arriveZoomOut(h, () => h.child ? vp.querySelector(`[data-mini="${h.child}"]`) : null, { w: window.innerWidth, h: window.innerHeight });
    }
  }, [doc, bid, applyView, fit]);
  useEffect(() => {
    fitted.current = false;
    setSelected(/* @__PURE__ */ new Set());
    setEditing(null);
    setPlaying(null);
  }, [bid]);
  useEffect(() => {
    applyView();
  }, [applyView, doc, layoutV]);
  useEffect(() => {
    const h = window.setTimeout(() => drawMapLayerRef.current(), 90);
    return () => window.clearTimeout(h);
  }, [doc]);
  useEffect(() => {
    if (!autoFit.current || performance.now() > autoFitUntil.current) return;
    const h = window.setTimeout(() => {
      if (autoFit.current && !cam.current?.moving) {
        fit(true, 280);
        autoFit.current = true;
      }
    }, 260);
    return () => window.clearTimeout(h);
  }, [layoutV, fit]);
  const seenSize = useRef(/* @__PURE__ */ new Map());
  const grown = useRef(/* @__PURE__ */ new Map());
  const pushT = useRef(0);
  const editingNow = useRef(null);
  editingNow.current = editing;
  const pushNow = useRef(() => void 0);
  const schedulePush = useRef(() => void 0);
  schedulePush.current = () => {
    window.clearTimeout(pushT.current);
    pushT.current = window.setTimeout(() => pushNow.current(), PUSH_WAIT);
  };
  pushNow.current = () => {
    const d = docRef.current;
    if (!d) return;
    if (drag.current || cam.current?.moving) {
      schedulePush.current();
      return;
    }
    const ids = [...grown.current.keys()].filter((id) => id !== editingNow.current);
    if (!ids.length) {
      if (grown.current.size) schedulePush.current();
      return;
    }
    const wired = wiredIds(d);
    const rects = contentRects();
    const moves = /* @__PURE__ */ new Map();
    for (const g of ids) {
      const before = grown.current.get(g);
      grown.current.delete(g);
      const it = d.items[g], r = rects.get(g);
      if (!it || !r) continue;
      const was = { x: r.x, y: r.y, w: before.w, h: before.h };
      const entries = [...rects].map(([id, rect]) => ({
        id,
        rect,
        anchored: id !== g && (wired.has(id) || !MOVABLE.has(d.items[id].k) || id.startsWith("$") || overlaps(was, rect))
      }));
      const plan = pushPlan(entries, g);
      for (const m of plan.moves) {
        const o = rects.get(m.id);
        rects.set(m.id, { ...o, x: m.x, y: m.y });
        moves.set(m.id, m);
      }
    }
    if (!moves.size) return;
    const ops = [];
    const from = /* @__PURE__ */ new Map();
    for (const [id, m] of moves) {
      const it = d.items[id], r = getRect(id);
      if (!it || !r) continue;
      ops.push({ op: "set", id, p: { x: Math.round((it.x ?? r.x) + m.x - r.x), y: Math.round((it.y ?? r.y) + m.y - r.y) } });
      from.set(id, r);
    }
    if (!ops.length) return;
    flipFrom(from, [...from.keys()]);
    commit(ops, t2("board.push"));
  };
  useEffect(() => () => window.clearTimeout(pushT.current), []);
  useEffect(() => {
    seenSize.current.clear();
    grown.current.clear();
  }, [bid]);
  useEffect(() => {
    if (!editing && grown.current.size) schedulePush.current();
  }, [editing]);
  useEffect(() => {
    const RO = globalThis.ResizeObserver;
    if (!RO || !worldRef.current) return;
    let raf = 0;
    const ro = new RO((entries) => {
      for (const en2 of entries) {
        const el = en2.target, id = el.dataset.iid;
        if (!id) continue;
        const w = el.offsetWidth, h = el.offsetHeight;
        if (!w && !h) continue;
        const prev = seenSize.current.get(id);
        seenSize.current.set(id, { w, h });
        if (prev && (h > prev.h + GROW_MIN || w > prev.w + GROW_MIN) && !grown.current.has(id)) grown.current.set(id, prev);
      }
      if (grown.current.size) schedulePush.current();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setLayoutV((v) => v + 1));
    });
    els.current.forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [doc]);
  useEffect(() => {
    const el = rootRef.current;
    const RO = globalThis.ResizeObserver;
    if (!el || !RO) return;
    const ro = new RO(() => {
      setNarrow(el.clientWidth < 760 ? "narrow tiny" : el.clientWidth < 1180 ? "narrow" : "");
      setRootW(el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const i = window.setInterval(() => setNow((n) => n + 1), 15e3);
    return () => window.clearInterval(i);
  }, []);
  useEffect(() => {
    if (!logOn) return;
    const i = window.setTimeout(() => setLogOn(false), 16e3);
    return () => window.clearTimeout(i);
  }, [logOn, log]);
  const commit = useCallback((ops, note) => sync.commit(ops, { note }), [sync]);
  const update = useCallback((id, p) => commit([{ op: "set", id, p }]), [commit]);
  const center = useCallback(() => {
    const vp = vpRef.current;
    const v = view.current;
    return { x: (vp.clientWidth / 2 - v.x) / v.z, y: (vp.clientHeight / 2 - v.y) / v.z };
  }, []);
  const reserved = useRef([]);
  const contentRects = useCallback((skip) => {
    const d = docRef.current;
    const out = /* @__PURE__ */ new Map();
    if (!d) return out;
    for (const [id, it] of Object.entries(d.items)) {
      if (it.in || it.k === "line" || it.k === "draw" || it.k === "frame" || skip?.has(id)) continue;
      const r = getRectLive(id);
      if (r) out.set(id, r);
    }
    return out;
  }, [getRectLive]);
  const frameAround = useCallback((p) => {
    const d = docRef.current;
    let best;
    for (const [id, it] of Object.entries(d?.items ?? {})) {
      if (it.k !== "frame") continue;
      const r = getRect(id);
      if (r && p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h && (!best || r.w * r.h < best.w * best.h)) best = r;
    }
    return best;
  }, [getRect]);
  const spotFor = useCallback((item, want) => {
    const now = performance.now();
    reserved.current = reserved.current.filter((x) => now - x.t < 4e3);
    const size = estimateSize(item);
    const obstacles = [...contentRects().values(), ...reserved.current.map((x) => x.rect)];
    const p = freePlace(want, size, obstacles, { within: frameAround(want) });
    reserved.current.push({ rect: { ...p, ...size }, t: now });
    return p;
  }, [contentRects, frameAround]);
  const wiredIds = useCallback((d) => {
    const topOf = (id) => d.items[id]?.in ?? id;
    const out = /* @__PURE__ */ new Set();
    for (const it of Object.values(d.items)) {
      if (it.k === "line") {
        for (const e of [it.a, it.b]) if (typeof e === "string" && d.items[e]) out.add(topOf(e));
      }
    }
    return out;
  }, []);
  const clearAround = useCallback((d, changed) => {
    const wired = wiredIds(d);
    const rects = contentRects();
    for (const [id, r] of changed) rects.set(id, r);
    const hit = new Set([...rects].filter(([id, r]) => !changed.has(id) && !wired.has(id) && MOVABLE.has(d.items[id]?.k ?? "") && !id.startsWith("$") && [...changed.values()].some((c) => overlaps(r, c))).map(([id]) => id));
    if (!hit.size) return [];
    return resolvePlan([...rects].map(([id, rect]) => ({ id, rect, anchored: !hit.has(id) })));
  }, [contentRects, wiredIds]);
  const insertRef = useRef(() => null);
  const add = useCallback((item, at, edit = false) => {
    if (pendingEdge.current) {
      const edge = pendingEdge.current;
      pendingEdge.current = null;
      const made = insertRef.current(edge, item);
      if (made) return made;
    }
    const ref = newRef();
    const p = at ?? lastPoint.current ?? center();
    const q = item.in ? null : MOVABLE.has(item.k) ? spotFor(item, p) : { x: Math.round(p.x), y: Math.round(p.y) };
    const placed = q ? { ...item, x: q.x, y: q.y } : item;
    commit([{ op: "add", ref, item: placed, exact: true }]);
    setSelected(/* @__PURE__ */ new Set([ref]));
    if (edit) setEditing(ref);
    return ref;
  }, [center, commit, spotFor]);
  const editHintAt = (target, x, y, it) => {
    const fieldEl = target.closest("[data-field]");
    if (!fieldEl) return void 0;
    const field = fieldEl.dataset.field;
    const dd = document;
    let node2 = null, off = 0;
    if (dd.caretPositionFromPoint) {
      const c = dd.caretPositionFromPoint(x, y);
      if (c) {
        node2 = c.offsetNode;
        off = c.offset;
      }
    } else if (dd.caretRangeFromPoint) {
      const r = dd.caretRangeFromPoint(x, y);
      if (r) {
        node2 = r.startContainer;
        off = r.startOffset;
      }
    }
    if (!node2 || !fieldEl.contains(node2)) return { field };
    const range = document.createRange();
    range.selectNodeContents(fieldEl);
    range.setEnd(node2, off);
    const source = field === "title" ? it.title : field === "text" ? it.text : field === "cap" ? it.cap : field.startsWith("row:") ? it.items?.[Number(field.slice(4))]?.t : "";
    return { field, caret: mapCaret(fieldEl.textContent ?? "", range.toString().length, source ?? "") };
  };
  const flipFrom = useCallback((from, ids) => {
    flip.current = { from, ids };
  }, []);
  useLayoutEffect(() => {
    const f = flip.current;
    if (!f) return;
    flip.current = null;
    cancelAnimationFrame(flipRaf.current);
    if (reduced()) return;
    const d = docRef.current;
    const moving = [];
    for (const id of f.ids) {
      const to = getRect(id), from = f.from.get(id);
      if (!to || !from || !els.current.get(id)) continue;
      const dx = from.x - to.x, dy = from.y - to.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.5) continue;
      const kids = [];
      for (const k of d?.items[id]?.k === "col" ? d.items[id].kids ?? [] : []) {
        const kr = getRect(k);
        if (kr) kids.push([k, kr, dx, dy]);
      }
      moving.push({ id, dx, dy, to, kids });
    }
    if (!moving.length) return;
    const affected = /* @__PURE__ */ new Set();
    for (const m of moving) {
      affected.add(m.id);
      m.kids.forEach((k) => affected.add(k[0]));
    }
    const t0 = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / TIDY_MS);
      const left = 1 - ease(k);
      for (const m of moving) {
        const el = els.current.get(m.id);
        if (el) el.style.transform = k >= 1 ? "" : `translate(${m.dx * left}px, ${m.dy * left}px)`;
        if (k >= 1) liveRects.current.delete(m.id);
        else liveRects.current.set(m.id, { x: m.to.x + m.dx * left, y: m.to.y + m.dy * left, w: m.to.w, h: m.to.h });
        for (const [kid, kr] of m.kids) {
          if (k >= 1) liveRects.current.delete(kid);
          else liveRects.current.set(kid, { x: kr.x + m.dx * left, y: kr.y + m.dy * left, w: kr.w, h: kr.h });
        }
      }
      wiresRef.current?.refresh(affected);
      if (k < 1) flipRaf.current = requestAnimationFrame(frame);
    };
    frame(t0);
    flipRaf.current = requestAnimationFrame(frame);
  }, [doc, getRect]);
  useEffect(() => () => cancelAnimationFrame(flipRaf.current), []);
  const tidy = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const sel = [...selected].filter((id) => d.items[id]);
    const explicit = sel.length > 1;
    const topOf = (id) => d.items[id]?.in ?? id;
    const pool = [];
    const wired = /* @__PURE__ */ new Set();
    const frames = [];
    if (explicit) pool.push(...expandGroups(d.items, sel));
    else {
      for (const [id, it] of Object.entries(d.items)) {
        if (it.k === "line") {
          for (const e of [it.a, it.b]) if (typeof e === "string" && d.items[e]) wired.add(topOf(e));
        } else if (it.k === "frame") {
          const r = getRect(id);
          if (r) frames.push(r);
        } else if (!it.in) pool.push(id);
      }
    }
    const groups = /* @__PURE__ */ new Map();
    const blocks = [];
    const rectOf = (ids) => boundsOf(ids.map((i) => getRect(i)).filter(Boolean));
    for (const id of pool) {
      const it = d.items[id];
      if (!it || it.in || it.k === "line" || it.k === "frame") continue;
      if (!explicit) {
        if (wired.has(id)) continue;
        const r = getRect(id);
        if (r && frames.some((f) => r.x + r.w / 2 >= f.x && r.x + r.w / 2 <= f.x + f.w && r.y + r.h / 2 >= f.y && r.y + r.h / 2 <= f.y + f.h)) continue;
      }
      if (it.k === "draw" && it.g) {
        groups.set(it.g, [...groups.get(it.g) ?? [], id]);
        continue;
      }
      if (it.k === "draw" && !explicit) continue;
      const rect = rectOf([id]);
      if (rect) blocks.push({ ids: [id], rect });
    }
    for (const ids of groups.values()) {
      const rect = rectOf(ids);
      if (rect) blocks.push({ ids: ids.sort(), rect });
    }
    const ops = [];
    const from = /* @__PURE__ */ new Map();
    const moved = [];
    const moving = new Set(blocks.flatMap((b) => b.ids));
    const fixed = [];
    for (const [id, it] of Object.entries(d.items)) {
      if (it.in || it.k === "line" || it.k === "draw" || moving.has(id)) continue;
      const r = getRect(id);
      if (r) fixed.push(r);
    }
    for (const p of tidyPlan(blocks, { fixed })) {
      const b = blocks.find((x) => x.ids[0] === p.ids[0]);
      const dx = p.x - b.rect.x, dy = p.y - b.rect.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      for (const id of p.ids) {
        const it = d.items[id];
        ops.push({ op: "set", id, p: { x: Math.round((it.x ?? 0) + dx), y: Math.round((it.y ?? 0) + dy) } });
        const r = getRect(id);
        if (r) {
          from.set(id, r);
          moved.push(id);
        }
      }
    }
    if (!ops.length) {
      flash(t2("board.tidy.none"));
      return;
    }
    flipFrom(from, moved);
    commit(ops);
  }, [commit, flash, flipFrom, getRect, selected, t2]);
  const resolveOverlaps = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const sel = selected.size > 1 ? new Set([...selected].map((id) => d.items[id]?.in ?? id)) : null;
    const wired = wiredIds(d);
    const frames = Object.entries(d.items).filter(([, it]) => it.k === "frame").map(([id]) => getRect(id)).filter(Boolean);
    const entries = [];
    for (const [id, rect] of contentRects()) {
      const k = d.items[id].k;
      const cx2 = rect.x + rect.w / 2, cy2 = rect.y + rect.h / 2;
      const inside = frames.filter((f) => cx2 >= f.x && cx2 <= f.x + f.w && cy2 >= f.y && cy2 <= f.y + f.h).sort((a, b) => a.w * a.h - b.w * b.h);
      entries.push({ id, rect, anchored: wired.has(id) || !MOVABLE.has(k) || id.startsWith("$") || sel !== null && !sel.has(id), within: inside[0] });
    }
    const plan = resolvePlan(entries);
    if (!plan.length) {
      flash(t2("board.resolve.none"));
      return;
    }
    const ops = [];
    const from = /* @__PURE__ */ new Map();
    for (const m of plan) {
      const it = d.items[m.id], r = entries.find((e) => e.id === m.id).rect;
      ops.push({ op: "set", id: m.id, p: { x: Math.round((it.x ?? r.x) + m.x - r.x), y: Math.round((it.y ?? r.y) + m.y - r.y) } });
      from.set(m.id, r);
    }
    flipFrom(from, [...from.keys()]);
    commit(ops, t2("board.resolve"));
  }, [commit, contentRects, flash, flipFrom, getRect, selected, t2, wiredIds]);
  const insertOnEdge = useCallback((edgeId, item) => {
    const d = docRef.current;
    const line2 = d?.items[edgeId];
    if (!d || !line2 || line2.k !== "line" || line2.a == null || line2.b == null) return null;
    const topOf = (id) => d.items[id]?.in ?? id;
    const rectOf = (end) => Array.isArray(end) ? { x: end[0], y: end[1], w: 0, h: 0 } : getRect(topOf(end));
    const ra = rectOf(line2.a), rb = rectOf(line2.b);
    if (!ra || !rb) return null;
    const [dw, dh] = (item.k === "shape" ? SHAPE_SIZE[item.sh ?? "rect"] : void 0) ?? DEFAULT_SIZE[item.k] ?? [200, 100];
    const bTop = typeof line2.b === "string" && !d.items[line2.b]?.in ? line2.b : null;
    const plan = insertPlan(ra, rb, { w: item.w ?? dw, h: item.h ?? dh }, { shiftB: !!bTop });
    const ref = newRef();
    const ops = [
      { op: "add", ref, item: { ...item, x: plan.x, y: plan.y }, exact: true },
      { op: "set", id: edgeId, p: { b: ref } },
      { op: "add", ref: newRef(), item: { k: "line", a: ref, b: line2.b } }
    ];
    const from = /* @__PURE__ */ new Map();
    const moved = [];
    if (bTop && (plan.shift.dx || plan.shift.dy)) {
      const edges = Object.entries(d.items).filter(([k, v]) => v.k === "line" && k !== edgeId && typeof v.a === "string" && typeof v.b === "string").map(([, v]) => [topOf(v.a), topOf(v.b)]);
      const stop = typeof line2.a === "string" ? topOf(line2.a) : "";
      for (const id of downstream(edges, bTop, stop)) {
        const it = d.items[id];
        if (!it || it.k === "line" || it.x == null || it.y == null) continue;
        ops.push({ op: "set", id, p: { x: Math.round(it.x + plan.shift.dx), y: Math.round(it.y + plan.shift.dy) } });
        const r = getRect(id);
        if (r) {
          from.set(id, r);
          moved.push(id);
        }
      }
    }
    const est = estimateSize({ ...item, w: item.w ?? dw });
    const changed = /* @__PURE__ */ new Map([[ref, { x: plan.x, y: plan.y, w: est.w, h: Math.max(est.h, item.h ?? dh) }]]);
    for (const o of ops) {
      if (o.op !== "set" || o.id === edgeId || typeof o.p.x !== "number") continue;
      const r = getRect(o.id);
      if (r) changed.set(o.id, { ...r, x: r.x + plan.shift.dx, y: r.y + plan.shift.dy });
    }
    for (const m of clearAround(d, changed)) {
      const it = d.items[m.id], r = getRect(m.id);
      if (!it || !r) continue;
      ops.push({ op: "set", id: m.id, p: { x: Math.round((it.x ?? r.x) + m.x - r.x), y: Math.round((it.y ?? r.y) + m.y - r.y) } });
      from.set(m.id, r);
      moved.push(m.id);
    }
    if (moved.length) flipFrom(from, moved);
    commit(ops);
    if (EDITABLE.has(item.k) && item.k !== "image" && item.k !== "link" && item.k !== "video") startEdit(ref);
    else setSelected(/* @__PURE__ */ new Set([ref]));
    return ref;
  }, [clearAround, commit, flipFrom, getRect, startEdit]);
  insertRef.current = insertOnEdge;
  const pickForEdge = (spec) => {
    const pick = edgePick;
    setEdgePick(null);
    if (!pick) return;
    if (spec.item) {
      insertOnEdge(pick.id, spec.item);
      return;
    }
    const mid = center();
    if (spec.ask === "link" || spec.ask === "embed") {
      setAskValue("");
      setAsk({ kind: spec.ask, at: mid, edge: pick.id });
      return;
    }
    if (spec.ask === "image") {
      pendingEdge.current = pick.id;
      fileRef.current?.click();
      return;
    }
    if (spec.ask === "board") {
      void boardsApi.create(t2("board.untitled"), bid).then((child) => insertOnEdge(pick.id, { k: "board", ref: child.id })).catch((e) => flash(String(e?.message ?? e)));
    }
  };
  const addImageFiles = useCallback(async (files, at) => {
    const p = at ?? center();
    for (const f of files.slice(0, 8)) {
      if (VIDEO_TYPES.test(f.type)) {
        try {
          flash(t2("board.toast.uploadingVideo", { pct: 0 }));
          const res = await uploadVideo(f, (fr) => setToast(t2("board.toast.uploadingVideo", { pct: Math.round(fr * 100) })));
          rememberPoster({ asset: res.asset }, { st: res.st ?? "none", img: res.img, dur: res.dur, iw: res.iw, ih: res.ih });
          const item = { k: "video", asset: res.asset, title: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200), w: 400 };
          if (res.img) item.img = res.img;
          if (res.dur) item.dur = res.dur;
          if (res.iw && res.ih) {
            item.iw = res.iw;
            item.ih = res.ih;
          }
          add(item, p);
          setToast(null);
        } catch (e) {
          flash(t2("board.toast.videoFailed", { error: String(e?.message ?? e) }));
        }
        continue;
      }
      if (!f.type.startsWith("image/")) continue;
      try {
        flash(t2("board.toast.uploading"));
        const img = await prepareImage(f);
        const res = await boardsApi.uploadImage(img.data);
        const w = Math.min(372, Math.max(160, img.w));
        add({ k: "image", asset: res.asset, iw: res.iw ?? img.w, ih: res.ih ?? img.h, w }, p);
        setToast(null);
      } catch (e) {
        flash(t2("board.toast.imageFailed", { error: String(e?.message ?? e) }));
      }
    }
  }, [add, center, flash, t2]);
  const addUrl = useCallback((url, at) => {
    const item = itemForUrl(url);
    if (!item) return false;
    add(item, at);
    return true;
  }, [add]);
  const deleteSelection = useCallback(() => {
    const d = docRef.current;
    if (!d || !selected.size) return;
    const ops = normalizeDeletes(d, selected).map((id) => ({ op: "del", id }));
    if (ops.length) commit(ops);
    setSelected(/* @__PURE__ */ new Set());
  }, [commit, selected]);
  const duplicate = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const ops = [];
    const next = /* @__PURE__ */ new Set();
    const regroup = /* @__PURE__ */ new Map();
    const copied = [];
    for (const id of selected) {
      const it = d.items[id];
      if (!it || it.k === "line" || it.k === "col") continue;
      const { by: _by, in: inCol, ...rest } = it;
      if (rest.g) {
        if (!regroup.has(rest.g)) regroup.set(rest.g, newGroupId());
        rest.g = regroup.get(rest.g);
      }
      const ref = newRef();
      next.add(ref);
      const r = getRect(id);
      ops.push({ op: "add", ref, item: inCol ? { ...rest, in: inCol } : { ...rest, x: (it.x ?? r?.x ?? 0) + 24, y: (it.y ?? r?.y ?? 0) + 24 }, exact: true });
      if (!inCol && r) copied.push(r);
    }
    const box2 = copied.length ? boundsOf(copied) : null;
    if (box2 && ops.some((o) => o.op === "add" && !o.item.in && MOVABLE.has(o.item.k))) {
      const now = performance.now();
      reserved.current = reserved.current.filter((x) => now - x.t < 4e3);
      const want = { x: box2.x + 24, y: box2.y + 24 };
      const spot = freePlace(want, { w: box2.w, h: box2.h }, [...contentRects().values(), ...reserved.current.map((x) => x.rect)]);
      const dx = spot.x - want.x, dy = spot.y - want.y;
      for (const o of ops) if (o.op === "add" && !o.item.in) o.item = { ...o.item, x: Math.round((o.item.x ?? 0) + dx), y: Math.round((o.item.y ?? 0) + dy) };
      reserved.current.push({ rect: { x: spot.x, y: spot.y, w: box2.w, h: box2.h }, t: now });
    }
    if (ops.length) {
      commit(ops);
      setSelected(next);
    }
  }, [commit, contentRects, getRect, selected]);
  const toggleGroup = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const ids = [...selected].filter((id) => d.items[id]?.k === "draw");
    if (ids.length < 2 || ids.length !== selected.size) return;
    const gs = new Set(ids.map((id) => d.items[id].g));
    const g = gs.size === 1 && !gs.has(void 0) ? null : newGroupId();
    commit(ids.map((id) => ({ op: "set", id, p: { g } })));
  }, [commit, selected]);
  const continueInSession = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    if (d.session?.id) {
      openSession(d.session.id);
      return;
    }
    const ok = await newChatWithDraft(t2("board.session.draft", { name: d.name, marker: `[board:${d.id}]` }));
    if (!ok) flash(t2("board.toast.promptCopied"));
  }, [flash, t2]);
  const openChat = useCallback((focus) => {
    setChatOpen(true);
    writeLocal(CHAT_OPEN_KEY, "1");
    if (focus) window.setTimeout(() => chatInputRef.current?.focus(), 30);
  }, []);
  const closeChat = useCallback(() => {
    setChatOpen(false);
    writeLocal(CHAT_OPEN_KEY, "0");
    vpRef.current?.focus({ preventScroll: true });
  }, []);
  const resizeChat = useCallback((w) => {
    const max = Math.min(CHAT_MAX_W, Math.max(CHAT_MIN_W, (rootRef.current?.clientWidth ?? 1200) - 620));
    const next = Math.round(Math.min(max, Math.max(CHAT_MIN_W, w)));
    setChatW(next);
    writeLocal(CHAT_W_KEY, String(next));
  }, []);
  const sendToHermes = useCallback(async (text) => {
    const d = docRef.current;
    if (!d || !text.trim()) return;
    const how = await sendToSession(d, boardPrompt(d, text, [...selected], t2("board.prompt.selection")));
    if (how === "sent") {
      openChat(false);
      setChatSentAt(Date.now());
    } else flash(t2("board.toast.promptCopied"));
  }, [flash, openChat, selected, t2]);
  const onChatSent = useCallback((_text, how) => {
    if (how === "handoff") flash(t2("board.toast.promptCopied"));
  }, [flash, t2]);
  const drawLive = useCallback(() => {
    liveRaf.current = 0;
    const er = eraser.current, d = docRef.current;
    if (er && er.trail.length && d) {
      const r = ERASER_R / view.current.z;
      const hits = new Set(er.sweep ? erasingRef.current : []);
      for (const p of er.trail) for (const id of eraseHits(d.items, p, r)) hits.add(id);
      er.trail = er.trail.slice(-1);
      const list = [...hits];
      if (!sameSet(erasingRef.current, list)) {
        erasingRef.current = hits;
        setErasing(hits);
      }
    }
    const svg = liveSvgRef.current, path = livePathRef.current, head = liveHeadRef.current;
    if (!svg || !path || !head) return;
    const s = stroke.current;
    if (!s) {
      path.setAttribute("d", "");
      head.setAttribute("d", "");
      return;
    }
    const k = inkRef.current;
    const sw = inkWidth(k, s.tool);
    const r12 = (v) => Math.round(v * 10) / 10;
    const fill = s.tool === "pen" && k.sm > 0 && !k.ds;
    svg.setAttribute("class", `hb-draw hb-live${s.tool === "lasso" ? " lasso" : ""}${s.tool === "hl" ? " hl" : ""}${k.c !== "ink" && s.tool !== "lasso" ? ` c-${k.c}` : ""}`);
    path.setAttribute("class", fill ? "fill" : "");
    path.setAttribute("stroke-width", String(s.tool === "lasso" ? 1.2 / view.current.z : sw));
    const dash = s.tool === "lasso" ? `${4 / view.current.z} ${3 / view.current.z}` : k.ds && !fill ? `${Math.max(4, sw * 3)} ${Math.max(4, sw * 2.4)}` : "";
    if (dash) path.setAttribute("stroke-dasharray", dash);
    else path.removeAttribute("stroke-dasharray");
    head.setAttribute("stroke-width", String(sw));
    if (s.tool === "lasso") {
      path.setAttribute("d", s.loop.length > 1 ? `M${s.loop.map(([x, y]) => `${r12(x)} ${r12(y)}`).join(" L")} Z` : "");
      head.setAttribute("d", "");
      return;
    }
    if (isShape(s.tool)) {
      const [p0, p1] = shapePoints(s.tool, s.a, s.b, { shift: s.shift, alt: s.alt });
      path.setAttribute("d", shapePath(s.tool, p0, p1));
      head.setAttribute("d", s.tool === "arrow" ? arrowHead(p0, p1, sw) : "");
      return;
    }
    const pts = s.pts.slice();
    const prs = s.pr.slice();
    for (const q of [s.raw, s.pred]) if (q) {
      pts.push(q);
      prs.push(prs[prs.length - 1] ?? 0.5);
    }
    head.setAttribute("d", "");
    if (fill) {
      const pen = s.pointerType === "pen" && Math.max(...prs) - Math.min(...prs) > 0.05;
      path.setAttribute("d", outlinePath(freehandOutline(pts, sw * 1.35, pen ? prs : void 0)));
    } else {
      path.setAttribute("d", strokePath(pts.map(([x, y]) => [r12(x), r12(y)])));
    }
  }, []);
  const scheduleLive = useCallback(() => {
    if (!liveRaf.current) liveRaf.current = requestAnimationFrame(drawLive);
  }, [drawLive]);
  useEffect(() => () => cancelAnimationFrame(liveRaf.current), []);
  useEffect(() => {
    if (tool !== "draw") {
      stroke.current = null;
      eraser.current = null;
      setErasing((cur) => cur.size ? /* @__PURE__ */ new Set() : cur);
    } else if (ink2.tool !== "eraser") {
      eraser.current = null;
      setErasing((cur) => cur.size ? /* @__PURE__ */ new Set() : cur);
    }
  }, [tool, ink2.tool]);
  const worldMapper = () => {
    const rect = vpRef.current.getBoundingClientRect();
    const v = view.current;
    return (cx2, cy2) => [(cx2 - rect.left - v.x) / v.z, (cy2 - rect.top - v.y) / v.z];
  };
  const onInkMove = (e) => {
    const vp = vpRef.current;
    if (!vp) return;
    const W = worldMapper();
    const k = inkRef.current;
    const ring = ringRef.current;
    if (ring) {
      const rect = vp.getBoundingClientRect();
      ring.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
    }
    const native = e.nativeEvent;
    const batch = native.getCoalescedEvents?.() ?? [];
    const events = batch.length ? batch : [native];
    if (k.tool === "eraser") {
      const er = eraser.current ?? (eraser.current = { trail: [], sweep: false });
      er.sweep = drag.current?.kind === "erase";
      if (!er.sweep) er.trail = [];
      for (const ev of events) er.trail.push(W(ev.clientX, ev.clientY));
      scheduleLive();
      return;
    }
    const s = stroke.current;
    if (!s || !drag.current) return;
    if (s.tool === "lasso") {
      for (const ev of events) s.loop.push(W(ev.clientX, ev.clientY));
    } else if (isShape(s.tool)) {
      s.b = W(e.clientX, e.clientY);
      s.shift = e.shiftKey;
      s.alt = e.altKey;
    } else {
      for (const ev of events) {
        const [fx, fy] = s.euro ? s.euro.filter(ev.clientX, ev.clientY, ev.timeStamp) : [ev.clientX, ev.clientY];
        s.pts.push(W(fx, fy));
        s.pr.push(ev.pressure || 0.5);
      }
      s.raw = W(e.clientX, e.clientY);
      const pred = native.getPredictedEvents?.() ?? [];
      s.pred = pred.length ? W(pred[pred.length - 1].clientX, pred[pred.length - 1].clientY) : null;
    }
    scheduleLive();
  };
  const finishInk = (d) => {
    const s = stroke.current;
    stroke.current = null;
    scheduleLive();
    if (!s) return;
    const k = inkRef.current;
    const z = view.current.z;
    if (s.tool === "lasso") {
      setSelected(expandGroups(d.items, lassoHits(d.items, s.loop)));
      return;
    }
    const sw = inkWidth(k, s.tool);
    const style = {};
    if (k.c !== "ink") style.c = k.c;
    if (k.ds) style.ds = true;
    if (isShape(s.tool)) {
      const [p0, p1] = shapePoints(s.tool, s.a, s.b, { shift: s.shift, alt: s.alt });
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 3 / z) return;
      const st2 = toStroke([p0, p1]);
      commit([{ op: "add", ref: newRef(), item: { k: "draw", x: st2.x, y: st2.y, d: st2.d, sw, tl: s.tool, ...style } }]);
      return;
    }
    const raw = s.raw ? [...s.pts, s.raw] : s.pts;
    const prs = s.raw ? [...s.pr, s.pr[s.pr.length - 1] ?? 0.5] : s.pr;
    let pts = finishStroke(raw, z, s.pointerType, k.sm);
    if (!pts.length) return;
    if (pts.length === 1) pts = [pts[0], pts[0]];
    const st = toStroke(pts);
    const item = { k: "draw", x: st.x, y: st.y, d: st.d, sw, ...style };
    if (s.tool === "hl") item.tl = "hl";
    else if (k.sm > 0 && !k.ds) {
      item.sm = true;
      if (s.pointerType === "pen") {
        const pr = pressureDigits(raw, prs, pts);
        if (pr) item.pr = pr;
      }
    }
    commit([{ op: "add", ref: newRef(), item }]);
  };
  const onPointerDown = (e) => {
    const d = docRef.current;
    if (!d || e.button === 2) return;
    const target = e.target;
    pendingEdge.current = null;
    if (target.closest("[data-nodrag], .hb-ctx, .hb-epick, input, textarea, iframe, video")) return;
    downAt.current = { t: e.timeStamp, x: e.clientX, y: e.clientY, type: pointerKind(e.pointerType) };
    stopCamera();
    if (connectFrom) {
      const hit = target.closest("[data-kid], [data-iid]");
      const to = hit?.dataset.kid ?? hit?.dataset.iid;
      if (to && to !== connectFrom && d.items[connectFrom]) commit([{ op: "add", ref: newRef(), item: { k: "line", a: connectFrom, b: to } }]);
      setConnectFrom(null);
      return;
    }
    if (editing && !target.closest(`[data-iid="${editing}"], [data-kid="${editing}"]`)) {
      document.activeElement?.blur?.();
      setEditing(null);
    }
    if (editLabel) {
      document.activeElement?.blur?.();
      setEditLabel(null);
    }
    if (edgePick) setEdgePick(null);
    if (playing && d.items[playing]?.k === "embed" && !target.closest(`[data-iid="${playing}"], [data-kid="${playing}"]`)) setPlaying(null);
    const w = toWorld(e.clientX, e.clientY);
    lastPoint.current = w;
    const itemEl = target.closest("[data-iid]");
    const kidEl = target.closest("[data-kid]");
    const base = { sx: e.clientX, sy: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.button === 1 || space.current || tool === "pan") {
      drag.current = { ...base, kind: "pan", view: { ...view.current } };
      vpRef.current?.classList.add("panning");
      return;
    }
    if (tool === "draw") {
      const k = inkRef.current;
      const p = [w.x, w.y];
      if (k.tool === "eraser") {
        drag.current = { ...base, kind: "erase" };
        eraser.current = { trail: [p], sweep: true };
        erasingRef.current = /* @__PURE__ */ new Set();
        scheduleLive();
        return;
      }
      if (k.tool === "lasso" && selBounds && selected.size && intersects(selBounds, { x: w.x, y: w.y, w: 0.01, h: 0.01 })) {
        drag.current = { ...base, kind: "move", ids: [...selected].filter((x) => d.items[x] && !d.items[x].in && d.items[x].k !== "line") };
        return;
      }
      const prm = k.tool === "pen" || k.tool === "hl" ? euroFor(e.pointerType || "mouse", k.sm) : null;
      const euro = prm ? new OneEuro2D(prm) : null;
      if (euro) euro.filter(e.clientX, e.clientY, e.timeStamp);
      stroke.current = {
        tool: k.tool,
        pointerType: e.pointerType || "mouse",
        euro,
        pts: [p],
        pr: [e.pressure || 0.5],
        raw: null,
        pred: null,
        a: p,
        b: p,
        shift: e.shiftKey,
        alt: e.altKey,
        loop: [p]
      };
      if (k.tool === "lasso") setSelected(/* @__PURE__ */ new Set());
      drag.current = { ...base, kind: k.tool === "lasso" ? "lasso" : "ink" };
      scheduleLive();
      return;
    }
    if (tool === "arrow") {
      const from = (kidEl?.dataset.kid ?? itemEl?.dataset.iid) || null;
      if (from) {
        drag.current = { ...base, kind: "arrow", from };
        const r = getRect(from);
        if (r) setDraft({ from: r, to: [w.x, w.y] });
      }
      return;
    }
    if (target.closest(".hb-crop.br") && itemEl) {
      const id = itemEl.dataset.iid;
      const r = getRect(id);
      drag.current = { ...base, kind: "resize", id, w0: r?.w ?? 200, h0: r?.h ?? 100 };
      return;
    }
    if (kidEl && tool === "select") {
      const id = kidEl.dataset.kid;
      setSelected(/* @__PURE__ */ new Set([id]));
      drag.current = { ...base, kind: "kid", id };
      return;
    }
    if (itemEl && tool === "select") {
      const id = itemEl.dataset.iid;
      let sel = selected;
      const group = expandGroups(d.items, [id]);
      if (e.shiftKey) {
        sel = new Set(selected);
        if (sel.has(id)) group.forEach((x) => sel.delete(x));
        else group.forEach((x) => sel.add(x));
      } else if (!selected.has(id)) sel = group;
      setSelected(sel);
      drag.current = { ...base, kind: "move", ids: [...sel].filter((x) => d.items[x] && !d.items[x].in && d.items[x].k !== "line") };
      return;
    }
    if (PLACE.includes(tool)) {
      drag.current = { ...base, kind: "pan", view: { ...view.current } };
      return;
    }
    if (e.shiftKey) {
      drag.current = { ...base, kind: "marquee" };
      setMarquee({ x: w.x, y: w.y, w: 0, h: 0 });
    } else {
      drag.current = { ...base, kind: "pan", view: { ...view.current } };
    }
  };
  const startFlight = (ids) => {
    const d = docRef.current;
    const base = /* @__PURE__ */ new Map(), kids = /* @__PURE__ */ new Map(), affected = /* @__PURE__ */ new Set();
    for (const id of ids) {
      const r = getRect(id);
      if (!r) continue;
      base.set(id, r);
      affected.add(id);
      const ks = d.items[id]?.k === "col" ? d.items[id].kids ?? [] : [];
      if (ks.length) {
        kids.set(id, ks);
        for (const k of ks) {
          const kr = getRect(k);
          if (kr) base.set(k, kr);
          affected.add(k);
        }
      }
    }
    const moved = new Set(ids);
    const others = [];
    for (const [id, it] of Object.entries(d.items)) {
      if (moved.has(id) || it.in || it.k === "line" || it.k === "draw") continue;
      const r = getRect(id);
      if (r) others.push(r);
    }
    const rects = ids.map((id) => base.get(id)).filter(Boolean);
    return { ids, base, kids, affected, union: boundsOf(rects) ?? { x: 0, y: 0, w: 0, h: 0 }, others };
  };
  const offsetFlight = (fl, dx, dy) => {
    for (const id of fl.ids) {
      const el = els.current.get(id);
      if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    for (const [id, r] of fl.base) liveRects.current.set(id, { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
    wiresRef.current?.refresh(fl.affected);
  };
  const endFlight = (fl) => {
    for (const id of fl.ids) {
      const el = els.current.get(id);
      if (el) el.style.transform = "";
    }
    for (const id of fl.base.keys()) liveRects.current.delete(id);
    wiresRef.current?.refresh(fl.affected);
  };
  const paintGuides = (guides) => {
    const el = guidesRef.current;
    if (!el) return;
    el.replaceChildren(...guides.slice(0, 16).map((g) => {
      const i = document.createElement("i");
      i.className = `hb-guide ${g.axis}`;
      if (g.axis === "x") {
        i.style.left = `${g.pos}px`;
        i.style.top = `${g.from}px`;
        i.style.height = `${g.to - g.from}px`;
      } else {
        i.style.top = `${g.pos}px`;
        i.style.left = `${g.from}px`;
        i.style.width = `${g.to - g.from}px`;
      }
      return i;
    }));
  };
  const columnUnder = (cx2, cy2, skip) => {
    const d = docRef.current;
    for (const el of document.elementsFromPoint(cx2, cy2)) {
      const track = el.closest?.("[data-col]");
      if (!track) continue;
      const col = track.dataset.col;
      if (col === skip || !d?.items[col]) continue;
      const kids = (d.items[col].kids ?? []).filter((k) => k !== skip);
      let index = kids.length;
      for (let i = 0; i < kids.length; i++) {
        const kel = els.current.get(kids[i]);
        if (kel) {
          const r = kel.getBoundingClientRect();
          if (cy2 < r.top + r.height / 2) {
            index = i;
            break;
          }
        }
      }
      return { col, index };
    }
    return null;
  };
  const onPointerMove = (e) => {
    if (tool === "draw") onInkMove(e);
    const g = drag.current;
    if (!g || g.kind === "ink" || g.kind === "erase" || g.kind === "lasso") return;
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dx, dy) > 3) g.moved = true;
    if (!g.moved) return;
    const z = view.current.z;
    const w = toWorld(e.clientX, e.clientY);
    switch (g.kind) {
      case "pan":
        view.current = { ...view.current, x: g.view.x + dx, y: g.view.y + dy };
        applyView();
        break;
      case "move": {
        if (!g.fl) {
          g.fl = startFlight(g.ids ?? []);
          setDelta({ dx: 0, dy: 0 });
        }
        let mx = dx / z, my = dy / z;
        let guides = [];
        if (snapRef.current && !(e.metaKey || e.ctrlKey) && g.fl.ids.length) {
          const u = g.fl.union;
          const s = snapMove({ x: u.x + mx, y: u.y + my, w: u.w, h: u.h }, g.fl.others, { thr: SNAP_PX / z });
          mx += s.dx;
          my += s.dy;
          guides = s.guides;
        }
        g.dd = { dx: mx, dy: my };
        offsetFlight(g.fl, mx, my);
        paintGuides(guides);
        break;
      }
      case "resize":
        setResize({ id: g.id, w: Math.max(docRef.current?.items[g.id]?.k === "shape" ? 40 : 120, g.w0 + dx / z), h: Math.max(40, g.h0 + dy / z) });
        break;
      case "marquee": {
        const s = toWorld(g.sx, g.sy);
        setMarquee({ x: Math.min(s.x, w.x), y: Math.min(s.y, w.y), w: Math.abs(w.x - s.x), h: Math.abs(w.y - s.y) });
        break;
      }
      case "arrow": {
        const r = getRect(g.from);
        if (r) setDraft({ from: r, to: [w.x, w.y] });
        break;
      }
      case "kid": {
        const under = columnUnder(e.clientX, e.clientY, void 0);
        setKidDrag({ id: g.id, x: w.x, y: w.y, col: under?.col ?? null, index: under?.index ?? 0 });
        break;
      }
    }
  };
  const onPointerUp = (e) => {
    const g = drag.current;
    const down = downAt.current;
    const up = { t: e.timeStamp, x: e.clientX, y: e.clientY, type: pointerKind(e.pointerType) };
    const tapped = !!g && !!down && e.type === "pointerup" && tool === "select" && (g.kind === "pan" || g.kind === "move" || g.kind === "kid") && isTap(down, up);
    finishPointer(e);
    downAt.current = null;
    if (!tapped) {
      lastTap.current = null;
      return;
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const link = under?.closest?.("a[href]");
    if (link && (e.metaKey || e.ctrlKey)) {
      window.open(link.href, "_blank", "noopener,noreferrer");
      lastTap.current = null;
      return;
    }
    const r = nextTap(lastTap.current, up);
    lastTap.current = r.last;
    if (!r.double) return;
    const fire = () => (under?.isConnected ? under : vpRef.current)?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: up.x, clientY: up.y, view: window, detail: 2 })
    );
    if (up.type === "mouse") fire();
    else window.setTimeout(fire, 90);
  };
  const finishPointer = (e) => {
    const g = drag.current;
    drag.current = null;
    vpRef.current?.classList.remove("panning");
    const d = docRef.current;
    if (!g || !d) return;
    const w = toWorld(e.clientX, e.clientY);
    if (g.kind === "pan") {
      if (g.moved) {
        saveView();
        return;
      }
      if (PLACE.includes(tool)) {
        placeAt(w);
        return;
      }
      setSelected(/* @__PURE__ */ new Set());
      return;
    }
    if (g.kind === "move") {
      const dd = g.dd;
      if (g.fl) endFlight(g.fl);
      paintGuides([]);
      setDelta(null);
      if (!g.moved || !dd || !g.ids?.length) return;
      if (g.ids.length === 1 && INTO_COLUMN.has(d.items[g.ids[0]].k)) {
        const under = columnUnder(e.clientX, e.clientY, g.ids[0]);
        if (under) {
          commit([{ op: "set", id: g.ids[0], p: { in: under.col }, at: under.index }]);
          return;
        }
      }
      commit(g.ids.map((id) => {
        const it = d.items[id];
        return { op: "set", id, p: { x: Math.round((it.x ?? 0) + dd.dx), y: Math.round((it.y ?? 0) + dd.dy) } };
      }));
      return;
    }
    if (g.kind === "resize") {
      const r = resize;
      setResize(null);
      if (!r) return;
      commit([{ op: "set", id: r.id, p: resizePatch(d.items[r.id].k, r.w, r.h) }]);
      return;
    }
    if (g.kind === "marquee") {
      const m = marquee;
      setMarquee(null);
      if (!m) return;
      const sel = /* @__PURE__ */ new Set();
      for (const [id, it] of Object.entries(d.items)) {
        if (it.in || it.k === "line") continue;
        const r = getRect(id);
        if (r && intersects(r, m)) sel.add(id);
      }
      setSelected(expandGroups(d.items, sel));
      return;
    }
    if (g.kind === "ink" || g.kind === "lasso") {
      finishInk(d);
      return;
    }
    if (g.kind === "erase") {
      drawLive();
      if (eraser.current) {
        eraser.current.sweep = false;
        eraser.current.trail = [];
      }
      const ids = normalizeDeletes(d, erasingRef.current);
      erasingRef.current = /* @__PURE__ */ new Set();
      setErasing(/* @__PURE__ */ new Set());
      if (ids.length) commit(ids.map((id) => ({ op: "del", id })));
      return;
    }
    if (g.kind === "arrow") {
      setDraft(null);
      if (!g.moved) return;
      let to = [Math.round(w.x), Math.round(w.y)];
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        const hit = el.closest?.("[data-kid], [data-iid]");
        const id = hit?.dataset.kid ?? hit?.dataset.iid;
        if (id && id !== g.from) {
          to = id;
          break;
        }
      }
      commit([{ op: "add", ref: newRef(), item: { k: "line", a: g.from, b: to } }]);
      return;
    }
    if (g.kind === "kid") {
      const k = kidDrag;
      setKidDrag(null);
      if (!g.moved || !k) return;
      const it = d.items[k.id];
      if (k.col && k.col === it.in) {
        const kids = (d.items[k.col].kids ?? []).filter((x) => x !== k.id);
        kids.splice(k.index, 0, k.id);
        commit([{ op: "set", id: k.col, p: { kids } }]);
      } else if (k.col) {
        commit([{ op: "set", id: k.id, p: { in: k.col }, at: k.index }]);
      } else {
        commit([{ op: "set", id: k.id, p: { in: null, x: Math.round(w.x - 20), y: Math.round(w.y - 12) } }]);
      }
    }
  };
  const placeAt = (w) => {
    const at = { x: Math.round(w.x), y: Math.round(w.y) };
    lastPoint.current = at;
    const kind = tool;
    setTool("select");
    if (kind === "note") add({ k: "card", w: 256 }, at, true);
    else if (kind === "todo") add({ k: "todo", title: t2("board.todo.title"), items: [] }, at, false);
    else if (kind === "col") add({ k: "col", title: t2("board.col.title") }, at, true);
    else if (kind === "link") {
      setAskValue("");
      setAsk({ kind: "link", at });
    } else if (kind === "embed") {
      setAskValue("");
      setAsk({ kind: "embed", at });
    } else if (kind === "image") fileRef.current?.click();
    else if (kind === "board") {
      void boardsApi.create(t2("board.untitled"), bid).then((child) => add({ k: "board", ref: child.id }, at)).catch((e) => flash(String(e?.message ?? e)));
    }
  };
  const lastTrackpad = useRef(0);
  const onWheel = useCallback((e) => {
    const target = e.target;
    const ta = target.closest?.("textarea");
    if (ta && ta.scrollHeight > ta.clientHeight + 1 && !e.ctrlKey && !e.metaKey) return;
    if (target.tagName === "IFRAME" || target.tagName === "VIDEO") return;
    e.preventDefault();
    stopCamera();
    const rect = vpRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const now = performance.now();
    const intent = e.shiftKey && !e.ctrlKey && !e.metaKey ? "pan" : wheelIntent(e, now - lastTrackpad.current < 400);
    if (intent === "zoom") {
      if (e.ctrlKey || e.metaKey) zoomAt(wheelZoomFactor(e), sx, sy);
      else zoomSmooth(wheelZoomFactor(e), sx, sy);
      return;
    }
    if (!e.shiftKey) lastTrackpad.current = now;
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    view.current = { ...view.current, x: view.current.x - dx, y: view.current.y - dy };
    applyView();
    saveView();
  }, [applyView, saveView, stopCamera, zoomAt, zoomSmooth]);
  const hasDoc = !!doc;
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [onWheel, hasDoc]);
  useEffect(() => {
    if (!hasDoc) return;
    return installSyncApi(makeSyncApi(syncHub, bid, () => groupsOf(docRef.current?.items ?? {})[0]));
  }, [bid, hasDoc, syncHub]);
  const syncGroupsKey = doc ? groupsOf(doc.items).join(",") : "";
  const syncGroups = useMemo(() => syncGroupsKey ? syncGroupsKey.split(",") : [], [syncGroupsKey]);
  const show2 = usePresentation({
    bid,
    doc,
    docRef,
    cam,
    vpRef,
    view,
    applyView,
    getRect,
    contentBounds,
    openChild,
    closeToParent,
    arrival,
    ready: !!doc,
    stopCamera
  });
  const startPresenting = useCallback(() => {
    if (!show2.count()) {
      flash(t2("board.present.empty"));
      return;
    }
    setSelected(/* @__PURE__ */ new Set());
    setMenu(null);
    void show2.start({ fullscreen: false });
  }, [flash, show2, t2]);
  const tourFromFrames = useCallback(() => {
    const d = docRef.current;
    const stops = d ? framesAsStops(d, getRect) : [];
    if (!stops.length) {
      flash(t2("board.tour.noFrames"));
      return;
    }
    commit([{ op: "tour", tour: { ...d?.tour ?? {}, stops } }]);
    flash(t2("board.tour.built", { n: stops.length }));
  }, [commit, flash, getRect, t2]);
  const tourAdd = useCallback((stop) => {
    let tour = docRef.current?.tour;
    for (const s of stop) tour = withStop(tour, s);
    if (!tour) return;
    commit([{ op: "tour", tour }]);
    flash(t2("board.tour.added", { n: tour.stops.length }));
  }, [commit, flash, t2]);
  const tourAddSelection = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const ids = [...selectedRef.current].filter((id) => d.items[id] && d.items[id].k !== "line");
    tourAdd(ids.map((id) => ({ k: d.items[id].k === "frame" ? "frame" : d.items[id].k === "board" ? "board" : "item", id })));
  }, [tourAdd]);
  const tourAddView = useCallback(() => {
    const v = view.current;
    tourAdd([{ k: "view", v: { x: Math.round(v.x), y: Math.round(v.y), z: Math.round(v.z * 1e3) / 1e3 } }]);
  }, [tourAdd]);
  const tourClear = useCallback(() => {
    commit([{ op: "tour", tour: null }]);
    flash(t2("board.tour.cleared"));
  }, [commit, flash, t2]);
  useEffect(() => {
    if (!hasDoc) return;
    const size = () => ({ w: vpRef.current?.clientWidth ?? 1, h: vpRef.current?.clientHeight ?? 1 });
    const rectFor = (ids) => boundsOf(ids.map((id) => getRect(id)).filter(Boolean));
    const api2 = {
      version: 1,
      board: bid,
      flyTo: (req) => {
        autoFit.current = false;
        let target = null;
        if (req.view) target = req.view;
        else if (req.fit) target = fitTarget();
        else {
          const b = req.rect ?? (req.item ? rectFor([req.item]) : req.items ? rectFor(req.items) : req.selection ? rectFor([...selectedRef.current]) : null);
          if (b) target = viewForRect(b, size(), { pad: req.pad ?? 80, maxZ: req.maxZ ?? 1.5, minZ: req.minZ ?? 0.05 });
        }
        if (!target) return Promise.resolve(false);
        return cam.current.flyTo(target, { duration: req.duration, ease: req.ease });
      },
      fit: (o) => {
        const t22 = fitTarget();
        return t22 ? cam.current.flyTo(t22, o) : Promise.resolve(false);
      },
      getView: () => ({ ...view.current }),
      setView: (v) => {
        stopCamera();
        view.current = { ...v };
        applyView();
        saveView();
      },
      itemRect: (id) => getRect(id),
      cancel: stopCamera,
      moving: () => !!cam.current?.moving,
      minimap: (on) => {
        writeLocal("hb.map.off", on ? "0" : "1");
        setMapOff(!on);
      },
      clock: cameraClockApi
    };
    return installCameraApi(api2);
  }, [hasDoc, bid, applyView, fitTarget, getRect, saveView, stopCamera]);
  const zoomStep = useCallback((f) => {
    const vp = vpRef.current;
    if (!vp) return;
    autoFit.current = false;
    zoomAnim.current && cancelAnimationFrame(zoomAnim.current.raf);
    zoomAnim.current = null;
    void cam.current.zoomBy(f, vp.clientWidth / 2, vp.clientHeight / 2);
  }, []);
  const toggleMap = useCallback(() => setMapOff((o) => {
    writeLocal("hb.map.off", o ? "0" : "1");
    return !o;
  }), []);
  useEffect(() => {
    const onKey = (e) => {
      if (!rootRef.current?.isConnected || ask || confirmReq) return;
      const live = stroke.current;
      if (live && isShape(live.tool) && (e.key === "Shift" || e.key === "Alt")) {
        live.shift = e.shiftKey;
        live.alt = e.altKey;
        if (e.key === "Alt") e.preventDefault();
        scheduleLive();
        return;
      }
      if (e.key === " " && !isTyping(e.target)) {
        space.current = e.type === "keydown";
        if (e.type === "keydown") e.preventDefault();
        return;
      }
      if (e.type !== "keydown" || isTyping(e.target)) return;
      const mod2 = e.metaKey || e.ctrlKey;
      if (mod2 && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) sync.redo();
        else sync.undo();
        return;
      }
      if (mod2 && e.key.toLowerCase() === "y") {
        e.preventDefault();
        sync.redo();
        return;
      }
      if (mod2 && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
        return;
      }
      if (mod2 && e.key.toLowerCase() === "g") {
        e.preventDefault();
        toggleGroup();
        return;
      }
      if (mod2 && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const d = docRef.current;
        if (d) setSelected(new Set(Object.keys(d.items).filter((id) => !d.items[id].in)));
        return;
      }
      if (mod2 && e.key === "Enter") {
        e.preventDefault();
        void continueInSession();
        return;
      }
      if (mod2 && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        tidy();
        return;
      }
      if (mod2 || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === "Escape") {
        if (connectFrom) {
          setConnectFrom(null);
          return;
        }
        if (stroke.current) {
          stroke.current = null;
          drag.current = null;
          scheduleLive();
          return;
        }
        setSelected(/* @__PURE__ */ new Set());
        setTool("select");
        setEditing(null);
        setEdgePick(null);
        setEditLabel(null);
        return;
      }
      if ((e.key === "Enter" || e.key === "F2") && selected.size === 1) {
        const id = [...selected][0];
        const it = docRef.current?.items[id];
        if (it && EDITABLE.has(it.k)) {
          e.preventDefault();
          startEdit(id);
        }
        return;
      }
      if (selected.size === 1 && tool === "select" && !connectFrom) {
        const id = [...selected][0];
        const ch = typeToEditChar(e, docRef.current?.items[id]?.k);
        if (ch) {
          e.preventDefault();
          startEdit(id, { seed: ch });
          return;
        }
      }
      if (e.key === "/") {
        e.preventDefault();
        openChat(true);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        fit();
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        zoomToSelection();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        toggleMap();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        startPresenting();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        zoomStep(1.2);
        return;
      }
      if (e.key === "-") {
        zoomStep(1 / 1.2);
        return;
      }
      if (e.key.startsWith("Arrow") && selected.size) {
        e.preventDefault();
        const d = docRef.current;
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
        commit([...selected].filter((id) => d.items[id] && !d.items[id].in && d.items[id].k !== "line").map((id) => ({ op: "set", id, p: { x: (d.items[id].x ?? 0) + dx, y: (d.items[id].y ?? 0) + dy } })));
        return;
      }
      if (e.key.toLowerCase() === "d" && e.shiftKey) {
        setTool("draw");
        setInk({ ...inkRef.current, tool: "hl" });
        return;
      }
      if (tool === "draw") {
        const k = inkRef.current;
        if (e.key === "[" || e.key === "]") {
          setInk(stepWidth(k, e.key === "]" ? 1 : -1));
          return;
        }
        if (/^[1-6]$/.test(e.key)) {
          setInk({ ...k, c: INK_COLORS[Number(e.key) - 1] });
          return;
        }
        if (e.key.toLowerCase() === "e") {
          setInk({ ...k, tool: "eraser" });
          return;
        }
        if (e.key.toLowerCase() === "d") {
          setInk({ ...k, tool: "pen" });
          return;
        }
      }
      const tl = KEY_TOOL[e.key.toLowerCase()];
      if (tl) {
        if (tl === "image") {
          fileRef.current?.click();
          return;
        }
        if (tl === "link" || tl === "embed") {
          setAskValue("");
          setAsk({ kind: tl, at: lastPoint.current ?? center() });
          return;
        }
        setTool(tl);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [ask, center, commit, confirmReq, connectFrom, continueInSession, deleteSelection, duplicate, fit, openChat, scheduleLive, selected, setInk, startEdit, startPresenting, sync, tidy, tool, toggleGroup, toggleMap, zoomStep, zoomToSelection]);
  useEffect(() => {
    const onPaste = (e) => {
      if (!rootRef.current?.isConnected || isTyping(e.target) || ask) return;
      const files = [...e.clipboardData?.files ?? []].filter((f) => f.type.startsWith("image/") || VIDEO_TYPES.test(f.type));
      if (files.length) {
        e.preventDefault();
        void addImageFiles(files);
        return;
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const url = extractUrl(text);
      if (url) {
        e.preventDefault();
        addUrl(url);
        return;
      }
      if (text.trim()) {
        e.preventDefault();
        add({ k: "card", text: text.trim().slice(0, 5e3), w: 256 });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [add, addImageFiles, addUrl, ask]);
  const onDrop = (e) => {
    e.preventDefault();
    const at = toWorld(e.clientX, e.clientY);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/") || VIDEO_TYPES.test(f.type));
    if (files.length) {
      void addImageFiles(files, at);
      return;
    }
    const url = extractUrl(e.dataTransfer.getData("text/uri-list").split("\n")[0] || e.dataTransfer.getData("text/plain"));
    if (url) addUrl(url, at);
  };
  const pres = sync.presence && (!doc?.hermes || sync.presence.at >= doc.hermes.at) ? sync.presence : doc?.hermes ?? null;
  const hermesActive = !!(pres && Date.now() / 1e3 - pres.at < HERMES_ACTIVE_S) || !!cursorAct;
  const presenceLabel = (() => {
    if (!doc) return "";
    const on = pres?.on ? doc.items[pres.on] : null;
    const r = on ? approxRect(on) : null;
    const frame = r ? Object.values(doc.items).find((f) => {
      if (f.k !== "frame") return false;
      const fr = approxRect(f);
      return !!fr && r.x >= fr.x && r.y >= fr.y && r.x <= fr.x + fr.w && r.y <= fr.y + fr.h;
    }) : null;
    return frame?.title || (on ? itemLabel(on).slice(0, 28) : "") || doc.name;
  })();
  const regCache = useRef(/* @__PURE__ */ new Map());
  const regEl = useCallback((id) => {
    let f = regCache.current.get(id);
    if (!f) {
      f = (el) => {
        if (el) els.current.set(id, el);
        else els.current.delete(id);
      };
      regCache.current.set(id, f);
    }
    return f;
  }, []);
  const ctx = useMemo(() => doc ? {
    doc,
    t: t2,
    editing,
    setEditing,
    hint: editHint,
    update,
    commit,
    playing,
    setPlaying,
    Frame,
    liveActions,
    liveActionsDown,
    runLiveAction,
    erasing,
    bid,
    sync: syncHub,
    runCompAction,
    keyOf,
    openBoard: (id) => openChild(id),
    addToColumn: (col) => {
      const ref = newRef();
      commit([{ op: "add", ref, item: { k: "card", in: col } }]);
      setSelected(/* @__PURE__ */ new Set([ref]));
      setEditing(ref);
    },
    renderKid: (id) => {
      const it = doc.items[id];
      if (!it) return null;
      const cls = `hb-kid${selected.has(id) ? " sel" : ""}${kidDrag?.id === id ? " ghost" : ""}${hidden.has(id) ? " reveal-wait" : ""}`;
      return /* @__PURE__ */ jsx("div", { className: cls, "data-kid": id, ref: regEl(id), children: /* @__PURE__ */ jsx(ItemBody, { id, item: it, c: ctxRef.current, dropIndex: null, selected: selected.has(id) }) }, keyOf(id));
    }
  } : null, [Frame, bid, commit, doc, editing, editHint, erasing, hidden, kidDrag, liveActions, liveActionsDown, keyOf, onOpenBoard, playing, regEl, runCompAction, runLiveAction, selected, setEditing, syncHub, t2, update]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const selBounds = useMemo(() => {
    if (!doc || !selected.size || delta || resize) return null;
    const rects = [...selected].map((id) => getRect(id)).filter(Boolean);
    return boundsOf(rects);
  }, [doc, selected, delta, resize, layoutV, getRect]);
  const selKinds = doc ? [...selected].map((id) => doc.items[id]?.k).filter(Boolean) : [];
  const ctxLabel = (() => {
    if (!doc || !selKinds.length) return "";
    if (selKinds.length > 1) return t2("board.ctx.items", { n: selKinds.length });
    const it = doc.items[[...selected][0]];
    if (it.k === "todo") return t2("board.ctx.todo", { n: it.items?.length ?? 0 });
    if (it.k === "col") return t2("board.ctx.col", { n: it.kids?.length ?? 0 });
    return t2(`board.kind.${it.k}`);
  })();
  const hermesVerbs = (() => {
    if (!selKinds.length) return [];
    if (selKinds.length > 1 && selKinds.every((k) => k === "draw")) return ["board.verb.diagram"];
    if (selKinds.length > 1) return ["board.verb.group", "board.verb.summarize"];
    switch (selKinds[0]) {
      case "draw":
        return ["board.verb.diagram"];
      case "todo":
        return ["board.verb.sortDate", "board.verb.split"];
      case "card":
        return ["board.verb.expand", "board.verb.split"];
      case "col":
        return ["board.verb.flow"];
      case "link":
      case "video":
      case "live":
        return ["board.verb.summarize"];
      default:
        return ["board.verb.improve"];
    }
  })();
  const selIds = doc ? [...selected].filter((id) => doc.items[id]) : [];
  const single = selIds.length === 1 ? doc.items[selIds[0]] : null;
  const canEdit = !!single && EDITABLE.has(single.k);
  const canDuplicate = !!doc && selIds.some((id) => doc.items[id].k !== "line" && doc.items[id].k !== "col");
  const canConnect = !!single && single.k !== "line";
  const openTarget = single?.k === "board" && single.ref ? { board: single.ref } : single && (single.k === "link" || single.k === "video") && (single.url || single.src) ? { url: single.url || single.src } : null;
  const mod = modKey();
  const runOpen = () => {
    if (!openTarget) return;
    if ("board" in openTarget) openChild(openTarget.board);
    else window.open(openTarget.url, "_blank", "noopener,noreferrer");
  };
  const startConnect = () => {
    if (selIds.length === 1) {
      setConnectFrom(selIds[0]);
      setTool("select");
    }
  };
  const canGroup = !!doc && selIds.length > 1 && selIds.every((id) => doc.items[id].k === "draw");
  const groupOf = new Set(selIds.map((id) => doc?.items[id]?.g));
  const isGrouped = canGroup && groupOf.size === 1 && !groupOf.has(void 0);
  useLayoutEffect(() => {
    const selecting = tool === "select" || tool === "draw" && ink2.tool === "lasso";
    selRef.current = selBounds && selKinds.length && selecting && !connectFrom && !menu ? selBounds : null;
    placeCtx();
  });
  useEffect(() => rootRef.current ? installTips(rootRef.current) : void 0, [!!doc]);
  const onContextMenu = (e) => {
    const target = e.target;
    if (target.closest("input, textarea, a, iframe, video, [contenteditable]")) return;
    e.preventDefault();
    const d = docRef.current, root = rootRef.current;
    if (!d || !root) return;
    const hit = target.closest("[data-kid], [data-iid]");
    const id = hit?.dataset.kid ?? hit?.dataset.iid;
    if (id && d.items[id] && !selected.has(id)) setSelected(/* @__PURE__ */ new Set([id]));
    if (!id && !target.closest(".hb-wires .hit")) setSelected(/* @__PURE__ */ new Set());
    const rr = root.getBoundingClientRect();
    const at = toWorld(e.clientX, e.clientY);
    lastPoint.current = at;
    setTool("select");
    setEditing(null);
    setMenu({ x: e.clientX - rr.left, y: e.clientY - rr.top, at, onItem: !!id || selected.size > 0 && !!target.closest(".hb-wires .hit") });
  };
  const linkSelection = (unlink) => {
    const d = docRef.current;
    if (!d) return;
    const members = selIds.filter((i) => d.items[i] && ["video", "comp"].includes(d.items[i].k));
    if (unlink) {
      commit(members.map((id) => ({ op: "set", id, p: { sync: null } })));
      return;
    }
    const existing = members.map((i) => d.items[i].sync).find(Boolean);
    let g = existing ?? "";
    for (let n = 1; !g; n++) if (!Object.values(d.items).some((v) => v.sync === `s${n}`)) g = `s${n}`;
    commit(members.map((id) => ({ op: "set", id, p: { sync: g } })));
  };
  const menuEntries = () => {
    if (!menu) return [];
    if (menu.onItem && selIds.length) {
      const out2 = [];
      if (hermesVerbs.length) {
        out2.push({ head: t2("board.menu.askHermes"), hermes: true });
        hermesVerbs.forEach((v) => out2.push({ id: v, label: t2(v), icon: VERB_ICON[v], hermes: true, run: () => void sendToHermes(t2(v)) }));
        out2.push({ sep: true });
      }
      if (canEdit) out2.push({ id: "edit", label: t2("board.ctx.edit"), icon: "edit", kbd: "↵", run: () => setEditing(selIds[0]) });
      if (openTarget) out2.push({ id: "open", label: t2("board.ctx.open"), icon: "board" in openTarget ? "openBoard" : "open", run: runOpen });
      if (single?.k === "embed") out2.push({ id: "theme", label: t2(single.theme ? "board.embed.themeOff" : "board.embed.themeOn"), icon: "theme", run: () => update(selIds[0], { theme: single.theme ? null : true }) });
      if (single?.k === "comp") out2.push({ id: "theme", label: t2(single.nt ? "board.embed.themeOn" : "board.embed.themeOff"), icon: "theme", run: () => update(selIds[0], { nt: single.nt ? null : true }) });
      if (selIds.length > 1 && selIds.every((i) => doc?.items[i] && ["video", "comp"].includes(doc.items[i].k))) {
        const linked = selIds.every((i) => doc.items[i].sync && doc.items[i].sync === doc.items[selIds[0]].sync);
        out2.push({ id: "sync", label: t2(linked ? "board.sync.unlink" : "board.sync.link"), icon: "sync", run: () => linkSelection(linked) });
      }
      out2.push({ id: "zoomto", label: t2("board.ctx.zoomTo"), icon: "focus", kbd: "Z", run: zoomToSelection });
      out2.push({ id: "tour+", label: t2("board.tour.addSel"), icon: "present", run: tourAddSelection });
      if (canConnect) out2.push({ id: "connect", label: t2("board.ctx.connect"), icon: "connect", run: startConnect });
      if (canDuplicate) out2.push({ id: "dup", label: t2("board.ctx.duplicate"), icon: "duplicate", kbd: `${mod}D`, run: duplicate });
      if (selIds.length > 1) out2.push({ id: "tidy", label: t2("board.tidy.selection"), icon: "tidy", kbd: `${mod}⇧O`, run: tidy });
      if (selIds.length > 1) out2.push({ id: "unoverlap", label: t2("board.resolve.selection"), icon: "unoverlap", run: resolveOverlaps });
      if (canGroup) out2.push({ id: "grp", label: t2(isGrouped ? "board.ctx.ungroup" : "board.ctx.group"), icon: isGrouped ? "ungroup" : "group", kbd: `${mod}G`, run: toggleGroup });
      out2.push({ sep: true });
      out2.push({ id: "del", label: t2("board.ctx.delete"), icon: "delete", kbd: "Del", danger: true, run: deleteSelection });
      return out2;
    }
    const at = menu.at;
    const place = (tl) => () => {
      lastPoint.current = at;
      if (tl === "note") add({ k: "card", w: 256 }, at, true);
      else if (tl === "todo") add({ k: "todo", title: t2("board.todo.title"), items: [] }, at, false);
      else if (tl === "col") add({ k: "col", title: t2("board.col.title") }, at, true);
      else if (tl === "link" || tl === "embed") {
        setAskValue("");
        setAsk({ kind: tl, at });
      } else if (tl === "image") fileRef.current?.click();
      else if (tl === "board") void boardsApi.create(t2("board.untitled"), bid).then((child) => add({ k: "board", ref: child.id }, at)).catch((err) => flash(String(err?.message ?? err)));
    };
    const out = [{ head: t2("board.menu.addHere") }];
    for (const x of TOOLS[1]) out.push({ id: x.tool, label: t2(x.label), icon: x.icon, kbd: x.key, run: place(x.tool) });
    out.push({ sep: true });
    out.push({ id: "comps", label: t2("board.comp.gallery"), icon: "components", run: () => setGalleryOpen(true) });
    out.push({ id: "all", label: t2("board.menu.selectAll"), icon: "selectAll", kbd: `${mod}A`, run: () => setSelected(new Set(Object.keys(docRef.current?.items ?? {}).filter((k) => !docRef.current.items[k].in))) });
    out.push({ id: "tidy", label: t2("board.tidy.all"), icon: "tidy", kbd: `${mod}⇧O`, run: tidy });
    out.push({ id: "unoverlap", label: t2("board.resolve"), icon: "unoverlap", run: resolveOverlaps });
    out.push({ id: "fit", label: t2("board.fit"), icon: "fit", kbd: "F", run: () => fit() });
    out.push({ sep: true });
    out.push({ id: "present", label: t2("board.present.start"), icon: "present", kbd: "P", run: startPresenting });
    out.push({ id: "tourFrames", label: t2("board.tour.fromFrames"), icon: "flow", run: tourFromFrames });
    out.push({ id: "tourView", label: t2("board.tour.addView"), icon: "plus", run: tourAddView });
    if (docRef.current?.tour) out.push({ id: "tourClear", label: t2("board.tour.clear"), icon: "delete", danger: true, run: tourClear });
    out.push({ sep: true });
    out.push({ id: "chat", label: chatOpen ? t2("board.chat.close") : t2("board.chat.open"), icon: chatOpen ? "closePanel" : "chat", kbd: "/", run: () => chatOpen ? closeChat() : openChat(true) });
    return out;
  };
  const chatFloat = rootW - CHAT_MIN_W < 620;
  const chatWidth = chatFloat ? Math.min(chatW, Math.max(260, rootW - 48)) : Math.min(chatW, rootW - 620);
  const rootCls = `hb ${narrow}${show2.presenting ? " presenting" : ""}${chatOpen ? chatFloat ? " chat-float" : " chat-open" : ""}`.trim();
  if (!doc || !ctx) {
    return /* @__PURE__ */ jsxs("div", { ref: rootRef, className: rootCls, children: [
      /* @__PURE__ */ jsx("header", { className: "hb-top", children: /* @__PURE__ */ jsxs("nav", { className: "hb-path", children: [
        /* @__PURE__ */ jsx("span", { className: "mark", children: /* @__PURE__ */ jsx(Cad, {}) }),
        /* @__PURE__ */ jsx("button", { onClick: onHome, children: t2("board.path.home") }),
        /* @__PURE__ */ jsx("span", { className: "sl", children: "/" }),
        /* @__PURE__ */ jsx("button", { onClick: () => onOpenBoard(null), children: t2("board.path.boards") }),
        /* @__PURE__ */ jsx("span", { className: "sl", children: "/" })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "hb-empty", children: [
        /* @__PURE__ */ jsx("div", { className: "hd", children: sync.error ? t2("board.loadFailed") : t2("common.loading") }),
        sync.error && /* @__PURE__ */ jsx("p", { children: sync.error })
      ] })
    ] });
  }
  const items = Object.entries(doc.items).filter(([, it]) => !it.in && it.k !== "line");
  const layer2 = (it) => it.k === "frame" ? 0 : it.k === "draw" && it.tl === "hl" ? 1 : 2;
  items.sort(([, a], [, b]) => layer2(a) - layer2(b));
  const sessionShort = doc.session?.id ? doc.session.id.slice(-4) : null;
  const savedTs = demoOn() ? Date.now() / 1e3 : sync.savedAt ? sync.savedAt / 1e3 : doc.updated;
  const vpCls = `hb-viewport${tool === "pan" ? " tool-pan" : ""}${tool === "draw" ? ` tool-draw ink-${ink2.tool}` : ""}${tool === "arrow" || connectFrom ? " tool-arrow" : ""}${PLACE.includes(tool) ? " tool-place" : ""}`;
  const hint = connectFrom ? t2("board.hint.connect") : tool === "draw" ? t2(INK_HINT[ink2.tool]) : TOOL_HINT[tool] ? t2(TOOL_HINT[tool]) : "";
  const zoomBy = (f) => zoomStep(f);
  return /* @__PURE__ */ jsxs("div", { ref: rootRef, className: rootCls, style: { ["--chat-w"]: `${chatWidth}px` }, children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: vpCls,
        ref: vpRef,
        tabIndex: -1,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: finishPointer,
        onContextMenu,
        onDoubleClick: (e) => {
          if (e.nativeEvent.isTrusted) return;
          const d = docRef.current;
          if (!d) return;
          const target = e.target;
          const hit = target.closest("[data-kid], [data-iid]");
          const id = hit?.dataset.kid ?? hit?.dataset.iid;
          const it = id ? d.items[id] : void 0;
          const act = dblAction({ kind: it?.k ?? null, tool, chrome: !!target.closest("[data-nodrag], .hb-ctx, .hb-epick, .hb-ask") });
          if (act === "new") add({ k: "card", w: 256 }, toWorld(e.clientX, e.clientY), true);
          else if (act === "open" && it?.ref) onOpenBoard(it.ref);
          else if (act === "edit" && id && it) startEdit(id, editHintAt(target, e.clientX, e.clientY, it));
        },
        onDragOver: (e) => e.preventDefault(),
        onDrop,
        children: [
          /* @__PURE__ */ jsx("div", { className: "hb-grid", ref: gridRef }),
          /* @__PURE__ */ jsxs("div", { className: `hb-world${items.length > 60 ? " crowd" : ""}`, ref: worldRef, children: [
            /* @__PURE__ */ jsx(
              Wires,
              {
                ref: wiresRef,
                doc,
                getRect: getRectLive,
                version: layoutV + (delta ? 1 : 0),
                hidden,
                fresh,
                selected,
                draft,
                editLabel,
                insertLabel: t2("board.insert.hint"),
                onSelect: (id, additive) => setSelected((s) => {
                  const n = additive ? new Set(s) : /* @__PURE__ */ new Set();
                  n.add(id);
                  return n;
                }),
                onDouble: (id) => {
                  setSelected(/* @__PURE__ */ new Set([id]));
                  setEditLabel(id);
                },
                onLabel: (id, v) => {
                  setEditLabel(null);
                  if (v === null) return;
                  const next = v.trim();
                  if (next !== (docRef.current?.items[id]?.label ?? "")) update(id, { label: next || null });
                },
                onInsert: (id, at) => {
                  const rr = rootRef.current?.getBoundingClientRect();
                  if (rr) setEdgePick({ id, x: at.x - rr.left, y: at.y - rr.top });
                }
              }
            ),
            items.map(([id, it]) => {
              const sel = selected.has(id);
              const moving = delta && sel;
              const x = (it.x ?? 0) + (moving ? delta.dx : 0);
              const y = (it.y ?? 0) + (moving ? delta.dy : 0);
              const rs = resize?.id === id ? resize : null;
              const [dw, dh] = (it.k === "shape" ? SHAPE_SIZE[it.sh ?? "rect"] : void 0) ?? DEFAULT_SIZE[it.k] ?? [200, 100];
              const width = it.k === "draw" ? void 0 : rs?.w ?? it.w ?? (it.k === "text" ? void 0 : dw);
              const height = RESIZE_H.has(it.k) ? rs?.h ?? it.h ?? (it.k === "frame" ? 320 : it.k === "box" ? 62 : it.k === "shape" ? dh : void 0) : it.k === "card" && it.h ? it.h : void 0;
              const cls = `hb-item${sel ? " sel" : ""}${moving ? " dragging" : ""}${hidden.has(id) ? " reveal-wait" : ""}${fresh.has(id) && !reduced() ? " just-placed" : ""}${connectFrom === id ? " connect-from" : ""}`;
              const dropIndex = kidDrag?.col === id ? kidDrag.index : null;
              return /* @__PURE__ */ jsxs(
                "div",
                {
                  className: cls,
                  "data-iid": id,
                  ref: regEl(id),
                  style: { left: x, top: y, width, height, zIndex: layer2(it) < 2 ? 0 : sel ? 3 : 1 },
                  children: [
                    /* @__PURE__ */ jsx(ItemBody, { id, item: it, c: ctx, dropIndex, selected: sel }),
                    sel && it.k !== "draw" && selected.size === 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx("i", { className: "hb-crop tl" }),
                      /* @__PURE__ */ jsx("i", { className: "hb-crop tr" }),
                      /* @__PURE__ */ jsx("i", { className: "hb-crop bl" }),
                      /* @__PURE__ */ jsx("i", { className: "hb-crop br" })
                    ] })
                  ]
                },
                keyOf(id)
              );
            }),
            kidDrag && doc.items[kidDrag.id] && /* @__PURE__ */ jsx("div", { className: "hb-ghost", style: { left: kidDrag.x - 20, top: kidDrag.y - 12, width: 264 }, children: /* @__PURE__ */ jsx(ItemBody, { id: kidDrag.id, item: doc.items[kidDrag.id], c: ctx, dropIndex: null, selected: true }) }),
            /* @__PURE__ */ jsx("div", { className: "hb-guides", ref: guidesRef }),
            tool === "draw" && /* @__PURE__ */ jsxs("svg", { ref: liveSvgRef, className: "hb-draw hb-live", style: { position: "absolute", left: 0, top: 0, overflow: "visible" }, width: "1", height: "1", children: [
              /* @__PURE__ */ jsx("path", { ref: livePathRef, d: "" }),
              /* @__PURE__ */ jsx("path", { ref: liveHeadRef, d: "" })
            ] }),
            marquee && /* @__PURE__ */ jsx("div", { className: "hb-marquee", style: { left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h } }),
            /* @__PURE__ */ jsx(HermesCursor, { ref: cursorRef, reducedMotion: reduced(), onActive: (on, act) => setCursorAct(on ? act : null) })
          ] }),
          tool === "draw" && ink2.tool === "eraser" && /* @__PURE__ */ jsx("div", { className: "hb-eraser", ref: ringRef, style: { width: ERASER_R * 2, height: ERASER_R * 2 } }),
          items.length === 0 && /* @__PURE__ */ jsxs("div", { className: "hb-empty", children: [
            /* @__PURE__ */ jsx("span", { className: "ico", children: /* @__PURE__ */ jsx(Icon, { name: "note", size: 18 }) }),
            /* @__PURE__ */ jsx("div", { className: "hd", children: t2("board.empty.title") }),
            /* @__PURE__ */ jsx("p", { children: t2("board.empty.body") })
          ] })
        ]
      }
    ),
    selKinds.length > 0 && /* @__PURE__ */ jsxs(
      "div",
      {
        className: "hb-ctx",
        ref: ctxEl,
        role: "toolbar",
        "aria-label": ctxLabel,
        style: { visibility: "hidden" },
        onPointerDown: (e) => e.stopPropagation(),
        onContextMenu: (e) => e.preventDefault(),
        children: [
          /* @__PURE__ */ jsx("span", { className: "kind", children: ctxLabel }),
          hermesVerbs.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("i", { className: "sep" }),
            /* @__PURE__ */ jsx("span", { className: "hm-mark", "data-tip": t2("board.menu.askHermes"), children: /* @__PURE__ */ jsx(Cad, {}) }),
            hermesVerbs.map((v) => /* @__PURE__ */ jsxs("button", { className: "act hm", "data-tip": t2("board.ctx.askTip", { verb: t2(v) }), onClick: () => void sendToHermes(t2(v)), children: [
              /* @__PURE__ */ jsx(Icon, { name: VERB_ICON[v] }),
              t2(v)
            ] }, v))
          ] }),
          /* @__PURE__ */ jsx("i", { className: "sep" }),
          canEdit && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.ctx.edit"), "data-kbd": "↵", "aria-label": t2("board.ctx.edit"), onClick: () => setEditing(selIds[0]), children: /* @__PURE__ */ jsx(Icon, { name: "edit" }) }),
          openTarget && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.ctx.open"), "aria-label": t2("board.ctx.open"), onClick: runOpen, children: /* @__PURE__ */ jsx(Icon, { name: "board" in openTarget ? "openBoard" : "open" }) }),
          /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.ctx.zoomTo"), "data-kbd": "Z", "aria-label": t2("board.ctx.zoomTo"), onClick: zoomToSelection, children: /* @__PURE__ */ jsx(Icon, { name: "focus" }) }),
          canConnect && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.ctx.connect"), "aria-label": t2("board.ctx.connect"), onClick: startConnect, children: /* @__PURE__ */ jsx(Icon, { name: "connect" }) }),
          canDuplicate && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.ctx.duplicate"), "data-kbd": `${mod}D`, "aria-label": t2("board.ctx.duplicate"), onClick: duplicate, children: /* @__PURE__ */ jsx(Icon, { name: "duplicate" }) }),
          selIds.length > 1 && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.tidy.selection"), "data-kbd": `${mod}⇧O`, "aria-label": t2("board.tidy.selection"), onClick: tidy, children: /* @__PURE__ */ jsx(Icon, { name: "tidy" }) }),
          canGroup && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2(isGrouped ? "board.ctx.ungroup" : "board.ctx.group"), "data-kbd": `${mod}G`, "aria-label": t2(isGrouped ? "board.ctx.ungroup" : "board.ctx.group"), onClick: toggleGroup, children: /* @__PURE__ */ jsx(Icon, { name: isGrouped ? "ungroup" : "group" }) }),
          /* @__PURE__ */ jsx("button", { className: "ib danger", "data-tip": t2("board.ctx.delete"), "data-kbd": "Del", "aria-label": t2("board.ctx.delete"), onClick: deleteSelection, children: /* @__PURE__ */ jsx(Icon, { name: "delete" }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("header", { className: "hb-top", children: [
      /* @__PURE__ */ jsxs("nav", { className: "hb-path", children: [
        /* @__PURE__ */ jsx("span", { className: "mark", children: /* @__PURE__ */ jsx(Cad, {}) }),
        /* @__PURE__ */ jsx("button", { onClick: onHome, children: t2("board.path.home") }),
        /* @__PURE__ */ jsx("span", { className: "sl", children: "/" }),
        /* @__PURE__ */ jsx("button", { onClick: () => onOpenBoard(null), children: t2("board.path.boards") }),
        /* @__PURE__ */ jsx("span", { className: "sl", children: "/" }),
        doc.parent && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("button", { onClick: () => closeToParent(doc.parent), children: t2("board.path.parent") }),
          /* @__PURE__ */ jsx("span", { className: "sl", children: "/" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "hb-btitle", onDoubleClick: () => setRenaming(true), "data-tip": t2("board.renameHint"), children: renaming ? /* @__PURE__ */ jsx(
        "input",
        {
          autoFocus: true,
          defaultValue: doc.name,
          onBlur: (e) => {
            setRenaming(false);
            const v = e.target.value.trim();
            if (v && v !== doc.name) commit([{ op: "board", p: { name: v } }]);
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === "Escape") e.target.blur();
          }
        }
      ) : doc.name }),
      hermesActive && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "vsep" }),
        /* @__PURE__ */ jsxs("span", { className: "hb-presence", children: [
          /* @__PURE__ */ jsxs("span", { className: "tagh", children: [
            /* @__PURE__ */ jsx(Cad, {}),
            "HERMES"
          ] }),
          t2("board.presence.editing"),
          " ",
          /* @__PURE__ */ jsx("b", { children: presenceLabel })
        ] })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "spacer" }),
      /* @__PURE__ */ jsxs("span", { className: "hb-state", children: [
        /* @__PURE__ */ jsx("span", { children: t2("board.state.saved", { time: clock$1(savedTs) }) }),
        /* @__PURE__ */ jsx("span", { className: "sess", "data-tip": doc.session?.id && !demoOn() ? t2("board.chat.sessionTip", { id: doc.session.id }) : void 0, children: sessionShort ? t2("board.state.session") : t2("board.state.noSession") })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `ib lg${doc.tour?.stops.length ? " has-tour" : ""}`,
          "aria-label": t2("board.present.start"),
          "data-tip": t2("board.present.start"),
          "data-kbd": "P",
          onClick: startPresenting,
          children: /* @__PURE__ */ jsx(Icon, { name: "present", size: 15 })
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `ib lg${chatOpen ? " on" : ""}`,
          "aria-pressed": chatOpen,
          "aria-label": chatOpen ? t2("board.chat.close") : t2("board.chat.open"),
          "data-tip": chatOpen ? t2("board.chat.close") : t2("board.chat.open"),
          "data-kbd": "/",
          onClick: () => chatOpen ? closeChat() : openChat(true),
          children: /* @__PURE__ */ jsx(Icon, { name: "chat", size: 15 })
        }
      ),
      /* @__PURE__ */ jsxs("button", { className: "btn primary", "data-tip": t2("board.continueTip"), "data-kbd": `${mod}↵`, onClick: () => void continueInSession(), children: [
        /* @__PURE__ */ jsx(Icon, { name: "open" }),
        t2("board.continue")
      ] })
    ] }),
    tool === "draw" && /* @__PURE__ */ jsx(InkBar, { ink: ink2, onChange: setInk, t: t2 }),
    galleryOpen && /* @__PURE__ */ jsx(CompGallery, { t: t2, onClose: () => setGalleryOpen(false), onPick: (name, title) => {
      setGalleryOpen(false);
      const id = add({ k: "comp", comp: name, w: 480, h: 320, title: title || void 0 }, center());
      setSelected(/* @__PURE__ */ new Set([id]));
    } }),
    syncGroups.length > 0 && /* @__PURE__ */ jsx(SyncTransport, { hub: syncHub, groups: syncGroups, t: t2 }),
    /* @__PURE__ */ jsxs("footer", { className: "hb-status", children: [
      TOOLS.map((group, gi) => /* @__PURE__ */ jsx("div", { className: "seg", children: group.map((x) => /* @__PURE__ */ jsx(
        "button",
        {
          className: `tool${tool === x.tool ? " on" : ""}`,
          "aria-label": t2(x.label),
          "aria-pressed": tool === x.tool,
          "data-tip": t2(x.label),
          "data-kbd": x.key,
          onClick: () => {
            setConnectFrom(null);
            if (x.tool === "image") {
              fileRef.current?.click();
              return;
            }
            if (x.tool === "link" || x.tool === "embed") {
              setAskValue("");
              setAsk({ kind: x.tool, at: center() });
              return;
            }
            setTool(x.tool);
          },
          children: /* @__PURE__ */ jsx(Icon, { name: x.icon, size: 15 })
        },
        x.tool
      )) }, gi)),
      /* @__PURE__ */ jsx("span", { className: "hint", "aria-live": "polite", children: hint }),
      /* @__PURE__ */ jsx("div", { className: "seg", children: /* @__PURE__ */ jsx(
        "button",
        {
          className: `tool${galleryOpen ? " on" : ""}`,
          "aria-pressed": galleryOpen,
          "aria-label": t2("board.comp.gallery"),
          "data-tip": t2("board.comp.gallery"),
          onClick: () => setGalleryOpen((v) => !v),
          children: /* @__PURE__ */ jsx(Icon, { name: "components", size: 15 })
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "seg", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "tool",
            "aria-label": selIds.length > 1 ? t2("board.tidy.selection") : t2("board.tidy.all"),
            "data-tip": selIds.length > 1 ? t2("board.tidy.selection") : t2("board.tidy.all"),
            "data-kbd": `${mod}⇧O`,
            onClick: tidy,
            children: /* @__PURE__ */ jsx(Icon, { name: "tidy", size: 15 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "tool",
            "aria-label": selIds.length > 1 ? t2("board.resolve.selection") : t2("board.resolve"),
            "data-tip": selIds.length > 1 ? t2("board.resolve.selection") : t2("board.resolve"),
            onClick: resolveOverlaps,
            children: /* @__PURE__ */ jsx(Icon, { name: "unoverlap", size: 15 })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `tool${snapOn ? " on" : ""}`,
            "aria-pressed": snapOn,
            "aria-label": t2("board.snap"),
            "data-tip": `${t2("board.snap")} · ${t2("board.snap.hold", { mod })}`,
            onClick: () => {
              setSnapOn(!snapOn);
              writeLocal(SNAP_KEY, snapOn ? "0" : "1");
            },
            children: /* @__PURE__ */ jsx(Icon, { name: "snap", size: 15 })
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "seg", children: [
        /* @__PURE__ */ jsx("button", { className: "tool", disabled: !sync.canUndo, "aria-label": t2("board.undo"), "data-tip": t2("board.undo"), "data-kbd": `${mod}Z`, onClick: sync.undo, children: /* @__PURE__ */ jsx(Icon, { name: "undo", size: 15 }) }),
        /* @__PURE__ */ jsx("button", { className: "tool", disabled: !sync.canRedo, "aria-label": t2("board.redo"), "data-tip": t2("board.redo"), "data-kbd": `${mod}⇧Z`, onClick: sync.redo, children: /* @__PURE__ */ jsx(Icon, { name: "redo", size: 15 }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "seg zoom", children: [
        /* @__PURE__ */ jsx("button", { className: "tool", "aria-label": t2("board.zoomOut"), "data-tip": t2("board.zoomOut"), "data-kbd": "−", onClick: () => zoomBy(1 / 1.2), children: /* @__PURE__ */ jsx(Icon, { name: "zoomOut", size: 15 }) }),
        /* @__PURE__ */ jsxs("span", { className: "pct", ref: pctRef, children: [
          Math.round(view.current.z * 100),
          "%"
        ] }),
        /* @__PURE__ */ jsx("button", { className: "tool", "aria-label": t2("board.zoomIn"), "data-tip": t2("board.zoomIn"), "data-kbd": "+", onClick: () => zoomBy(1.2), children: /* @__PURE__ */ jsx(Icon, { name: "zoomIn", size: 15 }) }),
        /* @__PURE__ */ jsx("button", { className: `tool${mapOff ? "" : " on"}`, "aria-pressed": !mapOff, "aria-label": t2("board.map.toggle"), "data-tip": t2("board.map.toggle"), "data-kbd": "M", onClick: toggleMap, children: /* @__PURE__ */ jsx(Icon, { name: "map", size: 15 }) }),
        /* @__PURE__ */ jsx("button", { className: "tool", "aria-label": t2("board.fit"), "data-tip": t2("board.fit"), "data-kbd": "F", onClick: () => fit(), children: /* @__PURE__ */ jsx(Icon, { name: "fit", size: 15 }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: `hb-map${items.length && !mapOff ? "" : " off"}`, "data-tip": t2("board.map"), onClick: (e) => {
      const canvas = mapRef.current, vp = vpRef.current, g = mapGeo.current;
      if (!canvas || !vp || !g) return;
      const r = canvas.getBoundingClientRect();
      const wx = (e.clientX - r.left - g.ox) / g.s, wy = (e.clientY - r.top - g.oy) / g.s;
      const v = view.current;
      autoFit.current = false;
      void cam.current.flyTo({ ...v, x: vp.clientWidth / 2 - wx * v.z, y: vp.clientHeight / 2 - wy * v.z }, { duration: 340, ease: "out" });
    }, children: /* @__PURE__ */ jsxs("div", { className: "hb-map-wrap", children: [
      /* @__PURE__ */ jsx("canvas", { ref: mapRef, width: 384, height: 208 }),
      /* @__PURE__ */ jsx("i", { className: "hb-map-view", ref: mapViewRef }),
      /* @__PURE__ */ jsx("i", { className: "hb-map-hermes", ref: mapHermesRef })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: `hb-log${logOn && log.length ? "" : " off"}`, role: "log", children: [
      /* @__PURE__ */ jsx("button", { className: "x ib", "aria-label": t2("board.log.close"), "data-tip": t2("board.log.close"), onClick: () => setLogOn(false), children: /* @__PURE__ */ jsx(Icon, { name: "close", size: 13 }) }),
      log.filter((l) => l.who === "hermes").slice(-2).map((l) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "t", children: clock$1(l.t) }),
        /* @__PURE__ */ jsxs("span", { className: "who", children: [
          /* @__PURE__ */ jsx(Cad, {}),
          "hermes"
        ] }),
        /* @__PURE__ */ jsx("span", { className: "msg", children: l.msg }),
        /* @__PURE__ */ jsxs("span", { className: "acts", children: [
          l.s != null && /* @__PURE__ */ jsxs("button", { onClick: () => sync.undoEntry(l.s), children: [
            /* @__PURE__ */ jsx(Icon, { name: "undo", size: 13 }),
            t2("board.log.undo")
          ] }),
          /* @__PURE__ */ jsxs("button", { onClick: () => openChat(false), children: [
            /* @__PURE__ */ jsx(Icon, { name: "chat", size: 13 }),
            t2("board.log.openChat")
          ] })
        ] })
      ] }, l.key))
    ] }),
    chatOpen && /* @__PURE__ */ jsx(
      ChatPanel,
      {
        doc,
        t: t2,
        width: chatWidth,
        selected: selIds,
        sentAt: chatSentAt,
        inputRef: chatInputRef,
        onWidth: resizeChat,
        onClose: closeChat,
        onContinue: () => void continueInSession(),
        onSent: onChatSent
      }
    ),
    edgePick && rootRef.current && /* @__PURE__ */ jsx(
      EdgePicker,
      {
        at: { x: edgePick.x, y: edgePick.y },
        t: t2,
        bounds: { w: rootRef.current.clientWidth, h: rootRef.current.clientHeight },
        onPick: pickForEdge,
        onClose: () => setEdgePick(null)
      }
    ),
    menu && rootRef.current && /* @__PURE__ */ jsx(
      BoardMenu,
      {
        at: { x: menu.x, y: menu.y },
        entries: menuEntries(),
        onClose: () => setMenu(null),
        bounds: { x: 0, y: 0, w: rootRef.current.clientWidth, h: rootRef.current.clientHeight }
      }
    ),
    ask && /* @__PURE__ */ jsxs("div", { className: "hb-ask", onPointerDown: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsx("div", { className: "hd", children: ask.kind === "link" ? t2("board.ask.link") : t2("board.ask.embed") }),
      ask.kind === "link" ? /* @__PURE__ */ jsx(
        "input",
        {
          autoFocus: true,
          value: askValue,
          placeholder: "https://",
          onChange: (e) => setAskValue(e.target.value),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter") submitAsk();
            if (e.key === "Escape") setAsk(null);
          }
        }
      ) : /* @__PURE__ */ jsx(
        "textarea",
        {
          autoFocus: true,
          value: askValue,
          placeholder: "<!doctype html>…",
          onChange: (e) => setAskValue(e.target.value),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Escape") setAsk(null);
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAsk();
          }
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "hint", children: ask.kind === "link" ? t2("board.ask.linkHint") : t2("board.ask.embedHint", { mod }) }),
        /* @__PURE__ */ jsx("button", { className: "btn text", onClick: () => setAsk(null), children: t2("board.ask.cancel") }),
        /* @__PURE__ */ jsx("button", { className: "btn primary", onClick: submitAsk, children: t2("board.ask.add") })
      ] })
    ] }),
    confirmReq && /* @__PURE__ */ jsx("div", { className: "hb-scrim", onPointerDown: (e) => {
      e.stopPropagation();
      if (e.target === e.currentTarget) confirmReq.resolve(false);
    }, children: /* @__PURE__ */ jsxs(
      "div",
      {
        className: "hb-confirm",
        role: "alertdialog",
        "aria-modal": "true",
        "aria-labelledby": "hb-confirm-t",
        onKeyDown: (e) => {
          e.stopPropagation();
          if (e.key === "Escape") confirmReq.resolve(false);
        },
        children: [
          /* @__PURE__ */ jsx("div", { className: "hd", children: t2("board.live.confirmHead") }),
          /* @__PURE__ */ jsxs("h3", { id: "hb-confirm-t", children: [
            /* @__PURE__ */ jsx("span", { className: "ico", children: /* @__PURE__ */ jsx(Icon, { name: "alert", size: 16 }) }),
            t2("board.live.confirmTitle", { action: confirmReq.ref.label || confirmReq.info.label })
          ] }),
          /* @__PURE__ */ jsx("p", { children: confirmReq.info.confirm || confirmReq.info.description || t2("board.live.confirmBody") }),
          /* @__PURE__ */ jsxs("div", { className: "facts", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              t2("board.live.confirmCard"),
              " ",
              /* @__PURE__ */ jsx("b", { children: doc.items[confirmReq.iid]?.title || itemLabel(doc.items[confirmReq.iid] ?? {}) || confirmReq.iid })
            ] }),
            /* @__PURE__ */ jsxs("span", { children: [
              t2("board.live.confirmId"),
              " ",
              /* @__PURE__ */ jsx("b", { children: confirmReq.info.id })
            ] }),
            /* @__PURE__ */ jsx("span", { children: t2("board.live.confirmTimeout", { s: confirmReq.info.timeout }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "row", children: [
            /* @__PURE__ */ jsx("button", { className: "btn text", autoFocus: true, onClick: () => confirmReq.resolve(false), children: t2("board.ask.cancel") }),
            /* @__PURE__ */ jsxs("button", { className: "btn danger", onClick: () => confirmReq.resolve(true), children: [
              /* @__PURE__ */ jsx(Icon, { name: "alert" }),
              confirmReq.ref.label || confirmReq.info.label
            ] })
          ] })
        ]
      }
    ) }),
    show2.presenting && /* @__PURE__ */ jsx(PresenterHud, { p: show2, t: t2, board: doc.name }),
    (toast || sync.error) && /* @__PURE__ */ jsx("div", { className: "hb-toast", role: "status", children: toast || t2("board.toast.offline") }),
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: fileRef,
        type: "file",
        accept: "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime",
        multiple: true,
        hidden: true,
        onChange: (e) => {
          const files = [...e.target.files ?? []];
          e.target.value = "";
          void addImageFiles(files, lastPoint.current ?? void 0);
        }
      }
    )
  ] });
  function submitAsk() {
    if (!ask) return;
    const v = askValue.trim();
    if (ask.kind === "link") {
      const url = extractUrl(v) ?? extractUrl(`https://${v}`);
      const item = url ? itemForUrl(url) : null;
      if (!url || !item) {
        flash(t2("board.toast.badUrl"));
        return;
      }
      if (ask.edge) insertOnEdge(ask.edge, item);
      else addUrl(url, ask.at);
      setAsk(null);
      return;
    }
    if (!v) return;
    const at = ask.at, edge = ask.edge;
    setAsk(null);
    void boardsApi.uploadHtml(v).then((r) => {
      const item = { k: "embed", asset: r.asset, title: t2("board.embed.title") };
      if (edge) insertOnEdge(edge, item);
      else add(item, at);
    }).catch((e) => flash(String(e?.message ?? e)));
  }
}
function withAlpha(color, a) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${a})` : `rgba(255,227,196,${a})`;
}
function accentColor(el) {
  if (!el) return "#ffe3c4";
  const probe = document.createElement("span");
  probe.style.color = "var(--accent)";
  probe.style.display = "none";
  el.appendChild(probe);
  const c = getComputedStyle(probe).color || "#ffe3c4";
  probe.remove();
  return c;
}
const routeListeners = /* @__PURE__ */ new Set();
function notifyBoardRoute() {
  routeListeners.forEach((l) => l());
}
function currentBoardRoute() {
  return readBoardRoute(window.location);
}
function useBoardRoute() {
  const [route2, setRoute] = useState(currentBoardRoute);
  useEffect(() => {
    const check = () => setRoute(currentBoardRoute());
    routeListeners.add(check);
    window.addEventListener("hashchange", check);
    window.addEventListener("popstate", check);
    const i = window.setInterval(check, 700);
    return () => {
      routeListeners.delete(check);
      window.removeEventListener("hashchange", check);
      window.removeEventListener("popstate", check);
      window.clearInterval(i);
    };
  }, []);
  return route2;
}
function goBoard(id) {
  openBoard(id);
  window.setTimeout(notifyBoardRoute, 0);
}
function BoardCard({ row, onOpen, onDelete }) {
  const t2 = useT();
  const [doc, setDoc] = useState(null);
  useEffect(() => {
    let live = true;
    loadBoardDoc(row.id, true).then((d) => live && setDoc(d));
    return () => {
      live = false;
    };
  }, [row.id, row.seq]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "hb-card hb-boardref",
      role: "link",
      tabIndex: 0,
      onClick: onOpen,
      onKeyDown: (e) => {
        if (e.key === "Enter") onOpen();
      },
      children: [
        /* @__PURE__ */ jsx("div", { className: "pv", children: /* @__PURE__ */ jsx(BoardPreview, { doc }) }),
        /* @__PURE__ */ jsxs("div", { className: "ttl", children: [
          /* @__PURE__ */ jsx("b", { children: row.name }),
          /* @__PURE__ */ jsx("span", { className: "go", children: /* @__PURE__ */ jsx(Icon, { name: "openBoard", size: 13 }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "meta", children: [
          /* @__PURE__ */ jsx("span", { children: t2("board.ref.meta", { n: row.count, when: ago(t2, row.updated) }) }),
          /* @__PURE__ */ jsx("span", { className: "sp" }),
          row.session && /* @__PURE__ */ jsx("span", { className: "sig", children: /* @__PURE__ */ jsx(Cad, {}) }),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "del ib",
              "data-tip": t2("board.index.delete"),
              "aria-label": t2("board.index.delete"),
              onClick: (e) => {
                e.stopPropagation();
                onDelete();
              },
              children: /* @__PURE__ */ jsx(Icon, { name: "delete", size: 13 })
            }
          )
        ] })
      ]
    }
  );
}
function BoardsIndex({ onHome }) {
  const t2 = useT();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    boardsApi.list().then((r) => {
      setRows(r);
      setError(null);
    }, (e) => setError(String(e?.message ?? e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const create = async () => {
    const doc = await boardsApi.create(t2("board.untitled"));
    goBoard(doc.id);
  };
  const top = rows?.filter((r) => !r.parent) ?? [];
  const rootRef = useRef(null);
  useEffect(() => rootRef.current ? installTips(rootRef.current) : void 0, []);
  return /* @__PURE__ */ jsxs("div", { className: "hb", ref: rootRef, children: [
    /* @__PURE__ */ jsxs("header", { className: "hb-top", children: [
      /* @__PURE__ */ jsxs("nav", { className: "hb-path", children: [
        /* @__PURE__ */ jsx("span", { className: "mark", children: /* @__PURE__ */ jsx(Cad, {}) }),
        /* @__PURE__ */ jsx("button", { onClick: onHome, children: t2("board.path.home") }),
        /* @__PURE__ */ jsx("span", { className: "sl", children: "/" })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "hb-btitle", children: t2("board.index.title") }),
      /* @__PURE__ */ jsx("span", { className: "spacer" }),
      /* @__PURE__ */ jsxs("button", { className: "btn primary", onClick: () => void create(), children: [
        /* @__PURE__ */ jsx(Icon, { name: "plus" }),
        t2("board.index.new")
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "hb-index", children: [
      /* @__PURE__ */ jsxs("div", { className: "hd", children: [
        t2("board.index.title"),
        /* @__PURE__ */ jsx("span", { className: "n", children: top.length })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "lead", children: t2("board.index.lead") }),
      error && /* @__PURE__ */ jsx("p", { className: "lead", children: error }),
      /* @__PURE__ */ jsxs("div", { className: "grid", children: [
        /* @__PURE__ */ jsxs("button", { className: "new", onClick: () => void create(), children: [
          /* @__PURE__ */ jsx("span", { className: "plus", children: /* @__PURE__ */ jsx(Icon, { name: "plus", size: 16 }) }),
          t2("board.index.new"),
          /* @__PURE__ */ jsx("small", { children: t2("board.index.newHint") })
        ] }),
        top.map((r) => /* @__PURE__ */ jsx(
          BoardCard,
          {
            row: r,
            onOpen: () => goBoard(r.id),
            onDelete: () => {
              if (window.confirm(t2("board.index.confirmDelete", { name: r.name }))) void boardsApi.remove(r.id).then(load);
            }
          },
          r.id
        ))
      ] })
    ] })
  ] });
}
function BoardApp({ route: route2, onHome }) {
  if (route2) return /* @__PURE__ */ jsx(BoardView, { bid: route2, onOpenBoard: goBoard, onHome }, route2);
  return /* @__PURE__ */ jsx(BoardsIndex, { onHome });
}
function BoardWidget({ widgetProps, onWidgetPropsChange, editing }) {
  const t2 = useT();
  const [rows, setRows] = useState(null);
  const [doc, setDoc] = useState(null);
  const seq = useRef(-1);
  const tipRoot = useRef(null);
  useEffect(() => tipRoot.current ? installTips(tipRoot.current) : void 0, [rows === null || !rows.length]);
  useEffect(() => installClockApi(), []);
  const pinned = typeof widgetProps.board === "string" ? widgetProps.board : null;
  const bid = pinned && rows?.some((r) => r.id === pinned) ? pinned : rows?.find((r) => !r.parent)?.id ?? null;
  useEffect(() => {
    let live = true;
    const load = () => boardsApi.list().then((r) => live && setRows(r), () => live && setRows((x) => x ?? []));
    load();
    const i = window.setInterval(load, 3e4);
    return () => {
      live = false;
      window.clearInterval(i);
    };
  }, []);
  useEffect(() => {
    if (!bid) {
      setDoc(null);
      return;
    }
    let live = true;
    seq.current = -1;
    const poll = async () => {
      if (document.hidden && seq.current >= 0) return;
      try {
        const r = await boardsApi.since(bid, seq.current >= 0 ? seq.current : -1);
        if (!live) return;
        if (r.doc) {
          seq.current = r.doc.seq;
          setDoc(r.doc);
        } else if (r.entries?.length) {
          const full = await boardsApi.since(bid, -1);
          if (live && full.doc) {
            seq.current = full.doc.seq;
            setDoc(full.doc);
          }
        } else if (r.hermes) {
          setDoc((d) => d && d.hermes?.at !== r.hermes.at ? { ...d, hermes: r.hermes } : d);
        }
      } catch {
      }
    };
    void poll();
    const i = window.setInterval(poll, 1e4);
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      live = false;
      window.clearInterval(i);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bid]);
  const cycle = (dir) => {
    const list2 = (rows ?? []).filter((r) => !r.parent);
    if (list2.length < 2 || !bid) return;
    const i = list2.findIndex((r) => r.id === bid);
    onWidgetPropsChange({ ...widgetProps, board: list2[(i + dir + list2.length) % list2.length].id });
  };
  if (rows && !rows.length) {
    return /* @__PURE__ */ jsx("div", { className: "hb-widget", onClick: (e) => {
      e.stopPropagation();
      if (editing) return;
      void boardsApi.create(t2("board.untitled")).then((d) => goBoard(d.id));
    }, children: /* @__PURE__ */ jsx("div", { className: "empty", children: /* @__PURE__ */ jsxs("span", { children: [
      /* @__PURE__ */ jsx(Icon, { name: "board", size: 16 }),
      /* @__PURE__ */ jsx("br", {}),
      t2("board.widget.empty"),
      /* @__PURE__ */ jsx("br", {}),
      /* @__PURE__ */ jsx("b", { children: t2("board.index.new") })
    ] }) }) });
  }
  const active = doc?.hermes && Date.now() / 1e3 - doc.hermes.at < HERMES_ACTIVE_S;
  const count = doc ? Object.values(doc.items).filter((x) => x.k !== "line").length : 0;
  const list = (rows ?? []).filter((r) => !r.parent);
  return /* @__PURE__ */ jsxs("div", { className: "hb-widget", ref: tipRoot, onClick: (e) => {
    e.stopPropagation();
    if (editing || !bid) return;
    const here = e.currentTarget;
    prepareZoomIn(bid, here.closest(".home-root"), here.querySelector(".hb-mini"));
    goBoard(bid);
  }, children: [
    /* @__PURE__ */ jsx("div", { className: "pvw", children: /* @__PURE__ */ jsx(MiniBoard, { doc, id: bid ?? void 0 }) }),
    /* @__PURE__ */ jsxs("div", { className: "foot", children: [
      /* @__PURE__ */ jsx("b", { children: doc?.name ?? "…" }),
      active ? /* @__PURE__ */ jsxs("span", { className: "tagh", children: [
        /* @__PURE__ */ jsx(Cad, { size: [7, 9] }),
        "HERMES"
      ] }) : /* @__PURE__ */ jsx("span", { children: t2("board.ref.meta", { n: count, when: ago(t2, doc?.updated) }) })
    ] }),
    /* @__PURE__ */ jsxs(HoverCtl, { className: "hb-wctl", children: [
      list.length > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("button", { className: "hv-ic", "aria-label": t2("common.previous"), "data-tip": t2("common.previous"), onClick: () => cycle(-1), children: /* @__PURE__ */ jsx(Icon, { name: "prev", size: 13 }) }),
        /* @__PURE__ */ jsx("button", { className: "hv-ic", "aria-label": t2("common.next"), "data-tip": t2("common.next"), onClick: () => cycle(1), children: /* @__PURE__ */ jsx(Icon, { name: "next", size: 13 }) })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "hv-ic",
          "aria-label": t2("board.index.new"),
          "data-tip": t2("board.index.new"),
          onClick: () => void boardsApi.create(t2("board.untitled")).then((d) => goBoard(d.id)),
          children: /* @__PURE__ */ jsx(Icon, { name: "plus", size: 13 })
        }
      ),
      /* @__PURE__ */ jsx("button", { className: "hv-ic", "aria-label": t2("nav.openBoards"), "data-tip": t2("nav.openBoards"), onClick: () => goBoard(null), children: /* @__PURE__ */ jsx(Icon, { name: "board", size: 13 }) })
    ] })
  ] });
}
const WIDGET_REGISTRY = {
  ascii: {
    titleKey: "widget.ascii",
    component: ({ data, widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(
      AsciiWidget,
      {
        status: data.status,
        widgetProps,
        onWidgetPropsChange
      }
    ),
    defaultSize: { gw: 3, gh: 6 },
    minSize: { gw: 2, gh: 4 },
    navigateTo: null,
    dataSource: null
  },
  clock: {
    titleKey: "widget.clock",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(ClockWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 5, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  matrix: {
    titleKey: "widget.matrix",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(MatrixWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 4 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  gateway: {
    titleKey: "widget.gateway",
    component: ({ data }) => /* @__PURE__ */ jsx(GatewayWidget, { status: data.status }),
    defaultSize: { gw: 4, gh: 3 },
    minSize: { gw: 3, gh: 2 },
    navigateTo: "/system",
    dataSource: "status"
  },
  sessions: {
    titleKey: "widget.sessions",
    component: ({ data, widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(
      SessionsWidget,
      {
        status: data.status,
        sessions: data.sessions,
        widgetProps,
        onWidgetPropsChange
      }
    ),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: "/sessions",
    dataSource: "sessions"
  },
  tokens: {
    titleKey: "widget.tokens",
    component: ({ data, widgetProps, onWidgetPropsChange, gridSize }) => /* @__PURE__ */ jsx(
      TokensWidget,
      {
        analytics: data.analytics,
        widgetProps,
        onWidgetPropsChange,
        gridSize
      }
    ),
    defaultSize: { gw: 5, gh: 4 },
    minSize: { gw: 3, gh: 3 },
    // Not gated on the shared 1-day poll: the widget fetches its own range (with retries) and shows
    // its own loading/unavailable state. Gating it hid the widget behind "loading…" for as long as
    // the shared analytics call was slow or failing, even when its own data was already in.
    navigateTo: null,
    dataSource: null
  },
  host: {
    titleKey: "widget.host",
    component: ({ data, widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(
      HostWidget,
      {
        system: data.system,
        widgetProps,
        onWidgetPropsChange
      }
    ),
    defaultSize: { gw: 4, gh: 4 },
    minSize: { gw: 3, gh: 3 },
    navigateTo: "/system",
    dataSource: "system"
  },
  cron: {
    titleKey: "widget.cron",
    component: ({ data }) => /* @__PURE__ */ jsx(CronWidget, { cron: data.cron }),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 3, gh: 2 },
    navigateTo: "/cron",
    dataSource: "cron"
  },
  notes: {
    titleKey: "widget.notes",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(NotesWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 4 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  errors: {
    titleKey: "widget.errors",
    component: ({ data, widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(
      ErrorsWidget,
      {
        logs: data.logs,
        widgetProps,
        onWidgetPropsChange
      }
    ),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: "/logs",
    dataSource: "logs"
  },
  moon: {
    titleKey: "widget.moon",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(MoonWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 2, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  heartbeat: {
    titleKey: "widget.heartbeat",
    component: ({ data, widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(
      HeartbeatWidget,
      {
        status: data.status,
        widgetProps,
        onWidgetPropsChange
      }
    ),
    defaultSize: { gw: 4, gh: 2 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  life: {
    titleKey: "widget.life",
    component: ({ editing }) => /* @__PURE__ */ jsx(LifeWidget, { editing }),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  pomodoro: {
    titleKey: "widget.pomodoro",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(PomodoroWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  countdown: {
    titleKey: "widget.countdown",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(CountdownWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 2 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  calendar: {
    titleKey: "widget.calendar",
    component: ({ gridSize }) => /* @__PURE__ */ jsx(CalendarWidget, { gridSize }),
    defaultSize: { gw: 3, gh: 4 },
    minSize: { gw: 2, gh: 3 },
    navigateTo: null,
    dataSource: null
  },
  board: {
    titleKey: "widget.board",
    component: ({ widgetProps, onWidgetPropsChange, editing }) => /* @__PURE__ */ jsx(BoardWidget, { widgetProps, onWidgetPropsChange, editing }),
    defaultSize: { gw: 4, gh: 4 },
    minSize: { gw: 3, gh: 3 },
    navigateTo: null,
    dataSource: null
  },
  projects: {
    titleKey: "widget.projects",
    component: () => /* @__PURE__ */ jsx(ProjectsWidget, {}),
    defaultSize: { gw: 4, gh: 3 },
    minSize: { gw: 3, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  spend: {
    titleKey: "widget.spend",
    component: ({ widgetProps, onWidgetPropsChange, editing, gridSize }) => /* @__PURE__ */ jsx(
      SpendWidget,
      {
        widgetProps,
        onWidgetPropsChange,
        editing,
        gridSize
      }
    ),
    defaultSize: { gw: 4, gh: 6 },
    minSize: { gw: 3, gh: 3 },
    navigateTo: null,
    dataSource: null
  }
};
const STATE_COPY = {
  offline: "shell.offline",
  unavailable: "shell.unavailable"
};
function WidgetShell({
  title,
  style,
  editing,
  dragging,
  swapTarget,
  trashing,
  state = "ok",
  onRemove,
  onHeaderPointerDown,
  onResizePointerDown,
  onClickThrough,
  children
}) {
  const t2 = useT();
  const stateKey = STATE_COPY[state];
  const cls = [
    "home-widget",
    dragging ? "dragging" : "",
    swapTarget ? "swap-target" : "",
    trashing ? "trashing" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cls,
      style,
      onClick: !editing && onClickThrough ? onClickThrough : void 0,
      role: !editing && onClickThrough ? "link" : void 0,
      children: [
        /* @__PURE__ */ jsx("b", { className: "hd", onPointerDown: editing ? onHeaderPointerDown : void 0, children: /* @__PURE__ */ jsxs("span", { className: "hd-t", children: [
          title,
          state === "stale" && /* @__PURE__ */ jsxs("span", { className: "hd-stale", title: t2("shell.staleTitle"), children: [
            " · ",
            t2("shell.stale")
          ] })
        ] }) }),
        stateKey ? /* @__PURE__ */ jsx("span", { className: `wstate wstate-${state}`, children: t2(stateKey) }) : children,
        editing && onRemove && /* @__PURE__ */ jsx("button", { className: "wremove", onClick: onRemove, "aria-label": t2("shell.remove", { title }), children: "×" }),
        editing && /* @__PURE__ */ jsx("div", { className: "rs", onPointerDown: onResizePointerDown })
      ]
    }
  );
}
function widgetState(source, data) {
  if (source === null) return "ok";
  const failing = data.errors.has(source);
  const has = data[source] != null;
  if (!failing) return has ? "ok" : "loading";
  if (has) return "stale";
  return data.errors.has("status") && data.status == null ? "offline" : "unavailable";
}
const CELL_H = 44;
const MAX_STRETCH = 1.6;
const GAP = 10;
const PAD = 12;
const GridCanvas = forwardRef(function GridCanvas2({ layout, editing, data, onLayoutChange, onRemove, onWidgetPropsChange, fitHeight, trashRef, onTrashActive }, ref) {
  const stageRef = useRef(null);
  const t2 = useT();
  const [stageW, setStageW] = useState(0);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const [adding, setAdding] = useState(null);
  const addRef = useRef(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const layoutRows = layout.widgets.reduce((m, w) => Math.max(m, w.gy + w.gh), 0);
  const cellH = fitCellHeight(fitHeight ?? 0, layoutRows, { base: CELL_H, gap: GAP, pad: PAD, maxStretch: MAX_STRETCH });
  const colW = stageW > 0 ? (stageW - PAD * 2 - GAP * (GRID_COLS - 1)) / GRID_COLS : 0;
  const toPx = (box2) => ({
    left: PAD + box2.gx * (colW + GAP),
    top: PAD + box2.gy * (cellH + GAP),
    width: box2.gw * colW + (box2.gw - 1) * GAP,
    height: box2.gh * cellH + (box2.gh - 1) * GAP
  });
  const pointerOverTrash = (x, y) => {
    const el = trashRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  function startDrag(item, mode, e) {
    if (!editing || colW <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const stageRect = stageRef.current.getBoundingClientRect();
    const startPx = toPx(item);
    const start = { x: e.clientX, y: e.clientY };
    const others = layout.widgets.filter((w) => w.id !== item.id);
    const init = {
      id: item.id,
      mode,
      candidate: { ...item },
      px: startPx,
      swapWith: null,
      moved: /* @__PURE__ */ new Map(),
      overTrash: false
    };
    dragRef.current = init;
    setDrag(init);
    function onMove(ev) {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      const overTrash = mode === "move" && pointerOverTrash(ev.clientX, ev.clientY);
      onTrashActive(overTrash);
      let next;
      if (mode === "resize") {
        const def = WIDGET_REGISTRY[item.id];
        const minW = def?.minSize.gw ?? 2;
        const minH = def?.minSize.gh ?? 1;
        const gw = Math.max(minW, Math.min(
          GRID_COLS - item.gx,
          Math.round((startPx.width + dx + GAP) / (colW + GAP))
        ));
        const gh = Math.max(
          minH,
          Math.round((startPx.height + dy + GAP) / (cellH + GAP))
        );
        const candidate = { gx: item.gx, gy: item.gy, gw, gh };
        next = {
          ...dragRef.current,
          candidate,
          px: {
            ...startPx,
            width: Math.max(70, startPx.width + dx),
            height: Math.max(cellH, startPx.height + dy)
          },
          swapWith: null,
          moved: reflow({ ...candidate }, others),
          overTrash: false
        };
      } else {
        const pos = clampPosition(
          item.gx + dx / (colW + GAP),
          item.gy + dy / (cellH + GAP),
          item.gw,
          item.gh
        );
        const candidate = { ...pos, gw: item.gw, gh: item.gh };
        const pgx = (ev.clientX - stageRect.left - PAD) / (colW + GAP);
        const pgy = (ev.clientY - stageRect.top - PAD) / (cellH + GAP);
        const twin = overTrash ? null : findSwapTarget(pgx, pgy, item, others);
        next = {
          ...dragRef.current,
          candidate,
          px: { ...startPx, left: startPx.left + dx, top: startPx.top + dy },
          swapWith: twin?.id ?? null,
          moved: twin || overTrash ? /* @__PURE__ */ new Map() : reflow({ ...candidate }, others),
          overTrash
        };
      }
      dragRef.current = next;
      setDrag(next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      onTrashActive(false);
      if (!d) return;
      if (d.overTrash) {
        onRemove(d.id);
        return;
      }
      const widgets = layout.widgets.map((w) => ({ ...w }));
      const me = widgets.find((w) => w.id === d.id);
      if (d.swapWith) {
        const twin = widgets.find((w) => w.id === d.swapWith);
        const { gx, gy } = twin;
        twin.gx = me.gx;
        twin.gy = me.gy;
        me.gx = gx;
        me.gy = gy;
      } else {
        me.gx = d.candidate.gx;
        me.gy = d.candidate.gy;
        me.gw = d.candidate.gw;
        me.gh = d.candidate.gh;
        for (const w of widgets) {
          const gy = d.moved.get(w.id);
          if (gy !== void 0) w.gy = gy;
        }
      }
      onLayoutChange({ ...layout, widgets });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  useImperativeHandle(ref, () => ({
    startExternalAdd(id, e) {
      if (colW <= 0) return;
      const def = WIDGET_REGISTRY[id];
      if (!def) return;
      e.preventDefault();
      const { gw, gh } = def.defaultSize;
      const cellFor = (x, y) => {
        const stageRect = stageRef.current.getBoundingClientRect();
        if (x < stageRect.left || x > stageRect.right || y < stageRect.top || y > stageRect.bottom) {
          return null;
        }
        const pos = clampPosition(
          (x - stageRect.left - PAD) / (colW + GAP),
          (y - stageRect.top - PAD) / (cellH + GAP),
          gw
        );
        return { ...pos, gw, gh };
      };
      const startPoint = { x: e.clientX, y: e.clientY };
      const init = {
        id,
        pointer: { x: e.clientX, y: e.clientY },
        candidate: cellFor(e.clientX, e.clientY),
        moved: /* @__PURE__ */ new Map()
      };
      addRef.current = init;
      setAdding(init);
      function onMove(ev) {
        const candidate = cellFor(ev.clientX, ev.clientY);
        const next = {
          id,
          pointer: { x: ev.clientX, y: ev.clientY },
          candidate,
          moved: candidate ? reflow({ ...candidate }, layout.widgets) : /* @__PURE__ */ new Map()
        };
        addRef.current = next;
        setAdding(next);
      }
      function onUp(ev) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const a = addRef.current;
        addRef.current = null;
        setAdding(null);
        if (!a) return;
        const moved = Math.hypot(ev.clientX - startPoint.x, ev.clientY - startPoint.y);
        let cell = a.candidate;
        let pushed = a.moved;
        if (!cell) {
          if (moved > 6) return;
          cell = { ...findFreeSlot(layout.widgets, { gw, gh }), gw, gh };
          pushed = /* @__PURE__ */ new Map();
        }
        const widgets = layout.widgets.map((w) => {
          const gy = pushed.get(w.id);
          return gy !== void 0 ? { ...w, gy } : { ...w };
        });
        widgets.push({ id, gx: cell.gx, gy: cell.gy, gw, gh });
        onLayoutChange({ ...layout, widgets });
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }
  }), [colW, layout, onLayoutChange]);
  const previewMoved = drag?.moved ?? adding?.moved ?? null;
  const maxRow = layout.widgets.reduce(
    (m, w) => Math.max(m, (previewMoved?.get(w.id) ?? w.gy) + w.gh),
    0
  );
  const addRow = adding?.candidate ? adding.candidate.gy + adding.candidate.gh : 0;
  const rows = Math.max(maxRow, addRow);
  const stageH = PAD * 2 + rows * (cellH + GAP) - GAP;
  const ghostBox = drag ? drag.overTrash ? null : drag.swapWith ? { ...layout.widgets.find((w) => w.id === drag.swapWith), gw: drag.candidate.gw, gh: drag.candidate.gh } : drag.candidate : adding?.candidate ?? null;
  const addDef = adding ? WIDGET_REGISTRY[adding.id] : null;
  return /* @__PURE__ */ jsxs("div", { ref: stageRef, className: "home-stage", style: { height: Math.max(stageH, 200) }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        className: `home-ghost${ghostBox ? " visible" : ""}${drag?.swapWith ? " swap" : ""}`,
        style: ghostBox ? toPx(ghostBox) : void 0
      }
    ),
    colW > 0 && layout.widgets.map((item) => {
      const def = WIDGET_REGISTRY[item.id];
      if (!def) return null;
      const isDragged = drag?.id === item.id;
      const isTwinTarget = drag?.swapWith === item.id;
      let box2 = item;
      if (!isDragged) {
        if (isTwinTarget && drag) {
          const origin = layout.widgets.find((w) => w.id === drag.id);
          box2 = { ...item, gx: origin.gx, gy: origin.gy };
        } else {
          const gy = previewMoved?.get(item.id);
          if (gy !== void 0) box2 = { ...item, gy };
        }
      }
      const style = isDragged && drag ? drag.px : toPx(box2);
      const Component = def.component;
      return /* @__PURE__ */ jsx(
        WidgetShell,
        {
          title: t2(def.titleKey),
          style,
          editing,
          dragging: isDragged,
          swapTarget: isTwinTarget,
          trashing: isDragged && drag?.overTrash,
          state: widgetState(def.dataSource, data),
          onRemove: () => onRemove(item.id),
          onHeaderPointerDown: (e) => startDrag(item, "move", e),
          onResizePointerDown: (e) => startDrag(item, "resize", e),
          onClickThrough: def.navigateTo ? () => navigateTo(def.navigateTo) : void 0,
          children: /* @__PURE__ */ jsx(
            Component,
            {
              data,
              widgetProps: item.props ?? {},
              onWidgetPropsChange: (p) => onWidgetPropsChange(item.id, p),
              editing,
              gridSize: { gw: box2.gw, gh: box2.gh }
            }
          )
        },
        item.id
      );
    }),
    adding && addDef && /* @__PURE__ */ jsxs(
      "div",
      {
        className: "home-add-ghost",
        style: { left: adding.pointer.x, top: adding.pointer.y },
        children: [
          "+ ",
          t2(addDef.titleKey)
        ]
      }
    )
  ] });
});
function WidgetCatalog({ layout, onChipPointerDown }) {
  const t2 = useT();
  const placed = new Set(layout.widgets.map((w) => w.id));
  const available = Object.entries(WIDGET_REGISTRY).filter(([id]) => !placed.has(id));
  return /* @__PURE__ */ jsx("div", { className: "home-catalog", children: /* @__PURE__ */ jsxs("div", { className: "home-catalog-inner", children: [
    /* @__PURE__ */ jsx("span", { className: "home-catalog-hint", children: t2("catalog.hint") }),
    available.map(([id, def]) => /* @__PURE__ */ jsxs(
      "button",
      {
        className: "home-catalog-chip",
        onPointerDown: (e) => onChipPointerDown(id, e),
        children: [
          "+ ",
          t2(def.titleKey)
        ]
      },
      id
    ))
  ] }) });
}
const POLL_MS = 1e4;
const REQUEST_TIMEOUT_MS = 15e3;
const SOURCES = {
  status: () => api.getStatus(),
  system: () => api.getSystemStats(),
  analytics: () => api.getAnalytics(1),
  cron: () => api.getCronJobs(),
  sessions: () => api.getSessions(20),
  logs: () => api.getLogs({ lines: 50, level: "ERROR" })
};
function useHomeData() {
  const [data, setData] = useState({
    status: null,
    system: null,
    analytics: null,
    cron: null,
    sessions: null,
    logs: null,
    errors: /* @__PURE__ */ new Set()
  });
  const timer = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const inflight = /* @__PURE__ */ new Set();
    const keys = Object.keys(SOURCES);
    const fetchOne = (key) => {
      if (inflight.has(key)) return;
      inflight.add(key);
      withTimeout(() => SOURCES[key](), REQUEST_TIMEOUT_MS).then(
        (value) => {
          inflight.delete(key);
          if (cancelled) return;
          const shown = demoOn() ? demoSource(key, value, Date.now()) : value;
          setData((prev) => {
            const errors = new Set(prev.errors);
            errors.delete(key);
            return { ...prev, [key]: shown, errors };
          });
        },
        () => {
          inflight.delete(key);
          if (cancelled) return;
          setData((prev) => prev.errors.has(key) ? prev : { ...prev, errors: new Set(prev.errors).add(key) });
        }
      );
    };
    const poll = (first = false) => {
      if (document.hidden && !first) return;
      keys.forEach(fetchOne);
    };
    poll(true);
    timer.current = setInterval(() => poll(), POLL_MS);
    const onVis = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return data;
}
const LAYOUT_VERSION = 1;
const DEFAULT_LAYOUT = {
  version: LAYOUT_VERSION,
  widgets: [
    { id: "ascii", gx: 0, gy: 0, gw: 3, gh: 6 },
    { id: "clock", gx: 3, gy: 0, gw: 5, gh: 3 },
    { id: "gateway", gx: 8, gy: 0, gw: 4, gh: 3 },
    { id: "tokens", gx: 3, gy: 3, gw: 5, gh: 4 },
    { id: "host", gx: 8, gy: 3, gw: 4, gh: 4 },
    { id: "matrix", gx: 0, gy: 6, gw: 3, gh: 4 },
    { id: "sessions", gx: 3, gy: 7, gw: 3, gh: 3 },
    { id: "cron", gx: 6, gy: 7, gw: 3, gh: 3 },
    { id: "errors", gx: 9, gy: 7, gw: 3, gh: 3 }
  ]
};
function isValidWidget(w) {
  if (typeof w !== "object" || w === null) return false;
  const o = w;
  return typeof o.id === "string" && [o.gx, o.gy, o.gw, o.gh].every((n) => typeof n === "number" && Number.isFinite(n));
}
function parseLayout(raw, known) {
  if (typeof raw !== "object" || raw === null) return DEFAULT_LAYOUT;
  const o = raw;
  if (o.version !== LAYOUT_VERSION || !Array.isArray(o.widgets)) return DEFAULT_LAYOUT;
  const valid = o.widgets.filter(isValidWidget);
  if (!known) return { version: LAYOUT_VERSION, widgets: valid };
  let hasBoard = valid.some((w) => w.id === "board");
  const widgets = [];
  for (const w of valid) {
    if (w.id === "agent" && known.has("board") && !hasBoard) {
      hasBoard = true;
      widgets.push({ id: "board", gx: w.gx, gy: w.gy, gw: w.gw, gh: w.gh });
    } else if (known.has(w.id)) {
      widgets.push(w);
    }
  }
  return { version: LAYOUT_VERSION, widgets };
}
const KNOWN_WIDGETS = new Set(Object.keys(WIDGET_REGISTRY));
const EDITBAR_RESERVE = 100;
const LAYOUT_URL = "/api/plugins/home-dashboard/layout";
function loadLayout() {
  return fetchJSON(LAYOUT_URL).then((r) => r.layout == null ? DEFAULT_LAYOUT : parseLayout(r.layout, KNOWN_WIDGETS)).catch(() => DEFAULT_LAYOUT);
}
function saveLayout(layout) {
  return fetchJSON(LAYOUT_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout })
  });
}
function HomePage() {
  const boardRoute = useBoardRoute();
  const dashboardLocale = useDashboardLocale();
  useEffect(() => {
    if (dashboardLocale !== null) setHostLanguage(dashboardLocale);
  }, [dashboardLocale]);
  if (boardRoute !== void 0) {
    return /* @__PURE__ */ jsx("div", { className: "home-board-page", children: /* @__PURE__ */ jsx(BoardApp, { route: boardRoute, onHome: () => {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
      notifyBoardRoute();
    } }) });
  }
  return /* @__PURE__ */ jsx(HomeGrid, {});
}
function HomeGrid() {
  const [layout, setLayout] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const [toast, setToast] = useState(null);
  const rootRef = useRef(null);
  const catalogRef = useRef(null);
  const gridRef = useRef(null);
  const dirty = useRef(false);
  const toastTimer = useRef(null);
  const data = useHomeData();
  const dashboardLocale = useDashboardLocale();
  useEffect(() => {
    if (dashboardLocale !== null) setHostLanguage(dashboardLocale);
  }, [dashboardLocale]);
  const t2 = useT();
  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4e3);
  }, []);
  const [viewH, setViewH] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setViewH(Math.max(0, el.clientHeight - EDITBAR_RESERVE));
    measure();
    const RO = globalThis.ResizeObserver;
    const ro = RO ? new RO(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [layout !== null]);
  const recomputeShowEdit = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight - el.clientHeight > 24;
    setShowEdit(!canScroll || el.scrollTop > 16);
  }, []);
  useEffect(() => {
    loadLayout().then(setLayout);
  }, []);
  useEffect(() => {
    recomputeShowEdit();
  }, [layout, editing, recomputeShowEdit]);
  const update = useCallback((next) => {
    dirty.current = true;
    setLayout(next);
  }, []);
  const saveTimer = useRef(null);
  const updateWidgetProps = useCallback(
    (id, props) => {
      setLayout((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          widgets: prev.widgets.map((w) => w.id === id ? { ...w, props } : w)
        };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveLayout(next).then(
            () => {
              dirty.current = false;
            },
            () => showToast(t2("home.saveFailed"))
          );
        }, 800);
        dirty.current = true;
        return next;
      });
    },
    [showToast, t2]
  );
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const toggleEditing = useCallback(async () => {
    if (editing && dirty.current && layout) {
      try {
        await saveLayout(layout);
        dirty.current = false;
      } catch {
        showToast(t2("home.saveFailed"));
      }
    }
    setEditing((e) => !e);
  }, [editing, layout, showToast, t2]);
  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => {
      if (e.key === "Escape") void toggleEditing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, toggleEditing]);
  if (!layout) return null;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: rootRef,
      className: `home-root${editing ? " editing" : ""}`,
      onScroll: recomputeShowEdit,
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: catalogRef,
            className: `home-catalog-wrap${editing ? " open" : ""}${overTrash ? " trash-active" : ""}`,
            "aria-hidden": !editing,
            children: /* @__PURE__ */ jsx(
              WidgetCatalog,
              {
                layout,
                onChipPointerDown: (id, e) => gridRef.current?.startExternalAdd(id, e)
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          GridCanvas,
          {
            ref: gridRef,
            layout,
            editing,
            data,
            onLayoutChange: update,
            onRemove: (id) => update({ ...layout, widgets: layout.widgets.filter((w) => w.id !== id) }),
            onWidgetPropsChange: updateWidgetProps,
            fitHeight: viewH,
            trashRef: catalogRef,
            onTrashActive: setOverTrash
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: `home-editbar${editing || showEdit ? " visible" : ""}`, children: [
          editing && /* @__PURE__ */ jsx(
            "button",
            {
              className: "home-fab home-fab-enter",
              onClick: () => update(DEFAULT_LAYOUT),
              title: t2("home.restoreDefault"),
              "aria-label": t2("home.restoreDefault"),
              children: /* @__PURE__ */ jsx("span", { className: "home-fab-spin", children: /* @__PURE__ */ jsx(Icon, { name: "reset", size: 16 }) })
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              className: `home-fab${editing ? " active" : ""}`,
              onClick: () => void toggleEditing(),
              title: editing ? t2("home.doneEditing") : t2("home.editLayout"),
              "aria-label": editing ? t2("home.doneEditing") : t2("home.editLayout"),
              children: [
                /* @__PURE__ */ jsx("span", { className: "home-fab-ico ico-edit", "aria-hidden": "true", children: /* @__PURE__ */ jsx(Icon, { name: "edit", size: 16 }) }),
                /* @__PURE__ */ jsx("span", { className: "home-fab-ico ico-done", "aria-hidden": "true", children: /* @__PURE__ */ jsx(Icon, { name: "check", size: 16 }) })
              ]
            }
          )
        ] }),
        toast && /* @__PURE__ */ jsx("div", { className: "home-toast", role: "status", children: toast })
      ]
    }
  );
}
const homeCss = "/* Home page — rice-style widget grid.\n * Every color routes through --home-accent (the active theme's primary),\n * so switching themes recolors the whole page with zero widget changes.\n * Swap teal (#2dd4bf) stays fixed: it is interaction semantics, not theme. */\n\n.home-root {\n  --home-accent: var(--color-primary, var(--ui-accent, #ffd700));\n  --home-accent-dim: color-mix(in srgb, var(--home-accent) 55%, #000);\n  /* Readable secondary text (headers, captions): dim was ~3:1 on the glass. */\n  --home-accent-soft: color-mix(in srgb, var(--home-accent) 82%, #9aa3b5);\n  --home-surface: color-mix(\n    in srgb,\n    var(--home-accent) 6%,\n    var(--ui-editor-surface-background, rgb(10 10 14 / 0.55))\n  );\n  --home-border: color-mix(in srgb, var(--home-accent) 18%, transparent);\n  --home-error: var(--color-destructive, #e25555);\n  position: relative;\n  height: 100%;\n  overflow: auto;\n  font-family: var(--theme-font-mono, ui-monospace, monospace);\n  color: var(--color-foreground, var(--ui-text-primary, #d8dce6));\n}\n\n.home-stage {\n  position: relative;\n  min-height: 60vh;\n  touch-action: none;\n}\n\n.home-widget {\n  position: absolute;\n  border-radius: 8px;\n  padding: 10px 12px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);\n  overflow: hidden;\n  transition: left 0.18s ease, top 0.18s ease;\n  container-type: size;\n  font-size: 11px;\n  line-height: 1.5;\n  /* Promote each widget to its own compositor layer so the constantly\n   * repainting matrix canvas doesn't force the neighbours' backdrop-filter\n   * to recompose every frame — that recomposition is what produced the\n   * horizontal flicker sweeping across the glass panels. */\n  transform: translateZ(0);\n  contain: paint;\n}\n.home-root.editing .home-widget { user-select: none; }\n.home-widget.dragging {\n  transition: none;\n  opacity: 0.9;\n  border-color: var(--home-accent);\n  z-index: 50;\n  cursor: grabbing;\n}\n.home-widget.swap-target {\n  border-color: #2dd4bf;\n  box-shadow: 0 0 0 1px rgb(45 212 191 / 0.5), 0 10px 30px rgb(0 0 0 / 0.5);\n}\n/* Over the trash zone — about to be deleted. */\n.home-widget.trashing {\n  opacity: 0.45;\n  border-color: var(--home-error);\n  box-shadow: 0 0 0 1px color-mix(in srgb, var(--home-error) 60%, transparent),\n    0 10px 30px rgb(0 0 0 / 0.5);\n}\n\n/* Floating label that follows the pointer while dragging a new widget in. */\n.home-add-ghost {\n  position: fixed;\n  z-index: 70;\n  transform: translate(-50%, -140%);\n  padding: 4px 10px;\n  border-radius: 6px;\n  font-size: 11px;\n  white-space: nowrap;\n  pointer-events: none;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-accent);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n}\n\n/* Header: short lead rule · TITLE · hairline that fades out. Drawn with CSS\n * (not box-drawing glyphs) so the gaps stay even and the rule never touches\n * the text, whatever the font or title length. */\n.home-widget .hd {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 16px;\n  font-size: 9.5px;\n  letter-spacing: 0.18em;\n  margin-bottom: 8px;\n  font-weight: 700;\n  text-transform: uppercase;\n  color: var(--home-accent-soft);\n  white-space: nowrap;\n  overflow: hidden;\n}\n.home-widget .hd .hd-t { flex: none; }\n.home-widget .hd::before,\n.home-widget .hd::after {\n  content: \"\";\n  height: 1px;\n  flex: none;\n}\n.home-widget .hd::before {\n  width: 12px;\n  background: currentColor;\n  opacity: 0.45;\n}\n.home-widget .hd::after {\n  flex: 1 1 auto;\n  min-width: 0;\n  background: linear-gradient(to right, currentColor, transparent 92%);\n  opacity: 0.28;\n}\n.home-root.editing .home-widget .hd { cursor: grab; }\n\n.home-widget .rs {\n  position: absolute;\n  right: 2px;\n  bottom: 2px;\n  width: 13px;\n  height: 13px;\n  cursor: nwse-resize;\n  border-right: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-bottom: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-radius: 2px;\n  z-index: 3;\n}\n.home-widget .wremove {\n  position: absolute;\n  top: 4px;\n  right: 6px;\n  z-index: 3;\n  background: none;\n  border: none;\n  color: var(--home-error);\n  font-size: 13px;\n  line-height: 1;\n  cursor: pointer;\n  padding: 2px 4px;\n}\n.home-widget .werr { color: var(--home-error); }\n/* Data-source states (widget-state.ts): honest copy per failure kind. */\n.home-widget .wstate { display: block; font-size: 10px; letter-spacing: 0.04em; }\n.home-widget .wstate::before { content: \"● \"; }\n.home-widget .wstate-offline { color: var(--home-error); }\n.home-widget .wstate-unavailable { color: #f5b945; }\n.home-widget .hd .hd-stale { color: #f5b945; letter-spacing: 0.1em; opacity: 0.8; }\n\n/* ── hover controls (contextual chrome, rest mode only) ──\n * Reusable floating control rendered inside a widget body. Hidden by default,\n * fades in while hovering the widget, and fully suppressed in edit mode so it\n * never fights drag/resize. Widgets opt in by rendering <HoverCtl>/<HoverArrows>. */\n.hover-ctl {\n  /* Sits IN the header row: same top as the widget padding, same height as .hd,\n   * right-aligned at the end of the header rule. No chip: bare glyphs, like the rest. */\n  position: absolute;\n  top: 10px;\n  right: 12px;\n  height: 16px;\n  z-index: 4;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  white-space: nowrap;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.16s ease;\n}\n/* Visible only while the pointer is over the widget. Keyboard users still get them\n * (:focus-visible), but a mouse click no longer leaves them stuck on screen. */\n.home-widget:hover .hover-ctl,\n.hover-ctl:has(:focus-visible) { opacity: 1; pointer-events: auto; }\n/* While the controls show, the header rule stops short of them... */\n.home-widget:hover .hd::after,\n.home-widget:has(.hover-ctl :focus-visible) .hd::after {\n  margin-right: calc(var(--ctl-w, 0px) + 10px);\n}\n/* ...and when the widget is too narrow for title + controls, the title steps aside. */\n.home-widget[data-ctl-tight]:hover .hd .hd-t,\n.home-widget[data-ctl-tight]:hover .hd::before { opacity: 0; }\n.home-widget .hd .hd-t,\n.home-widget .hd::before,\n.home-widget .hd::after { transition: opacity 0.16s ease, margin-right 0.16s ease; }\n/* Multi-row controls (Pomodoro steppers) don't fit the header: they sit below it. */\n.hover-ctl.pomo-set { top: 30px; height: auto; }\n.home-root.editing .hover-ctl { display: none; }\n@media (hover: none) {\n  /* Touch: no hover, so keep controls reachable but understated. */\n  .hover-ctl { opacity: 0.5; pointer-events: auto; }\n}\n\n.hv-arrow {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0 3px;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  font-family: inherit;\n}\n.hv-arrow:hover:not(:disabled) { color: var(--home-accent); }\n.hv-arrow:disabled { opacity: 0.3; cursor: default; }\n.hv-label {\n  font-size: 9px;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  white-space: nowrap;\n}\n.hv-label-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  letter-spacing: 0.1em;\n  padding: 0;\n}\n.hv-label-btn:hover { color: var(--home-accent); }\n\n/* Toggle/option buttons inside a hover control (clock format, host view…). */\n.hv-opt {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  font-size: 9px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  padding: 0 4px;\n  border-radius: 4px;\n}\n.hv-opt:hover { color: var(--home-accent); }\n.hv-opt.on { color: #000; background: var(--home-accent); }\n\n/* Extra detail that smoothly expands on widget hover (rest mode only). Uses\n * the 0fr→1fr grid trick so it animates real height without a fixed value. */\n.hover-reveal {\n  display: grid;\n  grid-template-rows: 0fr;\n  opacity: 0;\n  transition: grid-template-rows 0.25s ease, opacity 0.2s ease, margin-top 0.25s ease;\n}\n.home-widget:hover .hover-reveal { grid-template-rows: 1fr; opacity: 1; margin-top: 4px; }\n.home-root.editing .hover-reveal { grid-template-rows: 0fr; opacity: 0; margin-top: 0; }\n.hover-reveal > * { overflow: hidden; min-height: 0; }\n\n.home-ghost {\n  position: absolute;\n  border: 1.5px dashed color-mix(in srgb, var(--home-accent) 70%, transparent);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--home-accent) 7%, transparent);\n  display: none;\n  z-index: 5;\n  pointer-events: none;\n  transition: left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease;\n}\n.home-ghost.visible { display: block; }\n.home-ghost.swap {\n  border-color: rgb(45 212 191 / 0.85);\n  background: rgb(45 212 191 / 0.08);\n}\n\n/* ── widget content primitives (responsive to the widget's own size) ── */\n.home-widget .rows { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .rows { columns: 2; column-rule: 1px solid rgb(255 255 255 / 0.06); }\n}\n@container (min-width: 600px) {\n  .home-widget .rows { columns: 3; }\n}\n.home-widget .row {\n  display: flex;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  break-inside: avoid;\n}\n.home-widget .row:last-child { border-bottom: none; }\n/* Names flex and ellipsize at the real column width instead of a fixed\n * character slice that cut words mid-glyph (\"bitacoras-guayab\"). */\n.home-widget .row > * { flex: none; }\n.home-widget .row > .row-name {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.home-widget .meters { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .meters { columns: 2; }\n}\n.home-widget .meter {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin: 3px 0;\n  break-inside: avoid;\n}\n.home-widget .meter .lbl { width: 34px; color: var(--color-muted-foreground, #7d8496); font-size: 10px; }\n.home-widget .meter .track {\n  flex: 1;\n  height: 7px;\n  border-radius: 2px;\n  background: rgb(255 255 255 / 0.07);\n  overflow: hidden;\n}\n.home-widget .meter .fill {\n  height: 100%;\n  background: linear-gradient(90deg, var(--home-accent-dim), var(--home-accent));\n  transition: width 0.6s ease;\n}\n.home-widget .meter .val { width: 44px; text-align: right; font-size: 10px; }\n\n.home-widget .ok { color: var(--home-accent); }\n.home-widget .dim { color: var(--color-muted-foreground, #6b7387); }\n.home-widget .bigval {\n  font-size: min(9cqw, 18cqh);\n  font-weight: 700;\n  color: var(--home-accent);\n}\n\n.home-clock-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n.home-clock {\n  font-size: min(26cqw, 52cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  letter-spacing: 0.02em;\n  text-shadow: 0 0 24px color-mix(in srgb, var(--home-accent) 35%, transparent);\n  line-height: 1;\n}\n.home-clock-ampm {\n  font-size: 0.32em;\n  vertical-align: 0.9em;\n  margin-left: 0.2em;\n  letter-spacing: 0.05em;\n  color: var(--home-accent-dim);\n}\n.home-clock-sub {\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.4cqw, 8cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-top: 1cqh;\n}\n\n.home-ascii-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n/* The emblem slot takes the room left by the version line; the canvas is laid over it\n * absolutely, so painting never feeds back into layout (no shift on resize). */\n.home-emblem {\n  position: relative;\n  flex: 1;\n  min-height: 0;\n  align-self: stretch;\n  color: var(--home-accent);\n}\n.home-emblem canvas {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--home-accent) 25%, transparent));\n}\n/* Fallback when canvas is unavailable: the official caduceus as braille text. */\n.home-ascii {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  font-size: min(5.6cqw, 5.4cqh);\n  line-height: 1.05;\n  white-space: pre;\n  text-align: center;\n  color: var(--home-accent);\n}\n.home-ascii-ver {\n  text-align: center;\n  color: var(--home-accent-soft);\n  font-size: max(8px, min(2.6cqw, 5cqh));\n  letter-spacing: 0.22em;\n  margin-top: 1.5cqh;\n  flex: none;\n}\n\n.home-spark {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n}\n.home-spark i {\n  flex: 1;\n  background: linear-gradient(180deg, var(--home-accent), var(--home-accent-dim));\n  border-radius: 1px 1px 0 0;\n  opacity: 0.85;\n  transition: height 0.6s ease, opacity 0.15s ease;\n  cursor: default;\n}\n.home-spark i:hover { opacity: 1; }\n\n/* Hover tooltip over a bar (tokens widget). Anchored to the bar via inline\n * `left` + `translateX`, which clamps it inside the clipped widget; the appear/\n * disappear slide+fade runs on the independent `translate` property so it never\n * fights the positioning transform. */\n.home-spark-wrap { position: relative; }\n.home-spark-tip {\n  position: absolute;\n  bottom: 100%;\n  margin-bottom: 6px;\n  padding: 3px 7px;\n  border-radius: 6px;\n  background: color-mix(in srgb, var(--home-accent) 10%, rgb(8 8 12 / 0.96));\n  border: 1px solid var(--home-border);\n  color: rgb(236 236 242);\n  font-size: 10px;\n  line-height: 1.3;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  translate: 0 4px;\n  transition: opacity 0.18s ease, translate 0.18s ease, transform 0.18s ease;\n  z-index: 6;\n}\n.home-spark-tip.show { opacity: 1; translate: 0 0; }\n.home-spark-tip b { color: var(--home-accent); font-weight: 600; }\n\n/* Line/area chart (tokens widget, alternative to the bars). Stretched to fill\n * via preserveAspectRatio=none; the stroke stays crisp with non-scaling-stroke. */\n.home-area {\n  display: block;\n  width: 100%;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n  overflow: visible;\n}\n.home-area rect { cursor: default; }\n\n/* Host graphs view: four live sparklines (cpu / ram / load / proc) in a 2×2\n * grid over a rolling one-minute window. Fills the widget below the header\n * (same absolute pattern as the canvas widgets); cells reuse .home-area but\n * stretch to their cell height instead of the tokens widget's fixed band. */\n.host-sparks {\n  position: absolute;\n  inset: 30px 12px 10px;\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  grid-template-rows: 1fr 1fr;\n  gap: 4px 12px;\n  min-height: 0;\n}\n.host-spark {\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  min-width: 0;\n}\n.host-spark-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  font-size: max(8px, min(3.2cqw, 6cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n.host-spark-head .val {\n  font-variant-numeric: tabular-nums;\n  color: var(--home-accent);\n}\n.host-spark .home-area {\n  flex: 1;\n  height: auto;\n  min-height: 12px;\n  margin: 2px 0 0;\n}\n\n/* Small vertical divider between the range arrows and the toggles. */\n.tok-div {\n  width: 1px;\n  align-self: stretch;\n  margin: 2px 2px;\n  background: var(--home-border);\n}\n\n/* Totals line, regrouped: each label sticks to its value, groups spaced evenly\n * (the old `.row` space-between scattered the six tokens across the full width). */\n.tok-stats {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 2px 14px;\n  padding: 3px 0 1px;\n  font-variant-numeric: tabular-nums;\n}\n.tok-stats > span { white-space: nowrap; }\n.tok-stats .dim { margin-right: 2px; }\n\n/* Grouped usage (tokens widget, by provider / by model): one row per group\n * with a faint share bar behind it, width = --share of the grouped total. */\n.tok-groups { padding-top: 3px; font-variant-numeric: tabular-nums; }\n.home-widget .row.tok-group {\n  background: linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--home-accent) 16%, transparent) var(--share, 0%),\n    transparent var(--share, 0%)\n  );\n  border-radius: 2px;\n  padding-left: 3px;\n}\n.tok-share { min-width: 3ch; text-align: right; }\n.tok-group-note,\n.tok-group-more { font-size: 9.5px; padding-top: 1px; }\n\n/* ── spend widget ── */\n.home-spend { font-variant-numeric: tabular-nums; }\n.spend-head { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.spend-est {\n  margin-left: 6px;\n  padding: 0 4px;\n  border: 1px solid var(--home-border);\n  border-radius: 3px;\n  font-size: 9px;\n  letter-spacing: 0.06em;\n  color: var(--color-muted-foreground, #6b7387);\n  vertical-align: 2px;\n}\n.spend-providers { padding-top: 2px; }\n.spend-covered {\n  margin-top: 4px;\n  padding: 2px 0 2px 6px;\n  border-left: 2px solid color-mix(in srgb, var(--home-accent) 35%, transparent);\n  color: var(--home-accent-soft, var(--home-accent));\n}\n.spend-covered > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.spend-month {\n  margin-top: 4px;\n  padding-top: 3px;\n  border-top: 1px solid rgb(255 255 255 / 0.06);\n}\n.spend-month .spend-flag { white-space: nowrap; }\n.spend-top-head {\n  font-size: 9.5px;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  padding: 2px 0 1px;\n}\n.spend-month.spend-near .spend-flag,\n.spend-month.spend-pace .spend-flag { color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.spend-month.spend-over,\n.spend-month.spend-over .spend-flag { color: var(--home-error); }\n.spend-top { margin-top: 3px; }\n.home-widget .row.spend-session { cursor: pointer; border-radius: 2px; }\n.home-widget .row.spend-session:hover { background: color-mix(in srgb, var(--home-accent) 10%, transparent); }\n.home-widget .row.spend-session:hover .row-name { color: var(--home-accent); }\n.home-root.editing .home-widget .row.spend-session { cursor: inherit; }\n.spend-tag {\n  font-size: 9px;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  color: var(--color-muted-foreground, #6b7387);\n  align-self: center;\n}\n.spend-tag-metered { color: var(--home-accent); }\n.spend-cost { min-width: 6ch; text-align: right; }\n.spend-foot { display: flex; flex-wrap: wrap; gap: 0 10px; font-size: 9.5px; padding-top: 2px; }\n.spend-cap-val { min-width: 4ch; text-align: center; color: var(--home-accent); }\n\n/* Sessions widget: per-row token count (shown while sorting/filtering by it). */\n.ses-tok { font-variant-numeric: tabular-nums; color: var(--home-accent-soft); }\n\n/* ── logs widget (per-file record list) ── */\n.logs-sub {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 8px;\n}\n.logs-file {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  color: var(--home-accent);\n}\n/* The wrapper owns the widget's remaining height so the list scrolls inside it\n * instead of growing past the bottom edge (the old calc() resolved against an\n * auto-height parent and never clamped). */\n.home-logs-wrap {\n  display: flex;\n  flex-direction: column;\n  height: calc(100% - 21px);\n  min-height: 0;\n}\n.home-logs {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  flex: 1 1 0;\n  min-height: 0;\n  overflow-y: auto;\n  margin-top: 3px;\n  /* Rows that don't fit fade out instead of being sliced by the edge. */\n  mask-image: linear-gradient(180deg, #000 calc(100% - 14px), transparent);\n}\n.log-row {\n  display: flex;\n  gap: 6px;\n  align-items: baseline;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  cursor: default;\n}\n.log-row:last-child { border-bottom: none; }\n.log-lvl {\n  flex: none;\n  width: 32px;\n  font-size: 9px;\n  font-weight: 600;\n  letter-spacing: 0.03em;\n}\n.log-lvl.lvl-error { color: var(--home-error); }\n.log-lvl.lvl-warn { color: #f5b945; }\n.log-lvl.lvl-info { color: var(--color-muted-foreground, #6b7387); }\n.log-time {\n  flex: none;\n  font-size: 9px;\n  color: var(--color-muted-foreground, #6b7387);\n  font-variant-numeric: tabular-nums;\n}\n.log-msg {\n  flex: 1;\n  min-width: 0;\n  font-size: 10px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.home-matrix-c {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n\n/* ── notes widget ── */\n.home-notes { display: flex; flex-direction: column; gap: 1px; height: calc(100% - 18px); overflow-y: auto; }\n.home-notes .note-row {\n  display: flex;\n  align-items: baseline;\n  gap: 7px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n}\n.home-notes .note-mark {\n  cursor: pointer;\n  width: 12px;\n  text-align: center;\n  color: var(--home-accent);\n  flex-shrink: 0;\n}\n.home-notes .note-mark.done { color: var(--color-muted-foreground, #6b7387); }\n.home-notes .note-text { cursor: text; flex: 1; min-width: 0; overflow-wrap: anywhere; }\n.home-notes .note-text.done {\n  text-decoration: line-through;\n  color: var(--color-muted-foreground, #6b7387);\n}\n.home-notes .note-input {\n  flex: 1;\n  min-width: 0;\n  background: none;\n  border: none;\n  border-bottom: 1px dashed var(--home-border);\n  outline: none;\n  color: inherit;\n  font: inherit;\n  padding: 0;\n}\n.home-notes .note-add {\n  align-self: flex-start;\n  margin-top: 4px;\n  background: none;\n  border: none;\n  cursor: pointer;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  padding: 2px 6px 2px 2px;\n}\n.home-notes .note-add:hover { color: var(--home-accent); }\n\n/* ── canvas widgets (heartbeat, life) ── */\n.home-canvas {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n/* Life is drawable in rest mode — signal it with a crosshair. */\n.home-root:not(.editing) .home-life { cursor: crosshair; }\n\n/* ── moon ── */\n.home-moon-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  height: calc(100% - 18px);\n}\n.home-moon-c { flex: 1; width: 100%; min-height: 0; }\n.home-moon-label {\n  color: var(--home-accent-dim);\n  font-size: max(8px, min(3cqw, 6cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n\n/* ── pomodoro / countdown ── */\n.home-pomo .home-clock,\n.home-count .home-clock { cursor: pointer; }\n.home-pomo .home-clock.paused { opacity: 0.55; }\n.home-pomo .pomo-sub { cursor: pointer; }\n.home-count .count-label { cursor: pointer; }\n.home-count .count-input,\n.home-pomo .count-input { max-width: 92%; text-align: center; color-scheme: dark; }\n\n/* ── countdown segment editor (alarm-style spinners) ── */\n.count-edit {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 3px;\n  height: calc(100% - 18px);\n}\n.count-edit-row { display: flex; align-items: center; gap: 5px; }\n.count-seg { display: flex; flex-direction: column; align-items: center; }\n.count-seg .seg-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0;\n  line-height: 0.6;\n  font-size: 8px;\n  color: var(--home-accent-dim);\n}\n.count-seg .seg-btn:hover { color: var(--home-accent); }\n.count-seg .seg-val {\n  background: none;\n  border: none;\n  outline: none;\n  text-align: center;\n  color: var(--home-accent);\n  font: inherit;\n  font-weight: 800;\n  font-size: max(12px, min(7cqw, 15cqh));\n  padding: 1px 0;\n  border-bottom: 1px solid transparent;\n  letter-spacing: 0.02em;\n}\n.count-seg input.seg-val:focus { border-bottom-color: var(--home-accent); }\n.count-seg .seg-static { cursor: default; }\n.count-colon {\n  font-weight: 800;\n  color: var(--home-accent-dim);\n  font-size: max(12px, min(7cqw, 15cqh));\n}\n.count-done {\n  margin-top: 3px;\n  background: none;\n  border: 1px solid var(--home-border);\n  border-radius: 6px;\n  color: var(--home-accent);\n  cursor: pointer;\n  font: inherit;\n  font-size: 10px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  padding: 2px 12px;\n}\n.count-done:hover { border-color: var(--home-accent); }\n.home-pomo .pomo-min {\n  font-size: min(20cqw, 40cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  max-width: 70%;\n}\n/* Hover steppers for the pomodoro work/break lengths. */\n.hover-ctl.pomo-set { flex-direction: column; align-items: flex-end; gap: 1px; }\n.pomo-stepper { display: flex; align-items: center; gap: 3px; }\n.pomo-stepper .hv-label:nth-child(3) { min-width: 16px; text-align: center; color: var(--home-accent); }\n\n/* ── calendar ── */\n.home-cal { height: calc(100% - 18px); display: flex; flex-direction: column; }\n.home-cal-month {\n  text-align: center;\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.2cqw, 7cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-bottom: 4px;\n}\n.home-cal-grid {\n  flex: 1;\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  align-content: space-evenly;\n  justify-items: center;\n  font-size: max(8px, min(3cqw, 6.5cqh));\n}\n.home-cal-h { color: var(--color-muted-foreground, #6b7387); }\n.home-cal-d { color: var(--color-foreground, #d8dce6); opacity: 0.75; }\n.home-cal-today {\n  color: #000;\n  background: var(--home-accent);\n  border-radius: 4px;\n  padding: 0 4px;\n  font-weight: 700;\n}\n/* Density tiers, chosen from the widget's cell width (see CalendarWidget). */\n.home-cal.tier-mini .home-cal-month {\n  font-size: max(8px, min(4cqw, 8cqh));\n  margin-bottom: 2px;\n}\n.home-cal.tier-mini .home-cal-grid { font-size: max(9px, min(4cqw, 8cqh)); }\n.home-cal.tier-large .home-cal-month {\n  font-size: max(11px, min(3cqw, 7cqh));\n  margin-bottom: 7px;\n}\n.home-cal.tier-large .home-cal-grid { row-gap: 3px; }\n.home-cal.tier-large .home-cal-h { font-weight: 700; opacity: 0.8; }\n.home-cal.tier-large .home-cal-today { padding: 1px 6px; }\n\n/* ── page chrome ── */\n/* Edit affordance lives BELOW the grid, centered. It fades in once the user\n * starts scrolling down (or immediately when the grid is short enough that\n * there's nothing to scroll), keeping the home clean on first paint. While\n * editing it sticks to the bottom of the viewport so it stays reachable. */\n.home-editbar {\n  display: flex;\n  justify-content: center;\n  gap: 10px;\n  padding: 22px 12px 30px;\n  opacity: 0;\n  transition: opacity 0.25s ease;\n  pointer-events: none;\n}\n.home-editbar.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n.home-root.editing .home-editbar {\n  position: sticky;\n  bottom: 0;\n}\n.home-fab {\n  position: relative;\n  width: 38px;\n  height: 38px;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 15px;\n  cursor: pointer;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition:\n    border-color 0.25s ease,\n    background 0.35s ease,\n    box-shadow 0.45s ease,\n    transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n.home-fab:hover {\n  border-color: var(--home-accent);\n  transform: scale(1.06);\n}\n.home-fab:active { transform: scale(0.94); }\n.home-fab.active {\n  background: color-mix(in srgb, var(--home-accent) 22%, transparent);\n  /* Warm Hermes glow ring when edit mode engages. */\n  animation: home-fab-glow 0.55s ease-out;\n}\n\n/* Crossfading edit ✎ ↔ done ✓ glyphs — each rotates and scales through the\n * swap with a gentle overshoot, matching the dashboard's soft motion. */\n.home-fab-ico {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition:\n    opacity 0.3s ease,\n    transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1);\n}\n.ico-edit { opacity: 1; transform: rotate(0) scale(1); }\n.ico-done { opacity: 0; transform: rotate(-120deg) scale(0.3); }\n.home-fab.active .ico-edit { opacity: 0; transform: rotate(120deg) scale(0.3); }\n.home-fab.active .ico-done { opacity: 1; transform: rotate(0) scale(1); }\n\n.home-fab-spin {\n  display: inline-block;\n  animation: home-fab-spin-in 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n\n/* The restore-default button slides up into place, like the dashboard's\n * dialog-in entrance. */\n.home-fab-enter {\n  animation: home-fab-enter 0.32s cubic-bezier(0.34, 1.3, 0.64, 1);\n}\n\n@keyframes home-fab-glow {\n  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--home-accent) 55%, transparent); }\n  100% { box-shadow: 0 0 0 13px transparent; }\n}\n@keyframes home-fab-spin-in {\n  from { transform: rotate(-150deg); opacity: 0.3; }\n  to   { transform: rotate(0); opacity: 1; }\n}\n@keyframes home-fab-enter {\n  from { opacity: 0; transform: translateY(6px) scale(0.9); }\n  to   { opacity: 1; transform: translateY(0) scale(1); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .home-fab,\n  .home-fab-ico,\n  .home-fab-spin,\n  .home-fab-enter { animation: none; transition: opacity 0.2s ease; }\n}\n\n/* ── toast (plugin-local; the host toast isn't exposed in the SDK) ── */\n.home-toast {\n  position: fixed;\n  bottom: 18px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 80;\n  padding: 8px 16px;\n  border-radius: 8px;\n  font-size: 12px;\n  color: var(--home-error, #e25555);\n  background: var(--home-surface);\n  border: 1px solid var(--home-error, #e25555);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n  animation: home-toast-in 0.25s ease;\n}\n@keyframes home-toast-in {\n  from { opacity: 0; transform: translateX(-50%) translateY(8px); }\n  to { opacity: 1; transform: translateX(-50%) translateY(0); }\n}\n\n/* Catalog reveal: the wrapper animates its row track 0fr → 1fr so the panel\n * grows/collapses its real height smoothly (no grid jump), with a matching\n * fade. Kept mounted so the exit animates too. */\n.home-catalog-wrap {\n  display: grid;\n  grid-template-rows: 0fr;\n  margin: 0 12px;\n  opacity: 0;\n  pointer-events: none;\n  transition:\n    grid-template-rows 0.34s cubic-bezier(0.34, 1.2, 0.64, 1),\n    opacity 0.28s ease,\n    margin-bottom 0.34s ease;\n}\n.home-catalog-wrap.open {\n  grid-template-rows: 1fr;\n  opacity: 1;\n  pointer-events: auto;\n  margin-bottom: 8px;\n}\n.home-catalog {\n  overflow: hidden;\n  min-height: 0;\n  border-radius: 8px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition: border-color 0.2s ease, background 0.2s ease;\n}\n/* Highlighted as a delete target while a widget is dragged over it. */\n.home-catalog-wrap.trash-active .home-catalog {\n  border-color: var(--home-error);\n  border-style: dashed;\n  background: color-mix(in srgb, var(--home-error) 10%, var(--home-surface));\n}\n.home-catalog-inner {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  padding: 10px;\n}\n.home-catalog-hint {\n  font-size: 10px;\n  letter-spacing: 0.04em;\n  color: var(--color-muted-foreground, #6b7387);\n  margin-right: 4px;\n}\n.home-catalog-wrap.trash-active .home-catalog-hint { color: var(--home-error); }\n.home-catalog-chip { touch-action: none; }\n.home-catalog-chip {\n  font-family: inherit;\n  font-size: 11px;\n  padding: 4px 10px;\n  border-radius: 6px;\n  cursor: pointer;\n  background: none;\n  border: 1px dashed var(--home-border);\n  color: var(--color-foreground, #d8dce6);\n  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;\n}\n.home-catalog-chip:hover {\n  border-color: var(--home-accent);\n  color: var(--home-accent);\n  transform: translateY(-1px);\n}\n.home-catalog-chip:active { transform: scale(0.95); }\n.home-catalog .empty { color: var(--color-muted-foreground, #6b7387); font-size: 11px; }\n\n@media (prefers-reduced-motion: reduce) {\n  .home-catalog-wrap { transition: opacity 0.2s ease; }\n}\n\n/* ── projects widget (~/projects/<name>/status.json) ── */\n.home-projects {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  max-height: calc(100% - 18px);\n  overflow-y: auto;\n}\n.project-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  border-left: 2px solid var(--home-border);\n  background: color-mix(in srgb, var(--home-accent) 4%, transparent);\n  cursor: pointer;\n}\n.project-row:hover,\n.project-item.open .project-row { background: color-mix(in srgb, var(--home-accent) 10%, transparent); }\n.project-row.ok { border-left-color: var(--home-accent); }\n.project-row.warn { border-left-color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.project-row.err { border-left-color: var(--home-error); }\n.project-icon { font-size: 9px; color: var(--color-muted-foreground, #6b7387); }\n.project-row.ok .project-icon { color: var(--home-accent); }\n.project-row.warn .project-icon { color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.project-row.err .project-icon { color: var(--home-error); }\n.project-name {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n.project-stats { font-variant-numeric: tabular-nums; color: var(--home-accent-soft); font-size: 10px; }\n.project-time { color: var(--color-muted-foreground, #6b7387); font-size: 9.5px; white-space: nowrap; }\n.project-caret { color: var(--color-muted-foreground, #6b7387); font-size: 9px; width: 10px; text-align: center; }\n.project-detail {\n  margin: 1px 0 3px 12px;\n  padding: 4px 8px;\n  border-left: 1px dashed var(--home-border);\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  font-size: 10px;\n}\n.project-detail-row { line-height: 1.4; }\n.project-alerts ul { margin: 2px 0 0 14px; padding: 0; list-style: disc; }\n.project-alerts li { color: var(--home-error); }\n\n/* ── boards (full page inside the Home tab on the web dashboard) ── */\n.home-board-page { position: relative; height: calc(100vh - 72px); min-height: 480px; }\n.home-board-page.desktop { height: 100%; }\n";
const boardCss = `/* Board — "Mesa de despacho" (hd-canvas-plan/mockup-v2). Everything is scoped under .hb.
 * One accent: the theme primary. Hermes is a material (dot matrix + caduceus), not a hue.
 * Two families, both the host's: Hermes Desktop's UI sans for text and controls, the Home's
 * mono for structure (headers, counts, keys, data). No embedded fonts.
 * Radii: flush chrome 0 · cards & buttons 3 · panels 4 · floating menus 6 · checkboxes 2.
 * Motion: 120-200 ms ease-out, none under prefers-reduced-motion. */
/* Board camera, minimap view frame, miniature boards, page transitions.
 * Kept apart from board.css (imported at its top); every selector is specific enough to win
 * wherever it sits. --iz (1 / zoom) is set on the world by BoardView so overlays can keep their size. */
/* ── camera ─────────────────────────────────────────────────────────────── */
/* compositor hints only while the camera is moving: a permanent will-change keeps the
 * layer rasterised at its first scale (soft text after a zoom) */
.hb-viewport > .hb-world { will-change: auto; }
.hb-viewport.gesturing > .hb-world, .hb-viewport.gesturing > .hb-grid { will-change: transform; }
/* the grid is one oversized layer, one tile larger on every side; panning only translates it */
.hb-viewport > .hb-grid {
  left: calc(var(--gp, 0px) * -1); top: calc(var(--gp, 0px) * -1);
  right: calc(var(--gp, 0px) * -1); bottom: calc(var(--gp, 0px) * -1);
  background-position: 0 0, 0 0;
}
/* ── minimap: a static layer, and a frame that only moves ───────────────── */
.hb-map { overflow: hidden; }
.hb-map .hb-map-view { position: absolute; left: 0; top: 0; pointer-events: none; border: 1px solid var(--accent); opacity: .75; }
.hb-map .hb-map-hermes { position: absolute; left: 0; top: 0; width: 8px; height: 8px; margin: -4px 0 0 -4px; pointer-events: none; background: var(--accent);
  box-shadow: inset 0 0 0 2.5px var(--bg); display: none; }
.hb-map-wrap { position: relative; width: 184px; height: 100px; }
/* ── miniature boards (Home widget, nested-board cards) ─────────────────── */
.hb.hb-mini { position: absolute; inset: 0; height: auto; min-height: 0; background: transparent; pointer-events: none; overflow: hidden; }
.hb.hb-mini * { pointer-events: none !important; }
.hb-mini .hb-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: auto; }
.hb-mini .hb-item { position: absolute; }
.hb-mini .hb-wires .hit { display: none; }
.hb-mini .hb-card, .hb-mini .hb-box { transition: none; }
.hb-mini .hb-boardref .pv { pointer-events: none; }
.hb-mini .hb-embed .frame { background: var(--well); }
/* ── page transitions ───────────────────────────────────────────────────── */
/* a snapshot of the page we are leaving, flown over the one we arrive at */
.hb-xfade { position: fixed; z-index: 9999; overflow: hidden; pointer-events: none; contain: layout paint style; }
.hb-xfade > * { position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none !important; }
.hb-xfade * { pointer-events: none !important; }
@media (prefers-reduced-motion: reduce) {
  .hb-xfade { display: none; }
}
/* Custom components (kind comp), the component gallery and the shared sync transport.
 * Kept apart from board.css (imported at its top); same variables, same material as the other
 * cards: no colours of its own, Hermes is the dotted material (.dm), never a hue. */
.hb-comp .comp-menu { position: absolute; z-index: 5; top: 34px; right: 6px; min-width: 168px; max-height: 260px; overflow: auto; padding: 4px;
  border-radius: var(--r-float); background: var(--float-bg); border: 1px solid var(--float-line); box-shadow: var(--lift); font: 400 12px/1 var(--sans); }
.hb-comp .comp-menu button { width: 100%; height: 30px; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 0 8px;
  border-radius: 4px; text-align: left; color: var(--ink-2); align-items: center; }
.hb-comp .comp-menu button:hover { background: var(--hover); color: var(--ink); }
.hb-comp .comp-menu button.on b { color: var(--accent); }
.hb-comp .comp-menu b { font: 600 12px/1 var(--mono); color: var(--ink); }
.hb-comp .comp-menu small { font: 400 10.5px/1 var(--mono); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
/* the versions menu hangs below the header, outside the card box */
.hb .hb-embed.hb-comp { overflow: visible; }
.hb .hb-comp .bar-e { position: relative; overflow: visible; border-radius: 3px 3px 0 0; }
.hb-comp .foot { border-radius: 0 0 3px 3px; }
.hb-item:has(.comp-menu) { z-index: 30 !important; }
.hb-comp .comp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px; text-align: center; color: var(--ink-3); }
.hb-comp .comp-empty b { font: 600 12.5px/1.3 var(--sans); color: var(--ink-2); }
.hb-comp .comp-empty small { font: 400 11px/1.4 var(--mono); }
.hb-comp .comp-src { margin: 0; padding: 10px 12px; overflow: auto; font: 400 11px/1.5 var(--mono); color: var(--ink-2); white-space: pre; background: var(--well); user-select: text; }
/* the link indicator on every synced card */
.hb .sync-chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: var(--r-ctl); font: 400 10.5px/1 var(--mono);
  color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 38%, transparent); white-space: nowrap; }
.hb .sync-chip.over { position: absolute; z-index: 2; top: 8px; left: 8px; background: var(--float-bg); pointer-events: auto; }
.hb-video .stage { position: relative; }
/* gallery */
.hb-gallery { position: absolute; z-index: 40; left: 0; right: 0; margin: 0 auto; bottom: 52px; width: min(720px, calc(100% - 32px)); max-height: min(520px, calc(100% - 120px));
  display: flex; flex-direction: column; border-radius: var(--r-float); background: var(--float-bg); border: 1px solid var(--float-line); box-shadow: var(--lift);
  animation: hb-pop .14s var(--out); }
.hb-gallery .gal-hd { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--rule); font: 700 9.5px/1 var(--mono);
  letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); }
.hb-gallery .gal-hd svg { color: var(--accent); }
.hb-gallery .gal-hd .kbtn { margin-left: auto; }
.hb-gallery .gal-grid { overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 14px; }
.hb-gallery .gal-tile { display: flex; flex-direction: column; gap: 4px; padding: 0 0 9px; text-align: left; border-radius: var(--r-ctl); border: 1px solid var(--rule); background: var(--sheet);
  overflow: hidden; transition: border-color .14s var(--out); }
.hb-gallery .gal-tile:hover, .hb-gallery .gal-tile:focus-visible { border-color: var(--accent); outline: none; }
.hb-gallery .gal-tile b { padding: 4px 10px 0; font: 600 12.5px/1.2 var(--sans); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-gallery .gal-tile small { padding: 0 10px; font: 400 10.5px/1.3 var(--mono); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-gallery .gal-thumb { position: relative; height: 131px; overflow: hidden; border-bottom: 1px solid var(--rule); background: var(--well); pointer-events: none; }
.hb-gallery .gal-thumb .gal-scale { transform-origin: 0 0; position: absolute; left: 0; top: 0; }
.hb-gallery .gal-thumb .frame { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
.hb-gallery .gal-thumb .gal-nofile { position: absolute; inset: 0; display: grid; place-items: center; color: var(--ink-3); }
.hb-gallery .gal-empty { display: flex; flex-direction: column; gap: 6px; padding: 28px 22px; font: 400 12px/1.5 var(--sans); color: var(--ink-3); }
.hb-gallery .gal-empty b { font: 600 13px/1.3 var(--sans); color: var(--ink-2); }
/* shared transport */
.hb-sync { position: absolute; z-index: 19; left: 50%; bottom: 52px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 4px; padding: 4px;
  border-radius: var(--r-panel); background: var(--chrome); border: 1px solid var(--rule); box-shadow: var(--lift); max-width: calc(100% - 24px); }
.hb-gallery ~ .hb-sync { display: none; }
.hb-sync .row { display: flex; align-items: center; gap: 4px; height: 30px; padding: 0 4px; color: var(--ink-2); }
.hb-sync .grp { display: inline-flex; align-items: center; gap: 5px; min-width: 52px; padding: 0 6px 0 4px; font: 600 11px/1 var(--mono); color: var(--accent); }
.hb-sync .scrub { width: clamp(120px, 24vw, 340px); height: 18px; margin: 0 6px; accent-color: var(--accent); background: transparent; cursor: pointer; }
.hb-sync .time { min-width: 86px; text-align: right; font: 400 11px/1 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.hb-sync .rate { min-width: 38px; height: 22px; padding: 0 6px; margin-left: 4px; border-radius: var(--r-ctl); font: 400 11px/1 var(--mono); color: var(--ink-2); border: 1px solid var(--rule); }
.hb-sync .rate:hover { color: var(--ink); background: var(--hover); }
.hb-sync .manual { font: 700 9.5px/1 var(--mono); color: var(--on-accent); background: var(--accent); border-radius: 2px; padding: 3px 4px; }
.hb.chat-open .hb-sync { left: calc((100% - var(--chat-w, 380px)) / 2); }
.hb.chat-open .hb-gallery { right: var(--chat-w, 380px); }
/* Presentation mode (tour.ts / usePresentation.ts). The board takes the whole window, its chrome
 * steps aside, and a slim HUD sits at the bottom. Same material as the status bar and menus:
 * var(--float-bg), the 1px float line, the board's own cells for progress. */
.hb.presenting { position: fixed; inset: 0; height: auto; min-height: 0; z-index: 2147483000; }
.hb.presenting > :not(.hb-viewport):not(.hb-present):not(.hb-toast) { display: none !important; }
.hb.presenting .hb-viewport, .hb.presenting.chat-open .hb-viewport { inset: 0; right: 0; pointer-events: none; cursor: none; }
.hb.presenting .hb-viewport * { pointer-events: none !important; }
.hb.presenting .hb-sel, .hb.presenting .hb-marquee, .hb.presenting .hb-hermes-cursor { display: none !important; }
.hb-present { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 30; display: flex; align-items: center; gap: 6px;
  max-width: calc(100% - 40px); padding: 6px 8px; border-radius: var(--r-float); background: var(--float-bg); border: 1px solid var(--float-line);
  box-shadow: var(--lift); color: var(--ink-2); animation: hb-pop .18s var(--out); transition: opacity .35s var(--out), transform .35s var(--out); }
.hb-present.idle { opacity: 0; transform: translate(-50%, 8px); pointer-events: none; }
.hb-present .ib:disabled { opacity: .35; pointer-events: none; }
.hb-present .sep { width: 1px; height: 18px; background: var(--rule-2); margin: 0 2px; flex: none; }
.hb-present .who { display: flex; flex-direction: column; justify-content: center; gap: 4px; min-width: 190px; max-width: 420px; padding: 0 10px; }
.hb-present .who .k { font: 400 10.5px/1 var(--mono); letter-spacing: .1em; color: var(--ink-3); white-space: nowrap; }
.hb-present .who .k i { font-style: normal; margin: 0 .25em; opacity: .55; }
.hb-present .who b { font: 600 13px/1.2 var(--sans); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-present .who .note { font: 400 11px/1.25 var(--sans); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-present .cells { display: flex; gap: 3px; width: clamp(40px, 12vw, 180px); padding: 0 6px; }
.hb-present .cells i { flex: 1; height: 4px; min-width: 3px; background: color-mix(in srgb, var(--accent) 14%, transparent); transition: background-color .3s var(--out); }
.hb-present .cells i.past { background: color-mix(in srgb, var(--accent) 48%, transparent); }
.hb-present .cells i.on { background: var(--accent); }
@media (prefers-reduced-motion: reduce) { .hb-present, .hb-present .cells i { transition: none; animation: none; } }
/* the Present button's pulse while a tour is stored */
.hb .ib.has-tour { color: var(--accent); }
.hb {
  --accent: var(--color-primary, var(--ui-accent, #ffe3c4));
  --accent-soft: color-mix(in srgb, var(--accent) 82%, #9aa3b5);
  /* Desktop doesn't publish --color-background; its editor surface is the native page colour */
  --bg: var(--color-background, var(--ui-editor-surface-background, #031919));
  --ink: var(--color-foreground, #f3ece3);
  --sheet: color-mix(in oklab, var(--bg) 93.5%, var(--ink));
  --sheet-2: color-mix(in oklab, var(--bg) 90.5%, var(--ink));
  --chrome: color-mix(in oklab, var(--bg) 98%, var(--ink));
  --well: color-mix(in oklab, var(--bg) 96.5%, var(--ink));
  --ink-2: color-mix(in srgb, var(--ink) 76%, transparent);
  --ink-3: color-mix(in srgb, var(--ink) 60%, transparent);
  --on-accent: color-mix(in srgb, var(--bg) 70%, #000);
  --rule: color-mix(in srgb, var(--accent) 13%, transparent);
  --rule-2: color-mix(in srgb, var(--accent) 26%, transparent);
  --rule-3: color-mix(in srgb, var(--accent) 42%, transparent);
  --tint: color-mix(in srgb, var(--accent) 6%, transparent);
  --warn: #f5b945;
  --ok: var(--color-success, #3fb97f);
  --sans: var(--dt-font-sans, var(--theme-font-sans, system-ui, -apple-system, "Segoe UI", sans-serif));
  --mono: var(--theme-font-mono, ui-monospace, monospace);
  --r-panel: 4px; --r-card: 3px; --r-ctl: 3px; --r-float: 6px;
  --float-bg: var(--ui-bg-elevated, color-mix(in oklab, var(--bg) 88%, var(--ink)));
  --float-line: var(--ui-stroke-secondary, color-mix(in srgb, var(--ink) 14%, transparent));
  --hover: color-mix(in srgb, var(--ink) 7%, transparent);
  --danger: var(--color-destructive, #e5484d);
  --out: cubic-bezier(.2, .7, .3, 1);
  --lift: 0 22px 40px -18px rgb(0 0 0 / 0.85), 0 4px 10px rgb(0 0 0 / 0.35);
  --settle: cubic-bezier(.22, 1, .36, 1);
  position: relative;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  isolation: isolate;
  user-select: none;
}
.hb *, .hb *::before, .hb *::after { box-sizing: border-box; }
.hb button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; margin: 0; }
.hb button:focus-visible, .hb [tabindex]:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }
.hb svg.px { width: 9px; height: 11px; fill: currentColor; flex: none; shape-rendering: crispEdges; }
.hb input, .hb textarea { font: inherit; color: inherit; background: none; border: 0; outline: 0; resize: none; }
.hb ::selection { background: color-mix(in srgb, var(--accent) 35%, transparent); }
/* ── the Home header: lead rule · TITLE · count · fading hairline ── */
.hb .hd { display: flex; align-items: center; gap: 10px; font: 700 10px/1 var(--mono); letter-spacing: .18em; text-transform: uppercase; color: var(--accent-soft); white-space: nowrap; }
.hb .hd::before { content: ""; width: 12px; height: 1px; background: currentColor; opacity: .5; flex: none; }
.hb .hd::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, currentColor, transparent 92%); opacity: .28; }
/* a long title shrinks to an ellipsis instead of running over its card */
.hb .hd .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.hb-todo .hd, .hb-col > .hd { min-width: 0; }
.hb .hd .n { order: 3; flex: none; font-weight: 400; letter-spacing: .06em; color: var(--ink-3); }
/* ── table ── */
.hb-viewport { position: absolute; inset: 44px 0 40px 0; overflow: clip; background: var(--bg); touch-action: none; outline: none; }
.hb-viewport.panning { cursor: grabbing; }
.hb-viewport.tool-pan { cursor: grab; }
.hb-viewport.tool-draw, .hb-viewport.tool-arrow { cursor: crosshair; }
.hb-viewport.tool-place { cursor: copy; }
.hb-grid { position: absolute; inset: 0; pointer-events: none; }
.hb-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.hb-wires { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.hb-wires .hit { pointer-events: stroke; cursor: pointer; }
.hb-marquee { position: absolute; border: 1px dashed var(--rule-3); background: color-mix(in srgb, var(--accent) 5%, transparent); pointer-events: none; }
/* ── items ── */
.hb-item { position: absolute; }
.hb-item.dragging { z-index: 40; }
.hb-item.dragging > .hb-card, .hb-item.dragging > .hb-box { box-shadow: var(--lift); border-color: var(--rule-3); }
.hb-item.just-placed { animation: hb-settle .42s var(--settle); }
@keyframes hb-settle { from { transform: scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }
.hb-card { position: relative; border-radius: var(--r-card); background: var(--sheet); border: 1px solid var(--rule); transition: border-color .16s; }
.hb-item:hover > .hb-card { border-color: var(--rule-2); }
.hb-card::after { content: ""; position: absolute; right: 3px; bottom: 3px; width: 9px; height: 9px; border-right: 1.5px solid var(--rule-3); border-bottom: 1.5px solid var(--rule-3); opacity: 0; transition: opacity .16s; pointer-events: none; }
.hb-item:hover > .hb-card::after { opacity: 1; }
.hb-item.sel > .hb-card::after { opacity: 0; }
/* Hermes' material: dot-matrix frame, 2px dots every 4px (1px gradients keep it crisp) */
.hb .dm { border-color: transparent !important;
  background-image:
    linear-gradient(90deg, var(--dm, var(--accent)) 50%, transparent 0), linear-gradient(90deg, var(--dm, var(--accent)) 50%, transparent 0),
    linear-gradient(0deg, var(--dm, var(--accent)) 50%, transparent 0), linear-gradient(0deg, var(--dm, var(--accent)) 50%, transparent 0);
  background-size: 4px 1px, 4px 1px, 1px 4px, 1px 4px;
  background-position: 0 0, 0 100%, 0 0, 100% 0;
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-origin: border-box; }
.hb-card.dm { background-color: var(--sheet); }
.hb .dm.soft { --dm: color-mix(in srgb, var(--accent) 55%, transparent); }
.hb .sig { display: inline-flex; align-items: center; gap: 5px; font: 400 11px/1 var(--mono); letter-spacing: .04em; color: var(--accent); text-transform: lowercase; }
.hb .meta { display: flex; align-items: center; gap: 10px; font: 400 10.5px/1 var(--mono); color: var(--ink-3); letter-spacing: .02em; min-width: 0; }
.hb .meta .sp { flex: 1; }
/* tags, due date and signature wrap onto a second line in a narrow card rather than breaking mid-word */
.hb .meta { flex-wrap: wrap; row-gap: 5px; }
.hb .meta > span { white-space: nowrap; }
.hb .meta .sp { min-width: 0; }
.hb .tag { color: var(--ink-2); }
.hb .tag::before { content: "#"; color: var(--ink-3); }
.hb .due { color: var(--warn); }
.hb-more { position: absolute; top: 8px; right: 8px; width: 22px; height: 20px; border-radius: var(--r-ctl); font: 700 12px/20px var(--mono) !important; letter-spacing: .05em; color: var(--ink-3) !important; opacity: 0; transition: opacity .12s; z-index: 2; }
.hb-item:hover .hb-more, .hb-kid:hover .hb-more { opacity: 1; }
.hb-more:hover { color: var(--ink) !important; background: var(--tint) !important; }
/* card (note) */
.hb-note { padding: 14px 16px 12px; }
.hb-note h4 { margin: 0; font: 600 14px/1.32 var(--sans); letter-spacing: .003em; color: var(--ink); padding-right: 20px; }
.hb-note .body { margin: 4px 0 0; font: 400 12.5px/1.45 var(--sans); color: var(--ink-2); white-space: pre-wrap; overflow-wrap: anywhere; }
.hb-note.quote .body { margin: 0; font: 500 16px/1.42 var(--sans); color: var(--ink); letter-spacing: -.003em; padding-right: 14px; }
.hb-note .body b { color: var(--ink); font-weight: 650; }
.hb-note .body pre.code { margin: 6px 0 0; padding: 8px 10px; border-radius: var(--r-ctl); background: var(--well); border: 1px solid var(--rule);
  font: 400 11px/1.5 var(--mono); color: var(--ink-2); white-space: pre-wrap; overflow-wrap: anywhere; }
.hb-note .meta { margin-top: 12px; }
.hb-note .edit { display: block; width: 100%; min-height: 1.4em; overflow: hidden; }
.hb-note h4 .edit { font: inherit; }
/* segmented progress: one cell per real item */
.hb .cells { display: flex; gap: 3px; margin-top: 11px; }
.hb .cells i { flex: 1; height: 4px; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.hb .cells i.on { background: var(--accent); }
/* to-do */
.hb-todo { padding: 14px 16px 10px; }
.hb-todo .sum { margin-top: 12px; font: 400 12.5px/1.3 var(--sans); color: var(--ink-2); }
.hb-todo .sum b { font: 700 12.5px var(--mono); color: var(--ink); margin-right: 2px; }
.hb-todo ul { list-style: none; margin: 10px 0 0; padding: 0; }
.hb-todo li { display: flex; align-items: center; gap: 10px; padding: 6px; margin: 0 -6px; border-radius: 2px; font: 400 13.5px/1.25 var(--sans); color: var(--ink); transition: background .12s; }
.hb-todo li:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.hb-todo .box { width: 13px; height: 13px; border-radius: 2px; border: 1.25px solid var(--rule-3); flex: none; position: relative; cursor: pointer; }
.hb-todo li.x .box { background: var(--accent); border-color: var(--accent); }
.hb-todo li.x .box::after { content: ""; position: absolute; left: 3.5px; top: 1px; width: 3px; height: 6.5px; border: solid var(--on-accent); border-width: 0 1.6px 1.6px 0; transform: rotate(42deg); }
.hb-todo li.x .l { color: var(--ink-3); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--ink) 35%, transparent); }
.hb-todo li .l { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.hb-todo li .side { margin-left: auto; font: 400 10.5px/1 var(--mono); color: var(--ink-3); }
.hb-todo li .rm { opacity: 0; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 2px; color: var(--ink-3); transition: opacity .14s var(--out), color .14s var(--out); }
.hb-todo li .rm:hover { color: var(--ink); background: var(--hover); }
.hb-todo li:hover .rm { opacity: 1; }
.hb-todo .addrow { display: flex; align-items: center; gap: 10px; padding: 6px; margin: 2px -6px 0; font: 400 12.5px/1 var(--sans); color: var(--ink-3); }
.hb-todo .addrow b { display: grid; place-items: center; color: var(--accent-soft); width: 13px; }
.hb-todo .addrow input { flex: 1; min-width: 0; }
/* columns: a faint track, no box around the box */
.hb-col { width: 276px; padding: 0 0 10px; }
.hb-col > .hd { padding: 0 2px 12px; cursor: grab; }
.hb-col .track { display: flex; flex-direction: column; gap: 6px; padding: 6px; margin: 0 -6px; border-radius: var(--r-panel); background: color-mix(in srgb, var(--accent) 2.2%, transparent); min-height: 40px; transition: background .12s; }
.hb-col .track.drop { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.hb-col .drop-line { height: 2px; background: var(--accent); margin: -4px 0; border-radius: 1px; }
.hb-kid { position: relative; }
.hb-kid.sel > .hb-card { border-color: var(--accent); }
.hb-kid.ghost { opacity: .35; }
.hb-col .add { width: 100%; margin-top: 8px; height: 28px; padding: 0 6px; display: flex; align-items: center; gap: 8px; font: 500 12px/1 var(--sans); color: var(--ink-3); border-radius: var(--r-ctl); transition: color .12s, background .12s; }
.hb-col .add .ic { color: var(--accent-soft); }
.hb-col .add:hover { color: var(--ink); background: color-mix(in srgb, var(--accent) 5%, transparent); }
/* link card */
.hb-link { overflow: hidden; cursor: default; }
.hb-link .thumb { height: 128px; border-bottom: 1px solid var(--rule); background: var(--well); overflow: hidden; display: block; }
/* a thumbnail with a known size takes its own shape (clamped), not a fixed crop */
.hb-link .thumb[style*="aspect-ratio"] { height: auto; min-height: 96px; max-height: 200px; }
.hb-link .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hb-link .body { padding: 11px 14px 13px; }
.hb-link .dom { display: flex; align-items: center; gap: 7px; font: 400 10.5px/1 var(--mono); color: var(--ink-3); min-width: 0; }
.hb-link .dom img { width: 12px; height: 12px; flex: none; }
.hb-link .dom span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-link h4 { margin: 7px 0 0; font: 600 14.5px/1.3 var(--sans); overflow-wrap: anywhere; }
.hb-link h4 a { color: inherit; text-decoration: none; }
.hb-link h4 a:hover { text-decoration: underline; text-decoration-color: var(--rule-3); text-underline-offset: 3px; }
.hb-link p { margin: 4px 0 0; font: 400 12.5px/1.42 var(--sans); color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.hb-link .url { margin-top: 6px; font: 400 10.5px/1.35 var(--mono); color: var(--ink-3); overflow-wrap: anywhere; }
/* skeleton: rule lines, no shimmer */
.hb-link .body.wait { min-height: 112px; box-sizing: border-box; }
.hb-link .skel { display: grid; gap: 7px; margin-top: 10px; }
.hb-link .skel i { height: 6px; background: color-mix(in srgb, var(--accent) 9%, transparent); }
.hb-link .skel i:nth-child(1) { width: 78%; }
.hb-link .skel i:nth-child(2) { width: 92%; }
.hb-link .skel i:nth-child(3) { width: 54%; }
.hb-link .thumb.skel-thumb { background:
  repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent) 7%, transparent) 0 1px, transparent 1px 24px),
  repeating-linear-gradient(0deg, color-mix(in srgb, var(--accent) 7%, transparent) 0 1px, transparent 1px 24px), var(--well); }
/* video card: poster first, the player mounts on click */
.hb-video { overflow: hidden; }
.hb-video .stage { position: relative; aspect-ratio: 16 / 9; background: #000; overflow: hidden; border-bottom: 1px solid var(--rule); }
.hb-video.vert .stage { aspect-ratio: 9 / 16; }
.hb-video .stage img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .86; transition: opacity .16s; }
.hb-video .stage:hover img { opacity: 1; }
/* a clip with a known size has a stage of its own shape: show all of it */
.hb-video .stage[style*="aspect-ratio"] img, .hb-video .stage[style*="aspect-ratio"] video.still { object-fit: contain; }
.hb-video .stage iframe, .hb-video .stage video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; background: #000; }
.hb-video .play { position: absolute; left: 14px; bottom: 14px; display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px 0 10px; border-radius: var(--r-ctl); background: var(--accent); color: var(--on-accent) !important; font: 600 13px/1 var(--sans) !important; }
.hb-video .play svg { width: 10px; height: 12px; fill: currentColor; }
.hb-video .play:hover { background: color-mix(in srgb, var(--accent) 85%, #fff) !important; }
.hb-video .dur { position: absolute; right: 10px; top: 10px; font: 400 10.5px/1 var(--mono); color: var(--ink-2); background: rgb(0 0 0 / .55); padding: 3px 5px; }
.hb-video .poster-empty { position: absolute; inset: 0; display: grid; place-items: center; font: 400 11px/1 var(--mono); color: var(--ink-3);
  background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent) 6%, transparent) 0 1px, transparent 1px 24px), var(--well); }
/* image card */
.hb-image { padding: 6px 6px 0; overflow: hidden; }
.hb-image .art { line-height: 0; background: var(--well); min-height: 60px; }
.hb-image .art img { width: 100%; height: auto; display: block; }
/* the frame already has the picture's shape: the picture fills it, never taller, never doubled */
.hb-image .art.fit { min-height: 0; position: relative; overflow: hidden; }
.hb-image .art.fit img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.hb-image .cap { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 6px 11px; min-height: 12px; }
.hb-image .cap b { font: 600 13px/1.2 var(--sans); }
/* imported file (pdf / 3D model): original kept beside its thumbnail */
.hb-image .art { position: relative; }
.hb-image .art .fbadge { position: absolute; left: 8px; top: 8px; padding: 2px 6px; border-radius: var(--r-ctl); font: 700 9.5px/1.3 var(--mono); letter-spacing: .08em;
  color: var(--ink-2, var(--ink)); background: color-mix(in srgb, var(--bg) 78%, transparent); border: 1px solid var(--rule-2); backdrop-filter: blur(4px); }
.hb-image .art .file-ph { display: grid; place-items: center; width: 100%; height: 100%; min-height: 120px; color: var(--ink-3); }
.hb-image .cap .kbtn:disabled { opacity: .5; }
.hb-image.has-file .art { background: var(--well); }
/* status stamp */
.hb-mark { position: absolute; right: -7px; top: -7px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; pointer-events: none; z-index: 2;
  color: var(--on-accent); border: 2px solid var(--bg); box-sizing: content-box; margin: -2px -2px 0 0; }
.hb-mark.ok { background: var(--ok); }
.hb-mark.fail { background: var(--danger); }
.hb-mark.wait { background: var(--warn); }
.hb-item:has(> .hb-mark.ok) > .hb-card, .hb-item:has(> .hb-mark.ok) > .hb-box { border-color: color-mix(in srgb, var(--ok) 55%, transparent); }
.hb-item:has(> .hb-mark.fail) > .hb-card, .hb-item:has(> .hb-mark.fail) > .hb-box { border-color: color-mix(in srgb, var(--danger) 70%, transparent); }
.hb-item:has(> .hb-mark.wait) > .hb-card, .hb-item:has(> .hb-mark.wait) > .hb-box { border-color: color-mix(in srgb, var(--warn) 60%, transparent); }
/* embed: a window */
.hb-embed { padding: 0; overflow: hidden; }
.hb-embed .bar-e { height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 12px; border-bottom: 1px solid var(--rule); font: 400 11px/1 var(--mono); white-space: nowrap; overflow: hidden; }
.hb-embed .file { color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.hb-embed .sb { color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; }
.hb-embed { container-type: inline-size; }
@container (max-width: 330px) { .hb-embed .sb { display: none; } }
.hb-embed .tools { margin-left: auto; display: flex; gap: 2px; }
.hb-embed .frame { display: block; width: 100%; height: 240px; border: 0; background: var(--well); }
.hb-embed .frame.themed { background: transparent; }
.hb-embed .shield { position: absolute; inset: 0; z-index: 1; display: flex; align-items: flex-end; justify-content: flex-end; padding: 8px; cursor: pointer; }
.hb-embed .shield span { font: 400 10.5px/1 var(--mono); color: var(--ink-2); padding: 4px 6px; border-radius: var(--r-ctl); background: var(--float-bg); border: 1px solid var(--float-line);
  opacity: 0; transition: opacity .14s var(--out); }
.hb-embed .shield:hover span, .hb-embed .shield:focus-visible span { opacity: 1; }
.hb-embed .foot { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 9px; border-top: 1px solid var(--rule); }
.hb .kbtn { height: 24px; width: 24px; display: inline-grid; place-items: center; border-radius: var(--r-ctl); color: var(--ink-3); transition: color .14s var(--out), background-color .14s var(--out); }
.hb .kbtn.on { color: var(--accent); }
.hb .kbtn:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--ink); }
/* nested board */
.hb-boardref { padding: 6px; cursor: pointer; }
.hb-boardref .pv { height: 110px; background: var(--well); position: relative; overflow: hidden; border: 1px solid var(--rule); }
.hb-boardref .pv i { position: absolute; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.hb-boardref .pv i.c { background: color-mix(in srgb, var(--accent) 24%, transparent); }
.hb-boardref .pv i.h { background: none; outline: 1px dotted color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: -1px; }
.hb-boardref .ttl { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 10px 4px 3px; }
.hb-boardref .ttl b { font: 600 14px/1.25 var(--sans); min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.hb-boardref .ttl span { display: grid; place-items: center; color: var(--accent); opacity: 0; transition: opacity .16s var(--out); white-space: nowrap; }
.hb-boardref .ttl button { display: grid; place-items: center; width: 22px; height: 22px; border-radius: var(--r-ctl); }
.hb-boardref .ttl button:hover { background: var(--hover); }
.hb-item:hover .hb-boardref .ttl span { opacity: 1; }
.hb-boardref .meta { padding: 3px 4px 4px; }
/* frames: corner marks, not boxes */
.hb-frame { position: relative; width: 100%; height: 100%; }
.hb-frame > i { position: absolute; width: 16px; height: 16px; border: 0 solid var(--rule-3); pointer-events: none; }
.hb-frame > i:nth-of-type(1) { left: 0; top: 0; border-width: 1px 0 0 1px; }
.hb-frame > i:nth-of-type(2) { right: 0; top: 0; border-width: 1px 1px 0 0; }
.hb-frame > i:nth-of-type(3) { left: 0; bottom: 0; border-width: 0 0 1px 1px; }
.hb-frame > i:nth-of-type(4) { right: 0; bottom: 0; border-width: 0 1px 1px 0; }
.hb-frame .lbl { position: absolute; left: 24px; top: -6px; display: flex; align-items: center; gap: 10px; padding: 0 6px; background: var(--bg); font: 700 10px/12px var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-2); white-space: nowrap; cursor: grab; max-width: calc(100% - 36px); }
.hb-frame .lbl .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.hb-frame .lbl em { min-width: 0; overflow: hidden; text-overflow: ellipsis; font: 400 10.5px/12px var(--mono); letter-spacing: .02em; text-transform: none; font-style: normal; color: var(--ink-3); }
.hb-frame.dm { background-color: transparent; }
.hb-frame.dm .lbl { color: var(--accent); }
/* diagram node */
.hb-box { position: relative; width: 100%; height: 100%; border-radius: var(--r-card); padding: 11px 14px; display: flex; gap: 12px; align-items: flex-start;
  background: var(--sheet-2); border: 1px solid var(--rule-2); transition: border-color .16s; overflow: hidden; }
.hb-item:hover > .hb-box { border-color: var(--rule-3); }
.hb-box .num { font: 700 11px/18px var(--mono); color: var(--accent); flex: none; }
.hb-box b { display: block; font: 600 14px/18px var(--sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-box small { display: block; margin-top: 3px; font: 400 10.5px/1.2 var(--mono); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* text on the table (section headings) */
.hb-text { width: max-content; max-width: min(560px, 100%); }
.hb-text.h { font: 700 15px/1 var(--mono); letter-spacing: .2em; text-transform: uppercase; color: var(--accent); display: flex; align-items: center; gap: 10px; white-space: nowrap; overflow: hidden; max-width: 100%; }
.hb-text.h::before { content: ""; width: 22px; height: 1px; background: currentColor; opacity: .5; flex: none; }
.hb-text.h::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, currentColor, transparent 92%); opacity: .28; }
.hb-text.p { font: 400 13px/1.35 var(--sans); color: var(--ink-2); white-space: pre-wrap; }
/* sketch labels: the UI sans in italic, Alberto's voice without a third family */
.hb-text.s { font: italic 400 17px/1.25 var(--sans); color: var(--ink); opacity: .92; white-space: pre-wrap; }
/* freehand and shapes. A restrained palette: the theme's ink and accent plus four muted
 * mid-tones that read on dark and light themes alike. */
.hb {
  --pen-sage: #7fa287; --pen-clay: #c47e62; --pen-slate: #7c93b4; --pen-sand: #bfa060;
}
.hb-draw { --pen: var(--ink); overflow: visible; pointer-events: none; }
.hb-draw.c-accent { --pen: var(--accent); }
.hb-draw.c-sage { --pen: var(--pen-sage); }
.hb-draw.c-clay { --pen: var(--pen-clay); }
.hb-draw.c-slate { --pen: var(--pen-slate); }
.hb-draw.c-sand { --pen: var(--pen-sand); }
.hb-draw path { fill: none; stroke: var(--pen); stroke-linecap: round; stroke-linejoin: round; opacity: .88; pointer-events: visibleStroke; }
.hb-draw path.fill { fill: var(--pen); stroke: none; pointer-events: visibleFill; }
/* highlighter: wide and translucent, layered under the ink (see BoardView's z-order) */
.hb-draw.hl path { opacity: .3; stroke-linecap: round; }
.hb-draw.sel:not(.c-accent, .c-sage, .c-clay, .c-slate, .c-sand) { --pen: var(--accent); }
.hb-draw.sel { filter: drop-shadow(0 0 2.5px color-mix(in srgb, var(--accent) 65%, transparent)); }
/* eraser hover preview / sweep: what goes, fades */
.hb-draw.erasing path { opacity: .16; transition: opacity .1s var(--out); }
.hb-live, .hb-live path { pointer-events: none !important; }
.hb-live.lasso path { stroke: var(--accent); opacity: .9; fill: color-mix(in srgb, var(--accent) 6%, transparent); }
.hb-viewport.ink-eraser { cursor: none; }
.hb-eraser { position: absolute; left: 0; top: 0; margin: calc(var(--r, 9px) * -1) 0 0 calc(var(--r, 9px) * -1); border-radius: 50%;
  border: 1.5px solid var(--ink-2); box-shadow: 0 0 0 1px color-mix(in srgb, var(--bg) 70%, transparent); pointer-events: none; z-index: 5; }
/* the Draw tool's sub-toolbar: status-bar chrome, floating just above it */
.hb-inkbar { position: absolute; left: 8px; bottom: 48px; z-index: 21; display: flex; flex-wrap: wrap; align-items: center;
  max-width: calc(100% - 16px); padding: 0 2px; border-radius: var(--r-float); background: var(--float-bg);
  border: 1px solid var(--float-line); box-shadow: var(--lift); color: var(--ink-2); animation: hb-pop .14s var(--out); }
.hb.chat-open .hb-inkbar { max-width: calc(100% - var(--chat-w, 380px) - 16px); }
.hb-inkbar .seg { display: flex; align-items: center; gap: 2px; height: 36px; padding: 0 4px; border-right: 1px solid var(--rule); flex: none; }
.hb-inkbar .seg:last-child { border-right: 0; }
.hb-inkbar .seg.off { opacity: .38; }
.hb-inkbar .tool:disabled { cursor: default; background: none; }
.hb-inkbar .tool.sw i { display: block; border-radius: 50%; background: currentColor; }
.hb-inkbar .tool.sw-c { width: 26px; }
.hb-inkbar .tool.sw-c i { --pen: var(--ink); width: 13px; height: 13px; border-radius: 50%; background: var(--pen);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bg) 30%, transparent); }
.hb-inkbar .tool.sw-c.c-accent i { --pen: var(--accent); }
.hb-inkbar .tool.sw-c.c-sage i { --pen: var(--pen-sage); }
.hb-inkbar .tool.sw-c.c-clay i { --pen: var(--pen-clay); }
.hb-inkbar .tool.sw-c.c-slate i { --pen: var(--pen-slate); }
.hb-inkbar .tool.sw-c.c-sand i { --pen: var(--pen-sand); }
.hb-inkbar .tool.sw-c.on { background: var(--hover); box-shadow: inset 0 0 0 1px var(--rule-3); }
.hb-inkbar .tool.smooth { position: relative; }
.hb-inkbar .tool.smooth b { position: absolute; right: 3px; bottom: 2px; font: 700 8px/1 var(--mono); }
/* selection: accent hairline + print crop marks (the resize handles) */
.hb-item.sel > .hb-card, .hb-item.sel > .hb-box { border-color: var(--accent) !important; }
.hb-crop { position: absolute; width: 10px; height: 10px; border: 0 solid var(--accent); z-index: 5; }
.hb-crop.tl { left: -6px; top: -6px; border-width: 1.5px 0 0 1.5px; }
.hb-crop.tr { right: -6px; top: -6px; border-width: 1.5px 1.5px 0 0; }
.hb-crop.bl { left: -6px; bottom: -6px; border-width: 0 0 1.5px 1.5px; }
.hb-crop.br { right: -6px; bottom: -6px; border-width: 0 1.5px 1.5px 0; cursor: nwse-resize; }
.hb-crop.br::before { content: ""; position: absolute; inset: -8px; }
/* shared controls: icons, icon buttons, separators */
.hb .ic { display: block; flex: none; }
.hb .ib { width: 28px; height: 28px; display: inline-grid; place-items: center; flex: none; border-radius: var(--r-ctl); color: var(--ink-2);
  transition: background-color .14s var(--out), color .14s var(--out); }
.hb .ib:hover { background: var(--hover); color: var(--ink); }
.hb .ib:active { background: color-mix(in srgb, var(--ink) 11%, transparent); }
.hb .ib.on { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.hb .ib.danger:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
.hb .ib.lg { width: 30px; height: 30px; }
.hb button:disabled { opacity: .38; cursor: default; pointer-events: none; }
/* selection bar: screen space, fixed size at every zoom, never off the view */
.hb-ctx { position: absolute; left: 0; top: 0; z-index: 30; display: flex; align-items: center; gap: 2px; height: 36px; padding: 0 4px;
  border-radius: var(--r-float); background: var(--float-bg); border: 1px solid var(--float-line); box-shadow: var(--lift);
  white-space: nowrap; font: 500 12px/1 var(--sans); color: var(--ink-2); will-change: transform; animation: hb-pop .14s var(--out); }
.hb-ctx .kind { padding: 0 8px 0 6px; font: 400 10.5px/1 var(--mono); letter-spacing: .04em; color: var(--ink-3); text-transform: lowercase; }
.hb-ctx .sep { width: 1px; height: 18px; margin: 0 4px; background: var(--float-line); flex: none; }
.hb-ctx .hm-mark { display: grid; place-items: center; width: 18px; color: var(--accent); }
.hb-ctx .act { height: 28px; display: inline-flex; align-items: center; gap: 7px; padding: 0 10px 0 8px; border-radius: var(--r-ctl); color: var(--ink);
  transition: background-color .14s var(--out); }
.hb-ctx .act .ic { color: var(--accent); }
.hb-ctx .act:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
@keyframes hb-pop { from { opacity: 0; } to { opacity: 1; } }
.hb-item.connect-from > .hb-card, .hb-item.connect-from > .hb-box { border-color: var(--accent) !important; border-style: dashed !important; }
/* connector being drawn / hover hit */
.hb-wires .draft { stroke: var(--accent); stroke-width: 1.3; fill: none; stroke-dasharray: 4 3; }
/* ── Hermes cursor (world layer, counter-scaled) ── */
.hb-hcur { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 60; transform-origin: 0 0; transition: opacity .4s; }
.hb-hcur.idle { opacity: 0; }
.hb-hcur .arrow { position: absolute; left: -2px; top: -2px; filter: drop-shadow(0 2px 3px rgb(0 0 0 / .6)); }
.hb-hcur .label { position: absolute; left: 15px; top: 19px; display: flex; align-items: stretch; white-space: nowrap; box-shadow: 0 10px 22px -8px rgb(0 0 0 / .8); }
.hb-hcur .name { display: flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px 0 7px; background: var(--accent); color: var(--on-accent); font: 700 10.5px/1 var(--mono); letter-spacing: .14em; }
.hb-hcur .name svg { width: 8px; height: 10px; }
.hb-hcur .act { display: flex; align-items: center; height: 22px; padding: 0 8px; background: var(--on-accent); border: 1px solid var(--accent); border-left: 0; color: var(--ink); font: 400 11.5px/1 var(--mono); }
.hb-hcur .caret { display: inline-block; width: 6px; height: 12px; margin-left: 3px; background: var(--accent); animation: hb-caret 1.06s steps(1) infinite; }
@keyframes hb-caret { 50% { opacity: 0; } }
.hb-trail { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; z-index: 59; }
/* ── chrome: flush strips, like a terminal's title and status lines ── */
.hb-top { position: absolute; left: 0; right: 0; top: 0; height: 44px; display: flex; align-items: center; gap: 14px; padding: 0 10px 0 16px; z-index: 20;
  background: var(--chrome); border-bottom: 1px solid var(--rule); min-width: 0; }
.hb-path { display: flex; align-items: center; gap: 8px; font: 400 11px/1 var(--mono); color: var(--ink-3); white-space: nowrap; flex: none; }
.hb-path button { padding: 4px 2px; color: inherit; border-radius: 2px; transition: color .14s var(--out); }
.hb-path button:hover { color: var(--ink); }
.hb-path .sl { opacity: .6; }
.hb-path .mark { color: var(--accent); display: flex; margin-right: 4px; }
.hb-path .mark svg { width: 13px; height: 16px; }
.hb-btitle { font: 600 14px/1 var(--sans); color: var(--ink); letter-spacing: .002em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 60px; max-width: 32vw; cursor: text; }
.hb-btitle input { width: 100%; font: inherit; }
.hb .vsep { width: 1px; height: 20px; background: var(--rule); flex: none; }
.hb-presence { display: flex; align-items: center; gap: 8px; white-space: nowrap; font: 400 11px/1 var(--mono); color: var(--ink-3); min-width: 0; overflow: hidden; }
.hb-presence b { font-weight: 400; color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.hb .tagh { display: inline-flex; flex: none; align-items: center; gap: 5px; height: 16px; padding: 0 6px; background: var(--accent); color: var(--on-accent); font: 700 9.5px/1 var(--mono); letter-spacing: .14em; white-space: nowrap; }
.hb .tagh svg { width: 8px; height: 10px; flex: none; }
.hb .spacer { flex: 1; min-width: 0; }
.hb-state { display: flex; align-items: center; gap: 14px; font: 400 11px/1 var(--mono); color: var(--ink-3); white-space: nowrap; }
.hb-state b { font-weight: 400; color: var(--ink-2); }
.hb .btn { height: 30px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: var(--r-ctl); font: 600 12.5px/1 var(--sans); white-space: nowrap;
  transition: background-color .14s var(--out), color .14s var(--out); flex: none; }
.hb .btn.text { color: var(--ink-2); }
.hb .btn.text:hover { color: var(--ink); background: var(--hover); }
.hb .btn.primary { background: var(--accent); color: var(--on-accent); padding: 0 12px 0 10px; }
.hb .btn.primary:hover { background: color-mix(in srgb, var(--accent) 86%, #fff); }
.hb .btn.primary:active { transform: translateY(1px); }
.hb-status { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; display: flex; align-items: center; z-index: 20;
  background: var(--chrome); border-top: 1px solid var(--rule); color: var(--ink-2); }
.hb-status .seg { display: flex; align-items: center; gap: 2px; height: 100%; padding: 0 6px; border-right: 1px solid var(--rule); flex: none; }
.hb .tool { width: 30px; height: 28px; display: inline-grid; place-items: center; border-radius: var(--r-ctl); color: var(--ink-2); flex: none;
  transition: background-color .14s var(--out), color .14s var(--out); }
.hb .tool:hover { background: var(--hover); color: var(--ink); }
.hb .tool.on { background: var(--accent); color: var(--on-accent); }
.hb-status .hint { flex: 1; min-width: 0; padding: 0 14px; font: 400 11px/1 var(--mono); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-status .seg:last-child { border-right: 0; }
.hb-status .hint + .seg { border-left: 1px solid var(--rule); }
.hb-status .pct { min-width: 44px; text-align: center; font: 400 11px/1 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.hb.narrow .hb-state .sess { display: none; }
.hb.tiny .hb-state, .hb.tiny .hb-status .hint { display: none; }
/* chat docked on the right: the table, the status line and the map make room */
.hb.chat-open .hb-viewport, .hb.chat-open .hb-status { right: var(--chat-w, 380px); }
.hb.chat-open .hb-map { right: calc(var(--chat-w, 380px) + 12px); }
.hb.chat-open .hb-toast { left: calc((100% - var(--chat-w, 380px)) / 2); }
.hb.chat-float .hb-chat { bottom: 40px; box-shadow: var(--lift); }
.hb-chat { position: absolute; top: 44px; right: 0; bottom: 0; z-index: 21; display: flex; flex-direction: column; min-width: 0;
  background: var(--chrome); border-left: 1px solid var(--rule); user-select: text; animation: hb-slide .18s var(--out); }
@keyframes hb-slide { from { transform: translateX(16px); opacity: 0; } to { transform: none; opacity: 1; } }
.hb-chat .grip { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 2; }
.hb-chat .grip::after { content: ""; position: absolute; left: 3px; top: 0; bottom: 0; width: 2px; background: transparent; transition: background-color .14s var(--out); }
.hb-chat .grip:hover::after, .hb-chat .grip:active::after { background: var(--rule-3); }
.hb-chat .ch-top { height: 40px; flex: none; display: flex; align-items: center; gap: 2px; padding: 0 6px 0 14px; border-bottom: 1px solid var(--rule); }
.hb-chat .ch-top .hd { flex: 1 0 auto; min-width: auto; }
.hb-chat .ch-top .hd:has(+ .hb-model) { flex-grow: 0; }
.hb-chat .ch-top .hd::after { display: none; }
.hb-chat .ch-top .who { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); }
.hb-chat .ch-top .who svg { width: 8px; height: 10px; }
.hb-chat .ch-top .n { text-transform: none; letter-spacing: .04em; }
/* the session's model: Desktop's composer pill (its menu is Desktop's own), or quiet text where
   this surface can't switch it */
.hb-chat .hb-model { display: inline-flex; align-items: center; gap: 4px; height: 26px; min-width: 0; max-width: 60%; flex: 0 1 auto; margin: 0 4px 0 auto;
  padding: 0 8px; border-radius: 6px; font: 400 12px/1 var(--sans); color: var(--ink-3); white-space: nowrap; background: transparent;
  transition: background-color .14s var(--out), color .14s var(--out); }
.hb-chat .hb-model .truncate { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-chat button.hb-model { cursor: pointer; }
.hb-chat button.hb-model:hover, .hb-chat button.hb-model[data-state="open"] { background: var(--hover); color: var(--ink); }
.hb-chat .hb-model.ro { display: block; overflow: hidden; text-overflow: ellipsis; line-height: 26px; cursor: default; }
.hb-chat .hb-model-caret { width: 0; height: 0; border: 3px solid transparent; border-top-color: currentColor; margin-top: 3px; opacity: .5; flex: none; }
.hb-chat .ch-list { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px 10px; display: flex; flex-direction: column; gap: 12px;
  scrollbar-width: thin; scrollbar-color: var(--rule-2) transparent; }
.hb-chat .ch-empty { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 12px; text-align: center; color: var(--ink-3); }
.hb-chat .ch-empty p { margin: 0; max-width: 260px; font: 400 12.5px/1.5 var(--sans); }
/* your turn: the Desktop user bubble */
.hb-chat .ch-user { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.hb-chat .ch-user .bubble { max-width: 92%; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--ui-stroke-tertiary, var(--rule-2));
  background: var(--dt-user-bubble, var(--sheet-2)); font: 400 13px/1.55 var(--sans); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.hb-chat .ch-user time { font: 400 10px/1 var(--mono); color: var(--ink-3); opacity: 0; transition: opacity .14s var(--out); }
.hb-chat .ch-user:hover time { opacity: 1; }
/* Hermes' reply: plain text on the surface, no bubble */
.hb-chat .ch-asst { font: 400 13px/1.6 var(--sans); color: var(--ink); overflow-wrap: anywhere; }
.hb-chat .ch-asst p { margin: 0 0 8px; }
.hb-chat .ch-asst p:last-child { margin-bottom: 0; }
.hb-chat .ch-asst p.h { font-weight: 650; }
.hb-chat .ch-asst ul, .hb-chat .ch-asst ol { margin: 0 0 8px; padding-left: 20px; }
.hb-chat .ch-asst li + li { margin-top: 3px; }
.hb-chat .ch-asst b { font-weight: 650; }
.hb-chat .ch-asst code { font: 400 12px/1 var(--mono); padding: 1px 4px; border-radius: 3px; background: var(--hover); }
.hb-chat .ch-asst pre { margin: 0 0 8px; padding: 8px 10px; border-radius: 6px; background: var(--well); border: 1px solid var(--rule); font: 400 11.5px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.hb-chat .ch-tool { display: flex; align-items: center; gap: 8px; font: 400 10.5px/1.3 var(--mono); color: var(--ink-3); min-width: 0; }
.hb-chat .ch-tool svg { flex: none; color: var(--ink-3); }
.hb-chat .ch-tool .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-chat .ch-working { display: flex; align-items: center; gap: 7px; font: 400 11px/1 var(--mono); color: var(--ink-3); }
.hb-chat .ch-working svg { width: 8px; height: 10px; color: var(--accent); }
.hb-chat .ch-working .caret { display: inline-block; width: 6px; height: 11px; background: var(--accent); animation: hb-caret 1.06s steps(1) infinite; }
.hb-chat .ch-compose { flex: none; padding: 10px 12px 12px; }
.hb-chat .ch-compose .box { border-radius: 10px; border: 1px solid var(--float-line); background: var(--float-bg); padding: 8px 8px 6px 12px;
  transition: border-color .14s var(--out); }
.hb-chat .ch-compose .box:focus-within { border-color: var(--rule-3); }
.hb-chat .ch-compose textarea { display: block; width: 100%; max-height: 160px; padding: 2px 0 6px; font: 400 13px/1.5 var(--sans); color: var(--ink); caret-color: var(--accent); }
.hb-chat .ch-compose textarea::placeholder { color: var(--ink-3); }
.hb-chat .ch-compose .row { display: flex; align-items: center; gap: 8px; min-height: 28px; }
.hb-chat .ch-compose .hint { font: 400 10.5px/1.3 var(--mono); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.hb-chat .ch-compose .chip { font: 400 10.5px/1 var(--mono); color: var(--accent); padding: 4px 6px; border-radius: 3px; background: color-mix(in srgb, var(--accent) 10%, transparent); white-space: nowrap; }
.hb-chat .ch-compose .sp { flex: 1; }
.hb-chat .send { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--accent); color: var(--on-accent);
  transition: background-color .14s var(--out), opacity .14s var(--out); }
.hb-chat .send:hover { background: color-mix(in srgb, var(--accent) 86%, #fff); }
.hb-chat .send:disabled { opacity: .3; }
/* right-click menu */
.hb-menu { position: absolute; z-index: 45; min-width: 208px; max-width: 280px; padding: 4px; border-radius: var(--r-float); background: var(--float-bg);
  border: 1px solid var(--float-line); box-shadow: var(--lift); font: 400 12.5px/1 var(--sans); color: var(--ink); animation: hb-pop .12s var(--out); }
.hb-menu .head { display: flex; align-items: center; gap: 6px; padding: 8px 8px 5px; font: 700 9.5px/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); }
.hb-menu .head svg { width: 7px; height: 9px; color: var(--accent); }
.hb-menu button { width: 100%; height: 28px; display: flex; align-items: center; gap: 10px; padding: 0 8px; border-radius: 4px; text-align: left; outline: none; }
.hb-menu button:hover, .hb-menu button:focus-visible { background: var(--hover); }
.hb-menu button .ico { width: 14px; display: grid; place-items: center; color: var(--ink-3); flex: none; }
.hb-menu button.hm .ico { color: var(--accent); }
.hb-menu button .lb { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-menu button kbd { font: 400 10.5px/1 var(--mono); color: var(--ink-3); }
.hb-menu button.danger { color: var(--danger); }
.hb-menu button.danger .ico { color: var(--danger); }
.hb-menu button.danger:hover, .hb-menu button.danger:focus-visible { background: color-mix(in srgb, var(--danger) 12%, transparent); }
.hb-menu .sep { height: 1px; margin: 4px 6px; background: var(--float-line); }
/* map: the board as a dot matrix (LIFE widget idiom) */
.hb-map { position: absolute; right: 12px; bottom: 52px; width: 196px; z-index: 19; padding: 6px; border-radius: var(--r-panel); background: var(--chrome); border: 1px solid var(--rule);
  cursor: pointer; transition: border-color .16s var(--out), opacity .2s var(--out); }
.hb-map:hover { border-color: var(--rule-2); }
.hb-map.off { opacity: 0; pointer-events: none; }
.hb-map canvas { display: block; width: 184px; height: 100px; }
.hb.narrow .hb-map { display: none; }
/* log: Hermes reports what he changed, in the Home's LOGS voice */
.hb-log { position: absolute; left: 12px; bottom: 52px; z-index: 19; width: min(500px, calc(100% - 260px)); border-radius: var(--r-panel); background: var(--chrome); border: 1px solid var(--rule-2); padding: 10px 36px 10px 12px;
  box-shadow: var(--lift); transition: opacity .2s var(--out), transform .2s var(--out); }
.hb-log.off { opacity: 0; transform: translateY(6px); pointer-events: none; }
.hb-log .row { display: grid; grid-template-columns: 38px auto 1fr; gap: 0 10px; align-items: baseline; font: 400 11px/1.45 var(--mono); }
.hb-log .row + .row { margin-top: 10px; }
.hb-log .t { color: var(--ink-3); }
.hb-log .who { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); font: 700 10px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; }
.hb-log .who svg { width: 7px; height: 9px; }
.hb-log .msg { color: var(--ink); font: 400 13px/1.42 var(--sans); }
.hb-log .acts { grid-column: 3; display: flex; gap: 2px; margin: 6px 0 0 -8px; }
.hb-log .acts button { height: 24px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: var(--r-ctl); font: 500 12px/1 var(--sans); color: var(--ink-2);
  transition: background-color .14s var(--out), color .14s var(--out); }
.hb-log .acts button .ic { color: var(--ink-3); }
.hb-log .acts button:hover { background: var(--hover); color: var(--ink); }
.hb-log .x { position: absolute; right: 6px; top: 6px; width: 24px; height: 24px; }
/* inline dialogs (link / embed input), Home-log voice, no glass */
.hb-ask { position: absolute; left: 50%; top: 64px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 40px)); background: var(--float-bg); border: 1px solid var(--float-line); border-radius: var(--r-float); box-shadow: var(--lift); padding: 14px; animation: hb-pop .14s var(--out); }
.hb-ask .hd { margin-bottom: 10px; }
.hb-ask input, .hb-ask textarea { width: 100%; background: var(--well); border: 1px solid var(--rule); border-radius: var(--r-ctl); padding: 8px 10px; font: 400 12.5px/1.4 var(--mono); color: var(--ink); transition: border-color .14s var(--out); }
.hb-ask input:focus, .hb-ask textarea:focus { border-color: var(--rule-3); }
.hb-ask textarea { height: 160px; }
.hb-ask .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; align-items: center; }
.hb-ask .row .hint { margin-right: auto; font: 400 11.5px/1.35 var(--sans); color: var(--ink-3); }
.hb-toast { position: absolute; left: 50%; bottom: 56px; transform: translateX(-50%); z-index: 41; background: var(--float-bg); border: 1px solid var(--float-line); border-radius: var(--r-float); padding: 8px 12px; font: 500 12px/1.3 var(--sans); color: var(--ink); max-width: 80%; box-shadow: var(--lift); animation: hb-pop .14s var(--out); }
/* empty board: icon, title, one line */
.hb-empty { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; width: min(380px, 80%); pointer-events: none; }
.hb-empty .ico { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 8px; border: 1px solid var(--rule-2); color: var(--accent-soft); }
.hb-empty .hd::before, .hb-empty .hd::after { display: none; }
.hb-empty p { margin: 0; font: 400 13px/1.5 var(--sans); color: var(--ink-3); }
/* ── boards index ── */
.hb-index { position: absolute; inset: 44px 0 0 0; overflow: auto; padding: 36px 40px 60px; user-select: none; }
.hb-index > .hd { font-size: 15px; letter-spacing: .2em; color: var(--accent); max-width: 1180px; }
.hb-index > .hd::before { width: 22px; }
.hb-index .lead { margin: 9px 0 26px 32px; font: 400 13px/1.4 var(--sans); color: var(--ink-2); }
.hb-index .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 18px; max-width: 1180px; }
.hb-index .hb-boardref { width: auto; transition: border-color .16s var(--out); }
.hb-index .hb-boardref:hover { border-color: var(--rule-2); }
.hb-index .hb-boardref:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }
.hb-index .hb-boardref .go { display: grid; place-items: center; color: var(--accent); opacity: 0; transition: opacity .16s var(--out); }
.hb-index .hb-boardref:hover .go { opacity: 1; }
.hb-index .new { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end; gap: 6px; min-height: 172px; padding: 14px; border: 1px dashed var(--rule-2); border-radius: var(--r-card); color: var(--ink-2); font: 600 14px/1.2 var(--sans); text-align: left; transition: border-color .16s var(--out), color .16s var(--out); }
.hb-index .new .plus { width: 30px; height: 30px; display: grid; place-items: center; border-radius: var(--r-ctl); border: 1px solid var(--rule-2); color: var(--accent); margin-bottom: auto; }
.hb-index .new:hover { border-color: var(--rule-3); color: var(--ink); }
.hb-index .new small { font: 400 10.5px/1.3 var(--mono); color: var(--ink-3); }
.hb-index .hb-boardref .del { width: 24px; height: 24px; opacity: 0; }
.hb-index .hb-boardref:hover .del, .hb-index .hb-boardref .del:focus-visible { opacity: 1; }
/* ── Home widget ── */
.hb-widget { display: flex; flex-direction: column; gap: 8px; height: calc(100% - 22px); min-height: 0; cursor: pointer; }
.hb-widget .pvw { position: relative; flex: 1; min-height: 40px; border: 1px solid var(--home-border, rgb(255 227 196 / .13)); border-radius: 3px; overflow: hidden; background: rgb(0 0 0 / .18); transition: border-color .16s ease-out; }
.hb-widget:hover .pvw { border-color: color-mix(in srgb, var(--home-accent, #ffe3c4) 28%, transparent); }
.hb-widget canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hb-widget .foot { display: flex; align-items: baseline; gap: 8px; min-width: 0; padding: 0 2px; font-size: 10.5px; color: var(--color-muted-foreground, #9aa3b5); }
.hb-widget .foot b { font: 600 13px/1.2 var(--dt-font-sans, var(--theme-font-sans, system-ui, sans-serif)); color: var(--color-foreground, #e8e3dc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-widget .foot .sp { flex: 1; }
.hb-widget .tagh { display: inline-flex; align-items: center; gap: 4px; height: 15px; padding: 0 5px; background: var(--home-accent, #ffe3c4); color: #072120; font: 700 9.5px/1 var(--theme-font-mono, ui-monospace, monospace); letter-spacing: .14em; white-space: nowrap; }
.hb-widget .empty { flex: 1; display: grid; place-items: center; text-align: center; color: var(--color-muted-foreground, #9aa3b5); font-size: 11px; line-height: 1.6; }
.hb-widget .empty svg { display: inline-block; color: var(--home-accent, #ffe3c4); opacity: .8; }
.hb-widget .empty b { color: var(--home-accent, #ffe3c4); font-weight: 700; }
.hover-ctl.hb-wctl { gap: 2px; }
.hb-wctl .hv-ic { width: 22px; height: 20px; display: inline-grid; place-items: center; border-radius: 3px; color: var(--home-accent-soft, #c9c2b8); background: none; border: 0; padding: 0; cursor: pointer;
  transition: color .14s ease-out, background-color .14s ease-out; }
.hb-wctl .hv-ic:hover { color: var(--color-foreground, #e8e3dc); background: color-mix(in srgb, var(--home-accent, #ffe3c4) 10%, transparent); }
.hb-wctl .hv-ic svg { display: block; }
/* tooltip: one node on <body>, styled like Desktop's (inverted, small, name + key) */
.hb-tip { position: fixed; left: 0; top: 0; z-index: 2147483000; display: none; align-items: center; gap: 8px; max-width: 280px; padding: 5px 8px;
  border-radius: 4px; background: var(--color-foreground, #ece6dd); color: var(--color-background, #111);
  font: 500 11.5px/1.3 var(--dt-font-sans, var(--theme-font-sans, system-ui, sans-serif)); pointer-events: none; white-space: nowrap;
  box-shadow: 0 6px 16px -6px rgb(0 0 0 / .6); opacity: 0; transform: translateY(2px); transition: opacity .12s ease-out, transform .12s ease-out; }
.hb-tip[data-side="bottom"] { transform: translateY(-2px); }
.hb-tip.on { opacity: 1; transform: none; }
.hb-tip span { overflow: hidden; text-overflow: ellipsis; }
.hb-tip kbd { font: 500 10.5px/1 var(--theme-font-mono, ui-monospace, monospace); padding: 2px 4px; border-radius: 3px; margin-left: -2px;
  background: color-mix(in srgb, var(--color-background, #111) 10%, transparent); border: 1px solid color-mix(in srgb, var(--color-background, #111) 18%, transparent); }
.hb-tip kbd + kbd { margin-left: -4px; }
@media (prefers-reduced-motion: reduce) { .hb-tip { transition: none; transform: none; } }
/* ── live card: a terminal status panel, one accent, data in mono ── */
.hb-live { overflow: hidden; container-type: inline-size; cursor: default; }
.hb-live > * + * { border-top: 1px solid var(--rule); }
.hb-live .lv-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 11px; align-items: center; padding: 13px 14px 12px 14px; }
.hb-live .lv-head .ico { width: 28px; height: 28px; display: grid; place-items: center; border-radius: var(--r-ctl); border: 1px solid var(--rule-2); color: var(--accent-soft); }
.hb-live .lv-head .tt { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.hb-live .lv-head b { font: 600 14px/1.2 var(--sans); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-live .lv-head small { font: 400 10.5px/1.2 var(--mono); color: var(--ink-3); letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* status pill: the Hermes-cursor name tag idiom (solid block, mono caps) */
.hb .lv-pill { display: inline-flex; align-items: center; gap: 5px; height: 19px; padding: 0 7px; border-radius: 2px; border: 1px solid var(--rule-3);
  font: 700 9.5px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); white-space: nowrap; }
.hb .lv-pill.running { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.hb .lv-pill .caret { width: 5px; height: 9px; background: currentColor; animation: hb-caret 1.06s steps(1) infinite; }
.hb .lv-pill .bars { width: 6px; height: 8px; border-left: 2px solid currentColor; border-right: 2px solid currentColor; }
.hb .lv-pill.done { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.hb .lv-pill.error { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 60%, transparent); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.hb .lv-pill.idle { color: var(--ink-3); border-color: var(--rule-2); }
.hb .lv-pill.stale { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 55%, transparent); background: color-mix(in srgb, var(--warn) 8%, transparent); }
.hb-live .lv-prog { padding: 11px 14px 12px; }
.hb-live .lv-prog .row { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.hb-live .lv-prog .lb { flex: 1; min-width: 0; font: 400 12.5px/1.2 var(--sans); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-live .lv-prog .pc { font: 600 12px/1 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.hb-live .lv-prog .eta { font: 400 10.5px/1 var(--mono); color: var(--ink-3); white-space: nowrap; }
.hb-live .lv-prog .cells { margin-top: 9px; gap: 2px; }
.hb-live .lv-prog .cells i { height: 5px; }
.hb-live .lv-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); }
.hb-live .lv-metrics .m { display: flex; flex-direction: column; gap: 5px; padding: 10px 14px 11px; min-width: 0; box-shadow: inset -1px 0 0 var(--rule), inset 0 -1px 0 var(--rule); margin: 0 -1px -1px 0; }
/* line-height + block padding leave room for the accent of an uppercase É/Í/Ó; overflow:hidden clips at the line box */
.hb-live .lv-metrics .k { font: 700 9px/1.5 var(--mono); padding-block: 3px 1px; margin-block: -3px -1px; letter-spacing: .15em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-live .lv-metrics .v { font: 600 18px/1.15 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-live .lv-metrics .v em { font: 400 11px/1 var(--mono); font-style: normal; color: var(--ink-3); margin-left: 3px; }
.hb-live .lv-metrics .d { font: 400 10.5px/1 var(--mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
.hb-live .lv-metrics .d.good { color: var(--accent); }
.hb-live .lv-metrics .d.bad { color: var(--warn); }
.hb-live .lv-spark { padding: 10px 14px 12px; }
.hb-live .lv-spark .row { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.hb-live .lv-spark .k { font: 700 9px/1.5 var(--mono); padding-block: 3px 1px; margin-block: -3px -1px; letter-spacing: .15em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-live .lv-spark .sp { flex: 1; }
.hb-live .lv-spark .rng { font: 400 10px/1 var(--mono); color: var(--ink-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
.hb-live .lv-spark b { font: 600 12px/1 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.hb-live .lv-spark .plot { position: relative; height: 44px; margin-top: 8px; color: var(--accent);
  background: repeating-linear-gradient(0deg, transparent 0 10px, color-mix(in srgb, var(--accent) 5%, transparent) 10px 11px); }
.hb-live .lv-spark svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.hb-live .lv-spark .line { fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linejoin: round; stroke-linecap: round; }
.hb-live .lv-spark .dot { position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; background: var(--accent); box-shadow: 0 0 0 2px var(--sheet); }
.hb-live .lv-media .stage, .hb-live .lv-media .still { position: relative; aspect-ratio: 16 / 9; background: #000; overflow: hidden; }
.hb-live .lv-media .still img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hb-live .lv-media .cap { padding: 8px 14px 9px; font: 400 10.5px/1.35 var(--mono); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px solid var(--rule); }
.hb-live .lv-log { position: relative; padding: 9px 14px 10px; background: var(--well); }
.hb-live .lv-log .k { display: block; margin-bottom: 6px; font: 700 9px/1.5 var(--mono); letter-spacing: .15em; text-transform: uppercase; color: var(--ink-3); }
.hb-live .lv-log pre { margin: 0; font: 400 10.5px/1.6 var(--mono); color: var(--ink-3); white-space: pre-wrap; overflow-wrap: anywhere;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14px); mask-image: linear-gradient(to bottom, transparent 0, #000 14px); user-select: text; }
.hb-live .lv-log pre .last { color: var(--ink-2); }
.hb-live .lv-log.prose pre { font: 400 12px/1.5 var(--sans); -webkit-mask-image: none; mask-image: none; }
.hb-live .lv-foot { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 8px 6px 14px; flex-wrap: wrap; }
.hb-live .lv-foot .fr { display: inline-flex; align-items: center; gap: 7px; font: 400 10.5px/1 var(--mono); color: var(--ink-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
.hb-live .lv-foot .fr i { width: 6px; height: 6px; background: var(--accent); flex: none; transition: box-shadow .5s var(--out); }
.hb-live .lv-foot .fr.tick i { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent); }
.hb-live .lv-foot .fr.rest i { background: var(--ink-3); }
.hb-live .lv-foot .fr.stale { color: var(--warn); }
.hb-live .lv-foot .fr.stale i { background: var(--warn); }
.hb-live .lv-foot .sp { flex: 1; }
.hb-live .lv-foot .sig { margin-right: 4px; }
.hb-live .lv-bw { display: inline-flex; }
.hb-live .lv-btn { height: 28px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px 0 9px; border-radius: var(--r-ctl); border: 1px solid var(--rule-2);
  font: 600 12px/1 var(--sans) !important; color: var(--ink) !important; transition: background-color .14s var(--out), border-color .14s var(--out), color .14s var(--out); }
.hb-live .lv-btn .ic { color: var(--accent-soft); }
.hb-live .lv-btn:hover { background: var(--hover); border-color: var(--rule-3); }
.hb-live .lv-btn.danger .ic { color: var(--danger); }
.hb-live .lv-btn.danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); border-color: color-mix(in srgb, var(--danger) 55%, transparent); color: var(--danger) !important; }
.hb-live .lv-btn:disabled { opacity: .45; }
.hb-live .lv-btn .spin { width: 12px; height: 12px; border: 1.5px solid var(--rule-3); border-top-color: var(--accent); border-radius: 50%; animation: hb-spin .8s linear infinite; }
@keyframes hb-spin { to { transform: rotate(360deg); } }
/* stale: the numbers fade back, the pill and the footer say why */
.hb-live.stale .lv-metrics .v, .hb-live.stale .lv-prog .pc, .hb-live.stale .lv-spark b { color: var(--ink-2); }
.hb-live.stale .lv-prog .cells i.on, .hb-live.stale .lv-spark .dot { background: color-mix(in srgb, var(--accent) 45%, transparent); }
.hb-live.stale .lv-spark .plot { color: color-mix(in srgb, var(--accent) 50%, transparent); }
.hb-live.st-error .lv-head .ico { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, transparent); }
/* result toast on the card itself */
.hb-live .lv-toast { position: absolute; left: 10px; right: 10px; bottom: 46px; z-index: 3; display: flex; align-items: flex-start; gap: 8px; padding: 9px 11px;
  border-radius: var(--r-float); background: var(--float-bg); border: 1px solid var(--float-line); box-shadow: var(--lift); font: 500 12px/1.35 var(--sans); color: var(--ink);
  cursor: pointer; animation: hb-toast-in .18s var(--out); overflow-wrap: anywhere; }
.hb-live .lv-toast .ic { color: var(--accent); margin-top: 1px; }
.hb-live .lv-toast.err { border-color: color-mix(in srgb, var(--danger) 45%, transparent); }
.hb-live .lv-toast.err .ic { color: var(--danger); }
@keyframes hb-toast-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
/* sizes: narrow cards stack metrics in pairs, wide ones get room to breathe.
   Columns follow the metric count (data-n) so four values share one row at the default width
   instead of ellipsizing; below 380px they pair up, and 4+ values shrink to 16px under 480px. */
.hb-live .lv-metrics[data-n="1"] { grid-template-columns: 1fr; }
.hb-live .lv-metrics[data-n="2"] { grid-template-columns: 1fr 1fr; }
.hb-live .lv-metrics[data-n="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.hb-live .lv-metrics[data-n="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.hb-live .lv-metrics[data-n="5"], .hb-live .lv-metrics[data-n="6"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.hb-live .lv-metrics[data-n="7"], .hb-live .lv-metrics[data-n="8"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@container (max-width: 479px) {
  .hb-live .lv-metrics[data-n="4"] .v, .hb-live .lv-metrics[data-n="7"] .v, .hb-live .lv-metrics[data-n="8"] .v { font-size: 16px; }
}
@container (max-width: 379px) {
  .hb-live .lv-metrics[data-n="3"], .hb-live .lv-metrics[data-n="4"], .hb-live .lv-metrics[data-n="5"], .hb-live .lv-metrics[data-n="6"], .hb-live .lv-metrics[data-n="7"], .hb-live .lv-metrics[data-n="8"] { grid-template-columns: 1fr 1fr; }
  .hb-live .lv-metrics .v { font-size: 18px !important; }
}
@container (max-width: 280px) {
  .hb-live .lv-metrics[data-n] { grid-template-columns: 1fr 1fr; }
  .hb-live .lv-head { grid-template-columns: minmax(0, 1fr) auto; gap: 9px; padding: 11px 12px 10px; }
  .hb-live .lv-head .ico { display: none; }
  .hb-live .lv-spark .rng { display: none; }
  .hb-live .lv-btn span { display: none; }
  .hb-live .lv-btn { padding: 0 8px; }
}
@container (min-width: 520px) {
  .hb-live .lv-head { padding: 15px 16px 14px; }
  .hb-live .lv-head b { font-size: 15.5px; }
  .hb-live .lv-metrics .v { font-size: 21px; }
  .hb-live .lv-metrics .m { padding: 12px 16px 13px; }
  .hb-live .lv-spark .plot { height: 58px; }
}
/* video: duration badge, the paused-element fallback */
.hb-video .stage video.still, .hb-live .stage video.still { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; opacity: .86; }
.hb .stage .dur { position: absolute; right: 10px; top: 10px; font: 500 10.5px/1 var(--mono); color: #f3ece3; background: rgb(0 0 0 / .62); padding: 4px 6px; border-radius: 2px; letter-spacing: .02em; font-variant-numeric: tabular-nums; pointer-events: none; }
.hb .stage { position: relative; }
.hb-live .stage img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .9; }
.hb-live .stage video:not(.still) { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; background: #000; }
.hb-live .stage .play { position: absolute; left: 12px; bottom: 12px; display: inline-flex; align-items: center; gap: 8px; height: 28px; padding: 0 11px 0 9px; border-radius: var(--r-ctl); background: var(--accent); color: var(--on-accent) !important; font: 600 12.5px/1 var(--sans) !important; }
.hb-live .stage .play svg { width: 9px; height: 11px; fill: currentColor; }
.hb-live .stage .poster-empty { position: absolute; inset: 0; display: grid; place-items: center; font: 400 11px/1 var(--mono); color: var(--ink-3);
  background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent) 6%, transparent) 0 1px, transparent 1px 24px), var(--well); }
/* confirm dialog for destructive actions: modal, Cancel focused, Esc cancels */
.hb-scrim { position: absolute; inset: 0; z-index: 50; background: rgb(0 0 0 / .42); display: grid; place-items: center; animation: hb-pop .14s var(--out); }
.hb-confirm { width: min(440px, calc(100% - 40px)); padding: 16px 16px 14px; border-radius: var(--r-float); background: var(--float-bg); border: 1px solid var(--float-line); box-shadow: var(--lift); }
.hb-confirm .hd { color: var(--danger); margin-bottom: 12px; }
.hb-confirm h3 { margin: 0; display: flex; align-items: center; gap: 10px; font: 600 16px/1.3 var(--sans); color: var(--ink); }
.hb-confirm h3 .ico { width: 28px; height: 28px; display: grid; place-items: center; flex: none; border-radius: var(--r-ctl); color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
.hb-confirm p { margin: 10px 0 0 38px; font: 400 13px/1.5 var(--sans); color: var(--ink-2); }
.hb-confirm .facts { margin: 12px 0 0 38px; display: flex; flex-wrap: wrap; gap: 4px 14px; font: 400 10.5px/1.4 var(--mono); color: var(--ink-3); }
.hb-confirm .facts b { font-weight: 400; color: var(--ink-2); }
.hb-confirm .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.hb .btn.danger { background: var(--danger); color: #fff; padding: 0 12px 0 10px; }
.hb .btn.danger:hover { background: color-mix(in srgb, var(--danger) 86%, #fff); }
@media (prefers-reduced-motion: reduce) {
  .hb *, .hb *::before, .hb *::after { animation: none !important; transition: none !important; }
}
@keyframes hb-dot-in { from { opacity: 0; } }
.hb-wires .fresh rect.d { animation: hb-dot-in .2s both; }
.hb-item.reveal-wait { visibility: hidden; }
.hb-wire-labels { z-index: 4; }
.hb-wires .lbl { font: 400 10.5px var(--mono); fill: var(--ink-2); paint-order: stroke; stroke: var(--bg); stroke-width: 7px; stroke-linejoin: round; }
.hb-wires .line-sel { stroke: var(--accent); stroke-width: 1.5; fill: none; stroke-dasharray: 3 3; }
.hb-ghost { position: absolute; pointer-events: none; z-index: 50; opacity: .92; box-shadow: var(--lift); }
/* ── direct manipulation (1.9.3) ──
 * Cursors: the arrow over cards, a move cursor once selected, an I-beam where text is being
 * edited. Text inside an editing card is selectable and never starts a pan or a drag. */
.hb-item { cursor: default; }
.hb-item.sel { cursor: move; }
.hb-item.sel .hb-crop.br { cursor: nwse-resize; }
.hb .edit, .hb .hb-lbl-edit { cursor: text; user-select: text; -webkit-user-select: text; }
.hb-link h4 a, .hb-video h4 a { cursor: inherit; text-decoration: none; }
.hb-item .hb-link h4 a:hover, .hb-item .hb-video h4 a:hover { text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent); text-underline-offset: 3px; }
/* ── snap guides: 1px at every zoom, the accent, only while dragging ── */
.hb-guides { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 60; }
.hb-guide { position: absolute; background: var(--accent); opacity: .8; pointer-events: none; }
.hb-guide.x { width: calc(1px * var(--iz, 1)); }
.hb-guide.y { height: calc(1px * var(--iz, 1)); }
/* ── flowchart shapes: the box's hairline, in any outline ── */
.hb-shape { position: relative; width: 100%; height: 100%; display: grid; place-items: center; color: var(--ink); }
.hb-shape .o { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
.hb-shape .o path { fill: var(--sheet-2); stroke: var(--rule-2); stroke-width: 1; transition: stroke .16s; }
.hb-item:hover > .hb-shape .o path { stroke: var(--rule-3); }
.hb-item.sel > .hb-shape .o path { stroke: var(--accent); }
.hb-shape .t { position: relative; max-width: 100%; padding: 6px 12px; text-align: center; font: 600 13px/1.25 var(--sans); overflow-wrap: anywhere; }
.hb-shape .t .edit { text-align: center; font: inherit; }
.hb-shape.diamond .t { max-width: 66%; padding: 4px 0; }
.hb-shape.circle .t { max-width: 80%; padding: 2px 0; font-size: 12px; }
/* Hermes' material: the outline in dots, same 2px / 4px rhythm as his cards */
.hb-shape.by-h .o path { stroke: var(--accent); stroke-width: 2; stroke-linecap: butt; stroke-dasharray: 2 2; fill: var(--sheet); }
.hb-item.sel > .hb-shape.by-h .o path { stroke: var(--accent); }
/* ── connector: label field and the "+" insert handle ── */
.hb-wires .hb-lbl-edit { width: 100%; height: 22px; padding: 0 6px; text-align: center; border-radius: var(--r-ctl); background: var(--bg);
  border: 1px solid var(--accent); font: 400 10.5px var(--mono); color: var(--ink); }
.hb-wires .hb-eplus { cursor: pointer; pointer-events: all; animation: hb-pop .12s var(--out); }
.hb-wires .hb-eplus .pad { fill: transparent; }
.hb-wires .hb-eplus .dot { fill: var(--float-bg, var(--bg)); stroke: var(--accent); stroke-width: 1.25; transition: fill .14s var(--out); }
.hb-wires .hb-eplus .pl { stroke: var(--accent); stroke-width: 1.6; stroke-linecap: round; fill: none; }
.hb-wires .hb-eplus:hover .dot { fill: color-mix(in srgb, var(--accent) 22%, var(--bg)); }
/* ── insert picker: same family as the selection bar ── */
.hb-epick { position: absolute; z-index: 40; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; max-width: 380px; padding: 3px 4px;
  border-radius: var(--r-float); background: var(--float-bg); border: 1px solid var(--float-line); box-shadow: var(--lift); animation: hb-pop .14s var(--out); }
.hb-epick .kind { padding: 0 8px 0 6px; font: 400 10.5px/1 var(--mono); letter-spacing: .04em; color: var(--ink-3); text-transform: lowercase; }
.hb-epick .sep { width: 1px; height: 18px; margin: 0 4px; background: var(--float-line); flex: none; }
.hb-epick .row2 { flex-basis: 100%; display: flex; align-items: center; gap: 2px; padding-top: 3px; margin-top: 3px; border-top: 1px solid var(--float-line); }
/* a card with a fixed height (an imported file excerpt) clips its body and fades out at the bottom */
.hb-item > .hb-card.capped { height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.hb-card.capped > .body { flex: 1 1 auto; min-height: 0; overflow: hidden; -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 48px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 48px), transparent); }
`;
const HOME_DESKTOP_PATH = "/home";
const BOARDS_DESKTOP_PATH = "/boards";
const DESKTOP_START_KEY = "home-dashboard.opened-this-start";
const ENGLISH_LABELS = { home: "Home", open: "Open Home" };
function createHomeContributions(render, navigate = () => void 0, labels = ENGLISH_LABELS) {
  return [
    {
      id: "page",
      area: "routes",
      title: labels.home,
      order: -1e3,
      data: { path: HOME_DESKTOP_PATH },
      render
    },
    {
      id: "nav",
      area: "sidebar.nav",
      order: -1e3,
      data: { path: HOME_DESKTOP_PATH, label: labels.home, codicon: "home" }
    },
    {
      id: "open",
      area: "palette",
      order: -1e3,
      data: {
        id: "home.open",
        label: labels.open,
        keywords: ["home", "dashboard", "widgets", labels.home.toLowerCase()],
        run: () => navigate(HOME_DESKTOP_PATH)
      }
    }
  ];
}
function isAuxiliaryDesktopWindow(search) {
  try {
    return new URLSearchParams(search).has("win");
  } catch {
    return false;
  }
}
function openHomeOnDesktopStart(storage, navigate, search = "") {
  if (isAuxiliaryDesktopWindow(search)) {
    return false;
  }
  if (storage.getItem(DESKTOP_START_KEY) === "1") {
    return false;
  }
  storage.setItem(DESKTOP_START_KEY, "1");
  navigate(HOME_DESKTOP_PATH);
  return true;
}
function createBoardContributions(render, navigate = () => void 0, labels = { boards: "Boards", open: "Open boards" }) {
  return [
    { id: "boards-page", area: "routes", title: labels.boards, order: -990, data: { path: BOARDS_DESKTOP_PATH }, render },
    { id: "boards-nav", area: "sidebar.nav", order: -990, data: { path: BOARDS_DESKTOP_PATH, label: labels.boards, codicon: "layout" } },
    {
      id: "boards-open",
      area: "palette",
      order: -990,
      data: {
        id: "boards.open",
        label: labels.open,
        keywords: ["board", "boards", "canvas", "whiteboard", labels.boards.toLowerCase()],
        run: () => navigate(BOARDS_DESKTOP_PATH)
      }
    }
  ];
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PLUGIN_API_PREFIX = "/api/plugins/home-dashboard";
function query(path, params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== void 0) search.set(key, String(value));
  });
  const suffix = search.toString();
  return suffix ? `${path}?${suffix}` : path;
}
function desktopRoute(path) {
  const routes = {
    "/system": "/command-center?section=system",
    "/sessions": "/",
    "/cron": "/cron",
    "/logs": "/command-center?section=logs"
  };
  return routes[path] ?? path;
}
function createDesktopHomeHost(ctx, desktop, extras = {}) {
  const api2 = {
    getStatus: () => desktop.status(),
    getSystemStats: () => ctx.rest("/system"),
    getAnalytics: (days) => ctx.rest(query("/analytics", { days })),
    getModelsAnalytics: (days) => ctx.rest(query("/models", { days })),
    getCronJobs: (profile) => ctx.rest(query("/cron", { profile })),
    getSessions: (limit, offset) => ctx.rest(query("/sessions", { limit, offset })),
    getLogs: (params) => desktop.logs(params)
  };
  return {
    api: api2,
    async fetchJSON(url, init) {
      if (url !== PLUGIN_API_PREFIX && !url.startsWith(`${PLUGIN_API_PREFIX}/`)) {
        throw new Error(`Desktop Home cannot access API path: ${url}`);
      }
      const path = url.slice(PLUGIN_API_PREFIX.length) || "/";
      const options = {};
      if (init?.method) options.method = init.method;
      if (init?.body !== void 0 && init.body !== null) {
        options.body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      }
      return ctx.rest(path, options);
    },
    navigateTo: (path) => desktop.navigate(desktopRoute(path)),
    openSession: (id) => {
      if (typeof desktop.openSession === "function") {
        void Promise.resolve(desktop.openSession(id)).catch(() => desktop.navigate(desktopRoute("/sessions")));
      } else {
        desktop.navigate(desktopRoute("/sessions"));
      }
    },
    onEvent: (type, listener) => desktop.onEvent(type, listener),
    openBoard: (id) => desktop.navigate(id ? `/boards?id=${encodeURIComponent(id)}` : "/boards"),
    newChatWithDraft: async (text, opts) => {
      if (typeof desktop.newChat !== "function" || typeof desktop.composer?.setDraft !== "function") return false;
      await Promise.resolve(desktop.newChat());
      for (let i = 0; i < 10; i++) {
        if (opts?.settleMs !== 0) await wait(opts?.settleMs ?? 150);
        if (await desktop.composer.setDraft("new", text).catch(() => false)) {
          desktop.composer.focus?.("new");
          return true;
        }
        if (opts?.settleMs === 0) break;
      }
      return false;
    },
    rpc: typeof desktop.request === "function" ? (method, params) => desktop.request(method, params) : void 0,
    SandboxedFrame: extras.SandboxedFrame,
    modelMenu: extras.modelMenu
  };
}
const isComponent = (v) => typeof v === "function" || !!v && typeof v === "object" && "$$typeof" in v;
const fn = (v) => typeof v === "function" ? v : void 0;
function pickerSdk(ns) {
  const sdk = ns ?? {};
  const close = sdk.ModelMenuCloseContext;
  const { ModelCatalogMenu, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } = sdk;
  if (!isComponent(ModelCatalogMenu) || !isComponent(close?.Provider) || !isComponent(DropdownMenu) || !isComponent(DropdownMenuTrigger) || !isComponent(DropdownMenuContent)) return null;
  const host2 = sdk.host ?? {};
  const icons = sdk.icons ?? {};
  const request = fn(host2.request);
  const notifyError = fn(host2.notifyError);
  return {
    ModelCatalogMenu,
    CloseProvider: close.Provider,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    Button: isComponent(sdk.Button) ? sdk.Button : void 0,
    Chevron: isComponent(icons.ChevronDown) ? icons.ChevronDown : void 0,
    DropdownMenuItem: isComponent(sdk.DropdownMenuItem) ? sdk.DropdownMenuItem : void 0,
    Codicon: isComponent(sdk.Codicon) ? sdk.Codicon : void 0,
    useQueryClient: fn(sdk.useQueryClient),
    surfaceModelSwitchConfirm: fn(sdk.surfaceModelSwitchConfirm),
    request: request ? (m, p) => request.call(host2, m, p) : void 0,
    notifyError: notifyError ? (e, f) => notifyError.call(host2, e, f) : void 0
  };
}
const PILL = "min-w-0 shrink gap-1 rounded-md px-2 text-xs font-normal text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground";
function createModelMenuHost(ns) {
  const sdk = pickerSdk(ns);
  if (!sdk) return void 0;
  const { ModelCatalogMenu, CloseProvider, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Codicon, Button, Chevron } = sdk;
  function Picker({ controller, sessionId, profile, label, title, refreshLabel, className }) {
    const [open, setOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const queryClient = sdk.useQueryClient?.();
    const ctl = {
      ...controller,
      select: async (model, provider) => {
        const ok = await controller.select(model, provider);
        if (ok !== false) void queryClient?.invalidateQueries({ queryKey: ["model-options"] });
        return ok;
      }
    };
    const refresh = async () => {
      if (refreshing || !sdk.request) return;
      setRefreshing(true);
      try {
        await sdk.request("model.options", { session_id: sessionId, refresh: true, explicit_only: true });
      } catch {
      } finally {
        setRefreshing(false);
        void queryClient?.invalidateQueries({ queryKey: ["model-options"] });
      }
    };
    const footer = DropdownMenuItem && sdk.request ? /* @__PURE__ */ jsxs(
      DropdownMenuItem,
      {
        className: "gap-2 rounded-none px-2.5 py-1 text-xs text-(--ui-text-tertiary)",
        disabled: refreshing,
        onSelect: (e) => {
          e.preventDefault();
          void refresh();
        },
        children: [
          Codicon ? /* @__PURE__ */ jsx(Codicon, { name: "sync", size: "0.75rem", spinning: refreshing }) : null,
          refreshLabel
        ]
      }
    ) : void 0;
    const body = /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("span", { className: "truncate", children: label }),
      Chevron ? /* @__PURE__ */ jsx(Chevron, { className: "size-2.5 shrink-0 opacity-50" }) : /* @__PURE__ */ jsx("span", { "aria-hidden": "true", className: "hb-model-caret" })
    ] });
    const triggerProps = {
      "aria-label": title,
      "data-tip": title,
      className: `${PILL} hb-model ${className ?? ""}`,
      type: "button"
    };
    return /* @__PURE__ */ jsxs(DropdownMenu, { open, onOpenChange: (v) => setOpen(!!v), children: [
      /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: Button ? /* @__PURE__ */ jsx(Button, { ...triggerProps, variant: "ghost", children: body }) : /* @__PURE__ */ jsx("button", { ...triggerProps, children: body }) }),
      /* @__PURE__ */ jsx(DropdownMenuContent, { align: "end", className: "w-72 p-0", side: "bottom", sideOffset: 6, children: /* @__PURE__ */ jsx(CloseProvider, { value: () => setOpen(false), children: /* @__PURE__ */ jsx(ModelCatalogMenu, { controller: ctl, footer, includeMoa: true, profile, request: sdk.request, sessionId }) }) })
    ] });
  }
  const confirm = sdk.surfaceModelSwitchConfirm ? (o) => sdk.surfaceModelSwitchConfirm({
    confirmMessage: o.message,
    failureMessage: o.failureMessage,
    model: o.model,
    requestConfirmed: o.requestConfirmed
  }) : void 0;
  const notifyError = sdk.notifyError ? (error, fallback) => {
    try {
      sdk.notifyError(error, fallback);
    } catch {
    }
  } : void 0;
  return { Picker, confirm, notifyError };
}
installDemo();
function DesktopHomePage() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("style", { children: homeCss + boardCss }),
    /* @__PURE__ */ jsx(HomePage, {})
  ] });
}
function DesktopBoardsPage() {
  const route2 = useBoardRoute();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("style", { children: homeCss + boardCss }),
    /* @__PURE__ */ jsx("div", { className: "home-board-page desktop", children: /* @__PURE__ */ jsx(BoardApp, { route: route2 ?? null, onHome: () => host.navigate("/home") }) })
  ] });
}
const LANGUAGE_PROBE = "homeLanguageProbe";
function followDesktopLanguage(ctx) {
  const i18n = ctx.i18n;
  if (!i18n || typeof i18n.register !== "function" || typeof i18n.t !== "function") return;
  try {
    i18n.register(Object.fromEntries(LANGUAGES.map((id) => [id, { [LANGUAGE_PROBE]: id }])));
    const sync = () => {
      const value = i18n.t(LANGUAGE_PROBE);
      setHostLanguage(value && value !== LANGUAGE_PROBE ? value : null);
    };
    sync();
    i18n.onLocaleChange?.(sync);
  } catch {
  }
}
const plugin = {
  id: "home-dashboard",
  name: "Home",
  defaultEnabled: true,
  register(ctx) {
    const SandboxedFrame = PluginSdk.SandboxedFrame;
    const modelMenu = createModelMenuHost(PluginSdk);
    configureHomeHost(createDesktopHomeHost(ctx, host, { SandboxedFrame, modelMenu }));
    followDesktopLanguage(ctx);
    ctx.registerMany(
      createHomeContributions(
        () => /* @__PURE__ */ jsx(DesktopHomePage, {}),
        (path) => host.navigate(path),
        // Sidebar / palette labels are registered once, in the language
        // active at load time.
        { home: t("nav.home"), open: t("nav.open") }
      )
    );
    ctx.registerMany(
      createBoardContributions(
        () => /* @__PURE__ */ jsx(DesktopBoardsPage, {}),
        (path) => host.navigate(path),
        { boards: t("nav.boards"), open: t("nav.openBoards") }
      )
    );
    window.setTimeout(() => {
      openHomeOnDesktopStart(
        window.sessionStorage,
        (path) => host.navigate(path),
        window.location.search
      );
    }, 0);
  }
};
export {
  plugin as default
};
