import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { BRIDGE_JS, makeTheme } from "../src/board/embedBridge.ts";
import { COMPONENT_CSP, HB_JS, componentDocument } from "../src/board/componentBridge.ts";

const j = (x) => JSON.parse(JSON.stringify(x));
const THEME = makeTheme({
  foreground: "#eee", mutedForeground: "#999", accent: "#ffe3c4", border: "#333", card: "#111", background: "#031919",
  fontSans: "system-ui", fontMono: "monospace",
});
const INIT = {
  component: { name: "spark", version: "v2" }, data: { a: [1, 2] }, assets: { "trace.json": 3 }, actions: ["ping"],
  clock: { t: 1.5, playing: false, rate: 1, duration: 10, group: "s1", manual: false, master: true },
};

/** A frame: runs the two bridge scripts in a context with a fake parent, returns helpers. */
function frame(init = INIT) {
  const posted = [];
  const listeners = [];
  const parent = { postMessage: (m) => posted.push(m) };
  const style = { setProperty() {}, colorScheme: "" };
  const win = {
    parent, devicePixelRatio: 1, Event: class { constructor(t) { this.type = t; } },
    addEventListener: (t, f) => { if (t === "message") listeners.push(f); },
    dispatchEvent() {}, requestAnimationFrame: (f) => { f(); return 1; },
    document: { documentElement: { style } }, console, TextDecoder, Promise, Blob: class { constructor(p) { this.p = p; } },
  };
  win.window = win;
  win.document = win.document;
  const ctx = vm.createContext(win);
  vm.runInContext(BRIDGE_JS.replace("__HERMES_THEME__", JSON.stringify(THEME)), ctx);
  vm.runInContext(HB_JS.replace("__HB_INIT__", JSON.stringify(init)), ctx);
  const send = (m, source = parent) => listeners.forEach((f) => f({ source, data: m }));
  return { win, posted, send, hb: () => win.hb };
}

test("hb is versioned, carries the init and posts ready", () => {
  const f = frame();
  const hb = f.hb();
  assert.equal(hb.version, 1);
  assert.deepEqual({ ...hb.component }, { name: "spark", version: "v2" });
  assert.deepEqual(j(hb.assets), ["trace.json"]);
  assert.equal(hb.clock.t, 1.5);
  assert.equal(hb.clock.group, "s1");
  assert.ok(f.posted.some((m) => m.type === "hermes:ready"));
});

test("hb.onData fires at once when there is data and on every update", () => {
  const f = frame();
  const seen = [];
  const off = f.hb().onData((d, keys) => seen.push([d.a?.length ?? null, keys]));
  assert.equal(seen.length, 1);
  f.send({ type: "hb:data", data: { a: [1, 2, 3] }, keys: ["a"] });
  assert.deepEqual(j(seen[1]), [3, ["a"]]);
  off();
  f.send({ type: "hb:data", data: { a: [] }, keys: ["a"] });
  assert.equal(seen.length, 2);
  assert.deepEqual(j(f.hb().data), { a: [] });
});

test("messages from anything but the parent are ignored", () => {
  const f = frame();
  const seen = [];
  f.hb().onData((d) => seen.push(d));
  f.send({ type: "hb:data", data: { forged: 1 } }, {});
  assert.equal(seen.length, 1);
  assert.deepEqual(j(f.hb().data), { a: [1, 2] });
});

