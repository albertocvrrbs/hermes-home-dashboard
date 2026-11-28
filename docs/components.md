# Custom components (`window.hb` v1)

The plugin ships no fixed "network card", "gauge card" or "timeline card". It ships the platform:
Hermes writes the component a user needs, when they need it, with the `board_component` tool. A
component is plain HTML/JS saved in the **user component library**
(`<hermes-home>/plugin-data/home-dashboard/components/<name>/<version>/`) and reusable on any
board. On a board it is a **component card** (`k: "comp"`).

```
you:    "show me the learning curve of my training run, animated with the video"
hermes: board_component create name:"curve" html:"..."      -> v1, lint warnings
        board_apply  add {k:comp, comp:"curve", cdata:{...}}  + sync [video, curve]
```

## What a component is

- `index.html` plus optional `.js`, `.css`, `.json`, `.svg`, `.txt`, `.md` files (up to 24 files,
  1 MB each, 2 MB total). Local `<script src="app.js">` and `<link rel="stylesheet" href="s.css">`
  are inlined when the card loads; there is no network.
- `sample.json` (optional): data shown in the gallery thumbnail and in a card that has no data yet.
- Every save is a new immutable version (`v1`, `v2`, ...). Rolling back copies an old version forward.
  A card follows the latest version, or pins one (`ver`); the card header shows
  `name · v3`, a versions menu (pin / follow latest), an update button when pinned behind, reload,
  the theme switch and the source.

## The sandbox

The card is `<iframe sandbox="allow-scripts">`: opaque origin, no access to the dashboard
(parent DOM, cookies, storage, same-origin requests), and a CSP of
`default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:;
font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'`.
No `fetch`, XHR, WebSocket, external script, font or image. Everything the component needs reaches
it through `window.hb`.

## The bridge: `window.hb` (version 1, stable)

Injected before your scripts. Additive changes only within version 1; `hb.version` tells you.

| | |
|---|---|
| `hb.version` | `1` |
| `hb.component` | `{ name, version }` this card runs |
| `hb.data` | the card's data (`cdata`), or the component's `sample.json` while empty |
| `hb.onData(fn) -> off` | `fn(data, changedKeys)` now (if there is data) and on every update |
| `hb.assets` / `hb.assetRev` | names of the files attached to this card / their revisions |
| `hb.asset(name, {as}) -> Promise` | a big file attached to the card. `as`: `json` (default for `.json`), `text`, `arraybuffer` (default otherwise), `blob`. Fetched through the board (the frame has no network), cached per revision |
| `hb.size`, `hb.onResize(fn) -> off` | `{w, h, dpr, zoom}` in CSS px; fires on card resize and zoom settle |
| `hb.theme`, `hb.onTheme(fn)` | `{scheme, foreground, mutedForeground, accent, border, card, background, fontSans, fontMono, chart[5]}`: real colour values, for canvas |
| CSS variables | `--foreground --muted-foreground --accent --border --card --background --chart-1..5 --font-sans --font-mono`, a transparent page and zero margins (the 1.9.3 theme contract; on by default for components, `nt:true` / the header switch turns it off) |
| `hb.clock` | the shared playhead, below |
| `hb.action(name, args) -> Promise<{ok, code, out, ms}>` | run an action the owner registered; see below |
| `hb.ready` | resolves with the first size |

### Data: three ways in

1. Hermes: `{"op":"comp","id":"4k","data":{"k":v},"push":{"series":[1,2]},"keep":600}` in `board_apply`
   (`data` sets top-level keys, `null` deletes, `push` appends to lists, `replace:true` starts empty).
