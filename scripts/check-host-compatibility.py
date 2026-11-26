"""Opt-in integration check against an installed Hermes (not standalone stubs).

Run with the Hermes venv Python from this repository root:
    /path/to/hermes/venv/bin/python scripts/check-host-compatibility.py

No user config, sessions, or credentials are loaded: HERMES_HOME is a
temporary directory. Host compatibility warnings are treated as errors, so a
deprecated import path fails here before Hermes removes it.

Based on the tested patch in issue #1 (thanks @cygnostik).
"""
from __future__ import annotations

import os
import sys
import tempfile
import warnings
from pathlib import Path

ROUTES = {
    "/layout": (dict, "layout"),
    "/system": (dict, "memory"),
    "/analytics?days=7": (dict, "totals"),
    "/cron?profile=default": (list, None),
    "/sessions?limit=2&offset=0&profile=default": (dict, "sessions"),
}


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="home-dashboard-check-") as home:
        os.environ["HERMES_HOME"] = home
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        # Hermes' own top-level modules (e.g. ``persistence``) resolve from its
        # checkout root, which the dashboard process has on sys.path.
        import hermes_cli

        sys.path.append(str(Path(hermes_cli.__file__).resolve().parents[1]))
        warnings.filterwarnings("error", message=r"hermes plugin compat:.*")

        from fastapi import APIRouter, FastAPI
        from fastapi.testclient import TestClient

        from dashboard.plugin_api import router

        assert isinstance(router, APIRouter), "integration check requires real FastAPI"
        app = FastAPI()
        app.include_router(router, prefix="/api/plugins/home-dashboard")

        failures = 0
        with TestClient(app, raise_server_exceptions=False) as client:
            for route, (kind, required) in ROUTES.items():
                response = client.get("/api/plugins/home-dashboard" + route)
                if response.status_code == 503 and "not initialized" in response.text:
                    # A fresh temporary home has no session store yet; the host
                    # answering 503 here is the adapter working, not a failure.
                    print(f"SKIP {route}: HTTP 503 (empty temporary home, no session store)")
                    continue
                ok = response.status_code == 200
                if ok:
                    data = response.json()
                    ok = isinstance(data, kind) and (required is None or required in data)
                print(f"{'PASS' if ok else 'FAIL'} {route}: HTTP {response.status_code}")
                failures += not ok
        return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
