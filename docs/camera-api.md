# Board camera API

Scripts (the video director, QA) can drive the board's camera deterministically. The API
exists while a board page is open, on `window.__hbCamera`; `window.__hbClock` is there as soon
as the Home page with a Board widget is.

## Moves

```js
const cam = window.__hbCamera;
await cam.flyTo({ fit: true });                                  // whole board
await cam.flyTo({ item: "3k" });                                  // one item
await cam.flyTo({ items: ["3k", "3l"], pad: 120, maxZ: 1.2 });    // several
await cam.flyTo({ rect: { x: 0, y: 0, w: 900, h: 600 } });       // a world rectangle
await cam.flyTo({ selection: true });                             // what is selected
await cam.flyTo({ view: { x: -300, y: -120, z: 0.8 } });          // an exact view
```

Options on every move: `duration` (ms; default 300–650 by distance, `0` jumps), `ease`
(`"out" | "inOut" | "in" | "linear" | "spring"`, a function of 0..1, or CSS
`[x1, y1, x2, y2]`), `pad` (screen px around the target, default 80), `minZ` / `maxZ`.
A move resolves `true` when it arrives and `false` when something cut it short (the user
touched the board, or a newer move took over). Zoom moves as a dolly: zoom changes
geometrically and the point under the centre of the screen travels at an even screen speed.

Other calls: `fit(opts)`, `getView()`, `setView(view)`, `itemRect(id)`, `cancel()`,
`moving()`, `minimap(on)`.

Events work too: `window.dispatchEvent(new CustomEvent("hb:camera", { detail: { item: "3k", id: "shot-4" } }))`
runs the move and answers with `hb:camera:end` (`detail: { id, completed, view }`).

## Frame-by-frame capture

```js
const clock = window.__hbClock;          // same object as __hbCamera.clock
clock.manual(true);                      // camera time stops
cam.flyTo({ fit: true, duration: 800 });
clock.advance(1000 / 24);                // one 24 fps frame; screenshot; repeat
clock.manual(false);
```

`advance(ms, step = 1000/60)` runs the queued frames in `step`-sized slices. The page
transitions (Home widget → board, nested board in and out) run on the same clock, so they can
be stepped the same way: freeze the clock, click, `advance`.

## Keys and chrome

`F` fits, `Z` zooms to the selection (everything when nothing is selected), `+` / `-` zoom in
steps, `M` shows or hides the minimap (`cam.minimap(false)` does the same). All of them are
eased and are cut short by any wheel, drag or key. Under `prefers-reduced-motion` every move
is a jump and the zoom transitions are plain navigations.

## Shared media clock

`window.__hbSync` steps the board's media (video cards and components in a `sync` group) the
same way: `manual(true)`, `seek(t)`, `step(frames, fps)`, `advance(ms)`. See
[components.md](components.md#frame-by-frame-capture-window__hbsync).

## Tour API (`window.__hbTour`)

Presentation mode (`src/board/tour.ts`, `usePresentation.ts`) publishes `window.__hbTour` once a board is open,
next to `__hbCamera`. Its flights go through the same `Camera`, so the same manual clock (`__hbClock.manual(true)`,
`__hbClock.advance(ms)`) makes a whole tour deterministic, auto-play dwell included (dwell waits on that clock too).

| Call | Does |
| --- | --- |
| `start({from?, auto?, duration?, hud?, fullscreen?})` | Starts presenting at stop `from` (0). Resolves `true` when the camera arrives there. `duration` = ms per flight (default 700-1700 by distance). `auto` defaults to "some stop or the tour has a dwell". `hud:false` hides the controls. Plays the stored tour, else the frames in reading order. |
| `next()` / `prev()` / `goto(i)` | Resolve when the flight lands. `next()` on a board stop dives into the sub-board (the tour continues there and returns). Past the last stop it ends (or wraps when the tour loops). |
| `auto(on)` | Auto-play on/off. |
| `stops()` | `[{stop, title, view}]`: what will play and the camera view each stop flies to. |
| `state()` | `{on, i, n, auto, flying, done}` |
| `hud(on)`, `stop()` | Show / hide the HUD; stop and hand control back. |

The tour itself is document data (`doc.tour = {stops, loop?, dw?, t?}`, stop = `{k, id? | r? | v?, t?, dw?}`) written
with the `tour` op of `board_apply` (see the README, "Presentation mode: tours").
