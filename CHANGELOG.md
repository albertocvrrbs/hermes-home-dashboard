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
