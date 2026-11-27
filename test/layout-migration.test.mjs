import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { DEFAULT_LAYOUT, parseLayout } from "../src/home/layout-schema.ts";
import en from "../src/home/i18n/locales/en.ts";

const KNOWN = new Set(["ascii", "clock", "board", "notes"]);

test("saved layouts drop widget ids the registry no longer knows (the retired agent widget)", () => {
  const saved = {
    version: 1,
    widgets: [
      { id: "ascii", gx: 0, gy: 0, gw: 3, gh: 6 },
      { id: "agent", gx: 3, gy: 0, gw: 4, gh: 3 },
      { id: "notes", gx: 7, gy: 0, gw: 3, gh: 4, props: { text: "keep me" } },
    ],
  };
  const out = parseLayout(saved, KNOWN);
  assert.deepEqual(out.widgets.map((w) => w.id), ["ascii", "notes"]);
  assert.equal(out.widgets[1].props.text, "keep me");
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
