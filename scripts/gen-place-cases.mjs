// Regenerates test/fixtures/place-cases.json from src/board/place.ts. The inputs are written here
// by hand; the expectations come from the TS code and are checked against the Python mirror
// (dashboard/boardkit/place.py) by test/test_board_place.py. Read the diff when you rerun it.
//   node --experimental-strip-types scripts/gen-place-cases.mjs
import { writeFileSync } from "node:fs";
import { estimateSize, freePlace, placeBatch, pushPlan, resolvePlan } from "../src/board/place.ts";

const R = (x, y, w, h) => ({ x, y, w, h });
const estimate = [
  { name: "image 16:9 with caption", item: { k: "image", w: 372, iw: 1600, ih: 900, cap: "Piezas" } },
  { name: "image without caption", item: { k: "image", w: 372, iw: 1600, ih: 900 } },
  { name: "image tall, long caption", item: { k: "image", w: 372, iw: 600, ih: 1000, cap: "Un pie de foto bastante largo que debería ocupar dos renglones en la tarjeta de imagen" } },
  { name: "image panorama", item: { k: "image", w: 372, iw: 2400, ih: 500, cap: "pano" } },
  { name: "image of unknown size", item: { k: "image", w: 300 } },
  { name: "image default width", item: { k: "image", iw: 800, ih: 800 } },
  { name: "uploaded video 16:9", item: { k: "video", w: 400, iw: 640, ih: 360, title: "clip" } },
  { name: "uploaded video portrait", item: { k: "video", w: 400, iw: 360, ih: 640, title: "clip" } },
  { name: "uploaded video absurdly wide is clamped", item: { k: "video", w: 400, iw: 5000, ih: 100, title: "clip" } },
  { name: "youtube link as video", item: { k: "video", w: 400, video: { p: "youtube", id: "abcdefghijk" }, title: "Título", desc: "autor" } },
  { name: "link with square thumbnail", item: { k: "link", title: "Título corto", desc: "Descripción de tres renglones. ".repeat(4), url: "https://example.com/a", img: "x.png", iw: 800, ih: 800, st: "ok" } },
  { name: "link without picture", item: { k: "link", title: "Un título de enlace mucho más largo que ocupa varias líneas en la tarjeta", url: "https://example.com/b", st: "ok" } },
  { name: "link waiting for its preview", item: { k: "link", url: "https://example.com/c", st: "wait" } },
  { name: "link that failed", item: { k: "link", url: "https://example.com/d", st: "fail", site: "example.com" } },
  { name: "link with panorama thumbnail", item: { k: "link", title: "Panorama", img: "p.png", iw: 2400, ih: 500, url: "https://example.com/e", st: "ok" } },
  { name: "card, title only", item: { k: "card", w: 256, title: "Solo título" } },
  { name: "card, short quote", item: { k: "card", w: 256, text: "Solo texto corto" } },
  { name: "card, title and long text", item: { k: "card", w: 256, title: "Título", text: "Texto largo. ".repeat(60) } },
  { name: "card, text tags due", item: { k: "card", w: 256, title: "Con tags", text: "uno\ndos\ntres", tags: ["a", "b"], due: "2026-12-01" } },
  { name: "todo with 3 rows", item: { k: "todo", items: [{ t: "a" }, { t: "b" }, { t: "c" }] } },
  { name: "unknown kind falls back to the default", item: { k: "embed" } },
].map((c) => ({ ...c, expect: estimateSize(c.item) }));

const free = [
  { name: "free spot is kept", want: { x: 100, y: 100 }, size: { w: 200, h: 100 }, obstacles: [R(0, 400, 300, 100)] },
  { name: "on top of a card: goes to its nearest free side", want: { x: 110, y: 100 }, size: { w: 200, h: 100 }, obstacles: [R(100, 100, 256, 120)] },
  { name: "touching is not enough: the gap is kept", want: { x: 356, y: 100 }, size: { w: 200, h: 100 }, obstacles: [R(100, 100, 256, 120)] },
  { name: "wedged between two cards", want: { x: 300, y: 100 }, size: { w: 200, h: 100 }, obstacles: [R(0, 100, 300, 100), R(520, 100, 300, 100)] },
  { name: "surrounded: finds the ring outside", want: { x: 300, y: 300 }, size: { w: 100, h: 100 }, obstacles: [R(250, 250, 200, 200), R(100, 100, 100, 100), R(500, 500, 100, 100)] },
  { name: "tight gap of 8", want: { x: 100, y: 100 }, size: { w: 100, h: 100 }, obstacles: [R(150, 100, 100, 100)], gap: 8 },
  { name: "stays inside its frame when there is room", want: { x: 100, y: 100 }, size: { w: 100, h: 60 }, obstacles: [R(80, 80, 140, 100)], within: R(0, 0, 400, 400) },
  { name: "leaves the frame when it is full", want: { x: 10, y: 10 }, size: { w: 100, h: 60 }, obstacles: [R(0, 0, 200, 200)], within: R(0, 0, 200, 200) },
  { name: "negative coordinates", want: { x: -500, y: -300 }, size: { w: 120, h: 80 }, obstacles: [R(-520, -320, 200, 200)] },
  { name: "fractional want is rounded", want: { x: 10.5, y: 20.5 }, size: { w: 50, h: 50 }, obstacles: [] },
].map((c) => ({ ...c, expect: freePlace(c.want, c.size, c.obstacles, { gap: c.gap, within: c.within }) }));

