"""Text the agent reads about custom components: a short rules block (tool descriptions) and the full
bridge contract (``board_component action:'guide'``). Kept in step with docs/components.md."""

COMPONENT_RULES = (
    "Custom components: the plugin ships NO fixed cards - when the user needs a view that does not exist (a "
    "network, a gauge, a heatmap, a timeline, a controller panel) YOU write it with board_component "
    "(create/update; each save is a new version, rollback available) and put it on a board with "
    "{op:'add', item:{k:'comp', comp:'<name>', w, h, cdata:{...}}}. It runs in a sandboxed iframe with NO network, "
    "so inline everything (no CDN, no fonts). The page talks to the board only through window.hb (v1): "
    "hb.data / hb.onData(fn) (your inputs, live), hb.asset(name, {as:'json'|'text'|'arraybuffer'}) -> Promise (big "
    "files attached with board_component attach: weights, traces, series - never put MBs in cdata), hb.size / "
    "hb.onResize(fn) (always redraw; the card is resizable), hb.theme + CSS vars --foreground --muted-foreground "
    "--accent --border --card --chart-1..5 --font-sans --font-mono (theme is on: transparent background, no hardcoded "
    "colours), hb.clock {t, playing, rate, duration, onTick(fn(t)), onSeek, onState, play(), pause(), seek(t)} "
    "(a playhead shared with video cards/other components in the same sync group - draw from t, never from your "
    "own timer, so a recording can step it frame by frame), hb.action(name, args) -> Promise (only action ids "
    "listed in the card's actions:[...] and registered by the owner; destructive ones ask the user). Build fluid "
    "(%/flex/grid, svg viewBox), redraw in hb.onResize, draw from hb.data so updates are cheap "
    "({op:'comp', id, data:{k:v}, push:{series:n}} pushes live data). Link cards to one clock with "
    "{op:'sync', ids:[video, comp, ...]} (video master). Lint warnings come back with every save; fix them."
)

GUIDE = """HOME DASHBOARD COMPONENTS - bridge contract v1 (window.hb)

A component is index.html (+ optional .js/.css/.json/.svg files, inlined for you) that you write with
board_component. It is rendered in <iframe sandbox="allow-scripts"> (opaque origin, no cookies, no storage of
the dashboard), CSP default-src none (inline script/style, data:/blob: images only, connect-src none): no network,
no external libs or fonts - inline them. window.hb is injected before your scripts.

hb.version                  1
hb.component                {name, version} this card runs (version like "v3")
hb.data                     object: the card's cdata (or sample.json from the component when empty)
hb.onData(fn) -> off        fn(data, changedKeys) now (when data exists) and on every update; the board
                            sends it when Hermes does {op:'comp', id, data|push} or a script POSTs
                            /boards/{bid}/comp/{iid}/data
hb.assets                   names of data files attached to this card
hb.asset(name, {as}) -> Promise   as: 'json' | 'text' | 'arraybuffer' | 'blob' (default json for .json, else
                            arraybuffer). Fetched through the board, cached; call again after hb.onData if
                            hb.assets changed (revision in hb.assetRev[name]).
hb.size {w,h,dpr,zoom}, hb.onResize(fn) -> off     CSS px of the card body; fires on card resize
hb.theme {scheme,foreground,mutedForeground,accent,border,card,background,fontSans,fontMono,chart[5]},
hb.onTheme(fn)              colours are real values for canvas drawing; for DOM/SVG use the CSS variables
hb.clock                    shared playhead of the card's sync group (or a private clock when not linked):
  .t seconds, .playing, .rate, .duration (0 when unknown), .group (null when not linked), .manual
  .onTick(fn(t, clock)) -> off    every frame while playing (video frame rate or rAF), and once after seeks
  .onSeek(fn(t)), .onState(fn(clock))   play/pause/rate/duration/seek changes
  .play() .pause() .toggle() .seek(t) .setRate(r) .setDuration(s)   (any linked card controls the group)
hb.action(name, args) -> Promise<{ok,code,out,ms}>   name must be in the card's actions:[...] and registered by the
                            owner (board_read actions:true lists them); args are validated against the action's
                            schema; destructive actions show a confirmation to the user first
hb.ready                    Promise resolved when the first size/theme/data/clock arrived

Rules: fluid layout, redraw on hb.onResize, colours from the CSS variables or hb.theme (never hardcoded), transparent
background, draw everything from hb.data / hb.clock (a pure function of state: render(data, t, size)), keep per-frame
work small, no timers for animation that should follow a video: use hb.clock.onTick. Large inputs: attach a file.
Version it: every board_component update is a new version (v2, v3...); instances follow the latest unless pinned.
"""
