import assert from "node:assert/strict";
import test from "node:test";

import { applyOps, normalizeDeletes } from "../src/board/model.ts";

// Synthetic board: two columns with kids, a free box, grouped strokes, connectors on everything.
const doc = () => ({
  id: "k3x9p2qa", name: "T", seq: 1, n: 20, updated: 0,
  items: {
    c1: { k: "col", x: 0, y: 0, kids: ["k1", "k2"] },
    c2: { k: "col", x: 400, y: 0, kids: ["k3"] },
    k1: { k: "card", in: "c1", text: "one" },
    k2: { k: "card", in: "c1", text: "two" },
    k3: { k: "card", in: "c2", text: "three" },
    b: { k: "box", x: 0, y: 500 },
    s1: { k: "draw", x: 1, y: 1, g: "g1" },
    s2: { k: "draw", x: 9, y: 1, g: "g1" },
    l1: { k: "line", a: "c1", b: "b" },
    l2: { k: "line", a: "k3", b: "b" },
    l3: { k: "line", a: "k1", b: "k3" },
    l4: { k: "line", a: "s1", b: "s2" },
  },
});

test("select-all delete drops kids of selected columns and connectors on removed items", () => {
  const d = doc();
  assert.deepEqual(normalizeDeletes(d, Object.keys(d.items)), ["c1", "c2", "b", "s1", "s2"]);
});

test("a kid alone keeps its own connectors out of the batch only when an endpoint is removed", () => {
  const d = doc();
  assert.deepEqual(normalizeDeletes(d, ["k1", "l3", "l1"]), ["k1", "l1"]);
  assert.deepEqual(normalizeDeletes(d, ["l1", "l4", "ghost", "l1"]), ["l1", "l4"]);
});

test("applyOp del is idempotent: cascaded and repeated ids are no-ops, in any order", () => {
  const d = doc();
  const ids = Object.keys(d.items);
  for (const order of [ids, [...ids].reverse()]) {
    const out = applyOps(d, order.map((id) => ({ op: "del", id })));
    assert.deepEqual(out.items, {});
  }
  const some = applyOps(d, [{ op: "del", id: "c1" }, { op: "del", id: "k1" }, { op: "del", id: "c1" }]);
  assert.deepEqual(Object.keys(some.items).sort(), ["b", "c2", "k3", "l2", "l4", "s1", "s2"]);
  assert.deepEqual(some.items.c2.kids, ["k3"]);
});
