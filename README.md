# Hermes Home Dashboard + Desktop

[![Follow @albertocvrrbs on X](https://img.shields.io/badge/Follow%20@albertocvrrbs-on%20X-000000?logo=x&logoColor=white&style=for-the-badge)](https://x.com/albertocvrrbs)

A customizable, *rice*-style **Home page** for the [Hermes Agent](https://github.com/NousResearch/hermes-agent) web dashboard and native Desktop app.

It adds a `Home` tab: a grid of glass widgets you can drag, resize, add and
remove. Each widget reveals **contextual controls on hover** (only outside edit
mode) — arrows, toggles, steppers — so the glass stays clean until you reach for
it. Your layout persists, and because the plugin lives under `~/.hermes/plugins/`,
it survives Hermes updates.

https://github.com/user-attachments/assets/10069980-bbb3-4d85-9e29-6069b643ce6b

---

## Install

### From the dashboard (recommended)

In the Hermes web dashboard, open the **Plugins** page → **Install from GitHub /
Git URL** and paste:

```
albertocvrrbs/hermes-home-dashboard
```

Leave **"Enable after install"** on, then click **Install**. Hermes clones the
repo into `~/.hermes/plugins/home-dashboard/`, discovers
`dashboard/manifest.json`, and the **Home** tab shows up. (If it doesn't appear,
hit **Re-scan** on the same page.)

No build step is needed — a prebuilt bundle (`dashboard/dist/`) ships in the repo.

### From the CLI

```bash
hermes plugins install albertocvrrbs/hermes-home-dashboard
```

### Hermes Desktop

Desktop has its own native plugin runtime, separate from the web dashboard.
Install the main plugin on the Hermes backend that Desktop connects to, then run
the included installer on the computer where Hermes Desktop runs. It links the
prebuilt bundle into `desktop-plugins/home-dashboard`; both locations live under
`HERMES_HOME`, so Hermes application updates do not remove them.

**Linux / macOS:**

```bash
hermes plugins install albertocvrrbs/hermes-home-dashboard --enable
node "${HERMES_HOME:-$HOME/.hermes}/plugins/home-dashboard/scripts/install-desktop.mjs"
```

**Windows PowerShell:**

```powershell
hermes plugins install albertocvrrbs/hermes-home-dashboard --enable
$HermesHome = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA "hermes" }
node (Join-Path $HermesHome "plugins\home-dashboard\scripts\install-desktop.mjs")
```

Open Hermes Desktop. It detects the plugin automatically within a few seconds;
the fallback is **Ctrl/Cmd+K → Reload desktop plugins**. Home registers as a
full native page, adds a sidebar entry and command-palette action, and opens once
when each Desktop window starts. It can be enabled or disabled under
**Settings → Plugins**.

The link/junction points at the checked-out bundle, so `hermes plugins update
home-dashboard` updates both Web and Desktop without another copy step.

If a manually copied `home-dashboard` directory already exists, the installer
preserves it beside the new link as `home-dashboard.backup-<timestamp>`.

When Desktop connects to a remote Hermes backend, the split is intentional:
`desktop/plugin.js` runs on the personal computer, while the full plugin must be
installed and enabled on the remote backend so `/api/plugins/home-dashboard/*`
can serve layout, system, analytics, cron and session data. If the UI loads but
every widget says `no data` or `offline`, repair the remote side with:

```bash
hermes plugins install albertocvrrbs/hermes-home-dashboard --force --enable
```

Then restart or reconnect that backend and reload Desktop plugins.

### Update

Because the plugin is a normal git checkout, updates are a pull:

- **Dashboard:** the plugin's **Update** button (runs `git pull --ff-only`), then
  hard-refresh the `Home` tab (Ctrl+Shift+R).
- **CLI:** `hermes plugins update home-dashboard`.

The Desktop link/junction continues pointing at the updated bundle; no Desktop
reinstallation is required.

### Uninstall

Use the plugin's **Remove** button in the dashboard, or:

```bash
rm -rf ~/.hermes/plugins/home-dashboard
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
| **Tokens** | switch range (7 days / 1 month / 6 months) · line ↔ bars chart · show/hide totals · hover a point for an animated tooltip |
| **Host** | flip meters ↔ numeric detail (load, mem, disk, proc) |
| **Gateway** | hover expands read-only detail (pid, health, config) |
| **Sessions** | paginate recent sessions |
| **Cron** | paginate upcoming jobs |
| **Logs** | switch log file: agent / errors / gateway (multi-line records grouped, level-colored) |
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

- Ships two self-contained React + Vite bundles: a **dashboard plugin**
  registered through `window.__HERMES_PLUGINS__`, and a native **Desktop
  runtime plugin** registered through `@hermes/plugin-sdk`.
- All data comes from the host's existing API (status, system, analytics,
  sessions, cron, logs) through one polling loop. A couple of widgets fetch on
  demand for their own controls — the Tokens range selector and the Logs file
  selector.
- The Python side (`dashboard/plugin_api.py`) persists the widget layout to
  `~/.hermes/plugins/home-dashboard/layout.json` and exposes plugin-scoped,
  read-only adapters for Desktop's widgets.
- Hover controls are pure CSS reveal (`:hover`), suppressed in edit mode — no
  per-widget hover state, which keeps the canvas widgets flicker-free.

## Repo layout

```
hermes-home-dashboard/
├── plugin.yaml              # pins the install folder name (home-dashboard)
├── dashboard/               # everything the Hermes host consumes
│   ├── manifest.json        # tab/entry/css/api the dashboard reads
│   ├── plugin_api.py        # FastAPI router that persists layout.json
│   └── dist/                # prebuilt bundle (committed — installer doesn't build)
│       ├── index.js
│       └── style.css
├── desktop/
│   └── plugin.js            # prebuilt native Desktop runtime plugin
├── src/                     # widget source (only needed to modify the plugin)
├── vite.config.ts           # builds src/ → dashboard/dist/
├── vite.desktop.config.ts   # builds src/ → desktop/plugin.js
├── package.json
└── tsconfig.json
```

## Development

Only needed if you want to modify the widgets.

```bash
git clone https://github.com/albertocvrrbs/hermes-home-dashboard.git
cd hermes-home-dashboard
npm install
npm run typecheck     # tsc --noEmit
npm test              # Desktop registration + host adapter contracts
npm run build         # Web bundle + Desktop plugin.js
```

Commit the regenerated `dashboard/dist/` and `desktop/plugin.js` so installs
pick up your changes (the installer clones, it never builds). To preview a web
build on a live install, copy `dashboard/dist/*` into
`~/.hermes/plugins/home-dashboard/dashboard/dist/` and hard-refresh the tab.
Desktop watches `desktop-plugins/home-dashboard/plugin.js` and hot-reloads it.

Add a new widget: create `src/home/widgets/MyWidget.tsx` and register it in
`src/home/widgets/registry.tsx`. Widgets receive `{ data, widgetProps,
onWidgetPropsChange, editing, gridSize }`; persist per-widget state with
`onWidgetPropsChange`, and use the shared `HoverArrows` / `HoverCtl` for the hover
control.

## Compatibility

- Web: requires a Hermes Agent install with the web dashboard.
- Desktop: requires a recent Hermes Desktop with the `desktop-plugins` runtime;
  verified against Hermes Agent v0.18.2.
- Uses supported plugin SDK doors and current host services, but Hermes is young
  — if a widget shows `no data`, that source may have changed upstream.

## Stay updated

Follow me on X for new versions of this plugin and other projects:

[![Follow @albertocvrrbs on X](https://img.shields.io/badge/Follow%20@albertocvrrbs-on%20X-000000?logo=x&logoColor=white&style=for-the-badge)](https://x.com/albertocvrrbs)

→ [x.com/albertocvrrbs](https://x.com/albertocvrrbs)

## License

MIT — see [LICENSE](LICENSE).
