import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LABELS, LOD1_Z, LOD2_Z, labelScale, lodFor, lodVars } from "../src/board/lod.ts";

test("levels follow the zoom, with hysteresis around each threshold", () => {
  assert.equal(lodFor(1), 0);
  assert.equal(lodFor(0.6), 0);
  assert.equal(lodFor(LOD1_Z - 0.01), 1);
  assert.equal(lodFor(0.3), 1);
  assert.equal(lodFor(LOD2_Z - 0.01), 2);
  // already in the map view: it takes a bit more zoom to leave it
  assert.equal(lodFor(LOD1_Z + 0.02, 1), 1);
  assert.equal(lodFor(LOD1_Z + 0.06, 1), 0);
  assert.equal(lodFor(LOD1_Z + 0.02, 0), 0);
  assert.equal(lodFor(LOD2_Z + 0.01, 2), 2);
});

test("labels are untouched at 62 % and above, and never smaller on screen than their own size at the pivot", () => {
  for (const { base, floor, cap } of Object.values(LABELS)) {
    assert.equal(labelScale(1, base, floor, cap), 1);
    assert.equal(labelScale(0.62, base, floor, cap), 1);
  }
});

test("labels grow continuously as the board shrinks, and settle on their legible floor", () => {
  const { base, floor, cap } = LABELS.f;
  let prev = 1;
  for (let z = 0.62; z >= 0.2; z -= 0.01) {
    const k = labelScale(z, base, floor, cap);
    assert.ok(k >= prev - 1e-9, `monotonic at ${z}`);
    assert.ok(k - prev < 0.2, `no pop at ${z}`);
    prev = k;
  }
  for (const z of [0.3, 0.27, 0.26]) {
    const onScreen = base * z * labelScale(z, base, floor, cap);
    assert.ok(Math.abs(onScreen - floor) < 0.01, `${z}: ${onScreen}`);
  }
});

test("the scale is capped", () => {
  assert.equal(labelScale(0.05, 10, 11.5), 4.5);
  assert.equal(labelScale(0.05, 10, 11.5, 3), 3);
  for (const { cap } of Object.values(LABELS)) assert.ok(labelScale(0.02, 1, 100, cap) <= cap);
});

test("a crowded board at 27-34 % keeps every title family readable (>= 10 px on screen)", () => {
  for (const z of [0.27, 0.3, 0.34]) {
    for (const [k, { base, floor, cap }] of Object.entries(LABELS)) {
      if (k === "w") continue;
      assert.ok(base * z * labelScale(z, base, floor, cap) >= 10, `${k} at ${z}`);
    }
  }
});

test("lodVars carries the inverse zoom and one scale per family", () => {
  const v = lodVars(0.3);
  assert.equal(v["--iz"], "3.333");
  for (const k of Object.keys(LABELS)) assert.ok(Number(v[`--ls-${k}`]) >= 1);
});

test("every CSS variable the LOD stylesheet reads is one lod.ts writes", () => {
  const css = readFileSync(new URL("../src/board/board-camera.css", import.meta.url), "utf8");
  const read = new Set([...css.matchAll(/var\((--ls-\w+)/g)].map((m) => m[1]));
  const wrote = new Set(Object.keys(lodVars(0.5)));
  for (const name of read) assert.ok(wrote.has(name), `${name} is read but never set`);
});
