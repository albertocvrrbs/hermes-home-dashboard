import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { host } from "@hermes/plugin-sdk";
import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
function getDashboardHost() {
  const sdk = window.__HERMES_PLUGIN_SDK__;
  if (!sdk) throw new Error("Hermes plugin SDK not available");
  const dashboard = sdk;
  return {
    ...dashboard,
    navigateTo: (routePath) => window.location.assign(routePath)
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
  getCronJobs: (profile) => getHost().api.getCronJobs(profile),
  getSessions: (limit, offset) => getHost().api.getSessions(limit, offset),
  getLogs: (params) => getHost().api.getLogs(params)
};
function fetchJSON(url, init) {
  return getHost().fetchJSON(url, init);
}
function navigateTo(routePath) {
  getHost().navigateTo(routePath);
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
  for (const t of others) {
    if (t.id === dragged.id || t.gw !== dragged.gw || t.gh !== dragged.gh) continue;
    if (pgx >= t.gx && pgx < t.gx + t.gw && pgy >= t.gy && pgy < t.gy + t.gh) {
      return t;
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
  return /* @__PURE__ */ jsxs(HoverCtl, { className: `hover-arrows${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "hv-arrow",
        "aria-label": "previous",
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
        "aria-label": "next",
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
    doneCount > 0 && /* @__PURE__ */ jsx(HoverCtl, { children: /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: () => commit(notes.filter((n) => !n.done)), children: "clear done" }) }),
    notes.length === 0 && editingId === null && /* @__PURE__ */ jsx("span", { className: "dim", children: "no notes — add one with +" }),
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
            title: n.done ? "restore" : "strike through",
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
    /* @__PURE__ */ jsx("button", { className: "note-add", onClick: add, "aria-label": "Add note", children: "+" })
  ] });
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
  { name: "caduceus", art: CADUCEUS },
  { name: "pyramid", art: pyramid },
  { name: "diamond", art: diamond }
];
function AsciiWidget({ status, widgetProps, onWidgetPropsChange }) {
  const version = status?.version;
  const raw = typeof widgetProps.artIndex === "number" ? widgetProps.artIndex : 0;
  const idx = (raw % ARTS.length + ARTS.length) % ARTS.length;
  const cycle = (dir) => onWidgetPropsChange({ ...widgetProps, artIndex: (idx + dir + ARTS.length) % ARTS.length });
  return /* @__PURE__ */ jsxs("div", { className: "home-ascii-wrap", children: [
    /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => cycle(-1), onNext: () => cycle(1), label: ARTS[idx].name }),
    /* @__PURE__ */ jsx("div", { className: "home-ascii", children: ARTS[idx].art }),
    /* @__PURE__ */ jsxs("div", { className: "home-ascii-ver", children: [
      "HERMES-AGENT",
      version ? ` · v${version}` : ""
    ] })
  ] });
}
function ClockWidget({ widgetProps, onWidgetPropsChange }) {
  const is12 = widgetProps.format === "12";
  const showSeconds = widgetProps.showSeconds === true;
  const [now, setNow] = useState(() => /* @__PURE__ */ new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(/* @__PURE__ */ new Date()), showSeconds ? 1e3 : 5e3);
    return () => clearInterval(t);
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
      /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: () => set({ format: is12 ? "24" : "12" }), children: is12 ? "12h" : "24h" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `hv-opt${showSeconds ? " on" : ""}`,
          onClick: () => set({ showSeconds: !showSeconds }),
          children: "s"
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
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(10, r.width);
      cv.height = Math.max(10, r.height);
      accent = getComputedStyle(cv).getPropertyValue("--home-accent").trim() || accent;
      drops = Array.from(
        { length: Math.floor(cv.width / COL_W) },
        () => Math.floor(Math.random() * -30)
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    const t = setInterval(() => {
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
      clearInterval(t);
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
  if (!status) return /* @__PURE__ */ jsx("span", { className: "dim", children: "loading…" });
  const platforms = Object.entries(status.gateway_platforms ?? {});
  const configStr = `v${status.config_version}${status.config_version !== status.latest_config_version ? ` → v${status.latest_config_version}` : ""}`;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: "status" }),
        /* @__PURE__ */ jsx("span", { className: status.gateway_running ? "ok" : "werr", children: status.gateway_running ? "● online" : "● offline" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: "state" }),
        /* @__PURE__ */ jsx("span", { children: status.gateway_state ?? "—" })
      ] }),
      platforms.map(([name, p]) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: name }),
        /* @__PURE__ */ jsx("span", { className: p.state === "running" ? "ok" : "dim", children: p.state })
      ] }, name))
    ] }),
    /* @__PURE__ */ jsx("div", { className: "hover-reveal", children: /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      status.gateway_pid != null && /* @__PURE__ */ jsx(Row$1, { label: "pid", val: String(status.gateway_pid) }),
      status.gateway_exit_reason && /* @__PURE__ */ jsx(Row$1, { label: "exit", val: status.gateway_exit_reason.slice(0, 28) }),
      status.gateway_health_url && /* @__PURE__ */ jsx(Row$1, { label: "health", val: hostOf(status.gateway_health_url) }),
      /* @__PURE__ */ jsx(Row$1, { label: "config", val: configStr }),
      /* @__PURE__ */ jsx(Row$1, { label: "version", val: `v${status.version}` })
    ] }) })
  ] });
}
const PER_PAGE$1 = 3;
function SessionsWidget({
  status,
  sessions
}) {
  const [page, setPage] = useState(0);
  if (!status && !sessions) return /* @__PURE__ */ jsx("span", { className: "dim", children: "loading…" });
  const all = sessions?.sessions ?? [];
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE$1));
  const p = Math.min(page, pages - 1);
  const slice = all.slice(p * PER_PAGE$1, p * PER_PAGE$1 + PER_PAGE$1);
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
    /* @__PURE__ */ jsx("span", { className: "bigval", children: status?.active_sessions ?? "—" }),
    /* @__PURE__ */ jsx("span", { className: "dim", children: " active" }),
    /* @__PURE__ */ jsx("div", { className: "rows", children: slice.map((s) => /* @__PURE__ */ jsxs("div", { className: "row", children: [
      /* @__PURE__ */ jsx("span", { className: "dim", children: (s.title ?? s.source ?? s.id).slice(0, 18) }),
      /* @__PURE__ */ jsx("span", { className: s.is_active ? "ok" : "dim", children: s.is_active ? "live" : "idle" })
    ] }, s.id)) })
  ] });
}
function formatTokenCount(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return String(n);
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
  { key: "week", label: "7 days", days: 7, byMonth: false },
  { key: "month", label: "1 month", days: 30, byMonth: false },
  { key: "halfyear", label: "6 months", days: 180, byMonth: true }
];
let gradSeq = 0;
function TokensWidget({ analytics, widgetProps, onWidgetPropsChange }) {
  const rangeKey = RANGES.find((r) => r.key === widgetProps.range)?.key ?? "week";
  const range = RANGES.find((r) => r.key === rangeKey);
  const idx = RANGES.findIndex((r) => r.key === rangeKey);
  const chart = widgetProps.chart === "bars" ? "bars" : "line";
  const statsOn = widgetProps.stats !== false;
  const [gid] = useState(() => `tok-grad-${gradSeq++}`);
  const [fetched, setFetched] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState(null);
  const [show, setShow] = useState(false);
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
  const controls = /* @__PURE__ */ jsxs(HoverCtl, { className: "tok-ctl", children: [
    /* @__PURE__ */ jsx("button", { className: "hv-arrow", "aria-label": "previous", onClick: () => cycle(-1), children: "‹" }),
    /* @__PURE__ */ jsx("span", { className: "hv-label", children: range.label }),
    /* @__PURE__ */ jsx("button", { className: "hv-arrow", "aria-label": "next", onClick: () => cycle(1), children: "›" }),
    /* @__PURE__ */ jsx("span", { className: "tok-div" }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `hv-opt${chart === "line" ? " on" : ""}`,
        onClick: () => setProp({ chart: chart === "line" ? "bars" : "line" }),
        title: "line / bars view",
        children: "line"
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `hv-opt${statsOn ? " on" : ""}`,
        onClick: () => setProp({ stats: !statsOn }),
        title: "show / hide totals",
        children: "totals"
      }
    )
  ] });
  const view = fetched ?? (failed ? analytics : null);
  const bars = useMemo(
    () => toBars(view?.daily ?? [], range.byMonth),
    [view, range.byMonth]
  );
  if (!view) {
    return /* @__PURE__ */ jsxs("div", { children: [
      controls,
      /* @__PURE__ */ jsx("span", { className: "dim", children: failed ? "unavailable" : "loading…" })
    ] });
  }
  const t = view.totals;
  const total = t.total_input + t.total_output;
  const n = bars.length;
  const max = Math.max(1, ...bars.map((b) => b.tokens));
  const H = 100, W2 = 100, PAD2 = 3;
  const coords = bars.map((b, i) => [
    n <= 1 ? W2 / 2 : i / (n - 1) * W2,
    H - PAD2 - b.tokens / max * (H - PAD2 * 2)
  ]);
  const linePath = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath = n ? `${linePath} L${coords[n - 1][0].toFixed(2)},${H} L${coords[0][0].toFixed(2)},${H} Z` : "";
  return /* @__PURE__ */ jsxs("div", { children: [
    controls,
    /* @__PURE__ */ jsx("span", { className: "bigval", children: formatTokenCount(total) }),
    /* @__PURE__ */ jsxs("span", { className: "dim", children: [
      " ",
      range.label,
      failed ? " · day*" : ""
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
        areaPath && /* @__PURE__ */ jsx("path", { d: areaPath, fill: `url(#${gid})` }),
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
        /* @__PURE__ */ jsx("span", { className: "dim", children: "in" }),
        " ",
        formatTokenCount(t.total_input)
      ] }),
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: "out" }),
        " ",
        formatTokenCount(t.total_output)
      ] }),
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: "cost" }),
        " ",
        /* @__PURE__ */ jsxs("span", { className: "ok", children: [
          "$",
          t.total_estimated_cost.toFixed(2)
        ] })
      ] })
    ] })
  ] });
}
const GB = 1024 ** 3;
const MB = 1024 ** 2;
const VIEWS = ["meters", "detail"];
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
function HostWidget({ system, widgetProps, onWidgetPropsChange }) {
  if (!system) return /* @__PURE__ */ jsx("span", { className: "dim", children: "loading…" });
  const view = widgetProps.view === "detail" ? "detail" : "meters";
  const cycle = (dir) => {
    const i = (VIEWS.indexOf(view) + dir + VIEWS.length) % VIEWS.length;
    onWidgetPropsChange({ ...widgetProps, view: VIEWS[i] });
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => cycle(-1), onNext: () => cycle(1), label: view }),
    view === "meters" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "meters", children: [
        system.cpu_percent !== void 0 && /* @__PURE__ */ jsx(Meter, { label: "cpu", pct: system.cpu_percent, val: `${Math.round(system.cpu_percent)}%` }),
        system.memory && /* @__PURE__ */ jsx(Meter, { label: "ram", pct: system.memory.percent, val: `${(system.memory.used / GB).toFixed(1)}G` }),
        system.disk && /* @__PURE__ */ jsx(Meter, { label: "disk", pct: system.disk.percent, val: `${Math.round(system.disk.percent)}%` })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "row", children: [
        /* @__PURE__ */ jsx("span", { className: "dim", children: system.hostname }),
        /* @__PURE__ */ jsx("span", { children: system.uptime_seconds !== void 0 ? formatUptime(system.uptime_seconds) : "—" })
      ] })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "rows", children: [
      system.load_avg && system.load_avg.length >= 3 && /* @__PURE__ */ jsx(Row, { label: "load", val: system.load_avg.slice(0, 3).map((n) => n.toFixed(2)).join(" ") }),
      system.cpu_count !== null && /* @__PURE__ */ jsx(Row, { label: "cores", val: String(system.cpu_count) }),
      system.memory && /* @__PURE__ */ jsx(Row, { label: "ram", val: `${(system.memory.used / GB).toFixed(1)} / ${(system.memory.total / GB).toFixed(1)}G` }),
      system.disk && /* @__PURE__ */ jsx(Row, { label: "disk", val: `${(system.disk.free / GB).toFixed(0)}G free` }),
      system.process && /* @__PURE__ */ jsx(Row, { label: "proc", val: `${(system.process.rss / MB).toFixed(0)}M · ${system.process.num_threads} thr` }),
      /* @__PURE__ */ jsx(Row, { label: "os", val: `${system.platform} ${system.arch}` })
    ] })
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
  const [page, setPage] = useState(0);
  if (!cron) return /* @__PURE__ */ jsx("span", { className: "dim", children: "loading…" });
  const upcoming = cron.filter((j) => j.enabled && j.next_run_at).sort((a, b) => (a.next_run_at ?? "").localeCompare(b.next_run_at ?? ""));
  if (upcoming.length === 0) return /* @__PURE__ */ jsx("span", { className: "dim", children: "no scheduled jobs" });
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
      /* @__PURE__ */ jsx("span", { children: (j.name ?? j.id).slice(0, 16) }),
      /* @__PURE__ */ jsx("span", { className: j.last_error ? "werr" : "ok", children: j.last_error ? "err" : "ok" })
    ] }, j.id)) })
  ] });
}
const FILES = ["agent", "errors", "gateway"];
const HEAD_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}),\d+\s+(\w+)\S*\s*(.*)$/;
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
  for (const raw of lines) {
    const m = HEAD_RE.exec(raw);
    if (m) {
      const rest = m[4];
      const ci = rest.indexOf(": ");
      const hasComp = ci > 0 && ci < 40;
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
      /* @__PURE__ */ jsx("span", { className: "dim", children: failed ? "unavailable" : "loading…" })
    ] });
  }
  const records = [...all].reverse();
  return /* @__PURE__ */ jsxs("div", { children: [
    arrows,
    /* @__PURE__ */ jsxs("div", { className: "logs-sub", children: [
      /* @__PURE__ */ jsx("span", { className: "logs-file", children: fileKey.toUpperCase() }),
      /* @__PURE__ */ jsxs("span", { className: "dim", children: [
        records.length,
        " rec"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "home-logs", children: records.length === 0 ? /* @__PURE__ */ jsx("span", { className: "dim", children: "no records" }) : records.map((r, i) => /* @__PURE__ */ jsxs("div", { className: "log-row", title: r.text, children: [
      /* @__PURE__ */ jsx("span", { className: `log-lvl ${levelClass(r.level)}`, children: SHORT[r.level] ?? r.level.slice(0, 4) }),
      /* @__PURE__ */ jsx("span", { className: "log-msg", children: r.message })
    ] }, `${r.time}-${i}`)) })
  ] });
}
const SYNODIC_DAYS = 29.53058867;
const NEW_MOON_MS = Date.UTC(2e3, 0, 6, 18, 14);
const DAY_MS = 864e5;
const PHASE_NAMES = [
  "new moon",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full moon",
  "waning gibbous",
  "last quarter",
  "waning crescent"
];
function moonPhase(now) {
  const days = (now - NEW_MOON_MS) / DAY_MS;
  return (days % SYNODIC_DAYS + SYNODIC_DAYS) % SYNODIC_DAYS / SYNODIC_DAYS;
}
function phaseName(phase) {
  return PHASE_NAMES[Math.round(phase * 8) % 8];
}
function MoonWidget({ widgetProps, onWidgetPropsChange }) {
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
      setLabel(`${phaseName(phase)} · ${Math.round(
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
    const t = setInterval(draw, 36e5);
    return () => {
      ro.disconnect();
      clearInterval(t);
    };
  }, [offset]);
  const offLabel = offset === 0 ? void 0 : offset > 0 ? `+${offset}d` : `${offset}d`;
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
function beatY(t) {
  if (t > 0.1 && t < 0.18) return 0.12 * Math.sin((t - 0.1) / 0.08 * Math.PI);
  if (t > 0.22 && t < 0.25) return -0.12;
  if (t >= 0.25 && t < 0.29) return 1 * Math.sin((t - 0.25) / 0.04 * Math.PI);
  if (t >= 0.29 && t < 0.33) return -0.28;
  if (t > 0.42 && t < 0.54) return 0.2 * Math.sin((t - 0.42) / 0.12 * Math.PI);
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
    const t = setInterval(() => {
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
      clearInterval(t);
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
    const t = setInterval(() => {
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
      clearInterval(t);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
    };
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(HoverCtl, { children: [
      /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: () => setPaused((p) => !p), children: paused ? "play" : "pause" }),
      /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: seedGrid, children: "seed" }),
      /* @__PURE__ */ jsx("button", { className: "hv-opt", onClick: clearGrid, children: "clear" })
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
  const state = readState(widgetProps);
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const commit = (next) => onWidgetPropsChange({ ...widgetProps, pomodoro: next });
  const secondsLeft = state.endsAt !== null ? Math.max(0, Math.round((state.endsAt - now) / 1e3)) : state.remaining;
  const running = state.endsAt !== null;
  useEffect(() => {
    if (state.endsAt === null) return;
    const t = setInterval(() => {
      if (state.endsAt !== null && state.endsAt - Date.now() <= 0) {
        const mode = state.mode === "work" ? "break" : "work";
        const remaining = (mode === "work" ? state.workMin : state.breakMin) * 60;
        commit({ ...state, mode, endsAt: null, remaining });
      } else {
        setNow(Date.now());
      }
    }, 1e3);
    return () => clearInterval(t);
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
        /* @__PURE__ */ jsx("span", { className: "hv-label", children: "work" }),
        /* @__PURE__ */ jsx("button", { className: "hv-arrow", disabled: running, onClick: () => setWork(state.workMin - 1), children: "‹" }),
        /* @__PURE__ */ jsx("span", { className: "hv-label", children: state.workMin }),
        /* @__PURE__ */ jsx("button", { className: "hv-arrow", disabled: running, onClick: () => setWork(state.workMin + 1), children: "›" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "pomo-stepper", children: [
        /* @__PURE__ */ jsx("span", { className: "hv-label", children: "break" }),
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
        title: "click: start / pause",
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
        title: "click to name this timer",
        children: [
          label ? `${label} · ` : "",
          state.mode,
          " ",
          running ? "· running" : "· paused"
        ]
      }
    )
  ] });
}
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
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
  const [buf, setBuf] = useState(null);
  return /* @__PURE__ */ jsxs("div", { className: "count-seg", onWheel: (e) => {
    e.preventDefault();
    onStep(e.deltaY < 0 ? 1 : -1);
  }, children: [
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": `${label} up`, onClick: () => {
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
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": `${label} down`, onClick: () => {
      setBuf(null);
      onStep(-1);
    }, children: "▼" })
  ] });
}
function MonSeg({ value, onStep }) {
  return /* @__PURE__ */ jsxs("div", { className: "count-seg", onWheel: (e) => {
    e.preventDefault();
    onStep(e.deltaY < 0 ? 1 : -1);
  }, children: [
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": "month up", onClick: () => onStep(1), children: "▲" }),
    /* @__PURE__ */ jsx("div", { className: "seg-val seg-static", style: { width: 36 }, children: MONTHS[value] }),
    /* @__PURE__ */ jsx("button", { className: "seg-btn", tabIndex: -1, "aria-label": "month down", onClick: () => onStep(-1), children: "▼" })
  ] });
}
function CountdownWidget({ widgetProps, onWidgetPropsChange }) {
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const target = typeof widgetProps.target === "string" ? widgetProps.target : "";
  const [mode, setMode] = useState("none");
  const [seg, setSeg] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3e4);
    return () => clearInterval(t);
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
            label: "day",
            onStep: (d) => stepField("day", d),
            onCommit: (n) => commitField("day", n)
          }
        ),
        /* @__PURE__ */ jsx(
          NumSeg,
          {
            value: seg.y,
            width: 42,
            label: "year",
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
            label: "hour",
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
            label: "minute",
            onStep: (d) => stepField("min", d),
            onCommit: (n) => commitField("min", n)
          }
        )
      ] }),
      /* @__PURE__ */ jsx("button", { className: "count-done", onClick: () => {
        setMode("none");
        setSeg(null);
      }, children: "done" })
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
  const dateLabel = !Number.isNaN(targetMs) ? new Date(targetMs).toLocaleDateString(void 0, { month: "short", day: "numeric" }) : "set date";
  return /* @__PURE__ */ jsxs("div", { className: "home-clock-wrap home-count", children: [
    /* @__PURE__ */ jsx(HoverArrows, { onPrev: () => shiftDays(-1), onNext: () => shiftDays(1), label: dateLabel }),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "home-clock count-big",
        onClick: openDatetime,
        title: "click to set the date & time",
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
        title: "click to edit the label",
        children: label || "click to name this countdown"
      }
    )
  ] });
}
function CalendarWidget({ gridSize }) {
  const [now, setNow] = useState(() => /* @__PURE__ */ new Date());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(/* @__PURE__ */ new Date()), 6e4);
    return () => clearInterval(t);
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
        label: offset === 0 ? void 0 : "today",
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
const WIDGET_REGISTRY = {
  ascii: {
    title: "hermes",
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
    title: "clock",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(ClockWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 5, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  matrix: {
    title: "matrix",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(MatrixWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 4 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  gateway: {
    title: "gateway",
    component: ({ data }) => /* @__PURE__ */ jsx(GatewayWidget, { status: data.status }),
    defaultSize: { gw: 4, gh: 3 },
    minSize: { gw: 3, gh: 2 },
    navigateTo: "/system",
    dataSource: "status"
  },
  sessions: {
    title: "sessions",
    component: ({ data }) => /* @__PURE__ */ jsx(SessionsWidget, { status: data.status, sessions: data.sessions }),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: "/sessions",
    dataSource: "sessions"
  },
  tokens: {
    title: "tokens",
    component: ({ data, widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(
      TokensWidget,
      {
        analytics: data.analytics,
        widgetProps,
        onWidgetPropsChange
      }
    ),
    defaultSize: { gw: 5, gh: 4 },
    minSize: { gw: 3, gh: 3 },
    navigateTo: null,
    dataSource: "analytics"
  },
  host: {
    title: "host",
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
    title: "cron",
    component: ({ data }) => /* @__PURE__ */ jsx(CronWidget, { cron: data.cron }),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 3, gh: 2 },
    navigateTo: "/cron",
    dataSource: "cron"
  },
  notes: {
    title: "notes",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(NotesWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 4 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  errors: {
    title: "Logs",
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
    title: "moon",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(MoonWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 2, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  heartbeat: {
    title: "heartbeat",
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
    title: "life",
    component: ({ editing }) => /* @__PURE__ */ jsx(LifeWidget, { editing }),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  pomodoro: {
    title: "pomodoro",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(PomodoroWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 3 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  countdown: {
    title: "countdown",
    component: ({ widgetProps, onWidgetPropsChange }) => /* @__PURE__ */ jsx(CountdownWidget, { widgetProps, onWidgetPropsChange }),
    defaultSize: { gw: 3, gh: 2 },
    minSize: { gw: 2, gh: 2 },
    navigateTo: null,
    dataSource: null
  },
  calendar: {
    title: "calendar",
    component: ({ gridSize }) => /* @__PURE__ */ jsx(CalendarWidget, { gridSize }),
    defaultSize: { gw: 3, gh: 4 },
    minSize: { gw: 2, gh: 3 },
    navigateTo: null,
    dataSource: null
  }
};
function WidgetShell({
  title,
  style,
  editing,
  dragging,
  swapTarget,
  trashing,
  error,
  onRemove,
  onHeaderPointerDown,
  onResizePointerDown,
  onClickThrough,
  children
}) {
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
        /* @__PURE__ */ jsx("b", { className: "hd", onPointerDown: editing ? onHeaderPointerDown : void 0, children: title }),
        error ? /* @__PURE__ */ jsx("span", { className: "werr", children: "● no data" }) : children,
        editing && onRemove && /* @__PURE__ */ jsx("button", { className: "wremove", onClick: onRemove, "aria-label": `Remove ${title}`, children: "×" }),
        editing && /* @__PURE__ */ jsx("div", { className: "rs", onPointerDown: onResizePointerDown })
      ]
    }
  );
}
const CELL_H = 44;
const GAP = 10;
const PAD = 12;
const GridCanvas = forwardRef(function GridCanvas2({ layout, editing, data, onLayoutChange, onRemove, onWidgetPropsChange, trashRef, onTrashActive }, ref) {
  const stageRef = useRef(null);
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
          title: def.title,
          style,
          editing,
          dragging: isDragged,
          swapTarget: isTwinTarget,
          trashing: isDragged && drag?.overTrash,
          error: def.dataSource !== null && data.errors.has(def.dataSource),
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
          addDef.title
        ]
      }
    )
  ] });
});
function WidgetCatalog({ layout, onChipPointerDown }) {
  const placed = new Set(layout.widgets.map((w) => w.id));
  const available = Object.entries(WIDGET_REGISTRY).filter(([id]) => !placed.has(id));
  return /* @__PURE__ */ jsx("div", { className: "home-catalog", children: /* @__PURE__ */ jsxs("div", { className: "home-catalog-inner", children: [
    /* @__PURE__ */ jsx("span", { className: "home-catalog-hint", children: "drag a widget here to remove it" }),
    available.map(([id, def]) => /* @__PURE__ */ jsxs(
      "button",
      {
        className: "home-catalog-chip",
        onPointerDown: (e) => onChipPointerDown(id, e),
        children: [
          "+ ",
          def.title
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
  sessions: () => api.getSessions(9),
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
  const [toast, setToast] = useState(null);
  const rootRef = useRef(null);
  const catalogRef = useRef(null);
  const gridRef = useRef(null);
  const dirty = useRef(false);
  const toastTimer = useRef(null);
  const data = useHomeData();
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
            () => showToast("Could not save the layout — it is kept for this session")
          );
        }, 800);
        dirty.current = true;
        return next;
      });
    },
    [showToast]
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
        showToast("Could not save the layout — it is kept for this session");
      }
    }
    setEditing((e) => !e);
  }, [editing, layout, showToast]);
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
              title: "Restore default layout",
              "aria-label": "Restore default layout",
              children: /* @__PURE__ */ jsx("span", { className: "home-fab-spin", children: "↺" })
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              className: `home-fab${editing ? " active" : ""}`,
              onClick: () => void toggleEditing(),
              title: editing ? "Done editing" : "Edit layout",
              "aria-label": editing ? "Done editing" : "Edit layout",
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
const homeCss = "/* Home page — rice-style widget grid.\n * Every color routes through --home-accent (the active theme's primary),\n * so switching themes recolors the whole page with zero widget changes.\n * Swap teal (#2dd4bf) stays fixed: it is interaction semantics, not theme. */\n\n.home-root {\n  --home-accent: var(--color-primary, var(--ui-accent, #ffd700));\n  --home-accent-dim: color-mix(in srgb, var(--home-accent) 55%, #000);\n  --home-surface: color-mix(\n    in srgb,\n    var(--home-accent) 6%,\n    var(--ui-editor-surface-background, rgb(10 10 14 / 0.55))\n  );\n  --home-border: color-mix(in srgb, var(--home-accent) 18%, transparent);\n  --home-error: var(--color-destructive, #e25555);\n  position: relative;\n  height: 100%;\n  overflow: auto;\n  font-family: var(--theme-font-mono, ui-monospace, monospace);\n  color: var(--color-foreground, var(--ui-text-primary, #d8dce6));\n}\n\n.home-stage {\n  position: relative;\n  min-height: 60vh;\n  touch-action: none;\n}\n\n.home-widget {\n  position: absolute;\n  border-radius: 8px;\n  padding: 10px 12px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);\n  overflow: hidden;\n  transition: left 0.18s ease, top 0.18s ease;\n  container-type: size;\n  font-size: 11px;\n  line-height: 1.5;\n  /* Promote each widget to its own compositor layer so the constantly\n   * repainting matrix canvas doesn't force the neighbours' backdrop-filter\n   * to recompose every frame — that recomposition is what produced the\n   * horizontal flicker sweeping across the glass panels. */\n  transform: translateZ(0);\n  contain: paint;\n}\n.home-root.editing .home-widget { user-select: none; }\n.home-widget.dragging {\n  transition: none;\n  opacity: 0.9;\n  border-color: var(--home-accent);\n  z-index: 50;\n  cursor: grabbing;\n}\n.home-widget.swap-target {\n  border-color: #2dd4bf;\n  box-shadow: 0 0 0 1px rgb(45 212 191 / 0.5), 0 10px 30px rgb(0 0 0 / 0.5);\n}\n/* Over the trash zone — about to be deleted. */\n.home-widget.trashing {\n  opacity: 0.45;\n  border-color: var(--home-error);\n  box-shadow: 0 0 0 1px color-mix(in srgb, var(--home-error) 60%, transparent),\n    0 10px 30px rgb(0 0 0 / 0.5);\n}\n\n/* Floating label that follows the pointer while dragging a new widget in. */\n.home-add-ghost {\n  position: fixed;\n  z-index: 70;\n  transform: translate(-50%, -140%);\n  padding: 4px 10px;\n  border-radius: 6px;\n  font-size: 11px;\n  white-space: nowrap;\n  pointer-events: none;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-accent);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n}\n\n.home-widget .hd {\n  display: block;\n  font-size: 9px;\n  letter-spacing: 0.18em;\n  margin-bottom: 6px;\n  font-weight: 700;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  white-space: nowrap;\n  overflow: hidden;\n}\n.home-widget .hd::before { content: \"── \"; opacity: 0.5; }\n.home-widget .hd::after { content: \" ─────────────────────────────────\"; opacity: 0.3; }\n.home-root.editing .home-widget .hd { cursor: grab; }\n\n.home-widget .rs {\n  position: absolute;\n  right: 2px;\n  bottom: 2px;\n  width: 13px;\n  height: 13px;\n  cursor: nwse-resize;\n  border-right: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-bottom: 2px solid color-mix(in srgb, var(--home-accent) 45%, transparent);\n  border-radius: 2px;\n  z-index: 3;\n}\n.home-widget .wremove {\n  position: absolute;\n  top: 4px;\n  right: 6px;\n  z-index: 3;\n  background: none;\n  border: none;\n  color: var(--home-error);\n  font-size: 13px;\n  line-height: 1;\n  cursor: pointer;\n  padding: 2px 4px;\n}\n.home-widget .werr { color: var(--home-error); }\n\n/* ── hover controls (contextual chrome, rest mode only) ──\n * Reusable floating control rendered inside a widget body. Hidden by default,\n * fades in while hovering the widget, and fully suppressed in edit mode so it\n * never fights drag/resize. Widgets opt in by rendering <HoverCtl>/<HoverArrows>. */\n.hover-ctl {\n  position: absolute;\n  top: 4px;\n  right: 6px;\n  z-index: 4;\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.18s ease;\n  /* Sits on the glass without a hard edge. */\n  padding: 1px 3px;\n  border-radius: 6px;\n  background: color-mix(in srgb, var(--home-surface) 80%, transparent);\n}\n.home-widget:hover .hover-ctl,\n.hover-ctl:focus-within { opacity: 1; pointer-events: auto; }\n.home-root.editing .hover-ctl { display: none; }\n@media (hover: none) {\n  /* Touch: no hover, so keep controls reachable but understated. */\n  .hover-ctl { opacity: 0.5; pointer-events: auto; }\n}\n\n.hv-arrow {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0 3px;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  font-family: inherit;\n}\n.hv-arrow:hover:not(:disabled) { color: var(--home-accent); }\n.hv-arrow:disabled { opacity: 0.3; cursor: default; }\n.hv-label {\n  font-size: 9px;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  white-space: nowrap;\n}\n.hv-label-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  letter-spacing: 0.1em;\n  padding: 0;\n}\n.hv-label-btn:hover { color: var(--home-accent); }\n\n/* Toggle/option buttons inside a hover control (clock format, host view…). */\n.hv-opt {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font: inherit;\n  font-size: 9px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--home-accent-dim);\n  padding: 0 4px;\n  border-radius: 4px;\n}\n.hv-opt:hover { color: var(--home-accent); }\n.hv-opt.on { color: #000; background: var(--home-accent); }\n\n/* Extra detail that smoothly expands on widget hover (rest mode only). Uses\n * the 0fr→1fr grid trick so it animates real height without a fixed value. */\n.hover-reveal {\n  display: grid;\n  grid-template-rows: 0fr;\n  opacity: 0;\n  transition: grid-template-rows 0.25s ease, opacity 0.2s ease, margin-top 0.25s ease;\n}\n.home-widget:hover .hover-reveal { grid-template-rows: 1fr; opacity: 1; margin-top: 4px; }\n.home-root.editing .hover-reveal { grid-template-rows: 0fr; opacity: 0; margin-top: 0; }\n.hover-reveal > * { overflow: hidden; min-height: 0; }\n\n.home-ghost {\n  position: absolute;\n  border: 1.5px dashed color-mix(in srgb, var(--home-accent) 70%, transparent);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--home-accent) 7%, transparent);\n  display: none;\n  z-index: 5;\n  pointer-events: none;\n  transition: left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease;\n}\n.home-ghost.visible { display: block; }\n.home-ghost.swap {\n  border-color: rgb(45 212 191 / 0.85);\n  background: rgb(45 212 191 / 0.08);\n}\n\n/* ── widget content primitives (responsive to the widget's own size) ── */\n.home-widget .rows { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .rows { columns: 2; column-rule: 1px solid rgb(255 255 255 / 0.06); }\n}\n@container (min-width: 600px) {\n  .home-widget .rows { columns: 3; }\n}\n.home-widget .row {\n  display: flex;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  break-inside: avoid;\n}\n.home-widget .row:last-child { border-bottom: none; }\n\n.home-widget .meters { column-gap: 18px; }\n@container (min-width: 380px) {\n  .home-widget .meters { columns: 2; }\n}\n.home-widget .meter {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin: 3px 0;\n  break-inside: avoid;\n}\n.home-widget .meter .lbl { width: 34px; color: var(--color-muted-foreground, #7d8496); font-size: 10px; }\n.home-widget .meter .track {\n  flex: 1;\n  height: 7px;\n  border-radius: 2px;\n  background: rgb(255 255 255 / 0.07);\n  overflow: hidden;\n}\n.home-widget .meter .fill {\n  height: 100%;\n  background: linear-gradient(90deg, var(--home-accent-dim), var(--home-accent));\n  transition: width 0.6s ease;\n}\n.home-widget .meter .val { width: 44px; text-align: right; font-size: 10px; }\n\n.home-widget .ok { color: var(--home-accent); }\n.home-widget .dim { color: var(--color-muted-foreground, #6b7387); }\n.home-widget .bigval {\n  font-size: min(9cqw, 18cqh);\n  font-weight: 700;\n  color: var(--home-accent);\n}\n\n.home-clock-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n.home-clock {\n  font-size: min(26cqw, 52cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  letter-spacing: 0.02em;\n  text-shadow: 0 0 24px color-mix(in srgb, var(--home-accent) 35%, transparent);\n  line-height: 1;\n}\n.home-clock-ampm {\n  font-size: 0.32em;\n  vertical-align: 0.9em;\n  margin-left: 0.2em;\n  letter-spacing: 0.05em;\n  color: var(--home-accent-dim);\n}\n.home-clock-sub {\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.4cqw, 8cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-top: 1cqh;\n}\n\n.home-ascii-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: calc(100% - 18px);\n}\n.home-ascii {\n  font-size: min(5.6cqw, 5.4cqh);\n  line-height: 1.05;\n  white-space: pre;\n  text-align: center;\n  background: linear-gradient(\n    180deg,\n    var(--home-accent-dim),\n    var(--home-accent) 40%,\n    var(--home-accent) 60%,\n    var(--home-accent-dim)\n  );\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--home-accent) 25%, transparent));\n}\n.home-ascii-ver {\n  text-align: center;\n  color: var(--home-accent-dim);\n  font-size: max(8px, min(2.6cqw, 5cqh));\n  letter-spacing: 0.22em;\n  margin-top: 1.5cqh;\n}\n\n.home-spark {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n}\n.home-spark i {\n  flex: 1;\n  background: linear-gradient(180deg, var(--home-accent), var(--home-accent-dim));\n  border-radius: 1px 1px 0 0;\n  opacity: 0.85;\n  transition: height 0.6s ease, opacity 0.15s ease;\n  cursor: default;\n}\n.home-spark i:hover { opacity: 1; }\n\n/* Hover tooltip over a bar (tokens widget). Anchored to the bar via inline\n * `left` + `translateX`, which clamps it inside the clipped widget; the appear/\n * disappear slide+fade runs on the independent `translate` property so it never\n * fights the positioning transform. */\n.home-spark-wrap { position: relative; }\n.home-spark-tip {\n  position: absolute;\n  bottom: 100%;\n  margin-bottom: 6px;\n  padding: 3px 7px;\n  border-radius: 6px;\n  background: color-mix(in srgb, var(--home-accent) 10%, rgb(8 8 12 / 0.96));\n  border: 1px solid var(--home-border);\n  color: rgb(236 236 242);\n  font-size: 10px;\n  line-height: 1.3;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  translate: 0 4px;\n  transition: opacity 0.18s ease, translate 0.18s ease, transform 0.18s ease;\n  z-index: 6;\n}\n.home-spark-tip.show { opacity: 1; translate: 0 0; }\n.home-spark-tip b { color: var(--home-accent); font-weight: 600; }\n\n/* Line/area chart (tokens widget, alternative to the bars). Stretched to fill\n * via preserveAspectRatio=none; the stroke stays crisp with non-scaling-stroke. */\n.home-area {\n  display: block;\n  width: 100%;\n  height: max(18px, 22cqh);\n  margin: 6px 0 4px;\n  overflow: visible;\n}\n.home-area rect { cursor: default; }\n\n/* Small vertical divider between the range arrows and the toggles. */\n.tok-div {\n  width: 1px;\n  align-self: stretch;\n  margin: 2px 2px;\n  background: var(--home-border);\n}\n\n/* Totals line, regrouped: each label sticks to its value, groups spaced evenly\n * (the old `.row` space-between scattered the six tokens across the full width). */\n.tok-stats {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 2px 14px;\n  padding: 3px 0 1px;\n  font-variant-numeric: tabular-nums;\n}\n.tok-stats > span { white-space: nowrap; }\n.tok-stats .dim { margin-right: 2px; }\n\n/* ── logs widget (per-file record list) ── */\n.logs-sub {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 8px;\n}\n.logs-file {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  color: var(--home-accent);\n}\n.home-logs {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  height: calc(100% - 40px);\n  overflow-y: auto;\n  margin-top: 3px;\n}\n.log-row {\n  display: flex;\n  gap: 6px;\n  align-items: baseline;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n  cursor: default;\n}\n.log-row:last-child { border-bottom: none; }\n.log-lvl {\n  flex: none;\n  width: 32px;\n  font-size: 9px;\n  font-weight: 600;\n  letter-spacing: 0.03em;\n}\n.log-lvl.lvl-error { color: var(--home-error); }\n.log-lvl.lvl-warn { color: #f5b945; }\n.log-lvl.lvl-info { color: var(--color-muted-foreground, #6b7387); }\n.log-msg {\n  flex: 1;\n  min-width: 0;\n  font-size: 10px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.home-matrix-c {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n\n/* ── notes widget ── */\n.home-notes { display: flex; flex-direction: column; gap: 1px; height: calc(100% - 18px); overflow-y: auto; }\n.home-notes .note-row {\n  display: flex;\n  align-items: baseline;\n  gap: 7px;\n  padding: 1px 0;\n  border-bottom: 1px solid rgb(255 255 255 / 0.04);\n}\n.home-notes .note-mark {\n  cursor: pointer;\n  width: 12px;\n  text-align: center;\n  color: var(--home-accent);\n  flex-shrink: 0;\n}\n.home-notes .note-mark.done { color: var(--color-muted-foreground, #6b7387); }\n.home-notes .note-text { cursor: text; flex: 1; min-width: 0; overflow-wrap: anywhere; }\n.home-notes .note-text.done {\n  text-decoration: line-through;\n  color: var(--color-muted-foreground, #6b7387);\n}\n.home-notes .note-input {\n  flex: 1;\n  min-width: 0;\n  background: none;\n  border: none;\n  border-bottom: 1px dashed var(--home-border);\n  outline: none;\n  color: inherit;\n  font: inherit;\n  padding: 0;\n}\n.home-notes .note-add {\n  align-self: flex-start;\n  margin-top: 4px;\n  background: none;\n  border: none;\n  cursor: pointer;\n  color: var(--home-accent-dim);\n  font-size: 14px;\n  line-height: 1;\n  padding: 2px 6px 2px 2px;\n}\n.home-notes .note-add:hover { color: var(--home-accent); }\n\n/* ── canvas widgets (heartbeat, life) ── */\n.home-canvas {\n  position: absolute;\n  inset: 0;\n  top: 24px;\n  width: 100%;\n  height: calc(100% - 24px);\n}\n/* Life is drawable in rest mode — signal it with a crosshair. */\n.home-root:not(.editing) .home-life { cursor: crosshair; }\n\n/* ── moon ── */\n.home-moon-wrap {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  height: calc(100% - 18px);\n}\n.home-moon-c { flex: 1; width: 100%; min-height: 0; }\n.home-moon-label {\n  color: var(--home-accent-dim);\n  font-size: max(8px, min(3cqw, 6cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n\n/* ── pomodoro / countdown ── */\n.home-pomo .home-clock,\n.home-count .home-clock { cursor: pointer; }\n.home-pomo .home-clock.paused { opacity: 0.55; }\n.home-pomo .pomo-sub { cursor: pointer; }\n.home-count .count-label { cursor: pointer; }\n.home-count .count-input,\n.home-pomo .count-input { max-width: 92%; text-align: center; color-scheme: dark; }\n\n/* ── countdown segment editor (alarm-style spinners) ── */\n.count-edit {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 3px;\n  height: calc(100% - 18px);\n}\n.count-edit-row { display: flex; align-items: center; gap: 5px; }\n.count-seg { display: flex; flex-direction: column; align-items: center; }\n.count-seg .seg-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0;\n  line-height: 0.6;\n  font-size: 8px;\n  color: var(--home-accent-dim);\n}\n.count-seg .seg-btn:hover { color: var(--home-accent); }\n.count-seg .seg-val {\n  background: none;\n  border: none;\n  outline: none;\n  text-align: center;\n  color: var(--home-accent);\n  font: inherit;\n  font-weight: 800;\n  font-size: max(12px, min(7cqw, 15cqh));\n  padding: 1px 0;\n  border-bottom: 1px solid transparent;\n  letter-spacing: 0.02em;\n}\n.count-seg input.seg-val:focus { border-bottom-color: var(--home-accent); }\n.count-seg .seg-static { cursor: default; }\n.count-colon {\n  font-weight: 800;\n  color: var(--home-accent-dim);\n  font-size: max(12px, min(7cqw, 15cqh));\n}\n.count-done {\n  margin-top: 3px;\n  background: none;\n  border: 1px solid var(--home-border);\n  border-radius: 6px;\n  color: var(--home-accent);\n  cursor: pointer;\n  font: inherit;\n  font-size: 10px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  padding: 2px 12px;\n}\n.count-done:hover { border-color: var(--home-accent); }\n.home-pomo .pomo-min {\n  font-size: min(20cqw, 40cqh);\n  font-weight: 800;\n  color: var(--home-accent);\n  max-width: 70%;\n}\n/* Hover steppers for the pomodoro work/break lengths. */\n.hover-ctl.pomo-set { flex-direction: column; align-items: flex-end; gap: 1px; }\n.pomo-stepper { display: flex; align-items: center; gap: 3px; }\n.pomo-stepper .hv-label:nth-child(3) { min-width: 16px; text-align: center; color: var(--home-accent); }\n\n/* ── calendar ── */\n.home-cal { height: calc(100% - 18px); display: flex; flex-direction: column; }\n.home-cal-month {\n  text-align: center;\n  color: var(--home-accent-dim);\n  font-size: max(9px, min(3.2cqw, 7cqh));\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  margin-bottom: 4px;\n}\n.home-cal-grid {\n  flex: 1;\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  align-content: space-evenly;\n  justify-items: center;\n  font-size: max(8px, min(3cqw, 6.5cqh));\n}\n.home-cal-h { color: var(--color-muted-foreground, #6b7387); }\n.home-cal-d { color: var(--color-foreground, #d8dce6); opacity: 0.75; }\n.home-cal-today {\n  color: #000;\n  background: var(--home-accent);\n  border-radius: 4px;\n  padding: 0 4px;\n  font-weight: 700;\n}\n/* Density tiers, chosen from the widget's cell width (see CalendarWidget). */\n.home-cal.tier-mini .home-cal-month {\n  font-size: max(8px, min(4cqw, 8cqh));\n  margin-bottom: 2px;\n}\n.home-cal.tier-mini .home-cal-grid { font-size: max(9px, min(4cqw, 8cqh)); }\n.home-cal.tier-large .home-cal-month {\n  font-size: max(11px, min(3cqw, 7cqh));\n  margin-bottom: 7px;\n}\n.home-cal.tier-large .home-cal-grid { row-gap: 3px; }\n.home-cal.tier-large .home-cal-h { font-weight: 700; opacity: 0.8; }\n.home-cal.tier-large .home-cal-today { padding: 1px 6px; }\n\n/* ── page chrome ── */\n/* Edit affordance lives BELOW the grid, centered. It fades in once the user\n * starts scrolling down (or immediately when the grid is short enough that\n * there's nothing to scroll), keeping the home clean on first paint. While\n * editing it sticks to the bottom of the viewport so it stays reachable. */\n.home-editbar {\n  display: flex;\n  justify-content: center;\n  gap: 10px;\n  padding: 22px 12px 30px;\n  opacity: 0;\n  transition: opacity 0.25s ease;\n  pointer-events: none;\n}\n.home-editbar.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n.home-root.editing .home-editbar {\n  position: sticky;\n  bottom: 0;\n}\n.home-fab {\n  position: relative;\n  width: 38px;\n  height: 38px;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 15px;\n  cursor: pointer;\n  color: var(--home-accent);\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition:\n    border-color 0.25s ease,\n    background 0.35s ease,\n    box-shadow 0.45s ease,\n    transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n.home-fab:hover {\n  border-color: var(--home-accent);\n  transform: scale(1.06);\n}\n.home-fab:active { transform: scale(0.94); }\n.home-fab.active {\n  background: color-mix(in srgb, var(--home-accent) 22%, transparent);\n  /* Warm Hermes glow ring when edit mode engages. */\n  animation: home-fab-glow 0.55s ease-out;\n}\n\n/* Crossfading edit ✎ ↔ done ✓ glyphs — each rotates and scales through the\n * swap with a gentle overshoot, matching the dashboard's soft motion. */\n.home-fab-ico {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition:\n    opacity 0.3s ease,\n    transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1);\n}\n.ico-edit { opacity: 1; transform: rotate(0) scale(1); }\n.ico-done { opacity: 0; transform: rotate(-120deg) scale(0.3); }\n.home-fab.active .ico-edit { opacity: 0; transform: rotate(120deg) scale(0.3); }\n.home-fab.active .ico-done { opacity: 1; transform: rotate(0) scale(1); }\n\n.home-fab-spin {\n  display: inline-block;\n  animation: home-fab-spin-in 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);\n}\n\n/* The restore-default button slides up into place, like the dashboard's\n * dialog-in entrance. */\n.home-fab-enter {\n  animation: home-fab-enter 0.32s cubic-bezier(0.34, 1.3, 0.64, 1);\n}\n\n@keyframes home-fab-glow {\n  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--home-accent) 55%, transparent); }\n  100% { box-shadow: 0 0 0 13px transparent; }\n}\n@keyframes home-fab-spin-in {\n  from { transform: rotate(-150deg); opacity: 0.3; }\n  to   { transform: rotate(0); opacity: 1; }\n}\n@keyframes home-fab-enter {\n  from { opacity: 0; transform: translateY(6px) scale(0.9); }\n  to   { opacity: 1; transform: translateY(0) scale(1); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .home-fab,\n  .home-fab-ico,\n  .home-fab-spin,\n  .home-fab-enter { animation: none; transition: opacity 0.2s ease; }\n}\n\n/* ── toast (plugin-local; the host toast isn't exposed in the SDK) ── */\n.home-toast {\n  position: fixed;\n  bottom: 18px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 80;\n  padding: 8px 16px;\n  border-radius: 8px;\n  font-size: 12px;\n  color: var(--home-error, #e25555);\n  background: var(--home-surface);\n  border: 1px solid var(--home-error, #e25555);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);\n  animation: home-toast-in 0.25s ease;\n}\n@keyframes home-toast-in {\n  from { opacity: 0; transform: translateX(-50%) translateY(8px); }\n  to { opacity: 1; transform: translateX(-50%) translateY(0); }\n}\n\n/* Catalog reveal: the wrapper animates its row track 0fr → 1fr so the panel\n * grows/collapses its real height smoothly (no grid jump), with a matching\n * fade. Kept mounted so the exit animates too. */\n.home-catalog-wrap {\n  display: grid;\n  grid-template-rows: 0fr;\n  margin: 0 12px;\n  opacity: 0;\n  pointer-events: none;\n  transition:\n    grid-template-rows 0.34s cubic-bezier(0.34, 1.2, 0.64, 1),\n    opacity 0.28s ease,\n    margin-bottom 0.34s ease;\n}\n.home-catalog-wrap.open {\n  grid-template-rows: 1fr;\n  opacity: 1;\n  pointer-events: auto;\n  margin-bottom: 8px;\n}\n.home-catalog {\n  overflow: hidden;\n  min-height: 0;\n  border-radius: 8px;\n  background: var(--home-surface);\n  border: 1px solid var(--home-border);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition: border-color 0.2s ease, background 0.2s ease;\n}\n/* Highlighted as a delete target while a widget is dragged over it. */\n.home-catalog-wrap.trash-active .home-catalog {\n  border-color: var(--home-error);\n  border-style: dashed;\n  background: color-mix(in srgb, var(--home-error) 10%, var(--home-surface));\n}\n.home-catalog-inner {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  padding: 10px;\n}\n.home-catalog-hint {\n  font-size: 10px;\n  letter-spacing: 0.04em;\n  color: var(--color-muted-foreground, #6b7387);\n  margin-right: 4px;\n}\n.home-catalog-wrap.trash-active .home-catalog-hint { color: var(--home-error); }\n.home-catalog-chip { touch-action: none; }\n.home-catalog-chip {\n  font-family: inherit;\n  font-size: 11px;\n  padding: 4px 10px;\n  border-radius: 6px;\n  cursor: pointer;\n  background: none;\n  border: 1px dashed var(--home-border);\n  color: var(--color-foreground, #d8dce6);\n  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;\n}\n.home-catalog-chip:hover {\n  border-color: var(--home-accent);\n  color: var(--home-accent);\n  transform: translateY(-1px);\n}\n.home-catalog-chip:active { transform: scale(0.95); }\n.home-catalog .empty { color: var(--color-muted-foreground, #6b7387); font-size: 11px; }\n\n@media (prefers-reduced-motion: reduce) {\n  .home-catalog-wrap { transition: opacity 0.2s ease; }\n}\n";
const HOME_DESKTOP_PATH = "/home";
const DESKTOP_START_KEY = "home-dashboard.opened-this-start";
function createHomeContributions(render, navigate = () => void 0) {
  return [
    {
      id: "page",
      area: "routes",
      title: "Home",
      order: -1e3,
      data: { path: HOME_DESKTOP_PATH },
      render
    },
    {
      id: "nav",
      area: "sidebar.nav",
      order: -1e3,
      data: { path: HOME_DESKTOP_PATH, label: "Home", codicon: "home" }
    },
    {
      id: "open",
      area: "palette",
      order: -1e3,
      data: {
        id: "home.open",
        label: "Open Home",
        keywords: ["home", "dashboard", "widgets"],
        run: () => navigate(HOME_DESKTOP_PATH)
      }
    }
  ];
}
function openHomeOnDesktopStart(storage, navigate) {
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
    navigateTo: (path) => desktop.navigate(desktopRoute(path))
  };
}
function DesktopHomePage() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("style", { children: homeCss }),
    /* @__PURE__ */ jsx(HomePage, {})
  ] });
}
const plugin = {
  id: "home-dashboard",
  name: "Home",
  defaultEnabled: true,
  register(ctx) {
    configureHomeHost(createDesktopHomeHost(ctx, host));
    ctx.registerMany(
      createHomeContributions(
        () => /* @__PURE__ */ jsx(DesktopHomePage, {}),
        (path) => host.navigate(path)
      )
    );
    window.setTimeout(() => {
      openHomeOnDesktopStart(window.sessionStorage, (path) => host.navigate(path));
    }, 0);
  }
};
export {
  plugin as default
};
