import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { boardPrompt, toChatRows } from "../src/board/chatRows.ts";
import { clampBox, modKey, placeBar, placeMenu, placeTip } from "../src/board/float.ts";
import { wheelIntent, wheelZoomFactor, zoomView, ZOOM_MAX, ZOOM_MIN } from "../src/board/geometry.ts";
import en from "../src/home/i18n/locales/en.ts";
import es from "../src/home/i18n/locales/es.ts";

const VIEW = { x: 0, y: 44, w: 1200, h: 700 };

// ── floating placement ─────────────────────────────────────────────────────

test("the selection bar sits above the selection and stays inside the view", () => {
  const p = placeBar({ x: 300, y: 400, w: 200, h: 100 }, { w: 320, h: 36 }, VIEW);
  assert.deepEqual(p, { x: 300, y: 350, below: false });
  // near the right edge: clamped, never past the view
  const r = placeBar({ x: 1100, y: 400, w: 80, h: 60 }, { w: 320, h: 36 }, VIEW);
  assert.equal(r.x, 1200 - 320 - 8);
});

test("the selection bar flips below when the top is covered, pins when the item fills the view", () => {
  const flip = placeBar({ x: 100, y: 60, w: 200, h: 80 }, { w: 300, h: 36 }, VIEW);
  assert.equal(flip.below, true);
  assert.equal(flip.y, 60 + 80 + 14);
  const pin = placeBar({ x: 100, y: 20, w: 400, h: 900 }, { w: 300, h: 36 }, VIEW);
  assert.equal(pin.below, false);
  assert.equal(pin.y, 44 + 8);
  assert.equal(placeBar({ x: 5000, y: 400, w: 10, h: 10 }, { w: 300, h: 36 }, VIEW), null, "off-screen selection hides the bar");
});

test("tooltips prefer the top, flip below near the top edge and clamp horizontally", () => {
  const bottomBar = placeTip({ x: 10, y: 960, w: 30, h: 28 }, { w: 90, h: 24 }, { x: 0, y: 0, w: 1600, h: 1000 });
  assert.equal(bottomBar.side, "top");
  assert.ok(bottomBar.x >= 6, "clamped at the left edge");
  const header = placeTip({ x: 1500, y: 8, w: 30, h: 30 }, { w: 180, h: 24 }, { x: 0, y: 0, w: 1600, h: 1000 });
  assert.equal(header.side, "bottom");
  assert.ok(header.x + 180 <= 1600 - 6, "clamped at the right edge");
});

test("menus open at the pointer and flip at the edges", () => {
  const b = { x: 0, y: 0, w: 1000, h: 600 };
  assert.deepEqual(placeMenu({ x: 100, y: 100 }, { w: 200, h: 300 }, b), { x: 100, y: 100 });
  assert.deepEqual(placeMenu({ x: 950, y: 500 }, { w: 200, h: 300 }, b), { x: 750, y: 200 });
  assert.deepEqual(clampBox(-40, -40, { w: 10, h: 10 }, b), { x: 8, y: 8 });
});

test("shortcut labels follow the platform", () => {
  assert.equal(modKey("MacIntel"), "⌘");
  assert.equal(modKey("Win32"), "Ctrl+");
  assert.equal(modKey("Linux x86_64"), "Ctrl+");
});

// ── chat rows ──────────────────────────────────────────────────────────────

test("transcript rows become chat rows: marker stripped, tools folded, compactions skipped", () => {
  const rows = toChatRows([
    { role: "user", text: "[board:k3x9p2qa] split this (selected: 4)", timestamp: 10, row_id: 1 },
    { role: "assistant", text: "", tool_calls: [{ function: { name: "board_read" } }], row_id: 2, timestamp: 11 },
    { role: "tool", name: "board_read", row_id: 3 },
    { role: "tool", name: "tool_describe", row_id: 31 },
    { role: "tool", name: "tool_call", args: { calls: [{ name: "board_apply", arguments: {} }] }, row_id: 4 },
    { role: "system", row_kind: "compaction", text: "summary", row_id: 5 },
    { role: "assistant", content: [{ type: "text", text: "Done: **4 cards**." }], row_id: 6, timestamp: 12 },
  ]);
  assert.deepEqual(rows.map((r) => r.role), ["user", "tool", "assistant"]);
  assert.equal(rows[0].text, "split this");
  assert.deepEqual(rows[1].tools, ["board_read", "board_apply"]);
  assert.equal(rows[2].text, "Done: **4 cards**.");
  assert.equal(rows[2].t, 12);
});

