# Changelog

All notable changes to the Home dashboard plugin.

## Versioning convention

Small releases, shipped often:

- **Patch** (`1.3.x`) — bug fixes, polish, tweaks to existing widgets,
  micro-features. The default bump for day-to-day work.
- **Minor** (`1.4.0`) — a batch of new widgets, or a feature that changes
  how the Home itself works.
- **Major** (`2.0.0`) — redesigns or breaking changes to the persisted
  layout schema.

Every release updates the version in `package.json`, `plugin.yaml` and
`dashboard/manifest.json`, rebuilds both bundles (`npm run build`), and
commits the regenerated `dashboard/dist/` + `desktop/plugin.js` (installs
clone, they never build).

---

## 1.10.0 — video parity

Everything the launch video shows now works for real, with real Hermes, from one chat
instruction: your project files on the board, components Hermes writes for you on the spot,
video and components on one clock, presentation tours with camera flights, and a demo mode
for recording.

**Gateway restart needed.** The Python board engine changes (new `import`, `set_where`,
`zones`, `arrange`, `place`, `comp`, `sync`, `unsync`, `tour` ops; `mark`, `sync`, `file`
fields; the new `board_component` tool). A running gateway keeps the old Python until it is
restarted, and the Webapp is served by the gateway. Restart it after updating (and
`hermes-dashboard` if you run it as a service).

### Your project on the board

- **Hermes imports project files** (`import` op): images, SVG (rasterised, scripts refused),
  videos (poster + duration), PDFs (first-page thumbnail, click to open), STL/OBJ/3MF (shaded
  3D thumbnail, click to download), text and code as cards with fenced code. Globs and folders
  ("put my renders here"), copied into the board asset store (never hotlinked), placed on a
  tidy grid. Only paths inside your home; hidden folders and secret-looking files are refused.
- **Big orders in one instruction and one undo step**: `set_where` (set fields on every match,
  e.g. mark 37 stations), `zones` (titled frames in order, items moved in by rule, gridded
  inside), `arrange`, `place`. New `mark` stamp (ok / fail / wait) on cards, boxes and media.

### Custom components (no fixed cards)

- **Components platform.** The plugin does not ship a neural-network card or any other
  one-off card: Hermes writes the component you need with the new `board_component` tool
  (create, update with `edits` patches, versions `v1`, `v2`..., diff, rollback, delete). They
  live in your component library and are reusable on any board.
- A `comp` card runs one in a sandboxed iframe (opaque origin, CSP, no network) with a small,
  stable `window.hb` v1 bridge: `data` / `onData`, `asset()` for big files (tens of MB),
  `size` / `onResize`, `theme`, `clock`, `action()` (owner's allowlist only, destructive
  actions confirm). Gallery with live thumbnails in the toolbar and right-click menu; card
  menu with versions, update, reload, theme switch and source. See `docs/components.md`.

### Media sync

- `sync` group on video and component cards: one shared clock per group (a video is the
  master, frame-accurate through `requestVideoFrameCallback`), shared transport and link
  chips, `sync` / `unsync` ops for Hermes, "Link to a clock" for you, and `window.__hbSync`
  for deterministic frame-by-frame capture.

### Presentation mode

- Tours: an ordered list of stops (frames, items, sub-boards, saved views) stored in the
  board. Full-window playback with eased camera flights, dives into sub-boards and back,
  optional dwell per stop and auto-play, a quiet HUD, keyboard control. Hermes builds one in
  one call (`tour` op, e.g. "make a tour through the zones"); `window.__hbTour` for recorders.

### Demo mode

- `?demo[&now=ISO][&nomap]`: frozen clock for the whole plugin (clock widget, "saved",
  "ago", live-card freshness), neutral host name and Cron / Logs / Sessions rows, no money in
  Tokens and Spend, no session ids in the board chat, minimap toggle (`M`). Off by default,
  never touches stored data.

### Fixed

- Image cards stacked the low-res thumbnail on top of the full picture.
- A card with a fixed height (an imported file excerpt) now clips and fades instead of
  growing to the full file length.

---

## 1.9.3

Direct editing, arrange and insert on connectors, a real camera, and HTML embeds
that can wear the Hermes theme. Plus a round of visual and i18n fixes.

