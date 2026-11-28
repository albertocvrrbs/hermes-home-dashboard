// The board scales like a plain canvas: no level-of-detail code, class, attribute or stylesheet rule.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../src/board/${f}`, import.meta.url), "utf8");

test("no LOD module or thumbnail swap exists", () => {
  assert.equal(existsSync(new URL("../src/board/lod.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/board/thumbs.ts", import.meta.url)), false);
});

test("nothing sets or styles a data-lod level or counter-scale variable", () => {
  for (const f of ["BoardView.tsx", "miniboard.tsx", "items.tsx", "board.css", "board-camera.css"]) {
    const src = read(f);
    assert.doesNotMatch(src, /data-lod|dataset\.lod|applyLod|--ls-/, f);
  }
});
