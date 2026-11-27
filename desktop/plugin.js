import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import * as PluginSdk from "@hermes/plugin-sdk";
import { host } from "@hermes/plugin-sdk";
import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useCallback, useLayoutEffect } from "react";
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
  "board.fit": "fit",
  "board.zoomIn": "Zoom in",
  "board.zoomOut": "Zoom out",
  "board.tool.select": "select",
  "board.tool.pan": "pan",
  "board.tool.note": "note",
  "board.tool.todo": "to-do",
  "board.tool.link": "link",
  "board.tool.image": "image",
  "board.tool.col": "column",
  "board.tool.board": "board",
  "board.tool.embed": "embed",
  "board.tool.arrow": "arrow",
  "board.tool.draw": "draw",
  "board.prompt.placeholder": "tell Hermes what to change, e.g. “turn Ideas into a flow”",
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
  "board.ctx.duplicate": "duplicate",
  "board.ctx.delete": "delete",
  "board.verb.diagram": "turn into a diagram",
  "board.verb.sortDate": "sort by date",
  "board.verb.split": "split into cards",
  "board.verb.expand": "expand",
  "board.verb.flow": "turn into a flow",
  "board.verb.group": "group",
  "board.verb.summarize": "summarize",
  "board.verb.improve": "tidy up",
  "board.cursor.adding": "adding {kind}",
  "board.cursor.placingStep": "placing step {n}",
  "board.cursor.connecting": "connecting {a} → {b}",
  "board.cursor.moving": "moving {what}",
  "board.cursor.editing": "editing {what}",
  "board.cursor.removing": "removing",
  "board.cursor.done": "done, {n} changes",
  "board.log.changes": "Made {n} changes.",
  "board.log.undo": "undo",
  "board.log.openSession": "open in session",
  "board.log.you": "you",
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
  "board.empty.body": "Paste a link or an image, drop a file, or double-click to write a note. Ask Hermes below and he draws here with you.",
  "board.empty.keys": "N note · T to-do · C column · A arrow · D draw · / ask Hermes",
  "board.ask.link": "Add a link",
  "board.ask.embed": "Embed HTML",
  "board.ask.linkHint": "Pages become cards with a preview; YouTube, Vimeo, Loom and X become players.",
  "board.ask.embedHint": "Runs in a sandbox: scripts only, no network. ⌘↵ to add.",
  "board.ask.cancel": "Cancel",
  "board.ask.add": "Add",
  "board.toast.uploading": "uploading image…",
  "board.toast.imageFailed": "image not added: {error}",
  "board.toast.badUrl": "that is not an http(s) link",
  "board.toast.sent": "sent to Hermes, watch the board",
  "board.toast.promptCopied": "prompt copied: paste it in the chat",
  "board.toast.offline": "board offline, retrying",
  "board.session.draft": `Let's work on my board "{name}" {marker}. `,
  "board.index.title": "Boards",
  "board.index.lead": "One board per idea. Hermes draws on it with you, and every board keeps its own session.",
  "board.index.new": "New board",
  "board.index.newHint": "N inside a board for a note",
  "board.index.delete": "delete",
  "board.index.confirmDelete": 'Delete the board "{name}"? It moves to the trash folder.',
  "board.widget.empty": "No boards yet."
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
  "board.fit": "ajustar",
  "board.zoomIn": "Acercar",
  "board.zoomOut": "Alejar",
  "board.tool.select": "elegir",
  "board.tool.pan": "mover",
  "board.tool.note": "nota",
  "board.tool.todo": "pendientes",
  "board.tool.link": "liga",
  "board.tool.image": "imagen",
  "board.tool.col": "columna",
  "board.tool.board": "pizarrón",
  "board.tool.embed": "html",
  "board.tool.arrow": "flecha",
  "board.tool.draw": "dibujar",
  "board.prompt.placeholder": "dile a Hermes qué cambiar, p. ej. «convierte Ideas en un flujo»",
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
  "board.ctx.duplicate": "duplicar",
  "board.ctx.delete": "borrar",
  "board.verb.diagram": "pásalo a diagrama",
  "board.verb.sortDate": "ordenar por fecha",
  "board.verb.split": "separar en tarjetas",
  "board.verb.expand": "desarrollar",
  "board.verb.flow": "convertir en flujo",
  "board.verb.group": "agrupar",
  "board.verb.summarize": "resumir",
  "board.verb.improve": "acomodar",
  "board.cursor.adding": "agregando {kind}",
  "board.cursor.placingStep": "colocando paso {n}",
  "board.cursor.connecting": "conectando {a} → {b}",
  "board.cursor.moving": "moviendo {what}",
  "board.cursor.editing": "editando {what}",
  "board.cursor.removing": "quitando",
  "board.cursor.done": "listo, {n} cambios",
  "board.log.changes": "Hizo {n} cambios.",
  "board.log.undo": "deshacer",
  "board.log.openSession": "abrir en sesión",
  "board.log.you": "tú",
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
  "board.empty.body": "Pega una liga o una imagen, suelta un archivo o da doble clic para escribir una nota. Pídele algo a Hermes abajo y dibuja aquí contigo.",
  "board.empty.keys": "N nota · T pendientes · C columna · A flecha · D dibujar · / pedirle a Hermes",
  "board.ask.link": "Agregar una liga",
  "board.ask.embed": "Incrustar HTML",
  "board.ask.linkHint": "Las páginas se vuelven tarjetas con vista previa; YouTube, Vimeo, Loom y X, reproductores.",
  "board.ask.embedHint": "Corre aislado: solo scripts, sin red. ⌘↵ para agregar.",
  "board.ask.cancel": "Cancelar",
  "board.ask.add": "Agregar",
  "board.toast.uploading": "subiendo imagen…",
  "board.toast.imageFailed": "no se agregó la imagen: {error}",
  "board.toast.badUrl": "eso no es una liga http(s)",
  "board.toast.sent": "enviado a Hermes, mira el pizarrón",
  "board.toast.promptCopied": "mensaje copiado: pégalo en el chat",
  "board.toast.offline": "pizarrón sin conexión, reintentando",
  "board.session.draft": "Trabajemos en mi pizarrón «{name}» {marker}. ",
  "board.index.title": "Pizarrones",
  "board.index.lead": "Un pizarrón por idea. Hermes dibuja en él contigo y cada pizarrón tiene su propia sesión.",
  "board.index.new": "Nuevo pizarrón",
  "board.index.newHint": "N dentro de un pizarrón para una nota",
  "board.index.delete": "borrar",
  "board.index.confirmDelete": "¿Borrar el pizarrón «{name}»? Se mueve a la carpeta de papelera.",
  "board.widget.empty": "Todavía no hay pizarrones."
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
let current = computeLanguage();
function setHostLanguage(language) {
  hostLanguage = language ?? null;
  const next = computeLanguage();
  if (next === current) return;
  current = next;
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
const t = (key, vars) => translatorFor(current)(key, vars);
function useT() {
  const [language, setLanguage] = useState(current);
  useEffect(() => {
    const onChange = () => setLanguage(current);
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
  const [show, setShow] = useState(false);
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
          className: `home-spark-tip${show ? " show" : ""}`,
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
        show && tip?.pt && /* @__PURE__ */ jsx("circle", { cx: tip.pt[0], cy: tip.pt[1], r: 2.4, fill: "var(--home-accent)", vectorEffect: "non-scaling-stroke" }),
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
function Spark({ values, fixedMax, label, readout, gid }) {
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
        Spark,
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
  preview: (url) => fetchJSON(`${BASE}/link-preview`, json("POST", { url })).then((r) => r.preview)
};
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
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",", 2)[1] ?? "");
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
        run();
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
  draw: [120, 80]
};
function approxRect(item) {
  if (item.k === "line" || item.in || item.x == null || item.y == null) return null;
  const [dw, dh] = DEFAULT_SIZE[item.k] ?? [200, 100];
  let h = item.h ?? dh;
  if (item.k === "col") h = 60 + 96 * (item.kids?.length ?? 0);
  if (item.k === "todo") h = 110 + 26 * (item.items?.length ?? 0);
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
          children: "×"
        }
      )
    ] }, i)) }),
    /* @__PURE__ */ jsxs("label", { className: "addrow", "data-nodrag": "", children: [
      /* @__PURE__ */ jsx("b", { children: "+" }),
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
      /* @__PURE__ */ jsx("b", { children: "+" }),
      c.t("board.col.add"),
      /* @__PURE__ */ jsx("span", { className: "k", children: "N" })
    ] })
  ] });
}
const PLAY = /* @__PURE__ */ jsx("svg", { viewBox: "0 0 10 12", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M0 0 10 6 0 12z" }) });
function VideoView({ id, item, c }) {
  const poster = useAsset(item.img);
  const playing = c.playing === id;
  const direct = item.k === "video" ? item.src : void 0;
  const player = item.video ? playerUrl(item.video) : null;
  const vert = !!item.video?.vert;
  const site = item.site || (item.url ? hostOf(item.url) : direct ? hostOf(direct) : "");
  const title = item.title || (direct ? direct.split("/").pop() : "") || c.t("board.video.untitled");
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-video${vert ? " vert" : ""}${item.by === "h" ? " dm" : ""}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "stage", children: [
      playing && player && /* @__PURE__ */ jsx(
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
      playing && direct && /* @__PURE__ */ jsx("video", { src: direct, controls: true, autoPlay: true, preload: "metadata", "data-nodrag": "" }),
      !playing && (poster ? /* @__PURE__ */ jsx("img", { src: poster, alt: "", draggable: false }) : /* @__PURE__ */ jsx("div", { className: "poster-empty", children: site })),
      !playing && (player || direct) && /* @__PURE__ */ jsxs("button", { className: "play", "data-nodrag": "", onClick: () => c.setPlaying(id), children: [
        PLAY,
        c.t("board.video.play")
      ] })
    ] }),
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
function EmbedView({ item, c }) {
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
  const height = tall ? 520 : item.h ? Math.max(120, item.h - 80) : 240;
  return /* @__PURE__ */ jsxs("div", { className: `hb-card hb-embed${item.by === "h" ? " dm" : ""}`, style: { width: item.w ?? 452 }, children: [
    /* @__PURE__ */ jsxs("div", { className: "bar-e", children: [
      /* @__PURE__ */ jsx("span", { className: "file", children: item.title || c.t("board.embed.title") }),
      /* @__PURE__ */ jsx("span", { className: "sb", children: c.t("board.embed.sandbox") }),
      /* @__PURE__ */ jsxs("span", { className: "tools", children: [
        /* @__PURE__ */ jsx("button", { className: "kbtn", "data-nodrag": "", title: c.t("board.embed.reload"), onClick: () => setNonce((n) => n + 1), children: "↻" }),
        /* @__PURE__ */ jsx("button", { className: "kbtn", "data-nodrag": "", title: c.t("board.embed.taller"), onClick: () => setTall((v) => !v), children: "⤢" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { "data-nodrag": "", style: { height }, children: html == null ? /* @__PURE__ */ jsx("div", { className: "frame", style: { height } }) : Frame ? /* @__PURE__ */ jsx(Frame, { src: toDataUrl(html), title: item.title || "embed", className: "frame", style: { height } }, nonce) : /* @__PURE__ */ jsx(
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
    ) }),
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
          /* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsxs("button", { "data-nodrag": "", onClick: () => item.ref && c.openBoard(item.ref), children: [
            c.t("board.ref.open"),
            " ↗"
          ] }) })
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
      return /* @__PURE__ */ jsx(EmbedView, { item, c });
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
    const tick = async () => {
      if (!document.hidden) await pull();
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
  [{ tool: "select", key: "V", label: "board.tool.select" }, { tool: "pan", key: "H", label: "board.tool.pan" }],
  [
    { tool: "note", key: "N", label: "board.tool.note" },
    { tool: "todo", key: "T", label: "board.tool.todo" },
    { tool: "link", key: "L", label: "board.tool.link" },
    { tool: "image", key: "I", label: "board.tool.image" },
    { tool: "col", key: "C", label: "board.tool.col" },
    { tool: "board", key: "B", label: "board.tool.board" },
    { tool: "embed", key: "E", label: "board.tool.embed" }
  ],
  [{ tool: "arrow", key: "A", label: "board.tool.arrow" }, { tool: "draw", key: "D", label: "board.tool.draw" }]
];
const KEY_TOOL = Object.fromEntries(TOOLS.flat().map((x) => [x.key.toLowerCase(), x.tool]));
const PLACE = ["note", "todo", "col", "link", "board", "embed", "image"];
const EDITABLE = /* @__PURE__ */ new Set(["card", "todo", "col", "frame", "box", "text", "image"]);
const INTO_COLUMN = /* @__PURE__ */ new Set(["card", "todo", "link", "image", "video", "board"]);
const RESIZE_H = /* @__PURE__ */ new Set(["frame", "box", "embed", "text"]);
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
  const promptRef = useRef(null);
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
  const [prompt, setPrompt] = useState("");
  const [narrow, setNarrow] = useState("");
  const [cursorAct, setCursorAct] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [, setNow] = useState(0);
  const Frame = hostSandboxedFrame();
  const flash = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => cur === msg ? null : cur), 3200);
  }, []);
  const onHermes = useCallback((entries, doc2) => {
    const steps = [];
    const hide = /* @__PURE__ */ new Set();
    let changes = 0;
    for (const e of entries) {
      for (const op of e.ops) {
        if (op.op === "board") continue;
        changes++;
        const id = op.op === "put" || op.op === "set" || op.op === "del" ? op.id : null;
        if (!id) continue;
        const it = doc2.items[id];
        if (op.op === "put") hide.add(id);
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
          locate: () => locateFor(id),
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
    if (hide.size) setHidden((h) => /* @__PURE__ */ new Set([...h, ...hide]));
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
  function locateFor(id) {
    const r = getRect(id);
    const it = docRef.current?.items[id];
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
  const applyView = useCallback(() => {
    const v = view.current, world = worldRef.current, grid = gridRef.current;
    if (!world || !grid) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    world.style.setProperty("--iz", String(1 / v.z));
    const g = 24 * v.z, G = g * 5, c = 4.5;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${G}' height='${G}'><path d='M${-c} 0H${c}M0 ${-c}V${c}M${G - c} 0H${G + c}M${G} ${-c}V${c}M${-c} ${G}H${c}M0 ${G - c}V${G + c}M${G - c} ${G}H${G + c}M${G} ${G - c}V${G + c}' stroke='rgba(255,227,196,0.16)' stroke-width='1'/></svg>`;
    grid.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}"), radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent) .9px, transparent 1.2px)`;
    grid.style.backgroundSize = `${G}px ${G}px, ${g}px ${g}px`;
    grid.style.backgroundPosition = `${v.x}px ${v.y}px, ${v.x}px ${v.y}px`;
    if (pctRef.current) pctRef.current.textContent = `${Math.round(v.z * 100)}%`;
    drawMap();
  }, [drawMap]);
  const saveView = useCallback(() => {
    try {
      sessionStorage.setItem(`hb.view.${bid}`, JSON.stringify(view.current));
    } catch {
    }
  }, [bid]);
  const zoomAt = useCallback((f, sx, sy) => {
    const v = view.current;
    const nz = Math.min(2.4, Math.max(0.2, v.z * f));
    const wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
    view.current = { z: nz, x: sx - wx * nz, y: sy - wy * nz };
    applyView();
    saveView();
  }, [applyView, saveView]);
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
    const ro = new RO(() => setNarrow(el.clientWidth < 760 ? "narrow tiny" : el.clientWidth < 1180 ? "narrow" : ""));
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
  const sendToHermes = useCallback(async (text) => {
    const d = docRef.current;
    if (!d || !text.trim()) return;
    const sel = [...selected].filter((id) => d.items[id]);
    const body = `[board:${d.id}] ${text.trim()}${sel.length ? ` (${t2("board.prompt.selection")}: ${sel.join(", ")})` : ""}`;
    setLog((l) => [...l.slice(-3), { key: `y${Date.now()}`, t: Date.now() / 1e3, who: "you", msg: text.trim() }]);
    setLogOn(true);
    const rpc = hostRpc();
    if (rpc) {
      try {
        let sid;
        if (d.session?.id) {
          const r = await rpc("session.resume", { session_id: d.session.id, omit_messages: true, lazy: true });
          sid = r?.session_id;
        } else {
          const r = await rpc("session.create", {});
          sid = r?.session_id;
        }
        if (sid) {
          await rpc("prompt.submit", { session_id: sid, text: body });
          flash(t2("board.toast.sent"));
          return;
        }
      } catch {
      }
    }
    if (d.session?.id) {
      try {
        await navigator.clipboard?.writeText(body);
      } catch {
      }
      openSession(d.session.id);
      flash(t2("board.toast.promptCopied"));
    } else {
      const ok = await newChatWithDraft(body);
      if (!ok) flash(t2("board.toast.promptCopied"));
    }
  }, [flash, selected, t2]);
  const onPointerDown = (e) => {
    const d = docRef.current;
    if (!d || e.button === 2) return;
    const target = e.target;
    if (target.closest("[data-nodrag], .hb-ctx, input, textarea, a, iframe, video")) return;
    if (editing && !target.closest(`[data-iid="${editing}"]`)) setEditing(null);
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
      const it = d.items[r.id];
      const p = { w: Math.round(r.w) };
      if (RESIZE_H.has(it.k)) p.h = Math.round(r.h);
      commit([{ op: "set", id: r.id, p }]);
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
  const onWheel = useCallback((e) => {
    if (e.target.closest?.(".hb-embed .frame, .hb-video .stage, textarea")) return;
    e.preventDefault();
    const rect = vpRef.current.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
    else {
      view.current = { ...view.current, x: view.current.x - e.deltaX, y: view.current.y - e.deltaY };
      applyView();
      saveView();
    }
  }, [applyView, saveView, zoomAt]);
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [onWheel]);
  useEffect(() => {
    const onKey = (e) => {
      if (!rootRef.current?.isConnected || ask) return;
      if (e.key === " " && !isTyping(e.target)) {
        space.current = e.type === "keydown";
        if (e.type === "keydown") e.preventDefault();
        return;
      }
      if (e.type !== "keydown" || isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) sync.redo();
        else sync.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        sync.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const d = docRef.current;
        if (d) setSelected(new Set(Object.keys(d.items).filter((id) => !d.items[id].in)));
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        void continueInSession();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === "Escape") {
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
        promptRef.current?.focus();
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
  }, [ask, center, commit, continueInSession, deleteSelection, duplicate, fit, selected, sync, zoomAt]);
  useEffect(() => {
    const onPaste = (e) => {
      if (!rootRef.current?.isConnected || isTyping(e.target) || ask) return;
      const files = [...e.clipboardData?.files ?? []].filter((f) => f.type.startsWith("image/"));
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
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      void addImageFiles(files, at);
      return;
    }
    const url = extractUrl(e.dataTransfer.getData("text/uri-list").split("\n")[0] || e.dataTransfer.getData("text/plain"));
    if (url) addUrl(url, at);
  };
  const hermesActive = !!(doc?.hermes && Date.now() / 1e3 - doc.hermes.at < HERMES_ACTIVE_S) || !!cursorAct;
  const presenceLabel = (() => {
    if (!doc) return "";
    const on = doc.hermes?.on ? doc.items[doc.hermes.on] : null;
    const frame = on ? Object.values(doc.items).find((f) => f.k === "frame" && f.by === "h") : null;
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
  } : null, [Frame, commit, doc, editing, hidden, kidDrag, onOpenBoard, playing, regEl, selected, t2, update]);
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
        return ["board.verb.summarize"];
      default:
        return ["board.verb.improve"];
    }
  })();
  const rootCls = `hb ${narrow}`.trim();
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
  const vpCls = `hb-viewport${tool === "pan" ? " tool-pan" : ""}${tool === "draw" ? " tool-draw" : ""}${tool === "arrow" ? " tool-arrow" : ""}${PLACE.includes(tool) ? " tool-place" : ""}`;
  return /* @__PURE__ */ jsxs("div", { ref: rootRef, className: rootCls, children: [
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
              const cls = `hb-item${sel ? " sel" : ""}${moving ? " dragging" : ""}${hidden.has(id) ? " reveal-wait" : ""}${fresh.has(id) && !reduced() ? " just-placed" : ""}`;
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
            selBounds && selKinds.length > 0 && tool === "select" && /* @__PURE__ */ jsxs(
              "div",
              {
                className: "hb-ctx",
                style: { left: selBounds.x, top: selBounds.y - 8, transform: "translateY(-100%) scale(var(--iz, 1))" },
                onPointerDown: (e) => e.stopPropagation(),
                children: [
                  /* @__PURE__ */ jsx("span", { className: "kind", children: ctxLabel }),
                  hermesVerbs.length > 0 && /* @__PURE__ */ jsx("span", { className: "hm", style: { padding: 0 }, children: hermesVerbs.map((v, i) => /* @__PURE__ */ jsxs(
                    "button",
                    {
                      style: { height: "100%", padding: i === 0 ? "0 6px 0 10px" : "0 10px 0 6px", display: "flex", alignItems: "center", gap: 6 },
                      onClick: () => void sendToHermes(t2(v)),
                      children: [
                        i === 0 && /* @__PURE__ */ jsx(Cad, {}),
                        i > 0 && /* @__PURE__ */ jsx("em", { children: "/" }),
                        t2(v)
                      ]
                    },
                    v
                  )) }),
                  /* @__PURE__ */ jsx("button", { onClick: duplicate, children: t2("board.ctx.duplicate") }),
                  /* @__PURE__ */ jsx("button", { onClick: deleteSelection, children: t2("board.ctx.delete") })
                ]
              }
            ),
            /* @__PURE__ */ jsx(HermesCursor, { ref: cursorRef, reducedMotion: reduced(), onActive: (on, act) => setCursorAct(on ? act : null) })
          ] }),
          items.length === 0 && /* @__PURE__ */ jsxs("div", { className: "hb-empty", children: [
            /* @__PURE__ */ jsx("div", { className: "hd", children: t2("board.empty.title") }),
            /* @__PURE__ */ jsx("p", { children: t2("board.empty.body") }),
            /* @__PURE__ */ jsx("p", { children: t2("board.empty.keys") })
          ] })
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
      /* @__PURE__ */ jsx("span", { className: "hb-btitle", onDoubleClick: () => setRenaming(true), title: t2("board.renameHint"), children: renaming ? /* @__PURE__ */ jsx(
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
      /* @__PURE__ */ jsx("button", { className: "btn text", onClick: fit, children: t2("board.fit") }),
      /* @__PURE__ */ jsxs("button", { className: "btn primary", onClick: () => void continueInSession(), children: [
        t2("board.continue"),
        /* @__PURE__ */ jsx("kbd", { children: "⌘↵" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("footer", { className: "hb-status", children: [
      TOOLS.map((group, gi) => /* @__PURE__ */ jsx("div", { className: "seg", children: group.map((x) => /* @__PURE__ */ jsxs(
        "button",
        {
          className: `tool${tool === x.tool ? " on" : ""}`,
          title: `${t2(x.label)} (${x.key})`,
          onClick: () => {
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
          children: [
            /* @__PURE__ */ jsx("u", { children: x.key }),
            /* @__PURE__ */ jsx("span", { className: "nm", children: t2(x.label) })
          ]
        },
        x.tool
      )) }, gi)),
      /* @__PURE__ */ jsxs("label", { className: "hb-prompt", children: [
        /* @__PURE__ */ jsxs("span", { className: "who", children: [
          /* @__PURE__ */ jsx(Cad, {}),
          "hermes ›"
        ] }),
        /* @__PURE__ */ jsx("span", { className: "ph-block" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            ref: promptRef,
            value: prompt,
            placeholder: t2("board.prompt.placeholder"),
            onChange: (e) => setPrompt(e.target.value),
            onKeyDown: (e) => {
              e.stopPropagation();
              if (e.key === "Enter" && prompt.trim()) {
                void sendToHermes(prompt);
                setPrompt("");
              }
              if (e.key === "Escape") e.target.blur();
            }
          }
        ),
        /* @__PURE__ */ jsx("kbd", { children: "/" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "seg zoom", children: [
        /* @__PURE__ */ jsx("button", { className: "tool", "aria-label": t2("board.zoomOut"), onClick: () => {
          const vp = vpRef.current;
          zoomAt(1 / 1.2, vp.clientWidth / 2, vp.clientHeight / 2);
        }, children: "−" }),
        /* @__PURE__ */ jsxs("span", { className: "pct", ref: pctRef, children: [
          Math.round(view.current.z * 100),
          "%"
        ] }),
        /* @__PURE__ */ jsx("button", { className: "tool", "aria-label": t2("board.zoomIn"), onClick: () => {
          const vp = vpRef.current;
          zoomAt(1.2, vp.clientWidth / 2, vp.clientHeight / 2);
        }, children: "+" }),
        /* @__PURE__ */ jsxs("button", { className: "tool", onClick: fit, children: [
          /* @__PURE__ */ jsx("u", { children: "F" }),
          /* @__PURE__ */ jsx("span", { className: "nm", children: t2("board.fit") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "hb-map", onClick: (e) => {
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
      /* @__PURE__ */ jsx("button", { className: "x", "aria-label": t2("board.log.close"), onClick: () => setLogOn(false), children: "×" }),
      log.slice(-2).map((l) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "t", children: clock(l.t) }),
        /* @__PURE__ */ jsx("span", { className: `who${l.who === "you" ? " u" : ""}`, children: l.who === "you" ? t2("board.log.you") : "hermes" }),
        /* @__PURE__ */ jsx("span", { className: "msg", children: l.msg }),
        l.who === "hermes" && /* @__PURE__ */ jsxs("span", { className: "acts", children: [
          l.s != null && /* @__PURE__ */ jsxs("button", { onClick: () => sync.undoEntry(l.s), children: [
            /* @__PURE__ */ jsx("u", { children: "Z" }),
            " ",
            t2("board.log.undo")
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: () => void continueInSession(), children: t2("board.log.openSession") })
        ] })
      ] }, l.key))
    ] }),
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
        /* @__PURE__ */ jsx("span", { className: "hint", children: ask.kind === "link" ? t2("board.ask.linkHint") : t2("board.ask.embedHint") }),
        /* @__PURE__ */ jsx("button", { className: "btn text", onClick: () => setAsk(null), children: t2("board.ask.cancel") }),
        /* @__PURE__ */ jsx("button", { className: "btn primary", onClick: submitAsk, children: t2("board.ask.add") })
      ] })
    ] }),
    (toast || sync.error) && /* @__PURE__ */ jsx("div", { className: "hb-toast", role: "status", children: toast || t2("board.toast.offline") }),
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: fileRef,
        type: "file",
        accept: "image/png,image/jpeg,image/gif,image/webp",
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
          /* @__PURE__ */ jsxs("span", { children: [
            t2("board.ref.open"),
            " ↗"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "meta", children: [
          /* @__PURE__ */ jsx("span", { children: t2("board.ref.meta", { n: row2.count, when: ago(t2, row2.updated) }) }),
          /* @__PURE__ */ jsx("span", { className: "sp" }),
          row2.session && /* @__PURE__ */ jsx("span", { className: "sig", children: /* @__PURE__ */ jsx(Cad, {}) }),
          /* @__PURE__ */ jsx("button", { className: "del", onClick: (e) => {
            e.stopPropagation();
            onDelete();
          }, children: t2("board.index.delete") })
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
  return /* @__PURE__ */ jsxs("div", { className: "hb", children: [
    /* @__PURE__ */ jsxs("header", { className: "hb-top", children: [
      /* @__PURE__ */ jsxs("nav", { className: "hb-path", children: [
        /* @__PURE__ */ jsx("span", { className: "mark", children: /* @__PURE__ */ jsx(Cad, {}) }),
        /* @__PURE__ */ jsx("button", { onClick: onHome, children: t2("board.path.home") }),
        /* @__PURE__ */ jsx("span", { className: "sl", children: "/" })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "hb-btitle", children: t2("board.index.title") }),
      /* @__PURE__ */ jsx("span", { className: "spacer" }),
      /* @__PURE__ */ jsx("button", { className: "btn primary", onClick: () => void create(), children: t2("board.index.new") })
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
          /* @__PURE__ */ jsx("b", { children: "+" }),
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
      if (document.hidden) return;
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
    return () => {
      live = false;
      window.clearInterval(i);
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
      t2("board.widget.empty"),
      /* @__PURE__ */ jsx("br", {}),
      /* @__PURE__ */ jsxs("b", { children: [
        t2("board.index.new"),
        " ↗"
      ] })
    ] }) }) });
  }
  const active = doc?.hermes && Date.now() / 1e3 - doc.hermes.at < HERMES_ACTIVE_S;
  const count = doc ? Object.values(doc.items).filter((x) => x.k !== "line").length : 0;
  const list = (rows ?? []).filter((r) => !r.parent);
  return /* @__PURE__ */ jsxs("div", { className: "hb-widget", onClick: (e) => {
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
    list.length > 1 && /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => cycle(-1), onNext: () => cycle(1) })
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
  const widgets = o.widgets.filter(isValidWidget).filter((w) => !known || known.has(w.id));
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
 * One accent: the theme primary. Hermes is a material (dot matrix + reverse video), not a hue.
 * Radii: flush chrome 0 · panels 4 · cards & buttons 3 · checkboxes 2. No resting shadows. */

@font-face { font-family: "HB Atkinson"; src: url("data:font/woff2;base64,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") format("woff2"); font-weight: 200 800; font-display: swap; }
@font-face { font-family: "HB Departure"; src: url("data:font/woff2;base64,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") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "HB Draftsman"; src: url("data:font/woff2;base64,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") format("woff2"); font-weight: 400; font-display: swap; }

.hb {
  --accent: var(--color-primary, var(--ui-accent, #ffe3c4));
  --accent-soft: color-mix(in srgb, var(--accent) 82%, #9aa3b5);
  --bg: var(--color-background, #031919);
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
  --read: "HB Atkinson", "Atkinson Hyperlegible Next", ui-sans-serif, system-ui, sans-serif;
  --mono: "JetBrains Mono", var(--theme-font-mono, ui-monospace), monospace;
  --voice: "HB Departure", "JetBrains Mono", monospace;
  --hand: "HB Draftsman", cursive;
  --r-panel: 4px; --r-card: 3px; --r-ctl: 3px;
  --lift: 0 22px 40px -18px rgb(0 0 0 / 0.85), 0 4px 10px rgb(0 0 0 / 0.35);
  --settle: cubic-bezier(.22, 1, .36, 1);
  position: relative;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--read);
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

.hb .sig { display: inline-flex; align-items: center; gap: 5px; font: 400 11px/1 var(--voice); letter-spacing: .04em; color: var(--accent); text-transform: lowercase; }
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
.hb-note h4 { margin: 0; font: 600 14px/1.32 var(--read); letter-spacing: .003em; color: var(--ink); padding-right: 20px; }
.hb-note .body { margin: 4px 0 0; font: 400 12.5px/1.45 var(--read); color: var(--ink-2); white-space: pre-wrap; overflow-wrap: anywhere; }
.hb-note.quote .body { margin: 0; font: 500 16px/1.42 var(--read); color: var(--ink); letter-spacing: -.003em; padding-right: 14px; }
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
.hb-todo .sum { margin-top: 12px; font: 400 12.5px/1.3 var(--read); color: var(--ink-2); }
.hb-todo .sum b { font: 700 12.5px var(--mono); color: var(--ink); margin-right: 2px; }
.hb-todo ul { list-style: none; margin: 10px 0 0; padding: 0; }
.hb-todo li { display: flex; align-items: center; gap: 10px; padding: 6px; margin: 0 -6px; border-radius: 2px; font: 400 13.5px/1.25 var(--read); color: var(--ink); transition: background .12s; }
.hb-todo li:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.hb-todo .box { width: 13px; height: 13px; border-radius: 2px; border: 1.25px solid var(--rule-3); flex: none; position: relative; cursor: pointer; }
.hb-todo li.x .box { background: var(--accent); border-color: var(--accent); }
.hb-todo li.x .box::after { content: ""; position: absolute; left: 3.5px; top: 1px; width: 3px; height: 6.5px; border: solid var(--on-accent); border-width: 0 1.6px 1.6px 0; transform: rotate(42deg); }
.hb-todo li.x .l { color: var(--ink-3); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--ink) 35%, transparent); }
.hb-todo li .l { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.hb-todo li .side { margin-left: auto; font: 400 10.5px/1 var(--mono); color: var(--ink-3); }
.hb-todo li .rm { opacity: 0; font: 400 12px/1 var(--mono); color: var(--ink-3); padding: 2px 4px; }
.hb-todo li:hover .rm { opacity: 1; }
.hb-todo .addrow { display: flex; align-items: center; gap: 10px; padding: 6px; margin: 2px -6px 0; font: 400 12.5px/1 var(--read); color: var(--ink-3); }
.hb-todo .addrow b { font: 700 12px var(--mono); color: var(--accent-soft); width: 13px; text-align: center; }
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
.hb-col .add { width: 100%; margin-top: 8px; height: 28px; padding: 0 6px; display: flex; align-items: center; gap: 8px; font: 400 11px/1 var(--mono); color: var(--ink-3); border-radius: var(--r-ctl); transition: color .12s, background .12s; }
.hb-col .add b { font-weight: 700; color: var(--accent-soft); }
.hb-col .add .k { margin-left: auto; opacity: .7; }
.hb-col .add:hover { color: var(--ink); background: color-mix(in srgb, var(--accent) 5%, transparent); }

/* link card */
.hb-link { overflow: hidden; cursor: default; }
.hb-link .thumb { height: 128px; border-bottom: 1px solid var(--rule); background: var(--well); overflow: hidden; display: block; }
.hb-link .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hb-link .body { padding: 11px 14px 13px; }
.hb-link .dom { display: flex; align-items: center; gap: 7px; font: 400 10.5px/1 var(--mono); color: var(--ink-3); min-width: 0; }
.hb-link .dom img { width: 12px; height: 12px; flex: none; }
.hb-link .dom span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-link h4 { margin: 7px 0 0; font: 600 14.5px/1.3 var(--read); overflow-wrap: anywhere; }
.hb-link h4 a { color: inherit; text-decoration: none; }
.hb-link h4 a:hover { text-decoration: underline; text-decoration-color: var(--rule-3); text-underline-offset: 3px; }
.hb-link p { margin: 4px 0 0; font: 400 12.5px/1.42 var(--read); color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
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
.hb-video .play { position: absolute; left: 14px; bottom: 14px; display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px 0 10px; border-radius: var(--r-ctl); background: var(--accent); color: var(--on-accent) !important; font: 600 13px/1 var(--read) !important; }
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
.hb-image .cap b { font: 600 13px/1.2 var(--read); }

/* embed: a window */
.hb-embed { padding: 0; overflow: hidden; }
.hb-embed .bar-e { height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 12px; border-bottom: 1px solid var(--rule); font: 400 11px/1 var(--mono); white-space: nowrap; overflow: hidden; }
.hb-embed .file { color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.hb-embed .sb { color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; }
.hb-embed .tools { margin-left: auto; display: flex; gap: 2px; }
.hb-embed .frame { display: block; width: 100%; height: 240px; border: 0; background: var(--well); }
.hb-embed .foot { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 9px; border-top: 1px solid var(--rule); }
.hb .kbtn { height: 22px; min-width: 24px; padding: 0 6px; border-radius: var(--r-ctl); font: 400 12px/22px var(--mono); color: var(--ink-3); transition: color .12s, background .12s; }
.hb .kbtn:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--ink); }

/* nested board */
.hb-boardref { padding: 6px; cursor: pointer; }
.hb-boardref .pv { height: 110px; background: var(--well); position: relative; overflow: hidden; border: 1px solid var(--rule); }
.hb-boardref .pv i { position: absolute; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.hb-boardref .pv i.c { background: color-mix(in srgb, var(--accent) 24%, transparent); }
.hb-boardref .pv i.h { background: none; outline: 1px dotted color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: -1px; }
.hb-boardref .ttl { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 10px 4px 3px; }
.hb-boardref .ttl b { font: 600 14px/1.2 var(--read); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-boardref .ttl span { font: 400 10.5px/1 var(--mono); color: var(--accent); opacity: 0; transition: opacity .15s; white-space: nowrap; }
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
.hb-box b { display: block; font: 600 14px/18px var(--read); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hb-box small { display: block; margin-top: 3px; font: 400 10.5px/1.2 var(--mono); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* text on the table (section headings) */
.hb-text.h { font: 700 15px/1 var(--mono); letter-spacing: .2em; text-transform: uppercase; color: var(--accent); display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.hb-text.h::before { content: ""; width: 22px; height: 1px; background: currentColor; opacity: .5; flex: none; }
.hb-text.h::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, currentColor, transparent 92%); opacity: .28; }
.hb-text.p { font: 400 13px/1.35 var(--read); color: var(--ink-2); white-space: pre-wrap; }
/* Alberto's hand, only for sketch labels */
.hb-text.s { font: 400 19px/1.15 var(--hand); color: var(--ink); opacity: .92; white-space: pre-wrap; }

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

/* context bar over the selection */
.hb-ctx { position: absolute; display: flex; align-items: center; height: 30px; border-radius: var(--r-ctl); background: var(--sheet-2); border: 1px solid var(--rule-2); box-shadow: var(--lift); white-space: nowrap; font: 400 11px/1 var(--mono); color: var(--ink-2); z-index: 30; transform-origin: 0 100%; }
.hb-ctx > * { height: 100%; display: flex; align-items: center; gap: 6px; padding: 0 10px; }
.hb-ctx > * + * { border-left: 1px solid var(--rule); }
.hb-ctx .kind { color: var(--ink-3); }
.hb-ctx button:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); color: var(--ink); }
.hb-ctx .hm { color: var(--accent); }
.hb-ctx .hm em { font-style: normal; color: var(--ink-3); }

/* connector being drawn / hover hit */
.hb-wires .draft { stroke: var(--accent); stroke-width: 1.3; fill: none; stroke-dasharray: 4 3; }

/* ── Hermes cursor (world layer, counter-scaled) ── */
.hb-hcur { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 60; transform-origin: 0 0; transition: opacity .4s; }
.hb-hcur.idle { opacity: 0; }
.hb-hcur .arrow { position: absolute; left: -2px; top: -2px; filter: drop-shadow(0 2px 3px rgb(0 0 0 / .6)); }
.hb-hcur .label { position: absolute; left: 15px; top: 19px; display: flex; align-items: stretch; white-space: nowrap; box-shadow: 0 10px 22px -8px rgb(0 0 0 / .8); }
.hb-hcur .name { display: flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px 0 7px; background: var(--accent); color: var(--on-accent); font: 400 13px/1 var(--voice); letter-spacing: .06em; }
.hb-hcur .name svg { width: 8px; height: 10px; }
.hb-hcur .act { display: flex; align-items: center; height: 22px; padding: 0 8px; background: var(--on-accent); border: 1px solid var(--accent); border-left: 0; color: var(--ink); font: 400 11.5px/1 var(--mono); }
.hb-hcur .caret { display: inline-block; width: 6px; height: 12px; margin-left: 3px; background: var(--accent); animation: hb-caret 1.06s steps(1) infinite; }
@keyframes hb-caret { 50% { opacity: 0; } }
.hb-trail { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; z-index: 59; }

/* ── chrome: flush strips, like a terminal's title and status lines ── */
.hb-top { position: absolute; left: 0; right: 0; top: 0; height: 44px; display: flex; align-items: center; gap: 18px; padding: 0 10px 0 16px; z-index: 20;
  background: color-mix(in srgb, var(--chrome) 94%, transparent); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-bottom: 1px solid var(--rule); min-width: 0; }
.hb-path { display: flex; align-items: center; gap: 8px; font: 400 11px/1 var(--mono); color: var(--ink-3); white-space: nowrap; flex: none; }
.hb-path button { padding: 4px 2px; color: inherit; }
.hb-path button:hover { color: var(--ink); }
.hb-path .sl { opacity: .6; }
.hb-path .mark { color: var(--accent); display: flex; margin-right: 4px; }
.hb-path .mark svg { width: 13px; height: 16px; }
.hb-btitle { font: 650 15px/1 var(--read); color: var(--ink); letter-spacing: .002em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 60px; max-width: 32vw; }
.hb-btitle input { width: 100%; font: inherit; }
.hb .vsep { width: 1px; height: 20px; background: var(--rule); flex: none; }
.hb-presence { display: flex; align-items: center; gap: 8px; white-space: nowrap; font: 400 11px/1 var(--mono); color: var(--ink-3); min-width: 0; overflow: hidden; }
.hb-presence b { font-weight: 400; color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.hb .tagh { display: inline-flex; align-items: center; gap: 5px; height: 18px; padding: 0 6px; background: var(--accent); color: var(--on-accent); font: 400 12px/1 var(--voice); letter-spacing: .05em; flex: none; }
.hb .tagh svg { width: 8px; height: 10px; }
.hb .spacer { flex: 1; min-width: 0; }
.hb-state { display: flex; align-items: center; gap: 14px; font: 400 11px/1 var(--mono); color: var(--ink-3); white-space: nowrap; }
.hb-state b { font-weight: 400; color: var(--ink-2); }
.hb .btn { height: 30px; display: inline-flex; align-items: center; gap: 10px; padding: 0 12px; border-radius: var(--r-ctl); font: 600 13px/1 var(--read); white-space: nowrap; transition: background .12s, color .12s; flex: none; }
.hb .btn.text { color: var(--ink-2); }
.hb .btn.text:hover { color: var(--ink); background: color-mix(in srgb, var(--accent) 6%, transparent); }
.hb .btn.primary { background: var(--accent); color: var(--on-accent); padding: 0 8px 0 12px; }
.hb .btn.primary:hover { background: color-mix(in srgb, var(--accent) 80%, #fff); }
.hb .btn.primary:active { transform: translateY(1px); }
.hb .btn kbd { font: 700 10.5px/1 var(--mono); padding: 4px 5px; border-radius: 2px; background: color-mix(in srgb, var(--on-accent) 12%, transparent); }

.hb-status { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; display: flex; align-items: stretch; z-index: 20;
  background: color-mix(in srgb, var(--chrome) 96%, transparent); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-top: 1px solid var(--rule); font: 400 11.5px/1 var(--mono); color: var(--ink-2); }
.hb-status .seg { display: flex; align-items: center; padding: 0 6px; border-right: 1px solid var(--rule); flex: none; }
.hb .tool { height: 28px; display: flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: var(--r-ctl); white-space: nowrap; transition: background .12s, color .12s; font: 400 11.5px/1 var(--mono) !important; }
.hb .tool u { text-decoration: none; font-weight: 700; color: var(--accent-soft); }
.hb .tool:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); color: var(--ink); }
.hb .tool.on { background: var(--accent); color: var(--on-accent); }
.hb .tool.on u { color: var(--on-accent); }
.hb-prompt { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 14px; min-width: 0; cursor: text; }
.hb-prompt .who { display: flex; align-items: center; gap: 6px; color: var(--accent); font: 400 13px/1 var(--voice); letter-spacing: .04em; white-space: nowrap; flex: none; }
.hb-prompt .who svg { width: 8px; height: 10px; }
.hb-prompt input { flex: 1; min-width: 0; color: var(--ink); font: 400 11.5px/1 var(--mono); caret-color: var(--accent); }
.hb-prompt input::placeholder { color: var(--ink-3); }
.hb-prompt .ph-block { display: inline-block; width: 7px; height: 13px; background: var(--ink-3); opacity: .7; flex: none; }
.hb-prompt:focus-within .ph-block { display: none; }
.hb-prompt kbd { font: 400 10.5px/1 var(--mono); color: var(--ink-3); border: 1px solid var(--rule-2); padding: 3px 5px; border-radius: 2px; flex: none; }
.hb-status .zoom { display: flex; align-items: center; gap: 2px; padding: 0 8px; border-left: 1px solid var(--rule); border-right: 0; }
.hb-status .pct { width: 46px; text-align: center; color: var(--ink); }
/* narrow windows: keys only, names on hover (decision 14) */
.hb.narrow .tool .nm { display: none; }
.hb.narrow .tool:hover .nm { display: inline; }
.hb.narrow .hb-state .sess, .hb.narrow .btn.text { display: none; }
.hb.tiny .hb-prompt .ex { display: none; }

/* map: the board as a dot matrix (LIFE widget idiom) */
.hb-map { position: absolute; right: 12px; bottom: 52px; width: 212px; z-index: 19; padding: 10px; border-radius: var(--r-panel); background: var(--chrome); border: 1px solid var(--rule); cursor: pointer; }
.hb-map canvas { display: block; width: 192px; height: 104px; }
.hb.narrow .hb-map { display: none; }

/* log: Hermes reports what he changed, in the Home's LOGS voice */
.hb-log { position: absolute; left: 12px; bottom: 52px; z-index: 19; width: min(520px, calc(100% - 260px)); border-radius: var(--r-panel); background: var(--chrome); border: 1px solid var(--rule); padding: 9px 12px 10px;
  transition: opacity .35s, transform .45s var(--settle); }
.hb-log.off { opacity: 0; transform: translateY(6px); pointer-events: none; }
.hb-log .row { display: grid; grid-template-columns: 42px 62px 1fr; gap: 0 10px; font: 400 11.5px/1.45 var(--mono); }
.hb-log .row + .row { margin-top: 8px; }
.hb-log .t { color: var(--ink-3); }
.hb-log .who { color: var(--accent); font: 400 12.5px/1.35 var(--voice); letter-spacing: .03em; }
.hb-log .who.u { color: var(--ink-2); font-family: var(--mono); font-size: 11.5px; }
.hb-log .msg { color: var(--ink); font: 400 13px/1.42 var(--read); }
.hb-log .msg span { display: block; color: var(--ink-2); font-size: 12.5px; margin-top: 2px; }
.hb-log .acts { grid-column: 3; display: flex; gap: 4px; margin: 6px 0 0 -8px; }
.hb-log .acts button { height: 24px; padding: 0 8px; border-radius: var(--r-ctl); font: 400 11px/1 var(--mono); color: var(--ink-2); }
.hb-log .acts button u { text-decoration: none; color: var(--accent-soft); font-weight: 700; }
.hb-log .acts button:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--ink); }
.hb-log .x { position: absolute; right: 6px; top: 6px; color: var(--ink-3); font: 400 12px/1 var(--mono); padding: 3px 5px; }

/* inline dialogs (link / embed input), Home-log voice, no glass */
.hb-ask { position: absolute; left: 50%; top: 64px; transform: translateX(-50%); z-index: 40; width: min(560px, calc(100% - 40px)); background: var(--sheet-2); border: 1px solid var(--rule-2); border-radius: var(--r-panel); box-shadow: var(--lift); padding: 12px 14px; }
.hb-ask .hd { margin-bottom: 10px; }
.hb-ask input, .hb-ask textarea { width: 100%; background: var(--well); border: 1px solid var(--rule); border-radius: var(--r-ctl); padding: 8px 10px; font: 400 12.5px/1.4 var(--mono); color: var(--ink); }
.hb-ask textarea { height: 160px; }
.hb-ask .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; align-items: center; }
.hb-ask .row .hint { margin-right: auto; font: 400 10.5px/1.3 var(--mono); color: var(--ink-3); }
.hb-toast { position: absolute; left: 50%; bottom: 56px; transform: translateX(-50%); z-index: 41; background: var(--chrome); border: 1px solid var(--rule-2); border-radius: var(--r-panel); padding: 8px 12px; font: 400 11.5px/1.3 var(--mono); color: var(--ink); max-width: 80%; }

/* empty board */
.hb-empty { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); text-align: left; width: min(440px, 80%); pointer-events: none; }
.hb-empty .hd { margin-bottom: 12px; }
.hb-empty p { margin: 0; font: 400 14px/1.5 var(--read); color: var(--ink-2); }
.hb-empty p + p { margin-top: 8px; font: 400 11.5px/1.5 var(--mono); color: var(--ink-3); }

/* ── boards index ── */
.hb-index { position: absolute; inset: 44px 0 0 0; overflow: auto; padding: 36px 40px 60px; user-select: none; }
.hb-index > .hd { font-size: 15px; letter-spacing: .2em; color: var(--accent); max-width: 1180px; }
.hb-index > .hd::before { width: 22px; }
.hb-index .lead { margin: 9px 0 26px 32px; font: 400 13px/1.3 var(--read); color: var(--ink-2); }
.hb-index .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 18px; max-width: 1180px; }
.hb-index .hb-boardref { width: auto; transition: border-color .16s; }
.hb-index .hb-boardref:hover { border-color: var(--rule-2); }
.hb-index .new { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end; gap: 6px; min-height: 172px; padding: 14px; border: 1px dashed var(--rule-2); border-radius: var(--r-card); color: var(--ink-2); font: 600 14px/1.2 var(--read); text-align: left; }
.hb-index .new b { font: 700 18px/1 var(--mono); color: var(--accent); }
.hb-index .new:hover { border-color: var(--rule-3); color: var(--ink); }
.hb-index .new small { font: 400 10.5px/1.3 var(--mono); color: var(--ink-3); }
.hb-index .hb-boardref .del { opacity: 0; color: var(--ink-3); font: 400 10.5px/1 var(--mono); }
.hb-index .hb-boardref:hover .del { opacity: 1; }
.hb-index .hb-boardref .del:hover { color: var(--ink); }

/* ── Home widget ── */
.hb-widget { display: flex; flex-direction: column; gap: 8px; height: calc(100% - 22px); min-height: 0; cursor: pointer; }
.hb-widget .pvw { position: relative; flex: 1; min-height: 40px; border: 1px solid var(--home-border, rgb(255 227 196 / .13)); border-radius: 3px; overflow: hidden; background: rgb(0 0 0 / .18); }
.hb-widget canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hb-widget .foot { display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 10.5px; color: var(--color-muted-foreground, #9aa3b5); }
.hb-widget .foot b { font: 600 13px/1.2 "HB Atkinson", ui-sans-serif, sans-serif; color: var(--color-foreground, #e8e3dc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hb-widget .foot .sp { flex: 1; }
.hb-widget .tagh { display: inline-flex; align-items: center; gap: 4px; height: 15px; padding: 0 5px; background: var(--home-accent, #ffe3c4); color: #072120; font: 400 11px/1 "HB Departure", monospace; letter-spacing: .05em; white-space: nowrap; }
.hb-widget .empty { flex: 1; display: grid; place-items: center; text-align: center; color: var(--color-muted-foreground, #9aa3b5); font-size: 11px; line-height: 1.5; }
.hb-widget .empty b { color: var(--home-accent, #ffe3c4); font-weight: 700; }

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
