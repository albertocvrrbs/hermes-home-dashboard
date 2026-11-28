// Demo mode: a switch for recording the launch video (or any screen share). Off by default; it
// never touches stored data, it only changes what this page shows.
//   ?demo                    on (remembered in localStorage until ?demo=0)
//   ?demo&now=2026-11-27T10:30:00   freeze Date.now / new Date() at that moment (local time unless it has a zone)
//   ?demo&tick               keep the frozen clock running from `now` instead of stopping it
//   ?demo&nomap              also hide the board's overview map
//   window.__hbDemo          enable({now, tick, nomap}) / disable() / setNow(iso|ms) / advance(ms) / now()
// What changes: the clock is deterministic (clock widget, "saved hh:mm", "3 min ago", live-card
// freshness); the Host widget shows a neutral host name; Cron, Logs and Sessions show neutral demo
// data; Tokens and Spend hide money; the board chat shows no session ids. Pure module: node --test loads it.

export interface DemoConfig {
  on: boolean;
  /** frozen clock origin, ms since epoch (null = real time) */
  now: number | null;
  /** keep the clock running from `now` */
  tick: boolean;
  nomap: boolean;
}

export const DEMO_KEY = "hb.demo";
const OFF: DemoConfig = { on: false, now: null, tick: false, nomap: false };

const FLAG = (v: string | null): boolean => v !== null && !/^(0|false|off|no)$/i.test(v);

