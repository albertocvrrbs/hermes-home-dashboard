import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import * as PluginSdk from "@hermes/plugin-sdk";
import { host } from "@hermes/plugin-sdk";
import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle, useLayoutEffect } from "react";
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
  getLogs: (params) => getHost().api.getLogs(params)
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
  "ascii.art.pyramid": "pyramid",
  "ascii.art.diamond": "diamond",
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
  "board.state.session": "session",
  "board.state.noSession": "no session yet",
  "board.continue": "Continue in session",
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
  "board.embed.title": "embed.html",
  "board.embed.sandbox": "sandbox: scripts only, no network",
  "board.embed.reload": "Reload",
  "board.embed.taller": "Taller",
  "board.embed.activate": "Click to interact",
  "board.embed.live": "live html",
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
  "board.hint.pan": "Drag to move around the board",
  "board.hint.place": "Click on the board to place it · Esc to cancel",
  "board.hint.arrow": "Drag from one card to another",
  "board.hint.draw": "Draw freely · Esc to stop",
  "board.hint.connect": "Click the card to connect to · Esc to cancel",
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
  "board.index.open": "Open board",
  "board.widget.empty": "No boards yet.",
  "board.kind.live": "live card",
  "board.video.uploaded": "uploaded video",
  "board.video.noPoster": "no preview yet",
  "board.video.loading": "Loading…",
  "board.toast.uploadingVideo": "uploading video… {pct} %",
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
  "ascii.art.pyramid": "pirámide",
  "ascii.art.diamond": "diamante",
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
  "board.state.session": "sesión",
  "board.state.noSession": "sin sesión todavía",
  "board.continue": "Continuar en sesión",
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
  "board.embed.title": "embed.html",
  "board.embed.sandbox": "aislado: solo scripts, sin red",
  "board.embed.reload": "Recargar",
  "board.embed.taller": "Más alto",
  "board.embed.activate": "Clic para usar",
  "board.embed.live": "html en vivo",
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
  "board.hint.pan": "Arrastra para moverte por el pizarrón",
  "board.hint.place": "Haz clic en el pizarrón para colocarlo · Esc para cancelar",
  "board.hint.arrow": "Arrastra de una tarjeta a otra",
  "board.hint.draw": "Dibuja libre · Esc para terminar",
  "board.hint.connect": "Haz clic en la tarjeta a conectar · Esc para cancelar",
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
  "board.index.open": "Abrir pizarrón",
  "board.widget.empty": "Todavía no hay pizarrones.",
  "board.kind.live": "tarjeta viva",
  "board.video.uploaded": "video subido",
  "board.video.noPoster": "sin vista previa aún",
  "board.video.loading": "Cargando…",
  "board.toast.uploadingVideo": "subiendo video… {pct} %",
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
function setHostLanguage(language) {
  hostLanguage = language ?? null;
  const next = computeLanguage();
  if (next === current$1) return;
  current$1 = next;
  listeners.forEach((l) => l());
}
const translators = /* @__PURE__ */ new Map();
function translatorFor(language) {
  let fn = translators.get(language);
  if (!fn) {
    fn = (key, vars) => translate(DICTIONARIES, language, key, vars);
    translators.set(language, fn);
  }
  return fn;
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
function reflow(box, others) {
  const moved = /* @__PURE__ */ new Map();
  const rest = others.map((i) => ({ ...i })).sort((a, b) => a.gy - b.gy);
  const placed = [box];
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
      const box = { gx, gy, gw: size.gw, gh: size.gh };
      if (!layout.some((w) => collide(box, w))) return { gx, gy };
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
function asciiArtClass(name) {
  return name === "caduceus" ? "home-ascii home-ascii-caduceus" : "home-ascii";
}
const CADUCEUS = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⡀⠀⣀⣀⠀⢀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
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
const PAD$1 = "⠀";
const INK = "⣿";
const W = 29;
function row(lead, fill) {
  return PAD$1.repeat(lead) + INK.repeat(fill) + PAD$1.repeat(Math.max(0, W - lead - fill));
}
const pyramid = Array.from({ length: 15 }, (_, r) => row(14 - r, 2 * r + 1)).join("\n");
const diamond = Array.from({ length: 15 }, (_, r) => {
  const k = Math.min(r, 14 - r);
  return row(14 - k, 2 * k + 1);
}).join("\n");
const ARTS = [
  { name: "caduceus", label: "ascii.art.caduceus", art: CADUCEUS },
  { name: "pyramid", label: "ascii.art.pyramid", art: pyramid },
  { name: "diamond", label: "ascii.art.diamond", art: diamond }
];
function AsciiWidget({ status, widgetProps, onWidgetPropsChange }) {
  const t2 = useT();
  const version = status?.version;
  const raw = typeof widgetProps.artIndex === "number" ? widgetProps.artIndex : 0;
  const idx = (raw % ARTS.length + ARTS.length) % ARTS.length;
  const cycle = (dir) => onWidgetPropsChange({ ...widgetProps, artIndex: (idx + dir + ARTS.length) % ARTS.length });
  return /* @__PURE__ */ jsxs("div", { className: "home-ascii-wrap", children: [
    /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => cycle(-1), onNext: () => cycle(1), label: t2(ARTS[idx].label) }),
    /* @__PURE__ */ jsx("div", { className: asciiArtClass(ARTS[idx].name), children: ARTS[idx].art }),
    /* @__PURE__ */ jsxs("div", { className: "home-ascii-ver", children: [
      "HERMES-AGENT",
      version ? ` · v${version}` : ""
    ] })
  ] });
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
    /* @__PURE__ */ jsx("div", { className: "home-clock-sub", children: now.toLocaleDateString(void 0, { weekday: "long", day: "numeric", month: "long" }) })
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
function hostOf$1(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
function Row$1({ label, val }) {
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
        /* @__PURE__ */ jsx("span", { children: status.gateway_state ?? "—" })
      ] }),
      platforms.map(([name, p]) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: name }),
        /* @__PURE__ */ jsx("span", { className: p.state === "running" ? "ok" : "dim", children: p.state })
      ] }, name))
    ] }),
    /* @__PURE__ */ jsx("div", { className: "hover-reveal", children: /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      status.gateway_pid != null && /* @__PURE__ */ jsx(Row$1, { label: t2("gateway.pid"), val: String(status.gateway_pid) }),
      status.gateway_exit_reason && /* @__PURE__ */ jsx(Row$1, { label: t2("gateway.exit"), val: status.gateway_exit_reason.slice(0, 28) }),
      status.gateway_health_url && /* @__PURE__ */ jsx(Row$1, { label: t2("gateway.health"), val: hostOf$1(status.gateway_health_url) }),
      /* @__PURE__ */ jsx(Row$1, { label: t2("gateway.config"), val: configStr }),
      /* @__PURE__ */ jsx(Row$1, { label: t2("gateway.version"), val: `v${status.version}` })
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
function toBars(daily, byMonth) {
  if (!byMonth) {
    return daily.map((d) => {
      const date = parseDay(d.day);
      const label = isNaN(date.getTime()) ? d.day : date.toLocaleDateString(void 0, { month: "short", day: "numeric" });
      return { key: d.day, label, tokens: d.input_tokens + d.output_tokens, cost: d.estimated_cost };
    });
  }
  const months = /* @__PURE__ */ new Map();
  for (const d of daily) {
    const date = parseDay(d.day);
    const valid = !isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : d.day.slice(0, 7);
    const label = valid ? date.toLocaleDateString(void 0, { month: "short" }) : key;
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
  const idx = RANGES.findIndex((r) => r.key === rangeKey);
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
    api.getModelsAnalytics(range.days).then((r) => {
      if (!cancelled) setModels(Array.isArray(r?.models) ? r.models : []);
    }).catch(() => {
      if (!cancelled) setModelsFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [group, range.days]);
  useEffect(() => {
    let cancelled = false;
    setFetched(null);
    setFailed(false);
    api.getAnalytics(range.days).then((r) => {
      if (!cancelled) setFetched(r);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [range.days]);
  const setProp = (patch) => onWidgetPropsChange({ ...widgetProps, ...patch });
  const cycle = (dir) => setProp({ range: RANGES[(idx + dir + RANGES.length) % RANGES.length].key });
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
    () => toBars(view?.daily ?? [], range.byMonth),
    [view, range.byMonth]
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
  const H = 100, W2 = 100, PAD2 = 3;
  const coords = bars.map((b, i) => [
    n <= 1 ? W2 / 2 : i / (n - 1) * W2,
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
            " · $",
            tip.bar.cost.toFixed(2)
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
            x: i * W2 / n,
            y: 0,
            width: W2 / n,
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
      /* @__PURE__ */ jsxs("span", { children: [
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
          title: t2("tokens.rowTitle", {
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
function areaPath(line, H) {
  if (!line || !line.includes("L") || line.indexOf("M", 1) !== -1) return "";
  const firstX = line.slice(1, line.indexOf(","));
  const lastX = line.slice(line.lastIndexOf("L") + 1, line.lastIndexOf(","));
  return `${line} L${lastX},${H} L${firstX},${H} Z`;
}
function seriesPath(values, max, W2, H, pad2) {
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
    const x = n <= 1 ? W2 / 2 : i / (n - 1) * W2;
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
function Row({ label, val }) {
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
  const H = 100, W2 = 100, PAD2 = 6;
  const line = seriesPath(values, max, W2, H, PAD2);
  const area = areaPath(line, H);
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
      line && /* @__PURE__ */ jsx(
        "path",
        {
          d: line,
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
      setBuf((prev) => pushSample(prev, toSample(s, Date.now()), BUFFER_CAP));
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
      system.load_avg && system.load_avg.length >= 3 && /* @__PURE__ */ jsx(Row, { label: t2("host.load"), val: system.load_avg.slice(0, 3).map((n) => n.toFixed(2)).join(" ") }),
      system.cpu_count !== null && /* @__PURE__ */ jsx(Row, { label: t2("host.cores"), val: String(system.cpu_count) }),
      system.memory && /* @__PURE__ */ jsx(Row, { label: t2("host.ram"), val: `${(system.memory.used / GB).toFixed(1)} / ${(system.memory.total / GB).toFixed(1)}G` }),
      system.disk && /* @__PURE__ */ jsx(Row, { label: t2("host.disk"), val: t2("host.diskFree", { n: (system.disk.free / GB).toFixed(0) }) }),
      system.process && /* @__PURE__ */ jsx(Row, { label: t2("host.proc"), val: t2("host.procValue", { mb: (system.process.rss / MB).toFixed(0), threads: system.process.num_threads }) }),
      /* @__PURE__ */ jsx(Row, { label: t2("host.os"), val: `${system.platform} ${system.arch}` })
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
function parseRecords(lines) {
  const out = [];
  for (const line of lines) {
    const raw = line.replace(/[\r\n]+$/, "");
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
  const idx = FILES.indexOf(fileKey);
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
  const cycle = (dir) => onWidgetPropsChange({ ...widgetProps, file: FILES[(idx + dir + FILES.length) % FILES.length] });
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
    const paint = (e) => {
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
      paint(e);
    };
    const onMove = (e) => {
      if (drawing) paint(e);
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
const monthName = (mo) => new Date(2024, mo, 1).toLocaleDateString(void 0, { month: "short" }).replace(/\.$/, "").toUpperCase();
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
  const dateLabel = !Number.isNaN(targetMs) ? new Date(targetMs).toLocaleDateString(void 0, { month: "short", day: "numeric" }) : t2("count.setDate");
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
  const monthLabel = view.toLocaleDateString(void 0, { month: "long", year: "numeric" });
  const dayLetters = Array.from(
    { length: 7 },
    (_, i) => new Date(2024, 0, i + 1).toLocaleDateString(void 0, { weekday: "narrow" })
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
        p.lastUpdated && /* @__PURE__ */ jsx("div", { className: "project-detail-row dim", children: t2("projects.updated", { when: new Date(p.lastUpdated).toLocaleString() }) })
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
function SpendWidget({ widgetProps, onWidgetPropsChange, editing, gridSize }) {
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
  const idx = SPEND_RANGES.indexOf(range);
  const cycle = (dir) => setProp({ range: SPEND_RANGES[(idx + dir + SPEND_RANGES.length) % SPEND_RANGES.length] });
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
  return d.toLocaleDateString(void 0, { month: "short", day: "numeric" }).toLowerCase();
}
function clock(ts) {
  const d = new Date(ts * 1e3);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function RichText({ text }) {
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
function toolNames(name, args) {
  if (!name || QUIET.has(name)) return [];
  if (name === "tool_call") {
    const calls = args?.calls;
    const inner = Array.isArray(calls) ? calls.map((c) => typeof c?.name === "string" ? c.name : "").filter(Boolean) : [];
    return inner.length ? inner : [name];
  }
  return [name];
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
function toChatRows(raw) {
  const out = [];
  raw.forEach((r, i) => {
    const role = r.role;
    const key = r.row_id != null ? `r${r.row_id}` : `i${i}-${r.timestamp ?? ""}`;
    const t2 = typeof r.timestamp === "number" ? r.timestamp : void 0;
    if (r.row_kind === "compaction") return;
    if (role === "tool") {
      const names = toolNames(r.name || r.tool_name || "tool", r.args);
      if (!names.length) return;
      const last = out[out.length - 1];
      if (last?.role === "tool") {
        names.forEach((n) => {
          if (!last.tools.includes(n)) last.tools.push(n);
        });
        return;
      }
      out.push({ key, role: "tool", text: "", t: t2, tools: names });
      return;
    }
    if (role !== "user" && role !== "assistant") return;
    let text = textOf(r).trim();
    if (role === "user") text = text.replace(MARKER, "").replace(SELECTION_TAIL, "");
    const calls = (r.tool_calls ?? []).flatMap((c) => toolNames(c?.function?.name || c?.name || "", parseArgs(c?.function?.arguments)));
    if (text) out.push({ key, role, text, t: t2 });
    if (calls.length) {
      const last = out[out.length - 1];
      if (last?.role === "tool") {
        calls.forEach((n) => {
          if (!last.tools.includes(n)) last.tools.push(n);
        });
      } else out.push({ key: `${key}c`, role: "tool", text: "", t: t2, tools: [...new Set(calls)] });
    }
  });
  return out;
}
function boardPrompt(doc, text, selected, selectedLabel) {
  const sel = selected.filter((id) => doc.items[id]);
  return `[board:${doc.id}] ${text.trim()}${sel.length ? ` (${selectedLabel}: ${sel.join(", ")})` : ""}`;
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
async function sendToSession(doc, body) {
  const rpc = hostRpc();
  if (rpc) {
    const submit = async (sid) => {
      await rpc("prompt.submit", { session_id: sid, text: body });
    };
    try {
      let sid = liveSessions.get(doc.id);
      if (sid) {
        try {
          await submit(sid);
          return "sent";
        } catch {
          liveSessions.delete(doc.id);
          sid = void 0;
        }
      }
      if (doc.session?.id) {
        const r = await rpc("session.resume", { session_id: doc.session.id, omit_messages: true, lazy: true });
        sid = r?.session_id;
      } else {
        const r = await rpc("session.create", {});
        sid = r?.session_id;
      }
      if (sid) {
        liveSessions.set(doc.id, sid);
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
const Bot = [
  ["path", { d: "M12 8V4H8" }],
  ["rect", { width: "16", height: "12", x: "4", y: "8", rx: "2" }],
  ["path", { d: "M2 14h2" }],
  ["path", { d: "M20 14h2" }],
  ["path", { d: "M15 13v2" }],
  ["path", { d: "M9 13v2" }]
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
const CircleCheck = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "m9 12 2 2 4-4" }]
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
const Download = [
  ["path", { d: "M12 15V3" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
  ["path", { d: "m7 10 5 5 5-5" }]
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
const Gauge = [
  ["path", { d: "m12 14 4-4" }],
  ["path", { d: "M3.34 19a10 10 0 1 1 17.32 0" }]
];
const GitBranch = [
  ["path", { d: "M15 6a9 9 0 0 0-9 9V3" }],
  ["circle", { cx: "18", cy: "6", r: "3" }],
  ["circle", { cx: "6", cy: "18", r: "3" }]
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
const Image = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
  ["circle", { cx: "9", cy: "9", r: "2" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
];
const LayoutDashboard = [
  ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1" }],
  ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1" }],
  ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1" }],
  ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1" }]
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
const PanelRightClose = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
  ["path", { d: "M15 3v18" }],
  ["path", { d: "m8 9 3 3-3 3" }]
];
const Pause = [
  ["rect", { x: "14", y: "3", width: "5", height: "18", rx: "1" }],
  ["rect", { x: "5", y: "3", width: "5", height: "18", rx: "1" }]
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
const Server = [
  ["rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2" }],
  ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2" }],
  ["line", { x1: "6", x2: "6.01", y1: "6", y2: "6" }],
  ["line", { x1: "6", x2: "6.01", y1: "18", y2: "18" }]
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
const SquareTerminal = [
  ["path", { d: "m7 11 2-2-2-2" }],
  ["path", { d: "M11 13h4" }],
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }]
];
const Square = [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]];
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
const Undo2 = [
  ["path", { d: "M9 14 4 9l5-5" }],
  ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" }]
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
  undo: Undo2,
  redo: Redo2,
  edit: Pencil,
  duplicate: Copy,
  delete: Trash2,
  connect: MoveUpRight,
  open: SquareArrowOutUpRight,
  openBoard: ArrowUpRight,
  chat: MessageSquareText,
  closePanel: PanelRightClose,
  send: ArrowUp,
  close: X,
  plus: Plus,
  prev: ChevronLeft,
  next: ChevronRight,
  reload: RotateCw,
  taller: Maximize2,
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
  alert: CircleAlert,
  check: Check
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
const CHAT_MIN_W = 300;
const CHAT_MAX_W = 640;
function inline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return /* @__PURE__ */ jsx("b", { children: p.slice(2, -2) }, i);
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return /* @__PURE__ */ jsx("code", { children: p.slice(1, -1) }, i);
    return /* @__PURE__ */ jsx("span", { children: p }, i);
  });
}
function Md({ text }) {
  const blocks = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(/* @__PURE__ */ jsx("pre", { children: code.join("\n") }, blocks.length));
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items = [];
      const ordered = /^\s*\d/.test(line);
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const L = ordered ? "ol" : "ul";
      blocks.push(/* @__PURE__ */ jsx(L, { children: items.map((x, j) => /* @__PURE__ */ jsx("li", { children: inline(x) }, j)) }, blocks.length));
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```") && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++]);
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
          /* @__PURE__ */ jsxs("span", { className: "hd", children: [
            /* @__PURE__ */ jsxs("span", { className: "who", children: [
              /* @__PURE__ */ jsx(Cad, {}),
              "hermes"
            ] }),
            sessionId && /* @__PURE__ */ jsxs("span", { className: "n", children: [
              "#",
              sessionId.slice(-4)
            ] })
          ] }),
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
          shown.map((r) => r.role === "tool" ? /* @__PURE__ */ jsxs("div", { className: "ch-tool", children: [
            /* @__PURE__ */ jsx("span", { className: "dot" }),
            r.tools.slice(0, 4).join(" · "),
            r.tools.length > 4 ? ` +${r.tools.length - 4}` : ""
          ] }, r.key) : r.role === "user" ? /* @__PURE__ */ jsxs("div", { className: "ch-user", children: [
            /* @__PURE__ */ jsx("div", { className: "bubble", children: r.text }),
            r.t ? /* @__PURE__ */ jsx("time", { children: clock(r.t) }) : null
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
function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
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
function toStroke(pts) {
  const r = pts.map(([x2, y2]) => [Math.round(x2), Math.round(y2)]);
  const x = Math.min(...r.map((p) => p[0]));
  const y = Math.min(...r.map((p) => p[1]));
  return { x, y, d: r.map(([px, py]) => `${px - x},${py - y}`).join(" ") };
}
function fromStroke(d) {
  if (!d) return [];
  return d.split(" ").map((pair) => pair.split(",").map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
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
function headPath(x, y, dir, L = 7, W2 = 4) {
  const [dx, dy] = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[dir];
  return `M${x} ${y} L${x - dx * L - dy * W2} ${y - dy * L + dx * W2} L${x - dx * L + dy * W2} ${y - dy * L - dx * W2}Z`;
}
function samplePolyline(pts, step) {
  const out = [];
  let carry = step / 2;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let s = carry;
    while (s <= len) {
      const t2 = s / len;
      out.push([Math.round((ax + (bx - ax) * t2) * 10) / 10, Math.round((ay + (by - ay) * t2) * 10) / 10]);
      s += step;
    }
    carry = s - len;
  }
  return out;
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
const RESIZE_H = /* @__PURE__ */ new Set(["frame", "box", "embed", "text"]);
function resizePatch(kind, w, h) {
  const p = { w: Math.round(Math.max(120, w)) };
  if (RESIZE_H.has(kind)) p.h = Math.round(Math.max(40, h));
  return p;
}
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.4;
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
  const k = e.ctrlKey || e.metaKey ? 0.01 : 15e-4;
  return Math.exp(-px * k);
}
function zoomView(v, f, sx, sy, min = ZOOM_MIN, max = ZOOM_MAX) {
  const z = Math.min(max, Math.max(min, v.z * f));
  const wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
  return { z, x: sx - wx * z, y: sy - wy * z };
}
const MOVE_MS = 300;
const DWELL_MS = 110;
const TRAIL = 16;
const ease = (t2) => t2 < 0.5 ? 4 * t2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 3) / 2;
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
    const paint = (x, y, act) => {
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
        paint(s.pos.x, s.pos.y);
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
        paint(target.x, target.y, next.act);
        next.onArrive?.();
        s.running = false;
        setTimeout(run, 60);
        return;
      }
      const t0 = performance.now();
      const frame = (now) => {
        const k = Math.min(1, (now - t0) / MOVE_MS);
        const e = ease(k);
        paint(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e, next.act);
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
const clone = (v) => v === void 0 ? v : JSON.parse(JSON.stringify(v));
function insertKid(items, col, id, at) {
  const c = items[col];
  if (!c || c.k !== "col") return;
  const kids = c.kids ?? (c.kids = []);
  if (kids.includes(id)) return;
  const idx = at == null ? kids.length : Math.max(0, Math.min(kids.length, Math.round(at)));
  kids.splice(idx, 0, id);
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
    case "board":
      if (typeof op.p.name === "string") doc.name = op.p.name;
      return;
  }
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
  live: [360, 300]
};
function liveHeight(item) {
  const w = item.w ?? 360;
  let h = 40;
  for (const b of item.blocks ?? []) {
    h += { header: 60, progress: 46, metrics: 74, spark: 66, media: Math.round(w * 9 / 16) + 26, text: 22 + 16 * (b.t === "text" ? b.lines ?? 6 : 0), actions: 46 }[b.t] ?? 40;
  }
  return h;
}
function approxRect(item) {
  if (item.k === "line" || item.in || item.x == null || item.y == null) return null;
  const [dw, dh] = DEFAULT_SIZE[item.k] ?? [200, 100];
  let h = item.h ?? dh;
  if (item.k === "col") h = 60 + 96 * (item.kids?.length ?? 0);
  if (item.k === "todo") h = 110 + 26 * (item.items?.length ?? 0);
  if (item.k === "live") h = item.h ?? liveHeight(item);
  if (item.k === "draw" && item.d) {
    const pts = item.d.split(" ").map((p) => p.split(",").map(Number));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: item.x + Math.min(...xs), y: item.y + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
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
function drawPreview(canvas, doc, opts) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W2 = canvas.clientWidth, H = canvas.clientHeight;
  if (!W2 || !H) return;
  if (canvas.width !== Math.round(W2 * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W2 * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W2, H);
  const cell = opts.cell ?? 6;
  const rects = doc ? previewRects(doc) : [];
  const b = boundsOf(rects.map((x) => x.r)) ?? { x: 0, y: 0, w: 1, h: 1 };
  const pad2 = 30;
  const s = Math.min(W2 / (b.w + pad2 * 2), H / (b.h + pad2 * 2));
  const ox = (W2 - b.w * s) / 2 - b.x * s, oy = (H - b.h * s) / 2 - b.y * s;
  ctx.fillStyle = opts.accent;
  for (let y = cell / 2; y < H; y += cell) {
    for (let x = cell / 2; x < W2; x += cell) {
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
function VideoStage({ playId, c, src, asset, posterAsset, posterUrl, dur, title, vert }) {
  const poster = useVideoPoster(src, asset, posterAsset, posterUrl, dur);
  const playing = c.playing === playId;
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
  return /* @__PURE__ */ jsxs("div", { className: `stage${vert ? " vert" : ""}`, children: [
    playing && url && /* @__PURE__ */ jsx("video", { src: url, controls: true, autoPlay: true, preload: "metadata", "data-nodrag": "", title }),
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
    const body = fmt === "pct" ? `${trimNum(Math.abs(v), 1)}` : fmt === "usd" ? `$${Math.abs(v).toFixed(2)}` : fmt === "dur" ? fmtDuration(Math.abs(v)) : trimNum(Math.abs(v), 2);
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
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const area = n > 1 ? `${line} L${xy[n - 1][0]} ${h} L${xy[0][0]} ${h} Z` : "";
  return { line, area, last: xy[n - 1], min: lo ?? Math.min(...pts), max: hi ?? Math.max(...pts) };
}
function tailLines(v, n) {
  const lines = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.replace(/\s+$/, "").split("\n") : [];
  return lines.slice(-Math.max(1, n));
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
  const W2 = 300, H = 44;
  const s = sparkPaths(series, W2, H, typeof lo === "number" ? lo : void 0, typeof hi === "number" ? hi : void 0);
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
      /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W2} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ jsx("stop", { offset: "0", stopColor: "currentColor", stopOpacity: ".22" }),
          /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "currentColor", stopOpacity: "0" })
        ] }) }),
        /* @__PURE__ */ jsx("path", { className: "area", d: s.area, fill: `url(#${gid})` }),
        /* @__PURE__ */ jsx("path", { className: "line", d: s.line, vectorEffect: "non-scaling-stroke" })
      ] }),
      s.last && /* @__PURE__ */ jsx("i", { className: "dot", style: { left: `${s.last[0] / W2 * 100}%`, top: `${s.last[1] / H * 100}%` } })
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
  const lines = tailLines(resolve(b.value, data), b.lines ?? 6);
  if (!lines.length || lines.length === 1 && !lines[0].trim()) return null;
  return /* @__PURE__ */ jsxs("div", { className: `lv-log${b.mono === false ? " prose" : ""}`, children: [
    b.label && /* @__PURE__ */ jsx("span", { className: "k", children: lbl(t2, resolve(b.label, data)) }),
    /* @__PURE__ */ jsx("pre", { children: lines.map((l, i) => /* @__PURE__ */ jsxs("span", { className: i === lines.length - 1 ? "last" : void 0, children: [
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
        body.push(/* @__PURE__ */ jsx("div", { className: "lv-metrics", children: b.items.map((m, j) => /* @__PURE__ */ jsx(Metric, { m, data, t: t2 }, j)) }, i));
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
      style: { width: item.w ?? 360 },
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
function EditText({ value, onDone, placeholder, className, single }) {
  const ref = useRef(null);
  const [v, setV] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
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
      onBlur: () => onDone(v),
      onKeyDown: (e) => {
        e.stopPropagation();
        if (e.key === "Escape" || e.key === "Enter" && (e.metaKey || e.ctrlKey || single)) {
          e.preventDefault();
          e.target.blur();
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
    return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-note${item.by === "h" ? " dm" : ""}`, children: [
      /* @__PURE__ */ jsx("h4", { children: /* @__PURE__ */ jsx(
        EditText,
        {
          single: true,
          value: item.title ?? "",
          placeholder: c.t("board.card.titlePh"),
          onDone: (v) => {
            if (v !== (item.title ?? "")) c.update(id, { title: v.trim() || null });
          }
        }
      ) }),
      /* @__PURE__ */ jsx("div", { className: "body", children: /* @__PURE__ */ jsx(
        EditText,
        {
          value: text,
          placeholder: c.t("board.card.textPh"),
          onDone: (v) => {
            c.setEditing(null);
            if (v !== text) c.update(id, { text: v || null });
          }
        }
      ) })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-note${quote ? " quote" : ""}${item.by === "h" ? " dm" : ""}`, children: [
    item.title && /* @__PURE__ */ jsx("h4", { children: item.title }),
    text ? /* @__PURE__ */ jsx("div", { className: "body", children: /* @__PURE__ */ jsx(RichText, { text }) }) : !item.title && /* @__PURE__ */ jsx("div", { className: "body", style: { opacity: 0.5 }, children: c.t("board.card.empty") }),
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
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-todo${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 304 }, children: [
    c.editing === id ? /* @__PURE__ */ jsx("div", { className: "hd", children: /* @__PURE__ */ jsx(EditText, { single: true, value: item.title ?? "", onDone: (v) => {
      c.setEditing(null);
      c.update(id, { title: v.trim() || null });
    } }) }) : /* @__PURE__ */ jsxs("div", { className: "hd", children: [
      item.title || c.t("board.todo.title"),
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
      editRow === i ? /* @__PURE__ */ jsx("span", { className: "l", children: /* @__PURE__ */ jsx(EditText, { single: true, value: x.t, onDone: (v) => {
        setEditRow(null);
        if (!v.trim()) set(items.filter((_, j) => j !== i));
        else if (v !== x.t) set(items.map((y, j) => j === i ? { ...y, t: v.trim() } : y));
      } }) }) : /* @__PURE__ */ jsx("span", { className: "l", onDoubleClick: (e) => {
        e.stopPropagation();
        setEditRow(i);
      }, children: x.t }),
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
    c.editing === id ? /* @__PURE__ */ jsx("div", { className: "hd", children: /* @__PURE__ */ jsx(EditText, { single: true, value: item.title ?? "", onDone: (v) => {
      c.setEditing(null);
      c.update(id, { title: v.trim() || null });
    } }) }) : /* @__PURE__ */ jsxs("div", { className: "hd", children: [
      item.title || c.t("board.col.title"),
      /* @__PURE__ */ jsx("span", { className: "n", children: kids.length }),
      item.by === "h" && /* @__PURE__ */ jsx("span", { className: "n sig", children: /* @__PURE__ */ jsx(Cad, {}) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `track${dropIndex != null ? " drop" : ""}`, "data-col": id, children: [
      kids.map((k, i) => /* @__PURE__ */ jsxs("div", { style: { display: "contents" }, children: [
        dropIndex === i && /* @__PURE__ */ jsx("div", { className: "drop-line" }),
        c.renderKid(k)
      ] }, k)),
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
  const site = item.site || (item.url ? hostOf(item.url) : direct ? hostOf(direct) : asset ? c.t("board.video.uploaded") : "");
  const title = item.title || (direct ? direct.split("/").pop() : "") || c.t("board.video.untitled");
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-video${vert ? " vert" : ""}${item.by === "h" ? " dm" : ""}`, children: [
    player ? /* @__PURE__ */ jsxs("div", { className: "stage", children: [
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
      !playing && (poster ? /* @__PURE__ */ jsx("img", { src: poster, alt: "", draggable: false }) : /* @__PURE__ */ jsx("div", { className: "poster-empty", children: site })),
      !playing && /* @__PURE__ */ jsxs("button", { className: "play", "data-nodrag": "", onClick: () => c.setPlaying(id), children: [
        PLAY,
        c.t("board.video.play")
      ] })
    ] }) : /* @__PURE__ */ jsx(VideoStage, { playId: id, c, src: direct, asset, posterAsset: item.img, dur: item.dur, title }),
    /* @__PURE__ */ jsx("div", { className: "hb-link", children: /* @__PURE__ */ jsxs("div", { className: "body", children: [
      /* @__PURE__ */ jsx("div", { className: "dom", children: /* @__PURE__ */ jsx("span", { children: site }) }),
      /* @__PURE__ */ jsx("h4", { children: item.url ? /* @__PURE__ */ jsx("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", "data-nodrag": "", children: title }) : title }),
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
    (thumb || waiting) && /* @__PURE__ */ jsx("div", { className: `thumb${waiting ? " skel-thumb" : ""}`, children: thumb && /* @__PURE__ */ jsx("img", { src: thumb, alt: "", draggable: false }) }),
    /* @__PURE__ */ jsxs("div", { className: "body", children: [
      /* @__PURE__ */ jsxs("div", { className: "dom", children: [
        icon && /* @__PURE__ */ jsx("img", { src: icon, alt: "" }),
        /* @__PURE__ */ jsx("span", { children: item.url ? hostOf(item.url) : site })
      ] }),
      waiting ? /* @__PURE__ */ jsxs("div", { className: "skel", children: [
        /* @__PURE__ */ jsx("i", {}),
        /* @__PURE__ */ jsx("i", {}),
        /* @__PURE__ */ jsx("i", {})
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("h4", { children: /* @__PURE__ */ jsx("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", "data-nodrag": "", children: item.title || (failed ? site : item.url) }) }),
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
function ImageView({ id, item, c }) {
  const url = useAsset(item.asset);
  const ratio = item.iw && item.ih ? item.ih / item.iw : 0.6;
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-image${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 372 }, children: [
    /* @__PURE__ */ jsx("div", { className: "art", style: !url ? { aspectRatio: `${1 / ratio}` } : void 0, children: url && /* @__PURE__ */ jsx("img", { src: url, alt: item.cap ?? "", draggable: false }) }),
    /* @__PURE__ */ jsxs("div", { className: "cap", children: [
      c.editing === id ? /* @__PURE__ */ jsx("b", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
        EditText,
        {
          single: true,
          value: item.cap ?? "",
          placeholder: c.t("board.image.capPh"),
          onDone: (v) => {
            c.setEditing(null);
            c.update(id, { cap: v.trim() || null });
          }
        }
      ) }) : /* @__PURE__ */ jsx("b", { children: item.cap || (item.url ? hostOf(item.url) : "") }),
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
  useEffect(() => {
    let live = true;
    if (item.asset) assetHtml(item.asset).then((h) => live && setHtml(h), () => live && setHtml(""));
    return () => {
      live = false;
    };
  }, [item.asset]);
  const Frame = c.Frame;
  const active = c.playing === id;
  const height = tall ? 520 : item.h ? Math.max(120, item.h - 80) : 240;
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-embed${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 452 }, children: [
    /* @__PURE__ */ jsxs("div", { className: "bar-e", children: [
      /* @__PURE__ */ jsx("span", { className: "file", children: item.title || c.t("board.embed.title") }),
      /* @__PURE__ */ jsx("span", { className: "sb", children: c.t("board.embed.sandbox") }),
      /* @__PURE__ */ jsxs("span", { className: "tools", children: [
        /* @__PURE__ */ jsx("button", { className: "kbtn", "data-nodrag": "", "data-tip": c.t("board.embed.reload"), "aria-label": c.t("board.embed.reload"), onClick: () => setNonce((n) => n + 1), children: /* @__PURE__ */ jsx(Icon, { name: "reload", size: 13 }) }),
        /* @__PURE__ */ jsx("button", { className: "kbtn", "data-nodrag": "", "data-tip": c.t("board.embed.taller"), "aria-label": c.t("board.embed.taller"), onClick: () => setTall((v) => !v), children: /* @__PURE__ */ jsx(Icon, { name: "taller", size: 13 }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { "data-nodrag": "", style: { height, position: "relative" }, children: [
      !active && /* @__PURE__ */ jsx("button", { className: "shield", "aria-label": c.t("board.embed.activate"), onClick: () => c.setPlaying(id), children: /* @__PURE__ */ jsx("span", { children: c.t("board.embed.activate") }) }),
      html == null ? /* @__PURE__ */ jsx("div", { className: "frame", style: { height } }) : Frame ? /* @__PURE__ */ jsx(Frame, { src: toDataUrl(html), title: item.title || "embed", className: "frame", style: { height } }, nonce) : /* @__PURE__ */ jsx(
        "iframe",
        {
          className: "frame",
          style: { height },
          sandbox: "allow-scripts",
          srcDoc: html,
          title: item.title || "embed",
          referrerPolicy: "no-referrer"
        },
        nonce
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
    let live = true;
    if (item.ref) loadBoardDoc(item.ref, true).then((d) => live && setChild(d));
    return () => {
      live = false;
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
        /* @__PURE__ */ jsx("div", { className: "pv", children: /* @__PURE__ */ jsx(BoardPreview, { doc: child }) }),
        /* @__PURE__ */ jsxs("div", { className: "ttl", children: [
          /* @__PURE__ */ jsx("b", { children: child?.name ?? item.title ?? c.t("board.ref.missing") }),
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
      c.editing === id ? /* @__PURE__ */ jsx(EditText, { single: true, value: item.title ?? "", onDone: (v) => {
        c.setEditing(null);
        c.update(id, { title: v.trim() || null });
      } }) : item.title || c.t("board.frame.title"),
      item.note && /* @__PURE__ */ jsx("em", { children: item.note })
    ] })
  ] });
}
function BoxView({ id, item, c }) {
  return /* @__PURE__ */ jsxs("div", { className: "hb-box", children: [
    item.num && /* @__PURE__ */ jsx("span", { className: "num", children: item.num }),
    /* @__PURE__ */ jsxs("span", { style: { minWidth: 0 }, children: [
      c.editing === id ? /* @__PURE__ */ jsx("b", { children: /* @__PURE__ */ jsx(EditText, { single: true, value: item.title ?? "", onDone: (v) => {
        c.setEditing(null);
        c.update(id, { title: v.trim() || null });
      } }) }) : /* @__PURE__ */ jsx("b", { children: item.title || "…" }),
      item.sub && /* @__PURE__ */ jsx("small", { children: item.sub })
    ] })
  ] });
}
function TextView({ id, item, c }) {
  const size = item.size === "h" || item.size === "s" ? item.size : "p";
  if (c.editing === id) {
    return /* @__PURE__ */ jsx("div", { className: `hb-text ${size}`, children: /* @__PURE__ */ jsx(
      EditText,
      {
        single: size === "h",
        value: item.text ?? "",
        onDone: (v) => {
          c.setEditing(null);
          c.update(id, { text: v || null });
        }
      }
    ) });
  }
  return /* @__PURE__ */ jsx("div", { className: `hb-text ${size}`, children: item.text || c.t("board.text.empty") });
}
function DrawView({ item, selected }) {
  const pts = fromStroke(item.d);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const pad2 = 6;
  const minX = Math.min(...xs) - pad2, minY = Math.min(...ys) - pad2;
  const w = Math.max(...xs) - minX + pad2, h = Math.max(...ys) - minY + pad2;
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: `hb-draw${selected ? " sel" : ""}`,
      width: w,
      height: h,
      viewBox: `${minX} ${minY} ${w} ${h}`,
      style: { position: "absolute", left: minX, top: minY },
      children: /* @__PURE__ */ jsx("path", { d: strokePath(pts), strokeWidth: item.sw ?? 1.9 })
    }
  );
}
function ItemBody({ id, item, c, dropIndex, selected }) {
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
    case "frame":
      return /* @__PURE__ */ jsx(FrameView, { id, item, c });
    case "box":
      return /* @__PURE__ */ jsx(BoxView, { id, item, c });
    case "text":
      return /* @__PURE__ */ jsx(TextView, { id, item, c });
    case "draw":
      return /* @__PURE__ */ jsx(DrawView, { item, selected });
    case "live":
      return /* @__PURE__ */ jsx(LiveView, { id, item, c });
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
function useBoard(bid, onHermesEntries) {
  const [confirmed, setConfirmed] = useState(null);
  const [pending, setPending] = useState([]);
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
      setError(String(e?.message ?? e));
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
    const ops = pending.flatMap((p) => p.ops);
    return ops.length ? applyOps(confirmed, ops) : confirmed;
  }, [confirmed, pending]);
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
function endRect(end, getRect) {
  if (end == null) return null;
  if (Array.isArray(end)) return { x: end[0], y: end[1], w: 0, h: 0 };
  return getRect(end);
}
function Wires({ doc, getRect, version, hidden, fresh, selected, draft, onSelect }) {
  const [wires, setWires] = useState([]);
  useLayoutEffect(() => {
    const out = [];
    for (const [id, it] of Object.entries(doc.items)) {
      if (it.k !== "line" || hidden.has(id)) continue;
      if ([it.a, it.b].some((e) => typeof e === "string" && hidden.has(e))) continue;
      const a = endRect(it.a, getRect), b = endRect(it.b, getRect);
      if (!a || !b) continue;
      const r = route(a, b);
      const pts = r.points.slice();
      const end = pts[pts.length - 1];
      const hermes = it.by === "h";
      const tip = [end[0] + { r: -2, l: 2, d: 0, u: 0 }[r.dir], end[1] + { r: 0, l: 0, d: -2, u: 2 }[r.dir]];
      pts[pts.length - 1] = tip;
      const mi = Math.floor(pts.length / 2);
      const mid = pts.length === 2 ? [(pts[0][0] + tip[0]) / 2, (pts[0][1] + tip[1]) / 2] : [(pts[mi - 1][0] + pts[mi][0]) / 2, (pts[mi - 1][1] + pts[mi][1]) / 2];
      out.push({
        id,
        hermes,
        label: it.label,
        mid,
        fresh: fresh.has(id),
        d: elbowPath(pts, 7),
        dots: hermes ? samplePolyline(pts, 4).filter(([x, y]) => Math.hypot(x - tip[0], y - tip[1]) > 6) : null,
        head: headPath(tip[0], tip[1], r.dir),
        port: pts[0]
      });
    }
    setWires(out);
  }, [doc, version, hidden, fresh, getRect]);
  return /* @__PURE__ */ jsxs("svg", { className: "hb-wires", width: "1", height: "1", "aria-hidden": "true", children: [
    wires.map((w) => {
      const ink = w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 55%, transparent)";
      const sel = selected.has(w.id);
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
            onPointerDown: (e) => {
              e.stopPropagation();
              onSelect(w.id, e.shiftKey);
            }
          }
        ),
        sel && /* @__PURE__ */ jsx("path", { className: "line-sel", d: w.d }),
        w.dots ? w.dots.map(([x, y], i) => /* @__PURE__ */ jsx(
          "rect",
          {
            className: "d",
            x: x - 1.15,
            y: y - 1.15,
            width: 2.3,
            height: 2.3,
            fill: ink,
            style: w.fresh ? { animationDelay: `${i * 14}ms` } : void 0
          },
          i
        )) : /* @__PURE__ */ jsx("path", { d: w.d, fill: "none", stroke: ink, strokeWidth: 1.3 }),
        /* @__PURE__ */ jsx("rect", { x: w.port[0] - 2.5, y: w.port[1] - 2.5, width: 5, height: 5, fill: ink }),
        /* @__PURE__ */ jsx(
          "path",
          {
            d: w.head,
            fill: w.hermes ? "var(--accent)" : "color-mix(in srgb, var(--ink) 72%, transparent)",
            style: w.fresh && w.dots ? { animation: "hb-dot-in .2s both", animationDelay: `${w.dots.length * 14}ms` } : void 0
          }
        ),
        w.label && /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("rect", { className: "lbl-bg", x: w.mid[0] - w.label.length * 3.3 - 6, y: w.mid[1] - 8, width: w.label.length * 6.6 + 12, height: 16 }),
          /* @__PURE__ */ jsx("text", { className: "lbl", x: w.mid[0], y: w.mid[1] + 3.5, textAnchor: "middle", children: w.label })
        ] })
      ] }, w.id);
    }),
    draft && (() => {
      const r = route(draft.from, { x: draft.to[0], y: draft.to[1], w: 0, h: 0 });
      return /* @__PURE__ */ jsx("path", { className: "draft", d: elbowPath(r.points, 7) });
    })()
  ] });
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
const EDITABLE = /* @__PURE__ */ new Set(["card", "todo", "col", "frame", "box", "text", "image"]);
const INTO_COLUMN = /* @__PURE__ */ new Set(["card", "todo", "link", "image", "video", "board"]);
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
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState(/* @__PURE__ */ new Set());
  const [editing, setEditing] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [delta, setDelta] = useState(null);
  const [resize, setResize] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [live, setLive] = useState(null);
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
  const flash = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => cur === msg ? null : cur), 3200);
  }, []);
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
  const onHermes = useCallback((entries, doc2) => {
    const steps = [];
    const hide2 = /* @__PURE__ */ new Set();
    let changes = 0;
    for (const e of entries) {
      for (const op of e.ops) {
        if (op.op === "board") continue;
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
  const sync = useBoard(bid, onHermes);
  const doc = sync.doc;
  const docRef = useRef(doc);
  docRef.current = doc;
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
    const canvas = mapRef.current, d = docRef.current, vp = vpRef.current;
    if (!canvas || !d || !vp) return;
    const v = view.current;
    const visible = { x: -v.x / v.z, y: -v.y / v.z, w: vp.clientWidth / v.z, h: vp.clientHeight / v.z };
    if (!accentRef.current) accentRef.current = accentColor(rootRef.current);
    drawPreview(canvas, d, { accent: accentRef.current, cell: 4, hermesAt: cursorRef.current?.position() ?? null });
    const ctx2 = canvas.getContext("2d");
    const rects = Object.values(d.items).map(approxRect).filter(Boolean);
    const b = boundsOf(rects) ?? visible;
    const W2 = canvas.clientWidth, H = canvas.clientHeight, pad2 = 30;
    const s = Math.min(W2 / (b.w + pad2 * 2), H / (b.h + pad2 * 2));
    const ox = (W2 - b.w * s) / 2 - b.x * s, oy = (H - b.h * s) / 2 - b.y * s;
    if (ctx2) {
      ctx2.globalAlpha = 0.75;
      ctx2.strokeStyle = accentRef.current;
      ctx2.lineWidth = 1;
      ctx2.strokeRect(Math.round(ox + visible.x * s) + 0.5, Math.round(oy + visible.y * s) + 0.5, visible.w * s, visible.h * s);
      ctx2.globalAlpha = 1;
    }
  }, []);
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
  const applyView = useCallback(() => {
    const v = view.current, world = worldRef.current, grid = gridRef.current;
    if (!world || !grid) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    world.style.setProperty("--iz", String(1 / v.z));
    const g = 24 * v.z, G = g * 5, c = 4.5;
    if (!accentRef.current) accentRef.current = accentColor(rootRef.current);
    const cross = withAlpha(accentRef.current, 0.16);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${G}' height='${G}'><path d='M${-c} 0H${c}M0 ${-c}V${c}M${G - c} 0H${G + c}M${G} ${-c}V${c}M${-c} ${G}H${c}M0 ${G - c}V${G + c}M${G - c} ${G}H${G + c}M${G} ${G - c}V${G + c}' stroke='${cross}' stroke-width='1'/></svg>`;
    grid.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}"), radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent) .9px, transparent 1.2px)`;
    grid.style.backgroundSize = `${G}px ${G}px, ${g}px ${g}px`;
    grid.style.backgroundPosition = `${v.x}px ${v.y}px, ${v.x}px ${v.y}px`;
    if (pctRef.current) pctRef.current.textContent = `${Math.round(v.z * 100)}%`;
    drawMap();
    placeCtx();
  }, [drawMap, placeCtx]);
  const saveView = useCallback(() => {
    try {
      sessionStorage.setItem(`hb.view.${bid}`, JSON.stringify(view.current));
    } catch {
    }
  }, [bid]);
  const zoomAt = useCallback((f, sx, sy) => {
    view.current = zoomView(view.current, f, sx, sy);
    applyView();
    saveView();
  }, [applyView, saveView]);
  const zoomAnim = useRef(null);
  const zoomSmooth = useCallback((f, sx, sy) => {
    if (reduced()) {
      zoomAt(f, sx, sy);
      return;
    }
    const a = zoomAnim.current;
    const base = a ? a.z : view.current.z;
    const target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, base * f));
    if (a) {
      cancelAnimationFrame(a.raf);
    }
    const anim = { z: target, sx, sy, raf: 0 };
    zoomAnim.current = anim;
    const step = () => {
      const v = view.current;
      const next = v.z + (anim.z - v.z) * 0.38;
      const done = Math.abs(anim.z - next) < anim.z * 2e-3;
      view.current = zoomView(v, (done ? anim.z : next) / v.z, anim.sx, anim.sy);
      applyView();
      if (done) {
        zoomAnim.current = null;
        saveView();
        return;
      }
      anim.raf = requestAnimationFrame(step);
    };
    anim.raf = requestAnimationFrame(step);
  }, [applyView, saveView, zoomAt]);
  useEffect(() => () => {
    if (zoomAnim.current) cancelAnimationFrame(zoomAnim.current.raf);
  }, []);
  const contentBounds = useCallback(() => {
    const d = docRef.current;
    if (!d) return null;
    const rects = Object.entries(d.items).filter(([, it]) => !it.in && it.k !== "line").map(([id]) => getRect(id)).filter(Boolean);
    return boundsOf(rects);
  }, [getRect]);
  const fit = useCallback(() => {
    const vp = vpRef.current, b = contentBounds();
    if (!vp) return;
    view.current = b ? fitView(b, { w: vp.clientWidth, h: vp.clientHeight }, 60, 1.1) : { x: vp.clientWidth / 2 - 200, y: vp.clientHeight / 2 - 120, z: 0.9 };
    applyView();
    saveView();
  }, [applyView, contentBounds, saveView]);
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
    } else fit();
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
    const RO = globalThis.ResizeObserver;
    if (!RO || !worldRef.current) return;
    let raf = 0;
    const ro = new RO(() => {
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
  const add = useCallback((item, at, edit = false) => {
    const ref = newRef();
    const p = at ?? lastPoint.current ?? center();
    const placed = item.in ? item : { ...item, x: Math.round(p.x), y: Math.round(p.y) };
    commit([{ op: "add", ref, item: placed }]);
    setSelected(/* @__PURE__ */ new Set([ref]));
    if (edit) setEditing(ref);
    return ref;
  }, [center, commit]);
  const addImageFiles = useCallback(async (files, at) => {
    let p = at ?? center();
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
          p = { x: p.x + 24, y: p.y + 24 };
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
        p = { x: p.x + 24, y: p.y + 24 };
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
    const ops = [...selected].filter((id) => d.items[id]).map((id) => ({ op: "del", id }));
    commit(ops);
    setSelected(/* @__PURE__ */ new Set());
  }, [commit, selected]);
  const duplicate = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const ops = [];
    const next = /* @__PURE__ */ new Set();
    for (const id of selected) {
      const it = d.items[id];
      if (!it || it.k === "line" || it.k === "col") continue;
      const { by: _by, in: inCol, ...rest } = it;
      const ref = newRef();
      next.add(ref);
      const r = getRect(id);
      ops.push({ op: "add", ref, item: inCol ? { ...rest, in: inCol } : { ...rest, x: (it.x ?? r?.x ?? 0) + 24, y: (it.y ?? r?.y ?? 0) + 24 } });
    }
    if (ops.length) {
      commit(ops);
      setSelected(next);
    }
  }, [commit, getRect, selected]);
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
  const onPointerDown = (e) => {
    const d = docRef.current;
    if (!d || e.button === 2) return;
    const target = e.target;
    if (target.closest("[data-nodrag], .hb-ctx, input, textarea, a, iframe, video")) return;
    if (connectFrom) {
      const hit = target.closest("[data-kid], [data-iid]");
      const to = hit?.dataset.kid ?? hit?.dataset.iid;
      if (to && to !== connectFrom && d.items[connectFrom]) commit([{ op: "add", ref: newRef(), item: { k: "line", a: connectFrom, b: to } }]);
      setConnectFrom(null);
      return;
    }
    if (editing && !target.closest(`[data-iid="${editing}"]`)) setEditing(null);
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
      drag.current = { ...base, kind: "draw", pts: [[w.x, w.y]] };
      setLive([[w.x, w.y]]);
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
      if (e.shiftKey) {
        sel = new Set(selected);
        if (sel.has(id)) sel.delete(id);
        else sel.add(id);
      } else if (!selected.has(id)) sel = /* @__PURE__ */ new Set([id]);
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
    const g = drag.current;
    if (!g) return;
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
      case "move":
        setDelta({ dx: dx / z, dy: dy / z });
        break;
      case "resize":
        setResize({ id: g.id, w: Math.max(120, g.w0 + dx / z), h: Math.max(40, g.h0 + dy / z) });
        break;
      case "marquee": {
        const s = toWorld(g.sx, g.sy);
        setMarquee({ x: Math.min(s.x, w.x), y: Math.min(s.y, w.y), w: Math.abs(w.x - s.x), h: Math.abs(w.y - s.y) });
        break;
      }
      case "draw":
        g.pts.push([w.x, w.y]);
        setLive(g.pts.slice());
        break;
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
      const dd = delta;
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
      setSelected(sel);
      return;
    }
    if (g.kind === "draw") {
      setLive(null);
      const pts = simplify(g.pts ?? [], 1.5);
      if (pts.length < 2) return;
      const s = toStroke(pts);
      commit([{ op: "add", ref: newRef(), item: { k: "draw", x: s.x, y: s.y, d: s.d, sw: 1.9 } }]);
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
  }, [applyView, saveView, zoomAt, zoomSmooth]);
  const hasDoc = !!doc;
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [onWheel, hasDoc]);
  useEffect(() => {
    const onKey = (e) => {
      if (!rootRef.current?.isConnected || ask || confirmReq) return;
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
        setSelected(/* @__PURE__ */ new Set());
        setTool("select");
        setEditing(null);
        return;
      }
      if (e.key === "Enter" && selected.size === 1) {
        const id = [...selected][0];
        const it = docRef.current?.items[id];
        if (it && EDITABLE.has(it.k)) {
          e.preventDefault();
          setEditing(id);
        }
        return;
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
      if (e.key === "+" || e.key === "=") {
        const vp = vpRef.current;
        zoomAt(1.2, vp.clientWidth / 2, vp.clientHeight / 2);
        return;
      }
      if (e.key === "-") {
        const vp = vpRef.current;
        zoomAt(1 / 1.2, vp.clientWidth / 2, vp.clientHeight / 2);
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
  }, [ask, center, commit, confirmReq, connectFrom, continueInSession, deleteSelection, duplicate, fit, openChat, selected, sync, zoomAt]);
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
  const regEl = useCallback((id) => (el) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);
  const ctx = useMemo(() => doc ? {
    doc,
    t: t2,
    editing,
    setEditing,
    update,
    commit,
    playing,
    setPlaying,
    Frame,
    liveActions,
    liveActionsDown,
    runLiveAction,
    openBoard: (id) => onOpenBoard(id),
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
      return /* @__PURE__ */ jsx(
        "div",
        {
          className: cls,
          "data-kid": id,
          ref: regEl(id),
          onDoubleClick: (e) => {
            e.stopPropagation();
            if (EDITABLE.has(it.k)) setEditing(id);
          },
          children: /* @__PURE__ */ jsx(ItemBody, { id, item: it, c: ctxRef.current, dropIndex: null, selected: selected.has(id) })
        },
        id
      );
    }
  } : null, [Frame, commit, doc, editing, hidden, kidDrag, liveActions, liveActionsDown, onOpenBoard, playing, regEl, runLiveAction, selected, t2, update]);
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
    if ("board" in openTarget) onOpenBoard(openTarget.board);
    else window.open(openTarget.url, "_blank", "noopener,noreferrer");
  };
  const startConnect = () => {
    if (selIds.length === 1) {
      setConnectFrom(selIds[0]);
      setTool("select");
    }
  };
  useLayoutEffect(() => {
    selRef.current = selBounds && selKinds.length && tool === "select" && !connectFrom && !menu ? selBounds : null;
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
      if (canConnect) out2.push({ id: "connect", label: t2("board.ctx.connect"), icon: "connect", run: startConnect });
      if (canDuplicate) out2.push({ id: "dup", label: t2("board.ctx.duplicate"), icon: "duplicate", kbd: `${mod}D`, run: duplicate });
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
    out.push({ id: "all", label: t2("board.menu.selectAll"), icon: "selectAll", kbd: `${mod}A`, run: () => setSelected(new Set(Object.keys(docRef.current?.items ?? {}).filter((k) => !docRef.current.items[k].in))) });
    out.push({ id: "fit", label: t2("board.fit"), icon: "fit", kbd: "F", run: fit });
    out.push({ id: "chat", label: chatOpen ? t2("board.chat.close") : t2("board.chat.open"), icon: chatOpen ? "closePanel" : "chat", kbd: "/", run: () => chatOpen ? closeChat() : openChat(true) });
    return out;
  };
  const chatFloat = rootW - CHAT_MIN_W < 620;
  const chatWidth = chatFloat ? Math.min(chatW, Math.max(260, rootW - 48)) : Math.min(chatW, rootW - 620);
  const rootCls = `hb ${narrow}${chatOpen ? chatFloat ? " chat-float" : " chat-open" : ""}`.trim();
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
  items.sort(([, a], [, b]) => (a.k === "frame" ? -1 : 0) - (b.k === "frame" ? -1 : 0));
  const sessionShort = doc.session?.id ? doc.session.id.slice(-4) : null;
  const savedTs = sync.savedAt ? sync.savedAt / 1e3 : doc.updated;
  const vpCls = `hb-viewport${tool === "pan" ? " tool-pan" : ""}${tool === "draw" ? " tool-draw" : ""}${tool === "arrow" || connectFrom ? " tool-arrow" : ""}${PLACE.includes(tool) ? " tool-place" : ""}`;
  const hint = connectFrom ? t2("board.hint.connect") : TOOL_HINT[tool] ? t2(TOOL_HINT[tool]) : "";
  const zoomBy = (f) => {
    const vp = vpRef.current;
    zoomAt(f, vp.clientWidth / 2, vp.clientHeight / 2);
  };
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
        onPointerCancel: onPointerUp,
        onContextMenu,
        onDoubleClick: (e) => {
          const target = e.target;
          const iid = target.closest("[data-iid]")?.dataset.iid;
          if (iid) {
            const it = doc.items[iid];
            if (it && EDITABLE.has(it.k)) setEditing(iid);
            return;
          }
          if (target.closest("[data-nodrag], .hb-ctx")) return;
          add({ k: "card", w: 256 }, toWorld(e.clientX, e.clientY), true);
        },
        onDragOver: (e) => e.preventDefault(),
        onDrop,
        children: [
          /* @__PURE__ */ jsx("div", { className: "hb-grid", ref: gridRef }),
          /* @__PURE__ */ jsxs("div", { className: "hb-world", ref: worldRef, children: [
            /* @__PURE__ */ jsx(
              Wires,
              {
                doc,
                getRect,
                version: layoutV + (delta ? 1 : 0),
                hidden,
                fresh,
                selected,
                draft,
                onSelect: (id, additive) => setSelected((s) => {
                  const n = additive ? new Set(s) : /* @__PURE__ */ new Set();
                  n.add(id);
                  return n;
                })
              }
            ),
            items.map(([id, it]) => {
              const sel = selected.has(id);
              const moving = delta && sel;
              const x = (it.x ?? 0) + (moving ? delta.dx : 0);
              const y = (it.y ?? 0) + (moving ? delta.dy : 0);
              const rs = resize?.id === id ? resize : null;
              const [dw] = DEFAULT_SIZE[it.k] ?? [200, 100];
              const width = it.k === "draw" ? void 0 : rs?.w ?? it.w ?? (it.k === "text" ? void 0 : dw);
              const height = RESIZE_H.has(it.k) ? rs?.h ?? it.h ?? (it.k === "frame" ? 320 : it.k === "box" ? 62 : void 0) : void 0;
              const cls = `hb-item${sel ? " sel" : ""}${moving ? " dragging" : ""}${hidden.has(id) ? " reveal-wait" : ""}${fresh.has(id) && !reduced() ? " just-placed" : ""}${connectFrom === id ? " connect-from" : ""}`;
              const dropIndex = kidDrag?.col === id ? kidDrag.index : null;
              return /* @__PURE__ */ jsxs(
                "div",
                {
                  className: cls,
                  "data-iid": id,
                  ref: regEl(id),
                  style: { left: x, top: y, width, height, zIndex: it.k === "frame" ? 0 : sel ? 3 : 1 },
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
                id
              );
            }),
            kidDrag && doc.items[kidDrag.id] && /* @__PURE__ */ jsx("div", { className: "hb-ghost", style: { left: kidDrag.x - 20, top: kidDrag.y - 12, width: 264 }, children: /* @__PURE__ */ jsx(ItemBody, { id: kidDrag.id, item: doc.items[kidDrag.id], c: ctx, dropIndex: null, selected: true }) }),
            live && live.length > 1 && /* @__PURE__ */ jsx("svg", { className: "hb-draw", style: { position: "absolute", left: 0, top: 0, overflow: "visible" }, width: "1", height: "1", children: /* @__PURE__ */ jsx("path", { d: strokePath(live.map(([x, y]) => [Math.round(x), Math.round(y)])), strokeWidth: 1.9 }) }),
            marquee && /* @__PURE__ */ jsx("div", { className: "hb-marquee", style: { left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h } }),
            /* @__PURE__ */ jsx(HermesCursor, { ref: cursorRef, reducedMotion: reduced(), onActive: (on, act) => setCursorAct(on ? act : null) })
          ] }),
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
          canConnect && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.ctx.connect"), "aria-label": t2("board.ctx.connect"), onClick: startConnect, children: /* @__PURE__ */ jsx(Icon, { name: "connect" }) }),
          canDuplicate && /* @__PURE__ */ jsx("button", { className: "ib", "data-tip": t2("board.ctx.duplicate"), "data-kbd": `${mod}D`, "aria-label": t2("board.ctx.duplicate"), onClick: duplicate, children: /* @__PURE__ */ jsx(Icon, { name: "duplicate" }) }),
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
          /* @__PURE__ */ jsx("button", { onClick: () => onOpenBoard(doc.parent), children: t2("board.path.parent") }),
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
        /* @__PURE__ */ jsx("span", { children: t2("board.state.saved", { time: clock(savedTs) }) }),
        /* @__PURE__ */ jsx("span", { className: "sess", children: sessionShort ? /* @__PURE__ */ jsxs(Fragment, { children: [
          t2("board.state.session"),
          " ",
          /* @__PURE__ */ jsxs("b", { children: [
            "#",
            sessionShort
          ] })
        ] }) : t2("board.state.noSession") })
      ] }),
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
        /* @__PURE__ */ jsx("button", { className: "tool", "aria-label": t2("board.fit"), "data-tip": t2("board.fit"), "data-kbd": "F", onClick: fit, children: /* @__PURE__ */ jsx(Icon, { name: "fit", size: 15 }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: `hb-map${items.length ? "" : " off"}`, "data-tip": t2("board.map"), onClick: (e) => {
      const b = contentBounds();
      const canvas = mapRef.current, vp = vpRef.current;
      if (!b || !canvas || !vp) return;
      const r = canvas.getBoundingClientRect();
      const pad2 = 30, s = Math.min(r.width / (b.w + pad2 * 2), r.height / (b.h + pad2 * 2));
      const ox = (r.width - b.w * s) / 2 - b.x * s, oy = (r.height - b.h * s) / 2 - b.y * s;
      const wx = (e.clientX - r.left - ox) / s, wy = (e.clientY - r.top - oy) / s;
      const v = view.current;
      view.current = { ...v, x: vp.clientWidth / 2 - wx * v.z, y: vp.clientHeight / 2 - wy * v.z };
      applyView();
      saveView();
    }, children: /* @__PURE__ */ jsx("canvas", { ref: mapRef, width: 384, height: 208 }) }),
    /* @__PURE__ */ jsxs("div", { className: `hb-log${logOn && log.length ? "" : " off"}`, role: "log", children: [
      /* @__PURE__ */ jsx("button", { className: "x ib", "aria-label": t2("board.log.close"), "data-tip": t2("board.log.close"), onClick: () => setLogOn(false), children: /* @__PURE__ */ jsx(Icon, { name: "close", size: 13 }) }),
      log.filter((l) => l.who === "hermes").slice(-2).map((l) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "t", children: clock(l.t) }),
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
      if (!url || !addUrl(url, ask.at)) {
        flash(t2("board.toast.badUrl"));
        return;
      }
      setAsk(null);
      return;
    }
    if (!v) return;
    const at = ask.at;
    setAsk(null);
    void boardsApi.uploadHtml(v).then((r) => add({ k: "embed", asset: r.asset, title: t2("board.embed.title") }, at)).catch((e) => flash(String(e?.message ?? e)));
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
function BoardCard({ row: row2, onOpen, onDelete }) {
  const t2 = useT();
  const [doc, setDoc] = useState(null);
  useEffect(() => {
    let live = true;
    loadBoardDoc(row2.id, true).then((d) => live && setDoc(d));
    return () => {
      live = false;
    };
  }, [row2.id, row2.seq]);
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
          /* @__PURE__ */ jsx("b", { children: row2.name }),
          /* @__PURE__ */ jsx("span", { className: "go", children: /* @__PURE__ */ jsx(Icon, { name: "openBoard", size: 13 }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "meta", children: [
          /* @__PURE__ */ jsx("span", { children: t2("board.ref.meta", { n: row2.count, when: ago(t2, row2.updated) }) }),
          /* @__PURE__ */ jsx("span", { className: "sp" }),
          row2.session && /* @__PURE__ */ jsx("span", { className: "sig", children: /* @__PURE__ */ jsx(Cad, {}) }),
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
    if (!editing && bid) goBoard(bid);
  }, children: [
    /* @__PURE__ */ jsx("div", { className: "pvw", children: /* @__PURE__ */ jsx(BoardPreview, { doc }) }),
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
    navigateTo: null,
    dataSource: "analytics"
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
const GAP = 10;
const PAD = 12;
const GridCanvas = forwardRef(function GridCanvas2({ layout, editing, data, onLayoutChange, onRemove, onWidgetPropsChange, trashRef, onTrashActive }, ref) {
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
  const colW = stageW > 0 ? (stageW - PAD * 2 - GAP * (GRID_COLS - 1)) / GRID_COLS : 0;
  const toPx = (box) => ({
    left: PAD + box.gx * (colW + GAP),
    top: PAD + box.gy * (CELL_H + GAP),
    width: box.gw * colW + (box.gw - 1) * GAP,
    height: box.gh * CELL_H + (box.gh - 1) * GAP
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
          Math.round((startPx.height + dy + GAP) / (CELL_H + GAP))
        );
        const candidate = { gx: item.gx, gy: item.gy, gw, gh };
        next = {
          ...dragRef.current,
          candidate,
          px: {
            ...startPx,
            width: Math.max(70, startPx.width + dx),
            height: Math.max(CELL_H, startPx.height + dy)
          },
          swapWith: null,
          moved: reflow({ ...candidate }, others),
          overTrash: false
        };
      } else {
        const pos = clampPosition(
          item.gx + dx / (colW + GAP),
          item.gy + dy / (CELL_H + GAP),
          item.gw,
          item.gh
        );
        const candidate = { ...pos, gw: item.gw, gh: item.gh };
        const pgx = (ev.clientX - stageRect.left - PAD) / (colW + GAP);
        const pgy = (ev.clientY - stageRect.top - PAD) / (CELL_H + GAP);
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
          (y - stageRect.top - PAD) / (CELL_H + GAP),
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
  const stageH = PAD * 2 + Math.max(maxRow, addRow) * (CELL_H + GAP) - GAP;
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
      let box = item;
      if (!isDragged) {
        if (isTwinTarget && drag) {
          const origin = layout.widgets.find((w) => w.id === drag.id);
          box = { ...item, gx: origin.gx, gy: origin.gy };
        } else {
          const gy = previewMoved?.get(item.id);
          if (gy !== void 0) box = { ...item, gy };
        }
      }
      const style = isDragged && drag ? drag.px : toPx(box);
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
              gridSize: { gw: box.gw, gh: box.gh }
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
    async function poll() {
      if (document.hidden) return;
      const keys = Object.keys(SOURCES);
      const results = await Promise.allSettled(keys.map((k) => SOURCES[k]()));
      if (cancelled) return;
      setData((prev) => {
        const next = { ...prev, errors: new Set(prev.errors) };
        keys.forEach((key, i) => {
          const r = results[i];
          if (r.status === "fulfilled") {
            next[key] = r.value;
            next.errors.delete(key);
          } else {
            next.errors.add(key);
          }
        });
        return next;
      });
    }
    poll();
    timer.current = setInterval(poll, POLL_MS);
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
              children: /* @__PURE__ */ jsx("span", { className: "home-fab-spin", children: "↺" })
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
                /* @__PURE__ */ jsx("span", { className: "home-fab-ico ico-edit", "aria-hidden": "true", children: "✎" }),
                /* @__PURE__ */ jsx("span", { className: "home-fab-ico ico-done", "aria-hidden": "true", children: "✓" })
              ]
            }
          )
        ] }),
        toast && /* @__PURE__ */ jsx("div", { className: "home-toast", role: "status", children: toast })
      ]
    }
  );
}
const homeCss = "/* Home page — rice-style widget grid.\n * Every color routes through --home-accent (the active theme's primary),\n * so switching themes recolors the whole page with zero widget changes.\n * Swap teal (#2dd4bf) stays fixed: it is interaction semantics, not theme. */\n\n.home-root {\n  --home-accent: var(--color-primary, var(--ui-accent, #ffd700));\n  --home-accent-dim: color-mix(in srgb, var(--home-accent) 55%, #000);\n  /* Readable secondary text (headers, captions): dim was ~3:1 on the glass. */\n  --home-accent-soft: color-mix(in srgb, var(--home-accent) 82%, #9aa3b5);\n  --home-surface: color-mix(\n    in srgb,\n    var(--home-accent) 6%,\n    var(--ui-editor-surface-background, rgb(10 10 14 / 0.55))\n  );\n  --home-border: color-mix(in srgb, var(--home-accent) 18%, transparent);\n  --home-error: var(--color-destructive, #e25555);\n  position: relative;\n  height: 100%;\n  overflow: auto;\n  font-family: var(--theme-font-mono, ui-monospace, monospace);\n  color: var(--color-foreground, var(--ui-text-primary, #d8dce6));\n}\n\n.home-stage {\n  position: relative;\n  min-height: 60vh;\n  touch-action: none;\n}\n\n.home-widget {\n  position: absolute;\n  border-radius: 8px;\n  padding: 10px 12px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);\n  overflow: hidden;\n  transition: left 0.18s ease, top 0.18s ease;\n  container-type: size;\n  font-size: 11px;\n  line-height: 1.5;\n  /* Promote each widget to its own compositor layer so the constantly\n   * repainting matrix canvas doesn't force the neighbours' backdrop-filter\n   * to recompose every frame — that recomposition is what produced the\n   * horizontal flicker sweeping across the glass panels. */\n  transform: translateZ(0);\n  contain: paint;\n}\n.home-root.editing .home-widget { user-select: none; }\n.home-widget.dragging {\n  transition: none;\n  opacity: 0.9;\n  border-color: var(--home-accent);\n  z-index: 50;\n  cursor: grabbing;\n}\n.home-widget.swap-target {\n  border-color: #2dd4bf;\n  box-shadow: 0 0 0 1px rgb(45 212 191 / 0.5), 0 10px 30px rgb(0 0 0 / 0.5);\n}\n/* Over the trash zone — about to be deleted. */\n.home-widget.trashing {\n  opacity: 0.45;\n  border-color: var(--home-error);\n  box-shadow: 0 0 0 1px color-mix(in srgb, var(--home-error) 60%, transparent),\n    0 10px 30px rgb(0 0 0 / 0.5);\n}\n\n/* Floating label that follows the pointer while dragging a new widget in. */\n.home-add-ghost {\n  position: fixed;\n  z-index: 70;\n  transform: translate(-50%, -140%);\n  padding: 4px 10px;\n  border-radius: 6px;\n  font-size: 11px;\n  white-space: nowrap;\n  pointer-events: none;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-accent);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n}\n\n/* Header: short lead rule · TITLE · hairline that fades out. Drawn with CSS\n * (not box-drawing glyphs) so the gaps stay even and the rule never touches\n * the text, whatever the font or title length. */\n.home-widget .hd {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 16px;\n  font-size: 9.5px;\n  letter-spacing: 0.18em;\n  margin-bottom: 8px;\n  font-weight: 700;\n  text-transform: uppercase;\n  color: var(--home-accent-soft);\n  white-space: nowrap;\n  overflow: hidden;\n}\n.home-widget .hd .hd-t { flex: none; }\n.home-widget .hd::before,\n.home-widget .hd::after {\n  content: \"\";\n  height: 1px;\n  flex: none;\n}\n.home-widget .hd::before {\n  width: 12px;\n  background: currentColor;\n  opacity: 0.45;\n}\n.home-widget .hd::after {\n  flex: 1 1 auto;\n  min-width: 0;\n  background: linear-gradient(to right, currentColor, transparent 92%);\n  opacity: 0.28;\n}\n.home-root.editing .home-widget .hd { cursor: grab; }\n\n.home-widget .rs {\n  position: absolute;\n  right: 2px;\n  bottom: 2px;\n  width: 13px;\n  height: 13px;\n  cursor: nwse-resize;\n  border-right: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-bottom: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-radius: 2px;\n  z-index: 3;\n}\n.home-widget .wremove {\n  position: absolute;\n  top: 4px;\n  right: 6px;\n  z-index: 3;\n  background: none;\n  border: none;\n  color: var(--home-error);\n  font-size: 13px;\n  line-height: 1;\n  cursor: pointer;\n  padding: 2px 4px;\n}\n.home-widget .werr { color: var(--home-error); }\n/* Data-source states (widget-state.ts): honest copy per failure kind. */\n.home-widget .wstate { display: block; font-size: 10px; letter-spacing: 0.04em; }\n.home-widget .wstate::before { content: \"● \"; }\n.home-widget .wstate-offline { color: var(--home-error); }\n.home-widget .wstate-unavailable { color: #f5b945; }\n.home-widget .hd .hd-stale { color: #f5b945; letter-spacing: 0.1em; opacity: 0.8; }\n\n/* ── hover controls (contextual chrome, rest mode only) ──\n * Reusable floating control rendered inside a widget body. Hidden by default,\n * fades in while hovering the widget, and fully suppressed in edit mode so it\n * never fights drag/resize. Widgets opt in by rendering <HoverCtl>/<HoverArrows>. */\n.hover-ctl {\n  /* Sits IN the header row: same top as the widget padding, same height as .hd,\n   * right-aligned at the end of the header rule. No chip: bare glyphs, like the rest. */\n  position: absolute;\n  top: 10px;\n  right: 12px;\n  height: 16px;\n  z-index: 4;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  white-space: nowrap;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.16s ease;\n}\n/* Visible only while the pointer is over the widget. Keyboard users still get them\n * (:focus-visible), but a mouse click no longer leaves them stuck on screen. */\n.home-widget:hover .hover-ctl,\n.hover-ctl:has(:focus-visible) { opacity: 1; pointer-events: auto; }\n/* While the controls show, the header rule stops short of them... */\n.home-widget:hover .hd::after,\n.home-widget:has(.hover-ctl :focus-visible) .hd::after {\n  margin-right: calc(var(--ctl-w, 0px) + 10px);\n}\n/* ...and when the widget is too narrow for title + controls, the title steps aside. */\n.home-widget[data-ctl-tight]:hover .hd .hd-t,\n.home-widget[data-ctl-tight]:hover .hd::before { opacity: 0; }\n.home-widget .hd .hd-t,\n.home-widget .hd::before,\n.home-widget .hd::after { transition: opacity 0.16s ease, margin-right 0.16s ease; }\n/* Multi-row controls (Pomodoro steppers) don't fit the header: they sit below it. */\n.hover-ctl.pomo-set { top: 30px; height: auto; }\n.home-root.editing .hover-ctl { display: none; }\n@media (hover: none) {\n  /* Touch: no hover, so keep controls reachable but understated. */\n  .hover-ctl { opacity: 0.5; pointer-events: auto; }\n}\n\n.hv-arrow {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0 3px;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  font-family: inherit;\n}\n.hv-arrow:hover:not(:disabled) { color: var(--home-accent); }\n.hv-arrow:disabled { opacity: 0.3; cursor: default; }\n.hv-label {\n  font-size: 9px;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  white-space: nowrap;\n}\n.hv-label-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  letter-spacing: 0.1em;\n  padding: 0;\n}\n.hv-label-btn:hover { color: var(--home-accent); }\n\n/* Toggle/option buttons inside a hover control (clock format, host view…). */\n.hv-opt {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  font-size: 9px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  padding: 0 4px;\n  border-radius: 4px;\n}\n.hv-opt:hover { color: var(--home-accent); }\n.hv-opt.on { color: #000; background: var(--home-accent); }\n\n/* Extra detail that smoothly expands on widget hover (rest mode only). Uses\n * the 0fr→1fr grid trick so it animates real height without a fixed value. */\n.hover-reveal {\n  display: grid;\n  grid-template-rows: 0fr;\n  opacity: 0;\n  transition: grid-template-rows 0.25s ease, opacity 0.2s ease, margin-top 0.25s ease;\n}\n.home-widget:hover .hover-reveal { grid-template-rows: 1fr; opacity: 1; margin-top: 4px; }\n.home-root.editing .hover-reveal { grid-template-rows: 0fr; opacity: 0; margin-top: 0; }\n.hover-reveal > * { overflow: hidden; min-height: 0; }\n\n.home-ghost {\n  position: absolute;\n  border: 1.5px dashed color-mix(in srgb, var(--home-accent) 70%, transparent);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--home-accent) 7%, transparent);\n  display: none;\n  z-index: 5;\n  pointer-events: none;\n  transition: left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease;\n}\n.home-ghost.visible { display: block; }\n.home-ghost.swap {\n  border-color: rgb(45 212 191 / 0.85);\n  background: rgb(45 212 191 / 0.08);\n}\n\n/* ── widget content primitives (responsive to the widget's own size) ── */\n.home-widget .rows { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .rows { columns: 2; column-rule: 1px solid rgb(255 255 255 / 0.06); }\n}\n@container (min-width: 600px) {\n  .home-widget .rows { columns: 3; }\n}\n.home-widget .row {\n  display: flex;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  break-inside: avoid;\n}\n.home-widget .row:last-child { border-bottom: none; }\n/* Names flex and ellipsize at the real column width instead of a fixed\n * character slice that cut words mid-glyph (\"bitacoras-guayab\"). */\n.home-widget .row > * { flex: none; }\n.home-widget .row > .row-name {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.home-widget .meters { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .meters { columns: 2; }\n}\n.home-widget .meter {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin: 3px 0;\n  break-inside: avoid;\n}\n.home-widget .meter .lbl { width: 34px; color: var(--color-muted-foreground, #7d8496); font-size: 10px; }\n.home-widget .meter .track {\n  flex: 1;\n  height: 7px;\n  border-radius: 2px;\n  background: rgb(255 255 255 / 0.07);\n  overflow: hidden;\n}\n.home-widget .meter .fill {\n  height: 100%;\n  background: linear-gradient(90deg, var(--home-accent-dim), var(--home-accent));\n  transition: width 0.6s ease;\n}\n.home-widget .meter .val { width: 44px; text-align: right; font-size: 10px; }\n\n.home-widget .ok { color: var(--home-accent); }\n.home-widget .dim { color: var(--color-muted-foreground, #6b7387); }\n.home-widget .bigval {\n  font-size: min(9cqw, 18cqh);\n  font-weight: 700;\n  color: var(--home-accent);\n}\n\n.home-clock-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n.home-clock {\n  font-size: min(26cqw, 52cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  letter-spacing: 0.02em;\n  text-shadow: 0 0 24px color-mix(in srgb, var(--home-accent) 35%, transparent);\n  line-height: 1;\n}\n.home-clock-ampm {\n  font-size: 0.32em;\n  vertical-align: 0.9em;\n  margin-left: 0.2em;\n  letter-spacing: 0.05em;\n  color: var(--home-accent-dim);\n}\n.home-clock-sub {\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.4cqw, 8cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-top: 1cqh;\n}\n\n.home-ascii-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n.home-ascii {\n  font-size: min(5.6cqw, 5.4cqh);\n  line-height: 1.05;\n  white-space: pre;\n  text-align: center;\n  background: linear-gradient(\n    180deg,\n    var(--home-accent-dim),\n    var(--home-accent) 40%,\n    var(--home-accent) 60%,\n    var(--home-accent-dim)\n  );\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--home-accent) 25%, transparent));\n}\n.home-ascii-caduceus {\n  transform: scaleX(0.88);\n  transform-origin: center;\n}\n.home-ascii-ver {\n  text-align: center;\n  color: var(--home-accent-soft);\n  font-size: max(8px, min(2.6cqw, 5cqh));\n  letter-spacing: 0.22em;\n  margin-top: 1.5cqh;\n}\n\n.home-spark {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n}\n.home-spark i {\n  flex: 1;\n  background: linear-gradient(180deg, var(--home-accent), var(--home-accent-dim));\n  border-radius: 1px 1px 0 0;\n  opacity: 0.85;\n  transition: height 0.6s ease, opacity 0.15s ease;\n  cursor: default;\n}\n.home-spark i:hover { opacity: 1; }\n\n/* Hover tooltip over a bar (tokens widget). Anchored to the bar via inline\n * `left` + `translateX`, which clamps it inside the clipped widget; the appear/\n * disappear slide+fade runs on the independent `translate` property so it never\n * fights the positioning transform. */\n.home-spark-wrap { position: relative; }\n.home-spark-tip {\n  position: absolute;\n  bottom: 100%;\n  margin-bottom: 6px;\n  padding: 3px 7px;\n  border-radius: 6px;\n  background: color-mix(in srgb, var(--home-accent) 10%, rgb(8 8 12 / 0.96));\n  border: 1px solid var(--home-border);\n  color: rgb(236 236 242);\n  font-size: 10px;\n  line-height: 1.3;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  translate: 0 4px;\n  transition: opacity 0.18s ease, translate 0.18s ease, transform 0.18s ease;\n  z-index: 6;\n}\n.home-spark-tip.show { opacity: 1; translate: 0 0; }\n.home-spark-tip b { color: var(--home-accent); font-weight: 600; }\n\n/* Line/area chart (tokens widget, alternative to the bars). Stretched to fill\n * via preserveAspectRatio=none; the stroke stays crisp with non-scaling-stroke. */\n.home-area {\n  display: block;\n  width: 100%;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n  overflow: visible;\n}\n.home-area rect { cursor: default; }\n\n/* Host graphs view: four live sparklines (cpu / ram / load / proc) in a 2×2\n * grid over a rolling one-minute window. Fills the widget below the header\n * (same absolute pattern as the canvas widgets); cells reuse .home-area but\n * stretch to their cell height instead of the tokens widget's fixed band. */\n.host-sparks {\n  position: absolute;\n  inset: 30px 12px 10px;\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  grid-template-rows: 1fr 1fr;\n  gap: 4px 12px;\n  min-height: 0;\n}\n.host-spark {\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  min-width: 0;\n}\n.host-spark-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  font-size: max(8px, min(3.2cqw, 6cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n.host-spark-head .val {\n  font-variant-numeric: tabular-nums;\n  color: var(--home-accent);\n}\n.host-spark .home-area {\n  flex: 1;\n  height: auto;\n  min-height: 12px;\n  margin: 2px 0 0;\n}\n\n/* Small vertical divider between the range arrows and the toggles. */\n.tok-div {\n  width: 1px;\n  align-self: stretch;\n  margin: 2px 2px;\n  background: var(--home-border);\n}\n\n/* Totals line, regrouped: each label sticks to its value, groups spaced evenly\n * (the old `.row` space-between scattered the six tokens across the full width). */\n.tok-stats {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 2px 14px;\n  padding: 3px 0 1px;\n  font-variant-numeric: tabular-nums;\n}\n.tok-stats > span { white-space: nowrap; }\n.tok-stats .dim { margin-right: 2px; }\n\n/* Grouped usage (tokens widget, by provider / by model): one row per group\n * with a faint share bar behind it, width = --share of the grouped total. */\n.tok-groups { padding-top: 3px; font-variant-numeric: tabular-nums; }\n.home-widget .row.tok-group {\n  background: linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--home-accent) 16%, transparent) var(--share, 0%),\n    transparent var(--share, 0%)\n  );\n  border-radius: 2px;\n  padding-left: 3px;\n}\n.tok-share { min-width: 3ch; text-align: right; }\n.tok-group-note,\n.tok-group-more { font-size: 9.5px; padding-top: 1px; }\n\n/* ── spend widget ── */\n.home-spend { font-variant-numeric: tabular-nums; }\n.spend-head { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.spend-est {\n  margin-left: 6px;\n  padding: 0 4px;\n  border: 1px solid var(--home-border);\n  border-radius: 3px;\n  font-size: 9px;\n  letter-spacing: 0.06em;\n  color: var(--color-muted-foreground, #6b7387);\n  vertical-align: 2px;\n}\n.spend-providers { padding-top: 2px; }\n.spend-covered {\n  margin-top: 4px;\n  padding: 2px 0 2px 6px;\n  border-left: 2px solid color-mix(in srgb, var(--home-accent) 35%, transparent);\n  color: var(--home-accent-soft, var(--home-accent));\n}\n.spend-covered > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.spend-month {\n  margin-top: 4px;\n  padding-top: 3px;\n  border-top: 1px solid rgb(255 255 255 / 0.06);\n}\n.spend-month .spend-flag { white-space: nowrap; }\n.spend-top-head {\n  font-size: 9.5px;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  padding: 2px 0 1px;\n}\n.spend-month.spend-near .spend-flag,\n.spend-month.spend-pace .spend-flag { color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.spend-month.spend-over,\n.spend-month.spend-over .spend-flag { color: var(--home-error); }\n.spend-top { margin-top: 3px; }\n.home-widget .row.spend-session { cursor: pointer; border-radius: 2px; }\n.home-widget .row.spend-session:hover { background: color-mix(in srgb, var(--home-accent) 10%, transparent); }\n.home-widget .row.spend-session:hover .row-name { color: var(--home-accent); }\n.home-root.editing .home-widget .row.spend-session { cursor: inherit; }\n.spend-tag {\n  font-size: 9px;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  color: var(--color-muted-foreground, #6b7387);\n  align-self: center;\n}\n.spend-tag-metered { color: var(--home-accent); }\n.spend-cost { min-width: 6ch; text-align: right; }\n.spend-foot { display: flex; flex-wrap: wrap; gap: 0 10px; font-size: 9.5px; padding-top: 2px; }\n.spend-cap-val { min-width: 4ch; text-align: center; color: var(--home-accent); }\n\n/* Sessions widget: per-row token count (shown while sorting/filtering by it). */\n.ses-tok { font-variant-numeric: tabular-nums; color: var(--home-accent-soft); }\n\n/* ── logs widget (per-file record list) ── */\n.logs-sub {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 8px;\n}\n.logs-file {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  color: var(--home-accent);\n}\n/* The wrapper owns the widget's remaining height so the list scrolls inside it\n * instead of growing past the bottom edge (the old calc() resolved against an\n * auto-height parent and never clamped). */\n.home-logs-wrap {\n  display: flex;\n  flex-direction: column;\n  height: calc(100% - 21px);\n  min-height: 0;\n}\n.home-logs {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  flex: 1 1 0;\n  min-height: 0;\n  overflow-y: auto;\n  margin-top: 3px;\n  /* Rows that don't fit fade out instead of being sliced by the edge. */\n  mask-image: linear-gradient(180deg, #000 calc(100% - 14px), transparent);\n}\n.log-row {\n  display: flex;\n  gap: 6px;\n  align-items: baseline;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  cursor: default;\n}\n.log-row:last-child { border-bottom: none; }\n.log-lvl {\n  flex: none;\n  width: 32px;\n  font-size: 9px;\n  font-weight: 600;\n  letter-spacing: 0.03em;\n}\n.log-lvl.lvl-error { color: var(--home-error); }\n.log-lvl.lvl-warn { color: #f5b945; }\n.log-lvl.lvl-info { color: var(--color-muted-foreground, #6b7387); }\n.log-time {\n  flex: none;\n  font-size: 9px;\n  color: var(--color-muted-foreground, #6b7387);\n  font-variant-numeric: tabular-nums;\n}\n.log-msg {\n  flex: 1;\n  min-width: 0;\n  font-size: 10px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.home-matrix-c {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n\n/* ── notes widget ── */\n.home-notes { display: flex; flex-direction: column; gap: 1px; height: calc(100% - 18px); overflow-y: auto; }\n.home-notes .note-row {\n  display: flex;\n  align-items: baseline;\n  gap: 7px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n}\n.home-notes .note-mark {\n  cursor: pointer;\n  width: 12px;\n  text-align: center;\n  color: var(--home-accent);\n  flex-shrink: 0;\n}\n.home-notes .note-mark.done { color: var(--color-muted-foreground, #6b7387); }\n.home-notes .note-text { cursor: text; flex: 1; min-width: 0; overflow-wrap: anywhere; }\n.home-notes .note-text.done {\n  text-decoration: line-through;\n  color: var(--color-muted-foreground, #6b7387);\n}\n.home-notes .note-input {\n  flex: 1;\n  min-width: 0;\n  background: none;\n  border: none;\n  border-bottom: 1px dashed var(--home-border);\n  outline: none;\n  color: inherit;\n  font: inherit;\n  padding: 0;\n}\n.home-notes .note-add {\n  align-self: flex-start;\n  margin-top: 4px;\n  background: none;\n  border: none;\n  cursor: pointer;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  padding: 2px 6px 2px 2px;\n}\n.home-notes .note-add:hover { color: var(--home-accent); }\n\n/* ── canvas widgets (heartbeat, life) ── */\n.home-canvas {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n/* Life is drawable in rest mode — signal it with a crosshair. */\n.home-root:not(.editing) .home-life { cursor: crosshair; }\n\n/* ── moon ── */\n.home-moon-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  height: calc(100% - 18px);\n}\n.home-moon-c { flex: 1; width: 100%; min-height: 0; }\n.home-moon-label {\n  color: var(--home-accent-dim);\n  font-size: max(8px, min(3cqw, 6cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n\n/* ── pomodoro / countdown ── */\n.home-pomo .home-clock,\n.home-count .home-clock { cursor: pointer; }\n.home-pomo .home-clock.paused { opacity: 0.55; }\n.home-pomo .pomo-sub { cursor: pointer; }\n.home-count .count-label { cursor: pointer; }\n.home-count .count-input,\n.home-pomo .count-input { max-width: 92%; text-align: center; color-scheme: dark; }\n\n/* ── countdown segment editor (alarm-style spinners) ── */\n.count-edit {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 3px;\n  height: calc(100% - 18px);\n}\n.count-edit-row { display: flex; align-items: center; gap: 5px; }\n.count-seg { display: flex; flex-direction: column; align-items: center; }\n.count-seg .seg-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0;\n  line-height: 0.6;\n  font-size: 8px;\n  color: var(--home-accent-dim);\n}\n.count-seg .seg-btn:hover { color: var(--home-accent); }\n.count-seg .seg-val {\n  background: none;\n  border: none;\n  outline: none;\n  text-align: center;\n  color: var(--home-accent);\n  font: inherit;\n  font-weight: 800;\n  font-size: max(12px, min(7cqw, 15cqh));\n  padding: 1px 0;\n  border-bottom: 1px solid transparent;\n  letter-spacing: 0.02em;\n}\n.count-seg input.seg-val:focus { border-bottom-color: var(--home-accent); }\n.count-seg .seg-static { cursor: default; }\n.count-colon {\n  font-weight: 800;\n  color: var(--home-accent-dim);\n  font-size: max(12px, min(7cqw, 15cqh));\n}\n.count-done {\n  margin-top: 3px;\n  background: none;\n  border: 1px solid var(--home-border);\n  border-radius: 6px;\n  color: var(--home-accent);\n  cursor: pointer;\n  font: inherit;\n  font-size: 10px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  padding: 2px 12px;\n}\n.count-done:hover { border-color: var(--home-accent); }\n.home-pomo .pomo-min {\n  font-size: min(20cqw, 40cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  max-width: 70%;\n}\n/* Hover steppers for the pomodoro work/break lengths. */\n.hover-ctl.pomo-set { flex-direction: column; align-items: flex-end; gap: 1px; }\n.pomo-stepper { display: flex; align-items: center; gap: 3px; }\n.pomo-stepper .hv-label:nth-child(3) { min-width: 16px; text-align: center; color: var(--home-accent); }\n\n/* ── calendar ── */\n.home-cal { height: calc(100% - 18px); display: flex; flex-direction: column; }\n.home-cal-month {\n  text-align: center;\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.2cqw, 7cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-bottom: 4px;\n}\n.home-cal-grid {\n  flex: 1;\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  align-content: space-evenly;\n  justify-items: center;\n  font-size: max(8px, min(3cqw, 6.5cqh));\n}\n.home-cal-h { color: var(--color-muted-foreground, #6b7387); }\n.home-cal-d { color: var(--color-foreground, #d8dce6); opacity: 0.75; }\n.home-cal-today {\n  color: #000;\n  background: var(--home-accent);\n  border-radius: 4px;\n  padding: 0 4px;\n  font-weight: 700;\n}\n/* Density tiers, chosen from the widget's cell width (see CalendarWidget). */\n.home-cal.tier-mini .home-cal-month {\n  font-size: max(8px, min(4cqw, 8cqh));\n  margin-bottom: 2px;\n}\n.home-cal.tier-mini .home-cal-grid { font-size: max(9px, min(4cqw, 8cqh)); }\n.home-cal.tier-large .home-cal-month {\n  font-size: max(11px, min(3cqw, 7cqh));\n  margin-bottom: 7px;\n}\n.home-cal.tier-large .home-cal-grid { row-gap: 3px; }\n.home-cal.tier-large .home-cal-h { font-weight: 700; opacity: 0.8; }\n.home-cal.tier-large .home-cal-today { padding: 1px 6px; }\n\n/* ── page chrome ── */\n/* Edit affordance lives BELOW the grid, centered. It fades in once the user\n * starts scrolling down (or immediately when the grid is short enough that\n * there's nothing to scroll), keeping the home clean on first paint. While\n * editing it sticks to the bottom of the viewport so it stays reachable. */\n.home-editbar {\n  display: flex;\n  justify-content: center;\n  gap: 10px;\n  padding: 22px 12px 30px;\n  opacity: 0;\n  transition: opacity 0.25s ease;\n  pointer-events: none;\n}\n.home-editbar.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n.home-root.editing .home-editbar {\n  position: sticky;\n  bottom: 0;\n}\n.home-fab {\n  position: relative;\n  width: 38px;\n  height: 38px;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 15px;\n  cursor: pointer;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition:\n    border-color 0.25s ease,\n    background 0.35s ease,\n    box-shadow 0.45s ease,\n    transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n.home-fab:hover {\n  border-color: var(--home-accent);\n  transform: scale(1.06);\n}\n.home-fab:active { transform: scale(0.94); }\n.home-fab.active {\n  background: color-mix(in srgb, var(--home-accent) 22%, transparent);\n  /* Warm Hermes glow ring when edit mode engages. */\n  animation: home-fab-glow 0.55s ease-out;\n}\n\n/* Crossfading edit ✎ ↔ done ✓ glyphs — each rotates and scales through the\n * swap with a gentle overshoot, matching the dashboard's soft motion. */\n.home-fab-ico {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition:\n    opacity 0.3s ease,\n    transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1);\n}\n.ico-edit { opacity: 1; transform: rotate(0) scale(1); }\n.ico-done { opacity: 0; transform: rotate(-120deg) scale(0.3); }\n.home-fab.active .ico-edit { opacity: 0; transform: rotate(120deg) scale(0.3); }\n.home-fab.active .ico-done { opacity: 1; transform: rotate(0) scale(1); }\n\n.home-fab-spin {\n  display: inline-block;\n  animation: home-fab-spin-in 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n\n/* The restore-default button slides up into place, like the dashboard's\n * dialog-in entrance. */\n.home-fab-enter {\n  animation: home-fab-enter 0.32s cubic-bezier(0.34, 1.3, 0.64, 1);\n}\n\n@keyframes home-fab-glow {\n  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--home-accent) 55%, transparent); }\n  100% { box-shadow: 0 0 0 13px transparent; }\n}\n@keyframes home-fab-spin-in {\n  from { transform: rotate(-150deg); opacity: 0.3; }\n  to   { transform: rotate(0); opacity: 1; }\n}\n@keyframes home-fab-enter {\n  from { opacity: 0; transform: translateY(6px) scale(0.9); }\n  to   { opacity: 1; transform: translateY(0) scale(1); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .home-fab,\n  .home-fab-ico,\n  .home-fab-spin,\n  .home-fab-enter { animation: none; transition: opacity 0.2s ease; }\n}\n\n/* ── toast (plugin-local; the host toast isn't exposed in the SDK) ── */\n.home-toast {\n  position: fixed;\n  bottom: 18px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 80;\n  padding: 8px 16px;\n  border-radius: 8px;\n  font-size: 12px;\n  color: var(--home-error, #e25555);\n  background: var(--home-surface);\n  border: 1px solid var(--home-error, #e25555);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n  animation: home-toast-in 0.25s ease;\n}\n@keyframes home-toast-in {\n  from { opacity: 0; transform: translateX(-50%) translateY(8px); }\n  to { opacity: 1; transform: translateX(-50%) translateY(0); }\n}\n\n/* Catalog reveal: the wrapper animates its row track 0fr → 1fr so the panel\n * grows/collapses its real height smoothly (no grid jump), with a matching\n * fade. Kept mounted so the exit animates too. */\n.home-catalog-wrap {\n  display: grid;\n  grid-template-rows: 0fr;\n  margin: 0 12px;\n  opacity: 0;\n  pointer-events: none;\n  transition:\n    grid-template-rows 0.34s cubic-bezier(0.34, 1.2, 0.64, 1),\n    opacity 0.28s ease,\n    margin-bottom 0.34s ease;\n}\n.home-catalog-wrap.open {\n  grid-template-rows: 1fr;\n  opacity: 1;\n  pointer-events: auto;\n  margin-bottom: 8px;\n}\n.home-catalog {\n  overflow: hidden;\n  min-height: 0;\n  border-radius: 8px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition: border-color 0.2s ease, background 0.2s ease;\n}\n/* Highlighted as a delete target while a widget is dragged over it. */\n.home-catalog-wrap.trash-active .home-catalog {\n  border-color: var(--home-error);\n  border-style: dashed;\n  background: color-mix(in srgb, var(--home-error) 10%, var(--home-surface));\n}\n.home-catalog-inner {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  padding: 10px;\n}\n.home-catalog-hint {\n  font-size: 10px;\n  letter-spacing: 0.04em;\n  color: var(--color-muted-foreground, #6b7387);\n  margin-right: 4px;\n}\n.home-catalog-wrap.trash-active .home-catalog-hint { color: var(--home-error); }\n.home-catalog-chip { touch-action: none; }\n.home-catalog-chip {\n  font-family: inherit;\n  font-size: 11px;\n  padding: 4px 10px;\n  border-radius: 6px;\n  cursor: pointer;\n  background: none;\n  border: 1px dashed var(--home-border);\n  color: var(--color-foreground, #d8dce6);\n  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;\n}\n.home-catalog-chip:hover {\n  border-color: var(--home-accent);\n  color: var(--home-accent);\n  transform: translateY(-1px);\n}\n.home-catalog-chip:active { transform: scale(0.95); }\n.home-catalog .empty { color: var(--color-muted-foreground, #6b7387); font-size: 11px; }\n\n@media (prefers-reduced-motion: reduce) {\n  .home-catalog-wrap { transition: opacity 0.2s ease; }\n}\n\n/* ── projects widget (~/projects/<name>/status.json) ── */\n.home-projects {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  max-height: calc(100% - 18px);\n  overflow-y: auto;\n}\n.project-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  border-left: 2px solid var(--home-border);\n  background: color-mix(in srgb, var(--home-accent) 4%, transparent);\n  cursor: pointer;\n}\n.project-row:hover,\n.project-item.open .project-row { background: color-mix(in srgb, var(--home-accent) 10%, transparent); }\n.project-row.ok { border-left-color: var(--home-accent); }\n.project-row.warn { border-left-color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.project-row.err { border-left-color: var(--home-error); }\n.project-icon { font-size: 9px; color: var(--color-muted-foreground, #6b7387); }\n.project-row.ok .project-icon { color: var(--home-accent); }\n.project-row.warn .project-icon { color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.project-row.err .project-icon { color: var(--home-error); }\n.project-name {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n.project-stats { font-variant-numeric: tabular-nums; color: var(--home-accent-soft); font-size: 10px; }\n.project-time { color: var(--color-muted-foreground, #6b7387); font-size: 9.5px; white-space: nowrap; }\n.project-caret { color: var(--color-muted-foreground, #6b7387); font-size: 9px; width: 10px; text-align: center; }\n.project-detail {\n  margin: 1px 0 3px 12px;\n  padding: 4px 8px;\n  border-left: 1px dashed var(--home-border);\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  font-size: 10px;\n}\n.project-detail-row { line-height: 1.4; }\n.project-alerts ul { margin: 2px 0 0 14px; padding: 0; list-style: disc; }\n.project-alerts li { color: var(--home-error); }\n\n/* ── boards (full page inside the Home tab on the web dashboard) ── */\n.home-board-page { position: relative; height: calc(100vh - 72px); min-height: 480px; }\n.home-board-page.desktop { height: 100%; }\n";
const boardCss = `/* Board — "Mesa de despacho" (hd-canvas-plan/mockup-v2). Everything is scoped under .hb.
 * One accent: the theme primary. Hermes is a material (dot matrix + caduceus), not a hue.
 * Two families, both the host's: Hermes Desktop's UI sans for text and controls, the Home's
 * mono for structure (headers, counts, keys, data). No embedded fonts.
 * Radii: flush chrome 0 · cards & buttons 3 · panels 4 · floating menus 6 · checkboxes 2.
 * Motion: 120-200 ms ease-out, none under prefers-reduced-motion. */

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
.hb .hd .n { order: 3; font-weight: 400; letter-spacing: .06em; color: var(--ink-3); }

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
.hb-link .skel { display: grid; gap: 7px; margin-top: 10px; }
.hb-link .skel i { height: 6px; background: color-mix(in srgb, var(--accent) 9%, transparent); }
.hb-link .skel i:nth-child(1) { width: 78%; } .hb-link .skel i:nth-child(2) { width: 92%; } .hb-link .skel i:nth-child(3) { width: 54%; }
.hb-link .thumb.skel-thumb { background:
  repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent) 7%, transparent) 0 1px, transparent 1px 24px),
  repeating-linear-gradient(0deg, color-mix(in srgb, var(--accent) 7%, transparent) 0 1px, transparent 1px 24px), var(--well); }

/* video card: poster first, the player mounts on click */
.hb-video { overflow: hidden; }
.hb-video .stage { position: relative; aspect-ratio: 16 / 9; background: #000; overflow: hidden; border-bottom: 1px solid var(--rule); }
.hb-video.vert .stage { aspect-ratio: 9 / 16; }
.hb-video .stage img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .86; transition: opacity .16s; }
.hb-video .stage:hover img { opacity: 1; }
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
.hb-image .cap { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 6px 11px; min-height: 12px; }
.hb-image .cap b { font: 600 13px/1.2 var(--sans); }

/* embed: a window */
.hb-embed { padding: 0; overflow: hidden; }
.hb-embed .bar-e { height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 12px; border-bottom: 1px solid var(--rule); font: 400 11px/1 var(--mono); white-space: nowrap; overflow: hidden; }
.hb-embed .file { color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.hb-embed .sb { color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; }
.hb-embed .tools { margin-left: auto; display: flex; gap: 2px; }
.hb-embed .frame { display: block; width: 100%; height: 240px; border: 0; background: var(--well); }
.hb-embed .shield { position: absolute; inset: 0; z-index: 1; display: flex; align-items: flex-end; justify-content: flex-end; padding: 8px; cursor: pointer; }
.hb-embed .shield span { font: 400 10.5px/1 var(--mono); color: var(--ink-2); padding: 4px 6px; border-radius: var(--r-ctl); background: var(--float-bg); border: 1px solid var(--float-line);
  opacity: 0; transition: opacity .14s var(--out); }
.hb-embed .shield:hover span, .hb-embed .shield:focus-visible span { opacity: 1; }
.hb-embed .foot { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 9px; border-top: 1px solid var(--rule); }
.hb .kbtn { height: 24px; width: 24px; display: inline-grid; place-items: center; border-radius: var(--r-ctl); color: var(--ink-3); transition: color .14s var(--out), background-color .14s var(--out); }
.hb .kbtn:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--ink); }

/* nested board */
.hb-boardref { padding: 6px; cursor: pointer; }
.hb-boardref .pv { height: 110px; background: var(--well); position: relative; overflow: hidden; border: 1px solid var(--rule); }
.hb-boardref .pv i { position: absolute; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.hb-boardref .pv i.c { background: color-mix(in srgb, var(--accent) 24%, transparent); }
.hb-boardref .pv i.h { background: none; outline: 1px dotted color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: -1px; }
.hb-boardref .ttl { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 10px 4px 3px; }
.hb-boardref .ttl b { font: 600 14px/1.2 var(--sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.hb-frame .lbl { position: absolute; left: 24px; top: -6px; display: flex; align-items: center; gap: 10px; padding: 0 6px; background: var(--bg); font: 700 10px/12px var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-2); white-space: nowrap; cursor: grab; }
.hb-frame .lbl em { font: 400 10.5px/12px var(--mono); letter-spacing: .02em; text-transform: none; font-style: normal; color: var(--ink-3); }
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
.hb-text { width: max-content; max-width: 560px; }
.hb-text.h { font: 700 15px/1 var(--mono); letter-spacing: .2em; text-transform: uppercase; color: var(--accent); display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.hb-text.h::before { content: ""; width: 22px; height: 1px; background: currentColor; opacity: .5; flex: none; }
.hb-text.h::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, currentColor, transparent 92%); opacity: .28; }
.hb-text.p { font: 400 13px/1.35 var(--sans); color: var(--ink-2); white-space: pre-wrap; }
/* sketch labels: the UI sans in italic, Alberto's voice without a third family */
.hb-text.s { font: italic 400 17px/1.25 var(--sans); color: var(--ink); opacity: .92; white-space: pre-wrap; }

/* freehand */
.hb-draw { overflow: visible; pointer-events: none; }
.hb-draw path { fill: none; stroke: var(--ink); stroke-linecap: round; stroke-linejoin: round; opacity: .88; pointer-events: stroke; }
.hb-draw.sel path { stroke: var(--accent); }

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
.hb .tagh svg { width: 8px; height: 10px; }
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
.hb-chat .ch-top .hd { flex: 1; min-width: 0; }
.hb-chat .ch-top .hd::after { display: none; }
.hb-chat .ch-top .who { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); }
.hb-chat .ch-top .who svg { width: 8px; height: 10px; }
.hb-chat .ch-top .n { text-transform: none; letter-spacing: .04em; }
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
.hb-chat .ch-tool { display: flex; align-items: center; gap: 8px; font: 400 10.5px/1.3 var(--mono); color: var(--ink-3); }
.hb-chat .ch-tool .dot { width: 4px; height: 4px; background: var(--rule-3); flex: none; }
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

.hb-live .lv-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); }
.hb-live .lv-metrics .m { display: flex; flex-direction: column; gap: 5px; padding: 10px 14px 11px; min-width: 0; box-shadow: inset -1px 0 0 var(--rule), inset 0 -1px 0 var(--rule); margin: 0 -1px -1px 0; }
.hb-live .lv-metrics .k { font: 700 9px/1 var(--mono); letter-spacing: .15em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-live .lv-metrics .v { font: 600 18px/1.05 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-live .lv-metrics .v em { font: 400 11px/1 var(--mono); font-style: normal; color: var(--ink-3); margin-left: 3px; }
.hb-live .lv-metrics .d { font: 400 10.5px/1 var(--mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
.hb-live .lv-metrics .d.good { color: var(--accent); }
.hb-live .lv-metrics .d.bad { color: var(--warn); }

.hb-live .lv-spark { padding: 10px 14px 12px; }
.hb-live .lv-spark .row { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.hb-live .lv-spark .k { font: 700 9px/1 var(--mono); letter-spacing: .15em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.hb-live .lv-log .k { display: block; margin-bottom: 6px; font: 700 9px/1 var(--mono); letter-spacing: .15em; text-transform: uppercase; color: var(--ink-3); }
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

/* sizes: narrow cards stack metrics in pairs, wide ones get room to breathe */
@container (max-width: 280px) {
  .hb-live .lv-metrics { grid-template-columns: 1fr 1fr; }
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
.hb-wires .lbl-bg { fill: var(--bg); }
.hb-wires .lbl { font: 400 10.5px var(--mono); fill: var(--ink-3); }
.hb-wires .line-sel { stroke: var(--accent); stroke-width: 1.5; fill: none; stroke-dasharray: 3 3; }
.hb-ghost { position: absolute; pointer-events: none; z-index: 50; opacity: .92; box-shadow: var(--lift); }
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
    SandboxedFrame: extras.SandboxedFrame
  };
}
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
const LANGUAGE_PROBE = "home.language";
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
    configureHomeHost(createDesktopHomeHost(ctx, host, { SandboxedFrame }));
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
