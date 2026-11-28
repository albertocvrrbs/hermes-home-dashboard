// Every way the UI adds content goes through the collision-free placement (place.ts), and the
// Resolve overlaps action is wired (icon, both languages, menu and toolbar).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const view = read("board/BoardView.tsx");

test("content adds carry a measured free spot and are sent exact", () => {
  // the one generic add: spotFor() picks the spot, `exact` tells the server to keep it
  assert.match(view, /MOVABLE\.has\(item\.k\) \? spotFor\(item, p\)/);
  assert.match(view, /commit\(\[\{ op: "add", ref, item: placed, exact: true \}\]\)/);
  // every other content add in the view is exact too (lines, strokes and column kids aside)
  const adds = view.match(/\{ op: "add", ref[^\n]*/g) ?? [];
  for (const a of adds) {
    if (/k: "line"|k: "draw"|item \}\]\)|in: col/.test(a)) continue;
    assert.match(a, /exact: true/, a);
  }
});

test("uploads and pastes no longer step by a fixed offset onto each other", () => {
  assert.doesNotMatch(view, /p = \{ x: p\.x \+ 24, y: p\.y \+ 24 \}/);
});

test("a card that grows pushes its new neighbours, and Resolve overlaps is in the menus", () => {
  assert.match(view, /pushPlan\(entries, g\)/);
  assert.match(view, /resolvePlan\(entries\)/);
  assert.match(view, /id: "unoverlap", label: t\("board\.resolve"\), icon: "unoverlap"/);
  assert.match(view, /data-tip=\{selIds\.length > 1 \? t\("board\.resolve\.selection"\) : t\("board\.resolve"\)\}/);
  assert.match(read("board/icons.tsx"), /unoverlap: SquaresExclude/);
  for (const loc of ["en", "es"]) {
    const s = read(`home/i18n/locales/${loc}.ts`);
    for (const k of ["board.resolve", "board.resolve.selection", "board.resolve.none", "board.push"]) assert.match(s, new RegExp(`"${k.replace(/\./g, "\\.")}":`), `${loc} ${k}`);
  }
});