/** A moment from `?now=`: an ISO string (local time when it carries no zone) or epoch seconds/ms. */
export function parseMoment(v: string | null | undefined): number | null {
  if (!v) return null;
  if (/^\d{10}$/.test(v)) return Number(v) * 1000;
  if (/^\d{12,14}$/.test(v)) return Number(v);
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/** The config from the page's query string, falling back to what was remembered. `?demo=0` turns it off. */
export function parseDemo(search: string, stored: string | null): DemoConfig {
  const q = new URLSearchParams(search);
  if (q.has("demo")) {
    if (!FLAG(q.get("demo"))) return OFF;
    return { on: true, now: parseMoment(q.get("now")), tick: FLAG(q.get("tick")), nomap: FLAG(q.get("nomap")) };
  }
  if (!stored) return OFF;
  try {
    const s = JSON.parse(stored) as Partial<DemoConfig> | true | 1;
    if (s === true || s === 1) return { ...OFF, on: true };
    if (!s || typeof s !== "object" || !s.on) return OFF;
    return { on: true, now: typeof s.now === "number" ? s.now : null, tick: !!s.tick, nomap: !!s.nomap };
  } catch {
    return stored === "1" ? { ...OFF, on: true } : OFF;
  }
}

// ── the clock ────────────────────────────────────────────────────────────

export interface DemoClock {
  now: () => number;
  set: (ms: number) => void;
  advance: (ms: number) => void;
}

/** A clock that stands still at `start` (or runs on from it when `tick`). */
export function makeClock(start: number, tick: boolean, real: () => number): DemoClock {
  let base = start, since = real();
  return {
    now: () => (tick ? base + (real() - since) : base),
    set: (ms) => { base = ms; since = real(); },
    advance: (ms) => { base = tick ? base + (real() - since) + ms : base + ms; since = real(); },
  };
}

type Ctor = DateConstructor;

/** A Date whose argument-less form (and Date.now) read `clock`; everything else is the real Date. */
export function makeDate(Real: Ctor, clock: DemoClock): Ctor {
  const Demo = function (this: unknown, ...args: unknown[]) {
    if (!new.target) return new Real(clock.now()).toString();
    return args.length === 0 ? new Real(clock.now()) : new (Real as unknown as new (...a: unknown[]) => Date)(...args);
  } as unknown as Ctor;
  Object.setPrototypeOf(Demo, Real);
  (Demo as unknown as { prototype: unknown }).prototype = Real.prototype;
  Demo.now = () => clock.now();
  return Demo;
}

// ── state ────────────────────────────────────────────────────────────────

let config: DemoConfig = OFF;
let realNowFn: () => number = () => Date.now();
/** The real wall clock, for sampling that needs time to pass (sparklines) even while the page clock is frozen. */
export const realNow = (): number => realNowFn();
let clock: DemoClock | null = null;
export const demoOn = (): boolean => config.on;
export const demoConfig = (): DemoConfig => config;
export const demoNomap = (): boolean => config.on && config.nomap;

interface DemoWin {
  Date: DateConstructor;
  location: { search: string; reload: () => void };
  localStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  __hbDemo?: unknown;
  performance?: { now: () => number };
}

/** Reads the switch and, when on, freezes the page's clock. Idempotent. Call before anything renders. */
export function installDemo(win: DemoWin = window as unknown as DemoWin): DemoConfig {
  let stored: string | null = null;
  try { stored = win.localStorage?.getItem(DEMO_KEY) ?? null; } catch { stored = null; }
  const next = parseDemo(win.location.search, stored);
  try {
    if (new URLSearchParams(win.location.search).has("demo")) {
      if (next.on) win.localStorage?.setItem(DEMO_KEY, JSON.stringify(next));
      else win.localStorage?.removeItem(DEMO_KEY);
    }
  } catch { /* private mode: the URL flag still works for this load */ }
  const first = !clock;
  config = next;
  if (next.on && first) {
    const RealDate = win.Date;
    const real = () => RealDate.now();
    realNowFn = real;
    clock = makeClock(next.now ?? real(), next.tick, real);
    win.Date = makeDate(RealDate, clock);
  }
  const api = {
    get on() { return config.on; },
    config: () => ({ ...config }),
    enable: (o: Partial<Omit<DemoConfig, "on" | "now">> & { now?: string | number | null } = {}) => {
      const cfg: DemoConfig = { on: true, now: typeof o.now === "string" ? parseMoment(o.now) : o.now ?? null, tick: !!o.tick, nomap: !!o.nomap };
      try { win.localStorage?.setItem(DEMO_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
      win.location.reload();
    },
    disable: () => {
      try { win.localStorage?.removeItem(DEMO_KEY); } catch { /* ignore */ }
      win.location.reload();
    },
    setNow: (v: string | number) => { const ms = typeof v === "number" ? v : parseMoment(v); if (clock && ms != null) clock.set(ms); },
    advance: (ms: number) => clock?.advance(ms),
    now: () => (clock ? clock.now() : Date.now()),
  };
  win.__hbDemo = api;
  return config;
}

// ── masking ──────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())},120`;
};

/** Neutral stand-ins for the Home sources that hold names, hosts and money. `now` is the (frozen) clock, ms. */
export function demoSource(key: string, value: unknown, now: number): unknown {
  const v = value as Record<string, unknown> | unknown[] | null;
  if (!v) return value;
  switch (key) {
    case "status":
      return { ...(v as object), hermes_home: "~/.hermes", config_path: "~/.hermes/config.yaml", env_path: "~/.hermes/.env", gateway_health_url: null };
    case "system":
      return { ...(v as object), hostname: "demo-host" };
    case "analytics": {
      const a = v as { daily?: Record<string, unknown>[]; by_model?: Record<string, unknown>[]; totals?: Record<string, unknown> };
      const zero = (r: Record<string, unknown>) => ({ ...r, estimated_cost: 0, actual_cost: 0 });
      return {
        ...a,
        daily: a.daily?.map(zero),
        by_model: a.by_model?.map(zero),
        totals: a.totals && { ...a.totals, total_estimated_cost: 0, total_actual_cost: 0 },
      };
    }
    case "cron": {
      const jobs: [string, string, number][] = [
        ["Morning briefing", "every day 08:00", 25 * 60e3],
        ["Nightly backup check", "every day 23:30", 2.4 * 3600e3],
        ["Weekly digest", "mondays 09:00", 5.1 * 3600e3],
        ["Inbox triage", "every hour", 11 * 60e3],
        ["Release notes draft", "fridays 17:00", 20 * 3600e3],
      ];
      return jobs.map(([name, display, ahead], i) => ({
        id: `demo-${i}`, name, enabled: true, state: "scheduled", schedule_display: display,
        next_run_at: new Date(now + ahead).toISOString(), last_run_at: new Date(now - 3600e3 * (i + 1)).toISOString(), last_error: null,
      }));
    }
    case "sessions": {
      const titles = ["Plan the launch board", "Tidy the training notes", "Draft the release notes", "Review the spider sim", "Sketch the exam circuit", "Weekly summary"];
      const s = titles.map((title, i) => ({
        id: `demo-s${i}`, source: "cli", model: "demo-model", title, started_at: now / 1000 - 3600 * (i + 1), ended_at: i ? now / 1000 - 3000 * i : null,
        last_active: now / 1000 - 420 * (i + 1), is_active: i === 0, message_count: 14 + i * 5, tool_call_count: 3 + i,
        input_tokens: 42_000 + i * 31_000, output_tokens: 9_000 + i * 6_500, preview: title,
      }));
      return { sessions: s, total: s.length, limit: 20, offset: 0 };
    }
    case "logs":
      return {
        file: "errors",
        lines: [
          `${stamp(now - 14 * 60e3)} ERROR demo.worker: Upstream request timed out, retrying in 5s`,
          `${stamp(now - 9 * 60e3)} WARNING demo.gateway: Connection reset by peer`,
          `${stamp(now - 3 * 60e3)} ERROR demo.worker: Retry limit reached, giving up on job`,
        ],
      };
    default:
      return value;
  }
}
