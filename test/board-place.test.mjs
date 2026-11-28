import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_SIZE, SHAPE_SIZE } from "../src/board/model.ts";
import { aspectOf, collides, estimateSize, freePlace, overlaps, placeBatch, pushPlan, resolvePlan, SHAPES, SIZES, stageAspect, stageRatio, thumbAspect } from "../src/board/place.ts";

const cases = JSON.parse(readFileSync(new URL("./fixtures/place-cases.json", import.meta.url), "utf8"));

test("size estimates match the shared fixtures (the Python mirror runs the same file)", () => {
  for (const c of cases.estimate) assert.deepEqual(estimateSize(c.item), c.expect, c.name);
});
test("free spots match the shared fixtures", () => {
  for (const c of cases.free) assert.deepEqual(freePlace(c.want, c.size, c.obstacles, { gap: c.gap, within: c.within }), c.expect, c.name);
});
test("batches match the shared fixtures", () => {
  for (const c of cases.batch) assert.deepEqual(placeBatch(c.sizes, c.want, c.obstacles), c.expect, c.name);
});
test("overlap cleanups match the shared fixtures", () => {
  for (const c of cases.resolve) assert.deepEqual(resolvePlan(c.entries), c.expect, c.name);
});
test("pushes match the shared fixtures", () => {
  for (const c of cases.push) assert.deepEqual(pushPlan(c.entries, c.grown), c.expect, c.name);
});

test("the default sizes are the model's", () => {
  assert.deepEqual(SIZES, DEFAULT_SIZE);
  assert.deepEqual(SHAPES, SHAPE_SIZE);
});

// A small deterministic generator, for the properties below.
function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const boxes = (r, n, span) => Array.from({ length: n }, () => ({ x: Math.round(r() * span), y: Math.round(r() * span), w: 60 + Math.round(r() * 300), h: 40 + Math.round(r() * 300) }));

test("a placed item never collides, whatever is around it", () => {
  const r = rng(7);
  for (let i = 0; i < 60; i++) {
    const obs = boxes(r, 1 + Math.round(r() * 40), 1500);
    const size = { w: 60 + Math.round(r() * 400), h: 40 + Math.round(r() * 500) };
    const p = freePlace({ x: Math.round(r() * 1500), y: Math.round(r() * 1500) }, size, obs);
    for (const o of obs) assert.equal(collides({ ...p, ...size }, o, 24), false, `case ${i}`);
  }
});

test("a batch never overlaps itself or the board", () => {
  const r = rng(11);
  for (let i = 0; i < 30; i++) {
    const obs = boxes(r, 12, 1200);
    const sizes = Array.from({ length: 9 }, () => ({ w: 100 + Math.round(r() * 300), h: 80 + Math.round(r() * 400) }));
    const at = placeBatch(sizes, { x: 500, y: 500 }, obs);
    const placed = at.map((p, k) => ({ ...p, ...sizes[k] }));
    for (let a = 0; a < placed.length; a++) {
      for (const o of obs) assert.equal(overlaps(placed[a], o, 0), false);
      for (let b = a + 1; b < placed.length; b++) assert.equal(overlaps(placed[a], placed[b], 0), false);
    }
  }
});

test("resolving leaves nothing overlapping (anchored cards stay put), and is idempotent", () => {
  const r = rng(3);
  for (let i = 0; i < 40; i++) {
    const entries = boxes(r, 25, 900).map((rect, k) => ({ id: "i" + String(k).padStart(2, "0"), rect, anchored: k % 7 === 0 }));
    const moves = resolvePlan(entries);
    const moved = new Map(moves.map((m) => [m.id, m]));
    const after = entries.map((e) => ({ ...e, rect: moved.has(e.id) ? { ...e.rect, x: moved.get(e.id).x, y: moved.get(e.id).y } : e.rect }));
    for (const m of moves) assert.equal(entries.find((e) => e.id === m.id).anchored, false);
    for (let a = 0; a < after.length; a++) for (let b = a + 1; b < after.length; b++) {
      if (after[a].anchored && after[b].anchored) continue; // two fixed cards are not ours to move
      assert.equal(overlaps(after[a].rect, after[b].rect), false, `case ${i}: ${after[a].id} ${after[b].id}`);
    }
    assert.deepEqual(resolvePlan(after), [], `case ${i} is stable`);
  }
});

test("a push never moves the grown card or anchored ones", () => {
  const entries = [{ id: "a", rect: { x: 0, y: 0, w: 300, h: 300 } }, { id: "b", rect: { x: 100, y: 200, w: 100, h: 100 } }, { id: "c", rect: { x: 0, y: 330, w: 100, h: 100 }, anchored: true }];
  const { moves, blocked } = pushPlan(entries, "a");
  assert.deepEqual(moves.map((m) => m.id), ["b"]);
  assert.equal(moves[0].y >= 324, true);
  assert.deepEqual(blocked, []);
});

test("media get their own shape before they load", () => {
  assert.equal(aspectOf({ k: "image" }), null);
  assert.equal(aspectOf({ k: "image", iw: 1600, ih: 900 }), 1600 / 900);
  assert.equal(stageAspect({ k: "video", video: { p: "youtube", id: "x" }, iw: 10, ih: 10 }), undefined, "providers keep the css ratio");
  assert.deepEqual(stageAspect({ k: "video", iw: 360, ih: 640 }), { aspectRatio: `${360 / 640}` });
  assert.equal(stageRatio({ k: "video", iw: 5000, ih: 100 }), 2.4);
  assert.equal(stageRatio({ k: "video", iw: 100, ih: 5000 }), 0.5);
  assert.deepEqual(thumbAspect({ k: "link", iw: 800, ih: 400 }), { aspectRatio: "800 / 400" });
  assert.equal(thumbAspect({ k: "link" }), undefined);
});

test("an image card is as tall as its picture says, caption included", () => {
  // 1600x900 at 372 wide: picture (372-14)/1.7778 = 201.4, plus chrome (8), caption padding (21)
  assert.equal(estimateSize({ k: "image", w: 372, iw: 1600, ih: 900 }).h, 230);
  assert.equal(estimateSize({ k: "image", w: 372, iw: 1600, ih: 900, cap: "x" }).h, 246);
  assert.equal(estimateSize({ k: "image", w: 372, iw: 900, ih: 1600 }).h > estimateSize({ k: "image", w: 372, iw: 1600, ih: 900 }).h, true);
});
