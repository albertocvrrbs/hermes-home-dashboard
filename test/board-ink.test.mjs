import assert from "node:assert/strict";
import test from "node:test";

import {
  catmullRom, DEFAULT_INK, eraseHits, euroFor, expandGroups, finishStroke, freehandOutline, inkGeometry, inkWidth,
  itemPolyline, lassoHits, OneEuro2D, outlinePath, parseInk, parsePressure, pointInPolygon, pressureDigits,
  shapePoints, simplify, stepWidth, strokeHit, MAX_POINTS,
} from "../src/board/ink.ts";

// deterministic noise
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const meanDev = (pts, f) => pts.reduce((a, p) => a + Math.abs(f(p)), 0) / pts.length;

test("settings: defaults, robust parsing, width presets and [ ] stepping", () => {
  assert.deepEqual(parseInk(null), DEFAULT_INK);
  assert.deepEqual(parseInk("{not json"), DEFAULT_INK);
  const s = parseInk(JSON.stringify({ tool: "rect", w: { pen: 2, hl: 9 }, c: "clay", ds: true, sm: 2 }));
  assert.deepEqual(s, { tool: "rect", w: { pen: 2, hl: 1 }, c: "clay", ds: true, sm: 2 });
  assert.equal(parseInk(JSON.stringify({ tool: "laser", c: "#f00", sm: 7 })).tool, "pen");
  assert.equal(inkWidth(s), 6);
  assert.equal(inkWidth({ ...s, tool: "hl" }), 16);
  assert.equal(stepWidth(s, 1).w.pen, 2); // clamped
  assert.equal(stepWidth(s, -1).w.pen, 1);
  assert.equal(stepWidth({ ...s, tool: "hl" }, 1).w.hl, 2);
});

test("One Euro: removes jitter on a slow stroke", () => {
  const r = rng(7);
  const f = new OneEuro2D(euroFor("mouse", 1));
  const raw = [], out = [];
  for (let i = 0; i < 240; i++) {
    const t = i * 8; // 125 Hz mouse
    const p = [i * 0.4 + (r() - 0.5) * 3, 100 + (r() - 0.5) * 3]; // 50 px/s with ±1.5 px jitter
    raw.push(p);
    out.push(f.filter(p[0], p[1], t));
  }
  const tail = (a) => a.slice(40);
  const devRaw = meanDev(tail(raw), (p) => p[1] - 100);
  const devOut = meanDev(tail(out), (p) => p[1] - 100);
  assert.ok(devOut < devRaw * 0.35, `jitter ${devRaw.toFixed(2)} → ${devOut.toFixed(2)}`);
});

test("One Euro: barely lags on a fast stroke", () => {
  const f = new OneEuro2D(euroFor("mouse", 1));
  let last;
  for (let i = 0; i <= 60; i++) last = f.filter(i * 16, 0, i * 8); // 2000 px/s
  const lag = 60 * 16 - last[0];
  assert.ok(lag < 20, `lag ${lag.toFixed(1)} px at 2000 px/s`);
  // a slow drift lags only a few px
  const g = new OneEuro2D(euroFor("mouse", 1));
  let p;
  for (let i = 0; i <= 120; i++) p = g.filter(i * 0.8, 0, i * 8); // 100 px/s
  assert.ok(96 - p[0] < 8, `slow lag ${(96 - p[0]).toFixed(1)}`);
});

test("One Euro strength by device: mouse strongest, pen minimal, off = raw", () => {
  const m = euroFor("mouse", 1), t = euroFor("touch", 1), pn = euroFor("pen", 1);
  assert.ok(m.minCutoff < t.minCutoff && t.minCutoff < pn.minCutoff);
  assert.ok(euroFor("mouse", 2).minCutoff < m.minCutoff);
  assert.equal(euroFor("mouse", 0), null);
  const f = new OneEuro2D(m);
  assert.deepEqual(f.filter(3, 4, 0), [3, 4]); // first sample passes through
});

