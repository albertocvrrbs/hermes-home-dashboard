# Live cards: examples

A live card is a board card bound to something that keeps running: a training run, a
backup, a scraper, a deploy. Hermes (or you) creates it once with a declarative spec, and
then a script or the agent only sends new **data**. Buttons on the card can only run
**actions the machine owner registered in advance**.

- [`live-cards/live_push.py`](live-cards/live_push.py): push data from any script (local or HTTP).
- [`live-cards/actions.example.json`](live-cards/actions.example.json): a sample action allowlist.
- [`training-run/spider_adapter.py`](training-run/spider_adapter.py): a full adapter for an
  RL training run folder (status, chapter, success %, elapsed, cost, sparkline, latest clip,
  log), with a Stop action example in [`actions.spider.json`](training-run/actions.spider.json)
  that ships **disabled**.

## 1. Create a card

Ask Hermes ("add a live card for my backup job") or write the op yourself with
`board_apply`. Using the `training` template:

```json
{"op": "add", "ref": "$run", "item": {
  "k": "live", "tpl": "training", "title": "Gait training", "ttl": 180, "w": 400,
  "actions": [{"action": "train.stop", "label": "Stop", "args": {"run": "$run"}}],
  "data": {"name": "Gait training · run 9", "status": "running", "run": "run-9"}}}
```

Or a spec of your own. Any value can be a literal or a `"$key"` read from `data`:

```json
{"k": "live", "title": "Nightly backup", "ttl": 900, "blocks": [
  {"t": "header", "title": "$name", "sub": "$stage", "status": "$status", "icon": "hard-drive"},
  {"t": "progress", "value": "$done", "max": "$total", "label": "Files", "eta": "$eta"},
  {"t": "metrics", "items": [
    {"label": "Copied", "value": "$bytes", "fmt": "num", "unit": "B"},
    {"label": "Errors", "value": "$errors", "fmt": "int", "delta": "$errors_delta", "good": "down"}]},
  {"t": "spark", "series": "$speed", "label": "MB/s"},
  {"t": "media", "image": "$last_shot", "caption": "$shot_caption"},
  {"t": "text", "value": "$log", "lines": 5},
  {"t": "actions", "items": [{"action": "backup.run", "label": "Back up now"}]}]}
```

| block | fields |
| --- | --- |
| `header` | `title`, `sub`, `status` (`running` `paused` `done` `error` `idle`), `icon` (lucide name: `activity`, `gauge`, `cpu`, `rocket`, `hard-drive`, `flask-conical`…) |
| `progress` | `value` (0-1, a percent, or with `max`), `label`, `eta` (seconds or text) |
| `metrics` | `items: [{label, value, fmt, unit, delta, good: up/down}]` (up to 8) |
| `spark` | `series` (list of numbers), `label`, `fmt`, `min`, `max` |
| `media` | `video` or `image` (board asset id or http(s) URL), `poster`, `caption` |
| `text` | `value` (text or list of lines; the tail is shown), `lines`, `label`, `mono` |
| `actions` | `items: [{action, label, icon, args}]` (up to 4; ids only) |

`fmt` is `num`, `int`, `pct`, `usd`, `dur` (seconds) or `text`. Strings are shown as sent, so
a script can pre-format anything. Templates: `training`, `job`, `stat`; their data keys are
the `$names` in [`live.py`](../dashboard/boardkit/live.py) (`TEMPLATES`).

`ttl` (seconds, default 300) is how long a `running`/`paused` card may go without news
before it says **stale**. The card shows "updated 12 s ago" from the server's clock.

## 2. Send data

**From the agent:** `{"op": "live", "id": "<card>", "data": {"success": 81.4}, "push": {"success_hist": 81.4}}`.
`data` sets keys (`null` deletes one), `push` appends to a series (`keep` trims it, default
120 points), `replace: true` starts from an empty bag.

**From a script on the same machine** (no network, no token):

