import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyEntries, applyOps, remapIds } from "../src/board/model.ts";
import { classifyUrl, playerUrl, extractUrl } from "../src/board/urlKind.ts";
import { simplify, toStroke, fromStroke, route, samplePolyline, fitView, boundsOf } from "../src/board/geometry.ts";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

// ── op engine mirror: replays what the Python engine logged ───────────────

test("normalised server ops replay to the server's own result", () => {
  for (const [i, c] of fixture("replay.json").entries()) {
    const out = applyOps(c.before, c.ops);
    assert.deepEqual(out.items, c.after.items, `case ${i}`);
    assert.equal(out.name, c.after.name, `case ${i} name`);
  }
});

test("server inverses replay back to the previous items", () => {
  for (const [i, c] of fixture("replay.json").entries()) {
    const back = applyOps(c.after, c.inv);
    assert.deepEqual(back.items, c.before.items, `case ${i}`);
  }
});

test("applyEntries skips entries the document already has and advances seq", () => {
  const [c] = fixture("replay.json");
  const doc = { ...c.before, seq: 4 };
  const out = applyEntries(doc, [{ s: 4, t: 1, by: "h", ops: [{ op: "del", id: "3" }] }, { s: 5, t: 9, by: "h", ops: c.ops }]);
  assert.equal(out.seq, 5);
  assert.ok(out.items["3"], "entry 4 was already applied and must be skipped");
});

test("optimistic adds use their $ref as id and remap once confirmed", () => {
  const base = fixture("replay.json")[0].before;
  const local = applyOps(base, [
    { op: "add", ref: "$u1", item: { k: "card", x: 1, y: 1, text: "new" } },
    { op: "add", ref: "$u2", item: { k: "line", a: "$u1", b: "3" } },
  ]);
  assert.equal(local.items.$u1.text, "new");
  const queued = [{ op: "set", id: "$u1", p: { x: 40 } }, { op: "add", ref: "$u3", item: { k: "line", a: "$u1", b: [0, 0] } }];
  const remapped = remapIds(queued, { $u1: "q" });
  assert.equal(remapped[0].id, "q");
  assert.equal(remapped[1].item.a, "q");
  assert.equal(queued[0].id, "$u1", "input not mutated");
});

test("unknown ids never throw (stale optimistic ops)", () => {
  const base = fixture("replay.json")[0].before;
  assert.doesNotThrow(() => applyOps(base, [{ op: "set", id: "nope", p: { x: 1 } }, { op: "del", id: "nope" }]));
});

// ── URL classification: same table as the server ──────────────────────────

test("classifyUrl matches the shared fixture", () => {
  for (const [url, want] of fixture("url-cases.json")) assert.deepEqual(classifyUrl(url), want, url);
  for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "notaurl", ""]) {
    assert.equal(classifyUrl(bad), null, bad);
  }
});

test("players use privacy-friendly fixed origins built from the parsed id", () => {
  assert.equal(playerUrl({ p: "youtube", id: "dQw4w9WgXcQ" }), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
  assert.equal(playerUrl({ p: "vimeo", id: "76979871" }), "https://player.vimeo.com/video/76979871?autoplay=1&dnt=1");
  assert.equal(playerUrl({ p: "loom", id: "abc12345" }), "https://www.loom.com/embed/abc12345?autoplay=1");
  assert.equal(playerUrl({ p: "x", id: "123" }), "https://platform.twitter.com/embed/Tweet.html?id=123&dnt=true&theme=dark");
  assert.equal(playerUrl({ p: "youtube", id: "bad id\"><script>" }), null);
  assert.equal(playerUrl({ p: "evil", id: "x" }), null);
});

test("extractUrl finds a single pasted URL, ignores prose", () => {
  assert.equal(extractUrl("  https://example.com/a?b=1 \n"), "https://example.com/a?b=1");
  assert.equal(extractUrl("look at https://example.com"), null);
  assert.equal(extractUrl("javascript:alert(1)"), null);
});

// ── geometry ───────────────────────────────────────────────────────────────

test("simplify keeps the shape with far fewer points", () => {
  const pts = [];
  for (let i = 0; i <= 300; i++) pts.push([i, Math.round(Math.sin(i / 30) * 40 + (i % 2) * 0.3)]);
  const out = simplify(pts, 1.5);
  assert.ok(out.length < 40, `${out.length} points`);
  assert.deepEqual(out[0], pts[0]);
  assert.deepEqual(out.at(-1), pts.at(-1));
});

test("strokes serialise as integer pairs relative to their origin", () => {
  const { x, y, d } = toStroke([[100.4, 50.6], [110, 60], [90, 70]]);
  assert.deepEqual([x, y], [90, 51]);
  assert.match(d, /^-?\d+,-?\d+( -?\d+,-?\d+)*$/);
  assert.deepEqual(fromStroke(d).map(([a, b]) => [a + x, b + y]), [[100, 51], [110, 60], [90, 70]]);
});

test("route connects facing sides orthogonally", () => {
  const a = { x: 0, y: 0, w: 100, h: 50 };
  const b = { x: 300, y: 100, w: 100, h: 50 };
  const r = route(a, b);
  assert.deepEqual(r.points[0], [100, 25]);
  assert.deepEqual(r.points.at(-1), [300, 125]);
  assert.equal(r.dir, "r");
  for (let i = 1; i < r.points.length; i++) {
    const [p, q] = [r.points[i - 1], r.points[i]];
    assert.ok(p[0] === q[0] || p[1] === q[1], "segments are axis-aligned");
  }
  const below = route(a, { x: 0, y: 300, w: 100, h: 50 });
  assert.equal(below.dir, "d");
});

test("samplePolyline spaces dots evenly", () => {
  const dots = samplePolyline([[0, 0], [20, 0], [20, 20]], 4);
  assert.equal(dots.length, 10);
  assert.deepEqual(dots[1], [6, 0]);
});

test("fitView centres the bounds inside the viewport", () => {
  const v = fitView({ x: 0, y: 0, w: 1000, h: 500 }, { w: 1200, h: 800 }, 40);
  assert.ok(v.z > 0.9 && v.z <= 1.12);
  const bx = boundsOf([{ x: 10, y: 20, w: 5, h: 5 }, { x: -10, y: 0, w: 5, h: 5 }]);
  assert.deepEqual(bx, { x: -10, y: 0, w: 25, h: 25 });
});
