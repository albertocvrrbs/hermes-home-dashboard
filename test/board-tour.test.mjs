import assert from "node:assert/strict";
import test from "node:test";

import { Camera, ManualClock, setCameraClock, getCameraClock, viewForRect } from "../src/board/camera.ts";
import { applyOp } from "../src/board/model.ts";
import {
  TourPlayer, carryInto, carryOut, claimCarry, clearCarry, dwellOf, framesAsStops, hasDwell, installTourApi, liveStops, moveStop,
  peekCarry, stopNote, stopTitle, withStop,
} from "../src/board/tour.ts";

const doc = (items, tour) => ({ v: 1, id: "k3x9p2qa", name: "Launch", parent: null, seq: 0, n: 9, session: null, seen: 0, created: 0, updated: 0, items, tour });
const frame = (x, y, title, note) => ({ k: "frame", x, y, w: 400, h: 300, title, note });
const rectOf = (d) => (id) => { const it = d.items[id]; return it && it.x != null ? { x: it.x, y: it.y, w: it.w ?? 100, h: it.h ?? 100 } : null; };

/** A player wired to a real Camera on a manual clock, over a 1000x700 viewport. */
function rig(d, over = {}) {
  const clock = new ManualClock();
  setCameraClock(clock);
  let view = { x: 0, y: 0, z: 1 };
  const log = [];
  const cam = new Camera({ get: () => view, set: (v) => { view = v; }, size: () => ({ w: 1000, h: 700 }) });
  const io = {
    stops: () => liveStops(d),
    tour: () => d.tour,
    view: (s) => { const r = s.r ?? (s.id ? rectOf(d)(s.id) : null); return s.v ?? (r ? viewForRect(r, { w: 1000, h: 700 }, { pad: 56 }) : null); },
    fly: (to, o) => cam.flyTo(to, { duration: o.duration ?? 600, ease: "inOut" }),
    cancel: () => cam.cancel(),
    clock: () => getCameraClock(),
    onEnd: (why) => log.push(`end:${why}`),
    ...over,
  };
  const states = [];
  io.onState = (s) => states.push(s);
  return { player: new TourPlayer(io), clock, cam, get view() { return view; }, log, states, d };
}
const flush = () => new Promise((r) => setImmediate(r));
test.afterEach(() => { setCameraClock(null); clearCarry(); });

test("liveStops skips deleted items and keeps views", () => {
  const d = doc({ a: frame(0, 0, "A") }, { stops: [{ k: "frame", id: "a" }, { k: "frame", id: "gone" }, { k: "view", v: { x: 1, y: 2, z: 1 } }, { k: "view", r: { x: 0, y: 0, w: 9, h: 9 } }] });
  assert.equal(liveStops(d).length, 3);
  assert.equal(liveStops(doc({}, undefined)).length, 0);
});

test("titles come from the caption, the item, then the position", () => {
  const d = doc({ a: frame(0, 0, "Brain", "how it learns"), c: { k: "card", x: 0, y: 0, text: "hello\nworld" } });
  assert.equal(stopTitle({ k: "frame", id: "a", t: "Custom" }, d, 1), "Custom");
  assert.equal(stopTitle({ k: "frame", id: "a" }, d, 1), "Brain");
  assert.equal(stopTitle({ k: "item", id: "c" }, d, 2), "hello");
  assert.equal(stopTitle({ k: "view", v: { x: 0, y: 0, z: 1 } }, d, 3), "3");
  assert.equal(stopNote({ k: "frame", id: "a" }, d), "how it learns");
  assert.equal(stopNote({ k: "item", id: "c" }, d), "");
});

test("frames in reading order: rows top to bottom, left to right", () => {
  const d = doc({ r: frame(800, 10, "R"), l: frame(0, 0, "L"), b: frame(0, 600, "B"), c: { k: "card", x: 0, y: 0 } });
  assert.deepEqual(framesAsStops(d, rectOf(d)).map((s) => s.id), ["l", "r", "b"]);
});

test("dwell: per stop, per tour, default; auto-play only when something sets one", () => {
  assert.equal(dwellOf({ k: "frame", dw: 2 }, { stops: [], dw: 9 }), 2);
  assert.equal(dwellOf({ k: "frame" }, { stops: [], dw: 9 }), 9);
  assert.equal(dwellOf({ k: "frame" }, undefined), 4);
  assert.equal(hasDwell({ stops: [{ k: "frame" }] }), false);
  assert.equal(hasDwell({ stops: [{ k: "frame", dw: 1 }] }), true);
});

