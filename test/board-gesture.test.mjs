import assert from "node:assert/strict";
import test from "node:test";
import {
  DBL_MS, dblAction, isTap, mapCaret, nextTap, pointerKind, typeToEditChar,
} from "../src/board/gesture.ts";

const tap = (t, x = 100, y = 100, type = "mouse") => ({ t, x, y, type });

test("two quick taps close together are a double; a third starts over", () => {
  let r = nextTap(null, tap(0));
  assert.equal(r.double, false);
  r = nextTap(r.last, tap(200, 102, 99));
  assert.equal(r.double, true);
  assert.equal(r.last, null);
  r = nextTap(r.last, tap(300));
  assert.equal(r.double, false);
});

test("too slow or too far is not a double", () => {
  const a = tap(0);
  assert.equal(nextTap(a, tap(DBL_MS.mouse + 1)).double, false);
  assert.equal(nextTap(a, tap(100, 140, 100)).double, false);
});

test("touch tolerates more distance and time than the mouse", () => {
  const a = tap(0, 100, 100, "touch");
  assert.equal(nextTap(a, tap(450, 120, 110, "touch")).double, true);
  assert.equal(nextTap(tap(0), tap(450, 120, 110)).double, false);
});

test("mouse and touch taps never pair", () => {
  assert.equal(nextTap(tap(0, 1, 1, "mouse"), tap(100, 1, 1, "touch")).double, false);
});

test("a press that moved or lingered is not a tap", () => {
  assert.equal(isTap(tap(0), tap(120, 101, 101)), true);
  assert.equal(isTap(tap(0), tap(120, 110, 100)), false);
  assert.equal(isTap(tap(0), tap(900)), false);
  assert.equal(isTap(tap(0, 0, 0, "touch"), tap(100, 8, 0, "touch")), true);
});

test("pointer types map to mouse / pen / touch", () => {
  assert.equal(pointerKind("touch"), "touch");
  assert.equal(pointerKind("pen"), "pen");
  assert.equal(pointerKind("mouse"), "mouse");
  assert.equal(pointerKind(undefined), "mouse");
});

test("double click resolves by what is under the pointer", () => {
  const base = { tool: "select" };
  assert.equal(dblAction({ ...base, kind: null }), "new");
  assert.equal(dblAction({ ...base, kind: "card" }), "edit");
  assert.equal(dblAction({ ...base, kind: "todo" }), "edit");
  assert.equal(dblAction({ ...base, kind: "col" }), "edit");
  assert.equal(dblAction({ ...base, kind: "link" }), "edit");
  assert.equal(dblAction({ ...base, kind: "video" }), "edit");
  assert.equal(dblAction({ ...base, kind: "image" }), "edit");
  assert.equal(dblAction({ ...base, kind: "shape" }), "edit");
  assert.equal(dblAction({ ...base, kind: "board" }), "open");
  assert.equal(dblAction({ ...base, kind: "live" }), "none");
  assert.equal(dblAction({ ...base, kind: "embed" }), "none");
  assert.equal(dblAction({ ...base, kind: null, wire: true }), "label");
});

test("a double click on a card never creates a note; chrome and the draw tool are inert", () => {
  assert.notEqual(dblAction({ tool: "select", kind: "card" }), "new");
  assert.equal(dblAction({ tool: "select", kind: null, chrome: true }), "none");
  assert.equal(dblAction({ tool: "draw", kind: null }), "none");
});

test("type-to-edit: printable keys on text-like items only", () => {
  assert.equal(typeToEditChar({ key: "a" }, "card"), "a");
  assert.equal(typeToEditChar({ key: "É" }, "text"), "É");
  assert.equal(typeToEditChar({ key: "1" }, "shape"), "1");
  assert.equal(typeToEditChar({ key: "a" }, "image"), null);
  assert.equal(typeToEditChar({ key: "a" }, undefined), null);
  assert.equal(typeToEditChar({ key: "a", metaKey: true }, "card"), null);
  assert.equal(typeToEditChar({ key: "a", ctrlKey: true }, "card"), null);
  assert.equal(typeToEditChar({ key: "Enter" }, "card"), null);
  assert.equal(typeToEditChar({ key: "ArrowUp" }, "card"), null);
  assert.equal(typeToEditChar({ key: " " }, "card"), null);
});

test("caret mapping: identical text is exact", () => {
  assert.equal(mapCaret("hello world", 5, "hello world"), 5);
  assert.equal(mapCaret("hello", 99, "hello"), 5);
  assert.equal(mapCaret("hello", -3, "hello"), 0);
});

test("caret mapping survives hidden markdown markers", () => {
  const source = "a **bold** word and more";
  const rendered = "a bold word and more";
  // caret right after "bold word" in the rendered text
  const at = mapCaret(rendered, "a bold word".length, source);
  assert.equal(source.slice(0, at), "a **bold** word");
  assert.equal(mapCaret(rendered, 0, source), 0);
  assert.equal(mapCaret(rendered, rendered.length, source), source.length);
});

test("caret mapping falls back to proportion when context is ambiguous", () => {
  const at = mapCaret("xx xx xx", 4, "xx  xx  xx");
  assert.ok(at > 0 && at < 10);
});