const batch = [
  { name: "six pasted images next to notes", want: { x: 0, y: 0 }, sizes: [{ w: 372, h: 230 }, { w: 372, h: 657 }, { w: 372, h: 119 }, { w: 200, h: 231 }, { w: 372, h: 230 }, { w: 400, h: 340 }],
    obstacles: [R(-400, -260, 256, 100), R(-120, -260, 256, 100), R(160, -260, 256, 100), R(-400, -110, 256, 100), R(-400, 60, 300, 190)] },
  { name: "onto an empty board", want: { x: 0, y: 0 }, sizes: [{ w: 100, h: 100 }, { w: 100, h: 100 }, { w: 100, h: 100 }], obstacles: [] },
].map((c) => ({ ...c, expect: placeBatch(c.sizes, c.want, c.obstacles) }));

const resolve = [
  { name: "tidy board comes back unchanged", entries: [{ id: "a", rect: R(0, 0, 100, 100) }, { id: "b", rect: R(124, 0, 100, 100) }] },
  { name: "two overlapping cards: the later one steps aside", entries: [{ id: "a", rect: R(0, 0, 200, 100) }, { id: "b", rect: R(50, 50, 200, 100) }] },
  { name: "an anchored card never moves", entries: [{ id: "a", rect: R(0, 0, 200, 100), anchored: true }, { id: "b", rect: R(50, 50, 200, 100) }] },
  { name: "image over two notes", entries: [{ id: "n1", rect: R(0, 0, 256, 80) }, { id: "n2", rect: R(280, 0, 256, 80) }, { id: "i1", rect: R(100, 40, 300, 200) }, { id: "n3", rect: R(0, 300, 256, 80) }] },
  { name: "stays in its frame", entries: [{ id: "a", rect: R(20, 20, 150, 100) }, { id: "b", rect: R(60, 60, 150, 100), within: R(0, 0, 500, 500) }] },
  { name: "a stack of five identical cards", entries: [0, 1, 2, 3, 4].map((i) => ({ id: "s" + i, rect: R(0, 0, 100, 60) })) },
].map((c) => ({ ...c, expect: resolvePlan(c.entries) }));

const push = [
  { name: "a card grew over the one below", grown: "a", entries: [{ id: "a", rect: R(0, 0, 200, 200) }, { id: "b", rect: R(0, 150, 200, 100) }] },
  { name: "the push cascades", grown: "a", entries: [{ id: "a", rect: R(0, 0, 200, 200) }, { id: "b", rect: R(0, 180, 200, 100) }, { id: "c", rect: R(0, 290, 200, 100) }] },
  { name: "an anchored neighbour is reported, not moved", grown: "a", entries: [{ id: "a", rect: R(0, 0, 200, 200) }, { id: "b", rect: R(0, 150, 200, 100), anchored: true }] },
  { name: "a card beside is pushed sideways when that is cheaper", grown: "a", entries: [{ id: "a", rect: R(0, 0, 200, 100) }, { id: "b", rect: R(190, 0, 100, 100) }] },
  { name: "nothing to push", grown: "a", entries: [{ id: "a", rect: R(0, 0, 100, 100) }, { id: "b", rect: R(300, 0, 100, 100) }] },
].map((c) => ({ ...c, expect: pushPlan(c.entries, c.grown) }));

writeFileSync(new URL("../test/fixtures/place-cases.json", import.meta.url), JSON.stringify({ estimate, free, batch, resolve, push }, null, 1) + "\n");
console.log("ok");
