import assert from "node:assert/strict";
import test from "node:test";

import { SyncHub, GroupClock, makeSyncApi, formatClock, groupsOf } from "../src/board/syncClock.ts";

function fakeTime() {
  let now = 0, id = 0;
  const q = new Map();
  return {
    time: { now: () => now, raf: (fn) => { q.set(++id, fn); return id; }, caf: (i) => q.delete(i) },
    frame(ms = 16) { now += ms; const run = [...q.entries()]; q.clear(); run.forEach(([, fn]) => fn(now)); },
    pending: () => q.size,
  };
}

function fakeVideo({ duration = 10, rvfc = false } = {}) {
  const h = new Map();
  const v = {
    currentTime: 0, duration, paused: true, playbackRate: 1, seeking: false, frames: [],
    play() { v.paused = false; h.get("play")?.forEach((f) => f()); },
    pause() { v.paused = true; h.get("pause")?.forEach((f) => f()); },
    addEventListener(t, f) { (h.get(t) ?? h.set(t, new Set()).get(t)).add(f); },
    removeEventListener(t, f) { h.get(t)?.delete(f); },
    fire(t) { h.get(t)?.forEach((f) => f()); },
    listeners: (t) => h.get(t)?.size ?? 0,
  };
  if (rvfc) {
    v.requestVideoFrameCallback = (cb) => { v.frames.push(cb); return v.frames.length; };
    v.cancelVideoFrameCallback = () => { v.frames.length = 0; };
  }
  return v;
}

test("free-running clock advances with the time source and respects rate", () => {
  const ft = fakeTime();
  const c = new GroupClock("g", ft.time);
  const ticks = [];
  c.subscribe((ev, s) => { if (ev === "tick") ticks.push(s.t); });
  c.play();
  ft.frame(1000);
  assert.ok(Math.abs(c.state.t - 1) < 1e-9);
  c.setRate(2);
  ft.frame(500);
  assert.ok(Math.abs(c.state.t - 2) < 1e-9);
  c.pause();
  ft.frame(1000);
  assert.equal(c.state.t, 2);
  assert.equal(ft.pending(), 0);
  assert.ok(ticks.length >= 2);
});

test("duration stops a free-running clock and play restarts from 0", () => {
  const ft = fakeTime();
  const c = new GroupClock("g", ft.time);
  c.setDuration(2);
  c.play();
  ft.frame(3000);
  assert.equal(c.state.t, 2);
  assert.equal(c.state.playing, false);
  c.play();
  assert.equal(c.state.t, 0);
});

test("seek clamps and notifies seek then tick", async () => {
  const ft = fakeTime();
  const c = new GroupClock("g", ft.time);
  c.setDuration(5);
  const evs = [];
  c.subscribe((ev) => evs.push(ev));
  await c.seek(99);
  assert.equal(c.state.t, 5);
  await c.seek(-3);
  assert.equal(c.state.t, 0);
  assert.deepEqual(evs.filter((e) => e !== "state"), ["seek", "tick", "seek", "tick"]);
});

test("a video master drives the clock from its element and takes commands", () => {
  const ft = fakeTime();
  const hub = new SyncHub(ft.time);
  const c = hub.clock("run");
  const v = fakeVideo({ duration: 12 });
  c.attachVideo(v);
  assert.equal(c.state.master, true);
  assert.equal(c.state.duration, 12);
  c.play();
  assert.equal(v.paused, false);
  assert.equal(c.state.playing, true);
  v.currentTime = 1.5;
  ft.frame();
  assert.equal(c.state.t, 1.5);
  c.setRate(1.5);
  assert.equal(v.playbackRate, 1.5);
  v.pause();
  assert.equal(c.state.playing, false);
  assert.equal(ft.pending(), 0);
  c.seek(4);
  assert.equal(v.currentTime, 4);
  assert.equal(c.state.t, 4);
});

test("video seeks resolve on `seeked` and tick with the shown frame", async () => {
  const ft = fakeTime();
  const c = new GroupClock("g", ft.time);
  const v = fakeVideo();
  c.attachVideo(v);
  const ticks = [];
  c.subscribe((ev, s) => { if (ev === "tick") ticks.push(s.t); });
  let done = false;
  const p = c.seek(3.2).then(() => { done = true; });
  await Promise.resolve();
  assert.equal(done, false);
  v.fire("seeked");
  await p;
  assert.equal(done, true);
  assert.deepEqual(ticks, [3.2]);
});

