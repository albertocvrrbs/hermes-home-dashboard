import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  baseCss, BRIDGE_JS, chartPalette, embedDocument, insertAtHead, makeTheme, parseColor, sizeMessage,
} from "../src/board/embedBridge.ts";

const RAW = {
  foreground: "rgb(243 236 227)", mutedForeground: "rgb(160 155 150)", accent: "rgb(255 227 196)",
  border: "rgb(255 255 255 / 0.14)", card: "rgb(20 30 30)", background: "rgb(3 25 25)",
  fontSans: "Inter, system-ui, sans-serif", fontMono: "\"JetBrains Mono\", ui-monospace, monospace",
};

test("parseColor reads hex, rgb() with commas, spaces and slash alpha", () => {
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("rgb(1, 2, 3)"), { r: 1, g: 2, b: 3, a: 1 });
  assert.deepEqual(parseColor("rgb(1 2 3 / 0.5)"), { r: 1, g: 2, b: 3, a: 0.5 });
  assert.equal(parseColor("not a colour"), null);
});

test("makeTheme picks the colour scheme from the page background", () => {
  assert.equal(makeTheme(RAW).scheme, "dark");
  assert.equal(makeTheme({ ...RAW, background: "rgb(250 250 247)" }).scheme, "light");
});

test("chart palette: five distinct colours, the accent first, readable on each scheme", () => {
  const dark = chartPalette("rgb(255 227 196)", "dark");
  assert.equal(dark.length, 5);
  assert.equal(dark[0], "#ffe3c4");
  assert.equal(new Set(dark).size, 5);
  assert.deepEqual(chartPalette("rgb(255 227 196)", "dark"), dark);
  const light = chartPalette("#3b6ea8", "light");
  assert.ok(light.every((c) => /^#[0-9a-f]{6}$/.test(c)));
  assert.notDeepEqual(light.slice(1), dark.slice(1));
});

test("base css carries the contract: vars, fonts, transparent page, zero margins, color-scheme", () => {
  const css = baseCss(makeTheme(RAW));
  for (const v of ["--foreground", "--muted-foreground", "--accent", "--border", "--card", "--background",
    "--chart-1", "--chart-5", "--font-sans", "--font-mono"]) assert.ok(css.includes(v + ":"), v);
  assert.match(css, /color-scheme:dark/);
  assert.match(css, /html,body\{[^}]*margin:0[^}]*background:transparent/);
  assert.match(css, /box-sizing:border-box/);
  assert.match(css, /img,video,canvas,svg\{max-width:100%\}/);
  assert.ok(css.includes("Inter, system-ui, sans-serif"));
});

test("insertAtHead keeps the doctype first and works without head/html", () => {
  assert.equal(insertAtHead("<!doctype html><html><head><title>t</title></head>", "X"), "<!doctype html><html><head>X<title>t</title></head>");
  assert.equal(insertAtHead("<html><body>a</body></html>", "X"), "<html><head>X</head><body>a</body></html>");
  assert.equal(insertAtHead("<!DOCTYPE html><p>a</p>", "X"), "<!DOCTYPE html>X<p>a</p>");
  assert.equal(insertAtHead("<p>a</p>", "X"), "X<p>a</p>");
  assert.equal(insertAtHead("<head data-x=1><style>a{}</style>", "X"), "<head data-x=1>X<style>a{}</style>");
});

test("theme OFF: the author's document is returned byte for byte", () => {
  const page = "<!doctype html><html><head><style>body{background:#fff}</style></head><body><h1>Hi</h1></body></html>";
  assert.equal(embedDocument(page, false, makeTheme(RAW)), page);
  assert.equal(embedDocument(page, false, null), page);
  assert.ok(!embedDocument(page, false, makeTheme(RAW)).includes("hermes"));
});

test("theme ON: base css and bridge come before the author's styles", () => {
  const page = "<!doctype html><html><head><style>.a{color:red}</style></head><body><canvas id=c></canvas></body></html>";
  const out = embedDocument(page, true, makeTheme(RAW));
  assert.ok(out.startsWith("<!doctype html>"));
  assert.ok(out.indexOf('id="hermes-base"') < out.indexOf(".a{color:red}"));
  assert.ok(out.indexOf('id="hermes-bridge"') < out.indexOf(".a{color:red}"));
  assert.ok(out.endsWith("</html>"));
  assert.equal(embedDocument(page, true, null), page, "no theme read yet -> untouched, never half-injected");
});

test("theme JSON cannot close the script tag", () => {
  const t = makeTheme({ ...RAW, fontSans: "</script><b>x" });
  const out = embedDocument("<p>a</p>", true, t);
  assert.equal(out.split("</script>").length, 2);
});

test("sizeMessage: layout size, dpr multiplied by board zoom (idle), clamped", () => {
  assert.deepEqual(sizeMessage(300.4, 200.6, 2, 1), { type: "hermes:size", w: 300, h: 201, dpr: 2, zoom: 1 });
  assert.equal(sizeMessage(1, 1, 2, 1.5).dpr, 3);
  assert.equal(sizeMessage(1, 1, 2, 0.4).dpr, 2, "zoomed out never lowers below the device ratio");
  assert.equal(sizeMessage(1, 1, 2, 9).dpr, 4);
  assert.equal(sizeMessage(1, 1, NaN, NaN).dpr, 1);
});

const plain = (v) => JSON.parse(JSON.stringify(v));

// ── the bridge as the iframe runs it, against a stub window ─────────────────────────
function boot(theme = makeTheme(RAW)) {
  const posted = [], listeners = {}, events = [], styleProps = {};
  const parent = { postMessage: (m) => posted.push(m) };
  const win = {
    parent, devicePixelRatio: 1,
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
    dispatchEvent: (e) => { events.push(e.type); },
    requestAnimationFrame: (f) => { f(); return 1; },
    Event: class { constructor(t) { this.type = t; } },
  };
  win.window = win;
  const doc = { documentElement: { style: { setProperty: (k, v) => { styleProps[k] = v; } } } };
  const ctx = vm.createContext({ ...win, document: doc, Event: win.Event, window: win, console });
  win.self = ctx;
  vm.runInContext(BRIDGE_JS.replace("__HERMES_THEME__", JSON.stringify(theme)), ctx);
  const send = (data) => listeners.message.forEach((f) => f({ source: parent, data }));
  return { ctx, posted, events, styleProps, send, parent, listeners };
}

test("bridge announces itself, exposes window.hermes and relays size + synthetic resize", () => {
  const b = boot();
  assert.deepEqual(plain(b.posted), [{ type: "hermes:ready" }]);
  const h = b.ctx.window.hermes;
  assert.equal(h.theme.scheme, "dark");
  const seen = [];
  h.onResize((s) => seen.push(s));
  b.send({ type: "hermes:size", w: 320, h: 180, dpr: 3, zoom: 1.5 });
  assert.deepEqual(plain(h.size), { w: 320, h: 180, dpr: 3, zoom: 1.5 });
  assert.equal(b.ctx.window.devicePixelRatio, 3, "canvases rasterise at the zoomed ratio");
  assert.deepEqual(plain(seen.at(-1)), plain(h.size));
  assert.ok(b.events.includes("resize"), "chart libraries listening to window resize redraw");
  assert.equal(b.styleProps["--card-w"], "320px");
});

test("bridge ignores messages that do not come from the parent", () => {
  const b = boot();
  b.listeners.message.forEach((f) => f({ source: {}, data: { type: "hermes:size", w: 1, h: 1 } }));
  assert.equal(b.ctx.window.hermes.size.w, 0);
});

test("live theme update repaints the variables and notifies listeners", () => {
  const b = boot();
  const light = makeTheme({ ...RAW, background: "rgb(250 250 247)", foreground: "rgb(20 20 20)" });
  const got = [];
  b.ctx.window.hermes.onTheme((t) => got.push(t.scheme));
  b.send({ type: "hermes:theme", theme: light });
  assert.equal(b.styleProps["--foreground"], "rgb(20 20 20)");
  assert.equal(b.styleProps["--chart-3"], light.chart[2]);
  assert.deepEqual(plain(got), ["light"]);
});

test("Chart.js defaults and palette are applied when the library appears", () => {
  const b = boot();
  const registered = [];
  const Chart = { defaults: { font: {} }, register: (p) => registered.push(p) };
  b.ctx.window.Chart = Chart;
  assert.equal(Chart.defaults.color, RAW.mutedForeground);
  assert.equal(Chart.defaults.borderColor, RAW.border);
  assert.equal(Chart.defaults.responsive, true);
  assert.equal(Chart.defaults.maintainAspectRatio, false);
  const chart = { config: { type: "line", data: { datasets: [{ data: [1] }, { data: [2], borderColor: "red" }] } } };
  registered[0].beforeUpdate(chart);
  const [a, c] = chart.config.data.datasets;
  assert.equal(a.borderColor, makeTheme(RAW).chart[0]);
  assert.match(a.backgroundColor, /^rgba\(/);
  assert.equal(c.borderColor, "red", "an explicit colour is never overridden");
});

test("ECharts gets a 'hermes' theme and uses it by default", () => {
  const b = boot();
  const themes = {};
  const inits = [];
  b.ctx.window.echarts = { registerTheme: (n, t) => { themes[n] = t; }, init: (el, th) => { inits.push(th); } };
  assert.equal(themes.hermes.backgroundColor, "transparent");
  assert.deepEqual(plain(themes.hermes.color), makeTheme(RAW).chart);
  b.ctx.window.echarts.init({}); b.ctx.window.echarts.init({}, "dark");
  assert.deepEqual(plain(inits), ["hermes", "dark"]);
});
