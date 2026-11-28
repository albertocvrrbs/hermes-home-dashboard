import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fmtDate, setDateLocale } from "../src/home/i18n/date.ts";
import { GATEWAY_STATES, stateLabel } from "../src/home/widgets/gatewayState.ts";
import { liveMetricRows, liveHeight } from "../src/board/model.ts";
import { toBars } from "../src/home/widgets/tokenSeries.ts";
import en from "../src/home/i18n/locales/en.ts";
import es from "../src/home/i18n/locales/es.ts";

const day = new Date(2026, 10, 27, 12, 0, 0); // Friday, 27 Nov 2026

test("dates follow the plugin language, not the browser's", () => {
  setDateLocale("es");
  assert.equal(fmtDate(day, { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), "VIERNES, 27 DE NOVIEMBRE");
  setDateLocale("en");
  assert.match(fmtDate(day, { weekday: "long", day: "numeric", month: "long" }), /Friday, (November 27|27 November)/);
  setDateLocale("not a tag!!"); // Intl rejects it: falls back instead of throwing
  assert.ok(fmtDate(day, { month: "long" }).length > 2);
  setDateLocale(undefined);
});

test("token bars label days in the language passed in", () => {
  const rows = [{ day: "2026-11-27", input_tokens: 1, output_tokens: 1, estimated_cost: 0 }];
  setDateLocale("es");
  assert.match(toBars(rows, false, fmtDate)[0].label, /27 nov/);
  assert.match(toBars(rows, true, fmtDate)[0].label, /nov/);
  setDateLocale(undefined);
});

test("every raw gateway state has an en and es label (no English leaking in the Spanish UI)", () => {
  for (const s of GATEWAY_STATES) {
    assert.ok(en[`gateway.s.${s}`], `en ${s}`);
    assert.ok(es[`gateway.s.${s}`], `es ${s}`);
  }
  const t = (k) => es[k];
  assert.equal(stateLabel(t, "running"), "en ejecución");
  assert.equal(stateLabel(t, "connected"), "conectado");
  assert.equal(stateLabel(t, "startup_failed"), "falló al iniciar");
  assert.equal(stateLabel(t, "weird_new_state"), "weird_new_state");
  assert.equal(stateLabel(t, null), "—");
  assert.notEqual(es["gateway.s.running"], en["gateway.s.running"]);
});

test("live metrics grid: columns follow the count and pair up when narrow", () => {
  assert.equal(liveMetricRows(4, 400), 1);
  assert.equal(liveMetricRows(4, 360), 2);
  assert.equal(liveMetricRows(3, 400), 1);
  assert.equal(liveMetricRows(5, 520), 2);
  assert.equal(liveMetricRows(0, 400), 1);
  const card = (w) => ({ k: "live", w, blocks: [{ t: "metrics", items: [{}, {}, {}, {}] }] });
  assert.ok(liveHeight(card(300)) > liveHeight(card(480)));
});

test("live card CSS: the uppercase labels have room for the accent and metrics never ellipsize at default width", () => {
  const css = readFileSync(new URL("../src/board/board.css", import.meta.url), "utf8");
  const rule = (sel) => css.split("\n").find((l) => l.startsWith(sel)) ?? "";
  for (const sel of [".hb-live .lv-metrics .k {", ".hb-live .lv-spark .k {"]) {
    const lh = /font: 700 9px\/([\d.]+)/.exec(rule(sel));
    assert.ok(lh && Number(lh[1]) >= 1.4, `${sel} line-height ${lh && lh[1]}`);
  }
  assert.match(css, /\.hb-live \.lv-metrics\[data-n="4"\] \{ grid-template-columns: repeat\(4/);
});

test("the live card's default width is 400 everywhere", () => {
  const py = readFileSync(new URL("../dashboard/boardkit/engine.py", import.meta.url), "utf8");
  const ts = readFileSync(new URL("../src/board/model.ts", import.meta.url), "utf8");
  assert.match(py, /"live": \(400, 300\)/);
  assert.match(ts, /live: \[400, 300\]/);
});