test("board prompts carry the marker and only live selected ids", () => {
  const doc = { id: "k3x9p2qa", items: { a: { k: "card" }, b: { k: "todo" } } };
  assert.equal(boardPrompt(doc, "  tidy up ", ["a", "gone", "b"], "selected"), "[board:k3x9p2qa] tidy up (selected: a, b)");
  assert.equal(boardPrompt(doc, "hello", [], "selected"), "[board:k3x9p2qa] hello");
});

// ── typography and chrome ─────────────────────────────────────────────────

const css = readFileSync(new URL("../src/board/board.css", import.meta.url), "utf8");

test("the board uses only the host's two families and embeds no fonts", () => {
  assert.ok(!/@font-face/.test(css), "no @font-face");
  assert.ok(!/woff2?|data:font/.test(css), "no embedded font data");
  for (const gone of ["Departure", "Atkinson", "Architects", "Draftsman", "Collapse"]) assert.ok(!css.includes(gone), gone);
  assert.match(css, /--sans: var\(--dt-font-sans/);
  assert.match(css, /--mono: var\(--theme-font-mono, ui-monospace, monospace\)/);
});

test("motion honours reduced motion, tooltips included", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.hb \*/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.hb-tip/);
});

test("every tool, verb and chat string exists in both languages", () => {
  for (const k of ["board.chat.open", "board.chat.close", "board.chat.placeholder", "board.chat.hintHandoff", "board.menu.askHermes",
    "board.ctx.connect", "board.hint.place", "board.undo", "board.redo"]) {
    assert.ok(en[k] && es[k], k);
  }
  assert.ok(!("board.prompt.placeholder" in en), "the old bottom prompt is gone");
});

// ── wheel → zoom ───────────────────────────────────────────────────────────

test("a classic mouse wheel zooms, a two-finger trackpad scroll pans, a pinch zooms", () => {
  assert.equal(wheelIntent({ deltaX: 0, deltaY: 100, deltaMode: 0 }), "zoom", "Chrome/Windows notch");
  assert.equal(wheelIntent({ deltaX: 0, deltaY: 83.33, deltaMode: 0, wheelDeltaY: -120 }), "zoom", "scaled display, wheelDelta 120");
  assert.equal(wheelIntent({ deltaX: 0, deltaY: 3, deltaMode: 1 }), "zoom", "Firefox line mode");
  assert.equal(wheelIntent({ deltaX: 0, deltaY: 4.5, deltaMode: 0 }), "pan", "trackpad: small fractional");
  assert.equal(wheelIntent({ deltaX: 2, deltaY: 60, deltaMode: 0 }), "pan", "trackpad: two axes");
  assert.equal(wheelIntent({ deltaX: 0, deltaY: 100, deltaMode: 0 }, true), "pan", "momentum after a trackpad gesture");
  assert.equal(wheelIntent({ deltaX: 0, deltaY: 1.2, deltaMode: 0, ctrlKey: true }), "zoom", "pinch arrives as ctrl+wheel");
});

test("wheel zoom factors: in for wheel up, out for wheel down, bounded per event", () => {
  const up = wheelZoomFactor({ deltaX: 0, deltaY: -100, deltaMode: 0 });
  const down = wheelZoomFactor({ deltaX: 0, deltaY: 100, deltaMode: 0 });
  assert.ok(up > 1.1 && up < 1.25, `notch in ${up}`);
  assert.ok(Math.abs(up * down - 1) < 1e-9, "in and out are symmetric");
  assert.equal(wheelZoomFactor({ deltaX: 0, deltaY: -3, deltaMode: 1 }), Math.exp(48 * 0.0015), "lines are 16 px");
  const spin = wheelZoomFactor({ deltaX: 0, deltaY: -5000, deltaMode: 0 });
  assert.equal(spin, Math.exp(240 * 0.0015), "one huge delta is clamped");
  assert.ok(wheelZoomFactor({ deltaX: 0, deltaY: -10, deltaMode: 0, ctrlKey: true }) > 1.09, "pinch is direct");
});

test("zooming keeps the point under the cursor fixed and clamps to the zoom range", () => {
  const v = { x: 100, y: 50, z: 1 };
  const n = zoomView(v, 1.5, 400, 300);
  const before = [(400 - v.x) / v.z, (300 - v.y) / v.z];
  const after = [(400 - n.x) / n.z, (300 - n.y) / n.z];
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9 && Math.abs(before[1] - after[1]) < 1e-9);
  assert.equal(zoomView(v, 100, 0, 0).z, ZOOM_MAX);
  assert.equal(zoomView(v, 0.001, 0, 0).z, ZOOM_MIN);
});