2. A script: `POST /api/plugins/home-dashboard/boards/{board}/comp/{card}/data` with the same body
   (behind the dashboard's own auth, like live cards).
3. Large data: attach a file, up to 48 MB, up to 24 per card (`board_component attach`, or
   `PUT .../comp/{card}/files/{name}` with `{"data": "<base64>"}`, `{"text": ...}` or `{"json_value": ...}`).
   Keep `cdata` small (64 KB): it lives in the board document and in its log.

### Clock: `hb.clock`

Cards with the same `sync` group share one clock (see *Media sync*). A card with no group has a
private clock of its own, so `hb.clock` always works.

```
hb.clock.t          seconds (media time)          hb.clock.playing   hb.clock.rate
hb.clock.duration   seconds, 0 = unknown          hb.clock.group     name or null
hb.clock.master     a video drives it             hb.clock.manual    a recorder drives it
hb.clock.onTick(fn(t, clock))   every frame while playing (video frame rate, else rAF), and after seeks
hb.clock.onSeek(fn(t))          the playhead jumped
hb.clock.onState(fn(clock))     play / pause / rate / duration changes
hb.clock.play() .pause() .toggle() .seek(t) .setRate(r) .setDuration(s)
```

Draw as a pure function of state, `render(data, t, size)`, and call it from `onTick`, `onSeek`,
`onData` and `onResize`; never from your own timer. For frame-sampled data use
`Math.round(t * fps)` (a video reports `4.099998` for frame 123 at 30 fps).
`setDuration` only applies when no video drives the group.

### Actions

`hb.action("job.stop", {unit: "x"})` works only if the card lists the id (`actions: ["job.stop"]`,
set by Hermes) **and** the owner registered it in `live-actions/*.json`
([README, Live card actions](../README.md#live-card-actions-security-model)). Arguments are
validated against the action's own schema; a destructive action opens the confirmation dialog in
the dashboard before it runs; every call goes to the action log. A component can never run a
command, only name one.

## Rules for components Hermes writes

Also delivered to Hermes (`board_component action:"guide"`, tool descriptions, lint warnings):

- Fluid: `%`, flex, grid, container queries, `svg` with `viewBox`. Redraw in `hb.onResize`.
- Colours from the CSS variables or `hb.theme`; no hardcoded palette; transparent background.
- Everything inline: no CDN, no `@import`, no external fonts, no network.
- Inputs through `hb.data`, big inputs through `hb.asset`, time through `hb.clock`.
- Keep per-frame work small. Prefer `canvas` for thousands of marks.
- Save with a short `note`; patch with `edits` instead of resending the file.

`board_component` lint (advisory, returned with every save) flags: no use of the bridge, no resize
handling, network calls, many hardcoded colours, a private `requestAnimationFrame` loop that could
follow `hb.clock`, plus the 1.9.3 embed checks (fixed pixel widths, opaque backgrounds, `svg` without
`viewBox`, external fonts).

## Media sync (`sync` groups)

Any `video` (uploaded or direct file) or `comp` card can carry `sync: "<group>"`. Cards with the same
group share one clock:

- the group follows a video card's `<video>` element when there is one (frame-accurate through
  `requestVideoFrameCallback`, `currentTime` otherwise); without a video it runs on its own clock;
- play, pause, seek and rate from any linked card (the video's own controls, the shared transport at
  the bottom of the board, `hb.clock` in a component) move all of them;
- a link chip with the group name marks every synced card.

Hermes links cards with `{"op":"sync","ids":["2","5","9"],"group":"run1"}` (group optional) and unlinks
with `{"op":"unsync","ids":[...]}` or `{"op":"unsync","group":"run1"}`; the user does the same from the
right-click menu on a selection. YouTube/Vimeo players cannot be driven and cannot join a group.

### Frame-by-frame capture: `window.__hbSync`

```js
const s = window.__hbSync;      // exists while a board page is open
s.manual(true);                 // clocks stop following real time
await s.seek(0);                // resolves when the video shows that frame
s.play();                       // "playing" is now logical: nothing moves by itself
for (let i = 0; i < 300; i++) { await s.step(1, 30); /* screenshot */ }   // 1 frame at 30 fps, grid-snapped
s.manual(false);
```

`groups()`, `state(group?)`, `play/pause/seek/rate(.., group?)`, `step(frames, fps, group?)`,
`advance(ms)` (every playing group, in media time). Components get their `hb.clock` callbacks for each
step; `step` resolves after the video has seeked. Pair it with `__hbClock` / `__hbCamera`
([camera-api.md](camera-api.md)) to capture the camera and the media from one deterministic loop.

## Example

[`examples/sparkline/`](examples/sparkline/) is a complete component (a series with an optional
playhead, under 60 lines). Load it:

```
board_component create name:"sparkline" files:{"index.html": ..., "sample.json": ...}
board_apply add {k:"comp", comp:"sparkline", cdata:{label:"Requests", series:[3,5,4,8]}}
```