test("withStop / moveStop edit without mutating", () => {
  const t = { stops: [{ k: "frame", id: "a" }, { k: "frame", id: "b" }] };
  const t2 = withStop(t, { k: "frame", id: "c" });
  assert.equal(t.stops.length, 2);
  assert.deepEqual(moveStop(t2, 2, 0).stops.map((s) => s.id), ["c", "a", "b"]);
  assert.equal(withStop(undefined, { k: "frame", id: "z" }).stops.length, 1);
});

test("the client mirrors the tour op (set, clear)", () => {
  const d = doc({ a: frame(0, 0, "A") });
  applyOp(d, { op: "tour", tour: { stops: [{ k: "frame", id: "a" }], loop: true } });
  assert.deepEqual(d.tour, { stops: [{ k: "frame", id: "a" }], loop: true });
  applyOp(d, { op: "tour", tour: null });
  assert.equal("tour" in d, false);
});

test("the player flies stop to stop on the manual clock, frame by frame", async () => {
  const d = doc({ a: frame(0, 0, "A"), b: frame(1500, 0, "B"), c: frame(0, 900, "C") }, { stops: [{ k: "frame", id: "a" }, { k: "frame", id: "b" }, { k: "frame", id: "c" }] });
  const r = rig(d);
  let arrived = false;
  const p = r.player.start(0, { auto: false, duration: 600 }).then((ok) => { arrived = ok; });
  assert.equal(r.player.state.flying, true);
  r.clock.advance(300);
  const mid = { ...r.view };
  assert.equal(arrived, false);
  r.clock.advance(400);
  await p;
  assert.equal(arrived, true);
  assert.equal(r.player.state.i, 0);
  const at0 = { ...r.view };
  assert.notDeepEqual(mid, at0);
  const n = r.player.next();
  r.clock.advance(700);
  await n;
  assert.equal(r.player.state.i, 1);
  assert.deepEqual(r.view, viewForRect({ x: 1500, y: 0, w: 400, h: 300 }, { w: 1000, h: 700 }, { pad: 56 }));
  const back = r.player.prev();
  r.clock.advance(700);
  await back;
  assert.equal(r.player.state.i, 0);
  assert.deepEqual(r.view, at0);
  // a second run lands on identical numbers: deterministic
  const r2 = rig(d);
  void r2.player.start(0, { auto: false, duration: 600 });
  r2.clock.advance(700);
  assert.deepEqual(r2.view, at0);
});

test("next past the last stop ends the tour; loop wraps", async () => {
  const d = doc({ a: frame(0, 0, "A"), b: frame(900, 0, "B") }, { stops: [{ k: "frame", id: "a" }, { k: "frame", id: "b" }] });
  const r = rig(d);
  void r.player.start(1, { duration: 100 });
  r.clock.advance(200);
  await r.player.next();
  assert.deepEqual(r.log, ["end:end"]);
  assert.equal(r.player.state.on, false);

  d.tour.loop = true;
  const r2 = rig(d);
  void r2.player.start(1, { duration: 100 });
  r2.clock.advance(200);
  const n = r2.player.next();
  r2.clock.advance(200);
  await n;
  assert.equal(r2.player.state.i, 0);
  assert.equal(r2.player.state.on, true);
});

test("auto-play waits each stop's dwell on the camera clock, then advances", async () => {
  const d = doc({ a: frame(0, 0, "A"), b: frame(900, 0, "B"), c: frame(1800, 0, "C") },
    { stops: [{ k: "frame", id: "a", dw: 2 }, { k: "frame", id: "b" }, { k: "frame", id: "c" }], dw: 1 });
  const r = rig(d);
  void r.player.start(0, { duration: 100 });
  assert.equal(r.player.state.auto, true, "a dwell anywhere turns auto-play on");
  r.clock.advance(150); await flush();   // arrived at a, dwelling 2 s
  assert.equal(r.player.state.i, 0);
  r.clock.advance(1800); await flush();
  assert.equal(r.player.state.i, 0);
  r.clock.advance(300); await flush();   // 2 s passed: flies to b
  assert.equal(r.player.state.i, 1);
  r.clock.advance(100); await flush();   // arrives, dwells the tour default (1 s)
  r.clock.advance(1100); await flush();
  assert.equal(r.player.state.i, 2);
  r.clock.advance(100); await flush();
  r.player.setAuto(false);
  r.clock.advance(120_000); await flush();
  assert.equal(r.player.state.i, 2, "paused: stays put");
  assert.equal(r.player.state.on, true);
});

