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

// ── chat: friendly tool labels ────────────────────────────────────────────
import { opCount, toChatRows, toolKind } from "../src/board/chatRows.ts";

test("tool names map to a kind of work; nothing raw reaches the reader", () => {
  assert.equal(toolKind("board_read"), "readBoard");
  assert.equal(toolKind("board_apply"), "editBoard");
  assert.equal(toolKind("skill_view"), "skill");
  assert.equal(toolKind("terminal"), "command");
  assert.equal(toolKind("mcp__firecrawl__firecrawl_scrape"), "web");
  assert.equal(toolKind("browser_click"), "web");
  assert.equal(toolKind("mcp__rea__something_odd"), "other");
  for (const kind of ["readBoard", "editBoard", "viewBoard", "skill", "command", "readFile", "editFile", "search", "web", "image", "plan", "memory", "delegate", "other"]) {
    assert.ok(en[`board.chat.tool.${kind}`] && es[`board.chat.tool.${kind}`], kind);
  }
  assert.match(es["board.chat.tool.editBoardN"], /dibujando \{n\} cambios/);
});

test("board_apply carries its change count (ops array or JSON string)", () => {
  assert.equal(opCount({ ops: [{}, {}, {}] }), 3);
  assert.equal(opCount(JSON.stringify({ ops: JSON.stringify([{}, {}]) })), 2);
  assert.equal(opCount({}), undefined);
  assert.equal(opCount("not json"), undefined);
});

test("a run of tool steps folds into one row with merged acts", () => {
  const rows = toChatRows([
    { role: "assistant", text: "", tool_calls: [{ function: { name: "skill_view" } }, { function: { name: "board_read" } }], row_id: 1, timestamp: 1 },
    { role: "tool", name: "tool_call", args: { calls: [{ name: "board_apply", arguments: { ops: [1, 2, 3, 4, 5, 6, 7] } }, { name: "terminal" }] }, row_id: 2 },
    { role: "tool", name: "board_apply", row_id: 3 },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].acts, [
    { kind: "skill" }, { kind: "readBoard" }, { kind: "editBoard", n: 7 }, { kind: "command" },
  ]);
  assert.deepEqual(rows[0].tools, ["skill_view", "board_read", "board_apply", "terminal"]);
});

// ── Home: rows stretch to fill a tall window ─────────────────────────────
import { fitCellHeight } from "../src/home/grid-engine.ts";

test("grid rows stretch to fill the window but never shrink or balloon", () => {
  const o = { base: 44, gap: 10, pad: 12, maxStretch: 1.6 };
  assert.equal(fitCellHeight(0, 16, o), 44); // unknown height: natural rows
  assert.equal(fitCellHeight(300, 16, o), 44); // short window: never below the base
  assert.equal(fitCellHeight(1000, 2, o), 70); // few rows: capped at 1.6x
  const h = fitCellHeight(990, 16, o); // 1080 - bar
  assert.ok(h > 44 && h <= 71);
  const used = 12 * 2 + 16 * (h + 10) - 10;
  assert.ok(Math.abs(used - 990) < 16 * 1, `fills the viewport (${used} vs 990)`);
});
