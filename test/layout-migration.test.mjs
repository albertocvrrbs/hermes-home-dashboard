import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { DEFAULT_LAYOUT, parseLayout } from "../src/home/layout-schema.ts";
import en from "../src/home/i18n/locales/en.ts";

const KNOWN = new Set(["ascii", "clock", "board", "notes"]);

test("the retired agent widget's slot goes to the board widget; other unknown ids are dropped", () => {
  const saved = {
    version: 1,
    widgets: [
      { id: "ascii", gx: 0, gy: 0, gw: 3, gh: 6 },
      { id: "agent", gx: 3, gy: 0, gw: 4, gh: 3, props: { scene: "x" } },
      { id: "gone", gx: 3, gy: 3, gw: 2, gh: 2 },
      { id: "notes", gx: 7, gy: 0, gw: 3, gh: 4, props: { text: "keep me" } },
    ],
  };
  const out = parseLayout(saved, KNOWN);
  assert.deepEqual(out.widgets.map((w) => [w.id, w.gx, w.gy, w.gw, w.gh]), [
    ["ascii", 0, 0, 3, 6], ["board", 3, 0, 4, 3], ["notes", 7, 0, 3, 4]]);
  assert.equal(out.widgets[1].props, undefined);
  assert.equal(out.widgets[2].props.text, "keep me");
});

test("no second board when the layout already has one", () => {
  const saved = { version: 1, widgets: [{ id: "board", gx: 0, gy: 0, gw: 4, gh: 4 }, { id: "agent", gx: 4, gy: 0, gw: 4, gh: 3 }] };
  assert.deepEqual(parseLayout(saved, KNOWN).widgets.map((w) => w.id), ["board"]);
});

test("without a registry set every valid widget is kept (server-side shape check only)", () => {
  const saved = { version: 1, widgets: [{ id: "agent", gx: 0, gy: 0, gw: 4, gh: 3 }] };
  assert.equal(parseLayout(saved).widgets.length, 1);
});

test("corrupt documents still fall back to the default layout", () => {
  assert.equal(parseLayout(null, KNOWN), DEFAULT_LAYOUT);
  assert.equal(parseLayout({ version: 9, widgets: [] }, KNOWN), DEFAULT_LAYOUT);
});

test("the agent widget and its theater are gone, code and strings", () => {
  for (const f of ["src/home/widgets/AgentWidget.tsx", "src/home/widgets/agent", "src/home/theater.ts"]) {
    assert.equal(existsSync(new URL(`../${f}`, import.meta.url)), false, f);
  }
  const stale = Object.keys(en).filter((k) => k === "widget.agent" || k.startsWith("agent.") || k.startsWith("theater."));
  assert.deepEqual(stale, []);
});
