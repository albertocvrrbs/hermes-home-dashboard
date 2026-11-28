import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { offersPlayAll, stageMode, wallPlayable, wallVideos } from "../src/board/playAll.ts";
import en from "../src/home/i18n/locales/en.ts";
import es from "../src/home/i18n/locales/es.ts";

const src = (p) => readFileSync(new URL(`../src/board/${p}`, import.meta.url), "utf8");

test("the wall plays uploaded and direct videos, not synced ones, players or other cards", () => {
  const items = {
    a: { k: "video", asset: "v1" },
    b: { k: "video", src: "https://example.com/run.mp4" },
    c: { k: "video", asset: "v3", sync: "s1" },
    d: { k: "link", url: "https://youtu.be/x", video: { id: "x" } },
    e: { k: "image", asset: "i1" },
    f: { k: "video" },
  };
  assert.deepEqual(wallVideos(items), ["a", "b"]);
  assert.equal(wallPlayable(items.c), false, "a synced video already runs on its group's clock");
  assert.equal(wallPlayable(undefined), false);
});

test("Play all is offered only with two or more playable videos", () => {
  assert.equal(offersPlayAll({}), false);
  assert.equal(offersPlayAll({ a: { k: "video", asset: "v" } }), false);
  assert.equal(offersPlayAll({ a: { k: "video", asset: "v" }, b: { k: "video", asset: "w" } }), true);
  const stations = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [`s${i}`, { k: "video", asset: `v${i}` }]));
  assert.equal(wallVideos(stations).length, 37);
});

test("stage modes: a clicked video keeps its controls, synced follows the clock, the wall is muted", () => {
  assert.equal(stageMode({ clicked: false, synced: false, wall: false }), "none");
  assert.equal(stageMode({ clicked: false, synced: false, wall: true }), "wall");
  assert.equal(stageMode({ clicked: true, synced: false, wall: true }), "single");
  assert.equal(stageMode({ clicked: false, synced: true, wall: true }), "synced");
});

test("wiring: toolbar toggle, context flag, wall player muted/looping without controls", () => {
  const view = src("BoardView.tsx");
  assert.match(view, /offersPlayAll\(doc\.items\)/);
  assert.match(view, /setPlayAll\(false\); \}, \[bid\]\)/, "leaving the board stops the wall");
  assert.match(view, /playAll, Frame/);
  const items = src("items.tsx");
  assert.match(items, /wall=\{!!c\.playAll && wallPlayable\(item\)\}/);
  const video = src("video.tsx");
  assert.match(video, /className="wall" src=\{url\} autoPlay muted loop playsInline/);
  assert.doesNotMatch(video.match(/className="wall"[^>]*>/)[0], /controls/);
});

test("Play all has its strings in both languages", () => {
  for (const k of ["board.video.playAll", "board.video.stopAll"]) {
    assert.ok(en[k] && es[k], k);
  }
  assert.equal(en["board.video.playAll"], "Play all videos");
});
