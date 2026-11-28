import assert from "node:assert/strict";
import test from "node:test";

import {
  bayerDither, bayerMatrix, brailleToBits, coverage, dotRank, EMBLEM_IDS, emblemFromProps, fitBox, fitGrid,
  floydSteinberg, stepEmblem, trimBits,
} from "../src/home/widgets/ascii-presentation.ts";

test("the official caduceus stays the default and first design", () => {
  assert.equal(EMBLEM_IDS[0], "caduceus");
  assert.equal(emblemFromProps({}), "caduceus");
  assert.equal(new Set(EMBLEM_IDS).size, EMBLEM_IDS.length);
});

test("legacy artIndex maps onto the new set; art ids win", () => {
  assert.equal(emblemFromProps({ artIndex: 0 }), "caduceus");
  assert.equal(emblemFromProps({ artIndex: 1 }), "petasos"); // was the pyramid
  assert.equal(emblemFromProps({ artIndex: 2 }), "drachma"); // was the diamond
  assert.equal(emblemFromProps({ artIndex: 5 }), "drachma"); // old code wrapped modulo 3
  assert.equal(emblemFromProps({ artIndex: -1 }), "drachma");
  assert.equal(emblemFromProps({ artIndex: 1, art: "lyre" }), "lyre");
  assert.equal(emblemFromProps({ art: "pyramid" }), "caduceus");
  assert.equal(emblemFromProps({ artIndex: Number.NaN }), "caduceus");
});

test("stepping writes the id, drops the legacy index and wraps both ways", () => {
  const next = stepEmblem({ artIndex: 0, other: 1 }, 1);
  assert.deepEqual(next, { other: 1, art: EMBLEM_IDS[1] });
  assert.equal(stepEmblem({}, -1).art, EMBLEM_IDS[EMBLEM_IDS.length - 1]);
  assert.equal(stepEmblem({ art: EMBLEM_IDS[EMBLEM_IDS.length - 1] }, 1).art, "caduceus");
});

test("fitGrid: square pitch in whole device pixels, centred, clamped", () => {
  const g = fitGrid(244, 200, 1);
  assert.equal(g.pitch, 3); // 200 / 72 → 2.8 → clamped to the 2.8 css minimum, rounded
  assert.equal(g.cols, Math.floor(244 / 3));
  assert.equal(g.rows, Math.floor(200 / 3));
  assert.equal(g.ox, Math.floor((244 - g.cols * 3) / 2));
  const hi = fitGrid(244, 200, 2);
  assert.ok(Number.isInteger(hi.pitch) && hi.pitch >= 5 && hi.pitch <= 9);
  // big widgets gain dots, not fat dots: pitch is capped at 4.2 css px
  const big = fitGrid(900, 800, 1);
  assert.equal(big.pitch, 4);
  assert.ok(big.rows > 190);
});

test("fitGrid with a fixed bitmap: pitch grows with the slot, never under 2", () => {
  assert.deepEqual(fitGrid(240, 200, 1, { cols: 58, rows: 62 }), { pitch: 3, cols: 58, rows: 62, ox: 33, oy: 7 });
  assert.equal(fitGrid(600, 600, 1, { cols: 58, rows: 62 }).pitch, 9);
  assert.equal(fitGrid(20, 20, 1, { cols: 58, rows: 62 }).pitch, 2);
});

test("fitBox keeps the design's proportions inside the grid", () => {
  const b = fitBox(100, 50, 80, 80, 1);
  assert.equal(b.s, 0.78); // limited by width: 78 dots / 100 units
  assert.equal(b.x, 1);
  assert.equal(b.y, (80 - 39) / 2);
  const tall = fitBox(50, 100, 80, 40, 0);
  assert.equal(tall.s, 0.4);
  assert.equal(tall.x, (80 - 20) / 2);
});

test("braille decodes to a square dot bitmap: 2 dots across, 4 down per character", () => {
  const full = brailleToBits("⣿");
  assert.equal(full.cols, 2);
  assert.equal(full.rows, 4);
  assert.deepEqual([...full.bits], [1, 1, 1, 1, 1, 1, 1, 1]);
  // dot 1 (top-left) and dot 8 (bottom-right)
  const corners = brailleToBits(String.fromCodePoint(0x2800 + 0x01 + 0x80));
  assert.deepEqual([...corners.bits], [1, 0, 0, 0, 0, 0, 0, 1]);
  // dot 4 (top-right) and dot 7 (bottom-left)
  const other = brailleToBits(String.fromCodePoint(0x2800 + 0x08 + 0x40));
  assert.deepEqual([...other.bits], [0, 1, 0, 0, 0, 0, 1, 0]);
  // blanks, spaces and newlines
  const two = brailleToBits("⠀⠁\n⠈");
  assert.equal(two.cols, 4);
  assert.equal(two.rows, 8);
  assert.equal(two.bits.reduce((a, b) => a + b, 0), 2);
});

test("trimBits crops to the ink", () => {
  const t = trimBits(brailleToBits("⠀⠀⠀\n⠀⠁⠀"));
  assert.deepEqual(t, { cols: 1, rows: 1, bits: Uint8Array.from([1]) });
  assert.equal(trimBits(brailleToBits("⠀")).cols, 0);
});

test("Floyd–Steinberg preserves mean ink and keeps flats flat", () => {
  const n = 40 * 40;
  for (const level of [0.25, 0.5, 0.75]) {
    const out = floydSteinberg(new Float32Array(n).fill(level), 40, 40);
    const mean = out.reduce((a, b) => a + b, 0) / n;
    assert.ok(Math.abs(mean - level) < 0.02, `level ${level} → ${mean}`);
  }
  assert.equal(floydSteinberg(new Float32Array(n).fill(1), 40, 40).reduce((a, b) => a + b, 0), n);
  assert.equal(floydSteinberg(new Float32Array(n), 40, 40).reduce((a, b) => a + b, 0), 0);
});

test("Bayer: the 4×4 matrix is a permutation of 0..15 and dithers to the right density", () => {
  const m = bayerMatrix(2);
  assert.deepEqual(m.flat().sort((a, b) => a - b), [...Array(16).keys()]);
  assert.deepEqual(m[0], [0, 8, 2, 10]);
  const out = bayerDither(new Float32Array(16 * 16).fill(0.5), 16, 16);
  assert.equal(out.reduce((a, b) => a + b, 0), 128);
});

test("coverage box-averages luma × alpha per dot", () => {
  // 2×1 dots at 2× supersampling: left dot fully white, right dot half white
  const W = 4, H = 2;
  const px = new Uint8ClampedArray(W * H * 4);
  const set = (x, y, v) => { const p = (y * W + x) * 4; px[p] = px[p + 1] = px[p + 2] = v; px[p + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, x < 2 ? 255 : (x === 2 ? 255 : 0));
  const c = coverage(px, 2, 1, 2);
  assert.ok(Math.abs(c[0] - 1) < 1e-6);
  assert.ok(Math.abs(c[1] - 0.5) < 1e-6);
});

test("dotRank is stable and spread over [0, 1)", () => {
  assert.equal(dotRank(7), dotRank(7));
  const r = Array.from({ length: 2000 }, (_, i) => dotRank(i));
  assert.ok(r.every((v) => v >= 0 && v < 1));
  const low = r.filter((v) => v < 0.5).length;
  assert.ok(low > 900 && low < 1100);
});
