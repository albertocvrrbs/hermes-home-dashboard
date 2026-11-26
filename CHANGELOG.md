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