```bash
python3 live_push.py --board "Training" --card 1a --set status=running --set success=81.4 --push success_hist=81.4
```

**Over HTTP**, behind the dashboard's own authentication:

```bash
curl -X POST "http://127.0.0.1:9119/api/plugins/home-dashboard/boards/<board>/live/<card>/data" \
  -H "X-Hermes-Session-Token: $HERMES_DASHBOARD_SESSION_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"status": "running", "success": 81.4}, "push": {"success_hist": 81.4}}'
```

```python
import json, os, urllib.request
req = urllib.request.Request(
    "http://127.0.0.1:9119/api/plugins/home-dashboard/boards/k3x9p2qa/live/1a/data",
    data=json.dumps({"data": {"status": "done"}}).encode(), method="POST",
    headers={"Content-Type": "application/json",
             "X-Hermes-Session-Token": os.environ["HERMES_DASHBOARD_SESSION_TOKEN"]})
print(urllib.request.urlopen(req).read().decode())
```

The token header works when the dashboard runs with `HERMES_DASHBOARD_SESSION_TOKEN` set; a
dashboard behind a login (OAuth/password gate) wants that session's cookie instead
(`live_push.py --cookie`). There is no separate per-card token: the route uses whatever
protects the rest of your dashboard. Data writes are logged as system changes: they never
land in your undo stack and never count as "the user changed the board" for Hermes.

## 3. Register actions

Buttons name an action **id**. The id must exist in a JSON file you write in
`~/.hermes/plugin-data/home-dashboard/live-actions/` (any `*.json`, see
[`actions.example.json`](live-cards/actions.example.json)):

```json
{"actions": [{
  "id": "jobs.stop", "label": "Stop job", "destructive": true, "timeout": 30,
  "description": "Stops a systemd user unit.",
  "confirm": "The job stops right away. It can be started again later.",
  "command": ["/usr/bin/systemctl", "--user", "stop", "{unit}"],
  "args": {"unit": {"type": "string", "pattern": "^job-[a-z0-9-]{1,40}\\.service$"}}}]}
```

- `command` is an argv list with an absolute program path, run **without a shell**;
  `{name}` placeholders are replaced by argument values as whole text, after the values pass
  the schema. Or `http: {method, url, headers, json}` for a local service.
- `args` types: `string` (with `pattern`; the default allows `A-Z a-z 0-9 _ . : @ / + = , -`,
  no leading dash, no spaces), `int`/`number` (`min`, `max`), `bool`, `enum` (`choices`).
  The values come from the card's button (`args`, which may read `$keys` from data), never
  from the click.
- `destructive: true` opens a confirm dialog, and the server refuses the call without that
  confirmation. `enabled: false` keeps the button greyed out (with your `note` as tooltip).
- Every press (allowed or refused) is logged in
  `~/.hermes/plugin-data/home-dashboard/live-actions.log.jsonl`: time, who (dashboard + client
  address), board, card, action, args, result, exit code, output tail, duration. The card
  shows the result in a toast.
- Hermes sees the registered ids (not the commands) with `board_read {"actions": true}`.
- Python code running in the dashboard process can register in-process actions with
  `boardkit.actions.register(spec, handler)`.

## 4. The training-run adapter

```bash
python3 spider_adapter.py print  --runs-dir /path/to/runs --run v9            # check the mapping
python3 spider_adapter.py create --runs-dir /path/to/runs --run v9 --board "Training"
python3 spider_adapter.py push   --runs-dir /path/to/runs --run v9 --board "Training" --card <id> --every 30
```

It reads `estado.json`, `metricas.jsonl`, `log.txt` and the newest clip in `capitulos/`,
uploads the clip once as a board video (with its poster), and pushes only when the run's
files change, so a dead run turns the card stale. To get a working Stop button, copy
`actions.spider.json` into `live-actions/`, fix its paths, read its note and enable it.
