#!/usr/bin/env python3
"""Push data to a Home Dashboard live card from any script.

Two ways in:

* **Local** (default): writes through the plugin's own board store, on the machine that runs
  Hermes. No network, no token: file permissions are the boundary. Safe to run next to the
  dashboard and the agent (writes are locked and atomic).
* **HTTP** (``--url``): ``POST /api/plugins/home-dashboard/boards/<board>/live/<card>/data``
  behind the dashboard's own auth. Pass the dashboard session token (``--token``, sent as
  ``X-Hermes-Session-Token``) or a cookie header (``--cookie``) from a logged-in browser.

Examples::

    live_push.py --board "Training" --card 1a --set status=running --set success=81.4 --push success_hist=81.4
    live_push.py --board k3x9p2qa --card 1a --json '{"stage": "chapter 31", "eta": 2280}'
    live_push.py --url http://127.0.0.1:9119 --token "$HERMES_DASHBOARD_SESSION_TOKEN" \\
                 --board k3x9p2qa --card 1a --set status=done

Values: numbers are parsed (``81.4``), ``true``/``false``/``null`` too (null deletes the key);
anything else is text. ``--push`` appends to a series (``--keep`` trims it, default 120).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any, Dict


def hermes_home() -> Path:
    val = (os.environ.get("HERMES_HOME") or "").strip()
    return Path(val) if val else Path.home() / ".hermes"


def load_service(plugin_dir: Path | None = None):
    """The plugin's BoardService, imported from the installed plugin."""
    base = plugin_dir or hermes_home() / "plugins" / "home-dashboard"
    sys.path.insert(0, str(base / "dashboard"))
    from boardkit.service import BoardService  # type: ignore
    return BoardService(hermes_home() / "plugin-data" / "home-dashboard" / "boards")


def parse_value(text: str) -> Any:
    low = text.strip().lower()
    if low in ("true", "false"):
        return low == "true"
    if low == "null":
        return None
    try:
        return json.loads(text) if text.strip()[:1] in "[{\"" else float(text) if any(c in text for c in ".eE") else int(text)
    except ValueError:
        return text


def pairs(items) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for item in items or []:
        if "=" not in item:
            raise SystemExit(f"expected key=value, got {item!r}")
        k, v = item.split("=", 1)
        out[k.strip()] = parse_value(v)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--board", required=True, help="board id, or its name (local mode)")
    ap.add_argument("--card", required=True, help="live card id (board_read shows it)")
    ap.add_argument("--set", action="append", metavar="KEY=VALUE")
    ap.add_argument("--push", action="append", metavar="KEY=VALUE")
    ap.add_argument("--json", help="a JSON object merged into --set")
    ap.add_argument("--keep", type=int)
    ap.add_argument("--replace", action="store_true", help="start the data bag from empty")
    ap.add_argument("--url", help="dashboard base URL for HTTP mode, e.g. http://127.0.0.1:9119")
    ap.add_argument("--token", help="dashboard session token (HTTP mode)")
    ap.add_argument("--cookie", help="Cookie header from a logged-in browser (HTTP mode)")
    ap.add_argument("--plugin-dir", type=Path, help="installed plugin folder (local mode)")
    a = ap.parse_args()

    data = pairs(a.set)
    if a.json:
        data.update(json.loads(a.json))
    push = pairs(a.push) or None

    if a.url:
        body = json.dumps({"data": data or None, "push": push, "keep": a.keep, "replace": a.replace}).encode()
        req = urllib.request.Request(f"{a.url.rstrip('/')}/api/plugins/home-dashboard/boards/{a.board}/live/{a.card}/data",
                                     data=body, method="POST", headers={"Content-Type": "application/json"})
        if a.token:
            req.add_header("X-Hermes-Session-Token", a.token)
        if a.cookie:
            req.add_header("Cookie", a.cookie)
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(resp.read().decode())
        return 0

    svc = load_service(a.plugin_dir)
    doc = svc.store.find(a.board)
    if doc is None:
        raise SystemExit(f"no board {a.board!r}")
    new, entry = svc.live_update(doc["id"], a.card, data or None, push, a.keep, a.replace)
    print(json.dumps({"board": doc["id"], "seq": new["seq"], "at": new["items"][a.card].get("at")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
