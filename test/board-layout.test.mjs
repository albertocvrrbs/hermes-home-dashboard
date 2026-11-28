import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { downstream, insertPlan, snapMove, tidyPlan } from "../src/board/layout.ts";

const cases = JSON.parse(readFileSync(new URL("./fixtures/layout-cases.json", import.meta.url), "utf8"));

test("tidy matches the shared fixtures (the Python mirror runs the same file)", () => {
  for (const c of cases.tidy) assert.deepEqual(tidyPlan(c.blocks, { fixed: c.fixed }), c.expect, c.name);
});

test("insert plans match the shared fixtures", () => {
  for (const c of cases.insert) assert.deepEqual(insertPlan(c.a, c.b, c.size, { shiftB: c.shiftB }), c.expect, c.name);
});

test("downstream matches the shared fixtures", () => {
  for (const c of cases.downstream) assert.deepEqual(downstream(c.edges, c.start, c.stop), c.expect, c.name);
});

test("tidy with wired neighbours: no tidied block ends up on a fixed one, and a second pass is a no-op", () => {
  const c = cases.tidy.find((x) => x.fixed);
  const first = tidyPlan(c.blocks, { fixed: c.fixed });
  const again = tidyPlan(c.blocks.map((b) => {
    const p = first.find((q) => q.ids[0] === b.ids[0]);
    return { ids: b.ids, rect: { ...b.rect, x: p.x, y: p.y } };
  }), { fixed: c.fixed });
  assert.deepEqual(again, first);
  for (const p of first) {
    const r = c.blocks.find((b) => b.ids[0] === p.ids[0]).rect;
    for (const f of c.fixed) assert.ok(p.x >= f.x + f.w || p.x + r.w <= f.x || p.y >= f.y + f.h || p.y + r.h <= f.y);
  }
});

test("tidy is idempotent: tidying a tidy board moves nothing", () => {
  for (const c of cases.tidy) {
    const first = tidyPlan(c.blocks);
    const again = tidyPlan(c.blocks.map((b) => {
      const p = first.find((q) => q.ids[0] === b.ids[0]);
      return { ids: b.ids, rect: { ...b.rect, x: p.x, y: p.y } };
    }));
    assert.deepEqual(again, first, c.name);
  }
});

test("tidy leaves uniform 24px gaps and no overlaps", () => {
  const blocks = cases.tidy[0].blocks;
  const out = tidyPlan(blocks);
  const rects = out.map((p) => ({ ...blocks.find((b) => b.ids[0] === p.ids[0]).rect, x: p.x, y: p.y }));
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${i} overlaps ${j}`);
  }
  const top = rects.filter((r) => r.y === 0).sort((p, q) => p.x - q.x);
  for (let i = 1; i < top.length; i++) assert.equal(top[i].x - (top[i - 1].x + top[i - 1].w), 24);
});

test("tidy of nothing is nothing", () => assert.deepEqual(tidyPlan([]), []));

test("snap: neighbour edges and centres beat the grid", () => {
  const others = [{ x: 400, y: 100, w: 200, h: 100 }];
  const s = snapMove({ x: 103, y: 311, w: 200, h: 80 }, others, { thr: 6 });
  assert.equal(103 + s.dx, 96); // no neighbour within 6px: the grid
  const near = snapMove({ x: 397, y: 250, w: 200, h: 80 }, others, { thr: 6 });
  assert.equal(near.dx, 3); // left edges line up at x=400
  assert.ok(near.guides.some((g) => g.axis === "x" && g.pos === 400));
});

test("snap: centre to centre", () => {
  const others = [{ x: 0, y: 0, w: 200, h: 100 }];
  const s = snapMove({ x: 52, y: 300, w: 100, h: 60 }, others, { thr: 6 });
  assert.equal(52 + s.dx + 50, 100); // centres share x = 100
});

test("snap falls back to the grid, and can be switched off", () => {
  const on = snapMove({ x: 101, y: 59, w: 50, h: 50 }, [], { thr: 6 });
  assert.equal(101 + on.dx, 96);
  assert.equal(59 + on.dy, 48);
  assert.deepEqual(on.guides, []);
  const off = snapMove({ x: 101, y: 59, w: 50, h: 50 }, [], { thr: 6, toGrid: false });
  assert.deepEqual([off.dx, off.dy], [0, 0]);
});

test("snap guides span both aligned rects", () => {
  const others = [{ x: 0, y: 0, w: 100, h: 100 }];
  const s = snapMove({ x: 2, y: 300, w: 100, h: 50 }, others, { thr: 6 });
  const g = s.guides.find((q) => q.axis === "x" && q.pos === 0);
  assert.ok(g);
  assert.equal(g.from, 0);
  assert.equal(g.to, 362); // the dragged rect settled on the grid at y=312
});

import { pointAtT } from "../src/board/geometry.ts";
import { applyOps, approxRect, remapIds } from "../src/board/model.ts";

test("pointAtT walks a polyline by length", () => {
  const pts = [[0, 0], [100, 0], [100, 100]];
  assert.deepEqual(pointAtT(pts, 0), [0, 0]);
  assert.deepEqual(pointAtT(pts, 0.5), [100, 0]);
  assert.deepEqual(pointAtT(pts, 0.75), [100, 50]);
  assert.deepEqual(pointAtT(pts, 1), [100, 100]);
  assert.deepEqual(pointAtT(pts, 9), [100, 100]);
});

test("an optimistic insert batch splits the connector and survives id remapping", () => {
  const doc = {
    v: 1, id: "k3x9p2qa", name: "f", parent: null, seq: 0, n: 3, session: null, seen: 0, created: 0, updated: 0,
    items: {
      a: { k: "box", x: 0, y: 0 }, b: { k: "box", x: 400, y: 0 }, l: { k: "line", a: "a", b: "b", label: "yes" },
    },
  };
  const ops = [
    { op: "add", ref: "$n", item: { k: "shape", sh: "diamond", x: 150, y: 0 } },
    { op: "set", id: "l", p: { b: "$n" } },
    { op: "add", ref: "$l2", item: { k: "line", a: "$n", b: "b" } },
  ];
  const next = applyOps(doc, ops);
  assert.equal(next.items.l.b, "$n");
  assert.equal(next.items.l.label, "yes");
  assert.equal(next.items.$l2.a, "$n");
  assert.equal(next.items.$l2.b, "b");
  const remapped = remapIds(ops, { $n: "4", $l2: "5" });
  assert.equal(remapped[1].p.b, "4");
  assert.equal(remapped[2].item.a, "4");
});

test("shapes have their own default sizes", () => {
  assert.deepEqual(approxRect({ k: "shape", sh: "diamond", x: 0, y: 0 }), { x: 0, y: 0, w: 150, h: 100 });
  assert.deepEqual(approxRect({ k: "shape", sh: "circle", x: 5, y: 6, w: 90 }), { x: 5, y: 6, w: 90, h: 72 });
  assert.deepEqual(approxRect({ k: "shape", x: 0, y: 0 }), { x: 0, y: 0, w: 160, h: 56 });
});