test("simplify drops collinear points and keeps corners", () => {
  const line = Array.from({ length: 50 }, (_, i) => [i, 0]);
  assert.deepEqual(simplify(line, 0.5), [[0, 0], [49, 0]]);
  const corner = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]];
  assert.deepEqual(simplify(corner, 0.5), [[0, 0], [10, 0], [10, 10]]);
});

test("Catmull-Rom passes through the control points and fills between them", () => {
  const pts = [[0, 0], [20, 10], [40, 0], [60, 10]];
  const out = catmullRom(pts, 2);
  assert.deepEqual(out[0], [0, 0]);
  for (const p of pts.slice(1)) assert.ok(out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6));
  assert.ok(out.length > 25);
});

test("finishing a noisy mouse stroke: integer, compact, smooth, ends where released", () => {
  const r = rng(3);
  const pts = [];
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    pts.push([t * 300 + (r() - 0.5) * 1.2, Math.sin(t * Math.PI * 2) * 60 + (r() - 0.5) * 1.2]);
  }
  const out = finishStroke(pts, 1, "mouse", 1);
  assert.ok(out.length < 120 && out.length > 6, `points ${out.length}`);
  assert.ok(out.every((p) => Number.isInteger(p[0]) && Number.isInteger(p[1])));
  assert.deepEqual(out[out.length - 1], [Math.round(pts[400][0]), Math.round(pts[400][1])]);
  // stays on the curve
  const err = meanDev(out, (p) => p[1] - Math.sin((p[0] / 300) * Math.PI * 2) * 60);
  assert.ok(err < 2, `off-curve ${err.toFixed(2)}`);
});

test("finishing is zoom-aware and never exceeds the server's point cap", () => {
  const zig = Array.from({ length: 3000 }, (_, i) => [i * 2, (i % 2) * 6]);
  assert.ok(finishStroke(zig, 1, "mouse", 1).length <= MAX_POINTS);
  const wiggle = Array.from({ length: 200 }, (_, i) => [i, Math.sin(i / 3) * 1.2]);
  // zoomed out, a 1.2-unit wiggle is under a screen px: it goes; zoomed in it is kept
  assert.ok(finishStroke(wiggle, 0.25, "mouse", 1).length < finishStroke(wiggle, 2.4, "mouse", 1).length);
});

test("pressure digits follow the stroke and vanish when constant", () => {
  const raw = [[0, 0], [50, 0], [100, 0]];
  assert.equal(pressureDigits(raw, [0.5, 0.5, 0.5], raw), undefined);
  assert.equal(pressureDigits(raw, [0, 0.5, 1], [[0, 0], [25, 0], [100, 0]]), "029");
  assert.deepEqual(parsePressure("09", 2), [0, 1]);
  assert.equal(parsePressure("0a", 2), undefined);
  assert.equal(parsePressure("09", 3).length, 3);
});

test("shape constraints: Shift snaps to 45° and squares; Alt draws from the centre", () => {
  assert.deepEqual(shapePoints("rect", [0, 0], [30, 10]), [[0, 0], [30, 10]]);
  assert.deepEqual(shapePoints("rect", [0, 0], [30, -10], { shift: true }), [[0, 0], [30, -30]]);
  assert.deepEqual(shapePoints("ellipse", [10, 10], [20, 14], { alt: true }), [[0, 6], [20, 14]]);
  const [, b] = shapePoints("line", [0, 0], [100, 8], { shift: true });
  assert.ok(Math.abs(b[0] - Math.hypot(100, 8)) < 0.01 && b[1] === 0);
  const [, d] = shapePoints("arrow", [0, 0], [50, 47], { shift: true });
  assert.ok(Math.abs(d[0] - d[1]) < 0.01);
});

