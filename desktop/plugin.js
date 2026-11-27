import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { host } from "@hermes/plugin-sdk";
import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
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
  "widget.agent": "agent",
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
  // ── agent widget ──
  "agent.working": "working",
  "agent.thinking": "thinking",
  "agent.idle": "idle",
  "agent.take": "take control",
  "agent.takeAria": "Take control",
  "agent.takeTitle": "Take control of the screen — live agent theater",
  "agent.in": "in",
  "agent.out": "out",
  "agent.est": "est",
  "agent.ses": "ses",
  "agent.inTitle": "Input tokens today",
  "agent.outTitle": "Output tokens today",
  "agent.estTitle": "Estimated cost today",
  "agent.sesTitle": "Sessions today",
  "agent.polling": "polling mode · no live channel",
  // ── live scene + feed ──
  "scene.running": "running",
  "scene.message": "message",
  "scene.streaming": "streaming",
  "scene.complete": "complete",
  "scene.idle": "idle",
  "scene.resting": "the agent is resting — new activity will appear here",
  "feed.generating": "generating…",
  "feed.progress": "progress…",
  "feed.spawned": "spawned",
  "feed.done": "done",
  "feed.thinking": "thinking…",
  "feed.session": "session",
  "feed.new": "new",
  "feed.error": "error",
  "feed.live": "live",
  "feed.channelOpen": "gateway channel open",
  // ── agent theater ──
  "theater.aria": "Agent theater",
  "theater.title": "AGENT THEATER",
  "theater.working": "the agent is working",
  "theater.idle": "the agent is idle",
  "theater.liveFeed": "live feed",
  "theater.polling": "polling",
  "theater.live": "live",
  "theater.release": "release control",
  "theater.releaseTitle": "Release control (Esc)",
  "theater.now": "NOW · {status}",
  "theater.gatewayDown": "gateway down",
  "theater.feedEmpty": "no live activity yet — the feed fills as the agent works",
  "theater.lastEvent": "last event {when}",
  "theater.updated": "updated {when}",
  "theater.function": "FUNCTION",
  "theater.awaitingArgs": "awaiting args…",
  "theater.noTool": "no tool running",
  "theater.tokensCost": "TOKENS & COST",
  "theater.inputToday": "input today",
  "theater.outputToday": "output today",
  "theater.cacheRead": "cache read",
  "theater.costToday": "est. cost today",
  "theater.tok": "{n} tok",
  "theater.activeSession": "active session",
  "theater.sessionNums": "{tok} tok · {msg} msg · {tools} tools",
  "theater.project": "PROJECT",
  "theater.untitled": "(untitled session)",
  "theater.started": "started {when}",
  "theater.noSession": "no active session",
  "theater.filesEmpty": "files touched by the agent will appear here as it works",
  "theater.recommendations": "RECOMMENDATIONS",
  // ── coach (recommendations) ──
  "coach.sourcesFailing.title": "{n} data source(s) failing",
  "coach.sourcesFailing.detail": "Polling errors on: {sources}. Check the gateway and plugin API.",
  "coach.errorLines.title": "{n} error line(s) in the gateway log",
  "coach.errorLines.detail": "Tail the log to see if a platform or plugin is throwing repeatedly.",
  "coach.cost.title": "≈${cost} estimated today",
  "coach.cost.high": "Cost is climbing. Consider a cheaper model, context compression, or capping long sessions.",
  "coach.cost.moderate": "Spend is moderate — keep an eye on it if you're mid-migration.",
  "coach.tokens.title": "{n}M tokens today",
  "coach.tokens.detail": "Heavy usage. /compact long sessions and reuse cached context to cut input tokens.",
  "coach.repeated.title": '"{name}" called {n}× recently',
  "coach.repeated.detail": "A repeated tool sequence is a skill in disguise — consider saving it with skill_manage.",
  "coach.parallel.title": "{n} sessions active at once",
  "coach.parallel.detail": "Parallel work is running — delegate_task fans out well, but watch for tool conflicts on shared files.",
  "coach.subagents.title": "{n} subagent(s) working",
  "coach.subagents.detail": "Orchestration in flight. Check back for their consolidated reports.",
  "coach.slow.title": '"{name}" running >2min',
  "coach.slow.detail": "Long tool call — it may be a build, a big search, or a hung process. Watch it.",
  "coach.longSession.title": "Active session at {n} messages",
  "coach.longSession.detail": "Long context costs more per turn and degrades focus. A fresh session or /compact resets the cache.",
  "coach.toolChurn.title": "{n} tool calls in the active session",
  "coach.toolChurn.detail": "High tool churn — the task may benefit from a dedicated skill or a subagent.",
  "coach.skill.title": 'Top skill "{name}" only {n}% of loads',
  "coach.skill.detail": "Your most-used skill is still under-leveraged — consider bundling related skills.",
  "coach.quiet.title": "All quiet on the home front",
  "coach.quiet.detail": "No anomalies right now. The coach stays silent until there's something worth saying."
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
  "widget.agent": "agente",
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
  // ── agent widget ──
  "agent.working": "trabajando",
  "agent.thinking": "pensando",
  "agent.idle": "en reposo",
  "agent.take": "tomar el control",
  "agent.takeAria": "Tomar el control",
  "agent.takeTitle": "Toma el control de la pantalla: teatro del agente en vivo",
  "agent.in": "ent",
  "agent.out": "sal",
  "agent.est": "est",
  "agent.ses": "ses",
  "agent.inTitle": "Tokens de entrada de hoy",
  "agent.outTitle": "Tokens de salida de hoy",
  "agent.estTitle": "Costo estimado de hoy",
  "agent.sesTitle": "Sesiones de hoy",
  "agent.polling": "modo de consulta · sin canal en vivo",
  // ── live scene + feed ──
  "scene.running": "en ejecución",
  "scene.message": "mensaje",
  "scene.streaming": "escribiendo",
  "scene.complete": "completo",
  "scene.idle": "en reposo",
  "scene.resting": "el agente descansa; aquí aparecerá la nueva actividad",
  "feed.generating": "generando…",
  "feed.progress": "avanzando…",
  "feed.spawned": "iniciado",
  "feed.done": "terminado",
  "feed.thinking": "pensando…",
  "feed.session": "sesión",
  "feed.new": "nueva",
  "feed.error": "error",
  "feed.live": "en vivo",
  "feed.channelOpen": "canal del gateway abierto",
  // ── agent theater ──
  "theater.aria": "Teatro del agente",
  "theater.title": "TEATRO DEL AGENTE",
  "theater.working": "el agente está trabajando",
  "theater.idle": "el agente está en reposo",
  "theater.liveFeed": "transmisión en vivo",
  "theater.polling": "consulta periódica",
  "theater.live": "en vivo",
  "theater.release": "soltar el control",
  "theater.releaseTitle": "Soltar el control (Esc)",
  "theater.now": "AHORA · {status}",
  "theater.gatewayDown": "gateway caído",
  "theater.feedEmpty": "todavía no hay actividad; se irá llenando mientras el agente trabaja",
  "theater.lastEvent": "último evento {when}",
  "theater.updated": "actualizado {when}",
  "theater.function": "FUNCIÓN",
  "theater.awaitingArgs": "esperando argumentos…",
  "theater.noTool": "ninguna herramienta en ejecución",
  "theater.tokensCost": "TOKENS Y COSTO",
  "theater.inputToday": "entrada hoy",
  "theater.outputToday": "salida hoy",
  "theater.cacheRead": "lectura de caché",
  "theater.costToday": "costo est. hoy",
  "theater.tok": "{n} tok",
  "theater.activeSession": "sesión activa",
  "theater.sessionNums": "{tok} tok · {msg} mensajes · {tools} herramientas",
  "theater.project": "PROYECTO",
  "theater.untitled": "(sesión sin título)",
  "theater.started": "iniciada {when}",
  "theater.noSession": "no hay una sesión activa",
  "theater.filesEmpty": "aquí aparecerán los archivos que toque el agente mientras trabaja",
  "theater.recommendations": "RECOMENDACIONES",
  // ── coach (recommendations) ──
  "coach.sourcesFailing.title": "{n} fuente(s) de datos con fallas",
  "coach.sourcesFailing.detail": "Errores de consulta en: {sources}. Revisa el gateway y la API del plugin.",
  "coach.errorLines.title": "{n} línea(s) de error en el registro del gateway",
  "coach.errorLines.detail": "Sigue el registro para ver si una plataforma o un plugin falla una y otra vez.",
  "coach.cost.title": "≈${cost} estimados hoy",
  "coach.cost.high": "El costo va en aumento. Considera un modelo más barato, comprimir el contexto o acotar las sesiones largas.",
  "coach.cost.moderate": "El gasto es moderado; vigílalo si estás a mitad de una migración.",
  "coach.tokens.title": "{n}M tokens hoy",
  "coach.tokens.detail": "Uso intenso. Usa /compact en sesiones largas y reutiliza el contexto en caché para bajar los tokens de entrada.",
  "coach.repeated.title": '"{name}" se llamó {n} veces hace poco',
  "coach.repeated.detail": "Una secuencia de herramientas repetida es una skill disfrazada; considera guardarla con skill_manage.",
  "coach.parallel.title": "{n} sesiones activas a la vez",
  "coach.parallel.detail": "Hay trabajo en paralelo; delegate_task reparte bien, pero cuida los choques de herramientas sobre archivos compartidos.",
  "coach.subagents.title": "{n} subagente(s) trabajando",
  "coach.subagents.detail": "Orquestación en curso. Vuelve luego por sus reportes consolidados.",
  "coach.slow.title": '"{name}" lleva más de 2 min',
  "coach.slow.detail": "Llamada larga: puede ser una compilación, una búsqueda grande o un proceso colgado. Vigílala.",
  "coach.longSession.title": "La sesión activa va en {n} mensajes",
  "coach.longSession.detail": "Un contexto largo cuesta más por turno y dispersa el foco. Una sesión nueva o /compact reinicia la caché.",
  "coach.toolChurn.title": "{n} llamadas a herramientas en la sesión activa",
  "coach.toolChurn.detail": "Mucho movimiento de herramientas; a la tarea le convendría una skill dedicada o un subagente.",
  "coach.skill.title": 'La skill principal "{name}" es solo el {n} % de las cargas',
  "coach.skill.detail": "Tu skill más usada sigue desaprovechada; considera agrupar skills relacionadas.",
  "coach.quiet.title": "Todo en calma por aquí",
  "coach.quiet.detail": "Sin anomalías por ahora. El coach guarda silencio hasta que haya algo que valga la pena decir."
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
const listeners$2 = /* @__PURE__ */ new Set();
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
  listeners$2.forEach((l) => l());
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
    listeners$2.add(onChange);
    onChange();
    return () => {
      listeners$2.delete(onChange);
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
  return /* @__PURE__ */ jsx(
    "div",
    {
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
function hostOf(url) {
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
      status.gateway_health_url && /* @__PURE__ */ jsx(Row$1, { label: t2("gateway.health"), val: hostOf(status.gateway_health_url) }),
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
      const cx = cv.width / 2;
      const cy = cv.height / 2;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
      const waxing = phase < 0.5;
      const a = r * Math.cos(2 * Math.PI * phase);
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing);
      ctx.ellipse(cx, cy, Math.abs(a), r, 0, Math.PI / 2, -Math.PI / 2, a > 0);
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
    let clock = 0;
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
      clock += TICK_MS / 1e3 * mult;
      const base = cv.height * 0.62;
      const amp = cv.height * 0.42;
      const y = online.current ? base - beatY(clock % BEAT_S / BEAT_S) * amp : base;
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
let active = false;
const listeners$1 = /* @__PURE__ */ new Set();
function enterTheater() {
  if (active) return;
  active = true;
  listeners$1.forEach((l) => l(true));
}
function exitTheater() {
  if (!active) return;
  active = false;
  listeners$1.forEach((l) => l(false));
}
function subscribeTheater(listener) {
  listeners$1.add(listener);
  return () => listeners$1.delete(listener);
}
const EMPTY_LIVE = {
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
  lastEventAt: null
};
const MAX_TOOL_HISTORY = 12;
const MAX_FEED = 80;
let liveState = EMPTY_LIVE;
const listeners = /* @__PURE__ */ new Set();
let subscribed = false;
let feedSeq = 0;
function setLive(fn) {
  const next = fn(liveState);
  if (next === liveState) return;
  liveState = next;
  listeners.forEach((l) => l());
}
function pushFeed(entry) {
  setLive((s) => {
    const e = { ...entry, id: ++feedSeq };
    const feed = [e, ...s.feed];
    return { ...s, feed: feed.length > MAX_FEED ? feed.slice(0, MAX_FEED) : feed };
  });
}
function str(v) {
  return typeof v === "string" && v.length > 0 ? v : void 0;
}
function asObj(v) {
  return typeof v === "object" && v !== null ? v : void 0;
}
function pick(p, ...keys) {
  if (!p) return void 0;
  for (const k of keys) {
    const v = str(p[k]);
    if (v) return v;
  }
  return void 0;
}
function argPreview(args, max = 160) {
  if (args === void 0 || args === null) return void 0;
  let s;
  if (typeof args === "string") s = args;
  else {
    try {
      s = JSON.stringify(args);
    } catch {
      s = String(args);
    }
  }
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
function handleEvent(event) {
  const { type, payload } = event;
  const p = asObj(payload);
  const now = Date.now();
  const bump = (s) => ({ ...s, lastEventAt: now });
  if (type === "tool.generating") {
    const name = pick(p, "name") ?? "tool";
    setLive((s) => bump({
      ...s,
      busy: true,
      currentTool: { name, startedAt: now, status: "running" }
    }));
    pushFeed({ at: now, kind: "tool", label: name, detailKey: "feed.generating" });
    return;
  }
  if (type === "tool.start" || type === "tool.progress") {
    const name = pick(p, "name", "tool_name") ?? "tool";
    setLive((s) => bump({
      ...s,
      busy: true,
      currentTool: { name, args: p?.args ?? p, startedAt: now, status: "running" }
    }));
    pushFeed({
      at: now,
      kind: "tool",
      label: name,
      ...type === "tool.progress" ? { detailKey: "feed.progress" } : { detail: argPreview(p?.args) }
    });
    return;
  }
  if (type === "tool.complete") {
    const name = pick(p, "name", "tool_name") ?? "";
    const ok = p?.ok !== false && !str(p?.error);
    const duration = typeof p?.duration === "number" ? p.duration : void 0;
    setLive((s) => bump({
      ...s,
      currentTool: null,
      busy: s.subagents.some((a) => a.status === "running") || s.streamText.length > 0,
      toolHistory: [{
        name: name || s.currentTool?.name || "tool",
        args: p?.args ?? s.currentTool?.args,
        startedAt: s.currentTool?.startedAt ?? now,
        status: ok ? "complete" : "failed",
        duration
      }, ...s.toolHistory].slice(0, MAX_TOOL_HISTORY)
    }));
    pushFeed({
      at: now,
      kind: "tool",
      label: name || "tool",
      ok,
      detail: duration !== void 0 ? `${duration.toFixed(1)}s` : void 0
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
      streamText: (s.streamText + text).slice(-6e3)
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
        busy: s.currentTool !== null || s.subagents.some((a) => a.status === "running")
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
        { name, status: "running", goal: pick(p, "goal", "task") },
        ...s.subagents.filter((a) => a.name !== name)
      ].slice(0, 6)
    }));
    pushFeed({ at: now, kind: "subagent", label: name, detailKey: "feed.spawned" });
    return;
  }
  if (type === "subagent.complete") {
    const name = pick(p, "name", "role", "id");
    if (!name) return;
    setLive((s) => bump({
      ...s,
      subagents: s.subagents.map((a) => a.name === name ? { ...a, status: "done" } : a)
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
      activeTitle: pick(p, "title") ?? s.activeTitle
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
      setLive((s) => s.busy ? bump({ ...s, busy: false }) : s);
    }
    if (sid) setLive((s) => bump({ ...s, activeSessionId: sid }));
    return;
  }
  if (type === "error") {
    pushFeed({
      at: now,
      kind: "system",
      label: "error",
      labelKey: "feed.error",
      detail: pick(p, "error", "message")
    });
    setLive(bump);
    return;
  }
  if (type.startsWith("tool.") || type.startsWith("message.") || type.startsWith("subagent.") || type.startsWith("session.") || type.startsWith("thinking.") || type.startsWith("reasoning.") || type.startsWith("approval.") || type.startsWith("run.")) {
    pushFeed({ at: now, kind: "system", label: type });
    setLive(bump);
  }
}
function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  const all = onGatewayEvent("*", handleEvent);
  if (all) {
    setLive((s) => s.live ? s : { ...s, live: true });
    pushFeed({ at: Date.now(), kind: "system", label: "live", labelKey: "feed.live", detailKey: "feed.channelOpen" });
  }
}
function useAgentLive() {
  const [state, setState] = useState(liveState);
  useEffect(() => {
    ensureSubscribed();
    setState(liveState);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  function onChange() {
    setState(liveState);
  }
  return state;
}
function renderInline(text, keyBase) {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let i = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(/* @__PURE__ */ jsx("strong", { children: tok.slice(2, -2) }, `${keyBase}-b${i}`));
    } else if (tok.startsWith("`")) {
      nodes.push(/* @__PURE__ */ jsx("code", { children: tok.slice(1, -1) }, `${keyBase}-c${i}`));
    } else {
      nodes.push(/* @__PURE__ */ jsx("em", { children: tok.slice(1, -1) }, `${keyBase}-i${i}`));
    }
    last = m.index + tok.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
function MarkdownText({ text }) {
  const lines = text.split("\n");
  const out = [];
  const codeBuf = [];
  let inCode = false;
  const listItems = [];
  const flushList = (key) => {
    if (listItems.length === 0) return;
    out.push(
      /* @__PURE__ */ jsx("div", { className: "home-md-list", children: listItems }, key)
    );
    listItems.length = 0;
  };
  lines.forEach((line, idx) => {
    const key = `l${idx}`;
    if (line.trimStart().startsWith("```")) {
      if (inCode) {
        out.push(
          /* @__PURE__ */ jsx("pre", { className: "home-md-pre", children: /* @__PURE__ */ jsx("code", { children: codeBuf.join("\n") }) }, key)
        );
        codeBuf.length = 0;
        inCode = false;
      } else {
        flushList(key);
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeBuf.push(line);
      return;
    }
    const t2 = line.trim();
    if (!t2) {
      flushList(key);
      out.push(/* @__PURE__ */ jsx("div", { className: "home-md-gap" }, key));
      return;
    }
    const heading = t2.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushList(key);
      out.push(
        /* @__PURE__ */ jsx("div", { className: `home-md-h h${heading[1].length}`, children: renderInline(heading[2], key) }, key)
      );
      return;
    }
    const item = t2.match(/^[-*]\s+(.*)$/);
    if (item) {
      listItems.push(/* @__PURE__ */ jsx("div", { className: "home-md-li", children: renderInline(item[1], key) }, key));
      return;
    }
    flushList(key);
    out.push(/* @__PURE__ */ jsx("div", { className: "home-md-p", children: renderInline(t2, key) }, key));
  });
  if (inCode) {
    out.push(
      /* @__PURE__ */ jsx("pre", { className: "home-md-pre", children: /* @__PURE__ */ jsx("code", { children: codeBuf.join("\n") }) }, "open-fence")
    );
  }
  flushList("list-end");
  return /* @__PURE__ */ jsx(Fragment, { children: out });
}
function useScene(live) {
  const t2 = useT();
  const [scene, setScene] = useState(() => sceneFrom(live, t2));
  const wasStreaming = useRef(false);
  useEffect(() => {
    const streaming = live.streamText.trim().length > 0;
    const prevStreaming = wasStreaming.current;
    wasStreaming.current = streaming;
    if (live.currentTool) {
      const key = `tool-${live.currentTool.name}-${live.currentTool.startedAt}`;
      const body = argPreview(live.currentTool.args, 800) ?? "";
      setScene(
        (s) => s.key === key ? { ...s, body } : {
          key,
          kind: "tool",
          title: live.currentTool.name,
          body,
          meta: t2("scene.running")
        }
      );
      return;
    }
    if (streaming && !prevStreaming) {
      setScene({
        key: `msg-${Date.now()}`,
        kind: "message",
        title: t2("scene.message"),
        body: live.streamText,
        meta: t2("scene.streaming"),
        streaming: true
      });
    } else if (streaming) {
      setScene((s) => s.streaming ? { ...s, body: live.streamText } : s);
    } else if (live.lastMessage) {
      const msg = live.lastMessage;
      setScene(
        (s) => s.kind === "message" && !s.streaming && s.body === msg ? s : { key: `done-${Date.now()}`, kind: "message", title: t2("scene.message"), body: msg, meta: t2("scene.complete") }
      );
    } else {
      setScene(
        (s) => s.kind === "idle" && s.body === t2("scene.resting") ? s : { key: "idle", kind: "idle", title: t2("scene.idle"), body: t2("scene.resting") }
      );
    }
  }, [live.streamText, live.currentTool, live.lastMessage, t2]);
  return scene;
}
function sceneFrom(live, t2) {
  if (live.streamText.trim()) {
    return {
      key: `msg-${Date.now()}`,
      kind: "message",
      title: t2("scene.message"),
      body: live.streamText,
      meta: t2("scene.streaming"),
      streaming: true
    };
  }
  if (live.currentTool) {
    return {
      key: `tool-${live.currentTool.name}-${live.currentTool.startedAt}`,
      kind: "tool",
      title: live.currentTool.name,
      body: argPreview(live.currentTool.args, 500) ?? "",
      meta: t2("scene.running")
    };
  }
  if (live.lastMessage) {
    return { key: "done", kind: "message", title: t2("scene.message"), body: live.lastMessage, meta: t2("scene.complete") };
  }
  return { key: "idle", kind: "idle", title: t2("scene.idle"), body: t2("scene.resting") };
}
function SceneBody({ scene }) {
  if (scene.kind === "tool") {
    return /* @__PURE__ */ jsxs("div", { className: "home-scene-tool", children: [
      /* @__PURE__ */ jsx("span", { className: "home-scene-title", children: scene.title }),
      /* @__PURE__ */ jsx("span", { className: "home-scene-meta", children: scene.meta }),
      scene.body && /* @__PURE__ */ jsx("pre", { className: "home-scene-args", children: scene.body })
    ] });
  }
  if (scene.kind === "message") {
    return /* @__PURE__ */ jsxs("div", { className: "home-scene-msg", children: [
      /* @__PURE__ */ jsx(MarkdownText, { text: scene.body }),
      scene.streaming && /* @__PURE__ */ jsx("span", { className: "home-scene-caret", "aria-hidden": "true" })
    ] });
  }
  return /* @__PURE__ */ jsx("div", { className: "home-scene-idle", children: scene.body });
}
function LiveScene({ scene }) {
  const [current2, setCurrent] = useState(scene);
  const [leaving, setLeaving] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    if (scene.key === current2.key) return;
    setLeaving(current2);
    setCurrent(scene);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(null), 460);
  }, [scene.key]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "home-scene", children: [
    leaving && /* @__PURE__ */ jsx("div", { className: "home-scene-item leaving", "aria-hidden": "true", children: /* @__PURE__ */ jsx(SceneBody, { scene: leaving }) }),
    /* @__PURE__ */ jsx("div", { className: "home-scene-item", children: /* @__PURE__ */ jsx(SceneBody, { scene: current2 }) }, current2.key)
  ] });
}
function fmtCost$1(n) {
  if (n === void 0 || !Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${(n * 1e3).toFixed(2)}m`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
function fmtTok$1(n) {
  if (n === void 0 || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
function AgentWidget({ data }) {
  const t2 = useT();
  const live = useAgentLive();
  const scene = useScene(live);
  const totals = data.analytics?.totals;
  const statusLabel = live.busy ? live.currentTool ? t2("agent.working") : t2("agent.thinking") : t2("agent.idle");
  return /* @__PURE__ */ jsxs("div", { className: "home-agent", children: [
    /* @__PURE__ */ jsxs("div", { className: "home-agent-head", children: [
      /* @__PURE__ */ jsx("span", { className: `home-agent-dot ${live.busy ? "busy" : ""}`, "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("span", { className: "home-agent-status", children: statusLabel })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "home-agent-scene", children: /* @__PURE__ */ jsx(LiveScene, { scene }) }),
    /* @__PURE__ */ jsx(HoverCtl, { className: "home-agent-ctl", children: /* @__PURE__ */ jsxs(
      "button",
      {
        className: "home-agent-take",
        onClick: () => enterTheater(),
        title: t2("agent.takeTitle"),
        "aria-label": t2("agent.takeAria"),
        children: [
          /* @__PURE__ */ jsx("span", { className: "home-agent-take-ico", "aria-hidden": "true" }),
          t2("agent.take")
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs("div", { className: "home-agent-stats", children: [
      /* @__PURE__ */ jsxs("span", { title: t2("agent.inTitle"), children: [
        /* @__PURE__ */ jsx("i", { children: t2("agent.in") }),
        " ",
        fmtTok$1(totals?.total_input)
      ] }),
      /* @__PURE__ */ jsxs("span", { title: t2("agent.outTitle"), children: [
        /* @__PURE__ */ jsx("i", { children: t2("agent.out") }),
        " ",
        fmtTok$1(totals?.total_output)
      ] }),
      /* @__PURE__ */ jsxs("span", { title: t2("agent.estTitle"), children: [
        /* @__PURE__ */ jsx("i", { children: t2("agent.est") }),
        " ",
        fmtCost$1(totals?.total_estimated_cost)
      ] }),
      /* @__PURE__ */ jsxs("span", { title: t2("agent.sesTitle"), children: [
        /* @__PURE__ */ jsx("i", { children: t2("agent.ses") }),
        " ",
        totals?.total_sessions ?? "—"
      ] })
    ] }),
    live.toolHistory.length > 0 && /* @__PURE__ */ jsx("div", { className: "home-agent-history", children: live.toolHistory.slice(0, 4).map((t22, i) => /* @__PURE__ */ jsxs("span", { className: "home-agent-hist", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `home-agent-hist-dot ${t22.status === "complete" ? "ok" : "bad"}`,
          "aria-hidden": "true"
        }
      ),
      t22.name,
      t22.duration !== void 0 && /* @__PURE__ */ jsxs("i", { children: [
        t22.duration.toFixed(0),
        "s"
      ] })
    ] }, `${t22.name}-${t22.startedAt}-${i}`)) }),
    !live.live && /* @__PURE__ */ jsx("div", { className: "home-agent-dim", children: t2("agent.polling") })
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
function timeAgo$1(iso, t2) {
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
            /* @__PURE__ */ jsx("span", { className: "project-time", children: timeAgo$1(p.lastUpdated, t2) }),
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
  agent: {
    titleKey: "widget.agent",
    component: ({ data }) => /* @__PURE__ */ jsx(AgentWidget, { data }),
    defaultSize: { gw: 4, gh: 3 },
    minSize: { gw: 3, gh: 2 },
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
  const rootRef = useRef(null);
  const titleRef = useRef(null);
  useEffect(() => {
    const el = titleRef.current;
    if (el && rootRef.current) rootRef.current.style.setProperty("--hd-title-w", `${el.offsetWidth}px`);
  }, [title, state]);
  const cls = [
    "home-widget",
    dragging ? "dragging" : "",
    swapTarget ? "swap-target" : "",
    trashing ? "trashing" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: rootRef,
      className: cls,
      style,
      onClick: !editing && onClickThrough ? onClickThrough : void 0,
      role: !editing && onClickThrough ? "link" : void 0,
      children: [
        /* @__PURE__ */ jsx("b", { className: "hd", onPointerDown: editing ? onHeaderPointerDown : void 0, children: /* @__PURE__ */ jsxs("span", { className: "hd-t", ref: titleRef, children: [
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
function buildRecommendations(data, live, t2) {
  const out = [];
  const totals = data.analytics?.totals;
  if (data.errors.size > 0) {
    out.push({
      severity: "crit",
      title: t2("coach.sourcesFailing.title", { n: data.errors.size }),
      detail: t2("coach.sourcesFailing.detail", { sources: [...data.errors].join(", ") })
    });
  }
  const errorLogs = data.logs?.lines?.length ?? 0;
  if (errorLogs > 0) {
    out.push({
      severity: errorLogs > 10 ? "crit" : "warn",
      title: t2("coach.errorLines.title", { n: errorLogs }),
      detail: t2("coach.errorLines.detail")
    });
  }
  const est = totals?.total_estimated_cost ?? 0;
  if (est > 0.5) {
    out.push({
      severity: est > 2 ? "crit" : "warn",
      title: t2("coach.cost.title", { cost: est.toFixed(2) }),
      detail: est > 2 ? t2("coach.cost.high") : t2("coach.cost.moderate")
    });
  }
  const totalTok = (totals?.total_input ?? 0) + (totals?.total_output ?? 0);
  if (totalTok > 2e6) {
    out.push({
      severity: "warn",
      title: t2("coach.tokens.title", { n: (totalTok / 1e6).toFixed(1) }),
      detail: t2("coach.tokens.detail")
    });
  }
  const repeated = mostRepeatedTool(live.toolHistory);
  if (repeated && repeated.count >= 5) {
    out.push({
      severity: "info",
      title: t2("coach.repeated.title", { name: repeated.name, n: repeated.count }),
      detail: t2("coach.repeated.detail")
    });
  }
  const activeSessions = (data.sessions?.sessions ?? []).filter((s) => s.is_active).length;
  if (activeSessions >= 3) {
    out.push({
      severity: "info",
      title: t2("coach.parallel.title", { n: activeSessions }),
      detail: t2("coach.parallel.detail")
    });
  }
  if (live.subagents.some((a) => a.status === "running")) {
    out.push({
      severity: "info",
      title: t2("coach.subagents.title", { n: live.subagents.filter((a) => a.status === "running").length }),
      detail: t2("coach.subagents.detail")
    });
  }
  const slow = live.currentTool && Date.now() - live.currentTool.startedAt > 12e4 ? live.currentTool : null;
  if (slow) {
    out.push({
      severity: "warn",
      title: t2("coach.slow.title", { name: slow.name }),
      detail: t2("coach.slow.detail")
    });
  }
  const active2 = (data.sessions?.sessions ?? []).find((s) => s.is_active);
  if (active2) {
    if ((active2.message_count ?? 0) > 80) {
      out.push({
        severity: "warn",
        title: t2("coach.longSession.title", { n: active2.message_count }),
        detail: t2("coach.longSession.detail")
      });
    }
    if ((active2.tool_call_count ?? 0) > 40) {
      out.push({
        severity: "info",
        title: t2("coach.toolChurn.title", { n: active2.tool_call_count }),
        detail: t2("coach.toolChurn.detail")
      });
    }
  }
  const topSkill = data.analytics?.skills?.top_skills?.[0];
  if (topSkill && topSkill.total_count > 0 && topSkill.percentage < 5) {
    out.push({
      severity: "info",
      title: t2("coach.skill.title", { name: topSkill.skill, n: topSkill.percentage }),
      detail: t2("coach.skill.detail")
    });
  }
  if (out.length === 0) {
    out.push({
      severity: "info",
      title: t2("coach.quiet.title"),
      detail: t2("coach.quiet.detail")
    });
  }
  return out;
}
function mostRepeatedTool(history) {
  const counts = /* @__PURE__ */ new Map();
  for (const t2 of history) {
    counts.set(t2.name, (counts.get(t2.name) ?? 0) + 1);
  }
  let best = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  return best && best.count >= 2 ? best : null;
}
function fmtCost(n) {
  if (n === void 0 || !Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${(n * 1e3).toFixed(2)}m`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
function fmtTok(n) {
  if (n === void 0 || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
function timeAgo(at, t2) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1e3));
  if (s < 5) return t2("time.now");
  if (s < 60) return t2("time.secondsAgo", { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return t2("time.minutesAgo", { n: m });
  return t2("time.hoursAgo", { n: Math.round(m / 60) });
}
function hhmm(at) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
function extractPaths(tools) {
  const paths = /* @__PURE__ */ new Set();
  for (const t2 of tools) {
    const args = t2.args;
    if (!args || typeof args !== "object") continue;
    const a = args;
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
function fileGlyph(path) {
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
function PanelTitle({ children }) {
  return /* @__PURE__ */ jsx("b", { className: "home-theater-panel-title", children });
}
function NowPanel({ data, live }) {
  const t2 = useT();
  const scene = useScene(live);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
  const status = live.busy ? live.currentTool ? t2("agent.working") : t2("agent.thinking") : data.status?.gateway_running ? t2("agent.idle") : t2("theater.gatewayDown");
  return /* @__PURE__ */ jsxs("section", { className: "home-theater-panel home-theater-now", children: [
    /* @__PURE__ */ jsxs(PanelTitle, { children: [
      /* @__PURE__ */ jsx("span", { className: `home-agent-dot ${live.busy ? "busy" : ""}`, "aria-hidden": "true" }),
      t2("theater.now", { status: status.toUpperCase() }),
      live.activeTitle && /* @__PURE__ */ jsxs("span", { className: "home-theater-sub", children: [
        "— ",
        live.activeTitle
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "home-theater-scene", children: /* @__PURE__ */ jsx(LiveScene, { scene }) }),
    /* @__PURE__ */ jsxs("div", { className: "home-theater-feed", children: [
      live.feed.length === 0 && /* @__PURE__ */ jsx("div", { className: "home-theater-dim", children: t2("theater.feedEmpty") }),
      live.feed.slice(0, 40).map((e) => /* @__PURE__ */ jsxs("div", { className: "home-theater-feed-row", children: [
        /* @__PURE__ */ jsx("span", { className: "home-theater-feed-time", children: hhmm(e.at) }),
        /* @__PURE__ */ jsx(
          "span",
          {
            className: `home-theater-feed-kind ${e.kind}${e.ok === false ? " bad" : ""}`,
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "home-theater-feed-label", children: e.labelKey ? t2(e.labelKey) : e.label }),
        (e.detailKey || e.detail) && /* @__PURE__ */ jsx("span", { className: "home-theater-feed-detail", children: e.detailKey ? t2(e.detailKey) : e.detail })
      ] }, e.id))
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "home-theater-foot", children: [
      /* @__PURE__ */ jsx("span", { children: t2("theater.lastEvent", { when: live.lastEventAt ? timeAgo(live.lastEventAt, t2) : "—" }) }),
      /* @__PURE__ */ jsx("span", { children: live.live ? t2("theater.live") : t2("theater.polling") }),
      /* @__PURE__ */ jsx("span", { children: t2("theater.updated", { when: timeAgo(now, t2) }) })
    ] })
  ] });
}
function ToolPanel({ live }) {
  const t2 = useT();
  return /* @__PURE__ */ jsxs("section", { className: "home-theater-panel", children: [
    /* @__PURE__ */ jsx(PanelTitle, { children: t2("theater.function") }),
    live.currentTool ? /* @__PURE__ */ jsxs("div", { className: "home-theater-fn-current", children: [
      /* @__PURE__ */ jsxs("div", { className: "home-theater-fn-name", children: [
        /* @__PURE__ */ jsx("span", { className: "home-theater-fn-dot running", "aria-hidden": "true" }),
        live.currentTool.name,
        /* @__PURE__ */ jsx("span", { className: "home-theater-fn-state running", children: t2("scene.running") })
      ] }),
      /* @__PURE__ */ jsx("pre", { className: "home-theater-fn-args", children: argPreview(live.currentTool.args, 600) ?? t2("theater.awaitingArgs") })
    ] }) : /* @__PURE__ */ jsx("div", { className: "home-theater-dim", children: t2("theater.noTool") }),
    live.toolHistory.length > 0 && /* @__PURE__ */ jsx("div", { className: "home-theater-fn-history", children: live.toolHistory.slice(0, 8).map((t22, i) => /* @__PURE__ */ jsxs("div", { className: "home-theater-fn-row", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `home-theater-fn-dot ${t22.status === "complete" ? "ok" : "bad"}`,
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "home-theater-fn-hname", children: t22.name }),
      /* @__PURE__ */ jsx("span", { className: "home-theater-fn-hargs", children: argPreview(t22.args, 90) }),
      t22.duration !== void 0 && /* @__PURE__ */ jsxs("span", { className: "home-theater-fn-hdur", children: [
        t22.duration.toFixed(1),
        "s"
      ] })
    ] }, `${t22.name}-${t22.startedAt}-${i}`)) })
  ] });
}
function TokenPanel({ data }) {
  const t2 = useT();
  const totals = data.analytics?.totals;
  const byModel = data.analytics?.by_model ?? [];
  const active2 = (data.sessions?.sessions ?? []).find((s) => s.is_active);
  return /* @__PURE__ */ jsxs("section", { className: "home-theater-panel", children: [
    /* @__PURE__ */ jsx(PanelTitle, { children: t2("theater.tokensCost") }),
    /* @__PURE__ */ jsxs("div", { className: "home-theater-tok-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "home-theater-tok-cell", children: [
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-num", children: fmtTok(totals?.total_input) }),
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-lbl", children: t2("theater.inputToday") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "home-theater-tok-cell", children: [
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-num", children: fmtTok(totals?.total_output) }),
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-lbl", children: t2("theater.outputToday") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "home-theater-tok-cell", children: [
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-num", children: fmtTok(totals?.total_cache_read) }),
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-lbl", children: t2("theater.cacheRead") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "home-theater-tok-cell", children: [
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-num home-theater-money", children: fmtCost(totals?.total_estimated_cost) }),
        /* @__PURE__ */ jsx("span", { className: "home-theater-tok-lbl", children: t2("theater.costToday") })
      ] })
    ] }),
    byModel.length > 0 && /* @__PURE__ */ jsx("div", { className: "home-theater-tok-models", children: byModel.slice(0, 4).map((m) => /* @__PURE__ */ jsxs("div", { className: "home-theater-tok-model", children: [
      /* @__PURE__ */ jsx("span", { className: "home-theater-tok-mname", children: m.model }),
      /* @__PURE__ */ jsx("span", { className: "home-theater-tok-mtok", children: t2("theater.tok", { n: fmtTok(m.input_tokens + m.output_tokens) }) }),
      /* @__PURE__ */ jsx("span", { className: "home-theater-tok-mcost", children: fmtCost(m.estimated_cost) })
    ] }, m.model)) }),
    active2 && /* @__PURE__ */ jsxs("div", { className: "home-theater-tok-session", children: [
      /* @__PURE__ */ jsx("span", { className: "home-theater-tok-slbl", children: t2("theater.activeSession") }),
      /* @__PURE__ */ jsx("span", { className: "home-theater-tok-stitle", children: active2.title ?? active2.id }),
      /* @__PURE__ */ jsx("span", { className: "home-theater-tok-snum", children: t2("theater.sessionNums", {
        tok: fmtTok((active2.input_tokens ?? 0) + (active2.output_tokens ?? 0)),
        msg: active2.message_count ?? 0,
        tools: active2.tool_call_count ?? 0
      }) })
    ] })
  ] });
}
function ProjectPanel({ data, live }) {
  const t2 = useT();
  const active2 = (data.sessions?.sessions ?? []).find((s) => s.is_active);
  const paths = useMemo(
    () => extractPaths([...live.currentTool ? [live.currentTool] : [], ...live.toolHistory]),
    [live.currentTool, live.toolHistory]
  );
  return /* @__PURE__ */ jsxs("section", { className: "home-theater-panel", children: [
    /* @__PURE__ */ jsx(PanelTitle, { children: t2("theater.project") }),
    active2 ? /* @__PURE__ */ jsxs("div", { className: "home-theater-proj-session", children: [
      /* @__PURE__ */ jsx("div", { className: "home-theater-proj-title", children: active2.title ?? t2("theater.untitled") }),
      /* @__PURE__ */ jsxs("div", { className: "home-theater-proj-meta", children: [
        active2.model ?? "—",
        " · ",
        active2.source ?? "—",
        " · ",
        t2("theater.started", { when: timeAgo(active2.started_at * 1e3, t2) })
      ] })
    ] }) : /* @__PURE__ */ jsx("div", { className: "home-theater-dim", children: t2("theater.noSession") }),
    paths.length > 0 ? /* @__PURE__ */ jsx("div", { className: "home-theater-proj-files", children: paths.map((p) => /* @__PURE__ */ jsxs("div", { className: "home-theater-proj-file", children: [
      /* @__PURE__ */ jsx("span", { className: "home-theater-proj-glyph", children: fileGlyph(p) }),
      /* @__PURE__ */ jsx("span", { className: "home-theater-proj-path", children: p })
    ] }, p)) }) : /* @__PURE__ */ jsx("div", { className: "home-theater-dim", children: t2("theater.filesEmpty") }),
    live.subagents.length > 0 && /* @__PURE__ */ jsx("div", { className: "home-theater-proj-subagents", children: live.subagents.map((a) => /* @__PURE__ */ jsxs("div", { className: "home-theater-proj-subagent", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `home-theater-proj-subdot ${a.status === "running" ? "run" : "done"}`,
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "home-theater-proj-subname", children: a.name }),
      a.goal && /* @__PURE__ */ jsxs("span", { className: "home-theater-proj-subgoal", children: [
        "— ",
        a.goal
      ] })
    ] }, a.name)) })
  ] });
}
function CoachPanel({ data, live }) {
  const t2 = useT();
  const recs = useMemo(
    () => buildRecommendations(data, live, t2),
    [data, live, t2]
  );
  return /* @__PURE__ */ jsxs("section", { className: "home-theater-panel", children: [
    /* @__PURE__ */ jsx(PanelTitle, { children: t2("theater.recommendations") }),
    /* @__PURE__ */ jsx("div", { className: "home-theater-rec-list", children: recs.map((r, i) => /* @__PURE__ */ jsxs("div", { className: `home-theater-rec ${r.severity}`, children: [
      /* @__PURE__ */ jsx("span", { className: "home-theater-rec-tag", children: r.severity === "crit" ? "!!" : r.severity === "warn" ? "!" : "i" }),
      /* @__PURE__ */ jsxs("div", { className: "home-theater-rec-body", children: [
        /* @__PURE__ */ jsx("div", { className: "home-theater-rec-title", children: r.title }),
        /* @__PURE__ */ jsx("div", { className: "home-theater-rec-detail", children: r.detail })
      ] })
    ] }, i)) })
  ] });
}
function AgentTheater({ data }) {
  const t2 = useT();
  const live = useAgentLive();
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") exitTheater();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "home-theater", role: "dialog", "aria-label": t2("theater.aria"), children: [
    /* @__PURE__ */ jsxs("header", { className: "home-theater-head", children: [
      /* @__PURE__ */ jsx("span", { className: `home-agent-dot ${live.busy ? "busy" : ""}`, "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("span", { className: "home-theater-title", children: t2("theater.title") }),
      /* @__PURE__ */ jsxs("span", { className: "home-theater-sub", children: [
        live.busy ? t2("theater.working") : t2("theater.idle"),
        " · ",
        live.live ? t2("theater.liveFeed") : t2("theater.polling")
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "home-theater-release",
          onClick: () => exitTheater(),
          title: t2("theater.releaseTitle"),
          children: t2("theater.release")
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "home-theater-grid", children: [
      /* @__PURE__ */ jsx("div", { className: "home-theater-span-7", children: /* @__PURE__ */ jsx(NowPanel, { data, live }) }),
      /* @__PURE__ */ jsx("div", { className: "home-theater-span-5", children: /* @__PURE__ */ jsx(ToolPanel, { live }) }),
      /* @__PURE__ */ jsx("div", { className: "home-theater-span-5", children: /* @__PURE__ */ jsx(TokenPanel, { data }) }),
      /* @__PURE__ */ jsx("div", { className: "home-theater-span-7", children: /* @__PURE__ */ jsx(ProjectPanel, { data, live }) }),
      /* @__PURE__ */ jsx("div", { className: "home-theater-span-12", children: /* @__PURE__ */ jsx(CoachPanel, { data, live }) })
    ] })
  ] });
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
function parseLayout(raw) {
  if (typeof raw !== "object" || raw === null) return DEFAULT_LAYOUT;
  const o = raw;
  if (o.version !== LAYOUT_VERSION || !Array.isArray(o.widgets)) return DEFAULT_LAYOUT;
  const widgets = o.widgets.filter(isValidWidget);
  return { version: LAYOUT_VERSION, widgets };
}
const LAYOUT_URL = "/api/plugins/home-dashboard/layout";
function loadLayout() {
  return fetchJSON(LAYOUT_URL).then((r) => r.layout == null ? DEFAULT_LAYOUT : parseLayout(r.layout)).catch(() => DEFAULT_LAYOUT);
}
function saveLayout(layout) {
  return fetchJSON(LAYOUT_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout })
  });
}
function HomePage() {
  const [layout, setLayout] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const [theaterOn, setTheaterOn] = useState(false);
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
  useEffect(() => subscribeTheater(setTheaterOn), []);
  useEffect(() => {
    if (theaterOn && editing) setEditing(false);
  }, [theaterOn, editing]);
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
        toast && /* @__PURE__ */ jsx("div", { className: "home-toast", role: "status", children: toast }),
        theaterOn && /* @__PURE__ */ jsx(AgentTheater, { data })
      ]
    }
  );
}
const homeCss = "/* Home page — rice-style widget grid.\n * Every color routes through --home-accent (the active theme's primary),\n * so switching themes recolors the whole page with zero widget changes.\n * Swap teal (#2dd4bf) stays fixed: it is interaction semantics, not theme. */\n\n.home-root {\n  --home-accent: var(--color-primary, var(--ui-accent, #ffd700));\n  --home-accent-dim: color-mix(in srgb, var(--home-accent) 55%, #000);\n  /* Readable secondary text (headers, captions): dim was ~3:1 on the glass. */\n  --home-accent-soft: color-mix(in srgb, var(--home-accent) 82%, #9aa3b5);\n  --home-surface: color-mix(\n    in srgb,\n    var(--home-accent) 6%,\n    var(--ui-editor-surface-background, rgb(10 10 14 / 0.55))\n  );\n  --home-border: color-mix(in srgb, var(--home-accent) 18%, transparent);\n  --home-error: var(--color-destructive, #e25555);\n  position: relative;\n  height: 100%;\n  overflow: auto;\n  font-family: var(--theme-font-mono, ui-monospace, monospace);\n  color: var(--color-foreground, var(--ui-text-primary, #d8dce6));\n}\n\n.home-stage {\n  position: relative;\n  min-height: 60vh;\n  touch-action: none;\n}\n\n.home-widget {\n  position: absolute;\n  border-radius: 8px;\n  padding: 10px 12px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);\n  overflow: hidden;\n  transition: left 0.18s ease, top 0.18s ease;\n  container-type: size;\n  font-size: 11px;\n  line-height: 1.5;\n  /* Promote each widget to its own compositor layer so the constantly\n   * repainting matrix canvas doesn't force the neighbours' backdrop-filter\n   * to recompose every frame — that recomposition is what produced the\n   * horizontal flicker sweeping across the glass panels. */\n  transform: translateZ(0);\n  contain: paint;\n}\n.home-root.editing .home-widget { user-select: none; }\n.home-widget.dragging {\n  transition: none;\n  opacity: 0.9;\n  border-color: var(--home-accent);\n  z-index: 50;\n  cursor: grabbing;\n}\n.home-widget.swap-target {\n  border-color: #2dd4bf;\n  box-shadow: 0 0 0 1px rgb(45 212 191 / 0.5), 0 10px 30px rgb(0 0 0 / 0.5);\n}\n/* Over the trash zone — about to be deleted. */\n.home-widget.trashing {\n  opacity: 0.45;\n  border-color: var(--home-error);\n  box-shadow: 0 0 0 1px color-mix(in srgb, var(--home-error) 60%, transparent),\n    0 10px 30px rgb(0 0 0 / 0.5);\n}\n\n/* Floating label that follows the pointer while dragging a new widget in. */\n.home-add-ghost {\n  position: fixed;\n  z-index: 70;\n  transform: translate(-50%, -140%);\n  padding: 4px 10px;\n  border-radius: 6px;\n  font-size: 11px;\n  white-space: nowrap;\n  pointer-events: none;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-accent);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n}\n\n/* Header: short lead rule · TITLE · hairline that fades out. Drawn with CSS\n * (not box-drawing glyphs) so the gaps stay even and the rule never touches\n * the text, whatever the font or title length. */\n.home-widget .hd {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 16px;\n  font-size: 9.5px;\n  letter-spacing: 0.18em;\n  margin-bottom: 8px;\n  font-weight: 700;\n  text-transform: uppercase;\n  color: var(--home-accent-soft);\n  white-space: nowrap;\n  overflow: hidden;\n}\n.home-widget .hd .hd-t { flex: none; }\n.home-widget .hd::before,\n.home-widget .hd::after {\n  content: \"\";\n  height: 1px;\n  flex: none;\n}\n.home-widget .hd::before {\n  width: 12px;\n  background: currentColor;\n  opacity: 0.45;\n}\n.home-widget .hd::after {\n  flex: 1 1 auto;\n  min-width: 0;\n  background: linear-gradient(to right, currentColor, transparent 92%);\n  opacity: 0.28;\n}\n.home-root.editing .home-widget .hd { cursor: grab; }\n\n.home-widget .rs {\n  position: absolute;\n  right: 2px;\n  bottom: 2px;\n  width: 13px;\n  height: 13px;\n  cursor: nwse-resize;\n  border-right: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-bottom: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-radius: 2px;\n  z-index: 3;\n}\n.home-widget .wremove {\n  position: absolute;\n  top: 4px;\n  right: 6px;\n  z-index: 3;\n  background: none;\n  border: none;\n  color: var(--home-error);\n  font-size: 13px;\n  line-height: 1;\n  cursor: pointer;\n  padding: 2px 4px;\n}\n.home-widget .werr { color: var(--home-error); }\n/* Data-source states (widget-state.ts): honest copy per failure kind. */\n.home-widget .wstate { display: block; font-size: 10px; letter-spacing: 0.04em; }\n.home-widget .wstate::before { content: \"● \"; }\n.home-widget .wstate-offline { color: var(--home-error); }\n.home-widget .wstate-unavailable { color: #f5b945; }\n.home-widget .hd .hd-stale { color: #f5b945; letter-spacing: 0.1em; opacity: 0.8; }\n\n/* ── hover controls (contextual chrome, rest mode only) ──\n * Reusable floating control rendered inside a widget body. Hidden by default,\n * fades in while hovering the widget, and fully suppressed in edit mode so it\n * never fights drag/resize. Widgets opt in by rendering <HoverCtl>/<HoverArrows>. */\n.hover-ctl {\n  position: absolute;\n  top: 4px;\n  right: 6px;\n  z-index: 4;\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.18s ease;\n  /* A solid chip so the header rule never runs through the controls;\n   * the soft shadow on its left fades the rule out before it reaches them. */\n  padding: 2px 8px;\n  border-radius: 7px;\n  border: 1px solid var(--home-border);\n  background: linear-gradient(var(--home-surface), var(--home-surface)), rgb(12 12 17);\n  box-shadow: -18px 0 14px -6px rgb(10 10 14 / 0.9);\n  /* Never over the title: lead rule (12px) + gaps + title width + breathing room.\n   * When the controls need more room they wrap onto a second row instead. */\n  max-width: calc(100% - var(--hd-title-w, 80px) - 52px);\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  row-gap: 2px;\n}\n.home-widget:hover .hover-ctl,\n.hover-ctl:focus-within { opacity: 1; pointer-events: auto; }\n.home-root.editing .hover-ctl { display: none; }\n@media (hover: none) {\n  /* Touch: no hover, so keep controls reachable but understated. */\n  .hover-ctl { opacity: 0.5; pointer-events: auto; }\n}\n\n.hv-arrow {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0 3px;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  font-family: inherit;\n}\n.hv-arrow:hover:not(:disabled) { color: var(--home-accent); }\n.hv-arrow:disabled { opacity: 0.3; cursor: default; }\n.hv-label {\n  font-size: 9px;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  white-space: nowrap;\n}\n.hv-label-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  letter-spacing: 0.1em;\n  padding: 0;\n}\n.hv-label-btn:hover { color: var(--home-accent); }\n\n/* Toggle/option buttons inside a hover control (clock format, host view…). */\n.hv-opt {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  font-size: 9px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  padding: 0 4px;\n  border-radius: 4px;\n}\n.hv-opt:hover { color: var(--home-accent); }\n.hv-opt.on { color: #000; background: var(--home-accent); }\n\n/* Extra detail that smoothly expands on widget hover (rest mode only). Uses\n * the 0fr→1fr grid trick so it animates real height without a fixed value. */\n.hover-reveal {\n  display: grid;\n  grid-template-rows: 0fr;\n  opacity: 0;\n  transition: grid-template-rows 0.25s ease, opacity 0.2s ease, margin-top 0.25s ease;\n}\n.home-widget:hover .hover-reveal { grid-template-rows: 1fr; opacity: 1; margin-top: 4px; }\n.home-root.editing .hover-reveal { grid-template-rows: 0fr; opacity: 0; margin-top: 0; }\n.hover-reveal > * { overflow: hidden; min-height: 0; }\n\n.home-ghost {\n  position: absolute;\n  border: 1.5px dashed color-mix(in srgb, var(--home-accent) 70%, transparent);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--home-accent) 7%, transparent);\n  display: none;\n  z-index: 5;\n  pointer-events: none;\n  transition: left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease;\n}\n.home-ghost.visible { display: block; }\n.home-ghost.swap {\n  border-color: rgb(45 212 191 / 0.85);\n  background: rgb(45 212 191 / 0.08);\n}\n\n/* ── widget content primitives (responsive to the widget's own size) ── */\n.home-widget .rows { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .rows { columns: 2; column-rule: 1px solid rgb(255 255 255 / 0.06); }\n}\n@container (min-width: 600px) {\n  .home-widget .rows { columns: 3; }\n}\n.home-widget .row {\n  display: flex;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  break-inside: avoid;\n}\n.home-widget .row:last-child { border-bottom: none; }\n/* Names flex and ellipsize at the real column width instead of a fixed\n * character slice that cut words mid-glyph (\"bitacoras-guayab\"). */\n.home-widget .row > * { flex: none; }\n.home-widget .row > .row-name {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.home-widget .meters { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .meters { columns: 2; }\n}\n.home-widget .meter {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin: 3px 0;\n  break-inside: avoid;\n}\n.home-widget .meter .lbl { width: 34px; color: var(--color-muted-foreground, #7d8496); font-size: 10px; }\n.home-widget .meter .track {\n  flex: 1;\n  height: 7px;\n  border-radius: 2px;\n  background: rgb(255 255 255 / 0.07);\n  overflow: hidden;\n}\n.home-widget .meter .fill {\n  height: 100%;\n  background: linear-gradient(90deg, var(--home-accent-dim), var(--home-accent));\n  transition: width 0.6s ease;\n}\n.home-widget .meter .val { width: 44px; text-align: right; font-size: 10px; }\n\n.home-widget .ok { color: var(--home-accent); }\n.home-widget .dim { color: var(--color-muted-foreground, #6b7387); }\n.home-widget .bigval {\n  font-size: min(9cqw, 18cqh);\n  font-weight: 700;\n  color: var(--home-accent);\n}\n\n.home-clock-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n.home-clock {\n  font-size: min(26cqw, 52cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  letter-spacing: 0.02em;\n  text-shadow: 0 0 24px color-mix(in srgb, var(--home-accent) 35%, transparent);\n  line-height: 1;\n}\n.home-clock-ampm {\n  font-size: 0.32em;\n  vertical-align: 0.9em;\n  margin-left: 0.2em;\n  letter-spacing: 0.05em;\n  color: var(--home-accent-dim);\n}\n.home-clock-sub {\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.4cqw, 8cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-top: 1cqh;\n}\n\n.home-ascii-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n.home-ascii {\n  font-size: min(5.6cqw, 5.4cqh);\n  line-height: 1.05;\n  white-space: pre;\n  text-align: center;\n  background: linear-gradient(\n    180deg,\n    var(--home-accent-dim),\n    var(--home-accent) 40%,\n    var(--home-accent) 60%,\n    var(--home-accent-dim)\n  );\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--home-accent) 25%, transparent));\n}\n.home-ascii-caduceus {\n  transform: scaleX(0.88);\n  transform-origin: center;\n}\n.home-ascii-ver {\n  text-align: center;\n  color: var(--home-accent-soft);\n  font-size: max(8px, min(2.6cqw, 5cqh));\n  letter-spacing: 0.22em;\n  margin-top: 1.5cqh;\n}\n\n.home-spark {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n}\n.home-spark i {\n  flex: 1;\n  background: linear-gradient(180deg, var(--home-accent), var(--home-accent-dim));\n  border-radius: 1px 1px 0 0;\n  opacity: 0.85;\n  transition: height 0.6s ease, opacity 0.15s ease;\n  cursor: default;\n}\n.home-spark i:hover { opacity: 1; }\n\n/* Hover tooltip over a bar (tokens widget). Anchored to the bar via inline\n * `left` + `translateX`, which clamps it inside the clipped widget; the appear/\n * disappear slide+fade runs on the independent `translate` property so it never\n * fights the positioning transform. */\n.home-spark-wrap { position: relative; }\n.home-spark-tip {\n  position: absolute;\n  bottom: 100%;\n  margin-bottom: 6px;\n  padding: 3px 7px;\n  border-radius: 6px;\n  background: color-mix(in srgb, var(--home-accent) 10%, rgb(8 8 12 / 0.96));\n  border: 1px solid var(--home-border);\n  color: rgb(236 236 242);\n  font-size: 10px;\n  line-height: 1.3;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  translate: 0 4px;\n  transition: opacity 0.18s ease, translate 0.18s ease, transform 0.18s ease;\n  z-index: 6;\n}\n.home-spark-tip.show { opacity: 1; translate: 0 0; }\n.home-spark-tip b { color: var(--home-accent); font-weight: 600; }\n\n/* Line/area chart (tokens widget, alternative to the bars). Stretched to fill\n * via preserveAspectRatio=none; the stroke stays crisp with non-scaling-stroke. */\n.home-area {\n  display: block;\n  width: 100%;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n  overflow: visible;\n}\n.home-area rect { cursor: default; }\n\n/* Host graphs view: four live sparklines (cpu / ram / load / proc) in a 2×2\n * grid over a rolling one-minute window. Fills the widget below the header\n * (same absolute pattern as the canvas widgets); cells reuse .home-area but\n * stretch to their cell height instead of the tokens widget's fixed band. */\n.host-sparks {\n  position: absolute;\n  inset: 30px 12px 10px;\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  grid-template-rows: 1fr 1fr;\n  gap: 4px 12px;\n  min-height: 0;\n}\n.host-spark {\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  min-width: 0;\n}\n.host-spark-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  font-size: max(8px, min(3.2cqw, 6cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n.host-spark-head .val {\n  font-variant-numeric: tabular-nums;\n  color: var(--home-accent);\n}\n.host-spark .home-area {\n  flex: 1;\n  height: auto;\n  min-height: 12px;\n  margin: 2px 0 0;\n}\n\n/* Small vertical divider between the range arrows and the toggles. */\n.tok-div {\n  width: 1px;\n  align-self: stretch;\n  margin: 2px 2px;\n  background: var(--home-border);\n}\n\n/* Totals line, regrouped: each label sticks to its value, groups spaced evenly\n * (the old `.row` space-between scattered the six tokens across the full width). */\n.tok-stats {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 2px 14px;\n  padding: 3px 0 1px;\n  font-variant-numeric: tabular-nums;\n}\n.tok-stats > span { white-space: nowrap; }\n.tok-stats .dim { margin-right: 2px; }\n\n/* Grouped usage (tokens widget, by provider / by model): one row per group\n * with a faint share bar behind it, width = --share of the grouped total. */\n.tok-groups { padding-top: 3px; font-variant-numeric: tabular-nums; }\n.home-widget .row.tok-group {\n  background: linear-gradient(\n    90deg,\n    color-mix(in srgb, var(--home-accent) 16%, transparent) var(--share, 0%),\n    transparent var(--share, 0%)\n  );\n  border-radius: 2px;\n  padding-left: 3px;\n}\n.tok-share { min-width: 3ch; text-align: right; }\n.tok-group-note,\n.tok-group-more { font-size: 9.5px; padding-top: 1px; }\n\n/* ── spend widget ── */\n.home-spend { font-variant-numeric: tabular-nums; }\n.spend-head { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.spend-est {\n  margin-left: 6px;\n  padding: 0 4px;\n  border: 1px solid var(--home-border);\n  border-radius: 3px;\n  font-size: 9px;\n  letter-spacing: 0.06em;\n  color: var(--color-muted-foreground, #6b7387);\n  vertical-align: 2px;\n}\n.spend-providers { padding-top: 2px; }\n.spend-covered {\n  margin-top: 4px;\n  padding: 2px 0 2px 6px;\n  border-left: 2px solid color-mix(in srgb, var(--home-accent) 35%, transparent);\n  color: var(--home-accent-soft, var(--home-accent));\n}\n.spend-covered > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.spend-month {\n  margin-top: 4px;\n  padding-top: 3px;\n  border-top: 1px solid rgb(255 255 255 / 0.06);\n}\n.spend-month .spend-flag { white-space: nowrap; }\n.spend-top-head {\n  font-size: 9.5px;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  padding: 2px 0 1px;\n}\n.spend-month.spend-near .spend-flag,\n.spend-month.spend-pace .spend-flag { color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.spend-month.spend-over,\n.spend-month.spend-over .spend-flag { color: var(--home-error); }\n.spend-top { margin-top: 3px; }\n.home-widget .row.spend-session { cursor: pointer; border-radius: 2px; }\n.home-widget .row.spend-session:hover { background: color-mix(in srgb, var(--home-accent) 10%, transparent); }\n.home-widget .row.spend-session:hover .row-name { color: var(--home-accent); }\n.home-root.editing .home-widget .row.spend-session { cursor: inherit; }\n.spend-tag {\n  font-size: 9px;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  color: var(--color-muted-foreground, #6b7387);\n  align-self: center;\n}\n.spend-tag-metered { color: var(--home-accent); }\n.spend-cost { min-width: 6ch; text-align: right; }\n.spend-foot { display: flex; flex-wrap: wrap; gap: 0 10px; font-size: 9.5px; padding-top: 2px; }\n.spend-cap-val { min-width: 4ch; text-align: center; color: var(--home-accent); }\n\n/* Sessions widget: per-row token count (shown while sorting/filtering by it). */\n.ses-tok { font-variant-numeric: tabular-nums; color: var(--home-accent-soft); }\n\n/* ── logs widget (per-file record list) ── */\n.logs-sub {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 8px;\n}\n.logs-file {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  color: var(--home-accent);\n}\n/* The wrapper owns the widget's remaining height so the list scrolls inside it\n * instead of growing past the bottom edge (the old calc() resolved against an\n * auto-height parent and never clamped). */\n.home-logs-wrap {\n  display: flex;\n  flex-direction: column;\n  height: calc(100% - 21px);\n  min-height: 0;\n}\n.home-logs {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  flex: 1 1 0;\n  min-height: 0;\n  overflow-y: auto;\n  margin-top: 3px;\n  /* Rows that don't fit fade out instead of being sliced by the edge. */\n  mask-image: linear-gradient(180deg, #000 calc(100% - 14px), transparent);\n}\n.log-row {\n  display: flex;\n  gap: 6px;\n  align-items: baseline;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  cursor: default;\n}\n.log-row:last-child { border-bottom: none; }\n.log-lvl {\n  flex: none;\n  width: 32px;\n  font-size: 9px;\n  font-weight: 600;\n  letter-spacing: 0.03em;\n}\n.log-lvl.lvl-error { color: var(--home-error); }\n.log-lvl.lvl-warn { color: #f5b945; }\n.log-lvl.lvl-info { color: var(--color-muted-foreground, #6b7387); }\n.log-time {\n  flex: none;\n  font-size: 9px;\n  color: var(--color-muted-foreground, #6b7387);\n  font-variant-numeric: tabular-nums;\n}\n.log-msg {\n  flex: 1;\n  min-width: 0;\n  font-size: 10px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.home-matrix-c {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n\n/* ── notes widget ── */\n.home-notes { display: flex; flex-direction: column; gap: 1px; height: calc(100% - 18px); overflow-y: auto; }\n.home-notes .note-row {\n  display: flex;\n  align-items: baseline;\n  gap: 7px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n}\n.home-notes .note-mark {\n  cursor: pointer;\n  width: 12px;\n  text-align: center;\n  color: var(--home-accent);\n  flex-shrink: 0;\n}\n.home-notes .note-mark.done { color: var(--color-muted-foreground, #6b7387); }\n.home-notes .note-text { cursor: text; flex: 1; min-width: 0; overflow-wrap: anywhere; }\n.home-notes .note-text.done {\n  text-decoration: line-through;\n  color: var(--color-muted-foreground, #6b7387);\n}\n.home-notes .note-input {\n  flex: 1;\n  min-width: 0;\n  background: none;\n  border: none;\n  border-bottom: 1px dashed var(--home-border);\n  outline: none;\n  color: inherit;\n  font: inherit;\n  padding: 0;\n}\n.home-notes .note-add {\n  align-self: flex-start;\n  margin-top: 4px;\n  background: none;\n  border: none;\n  cursor: pointer;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  padding: 2px 6px 2px 2px;\n}\n.home-notes .note-add:hover { color: var(--home-accent); }\n\n/* ── canvas widgets (heartbeat, life) ── */\n.home-canvas {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n/* Life is drawable in rest mode — signal it with a crosshair. */\n.home-root:not(.editing) .home-life { cursor: crosshair; }\n\n/* ── moon ── */\n.home-moon-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  height: calc(100% - 18px);\n}\n.home-moon-c { flex: 1; width: 100%; min-height: 0; }\n.home-moon-label {\n  color: var(--home-accent-dim);\n  font-size: max(8px, min(3cqw, 6cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n\n/* ── pomodoro / countdown ── */\n.home-pomo .home-clock,\n.home-count .home-clock { cursor: pointer; }\n.home-pomo .home-clock.paused { opacity: 0.55; }\n.home-pomo .pomo-sub { cursor: pointer; }\n.home-count .count-label { cursor: pointer; }\n.home-count .count-input,\n.home-pomo .count-input { max-width: 92%; text-align: center; color-scheme: dark; }\n\n/* ── countdown segment editor (alarm-style spinners) ── */\n.count-edit {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 3px;\n  height: calc(100% - 18px);\n}\n.count-edit-row { display: flex; align-items: center; gap: 5px; }\n.count-seg { display: flex; flex-direction: column; align-items: center; }\n.count-seg .seg-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0;\n  line-height: 0.6;\n  font-size: 8px;\n  color: var(--home-accent-dim);\n}\n.count-seg .seg-btn:hover { color: var(--home-accent); }\n.count-seg .seg-val {\n  background: none;\n  border: none;\n  outline: none;\n  text-align: center;\n  color: var(--home-accent);\n  font: inherit;\n  font-weight: 800;\n  font-size: max(12px, min(7cqw, 15cqh));\n  padding: 1px 0;\n  border-bottom: 1px solid transparent;\n  letter-spacing: 0.02em;\n}\n.count-seg input.seg-val:focus { border-bottom-color: var(--home-accent); }\n.count-seg .seg-static { cursor: default; }\n.count-colon {\n  font-weight: 800;\n  color: var(--home-accent-dim);\n  font-size: max(12px, min(7cqw, 15cqh));\n}\n.count-done {\n  margin-top: 3px;\n  background: none;\n  border: 1px solid var(--home-border);\n  border-radius: 6px;\n  color: var(--home-accent);\n  cursor: pointer;\n  font: inherit;\n  font-size: 10px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  padding: 2px 12px;\n}\n.count-done:hover { border-color: var(--home-accent); }\n.home-pomo .pomo-min {\n  font-size: min(20cqw, 40cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  max-width: 70%;\n}\n/* Hover steppers for the pomodoro work/break lengths. */\n.hover-ctl.pomo-set { flex-direction: column; align-items: flex-end; gap: 1px; }\n.pomo-stepper { display: flex; align-items: center; gap: 3px; }\n.pomo-stepper .hv-label:nth-child(3) { min-width: 16px; text-align: center; color: var(--home-accent); }\n\n/* ── calendar ── */\n.home-cal { height: calc(100% - 18px); display: flex; flex-direction: column; }\n.home-cal-month {\n  text-align: center;\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.2cqw, 7cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-bottom: 4px;\n}\n.home-cal-grid {\n  flex: 1;\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  align-content: space-evenly;\n  justify-items: center;\n  font-size: max(8px, min(3cqw, 6.5cqh));\n}\n.home-cal-h { color: var(--color-muted-foreground, #6b7387); }\n.home-cal-d { color: var(--color-foreground, #d8dce6); opacity: 0.75; }\n.home-cal-today {\n  color: #000;\n  background: var(--home-accent);\n  border-radius: 4px;\n  padding: 0 4px;\n  font-weight: 700;\n}\n/* Density tiers, chosen from the widget's cell width (see CalendarWidget). */\n.home-cal.tier-mini .home-cal-month {\n  font-size: max(8px, min(4cqw, 8cqh));\n  margin-bottom: 2px;\n}\n.home-cal.tier-mini .home-cal-grid { font-size: max(9px, min(4cqw, 8cqh)); }\n.home-cal.tier-large .home-cal-month {\n  font-size: max(11px, min(3cqw, 7cqh));\n  margin-bottom: 7px;\n}\n.home-cal.tier-large .home-cal-grid { row-gap: 3px; }\n.home-cal.tier-large .home-cal-h { font-weight: 700; opacity: 0.8; }\n.home-cal.tier-large .home-cal-today { padding: 1px 6px; }\n\n/* ── page chrome ── */\n/* Edit affordance lives BELOW the grid, centered. It fades in once the user\n * starts scrolling down (or immediately when the grid is short enough that\n * there's nothing to scroll), keeping the home clean on first paint. While\n * editing it sticks to the bottom of the viewport so it stays reachable. */\n.home-editbar {\n  display: flex;\n  justify-content: center;\n  gap: 10px;\n  padding: 22px 12px 30px;\n  opacity: 0;\n  transition: opacity 0.25s ease;\n  pointer-events: none;\n}\n.home-editbar.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n.home-root.editing .home-editbar {\n  position: sticky;\n  bottom: 0;\n}\n.home-fab {\n  position: relative;\n  width: 38px;\n  height: 38px;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 15px;\n  cursor: pointer;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition:\n    border-color 0.25s ease,\n    background 0.35s ease,\n    box-shadow 0.45s ease,\n    transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n.home-fab:hover {\n  border-color: var(--home-accent);\n  transform: scale(1.06);\n}\n.home-fab:active { transform: scale(0.94); }\n.home-fab.active {\n  background: color-mix(in srgb, var(--home-accent) 22%, transparent);\n  /* Warm Hermes glow ring when edit mode engages. */\n  animation: home-fab-glow 0.55s ease-out;\n}\n\n/* Crossfading edit ✎ ↔ done ✓ glyphs — each rotates and scales through the\n * swap with a gentle overshoot, matching the dashboard's soft motion. */\n.home-fab-ico {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition:\n    opacity 0.3s ease,\n    transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1);\n}\n.ico-edit { opacity: 1; transform: rotate(0) scale(1); }\n.ico-done { opacity: 0; transform: rotate(-120deg) scale(0.3); }\n.home-fab.active .ico-edit { opacity: 0; transform: rotate(120deg) scale(0.3); }\n.home-fab.active .ico-done { opacity: 1; transform: rotate(0) scale(1); }\n\n.home-fab-spin {\n  display: inline-block;\n  animation: home-fab-spin-in 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n\n/* The restore-default button slides up into place, like the dashboard's\n * dialog-in entrance. */\n.home-fab-enter {\n  animation: home-fab-enter 0.32s cubic-bezier(0.34, 1.3, 0.64, 1);\n}\n\n@keyframes home-fab-glow {\n  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--home-accent) 55%, transparent); }\n  100% { box-shadow: 0 0 0 13px transparent; }\n}\n@keyframes home-fab-spin-in {\n  from { transform: rotate(-150deg); opacity: 0.3; }\n  to   { transform: rotate(0); opacity: 1; }\n}\n@keyframes home-fab-enter {\n  from { opacity: 0; transform: translateY(6px) scale(0.9); }\n  to   { opacity: 1; transform: translateY(0) scale(1); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .home-fab,\n  .home-fab-ico,\n  .home-fab-spin,\n  .home-fab-enter { animation: none; transition: opacity 0.2s ease; }\n}\n\n/* ── toast (plugin-local; the host toast isn't exposed in the SDK) ── */\n.home-toast {\n  position: fixed;\n  bottom: 18px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 80;\n  padding: 8px 16px;\n  border-radius: 8px;\n  font-size: 12px;\n  color: var(--home-error, #e25555);\n  background: var(--home-surface);\n  border: 1px solid var(--home-error, #e25555);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n  animation: home-toast-in 0.25s ease;\n}\n@keyframes home-toast-in {\n  from { opacity: 0; transform: translateX(-50%) translateY(8px); }\n  to { opacity: 1; transform: translateX(-50%) translateY(0); }\n}\n\n/* Catalog reveal: the wrapper animates its row track 0fr → 1fr so the panel\n * grows/collapses its real height smoothly (no grid jump), with a matching\n * fade. Kept mounted so the exit animates too. */\n.home-catalog-wrap {\n  display: grid;\n  grid-template-rows: 0fr;\n  margin: 0 12px;\n  opacity: 0;\n  pointer-events: none;\n  transition:\n    grid-template-rows 0.34s cubic-bezier(0.34, 1.2, 0.64, 1),\n    opacity 0.28s ease,\n    margin-bottom 0.34s ease;\n}\n.home-catalog-wrap.open {\n  grid-template-rows: 1fr;\n  opacity: 1;\n  pointer-events: auto;\n  margin-bottom: 8px;\n}\n.home-catalog {\n  overflow: hidden;\n  min-height: 0;\n  border-radius: 8px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition: border-color 0.2s ease, background 0.2s ease;\n}\n/* Highlighted as a delete target while a widget is dragged over it. */\n.home-catalog-wrap.trash-active .home-catalog {\n  border-color: var(--home-error);\n  border-style: dashed;\n  background: color-mix(in srgb, var(--home-error) 10%, var(--home-surface));\n}\n.home-catalog-inner {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  padding: 10px;\n}\n.home-catalog-hint {\n  font-size: 10px;\n  letter-spacing: 0.04em;\n  color: var(--color-muted-foreground, #6b7387);\n  margin-right: 4px;\n}\n.home-catalog-wrap.trash-active .home-catalog-hint { color: var(--home-error); }\n.home-catalog-chip { touch-action: none; }\n.home-catalog-chip {\n  font-family: inherit;\n  font-size: 11px;\n  padding: 4px 10px;\n  border-radius: 6px;\n  cursor: pointer;\n  background: none;\n  border: 1px dashed var(--home-border);\n  color: var(--color-foreground, #d8dce6);\n  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;\n}\n.home-catalog-chip:hover {\n  border-color: var(--home-accent);\n  color: var(--home-accent);\n  transform: translateY(-1px);\n}\n.home-catalog-chip:active { transform: scale(0.95); }\n.home-catalog .empty { color: var(--color-muted-foreground, #6b7387); font-size: 11px; }\n\n@media (prefers-reduced-motion: reduce) {\n  .home-catalog-wrap { transition: opacity 0.2s ease; }\n}\n\n/* ── Agent widget (the eye) ─────────────────────────────────────────── */\n\n.home-agent {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  /* The .hd header sits above in the same content box (same as the other\n   * widgets' calc) — 100% pushed the stats row 8px past the bottom edge. */\n  height: calc(100% - 21px);\n  min-height: 0;\n  overflow: hidden;\n  font-size: 11px;\n  box-sizing: border-box;\n}\n\n/* The animated scene owns the leftover space and centers its content\n * vertically; head/stats/history are fixed rows that never move or\n * overflow. flex-basis: 0 — the scene shrinks to zero before the fixed\n * rows are ever pushed out. */\n.home-agent-scene {\n  flex: 1 1 0;\n  min-height: 0;\n  display: flex;\n  align-items: center;\n  overflow: hidden;\n}\n\n.home-agent-head {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  flex-wrap: wrap;\n  min-height: 18px;\n  flex: none;\n}\n\n.home-agent-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: var(--home-accent);\n  opacity: 0.45;\n  flex: none;\n  box-shadow: 0 0 6px var(--home-accent);\n}\n.home-agent-dot.busy {\n  opacity: 1;\n  animation: home-agent-pulse 1.2s ease-in-out infinite;\n}\n@keyframes home-agent-pulse {\n  0%, 100% { opacity: 1; transform: scale(1); }\n  50% { opacity: 0.35; transform: scale(0.8); }\n}\n\n.home-agent-status {\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n  font-size: 10px;\n  color: var(--color-foreground, #d8dce6);\n}\n\n.home-agent-take {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font-family: inherit;\n  font-size: 9px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 1px 5px;\n  border-radius: 4px;\n  white-space: nowrap;\n}\n.home-agent-take:hover { color: var(--home-accent); background: color-mix(in srgb, var(--home-accent) 10%, transparent); }\n.home-agent-take:active { transform: scale(0.95); }\n\n/* Play triangle, pure CSS — no emoji. */\n.home-agent-take-ico {\n  width: 0;\n  height: 0;\n  border-left: 4.5px solid currentColor;\n  border-top: 3px solid transparent;\n  border-bottom: 3px solid transparent;\n}\n\n.home-agent-line {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n}\n\n.home-agent-toolbox {\n  display: flex;\n  gap: 6px;\n  align-items: baseline;\n}\n.home-agent-k {\n  color: var(--home-accent);\n  flex: none;\n}\n.home-agent-dim { color: var(--color-muted-foreground, #6b7387); }\n\n.home-agent-msg {\n  color: var(--color-muted-foreground, #8b93a7);\n  font-style: italic;\n  max-height: 42px;\n  white-space: normal;\n  overflow: hidden;\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n}\n\n.home-agent-stats {\n  display: flex;\n  gap: 10px;\n  flex-wrap: wrap;\n  font-size: 10px;\n  color: var(--color-foreground, #d8dce6);\n  border-top: 1px solid var(--home-border);\n  padding-top: 5px;\n  /* Shrinkable last: the scene compresses first (flex-basis 0), then this\n     row and the history may compress instead of overflowing the widget. */\n  flex: 0 1 auto;\n  min-height: 0;\n  overflow: hidden;\n}\n.home-agent-stats span {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  min-width: 0;\n}\n.home-agent-stats i {\n  font-style: normal;\n  color: var(--color-muted-foreground, #6b7387);\n  font-size: 9px;\n}\n\n.home-agent-history {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 10px;\n  max-height: 40px;\n  overflow: hidden;\n  flex: 0 1 auto;\n  min-height: 0;\n}\n.home-agent-hist {\n  font-size: 10px;\n  color: var(--color-muted-foreground, #8b93a7);\n  display: inline-flex;\n  gap: 4px;\n  align-items: center;\n}\n.home-agent-hist-dot {\n  width: 5px;\n  height: 5px;\n  border-radius: 50%;\n  flex: none;\n}\n.home-agent-hist-dot.ok { background: #2dd4bf; }\n.home-agent-hist-dot.bad { background: var(--home-error); }\n.home-agent-hist i {\n  font-style: normal;\n  font-size: 9px;\n  color: var(--color-muted-foreground, #6b7387);\n}\n\n/* ── Agent theater (take-control fullscreen) ───────────────────────── */\n\n.home-theater {\n  position: fixed;\n  inset: 0;\n  z-index: 1000;\n  background: color-mix(in srgb, var(--ui-editor-surface-background, rgb(8 8 12 / 1)) 92%, #000);\n  backdrop-filter: blur(18px);\n  -webkit-backdrop-filter: blur(18px);\n  display: flex;\n  flex-direction: column;\n  padding: 18px 22px 22px;\n  gap: 14px;\n  overflow: auto;\n  font-family: var(--theme-font-mono, ui-monospace, monospace);\n  color: var(--color-foreground, #d8dce6);\n  animation: home-theater-in 0.22s ease;\n}\n@keyframes home-theater-in {\n  from { opacity: 0; transform: scale(0.985); }\n  to { opacity: 1; transform: scale(1); }\n}\n\n.home-theater-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  border-bottom: 1px solid var(--home-border);\n  padding-bottom: 10px;\n  flex: none;\n}\n\n.home-theater-title {\n  font-size: 13px;\n  letter-spacing: 0.14em;\n  color: var(--home-accent);\n}\n\n.home-theater-sub {\n  font-size: 10px;\n  color: var(--color-muted-foreground, #6b7387);\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n}\n\n.home-theater-release {\n  margin-left: auto;\n  background: transparent;\n  border: 1px solid var(--home-border);\n  color: var(--color-foreground, #d8dce6);\n  border-radius: 6px;\n  font-size: 11px;\n  font-family: inherit;\n  padding: 4px 12px;\n  cursor: pointer;\n  transition: border-color 0.15s ease, color 0.15s ease;\n}\n.home-theater-release:hover {\n  border-color: var(--home-error);\n  color: var(--home-error);\n}\n\n.home-theater-grid {\n  display: grid;\n  grid-template-columns: repeat(12, 1fr);\n  gap: 12px;\n  flex: 1;\n  min-height: 0;\n  align-content: start;\n}\n.home-theater-span-5 { grid-column: span 5; }\n.home-theater-span-7 { grid-column: span 7; }\n.home-theater-span-12 { grid-column: span 12; }\n@media (max-width: 900px) {\n  .home-theater-span-5, .home-theater-span-7, .home-theater-span-12 { grid-column: span 12; }\n}\n\n.home-theater-panel {\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  border-radius: 10px;\n  padding: 12px 14px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  min-height: 160px;\n  max-height: 420px;\n  overflow: hidden;\n  box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);\n}\n\n.home-theater-panel-title {\n  font-size: 10px;\n  letter-spacing: 0.12em;\n  color: var(--color-muted-foreground, #6b7387);\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  flex: none;\n  text-transform: uppercase;\n}\n.home-theater-dim {\n  color: var(--color-muted-foreground, #6b7387);\n  font-size: 10px;\n  font-style: italic;\n}\n\n/* NOW panel */\n.home-theater-current-tool {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  background: color-mix(in srgb, var(--home-accent) 8%, transparent);\n  border: 1px solid var(--home-border);\n  border-radius: 8px;\n  padding: 8px 10px;\n  flex: none;\n}\n.home-theater-ct-name {\n  color: var(--home-accent);\n  font-size: 12px;\n}\n.home-theater-ct-args {\n  font-size: 10px;\n  color: var(--color-muted-foreground, #8b93a7);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.home-theater-stream {\n  font-size: 11px;\n  line-height: 1.55;\n  color: var(--color-foreground, #d8dce6);\n  background: color-mix(in srgb, var(--home-accent) 4%, transparent);\n  border-left: 2px solid var(--home-accent);\n  padding: 6px 10px;\n  border-radius: 0 6px 6px 0;\n  max-height: 110px;\n  overflow: auto;\n  flex: none;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n\n.home-theater-feed {\n  flex: 1;\n  min-height: 0;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  font-size: 10.5px;\n}\n.home-theater-feed-row {\n  display: flex;\n  gap: 8px;\n  align-items: baseline;\n  padding: 1px 0;\n  border-bottom: 1px solid color-mix(in srgb, var(--home-border) 40%, transparent);\n  animation: home-feed-in 0.32s ease-out both;\n}\n.home-theater-feed-time {\n  color: var(--color-muted-foreground, #555d70);\n  flex: none;\n  font-size: 9.5px;\n}\n/* Kind dot, pure CSS — no emoji. */\n.home-theater-feed-kind {\n  flex: none;\n  width: 6px;\n  height: 6px;\n  border-radius: 50%;\n  align-self: center;\n}\n.home-theater-feed-kind.tool { background: var(--home-accent); }\n.home-theater-feed-kind.message { background: #2dd4bf; }\n.home-theater-feed-kind.subagent { background: #a78bfa; }\n.home-theater-feed-kind.system { background: var(--color-muted-foreground, #6b7387); }\n.home-theater-feed-kind.bad { background: var(--home-error); }\n.home-theater-feed-label {\n  color: var(--color-foreground, #d8dce6);\n  flex: none;\n}\n.home-theater-feed-detail {\n  color: var(--color-muted-foreground, #8b93a7);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n}\n\n.home-theater-foot {\n  display: flex;\n  gap: 14px;\n  font-size: 9.5px;\n  color: var(--color-muted-foreground, #555d70);\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  flex: none;\n  border-top: 1px solid var(--home-border);\n  padding-top: 6px;\n}\n\n/* FUNCTION panel */\n.home-theater-fn-current {\n  background: color-mix(in srgb, var(--home-accent) 8%, transparent);\n  border: 1px solid var(--home-border);\n  border-radius: 8px;\n  padding: 8px 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  flex: none;\n}\n.home-theater-fn-name {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12px;\n  color: var(--home-accent);\n}\n.home-theater-fn-dot {\n  width: 6px;\n  height: 6px;\n  border-radius: 50%;\n  flex: none;\n}\n.home-theater-fn-dot.running {\n  background: var(--home-accent);\n  animation: home-agent-pulse 1.2s ease-in-out infinite;\n}\n.home-theater-fn-dot.ok { background: #2dd4bf; }\n.home-theater-fn-dot.bad { background: var(--home-error); }\n.home-theater-fn-state {\n  margin-left: auto;\n  font-size: 9px;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n  padding: 1px 8px;\n  border-radius: 20px;\n  border: 1px solid;\n}\n.home-theater-fn-state.running {\n  color: var(--home-accent);\n  border-color: var(--home-accent);\n}\n.home-theater-fn-args {\n  font-size: 10px;\n  color: var(--color-muted-foreground, #8b93a7);\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 120px;\n  overflow: auto;\n  margin: 0;\n  font-family: inherit;\n}\n\n.home-theater-fn-history {\n  flex: 1;\n  min-height: 0;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  font-size: 10.5px;\n}\n.home-theater-fn-row {\n  display: flex;\n  gap: 8px;\n  align-items: baseline;\n  border-bottom: 1px solid color-mix(in srgb, var(--home-border) 40%, transparent);\n  padding: 2px 0;\n}\n.home-theater-fn-hname { color: var(--color-foreground, #d8dce6); flex: none; }\n.home-theater-fn-hargs {\n  color: var(--color-muted-foreground, #8b93a7);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n}\n.home-theater-fn-hdur {\n  margin-left: auto;\n  color: var(--color-muted-foreground, #6b7387);\n  flex: none;\n  font-size: 9.5px;\n}\n\n/* TOKENS & COST panel */\n.home-theater-tok-grid {\n  display: grid;\n  grid-template-columns: repeat(2, 1fr);\n  gap: 8px;\n}\n.home-theater-tok-cell {\n  background: color-mix(in srgb, var(--home-accent) 5%, transparent);\n  border: 1px solid var(--home-border);\n  border-radius: 8px;\n  padding: 8px 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  overflow: hidden;\n}\n.home-theater-tok-num {\n  font-size: 15px;\n  color: var(--color-foreground, #d8dce6);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.home-theater-tok-num.home-theater-money { color: var(--home-accent); }\n.home-theater-tok-lbl {\n  font-size: 9px;\n  text-transform: uppercase;\n  letter-spacing: 0.07em;\n  color: var(--color-muted-foreground, #6b7387);\n}\n\n.home-theater-tok-models {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  font-size: 10px;\n  border-top: 1px solid var(--home-border);\n  padding-top: 6px;\n}\n.home-theater-tok-model {\n  display: flex;\n  gap: 10px;\n  align-items: baseline;\n}\n.home-theater-tok-mname { color: var(--color-foreground, #d8dce6); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.home-theater-tok-mtok { color: var(--color-muted-foreground, #8b93a7); margin-left: auto; }\n.home-theater-tok-mcost { color: var(--home-accent); flex: none; }\n\n.home-theater-tok-session {\n  border-top: 1px solid var(--home-border);\n  padding-top: 6px;\n  font-size: 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n}\n.home-theater-tok-slbl {\n  font-size: 9px;\n  text-transform: uppercase;\n  letter-spacing: 0.07em;\n  color: var(--color-muted-foreground, #6b7387);\n}\n.home-theater-tok-stitle {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.home-theater-tok-snum {\n  color: var(--color-muted-foreground, #8b93a7);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* PROJECT panel */\n.home-theater-proj-session {\n  background: color-mix(in srgb, var(--home-accent) 5%, transparent);\n  border: 1px solid var(--home-border);\n  border-radius: 8px;\n  padding: 8px 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n.home-theater-proj-title { font-size: 12px; color: var(--color-foreground, #d8dce6); }\n.home-theater-proj-meta {\n  font-size: 9.5px;\n  color: var(--color-muted-foreground, #6b7387);\n}\n\n.home-theater-proj-files {\n  flex: 1;\n  min-height: 0;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  font-size: 10.5px;\n}\n.home-theater-proj-file {\n  display: flex;\n  gap: 8px;\n  align-items: baseline;\n  border-bottom: 1px solid color-mix(in srgb, var(--home-border) 40%, transparent);\n  padding: 2px 0;\n}\n.home-theater-proj-glyph {\n  color: var(--home-accent);\n  flex: none;\n  font-size: 9px;\n  width: 16px;\n  text-align: center;\n}\n.home-theater-proj-path {\n  color: var(--color-muted-foreground, #8b93a7);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.home-theater-proj-subagents {\n  border-top: 1px solid var(--home-border);\n  padding-top: 6px;\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  font-size: 10px;\n}\n.home-theater-proj-subagent { display: flex; gap: 8px; align-items: baseline; }\n.home-theater-proj-subdot {\n  width: 6px;\n  height: 6px;\n  border-radius: 50%;\n  flex: none;\n  align-self: center;\n}\n.home-theater-proj-subdot.run { background: var(--home-accent); animation: home-agent-pulse 1.2s ease-in-out infinite; }\n.home-theater-proj-subdot.done { background: #2dd4bf; }\n.home-theater-proj-subname { color: var(--color-foreground, #d8dce6); }\n.home-theater-proj-subgoal {\n  color: var(--color-muted-foreground, #6b7387);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* RECOMMENDATIONS panel */\n.home-theater-rec-list {\n  flex: 1;\n  min-height: 0;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.home-theater-rec {\n  display: flex;\n  gap: 10px;\n  align-items: flex-start;\n  border: 1px solid var(--home-border);\n  border-radius: 8px;\n  padding: 7px 10px;\n  background: color-mix(in srgb, var(--home-surface) 60%, transparent);\n}\n.home-theater-rec.warn { border-color: color-mix(in srgb, #e8b33c 45%, transparent); }\n.home-theater-rec.crit { border-color: color-mix(in srgb, var(--home-error) 55%, transparent); }\n.home-theater-rec-tag {\n  flex: none;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  display: grid;\n  place-items: center;\n  font-size: 10px;\n  margin-top: 1px;\n}\n.home-theater-rec.info .home-theater-rec-tag {\n  color: var(--home-accent);\n  border: 1px solid var(--home-accent);\n}\n.home-theater-rec.warn .home-theater-rec-tag {\n  color: #e8b33c;\n  border: 1px solid #e8b33c;\n}\n.home-theater-rec.crit .home-theater-rec-tag {\n  color: var(--home-error);\n  border: 1px solid var(--home-error);\n}\n.home-theater-rec-body { min-width: 0; }\n.home-theater-rec-title { font-size: 11px; color: var(--color-foreground, #d8dce6); }\n.home-theater-rec-detail {\n  font-size: 10px;\n  color: var(--color-muted-foreground, #8b93a7);\n  margin-top: 1px;\n}\n\n/* ── Live scene — the animated centerpiece ────────────────────────────\n * On identity change: the outgoing content slides up while fading, the\n * incoming content rises from below with a blur that dissolves as it\n * settles. */\n\n.home-theater-scene {\n  flex: 1 1 auto;\n  min-height: 0;\n  display: flex;\n  align-items: center;\n  overflow: hidden;\n}\n\n.home-scene {\n  position: relative;\n  width: 100%;\n}\n\n.home-scene-item {\n  animation: home-scene-in 0.42s ease-out both;\n}\n\n.home-scene-item.leaving {\n  position: absolute;\n  inset-inline: 0;\n  top: 0;\n  animation: home-scene-out 0.4s ease-in forwards;\n  pointer-events: none;\n}\n\n@keyframes home-scene-in {\n  from {\n    opacity: 0;\n    transform: translateY(26px);\n    filter: blur(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n    filter: blur(0);\n  }\n}\n\n@keyframes home-scene-out {\n  from {\n    opacity: 1;\n    transform: translateY(0);\n    filter: blur(0);\n  }\n  to {\n    opacity: 0;\n    transform: translateY(-26px);\n    filter: blur(4px);\n  }\n}\n\n@keyframes home-feed-in {\n  from { opacity: 0; transform: translateY(7px); }\n  to { opacity: 1; transform: translateY(0); }\n}\n\n@keyframes home-caret-blink {\n  0%, 45% { opacity: 1; }\n  50%, 100% { opacity: 0; }\n}\n\n/* Scene content — tool call */\n.home-scene-tool {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  min-width: 0;\n}\n.home-scene-title {\n  color: var(--home-accent);\n  font-size: 12px;\n  font-weight: 600;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.home-scene-meta {\n  font-size: 9px;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n  color: var(--color-muted-foreground, #6b7387);\n}\n.home-scene-args {\n  margin: 0;\n  font-family: inherit;\n  font-size: 10px;\n  color: var(--color-muted-foreground, #8b93a7);\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 90px;\n  overflow: auto;\n}\n\n/* Scene content — message (markdown-rendered) */\n.home-scene-msg {\n  font-size: 11.5px;\n  line-height: 1.6;\n  color: var(--color-foreground, #d8dce6);\n  word-break: break-word;\n  max-height: 150px;\n  overflow: auto;\n}\n.home-scene-msg strong {\n  color: var(--home-accent);\n  font-weight: 650;\n}\n.home-scene-msg em { font-style: italic; }\n.home-scene-msg code {\n  font-family: var(--theme-font-mono, ui-monospace, monospace);\n  font-size: 0.92em;\n  color: var(--home-accent);\n  background: color-mix(in srgb, var(--home-accent) 10%, transparent);\n  padding: 0 4px;\n  border-radius: 4px;\n  white-space: pre-wrap;\n}\n.home-scene-msg .home-md-pre {\n  margin: 4px 0;\n  background: color-mix(in srgb, var(--home-accent) 5%, transparent);\n  border: 1px solid var(--home-border);\n  border-left: 2px solid var(--home-accent);\n  border-radius: 0 6px 6px 0;\n  padding: 6px 10px;\n  overflow: auto;\n  max-height: 120px;\n}\n.home-scene-msg .home-md-pre code {\n  background: none;\n  padding: 0;\n  color: var(--color-muted-foreground, #9aa3b8);\n  font-size: 10px;\n  line-height: 1.5;\n  white-space: pre;\n}\n.home-scene-msg .home-md-h {\n  color: var(--home-accent);\n  font-weight: 650;\n  margin: 3px 0 1px;\n}\n.home-scene-msg .home-md-h.h1 { font-size: 13px; letter-spacing: 0.02em; }\n.home-scene-msg .home-md-h.h2 { font-size: 12px; }\n.home-scene-msg .home-md-h.h3 { font-size: 11px; }\n.home-scene-msg .home-md-p { margin: 2px 0; }\n.home-scene-msg .home-md-gap { height: 4px; }\n.home-scene-msg .home-md-list { margin: 2px 0; display: flex; flex-direction: column; gap: 1px; }\n.home-scene-msg .home-md-li {\n  padding-left: 14px;\n  position: relative;\n}\n.home-scene-msg .home-md-li::before {\n  content: \"\";\n  position: absolute;\n  left: 3px;\n  top: 0.62em;\n  width: 5px;\n  height: 5px;\n  border-radius: 50%;\n  background: var(--home-accent);\n  opacity: 0.8;\n}\n.home-scene-caret {\n  display: inline-block;\n  width: 6px;\n  height: 13px;\n  margin-left: 2px;\n  vertical-align: -2px;\n  background: var(--home-accent);\n  animation: home-caret-blink 1s steps(1) infinite;\n}\n\n/* Scene content — idle */\n.home-scene-idle {\n  font-size: 10px;\n  font-style: italic;\n  color: var(--color-muted-foreground, #6b7387);\n}\n\n/* Compact scene (widget body) */\n.home-agent-scene .home-scene {\n  display: flex;\n  min-height: 0;\n  overflow: hidden;\n}\n.home-agent-scene .home-scene-item {\n  min-width: 0;\n  min-height: 0;\n  flex: 1;\n}\n.home-agent-scene .home-scene-msg {\n  font-size: 10.5px;\n  max-height: 64px;\n  overflow: hidden;\n}\n.home-agent-scene .home-scene-tool {\n  gap: 2px;\n}\n.home-agent-scene .home-scene-title {\n  font-size: 11px;\n}\n.home-agent-scene .home-scene-args {\n  font-size: 10px;\n  max-height: 36px;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  overflow: hidden;\n}\n.home-agent-scene .home-scene-meta,\n.home-agent-scene .home-scene-idle {\n  font-size: 9.5px;\n}\n\n/* ── projects widget (~/projects/<name>/status.json) ── */\n.home-projects {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  max-height: calc(100% - 18px);\n  overflow-y: auto;\n}\n.project-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  border-left: 2px solid var(--home-border);\n  background: color-mix(in srgb, var(--home-accent) 4%, transparent);\n  cursor: pointer;\n}\n.project-row:hover,\n.project-item.open .project-row { background: color-mix(in srgb, var(--home-accent) 10%, transparent); }\n.project-row.ok { border-left-color: var(--home-accent); }\n.project-row.warn { border-left-color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.project-row.err { border-left-color: var(--home-error); }\n.project-icon { font-size: 9px; color: var(--color-muted-foreground, #6b7387); }\n.project-row.ok .project-icon { color: var(--home-accent); }\n.project-row.warn .project-icon { color: color-mix(in srgb, var(--home-accent) 50%, var(--home-error)); }\n.project-row.err .project-icon { color: var(--home-error); }\n.project-name {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n.project-stats { font-variant-numeric: tabular-nums; color: var(--home-accent-soft); font-size: 10px; }\n.project-time { color: var(--color-muted-foreground, #6b7387); font-size: 9.5px; white-space: nowrap; }\n.project-caret { color: var(--color-muted-foreground, #6b7387); font-size: 9px; width: 10px; text-align: center; }\n.project-detail {\n  margin: 1px 0 3px 12px;\n  padding: 4px 8px;\n  border-left: 1px dashed var(--home-border);\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  font-size: 10px;\n}\n.project-detail-row { line-height: 1.4; }\n.project-alerts ul { margin: 2px 0 0 14px; padding: 0; list-style: disc; }\n.project-alerts li { color: var(--home-error); }\n";
const HOME_DESKTOP_PATH = "/home";
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
function createDesktopHomeHost(ctx, desktop) {
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
    onEvent: (type, listener) => desktop.onEvent(type, listener)
  };
}
function DesktopHomePage() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("style", { children: homeCss }),
    /* @__PURE__ */ jsx(HomePage, {})
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
    configureHomeHost(createDesktopHomeHost(ctx, host));
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
