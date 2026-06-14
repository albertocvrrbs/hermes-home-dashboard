# Hermes Home Dashboard

A customizable, *rice*-style **Home page** for the [Hermes Agent](https://github.com/NousResearch/hermes-agent) dashboard.

It adds a `Home` tab: a grid of glass widgets you can drag, resize, add and
remove. Each widget reveals **contextual controls on hover** (only outside edit
mode) — arrows, toggles, steppers — so the glass stays clean until you reach for
it. Your layout persists, and because the plugin lives under `~/.hermes/plugins/`,
it survives Hermes updates.

<!-- Add a demo GIF here once recorded, e.g.:
![demo](docs/demo.gif)
-->

---

## Quick install

No build step — a prebuilt bundle ships in the repo.

```bash
# 1. Clone into Hermes' plugin folder.
#    The inner folder MUST be named `dashboard`, and the outer one `home-dashboard`.
git clone https://github.com/<your-username>/hermes-home-dashboard.git \
  ~/.hermes/plugins/home-dashboard/dashboard

# 2. Restart the dashboard so Hermes discovers the new plugin.
systemctl --user restart hermes-dashboard
#   (or stop/start `hermes dashboard` however you run it)

# 3. Open the dashboard and click the "Home" tab. That's it.
```

> **Why those folder names?** Hermes discovers dashboard plugins at
> `~/.hermes/plugins/<name>/dashboard/manifest.json`, and this plugin's backend
> stores its layout at `~/.hermes/plugins/home-dashboard/layout.json`. Keeping the
> outer folder named `home-dashboard` keeps both in sync.

### Update

```bash
cd ~/.hermes/plugins/home-dashboard/dashboard
git pull
# hard-refresh the dashboard tab (Ctrl+Shift+R) — no restart needed for updates
```

### Uninstall

```bash
rm -rf ~/.hermes/plugins/home-dashboard
systemctl --user restart hermes-dashboard
```

---

## The grid

- **Free 12-column grid.** Drag a widget anywhere.
- **Auto-swap.** Drop a widget on another of the same size and they trade places.
- **Live reflow.** Otherwise, the rest shift down in real time to open a slot.
- **Add / remove.** Drag from the catalog to add; drop on the tray to remove.
- **Resize** from the bottom-right corner. The layout autosaves and persists.

Toggle **edit mode** with the pencil button; hover controls hide while editing so
they never fight drag/resize.

## Widgets

16 widgets, each with a hover control that fits what it does:

| Widget | Hover control |
|---|---|
| **Clock** | toggle 12/24h and seconds |
| **Calendar** | page months · 3 responsive sizes |
| **Moon** | scrub the phase ±1 day |
| **Tokens** | switch range: day / week / month |
| **Host** | flip meters ↔ numeric detail (load, mem, disk, proc) |
| **Gateway** | hover expands read-only detail (pid, health, config) |
| **Sessions** | paginate recent sessions |
| **Cron** | paginate upcoming jobs |
| **Errors** | walk the error history |
| **Notes** | quick to-dos · clear completed |
| **Pomodoro** | step work / break lengths |
| **Countdown** | alarm-style date+time picker (wheel, arrows, typing) |
| **Ascii** | cycle emblems |
| **Matrix** | tune rain speed |
| **Heartbeat** | ECG trace · tune speed |
| **Life** | Conway's Game of Life — draw live cells, pause / seed / clear |

State that should stick (ranges, formats, timer lengths…) is saved to the layout;
transient state (current page, browsed month) resets on reload.

## How it works

- Ships as a self-contained **dashboard plugin** (React + Vite), registered via
  Hermes' plugin SDK (`window.__HERMES_PLUGINS__` / `window.__HERMES_PLUGIN_SDK__`).
- All data comes from the host's existing API (status, system, analytics,
  sessions, cron, logs) through one polling loop — widgets don't fetch on their own
  (the token range selector is the one on-demand exception).
- The Python side (`plugin_api.py`) only persists the widget layout to
  `layout.json`, so it survives Hermes updates.
- Hover controls are pure CSS reveal (`:hover`), suppressed in edit mode — no
  per-widget hover state, which keeps the canvas widgets flicker-free.

## Development

Only needed if you want to modify the widgets.

```bash
git clone https://github.com/<your-username>/hermes-home-dashboard.git
cd hermes-home-dashboard
npm install
npm run typecheck     # tsc --noEmit
npm run build         # vite -> dist/index.js + dist/style.css

# install your build into the running plugin:
cp dist/index.js dist/style.css ~/.hermes/plugins/home-dashboard/dashboard/dist/
# then hard-refresh the dashboard tab
```

Add a new widget: create `src/home/widgets/MyWidget.tsx` and register it in
`src/home/widgets/registry.tsx`. Widgets receive `{ data, widgetProps,
onWidgetPropsChange, editing, gridSize }`; persist per-widget state with
`onWidgetPropsChange`, and use the shared `HoverArrows` / `HoverCtl` for the hover
control.

## Compatibility

- Requires a Hermes Agent install with the web dashboard.
- Tested on Hermes Agent v0.16.x. Uses only documented host endpoints, but Hermes
  is young — if a widget shows `no data`, that source may have changed upstream.

## License

MIT — see [LICENSE](LICENSE).