test("tapered outline: closed, thin at the ends, wide in the middle, pressure-aware", () => {
  const pts = Array.from({ length: 30 }, (_, i) => [i * 5, 0]);
  const poly = freehandOutline(pts, 6);
  const widthAt = (x) => {
    const ys = poly.filter((p) => Math.abs(p[0] - x) < 0.01).map((p) => p[1]);
    return Math.max(...ys) - Math.min(...ys);
  };
  assert.ok(widthAt(75) > widthAt(0) * 2);
  assert.ok(Math.abs(widthAt(75) - 6) < 0.3);
  const heavy = freehandOutline(pts, 6, pts.map(() => 1));
  const light = freehandOutline(pts, 6, pts.map(() => 0.1));
  const span = (pl) => Math.max(...pl.map((p) => p[1])) - Math.min(...pl.map((p) => p[1]));
  assert.ok(span(heavy) > span(light) * 2);
  assert.match(outlinePath(poly), /^M.*Z$/);
});

test("hit tests: eraser touches strokes and shapes by their ink, not their box", () => {
  const items = {
    a: { k: "draw", x: 0, y: 0, d: "0,0 100,0", sw: 2 },
    r: { k: "draw", x: 200, y: 0, d: "0,0 100,100", tl: "rect", sw: 2 },
    e: { k: "draw", x: 0, y: 200, d: "0,0 100,100", tl: "ellipse", sw: 2 },
    c: { k: "card", x: 0, y: 0 },
  };
  assert.deepEqual(eraseHits(items, [50, 4], 3), ["a"]);
  assert.deepEqual(eraseHits(items, [50, 9], 3), []);
  assert.deepEqual(eraseHits(items, [250, 50], 5), []); // inside the rectangle, off its outline
  assert.deepEqual(eraseHits(items, [300, 50], 3), ["r"]);
  assert.ok(strokeHit(items.e, [100, 250], 3));
  assert.ok(!strokeHit(items.e, [50, 250], 3));
  assert.equal(itemPolyline(items.r).length, 5);
});

test("lasso picks strokes mostly inside the loop, and groups come along", () => {
  const items = {
    in: { k: "draw", x: 10, y: 10, d: "0,0 20,20", g: "g1" },
    sib: { k: "draw", x: 500, y: 500, d: "0,0 5,5", g: "g1" },
    half: { k: "draw", x: 80, y: 50, d: "0,0 40,0 80,0" },
    out: { k: "draw", x: 300, y: 300, d: "0,0 5,5" },
  };
  const loop = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.ok(pointInPolygon([50, 50], loop) && !pointInPolygon([150, 50], loop));
  const hits = lassoHits(items, loop);
  assert.deepEqual(hits.sort(), ["in"]);
  assert.deepEqual([...expandGroups(items, hits)].sort(), ["in", "sib"]);
});

test("geometry per kind: arrows get a head, smooth pens a filled outline, dashes stay strokes", () => {
  const sp = (pts) => `M${pts.map((p) => p.join(" ")).join(" L")}`;
  const arrow = inkGeometry({ k: "draw", x: 0, y: 0, d: "0,0 50,0", tl: "arrow", sw: 2 }, sp);
  assert.equal(arrow.paths.length, 2);
  const smooth = inkGeometry({ k: "draw", x: 0, y: 0, d: "0,0 30,10 60,0", sm: true, sw: 2 }, sp);
  assert.equal(smooth.paths[0].fill, true);
  const dashed = inkGeometry({ k: "draw", x: 0, y: 0, d: "0,0 30,10 60,0", sm: true, ds: true, sw: 2 }, sp);
  assert.deepEqual([dashed.paths[0].fill, dashed.paths[0].dashed], [false, true]);
  const hl = inkGeometry({ k: "draw", x: 0, y: 0, d: "0,0 30,0", tl: "hl", sm: true, sw: 16 }, sp);
  assert.equal(hl.paths[0].fill, false);
  assert.ok(hl.box.x <= -16 && hl.box.w >= 30 + 32);
  assert.equal(inkGeometry({ k: "draw", d: "" }, sp), null);
});
