import assert from "node:assert/strict";
import test from "node:test";

import { applyOp, approxRect, DEFAULT_SIZE } from "../src/board/model.ts";
import { RESIZE_H } from "../src/board/geometry.ts";
import { groupsOf } from "../src/board/syncClock.ts";

const doc = () => ({ v: 1, id: "abcd1234", name: "t", parent: null, seq: 0, n: 0, session: null, seen: 0, created: 0, updated: 0, items: {} });

test("comp cards have a default size, resize like embeds and keep their fields", () => {
  assert.deepEqual(DEFAULT_SIZE.comp, [480, 320]);
  assert.ok(RESIZE_H.has("comp"));
  const d = doc();
  applyOp(d, { op: "put", id: "0", item: { k: "comp", comp: "spark", x: 10, y: 20, cdata: { a: [1] }, files: { "t.json": { n: 5, r: 1 } }, sync: "s1" } });
  assert.deepEqual(approxRect(d.items["0"]), { x: 10, y: 20, w: 480, h: 320 });
  assert.equal(d.items["0"].files["t.json"].r, 1);
});

test("data, version pin and sync updates replay as plain sets", () => {
  const d = doc();
  applyOp(d, { op: "put", id: "0", item: { k: "comp", comp: "spark", x: 0, y: 0 } });
  applyOp(d, { op: "put", id: "1", item: { k: "video", asset: "a.webm", x: 0, y: 400, sync: "s1" } });
  applyOp(d, { op: "set", id: "0", p: { cdata: { series: [1, 2] }, at: 7, ver: "v2", sync: "s1" } });
  assert.deepEqual(d.items["0"].cdata, { series: [1, 2] });
  assert.equal(d.items["0"].ver, "v2");
  assert.deepEqual(groupsOf(d.items), ["s1"]);
  applyOp(d, { op: "set", id: "0", p: { ver: null, sync: null } });
  assert.equal(d.items["0"].ver, undefined);
  assert.equal(d.items["0"].sync, undefined);
  assert.deepEqual(groupsOf(d.items), ["s1"]);
});

test("sub-board cards take a height and their preview grows with the card", async () => {
  const { RESIZE_H: R, boardPreviewH } = await import("../src/board/geometry.ts");
  assert.ok(R.has("board"));
  assert.equal(boardPreviewH(212), 110);
  assert.ok(boardPreviewH(1200) > 600);
});