**Gateway restart needed.** This release changes the Python board engine
(`shape` kind, `insert_on_edge` / `tidy` ops, `theme` and `sh` fields). The
plugin loads, but a running Hermes gateway keeps the old Python until it is
restarted; the Webapp is served by the gateway. Until then new fields are
dropped silently and the new ops answer with an error. Restart the gateway
after updating (and `hermes-dashboard` if you run it as a service).

- **Edit in place.** Double-click (or double-tap) a note, to-do title or item,
  column title, link/video title, image caption, shape or connector label and
  you type right there, caret under the pointer. The double-tap is detected by
  the board itself: the old `dblclick` was swallowed by pointer capture. Select
  an item and type to start editing, or press `F2` / `Enter`.
- **Arrange and snap.** *Arrange* (toolbar, right-click menu, `Ctrl/Cmd+Shift+O`)
  lays the selection or the whole board out in reading order with even gaps, as
  one undo step; items that stay put (wired ones, frames) are obstacles, so the
  tidied block never lands on top of them. Dragging snaps to the grid and to
  neighbours' edges and centres, with guides; hold `Ctrl/Cmd` to place freely.
  Connectors follow every frame while you drag, resize or arrange (the wires
  are memoised and re-routed only for the items that moved).
- **Insert on a connector.** Hover a connector (or select it on touch) and press
  its **+**: pick a rectangle, diamond, pill, circle, text, note, to-do... and
  it lands in the middle of the connector, making room, in one undo step. New
  `shape` item kind (`sh`: rect, diamond, pill, circle) and agent ops
  `insert_on_edge` and `tidy`.
- **Camera.** One eased, interruptible controller drives every move (fit, zoom to
  selection with `Z`, step zoom, `Ctrl`+wheel notch). `window.__hbCamera` exposes
  `flyTo` / `getView` / `setView` / `fit` with a manual clock for frame-by-frame
  capture (`docs/camera-api.md`). Opening a sub-board flies into its card and
  crossfades into the board; the Home's Board widget hands off into the page
  the same way.
- **Level of detail.** Zoomed out, titles stay legible (counter-scaled), body text
  becomes skeleton lines and images switch to small thumbnails, so a 150-item
  board stays smooth. The minimap is cached and `M` toggles it.
- **Faithful miniatures.** The Board widget on the Home and nested-board cards
  render the real item components (same renderers and styles) scaled down,
  instead of a flat sketch.
- **Themed HTML embeds (opt-in).** An embed Hermes creates can carry `theme`:
  Hermes' colour variables, fonts, transparent background and a responsive
  bridge (`window.hermes`: size, zoom, theme change, Chart.js / ECharts
  defaults). Toggle it per card from its menu; your own HTML is shown untouched.
  The agent rules cover it and an advisory lint flags embeds that fight the card.
- **Fixes.** Live cards keep metric values whole and accents intact; connector
  labels sit above cards in their own layer; sub-board cards follow their
  child board; the board chat shows what Hermes is doing instead of ids;
  dates, gateway states and board deep links follow the plugin language; Tokens
  no longer sticks on *loading* and each source lands as soon as it answers;
  Home rows stretch to fill tall windows; the edit button uses lucide icons;
  long titles, tags and headings stay inside narrow cards; deleting a selection
  with a cascade no longer fails the whole batch and a rejected batch shows a
  notice.

---

## 1.9.2

A real dot-matrix Hermes emblem, and a Draw tool with proper ink.

- **Hermes widget: true proportions.** The emblem used to be braille text, and
  a monospace cell is not 1:2, so the caduceus came out stretched. It is now
  painted on a canvas as real dots on a square grid: the pitch is a whole
  number of device pixels (crisp on HiDPI, no beating), the grid is re-laid on
  every resize (ResizeObserver, coalesced to one frame) and the canvas sits
  over its slot, so nothing shifts. Same look as before: the theme accent, the
  dim-bright-dim vertical gradient and the soft glow. If a browser can't give a
  2D canvas, the braille caduceus comes back as text.
