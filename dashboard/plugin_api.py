"""Home dashboard plugin backend.

Mounted at /api/plugins/home-dashboard/ by the Hermes dashboard host.
Persists the widget layout to a JSON file inside the plugin's own directory
so it survives Hermes updates (the plugin lives under ~/.hermes/plugins/,
outside the repo that `git reset --hard` touches).
"""
from __future__ import annotations

import asyncio
import importlib
import inspect
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from hermes_constants import get_hermes_home
except ImportError:  # pragma: no cover - allows standalone unit tests
    import os as _os

    def get_hermes_home() -> Path:  # type: ignore[misc]
        val = (_os.environ.get("HERMES_HOME") or "").strip()
        return Path(val) if val else Path.home() / ".hermes"

try:
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel
except Exception:  # pragma: no cover - allows local unit tests
    class APIRouter:  # type: ignore
        def get(self, *_a, **_k):
            return lambda fn: fn

        def put(self, *_a, **_k):
            return lambda fn: fn

    class BaseModel:  # type: ignore
        pass

    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: str = "") -> None:
            self.status_code = status_code
            self.detail = detail


router = APIRouter()

LAYOUT_FILE = get_hermes_home() / "plugins" / "home-dashboard" / "layout.json"
_MAX_WIDGETS = 64
# Mirrors GRID_COLS in src/home/grid-engine.ts. Row/height caps are generous
# sanity bounds (the client has no hard maximum), there to reject corrupt
# documents such as gx=10**9 that would blow up the client grid.
GRID_COLS = 12
_MAX_ROW = 10_000
_MAX_WIDGET_HEIGHT = 1_000


def _is_int(value: Any) -> bool:
    # bool is a subclass of int; ``True`` is not a grid coordinate.
    return isinstance(value, int) and not isinstance(value, bool)


def _valid_layout(layout: Any) -> bool:
    if not isinstance(layout, dict) or layout.get("version") != 1:
        return False
    widgets = layout.get("widgets")
    if not isinstance(widgets, list) or len(widgets) > _MAX_WIDGETS:
        return False
    for w in widgets:
        if not isinstance(w, dict) or not isinstance(w.get("id"), str):
            return False
        if not all(_is_int(w.get(k)) for k in ("gx", "gy", "gw", "gh")):
            return False
        if not (0 <= w["gx"] < GRID_COLS and 1 <= w["gw"] <= GRID_COLS - w["gx"]):
            return False
        if not (0 <= w["gy"] <= _MAX_ROW and 1 <= w["gh"] <= _MAX_WIDGET_HEIGHT):
            return False
    return True


@router.get("/layout")
async def get_layout() -> Dict[str, Any]:
    """Return the saved layout, or {"layout": null} for the client default."""
    if LAYOUT_FILE.exists():
        try:
            data = json.loads(LAYOUT_FILE.read_text("utf-8"))
            if _valid_layout(data):
                return {"layout": data}
        except Exception:
            pass
    return {"layout": None}


class LayoutBody(BaseModel):
    layout: dict


@router.put("/layout")
async def set_layout(body: "LayoutBody") -> Dict[str, Any]:
    """Persist the widget layout (positions/sizes/per-widget props)."""
    if not _valid_layout(body.layout):
        raise HTTPException(status_code=400, detail="invalid layout document")
    LAYOUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    LAYOUT_FILE.write_text(json.dumps(body.layout), encoding="utf-8")
    return {"ok": True}


def _host_service(module: str, name: str) -> Any:
    """Resolve a Hermes data service from its current owner module.

    Prefers ``hermes_cli.web_routers.<x>``; falls back to the old
    ``hermes_cli.web_server`` facade only when the owner module itself does
    not exist (a pre-split host). A missing dependency *inside* an existing
    module still raises instead of being misread as an older Hermes.
    Capability detection, not version-number guessing (issue #1).
    """
    try:
        owner = importlib.import_module(module)
    except ModuleNotFoundError as error:
        if not error.name or not (module == error.name or module.startswith(error.name + ".")):
            raise
        owner = importlib.import_module("hermes_cli.web_server")
    return getattr(owner, name)


async def _call(fn: Any, **kwargs: Any) -> Any:
    """Call a host service whether it is ``def`` or ``async def``.

    Hermes mixes both: ``get_system_stats`` and ``get_sessions`` are sync
    (FastAPI runs them on a worker thread), the others are coroutines.
    Awaiting a sync one fails with ``TypeError: object dict can't be used in
    'await' expression`` (HTTP 500 on /system). Sync services run in a
    thread so they never block the event loop.
    """
    if inspect.iscoroutinefunction(fn):
        return await fn(**kwargs)
    result = await asyncio.to_thread(lambda: fn(**kwargs))
    if inspect.isawaitable(result):  # sync wrapper that returns a coroutine
        result = await result
    return result


# Hermes Desktop deliberately exposes plugin-scoped REST instead of a generic
# core-API escape hatch.  These read-only routes adapt the same current Hermes
# services the web dashboard uses, keeping the Desktop bundle inside its public
# ``ctx.rest`` boundary while preserving the richer Home widgets.
@router.get("/system")
async def get_desktop_system() -> Dict[str, Any]:
    get_system_stats = _host_service("hermes_cli.web_routers.status", "get_system_stats")
    return await _call(get_system_stats)