test("stops that cannot be shown are skipped; an empty tour ends at once", async () => {
  const d = doc({ a: frame(0, 0, "A"), c: frame(0, 900, "C") }, { stops: [{ k: "frame", id: "a" }, { k: "item", id: "gone" }, { k: "frame", id: "c" }] });
  const r = rig(d);
  void r.player.start(0, { duration: 50, auto: false });
  r.clock.advance(100);
  const n = r.player.next();
  r.clock.advance(100);
  await n;
  assert.equal(r.player.state.n, 2);
  assert.equal(r.player.state.i, 1);
  const r2 = rig(doc({}, undefined));
  assert.equal(await r2.player.start(0), false);
  assert.deepEqual(r2.log, ["end:end"]);
});

test("stop() cuts the flight and reports why; dispose() is silent", async () => {
  const d = doc({ a: frame(0, 0, "A"), b: frame(900, 0, "B") }, { stops: [{ k: "frame", id: "a" }, { k: "frame", id: "b" }] });
  const r = rig(d);
  const p = r.player.start(0, { duration: 600, auto: false });
  r.clock.advance(100);
  r.player.stop();
  assert.equal(await p, false);
  assert.deepEqual(r.log, ["end:stop"]);
  assert.equal(r.cam.moving, false);
  const r2 = rig(d);
  void r2.player.start(0, { duration: 600 });
  r2.player.dispose();
  assert.deepEqual(r2.log, []);
});

test("a board stop dives on next(); the carry brings the tour back to the next stop", async () => {
  const d = doc({ a: frame(0, 0, "A"), s: { k: "board", x: 900, y: 0, ref: "child001" }, z: frame(0, 900, "Z") },
    { stops: [{ k: "frame", id: "a" }, { k: "board", id: "s" }, { k: "frame", id: "z" }] });
  const dives = [];
  const r = rig(d, { enter: (stop, index, auto) => { dives.push([stop.id, index]); carryInto("k3x9p2qa", index, "child001", auto); return true; } });
  void r.player.start(1, { duration: 50, auto: false });
  r.clock.advance(100); await flush();
  const ok = await r.player.next();
  assert.equal(ok, true);
  assert.deepEqual(dives, [["s", 1]]);
  assert.equal(r.player.state.on, false);
  assert.equal(r.log.length, 0, "diving is not the end of the tour");
  // the child board mounts and claims the carry...
  assert.deepEqual(claimCarry("child001"), { role: "child", depth: 1, auto: false, duration: undefined });
  // ...and when its tour ends it climbs back, and the parent resumes after the dive
  assert.equal(carryOut(), "k3x9p2qa");
  assert.deepEqual(claimCarry("k3x9p2qa"), { role: "resume", index: 2, auto: false, depth: 0, duration: undefined });
  assert.equal(peekCarry(), null);
});

test("a carry for another board is dropped (the user went elsewhere)", () => {
  carryInto("p", 0, "child001", false);
  assert.equal(claimCarry("someother"), null);
  assert.equal(peekCarry(), null);
  assert.equal(carryOut(), null);
});

test("nested dives keep a stack", () => {
  carryInto("root0001", 1, "mid00001", true);
  assert.equal(claimCarry("mid00001").role, "child");
  carryInto("mid00001", 0, "leaf0001", true);
  assert.equal(claimCarry("leaf0001").depth, 2);
  assert.equal(carryOut(), "mid00001");
  assert.deepEqual(claimCarry("mid00001"), { role: "resume", index: 1, auto: true, depth: 1, duration: undefined });
  assert.equal(carryOut(), "root0001");
  assert.equal(claimCarry("root0001").index, 2);
});

test("window.__hbTour is published and removed", () => {
  const win = {};
  const api = { version: 1, board: "x" };
  const off = installTourApi(api, win);
  assert.equal(win.__hbTour, api);
  off();
  assert.equal("__hbTour" in win, false);
});
