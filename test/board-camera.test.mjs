import assert from "node:assert/strict";
import test from "node:test";

import {
  Camera, ManualClock, cubicBezier, flightDuration, installCameraApi, mixView, resolveEase, setCameraClock,
  springEase, viewCentered, viewForRect,
} from "../src/board/camera.ts";

const VP = { w: 1000, h: 600 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test("easing hits 0 and 1, is monotonic, and CSS ease-out-ish curves start fast", () => {
  for (const f of [cubicBezier(0.22, 1, 0.36, 1), cubicBezier(0.65, 0, 0.35, 1), springEase(), resolveEase("out"), resolveEase([0.4, 0, 0.2, 1])]) {
    near(f(0), 0); near(f(1), 1);
    let prev = -1;
    for (let i = 0; i <= 50; i++) { const v = f(i / 50); assert.ok(v >= prev - 1e-9); prev = v; }
  }
  assert.ok(resolveEase("out")(0.2) > 0.4, "out is front-loaded");
  assert.ok(resolveEase("inOut")(0.5) > 0.49 && resolveEase("inOut")(0.5) < 0.51);
  near(cubicBezier(0.25, 0.25, 0.75, 0.75)(0.3), 0.3, 1e-4);
});

test("mixView lands on both ends and zooms geometrically", () => {
  const a = { z: 0.3, x: 10, y: 20 }, b = { z: 1.2, x: -400, y: -90 };
  assert.deepEqual(mixView(a, b, 0, VP), a);
  assert.deepEqual(mixView(a, b, 1, VP), b);
  near(mixView(a, b, 0.5, VP).z, Math.sqrt(0.3 * 1.2));
});

test("mixView keeps a point fixed when only zoom changes (anchored push-in)", () => {
  const a = { z: 0.5, x: 300, y: 100 };
  const c = [(VP.w / 2 - a.x) / a.z, (VP.h / 2 - a.y) / a.z];
  const b = viewCentered(c[0], c[1], 2, VP);
  const m = mixView(a, b, 0.37, VP);
  near((VP.w / 2 - m.x) / m.z, c[0], 1e-6);
  near((VP.h / 2 - m.y) / m.z, c[1], 1e-6);
});

test("mixView with equal zoom is a straight pan", () => {
  const a = { z: 1, x: 0, y: 0 }, b = { z: 1, x: -600, y: -300 };
  const m = mixView(a, b, 0.25, VP);
  near(m.x, -150); near(m.y, -75); near(m.z, 1);
});

test("viewForRect frames a rect with padding and clamps zoom", () => {
  const v = viewForRect({ x: 0, y: 0, w: 400, h: 100 }, VP, { pad: 50, maxZ: 1.5 });
  near(v.z, 1.5);
  near(v.x + 200 * v.z, VP.w / 2); near(v.y + 50 * v.z, VP.h / 2);
  assert.equal(viewForRect({ x: 0, y: 0, w: 4000, h: 3000 }, VP, { pad: 0, minZ: 0.4 }).z, 0.4);
});

test("flightDuration stays between 300 and 650 ms and grows with the move", () => {
  const a = { z: 1, x: 0, y: 0 };
  const near_ = flightDuration(a, { z: 1, x: -20, y: 0 }, VP);
  const far = flightDuration(a, { z: 0.2, x: -5000, y: -3000 }, VP);
  assert.ok(near_ >= 300 && far <= 650 && far > near_);
});

function rig(reduced = false) {
  const clock = new ManualClock();
  setCameraClock(clock);
  let v = { z: 1, x: 0, y: 0 };
  const log = [];
  const cam = new Camera({ get: () => v, set: (n) => { v = n; }, size: () => VP, reduced: () => reduced, onMoving: (m) => log.push(m) });
  return { clock, cam, get view() { return v; }, log };
}

test("flyTo advances only with the manual clock and ends exactly on target", async () => {
  const r = rig();
  const to = { z: 0.4, x: 50, y: 60 };
  const done = r.cam.flyTo(to, { duration: 400, ease: "inOut" });
  assert.equal(r.cam.moving, true);
  assert.deepEqual(r.view, { z: 1, x: 0, y: 0 }, "nothing moves without the clock");
  r.clock.advance(200);
  assert.ok(r.view.z < 1 && r.view.z > 0.4);
  r.clock.advance(250);
  assert.equal(await done, true);
  assert.deepEqual(r.view, to);
  assert.equal(r.cam.moving, false);
  assert.deepEqual(r.log, [true, false]);
  setCameraClock(null);
});

test("frame-by-frame: the same script gives the same views", async () => {
  const run = async () => {
    const r = rig();
    const seen = [];
    const p = r.cam.flyTo({ z: 2, x: -300, y: -100 }, { duration: 500, onFrame: (u, v) => seen.push([+u.toFixed(5), +v.z.toFixed(5)]) });
    r.clock.advance(600);
    await p;
    return seen;
  };
  const a = await run(), b = await run();
  assert.deepEqual(a, b);
  assert.ok(a.length >= 30 && a.at(-1)[0] === 1);
  setCameraClock(null);
});

test("cancel resolves false and leaves the view mid-way", async () => {
  const r = rig();
  const p = r.cam.flyTo({ z: 0.3, x: 0, y: 0 }, { duration: 500 });
  r.clock.advance(150);
  const mid = r.view.z;
  r.cam.cancel();
  assert.equal(await p, false);
  r.clock.advance(500);
  assert.equal(r.view.z, mid);
  assert.deepEqual(r.log, [true, false]);
  setCameraClock(null);
});

test("a new flyTo retargets from where the view is now", async () => {
  const r = rig();
  const first = r.cam.flyTo({ z: 0.3, x: 0, y: 0 }, { duration: 500 });
  r.clock.advance(250);
  const mid = r.view.z;
  const second = r.cam.flyTo({ z: 2, x: 0, y: 0 }, { duration: 500 });
  assert.equal(await first, false);
  r.clock.advance(10);
  assert.ok(Math.abs(r.view.z - mid) < 0.15, "continues from the current view, no jump");
  r.clock.advance(600);
  assert.equal(await second, true);
  assert.equal(r.view.z, 2);
  setCameraClock(null);
});

test("reduced motion jumps", async () => {
  const r = rig(true);
  assert.equal(await r.cam.flyTo({ z: 0.5, x: 1, y: 2 }, { duration: 500 }), true);
  assert.deepEqual(r.view, { z: 0.5, x: 1, y: 2 });
  assert.equal(r.cam.moving, false);
  setCameraClock(null);
});

test("zoomBy accumulates on the running target", async () => {
  const r = rig();
  r.cam.zoomBy(1.2, 500, 300);
  r.clock.advance(50);
  const p = r.cam.zoomBy(1.2, 500, 300);
  r.clock.advance(400);
  await p;
  near(r.view.z, 1.44, 1e-9);
  setCameraClock(null);
});

test("installCameraApi publishes window.__hbCamera, routes hb:camera events, and cleans up", async () => {
  const listeners = new Map();
  const win = {
    addEventListener: (n, f) => listeners.set(n, f),
    removeEventListener: (n) => listeners.delete(n),
    dispatchEvent: (e) => { win.last = e; return true; },
  };
  globalThis.CustomEvent ??= class extends Event { constructor(t, i) { super(t); this.detail = i?.detail; } };
  const seen = [];
  const api = { version: 1, board: "abc", flyTo: async (r) => { seen.push(r); return true; }, getView: () => ({ z: 1, x: 0, y: 0 }) };
  const off = installCameraApi(api, win);
  assert.equal(win.__hbCamera, api);
  listeners.get("hb:camera")({ detail: { rect: { x: 0, y: 0, w: 10, h: 10 }, id: "shot1" } });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(seen[0].id, "shot1");
  assert.equal(win.last.type, "hb:camera:end");
  assert.equal(win.last.detail.completed, true);
  off();
  assert.equal(win.__hbCamera, undefined);
  assert.equal(listeners.size, 0);
});
