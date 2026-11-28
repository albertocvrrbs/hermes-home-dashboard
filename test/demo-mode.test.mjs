import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_KEY, demoSource, installDemo, makeClock, makeDate, parseDemo, parseMoment } from "../src/demo.ts";

const NOW = new Date(2026, 10, 27, 10, 30, 0).getTime();

test("off by default; ?demo turns it on, ?demo=0 off, storage remembers", () => {
  assert.equal(parseDemo("", null).on, false);
  assert.equal(parseDemo("?x=1", null).on, false);
  assert.equal(parseDemo("?demo", null).on, true);
  assert.equal(parseDemo("?demo=1", null).on, true);
  assert.equal(parseDemo("?demo=0", JSON.stringify({ on: true })).on, false);
  assert.equal(parseDemo("?demo=false", null).on, false);
  assert.equal(parseDemo("", JSON.stringify({ on: true, now: 5, nomap: true })).nomap, true);
  assert.equal(parseDemo("", "garbage").on, false);
  assert.equal(parseDemo("", "1").on, true);
});

test("?now accepts ISO, epoch seconds and epoch ms", () => {
  assert.equal(parseMoment("2026-11-27T10:30:00Z"), Date.UTC(2026, 10, 27, 10, 30));
  assert.equal(parseMoment("2026-11-27T10:30:00"), NOW);
  assert.equal(parseMoment("1795775400"), 1795775400_000);
  assert.equal(parseMoment("1795775400000"), 1795775400_000);
  assert.equal(parseMoment("nope"), null);
  assert.equal(parseMoment(null), null);
  const c = parseDemo("?demo&now=2026-11-27T10:30:00&tick&nomap", null);
  assert.deepEqual(c, { on: true, now: NOW, tick: true, nomap: true });
});

test("the demo clock stands still, can tick, can be set and advanced", () => {
  let real = 1000;
  const still = makeClock(NOW, false, () => real);
  real += 60_000;
  assert.equal(still.now(), NOW);
  still.advance(5000);
  assert.equal(still.now(), NOW + 5000);
  still.set(NOW);
  assert.equal(still.now(), NOW);
  const ticking = makeClock(NOW, true, () => real);
  real += 2500;
  assert.equal(ticking.now(), NOW + 2500);
  ticking.advance(1000);
  assert.equal(ticking.now(), NOW + 3500);
});

test("the frozen Date: no-arg form and now() are frozen, everything else is the real Date", () => {
  const clock = makeClock(NOW, false, () => Date.now());
  const D = makeDate(Date, clock);
  assert.equal(D.now(), NOW);
  assert.equal(new D().getTime(), NOW);
  assert.equal(new D(0).getTime(), 0);
  assert.equal(new D(2020, 0, 2).getFullYear(), 2020);
  assert.equal(D.UTC(2020, 0, 1), Date.UTC(2020, 0, 1));
  assert.equal(D.parse("2020-01-01T00:00:00Z"), Date.parse("2020-01-01T00:00:00Z"));
  assert.ok(new D() instanceof Date);
  assert.equal(typeof D(), "string");
  clock.advance(60_000);
  assert.equal(new D().getTime(), NOW + 60_000);
});

function fakeWin(search, stored) {
  const store = new Map(stored ? [[DEMO_KEY, stored]] : []);
  const win = {
    Date, location: { search, reload() { win.reloaded = true; } }, reloaded: false,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
  };
  return { win, store };
}

test("installDemo leaves the page alone when off", () => {
  const { win } = fakeWin("", null);
  const cfg = installDemo(win);
  assert.equal(cfg.on, false);
  assert.equal(win.Date, Date);
  assert.equal(win.__hbDemo.on, false);
});

test("demoSource: neutral data, no host, no money, relative to the frozen clock", () => {
  const cron = demoSource("cron", [{ id: "real", name: "Private job" }], NOW);
  assert.ok(cron.length >= 4 && cron.every((j) => j.enabled && !/private/i.test(j.name)));
  assert.ok(cron.every((j) => new Date(j.next_run_at).getTime() > NOW), "all upcoming");
  const sessions = demoSource("sessions", { sessions: [{ id: "x", title: "My real session" }], total: 1 }, NOW);
  assert.ok(sessions.sessions.length >= 5 && sessions.sessions[0].is_active);
  assert.ok(sessions.sessions.every((s) => !/real/.test(s.title) && s.last_active < NOW / 1000));
  const logs = demoSource("logs", { file: "errors", lines: ["2026-01-01 00:00:00,001 ERROR agent[abc]: model=claude-x provider=anthropic"] }, NOW);
  assert.ok(logs.lines.length >= 2 && logs.lines.every((l) => /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d+ (ERROR|WARNING) /.test(l) && !/model=|provider=/.test(l)));
  assert.equal(demoSource("system", { hostname: "secret-box", cpu_count: 4 }, NOW).hostname, "demo-host");
  const st = demoSource("status", { hermes_home: "/home/someone/.hermes", config_path: "/home/someone/x", env_path: "/y", gateway_health_url: "http://h", version: "1" }, NOW);
  assert.ok(!JSON.stringify(st).includes("someone") && st.version === "1");
  const an = demoSource("analytics", { daily: [{ day: "d", estimated_cost: 9, actual_cost: 8, input_tokens: 5 }], by_model: [{ model: "m", estimated_cost: 3 }], totals: { total_estimated_cost: 721.8, total_actual_cost: 700, total_input: 1 } }, NOW);
  assert.equal(an.totals.total_estimated_cost, 0);
  assert.equal(an.daily[0].estimated_cost, 0);
  assert.equal(an.daily[0].input_tokens, 5, "tokens stay");
  assert.equal(demoSource("projects", { a: 1 }, NOW).a, 1, "other sources pass through");
  assert.equal(demoSource("cron", null, NOW), null);
});

test("installDemo on: freezes the page clock, remembers itself, exposes __hbDemo", () => {
  const { win, store } = fakeWin("?demo&now=2026-11-27T10:30:00&nomap", null);
  const cfg = installDemo(win);
  assert.equal(cfg.on, true);
  assert.equal(win.Date.now(), NOW);
  assert.equal(new win.Date().getTime(), NOW);
  assert.equal(JSON.parse(store.get(DEMO_KEY)).nomap, true);
  win.__hbDemo.advance(90_000);
  assert.equal(win.Date.now(), NOW + 90_000);
  win.__hbDemo.setNow("2026-11-27T12:00:00");
  assert.equal(win.Date.now(), new Date(2026, 10, 27, 12, 0, 0).getTime());
  win.__hbDemo.disable();
  assert.equal(win.reloaded, true);
  assert.equal(store.has(DEMO_KEY), false);
});