test("hb.clock: ticks, seeks and state arrive from the host; commands go to the host", () => {
  const f = frame();
  const c = f.hb().clock;
  const ticks = [], seeks = [], states = [];
  c.onTick((t) => ticks.push(t));
  c.onSeek((t) => seeks.push(t));
  c.onState((s) => states.push(s.playing));
  f.send({ type: "hb:clock", ev: "state", clock: { t: 2, playing: true, rate: 1, duration: 10 } });
  f.send({ type: "hb:clock", ev: "tick", clock: { t: 2.033 } });
  f.send({ type: "hb:clock", ev: "seek", clock: { t: 7 } });
  assert.deepEqual(ticks, [2.033, 7]);
  assert.deepEqual(seeks, [7]);
  assert.deepEqual(states, [true]);
  assert.equal(c.t, 7);
  c.play(); c.pause(); c.seek(3.5); c.setRate(2); c.toggle();
  const cmds = f.posted.filter((m) => m.type === "hb:clock-cmd").map((m) => [m.cmd, m.v]);
  assert.deepEqual(cmds, [["play", undefined], ["pause", undefined], ["seek", 3.5], ["rate", 2], ["toggle", undefined]]);
});

test("hb.asset asks the host, decodes by type, caches by revision", async () => {
  const f = frame();
  const hb = f.hb();
  const p = hb.asset("trace.json");
  const req = f.posted.find((m) => m.type === "hb:asset");
  assert.equal(req.name, "trace.json");
  const bytes = new TextEncoder().encode('{"w":[1,2,3]}').buffer;
  f.send({ type: "hb:asset-res", id: req.id, ok: true, body: bytes });
  assert.deepEqual(j(await p), { w: [1, 2, 3] });
  await hb.asset("trace.json", { as: "text" });
  assert.equal(f.posted.filter((m) => m.type === "hb:asset").length, 1, "second read comes from the cache");
  const bad = hb.asset("gone.bin");
  const r2 = f.posted.filter((m) => m.type === "hb:asset")[1];
  f.send({ type: "hb:asset-res", id: r2.id, ok: false, error: "no such data file" });
  await assert.rejects(bad, /no such data file/);
  // a revision bump invalidates the cache
  f.send({ type: "hb:assets", assets: { "trace.json": 4 } });
  hb.asset("trace.json");
  assert.equal(f.posted.filter((m) => m.type === "hb:asset").length, 3);
});

test("hb.action resolves with the host's result and rejects with its error", async () => {
  const f = frame();
  const p = f.hb().action("ping", { n: 1 });
  const req = f.posted.find((m) => m.type === "hb:action");
  assert.deepEqual({ name: req.name, args: req.args }, { name: "ping", args: { n: 1 } });
  f.send({ type: "hb:action-res", id: req.id, ok: true, result: { ok: true, code: 0 } });
  assert.deepEqual(j(await p), { ok: true, code: 0 });
  const q = f.hb().action("stop");
  f.send({ type: "hb:action-res", id: f.posted.filter((m) => m.type === "hb:action")[1].id, ok: false, error: "cancelled" });
  await assert.rejects(q, /cancelled/);
});

test("hb.size and hb.theme mirror window.hermes", () => {
  const f = frame();
  f.send({ type: "hermes:size", w: 480, h: 300, dpr: 2, zoom: 1 });
  assert.equal(f.hb().size.w, 480);
  assert.equal(f.hb().theme.accent, THEME.accent);
  const sizes = [];
  f.hb().onResize((s) => sizes.push(s.w));
  assert.deepEqual(sizes, [480]);
});

test("componentDocument: CSP first, theme on/off, init escaped, author page untouched", () => {
  const init = { ...INIT, data: { evil: "</script><b>" } };
  const themed = componentDocument("<!doctype html><html><head><title>x</title></head><body><p>hi</p></body></html>", true, THEME, init);
  assert.ok(themed.indexOf("Content-Security-Policy") < themed.indexOf("hb-bridge"));
  assert.ok(themed.includes("connect-src 'none'"));
  assert.ok(themed.includes('id="hermes-base"'));
  assert.ok(!themed.includes("</script><b>"), "data cannot close the script tag");
  assert.ok(themed.includes("<p>hi</p>"));
  const plain = componentDocument("<p>x</p>", false, THEME, INIT);
  assert.ok(!plain.includes('id="hermes-base"'));
  assert.ok(plain.includes("window.hb") || plain.includes("W.hb="));
  assert.ok(COMPONENT_CSP.includes("default-src 'none'"));
});
