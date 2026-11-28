import assert from "node:assert/strict";
import test from "node:test";

import { arrivingOpacity, fromPage, leavingOpacity, matchTransform, toPage } from "../src/board/transition.ts";

const draw = (v, p) => [v.z * p[0] + v.x, v.z * p[1] + v.y];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("matchTransform maps every point from where view A draws it to where view B does", () => {
  const A = { z: 0.18, x: 340, y: 120 }, B = { z: 1.1, x: -60, y: 45 };
  const t = matchTransform(A, B);
  for (const p of [[0, 0], [500, -200], [-90, 1234]]) {
    const [ax, ay] = draw(A, p), [bx, by] = draw(B, p);
    near(t.k * ax + t.tx, bx); near(t.k * ay + t.ty, by);
  }
});

test("identity when the views agree", () => {
  const v = { z: 0.7, x: 12, y: -4 };
  const t = matchTransform(v, v);
  near(t.k, 1); near(t.tx, 0); near(t.ty, 0);
});

test("page coordinate round trip", () => {
  const o = { left: 72, top: 44 }, v = { z: 0.5, x: 10, y: 20 };
  assert.deepEqual(fromPage(toPage(v, o), o), v);
});

test("the leaving page holds then dissolves, the arriving page comes up; both are visible in the middle", () => {
  assert.equal(leavingOpacity(0), 1);
  assert.equal(leavingOpacity(1), 0);
  assert.equal(arrivingOpacity(0), 0);
  assert.equal(arrivingOpacity(1), 1);
  assert.ok(leavingOpacity(0.5) > 0 && arrivingOpacity(0.5) > 0);
  let a = 1, b = 0;
  for (let u = 0; u <= 1; u += 0.02) {
    assert.ok(leavingOpacity(u) <= a + 1e-9 && arrivingOpacity(u) >= b - 1e-9);
    a = leavingOpacity(u); b = arrivingOpacity(u);
  }
});
