import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asStatus, fmtDelta, fmtDuration, fmtValue, freshness, isBinding, labelKey, mediaRef, progressOf, resolve,
  shortAge, sparkPaths, tailLines,
} from "../src/board/live.ts";
import { applyOps, approxRect, liveHeight } from "../src/board/model.ts";
import en from "../src/home/i18n/locales/en.ts";
import es from "../src/home/i18n/locales/es.ts";

const data = { status: "running", success: 81.4, hist: [70, 75, 81.4], log: "a\nb\nc\n", cost: 1.384 };

test("bindings read the data bag; $$ escapes a literal dollar", () => {
  assert.equal(isBinding("$success"), true);
  assert.equal(isBinding("$$5"), false);
  assert.equal(resolve("$success", data), 81.4);
  assert.equal(resolve("$missing", data), undefined);
  assert.equal(resolve("$$5.00", data), "$5.00");
  assert.equal(resolve(42, data), 42);
  assert.equal(asStatus(resolve("$status", data)), "running");
  assert.equal(asStatus("weird"), null);
});

test("values format by kind, strings pass through untouched", () => {
  assert.equal(fmtValue(81.4, "pct"), "81.4 %");
  assert.equal(fmtValue(100, "pct"), "100 %");
  assert.equal(fmtValue(1.384, "usd"), "$1.38");
  assert.equal(fmtValue(6342, "dur"), "1h 45m");
  assert.equal(fmtValue(105381888, "num"), "105.38 M");
  assert.equal(fmtValue(12345, "int"), "12,345");
  assert.equal(fmtValue("cap_026", "pct"), "cap_026");
  assert.equal(fmtValue(undefined, "pct"), "—");
  assert.equal(fmtValue([1, 2, 3], "num"), "3");
  assert.equal(fmtDuration(42), "42s");
  assert.equal(fmtDuration(95), "1m 35s");
  assert.equal(fmtDuration(2280), "38m");
  assert.equal(fmtDuration(90000), "1d 1h");
});

test("deltas carry a sign and a direction", () => {
  assert.deepEqual(fmtDelta(2.1, "pct"), { text: "+2.1", dir: "up" });
  assert.deepEqual(fmtDelta(-0.5, "usd"), { text: "−$0.50", dir: "down" });
  assert.deepEqual(fmtDelta("+3 st", undefined), { text: "+3 st", dir: "up" });
  assert.equal(fmtDelta(null, "pct"), null);
});

test("progress accepts fractions, percents or value/max", () => {
  assert.equal(progressOf(0.42, undefined), 0.42);
  assert.equal(progressOf(42, undefined), 0.42);
  assert.equal(progressOf(3, 5), 0.6);
  assert.equal(progressOf(9, 5), 1);
  assert.equal(progressOf("x", undefined), null);
});

test("freshness: stale only past the TTL and only while running or paused", () => {
  assert.deepEqual(freshness(1000, 120, "running", 1100), { age: 100, stale: false });
  assert.deepEqual(freshness(1000, 120, "running", 1200), { age: 200, stale: true });
  assert.deepEqual(freshness(1000, 120, "done", 9000), { age: 8000, stale: false });
  assert.deepEqual(freshness(1000, undefined, null, 1400), { age: 400, stale: true });
  assert.deepEqual(freshness(undefined, 120, "running", 1400), { age: null, stale: false });
  assert.deepEqual(shortAge(42), { n: 42, unit: "s" });
  assert.deepEqual(shortAge(400), { n: 6, unit: "min" });
});

test("sparkline paths stay inside the box and end on the last point", () => {
  const s = sparkPaths([1, 3, 2, 5], 100, 40);
  assert.match(s.line, /^M3 /);
  assert.deepEqual(s.last, [97, 3]);
  assert.ok(s.area.endsWith("Z"));
  const flat = sparkPaths([2, 2, 2], 100, 40);
  assert.ok(flat.line.length > 0, "a flat series still draws");
  assert.equal(sparkPaths([], 100, 40).line, "");
});

test("log tails, media refs and template labels", () => {
  assert.deepEqual(tailLines(data.log, 2), ["b", "c"]);
  assert.deepEqual(tailLines(["x", "y", "z"], 5), ["x", "y", "z"]);
  assert.deepEqual(mediaRef("0123456789abcdef.mp4"), { asset: "0123456789abcdef.mp4" });
  assert.deepEqual(mediaRef("https://example.com/a.mp4"), { url: "https://example.com/a.mp4" });
  assert.equal(mediaRef("javascript:alert(1)"), null);
  assert.equal(labelKey("@success"), "success");
  assert.equal(labelKey("Success"), null);
});

test("a live op replays as a plain set (no client special case)", () => {
  const doc = { v: 1, id: "k3x9p2qa", name: "x", parent: null, seq: 1, n: 1, session: null, seen: 0, created: 0, updated: 0,
    items: { "0": { k: "live", x: 0, y: 0, blocks: [{ t: "header", status: "$status" }], data: { status: "running" }, at: 10 } } };
  const next = applyOps(doc, [{ op: "set", id: "0", p: { data: { status: "done" }, at: 20 } }]);
  assert.equal(next.items["0"].data.status, "done");
  assert.equal(next.items["0"].at, 20);
  assert.ok(liveHeight(next.items["0"]) > 40);
  assert.ok(approxRect(next.items["0"]).h > 40);
});

test("live strings exist in en and es, and the template labels are covered", () => {
  for (const k of ["success", "elapsed", "cost", "falls", "successTrend"]) {
    assert.ok(en[`board.live.l.${k}`], k);
    assert.ok(es[`board.live.l.${k}`], k);
  }
  for (const st of ["running", "paused", "done", "error", "idle", "stale"]) assert.ok(en[`board.live.st.${st}`] && es[`board.live.st.${st}`]);
});

test("the canvas menu gives every action an icon (Select all included)", () => {
  const src = readFileSync(new URL("../src/board/BoardView.tsx", import.meta.url), "utf8");
  const pushes = [...src.matchAll(/out\.push\(\{ id: "[^"]+", label: [^}]*\}/g)].map((m) => m[0]);
  assert.ok(pushes.length >= 4);
  for (const p of pushes) assert.match(p, /icon:/, p.slice(0, 60));
});