@router.get("/analytics")
async def get_desktop_analytics(days: int = 30, profile: str | None = None) -> Dict[str, Any]:
    get_usage_analytics = _host_service("hermes_cli.web_routers.analytics", "get_usage_analytics")
    return await _call(get_usage_analytics, days=max(1, min(365, days)), profile=profile)


@router.get("/models")
async def get_desktop_models(days: int = 30, profile: str | None = None) -> Dict[str, Any]:
    """Per (model, billing provider) usage for the Tokens widget's grouping.

    Adapts the host's ``get_models_analytics`` (the data behind the core
    Models page). Hosts that predate it answer 404 and the widget falls back
    to the per-model list inside ``/analytics``.
    """
    try:
        get_models_analytics = _host_service("hermes_cli.web_routers.analytics", "get_models_analytics")
    except AttributeError:
        raise HTTPException(status_code=404, detail="model analytics not available on this Hermes")
    return await _call(get_models_analytics, days=max(1, min(365, days)), profile=profile)


@router.get("/cron")
async def get_desktop_cron(profile: str = "all") -> list[Dict[str, Any]]:
    list_cron_jobs = _host_service("hermes_cli.web_routers.cron", "list_cron_jobs")
    return await _call(list_cron_jobs, profile=profile or "all")


@router.get("/sessions")
async def get_desktop_sessions(
    limit: int = 20,
    offset: int = 0,
    profile: str | None = None,
) -> Dict[str, Any]:
    get_sessions = _host_service("hermes_cli.web_routers.sessions", "get_sessions")
    return await _call(
        get_sessions,
        limit=max(1, min(100, limit)),
        offset=max(0, offset),
        order="recent",
        profile=profile,
    )


# ── Project status board (Projects widget) ──────────────────────────────────
#
# Reads ``<projects dir>/<name>/status.json`` — read-only, local files only.
# The directory is ``$HOME_DASHBOARD_PROJECTS_DIR`` or ``~/projects``; when it
# does not exist the widget simply shows an empty board. Every bound below is
# there so a huge or hostile directory can't stall or bloat the response.
PROJECTS_DIR_ENV = "HOME_DASHBOARD_PROJECTS_DIR"
_MAX_PROJECT_ENTRIES = 500  # directory entries examined
_MAX_PROJECTS = 50  # projects returned
_MAX_STATUS_BYTES = 64 * 1024
_MAX_TEXT = 200
_MAX_ALERTS = 10


def projects_dir() -> Path:
    raw = (os.environ.get(PROJECTS_DIR_ENV) or "").strip()
    return Path(raw).expanduser() if raw else Path.home() / "projects"


def _text(value: Any, limit: int = _MAX_TEXT) -> str:
    if isinstance(value, bool) or value is None:
        return ""
    if isinstance(value, (int, float)):
        value = str(value)
    if not isinstance(value, str):
        return ""
    value = " ".join(value.split())
    return value if len(value) <= limit else value[: limit - 1] + "…"


def _count(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    if value != value:  # NaN
        return 0
    return max(0, min(10**9, int(value)))


def _normalize_project(entry: str, data: Any) -> Optional[Dict[str, Any]]:
    """Keep only the documented fields, typed and length-bounded."""
    if not isinstance(data, dict):
        return None
    stats = data.get("stats") if isinstance(data.get("stats"), dict) else {}
    alerts = data.get("alerts") if isinstance(data.get("alerts"), list) else []
    return {
        "id": entry,
        "project": _text(data.get("project")) or entry,
        "status": _text(data.get("status"), 40) or "unknown",
        "lastUpdated": _text(data.get("lastUpdated"), 64) or None,
        "stats": {
            "inbox": _count(stats.get("inbox")),
            "inProgress": _count(stats.get("inProgress")),
            "completed": _count(stats.get("completed")),
        },
        "alerts": [a for a in (_text(x) for x in alerts[:_MAX_ALERTS]) if a],
        "nextAction": _text(data.get("nextAction")),
    }


def _inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def scan_projects(root: Path) -> List[Dict[str, Any]]:
    """Collect ``<root>/<name>/status.json`` summaries, sorted by name.

    Names come from the directory listing (never from the request), symlinks
    that resolve outside ``root`` are skipped, oversized or invalid JSON is
    ignored, and the scan stops after a fixed number of entries.
    """
    try:
        base = root.resolve(strict=True)
    except (OSError, RuntimeError):
        return []
    if not base.is_dir():
        return []
    try:
        with os.scandir(base) as it:
            names = []
            for i, item in enumerate(it):
                if i >= _MAX_PROJECT_ENTRIES:
                    break
                if not item.name.startswith("."):
                    names.append(item.name)
    except OSError:
        return []

    projects: List[Dict[str, Any]] = []
    for name in sorted(names, key=str.lower):
        if len(projects) >= _MAX_PROJECTS:
            break
        try:
            status = (base / name / "status.json").resolve(strict=True)
            if not _inside(status, base) or not status.is_file():
                continue
            if status.stat().st_size > _MAX_STATUS_BYTES:
                continue
            data = json.loads(status.read_text("utf-8"))
        except (OSError, RuntimeError, ValueError):
            continue
        project = _normalize_project(name, data)
        if project is not None:
            projects.append(project)
    return projects


@router.get("/projects")
async def get_projects() -> Dict[str, Any]:
    """Project status board for the Projects widget (contributed in #4)."""
    return {"projects": await asyncio.to_thread(scan_projects, projects_dir())}