test("requestVideoFrameCallback gives frame-accurate ticks", () => {
  const ft = fakeTime();
  const c = new GroupClock("g", ft.time);
  const v = fakeVideo({ rvfc: true });
  c.attachVideo(v);
  const ticks = [];
  c.subscribe((ev, s) => { if (ev === "tick") ticks.push(s.t); });
  c.play();
  assert.equal(v.frames.length, 1);
  for (let i = 1; i <= 3; i++) { const cb = v.frames.shift(); cb(0, { mediaTime: i / 30 }); }
  assert.deepEqual(ticks, [1 / 30, 2 / 30, 3 / 30]);
  assert.equal(ft.pending(), 0, "no rAF loop when rVFC drives");
  c.pause();
  assert.equal(v.frames.length, 0);
});

test("a late video adopts the group's playhead instead of rewinding it", () => {
  const ft = fakeTime();
  const c = new GroupClock("g", ft.time);
  c.seek(7);
  const v = fakeVideo();
  c.attachVideo(v);
  assert.equal(v.currentTime, 7);
  assert.equal(c.state.t, 7);
});

test("detaching the video hands the clock back to free running", () => {
  const ft = fakeTime();
  const c = new GroupClock("g", ft.time);
  const v = fakeVideo();
  const off = c.attachVideo(v);
  assert.equal(v.listeners("seeked"), 1);
  off();
  assert.equal(v.listeners("seeked"), 0);
  assert.equal(c.state.master, false);
});

test("manual mode: nothing moves in real time; step() is deterministic at 30 fps", async () => {
  const ft = fakeTime();
  const hub = new SyncHub(ft.time);
  const api = makeSyncApi(hub, "b1", () => "run");
  const c = hub.clock("run");
  api.manual(true);
  c.play();
  ft.frame(5000);
  assert.equal(c.state.t, 0);
  assert.equal(ft.pending(), 0);
  const seen = [];
  c.subscribe((ev, s) => { if (ev === "tick") seen.push(Number(s.t.toFixed(4))); });
  for (let i = 0; i < 3; i++) await api.step();
  assert.deepEqual(seen, [0.0333, 0.0667, 0.1]);
  await api.advance(1000);
  assert.ok(Math.abs(c.state.t - 1.1) < 1e-9);
  assert.equal(api.state().manual, true);
  api.manual(false);
  assert.equal(c.state.manual, false);
  assert.equal(ft.pending(), 1, "playing clock resumes its loop");
});

test("step() lands on the frame grid even after thousands of frames", async () => {
  const ft = fakeTime();
  const hub = new SyncHub(ft.time);
  const api = makeSyncApi(hub, "b1", () => "g");
  hub.setManual(true);
  for (let i = 0; i < 1800; i++) await api.step(1, 30);
  assert.equal(hub.clock("g").state.t, 60);
  await api.step(-30, 30);
  assert.equal(hub.clock("g").state.t, 59);
});

test("manual mode with a video seeks frame by frame and keeps the element paused", async () => {
  const ft = fakeTime();
  const hub = new SyncHub(ft.time);
  const c = hub.clock("g");
  const v = fakeVideo();
  c.attachVideo(v);
  hub.setManual(true);
  c.play();
  assert.equal(v.paused, true);
  const p = c.advance(100);
  await Promise.resolve();
  assert.ok(Math.abs(v.currentTime - 0.1) < 1e-9);
  v.fire("seeked");
  await p;
});

test("hub: private clocks stay out of the group list; groupsOf and formatClock", () => {
  const hub = new SyncHub(fakeTime().time);
  hub.clock("~card7");
  hub.clock("run");
  assert.deepEqual(hub.names(), ["run"]);
  assert.deepEqual(groupsOf({ a: { sync: "s2" }, b: {}, c: { sync: "s1" }, d: { sync: "s2" } }), ["s2", "s1"]);
  assert.equal(formatClock(75.43), "1:15.4");
  assert.equal(formatClock(75.5, 30), "1:15:15");
});

test("watchers hear every clock change", () => {
  const hub = new SyncHub(fakeTime().time);
  const heard = [];
  hub.watch((g) => heard.push(g));
  hub.clock("a").setRate(2);
  assert.deepEqual(heard, ["a"]);
});
