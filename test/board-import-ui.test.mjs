import assert from "node:assert/strict";
import test from "node:test";

import { applyOp, approxRect } from "../src/board/model.ts";
import en from "../src/home/i18n/locales/en.ts";
import es from "../src/home/i18n/locales/es.ts";

const doc = () => ({ v: 1, id: "abcd1234", name: "t", parent: null, seq: 0, n: 0, session: null, seen: 0, created: 0, updated: 0, items: {} });

test("a status stamp is set, replaced and cleared by plain set ops (bulk set_where replays as sets)", () => {
  const d = doc();
  applyOp(d, { op: "put", id: "1", item: { k: "box", x: 0, y: 0, title: "Station 1" } });
  applyOp(d, { op: "set", id: "1", p: { mark: "ok" } });
  assert.equal(d.items["1"].mark, "ok");
  applyOp(d, { op: "set", id: "1", p: { mark: "fail" } });
  assert.equal(d.items["1"].mark, "fail");
  applyOp(d, { op: "set", id: "1", p: { mark: null } });
  assert.equal("mark" in d.items["1"], false);
});

test("an imported pdf / model card keeps its original beside the thumbnail", () => {
  const d = doc();
  applyOp(d, { op: "put", id: "2", item: { k: "image", x: 0, y: 0, w: 320, asset: "0123456789abcdef.png", file: "fedcba9876543210.pdf", fk: "pdf", pg: 3, iw: 600, ih: 848, cap: "manual" } });
  const it = d.items["2"];
  assert.equal(it.file, "fedcba9876543210.pdf");
  assert.equal(it.fk, "pdf");
  assert.equal(it.pg, 3);
});

test("the board's size guess for a picture follows its aspect ratio (fit / minimap)", () => {
  const wide = approxRect({ k: "image", x: 0, y: 0, w: 320, iw: 1600, ih: 900 });
  const tall = approxRect({ k: "image", x: 0, y: 0, w: 320, iw: 900, ih: 1200 });
  assert.equal(wide.w, 320);
  assert.ok(tall.h > wide.h);
  assert.ok(Math.abs(wide.h - Math.round(306 * 0.5625 + 56)) <= 1);
  assert.equal(approxRect({ k: "image", x: 0, y: 0, h: 200, iw: 10, ih: 10 }).h, 200, "an explicit h wins");
});

test("every string the stamps and file buttons show exists in both languages", () => {
  for (const key of ["board.file.open", "board.file.download", "board.file.pages", "board.mark.ok", "board.mark.fail", "board.mark.wait"]) {
    assert.ok(en[key], `en ${key}`);
    assert.ok(es[key], `es ${key}`);
  }
  assert.match(en["board.file.pages"], /\{n\}/);
  assert.match(es["board.file.pages"], /\{n\}/);
});