- **Hermes widget: a mythology set.** The official banner caduceus (decoded dot
  for dot from `hermes_cli/banner.py`) stays first and the default. After it:
  kerykeion (a drawn caduceus with a true double helix: the snakes pass over
  and under each other and the staff), talaria (winged sandal), petasos
  (winged hat), lyre (the tortoise-shell chelys), tortoise, drachma (Hermes in
  profile wearing the petasos, beaded rim) and a wing. Each is drawn as clean
  vectors and Floyd–Steinberg dithered at the widget's own resolution, so a
  bigger widget gets more dots, not fatter ones. Pyramid and diamond are gone;
  layouts that pointed at them open on the petasos and the drachma. The choice
  is now stored by name (`art`), and the old `artIndex` is still read.
- **Hermes widget: quiet motion.** Dots resolve in when the design changes, and
  every 15 s a faint glint crosses the dots. Animation frames only run during
  those moments, only while the widget is visible, and never under
  `prefers-reduced-motion`; idle, nothing ticks.
- **Draw tool options.** With Draw (`D`) active, a sub-toolbar in the status
  bar's style (lucide icons, name + shortcut tips, separators, wraps instead of
  overflowing) offers:
  - **Pen**, **highlighter** (`⇧D`: wide, translucent, layered under the ink),
    **eraser** (`E` while drawing: whole strokes, and the strokes under it fade
    on hover before you erase) and **lasso** (loop around strokes, then drag
    the selection, delete it, or group it).
  - **Line, arrow, rectangle, ellipse.** Shift snaps lines to 45° and makes
    squares and circles; Alt draws from the centre.
  - **Three widths** (`[` `]`), a **restrained palette** (`1`–`6`: the theme's
    ink and accent plus sage, clay, slate and sand, mid-tones that read on dark
    and light themes), **dashed**, and **smoothing** (off / on / strong).
  - Settings are remembered between visits.
- **Smooth mouse ink without lag.** Strokes read every coalesced pointer event
  and run through a One Euro filter: strong smoothing when the hand is slow
  (jitter goes), almost none when it is fast (no drag). The live stroke is the
  filtered path plus a tail to the real pointer (and the browser's predicted
  point), painted once per frame, so the ink stays under the cursor. On
  release the stroke is cleaned with a zoom-aware Ramer–Douglas–Peucker pass
  and a centripetal Catmull–Rom spline, and stored compact (integers, at most
  400 points). Mice get the strongest smoothing, touch less, pens almost none;
  pen pressure is kept and drives the tapered outline.
- **Groups.** `⌘G` / `Ctrl+G` (or the selection bar) groups selected strokes;
  clicking one picks the whole group, duplicating a group makes a new one.
  Selections made only of strokes offer "Turn into a diagram" to Hermes.
- **Data model.** Draw items gain optional fields only: `tl` (`hl`, `line`,
  `arrow`, `rect`, `ellipse`), `c` (palette name), `ds` (dashed), `sm`
  (tapered), `pr` (pressure digits) and `g` (group). boardkit validates every
  one, old strokes are untouched, and Hermes reads them in the board outline,
  in `board_render` snapshots (shapes, colours and highlights drawn properly)
  and in the `board_apply` help, so he can draw shapes too. Every action is a
  single undoable batch.
- **Upgrade note.** The new fields need the updated `boardkit` running in the
  server that serves the board: until the gateway (Webapp/Desktop) or the
  dashboard restarts, a shape is saved as a plain stroke.

## 1.9.1

A model picker in the board's chat.

- **Model picker in the chat panel.** The panel header now shows the model of
  the board's linked session. On Hermes Desktop and the Webapp it opens
  Desktop's own model menu — the SDK's `ModelCatalogMenu`, the component the
  chat composer renders — so search, provider groups, favourites, `-fast`
  families, MoA presets, *Refresh models* and the per-model
  thinking/effort/speed submenu are the real thing, not a copy. A pick is a
  session-scoped switch of the board's session (`config.set model
  "<model> --provider <p> --session"`), like a secondary chat tile, so your
  profile default never changes; effort and speed edits on the active model go
  to the session too, edits on other models are remembered for when you pick
  them. The gateway stores the choice with the session, so it survives reloads.
  Guarded (expensive) switches ask through Desktop's confirm dialog; failures
  roll back and toast. Every SDK piece is feature-detected: an older Desktop
  shows the model as text instead of failing to load.
- **Web dashboard:** the model shows read-only, read from the stored session
  (`GET /api/sessions/{id}`); there is no session RPC there to switch it.
- **Fix: the plugin now follows Desktop's language.** The language probe used a
  dotted key, which Desktop's translator reads as a nested path, so the Home
  and the boards fell back to the browser's language (English) even with
  `display.language: es`.
- The panel resumes the board's session lazily once (no messages, no agent
  build) and retries while the gateway is still connecting, so the header and
  the first send share one live session.

## 1.9.0

Live cards, and posters for every video.

- **Live cards.** A new board card that stays bound to something running: a
  training run, a backup, a scraper, a deploy. Hermes builds it from a short
  declarative spec of blocks (header with a status pill, progress with ETA,
  metrics with deltas, a sparkline, an image or video, a log tail, buttons),
  or from a template (`training`, `job`, `stat`). Any value is a literal or a
  `"$key"` read from the card's data, so after that only the data changes:
  - from the agent, with the new `live` op in `board_apply` (`data`, `push`
    for series, `keep`, `replace`);
  - from a script on the same machine, through the plugin's local store
    (`examples/live-cards/live_push.py`, no network, no token);
  - over HTTP, `POST /api/plugins/home-dashboard/boards/{board}/live/{card}/data`,
    behind the dashboard's own auth.
  Data updates are system writes: they stay out of your undo history and out
  of what Hermes hears as "the user changed the board". The card shows
  "updated 12 s ago" and says **stale** when a running job goes quiet past the
  card's TTL; running, paused, done, error and idle each have their own pill.
  Metrics reflow from four columns to pairs on narrow cards, buttons go
  icon-only, wide cards get a taller chart. Hermes-made cards wear his
  dot-matrix edge like everything else he writes.
- **Actions, safe by design.** Buttons name an action id from an allowlist the
  machine owner writes in `~/.hermes/plugin-data/home-dashboard/live-actions/*.json`
  (or registers from Python in the dashboard process). Commands are argv lists
  run without a shell, with an absolute program path, a minimal environment and
  a timeout; arguments come from the card and are checked against the action's
  schema on every press. Destructive actions open a confirm dialog and the
  server refuses them without it; disabled ones stay greyed out with the
  owner's note. Every press, allowed or refused, is logged to
  `live-actions.log.jsonl`, and the card shows the result in a toast. Cards
  that try to carry a `command`, `url` or `shell` are rejected; the agent sees
  ids and descriptions (`board_read {"actions": true}`), never commands, and
  can't run them.
- **Examples.** `examples/README.md` (block reference, curl and Python),
  `examples/live-cards/actions.example.json`, and
  `examples/training-run/spider_adapter.py`, a complete adapter for a
  reinforcement-learning run folder (status, chapter, success %, elapsed,
  cost, success sparkline, latest evaluation clip, log tail) whose Stop action
  ships disabled in `actions.spider.json`.
- **Video posters.** Uploaded and linked video cards show a still frame and
  the duration before anyone presses play. Drop or paste an MP4, WebM or MOV
  (up to 100 MB, sent in chunks) and the server grabs a frame ~1 s in (10 %
  into short clips) with `ffmpeg`; video links get theirs the first time a card
  is shown, so cards made before 1.9.0 fill in by themselves without editing
  the board. Posters are image assets plus a small index in `posters/`. With
  no `ffmpeg`, or when the server can't fetch the video, the browser grabs the
  frame (`<video preload=metadata>` + canvas) and stores it, or shows the
  paused video element. Uploaded videos play from the board's own storage.
- **Menu polish.** *Select all* in the table's right-click menu has its icon,
  like every other row.

Needs a restart of whatever serves the board API (the `hermes dashboard`
process, and the gateway for the Webapp) so the new routes load; until then
the cards render, but their buttons say the action list isn't available.

## 1.8.1

Board polish, after seeing 1.8.0 in Hermes Desktop.

- **Icons and tooltips.** Every tool in the bottom bar, every selection and
  menu action, the board list and the Board widget's hover controls now use
  lucide icons, the same set and version Hermes Desktop draws its chrome with
  (bundled and tree-shaken, 2 px stroke). Names and shortcuts moved from
  permanent text into one tooltip style: a short delay, then the name and its
  key (`Ctrl+` or `⌘` by platform), flipped and clamped to the window. Every
  keyboard shortcut still works.
- **Selection bar, rebuilt.** It lives in screen space now, so it keeps one
  size at any zoom, sits above the selection, flips below it near the top and
  never leaves the view. Hermes' verbs keep their label, and edit, open,
  connect, duplicate and delete are icon buttons with separators. This fixes
  the crowded bar where "duplicate" and "delete" ran together.
- **Right-click menus.** On a card: Hermes' verbs, then edit, open, connect,
  duplicate, delete. On the table: add any kind of item right there, select
  all, fit, chat. Arrow keys move through it, Esc closes it.
- **Connect to…** from the bar or the menu: click the card to link to.
- **Fix: mouse-wheel zoom.** The wheel listener was attached before the board
  had loaded, so it never reached the table. Now a mouse wheel zooms around
  the pointer with a short ease, Ctrl/⌘+wheel and trackpad pinch zoom
  directly, a two-finger trackpad scroll pans (Shift+wheel pans sideways),
  all clamped to 20-240 %. HTML embeds sit behind a click-to-interact shield,
  so the wheel zooms over them too until you click into one.
- **Chat panel instead of the `hermes ›` prompt.** A collapsible panel docked
  on the right shows the linked session's recent turns styled like the
  Desktop chat, with a composer that sends into that session. Toggle with the
  header button or `/`, close with Esc, drag to resize; it remembers both, and
  floats over the board when the window is narrow. Desktop and the Webapp read
  with `session.transcript` and send with `prompt.submit`; the web dashboard
  reads `/api/sessions/{id}/messages` and hands off to the session to send.
- **Two typefaces, both the host's.** Card text and controls use Hermes
  Desktop's UI sans (`--dt-font-sans`, or the dashboard's sans), and headers,
  counts and keys use the Home's mono. Atkinson Hyperlegible, Departure Mono
  and Architects Daughter are gone, along with their embedded files: about
  66 KB of font data left `desktop/plugin.js`, and the dashboard stylesheet
  went from 118 KB to 60 KB. Sketch labels now use the UI sans in italic.
- **Native surface.** On Desktop the board takes the app's editor surface and
  elevated popover colors instead of a hardcoded teal, so it matches the rest
  of the window in every theme.
- **Smaller touches.** An empty board shows an icon and one line. The bottom
  bar gains undo and redo, and a hint for the active tool. The minimap hides
  on an empty board and highlights on hover. Transitions run 120-200 ms
  ease-out, and reduced motion turns them off, tooltips included.

## 1.8.0

- **Board.** An infinite canvas where Hermes works with you. Cards, to-do
  lists, columns, link cards, images, sandboxed HTML embeds, video cards,
  nested boards, connectors and freehand sketches. Undo/redo, a minimap, and a
  terminal-style status line with keys and a `hermes ›` prompt.
- **Hermes draws on it.** New agent tools `board_read` (outline, or only what
  changed since his last read), `board_apply` (one batched call of ops) and
  `board_render` (a PNG of a region, so he can read your sketches). His edits
  show up live with a visible cursor and his name. A dot-matrix border marks
  what he made.
- **One session per board.** "Continue in session" opens the board's linked
  session. In that session a `pre_llm_call` hook tells Hermes, in a few lines,
  what you changed on the board since his last turn. Unlinked sessions are
  never touched.
- **Paste a link, get a card.** Pasted or dropped URLs become link cards. The
  plugin backend fetches the title, description, site, favicon and image
  server-side (Open Graph, Twitter card, oEmbed) with an SSRF guard: http(s)
  only, private, loopback, link-local and metadata addresses blocked (also
  after redirects), at most 3 redirects, a 5 s deadline and byte caps. Images
  are copied into the board's assets, never hotlinked.
- **Video cards.** YouTube (including Shorts and youtu.be), Vimeo, Loom, X
  posts and direct `.mp4/.webm/.mov` play inline. The poster shows first and
  the player loads on click, one at a time, via youtube-nocookie and
  player.vimeo. Resizing keeps the aspect ratio. Pasted image URLs become
  image cards.
- **Board widget + Boards page.** A live dot-matrix preview of a board on the
  Home (arrows cycle boards). Click it to open the full page. On Desktop,
  "Boards" sits in the sidebar and in the command palette.
- **Agent widget retired.** The Board takes its place. A saved layout that
  had the Agent widget gets the Board in the same slot, and other unknown
  widget ids are dropped without breaking the layout.
- **Header controls (1.7.2, folded in).** Hover controls sit inside the header
  row, without a box, show only on hover and never stay stuck after a click.
  The title hides when space is tight, and the Pomodoro sits below the header.

## 1.7.1

- **Cleaner widget headers.** The header rule is now drawn in CSS instead of
  box-drawing glyphs: a short lead rule, even spacing around the title, and a
  hairline that fades out, so the line never touches the text.
- **Hover controls never cover the title.** The control chip is solid (the rule
  no longer shows through it) and keeps clear of the title; on narrow widgets
  it wraps onto a second row instead of overlapping.

## 1.7.0 — 2026-11-27

Feature release: a widget for what Hermes costs in money, not tokens.
Verified against Hermes 0.23.4 (web dashboard).

- **New widget: Spend.** Real pay-per-use spend for today / 7 days / this
  month, split by provider, with the value covered by flat-fee subscriptions
  shown apart and never added to it (e.g. "Claude subscription covered $1,818").
  Below: the month so far with a month-end projection, an optional monthly cap
  (hover stepper, persisted) that turns the line amber when spend nears it or
  the projection passes it and red once spend reaches it, and the five most
  expensive sessions in range (all costs or real only) — click one to open it.
  Estimated (list-price) amounts are marked `est.`; costs that can't be
  classified, unpriced sessions and sessions without cost data are counted
  instead of hidden.
- **How spend is classified.** Hermes prices every call but has no analytics
  route carrying cost status and billing mode per provider, so a new
  read-only `/spend` route reads `state.db` (`mode=ro`, bounded to ~31 days,
  row-capped). Per call: a route Hermes marks `included` is a subscription; so
  are flat-fee providers (`openai-codex`, Copilot) and Anthropic when every
  configured Anthropic credential is OAuth (a Claude Pro/Max plan, which Hermes
  prices at API list price); providers with only API keys are real spend;
  anything else (mixed or removed credentials, unknown cost) is
  `unclassified`. Costs come from the per-call usage table, so a session that
  switched provider is split correctly (the session row alone bills it all to
  the last provider). Credentials are read as they are configured now, from
  the active profile. `?profile=` reads another profile's store.
- **Open a session from a widget.** The host adapter gains `openSession(id)`:
  `/chat?resume=<id>` on the web (the Sessions page's own target),
  `host.openSession` on Desktop, falling back to the sessions view on older
  builds.
- `scripts/check-host-compatibility.py` also exercises `/models` and `/spend`.

## 1.6.0 — 2026-11-26

Feature release: two ideas from #3, a localized UI, and the Project Status
widget from #4. Verified against Hermes 0.23.4 (web dashboard + Webapp).

- **Tokens: group by provider or by model.** A new hover toggle (`all` →
  `provider` → `model`) adds a breakdown under the chart for the selected
  range: tokens, share and cost per provider or model. Provider identity comes
  from the host's per-model analytics (the Models page data), through the web
  SDK and a new read-only `/models` adapter for Desktop; older hosts fall back
  to the per-model list. Suggested by @Phenix704 in #3.
- **Sessions: sort and filter by token usage.** Hover toggles switch `recent`
  ↔ `tokens` (heaviest first) and step a minimum of input + output tokens (all
  / ≥10K / ≥100K / ≥1M) over the recent sessions already loaded (now 20).
  Suggested by @Phenix704 in #3.
- **Localization: English and Spanish.** Every widget, the agent theater and
  the edit/grid chrome go through a shared translation layer
  (`src/home/i18n/`). The language follows the host (`display.language` on
  Desktop / Webapp, the dashboard's own picker on the web), else the browser;
  missing strings fall back to English. Adding a language is one file — see
  *Adding a language* in the README. Asked about by @Phenix704 in #3.
- **New widget: Projects.** A status board for
  `~/projects/<name>/status.json` (or `$HOME_DASHBOARD_PROJECTS_DIR`), ported
  from PR #4 by @AgJavis-hub with a bounded, read-only, traversal-safe backend
  scan.
- `plugin.yaml` declares `requires_hermes: ">=0.21.5"`.

## 1.5.1 — 2026-11-26

Bug-fix release: the backend loads and every data route answers on current
Hermes (verified against Hermes 0.23.4).

- **Fix: plugin loader refused the package** (#5, #6). The repo shipped no
  root `__init__.py`, so the agent plugin loader logged `No __init__.py in
  ...` on every reload. A no-op `register(ctx)` root module now ships
  (approach from PR #4 by @AgJavis-hub).
- **Fix: Host widget `/system` returned HTTP 500.** `get_system_stats` is a
  sync function in Hermes, and awaiting its dict raised `TypeError`. Host
  services are now called correctly whether they are `def` or `async def`,
  and the Python test fakes mirror the real signatures.
- **Host compatibility** (#1). Data services resolve from their current
  `hermes_cli.web_routers.*` owners and fall back to the old
  `hermes_cli.web_server` facade only on a pre-split host; a missing
  dependency inside an existing module still raises. New
  `scripts/check-host-compatibility.py` exercises the real HTTP adapters
  against an installed Hermes. `npm test` now runs the Python tests too.
- **Install scanner** (#2). Cross-directory imports in `src/` use an `@/`
  alias instead of deep relative chains, and the README no longer uses
  `rm -rf` or a raw `git clone` URL, so `hermes plugins install` scans
  clean. The built bundles are unchanged in behavior.
- **Layout validation:** saved layouts with out-of-grid geometry (negative,
  zero-size, bool or huge coordinates) are rejected instead of breaking the
  client grid.
- `package-lock.json` version had drifted to 1.3.0; all four version fields
  agree again (spotted in forks).
- README: troubleshooting for the `offline` / `unavailable` state (enable,
  doctor, restart).

## 1.5.0 — 2026-09-27

Polish pass, verified in a live Hermes Desktop.

- **Logs:** Windows hosts return CRLF lines, which the parser read as one fake
  `INFO` record holding the raw tail (the "INFO … INFO" line). Lines are now
  split correctly, the `[session]` tag no longer hides the component, rows show
  `HH:MM:SS`, and the list scrolls inside the widget with a soft bottom fade
  instead of spilling past the edge.
- **Widget states:** the single `● no data` is replaced by `offline` (backend
  unreachable), `unavailable` (one source failing) and a `stale` header tag
  that keeps the last good data on screen during a failed poll.
- **Agent:** the stats row no longer overflows 8px below the widget.
- **Matrix:** the canvas is sized to whole glyph rows — no half-cut bottom row.
- **Sessions / Cron:** names ellipsize at the real column width with the full
  name on hover, instead of a fixed character cut ("bitacoras-guayab").
- **Contrast:** widget headers and the Hermes version caption are readable.

## 1.4.1 — 2026-09-27

- **Fix: HUD mode no longer breaks.** The "open Home once per start" hook
  also ran inside Desktop's auxiliary windows (HUD, pop-out session, pop-out
  browser), each of which has its own `sessionStorage`. In the HUD it
  navigated to `/home`, replacing the chat with a clipped Home page and
  dropping the session route. Windows carrying `?win=` are now left alone.

## 1.4.0 — 2026-09-27

- **Fix: plugin loads again on current Hermes.** Hermes removed the
  `hermes_cli.web_server.*` compatibility re-exports on 2026-09-14, so the
  backend (`plugin_api.py`) was refused at load and the Home layout/data
  routes stopped working. The Desktop data adapters now import from the
  defining modules under `hermes_cli.web_routers` (`status`, `analytics`,
  `cron`, `sessions`); analytics range clamp aligned to the host's 1–365 days.
- **Agent widget** with take-control theater mode, animated live scene,
  markdown scene and tool-first priority.
- **Install (Windows):** the Desktop plugin is copied instead of junctioned,
  and backups live outside `desktop-plugins/`.

## 1.3.0 — 2026-08-03

- **Host: live graphs view.** Third view in the hover cycle
  (meters → detail → graphs): four sparklines — cpu, ram, load, proc —
  over a rolling one-minute window sampled every 2s. Tokens-style area
  gradient; percent signals pin to 0–100, load/proc autoscale to the
  window peak; missing sources draw as gaps, never zeros.
- Pure series logic extracted to `hostSeries.ts` with `node:test`
  coverage (21 tests). Legacy persisted view values coerce safely.
- `layout.json` (per-install user state) is now gitignored.

## 1.2.1 and earlier

Pre-changelog era: initial grid + 16 widgets, Tokens/Logs redesign,
native Desktop runtime plugin and installer, caduceus refinements.
See `git log` for details.
