"""Home dashboard plugin backend.

Mounted at /api/plugins/home-dashboard/ by the Hermes dashboard host.
Persists the widget layout to a JSON file inside the plugin's own directory
so it survives Hermes updates (the plugin lives under ~/.hermes/plugins/,
outside the repo that `git reset --hard` touches).
"""
from __future__ import annotations

import asyncio
import calendar
import importlib
import importlib.util
import inspect
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timedelta, timezone
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
    from fastapi import APIRouter, HTTPException, Request
    from pydantic import BaseModel
except Exception:  # pragma: no cover - allows local unit tests
    Request = Any  # type: ignore[misc,assignment]

    class APIRouter:  # type: ignore
        def get(self, *_a, **_k):
            return lambda fn: fn

        def put(self, *_a, **_k):
            return lambda fn: fn

        def post(self, *_a, **_k):
            return lambda fn: fn

        def delete(self, *_a, **_k):
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


# ── Spend (Spend widget) ────────────────────────────────────────────────────
#
# What Hermes costs in money, not tokens. Hermes records a cost per session
# and per (session, model, provider) in ``state.db`` but exposes no analytics
# route that carries the cost *status* and billing mode per provider, so this
# reads the store directly: read-only (``mode=ro``), bounded windows (at most
# ~31 days) and a hard row cap.
#
# Classification of every cost row, first match wins:
#
# 1. ``subscription`` — Hermes itself marked it ``cost_status='included'`` /
#    ``billing_mode='subscription_included'`` (e.g. the ChatGPT-backed
#    ``openai-codex`` route).
# 2. ``subscription`` — a flat-fee provider (``SUBSCRIPTION_PROVIDERS``), or a
#    provider id that says so (contains "subscription").
# 3. ``subscription`` — a provider in ``SUBSCRIPTION_WHEN_OAUTH`` (Anthropic:
#    Claude Pro/Max) whose configured credentials are *all* OAuth. Hermes
#    prices those calls at API list price (``estimated``) because it does not
#    distinguish them, so the dollars are "value covered", not an invoice.
# 4. ``metered`` — the provider's configured credentials are all API keys
#    (pay per token: DeepSeek, OpenRouter, OpenAI API, ...).
# 5. ``unclassified`` — anything else (mixed credentials, no credential
#    configured any more, unknown cost status).
#
# Limits: the credential check reflects the credentials configured *now*, not
# at the time of the call, and comes from the active profile even when another
# profile's store is read.
SPEND_PERIODS = ("today", "week", "month")
SUBSCRIPTION_PROVIDERS = frozenset({"openai-codex", "copilot", "copilot-acp", "claude-code"})
SUBSCRIPTION_WHEN_OAUTH = frozenset({"anthropic"})
_SPEND_MAX_ROWS = 50_000
_SPEND_TOP = 5
_MAX_UTC_OFFSET_MIN = 14 * 60


def spend_db_path(profile: Optional[str] = None) -> Path:
    """``state.db`` of ``profile`` (None = the serving profile)."""
    if not profile:
        return get_hermes_home() / "state.db"
    try:
        resolve = getattr(importlib.import_module("hermes_cli.web_server_sessions"), "_session_db_path_for_profile")
    except (ImportError, AttributeError):
        raise HTTPException(status_code=404, detail="profile stores not available on this Hermes")
    try:
        return Path(resolve(profile))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="unknown profile")


def credential_auth_types() -> Dict[str, set]:
    """Provider id -> set of credential auth types (``oauth`` / ``api_key``).

    Uses Hermes' own ``read_credential_pool``; only the ``auth_type`` field is
    read, never a secret. Any failure means "unknown" (an empty map).
    """
    try:
        read_pool = getattr(importlib.import_module("hermes_cli.auth"), "read_credential_pool")
        pool = read_pool()
    except Exception:
        return {}
    kinds: Dict[str, set] = {}
    if not isinstance(pool, dict):
        return kinds
    for provider, entries in pool.items():
        if not isinstance(provider, str) or not isinstance(entries, list):
            continue
        types_ = {str(e.get("auth_type") or "api_key") for e in entries if isinstance(e, dict)}
        if types_:
            kinds[provider.strip().lower()] = types_
    return kinds


def classify_cost(provider: str, billing_mode: str, cost_status: str, auth: Dict[str, set]) -> tuple:
    """(class, basis) for one cost row. See the section comment for the rules."""
    p = (provider or "").strip().lower()
    status = (cost_status or "").strip().lower()
    if status == "included" or (billing_mode or "").strip().lower() == "subscription_included":
        return "subscription", "hermes"
    if status == "unknown":
        return "unclassified", "unknown_cost"
    if p in SUBSCRIPTION_PROVIDERS or "subscription" in p:
        return "subscription", "provider"
    kinds = auth.get(p) or set()
    if p in SUBSCRIPTION_WHEN_OAUTH and kinds == {"oauth"}:
        return "subscription", "oauth"
    if kinds == {"api_key"}:
        return "metered", "api_key"
    if not p:
        return "unclassified", "no_provider"
    return "unclassified", "mixed_credentials" if len(kinds) > 1 else "no_credentials"


def spend_window(period: str, now: float, utc_offset_min: int) -> Dict[str, float]:
    """Window start for ``period`` plus the current calendar month's bounds,
    in the client's local time (``utc_offset_min`` = local minus UTC)."""
    off = max(-_MAX_UTC_OFFSET_MIN, min(_MAX_UTC_OFFSET_MIN, int(utc_offset_min))) * 60
    local = datetime.fromtimestamp(now + off, tz=timezone.utc)
    day_start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    days_in_month = calendar.monthrange(local.year, local.month)[1]
    starts = {
        "today": day_start.timestamp() - off,
        "week": now - 7 * 86400,
        "month": month_start.timestamp() - off,
    }
    return {
        "start": starts[period],
        "end": now,
        "month_start": starts["month"],
        "month_end": (month_start + timedelta(days=days_in_month)).timestamp() - off,
        "days_in_month": float(days_in_month),
    }


def _num(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value != value:
        return 0.0
    return max(0.0, float(value))


# Per-call usage for sessions in the window, grouped per (session, route):
# session_model_usage splits a session that switched model or provider and
# carries auxiliary calls; sessions without any such rows (older data) fall
# back to their own aggregate. Mirrors how Hermes' Models analytics counts.
_SPEND_USAGE_SQL = """
SELECT u.session_id, COALESCE(u.billing_provider, ''), COALESCE(u.billing_mode, ''),
       COALESCE(u.cost_status, ''), SUM(COALESCE(u.estimated_cost_usd, 0)),
       SUM(COALESCE(u.actual_cost_usd, 0))
FROM session_model_usage u JOIN sessions s ON s.id = u.session_id
WHERE s.started_at >= ? AND s.started_at < ?
GROUP BY 1, 2, 3, 4
LIMIT ?
"""
_SPEND_SESSIONS_SQL = """
SELECT s.id, COALESCE(s.billing_provider, ''), COALESCE(s.billing_mode, ''),
       COALESCE(s.cost_status, ''), COALESCE(s.estimated_cost_usd, 0), COALESCE(s.actual_cost_usd, 0)
FROM sessions s
WHERE s.started_at >= ? AND s.started_at < ?
  AND NOT EXISTS (SELECT 1 FROM session_model_usage u WHERE u.session_id = s.id)
LIMIT ?
"""
_SPEND_COUNT_SQL = "SELECT COUNT(*) FROM sessions WHERE started_at >= ? AND started_at < ?"


def _spend_rows(conn: sqlite3.Connection, start: float, end: float) -> List[tuple]:
    has_usage = bool(conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_model_usage'").fetchone())
    rows: List[tuple] = []
    if has_usage:
        rows += conn.execute(_SPEND_USAGE_SQL, (start, end, _SPEND_MAX_ROWS)).fetchall()
        rows += conn.execute(_SPEND_SESSIONS_SQL, (start, end, _SPEND_MAX_ROWS)).fetchall()
    else:
        rows += conn.execute(_SPEND_SESSIONS_SQL.replace(
            "\n  AND NOT EXISTS (SELECT 1 FROM session_model_usage u WHERE u.session_id = s.id)", ""),
            (start, end, _SPEND_MAX_ROWS)).fetchall()
    return rows


def _empty_bucket() -> Dict[str, Any]:
    return {"total": 0.0, "estimated": 0.0, "actual": 0.0, "providers": {}}


def _summarize(rows: List[tuple], auth: Dict[str, set]) -> Dict[str, Any]:
    """Fold cost rows into real / covered / unclassified buckets + per session."""
    buckets = {"metered": _empty_bucket(), "subscription": _empty_bucket(), "unclassified": _empty_bucket()}
    sessions: Dict[str, Dict[str, Any]] = {}
    basis: Dict[str, str] = {}
    unknown: set = set()
    for sid, provider, mode, status, est, act in rows:
        est, act = _num(est), _num(act)
        # Actual (invoiced) beats the estimate when the provider reported one.
        amount, kind = (act, "actual") if act > 0 else (est, "estimated")
        if amount <= 0:
            if (status or "").lower() == "unknown":
                unknown.add(sid)  # usage Hermes could not price
            continue
        cls, why = classify_cost(provider, mode, status, auth)
        name = provider or ""
        basis.setdefault(name, why)
        b = buckets[cls]
        b["total"] += amount
        b[kind] += amount
        p = b["providers"].setdefault(name, {"provider": name, "cost": 0.0, "estimated": 0.0,
                                               "actual": 0.0, "sessions": set(), "basis": why})
        p["cost"] += amount
        p[kind] += amount
        p["sessions"].add(sid)
        s = sessions.setdefault(sid, {"cost": 0.0, "metered": 0.0, "subscription": 0.0, "unclassified": 0.0,
                                      "actual": 0.0, "providers": {}})
        s["cost"] += amount
        s[cls] += amount
        s["actual"] += amount if kind == "actual" else 0.0
        s["providers"][name] = s["providers"].get(name, 0.0) + amount
        by_class = s.setdefault("class_providers", {}).setdefault(cls, {})
        by_class[name] = by_class.get(name, 0.0) + amount
    return {"buckets": buckets, "sessions": sessions, "basis": basis,
            "unknown_sessions": len(unknown - set(sessions))}


def _bucket_json(b: Dict[str, Any]) -> Dict[str, Any]:
    providers = sorted(b["providers"].values(), key=lambda p: (-p["cost"], p["provider"]))
    return {
        "total": round(b["total"], 4),
        "estimated": round(b["estimated"], 4),
        "actual": round(b["actual"], 4),
        "by_provider": [
            {**p, "cost": round(p["cost"], 4), "estimated": round(p["estimated"], 4),
             "actual": round(p["actual"], 4), "sessions": len(p["sessions"])}
            for p in providers
        ],
    }


def _top_sessions(conn: sqlite3.Connection, sessions: Dict[str, Dict[str, Any]], key: str) -> List[Dict[str, Any]]:
    ranked = sorted(((sid, s) for sid, s in sessions.items() if s[key] > 0),
                    key=lambda item: (-item[1][key], item[0]))[:_SPEND_TOP]
    if not ranked:
        return []
    ids = [sid for sid, _ in ranked]
    meta = {
        r[0]: r[1:]
        for r in conn.execute(
            f"SELECT id, title, display_name, source, started_at, model FROM sessions WHERE id IN ({','.join('?' * len(ids))})",
            ids,
        ).fetchall()
    }
    out = []
    for sid, s in ranked:
        title, display, source, started, model = meta.get(sid, (None, None, None, None, None))
        # The provider behind the ranked amount: the largest metered one when
        # ranking real spend, else the largest overall.
        pool = s.get("class_providers", {}).get(key) if key in ("metered", "subscription", "unclassified") else None
        pool = pool or s["providers"]
        main = max(pool.items(), key=lambda kv: kv[1])[0] if pool else ""
        classes = [c for c in ("metered", "subscription", "unclassified") if s[c] > 0]
        out.append({
            "id": sid,
            "title": _text(title) or _text(display) or None,
            "source": _text(source, 40) or None,
            "model": _text(model, 80) or None,
            "started_at": started,
            "provider": main,
            "cost": round(s[key], 4),
            "class": classes[0] if len(classes) == 1 else "mixed",
            "actual": s["actual"] > 0,
        })
    return out


def compute_spend(db_path: Path, period: str = "week", utc_offset_min: int = 0,
                  now: Optional[float] = None, auth: Optional[Dict[str, set]] = None) -> Dict[str, Any]:
    """The Spend widget payload. Pure apart from the read-only store read."""
    if period not in SPEND_PERIODS:
        period = "week"
    now = time.time() if now is None else now
    auth = credential_auth_types() if auth is None else auth
    win = spend_window(period, now, utc_offset_min)
    base = {"period": period, "currency": "USD", "window": {"start": win["start"], "end": win["end"]}}
    if not db_path.is_file():
        return {**base, "available": False, "has_data": False}
    uri = f"file:{db_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=5)
    try:
        conn.execute("PRAGMA query_only = ON")
        cur = _summarize(_spend_rows(conn, win["start"], win["end"]), auth)
        month = cur if period == "month" else _summarize(
            _spend_rows(conn, win["month_start"], win["end"]), auth)
        sessions_in_range = conn.execute(_SPEND_COUNT_SQL, (win["start"], win["end"])).fetchone()[0]
        top = _top_sessions(conn, cur["sessions"], "cost")
        top_real = _top_sessions(conn, cur["sessions"], "metered")
    except sqlite3.Error:
        return {**base, "available": False, "has_data": False}
    finally:
        conn.close()

    elapsed_days = max(1.0, (now - win["month_start"]) / 86400)
    month_real = month["buckets"]["metered"]["total"]
    costed = len(cur["sessions"])
    return {
        **base,
        "available": True,
        "has_data": costed > 0,
        "real": _bucket_json(cur["buckets"]["metered"]),
        "covered": _bucket_json(cur["buckets"]["subscription"]),
        "unclassified": {**_bucket_json(cur["buckets"]["unclassified"]), "unknown_cost_sessions": cur["unknown_sessions"]},
        "month": {
            "start": win["month_start"],
            "end": win["month_end"],
            "days": int(win["days_in_month"]),
            "elapsed_days": round(elapsed_days, 3),
            "real": round(month_real, 4),
            "covered": round(month["buckets"]["subscription"]["total"], 4),
            "unclassified": round(month["buckets"]["unclassified"]["total"], 4),
            "projection": round(month_real / elapsed_days * win["days_in_month"], 4),
        },
        "sessions": {"in_range": sessions_in_range, "with_cost": costed,
                     "without_cost": max(0, sessions_in_range - costed)},
        "top": top,
        "top_real": top_real,
        "classification": cur["basis"],
    }


@router.get("/spend")
async def get_spend(period: str = "week", utc_offset: int = 0, profile: str | None = None) -> Dict[str, Any]:
    """Money spent vs value covered by subscriptions, for the Spend widget."""
    path = spend_db_path(profile)
    return await asyncio.to_thread(compute_spend, path, period, utc_offset)


# ── Boards (infinite canvas) ─────────────────────────────────────────────
# The board backend lives in dashboard/boardkit/ and is shared with the agent half
# (__init__.py). This module is loaded standalone by the dashboard host (not as a
# package), so boardkit is loaded by path under a private module name.

_BOARDKIT = "home_dashboard_boardkit"
_board_service: Any = None


def _boardkit(sub: str) -> Any:
    if _BOARDKIT not in sys.modules:
        pkg = Path(__file__).resolve().parent / "boardkit"
        spec = importlib.util.spec_from_file_location(
            _BOARDKIT, pkg / "__init__.py", submodule_search_locations=[str(pkg)])
        if spec is None or spec.loader is None:
            raise ImportError("boardkit not found")
        module = importlib.util.module_from_spec(spec)
        sys.modules[_BOARDKIT] = module
        spec.loader.exec_module(module)
    return importlib.import_module(f"{_BOARDKIT}.{sub}")


def boards_root() -> Path:
    return get_hermes_home() / "plugin-data" / "home-dashboard" / "boards"


def board_service() -> Any:
    global _board_service
    if _board_service is None:
        _board_service = _boardkit("service").BoardService(boards_root())
    return _board_service


def _board_call(fn: Any, *args: Any, **kwargs: Any) -> Any:
    """Map board errors to HTTP: bad input 400, unknown board/asset 404, refused action 403/409."""
    engine = _boardkit("engine")
    store = _boardkit("store")
    assets = _boardkit("assets")
    actions = _boardkit("actions")
    try:
        return fn(*args, **kwargs)
    except actions.ActionError as e:
        status = {"busy": 409, "confirm": 428, "unknown": 404, "not_on_card": 404}.get(e.code, 403)
        if e.code == "bad_args":
            status = 400
        raise HTTPException(status_code=status, detail={"code": e.code, "message": str(e)})
    except store.NotFound as e:
        raise HTTPException(status_code=404, detail=str(e) or "not found")
    except assets.AssetError as e:
        status = 404 if "no such asset" in str(e) else 400
        raise HTTPException(status_code=status, detail=str(e))
    except engine.OpError as e:
        raise HTTPException(status_code=400, detail=str(e))


class BoardCreateBody(BaseModel):
    name: str = "Untitled board"
    parent: Optional[str] = None


class BoardOpsBody(BaseModel):
    ops: list
    note: Optional[str] = None


class BoardUndoBody(BaseModel):
    s: int


class BoardAssetBody(BaseModel):
    data: Optional[str] = None
    html: Optional[str] = None


class BoardUrlBody(BaseModel):
    url: str


class LiveDataBody(BaseModel):
    data: Optional[dict] = None
    push: Optional[dict] = None
    keep: Optional[int] = None
    replace: bool = False


class LiveActionBody(BaseModel):
    action: str
    index: Optional[int] = None
    confirm: bool = False


class CompDataBody(BaseModel):
    data: Optional[dict] = None
    push: Optional[dict] = None
    keep: Optional[int] = None
    replace: bool = False


class CompFileBody(BaseModel):
    data: Optional[str] = None      # base64 bytes
    text: Optional[str] = None      # or plain text
    json_value: Optional[Any] = None  # or any JSON value (stored as JSON)


class CompActionBody(BaseModel):
    action: str
    args: Optional[dict] = None
    confirm: bool = False


class CompSaveBody(BaseModel):
    name: str
    html: Optional[str] = None
    files: Optional[dict] = None
    edits: Optional[list] = None
    remove: Optional[list] = None
    replace: bool = False
    title: Optional[str] = None
    desc: Optional[str] = None
    note: Optional[str] = None


class VideoChunkBody(BaseModel):
    upload: str
    i: int
    n: int
    data: str


class PosterBody(BaseModel):
    src: Optional[str] = None
    asset: Optional[str] = None
    data: Optional[str] = None
    dur: Optional[float] = None


@router.get("/boards")
def list_boards() -> Dict[str, Any]:
    return {"boards": _board_call(lambda: board_service().store.list())}


@router.post("/boards")
def create_board(body: "BoardCreateBody") -> Dict[str, Any]:
    svc = board_service()
    return {"board": _board_call(svc.store.create, body.name, body.parent)}


@router.get("/boards/assets/{aid}")
def get_board_asset(aid: str) -> Dict[str, Any]:
    import base64
    mime, data = _board_call(board_service().assets.get, aid)
    if mime == "text/html":
        return {"mime": mime, "text": data.decode("utf-8", "replace")}
    return {"mime": mime, "data": base64.b64encode(data).decode("ascii")}


@router.post("/boards/assets")
def upload_board_asset(body: "BoardAssetBody") -> Dict[str, Any]:
    svc = board_service()
    if body.html is not None:
        return {"asset": _board_call(svc.assets.put_html, body.html)}
    if body.data is None:
        raise HTTPException(status_code=400, detail="data or html required")
    aid = _board_call(svc.assets.put_b64, body.data)
    out: Dict[str, Any] = {"asset": aid}
    size = _boardkit("assets").image_size(svc.assets.get(aid)[1])
    if size:
        out["iw"], out["ih"] = size
    return out


@router.post("/boards/assets/video")
def upload_board_video(body: "VideoChunkBody") -> Dict[str, Any]:
    """Chunked video upload (base64 chunks of <= 4 MB, in order). The last chunk returns the
    asset id and its poster (ffmpeg frame + duration)."""
    return _board_call(board_service().upload_video_chunk, body.upload, body.i, body.n, body.data)


@router.get("/boards/media/{aid}")
def get_board_media(aid: str, off: int = 0, n: int = 4 * 1024 * 1024) -> Dict[str, Any]:
    """A byte range of a video asset, base64 (the hosts' fetch is JSON-only)."""
    import base64
    mime, total, data = _board_call(board_service().assets.read_range, aid, off, n)
    return {"mime": mime, "size": total, "off": off, "data": base64.b64encode(data).decode("ascii")}


@router.post("/boards/video-poster")
def board_video_poster(body: "PosterBody") -> Dict[str, Any]:
    """Poster + duration for a video card (asset or URL), made on first request and cached
    beside the assets. Never edits the board."""
    return {"poster": _board_call(board_service().poster, body.src, body.asset)}


@router.put("/boards/video-poster")
def board_video_poster_client(body: "PosterBody") -> Dict[str, Any]:
    """Fallback when the server can't decode: a frame the browser grabbed itself."""
    if not body.data:
        raise HTTPException(status_code=400, detail="data required")
    svc = board_service()
    return {"poster": _board_call(svc.posters.put_client, body.src, body.asset, body.data, body.dur)}


@router.get("/boards/live/actions")
def list_live_actions() -> Dict[str, Any]:
    """The owner's action allowlist, public view (no commands, URLs or env)."""
    return board_service().actions.list_public()


@router.get("/boards/live/history")
def live_action_history(limit: int = 50) -> Dict[str, Any]:
    return {"history": board_service().actions.history(limit)}


@router.get("/boards/components")
def list_components() -> Dict[str, Any]:
    """The user's component library (name, title, versions, size)."""
    return {"components": _board_call(board_service().components.list)}


@router.post("/boards/components")
def save_component(body: "CompSaveBody") -> Dict[str, Any]:
    """Create a component or add a version (scripts; Hermes uses the board_component tool)."""
    kw = (body.model_dump if hasattr(body, "model_dump") else body.dict)(exclude={"name"})
    return {"result": _board_call(board_service().comp_save, body.name, "u", **kw)}


@router.get("/boards/components/{name}")
def get_component(name: str, ver: Optional[str] = None) -> Dict[str, Any]:
    """One component, assembled into a single HTML document (+ versions and sample data)."""
    comps = _boardkit("components")
    try:
        return _board_call(board_service().components.assemble, name, ver)
    except (comps.CompNotFound, comps.CompError) as e:
        raise HTTPException(status_code=404, detail=str(e).strip("'\""))


@router.post("/boards/{bid}/comp/{iid}/data")
def post_comp_data(bid: str, iid: str, body: "CompDataBody") -> Dict[str, Any]:
    """Update a component card's data (scripts, cron jobs): the card gets it live through hb.onData.
    ``data`` sets top-level keys (null deletes), ``push`` appends to lists, ``replace`` starts empty."""
    doc, entry = _board_call(board_service().comp_update, bid, iid, body.data, body.push, body.keep, body.replace)
    item = doc["items"].get(iid) or {}
    return {"seq": doc["seq"], "at": item.get("at"), "noop": bool(entry.get("noop"))}


@router.put("/boards/{bid}/comp/{iid}/files/{name}")
def put_comp_file(bid: str, iid: str, name: str, body: "CompFileBody") -> Dict[str, Any]:
    """Attach a data file (weights, a trace, a big series) to a component card; read with hb.asset(name)."""
    comps = _boardkit("components")
    if body.data is not None:
        raw = comps.decode_b64(body.data)
    elif body.text is not None:
        raw = body.text.encode("utf-8")
    elif body.json_value is not None:
        raw = json.dumps(body.json_value, separators=(",", ":")).encode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="data, text or json_value required")
    return _board_call(board_service().comp_attach, bid, iid, name, raw)


@router.get("/boards/{bid}/comp/{iid}/files/{name}")
def get_comp_file(bid: str, iid: str, name: str, off: int = 0, n: int = 4 * 1024 * 1024) -> Dict[str, Any]:
    """A byte range of a data file, base64 (the hosts' fetch is JSON-only)."""
    import base64
    size, data = _board_call(board_service().comp_file, bid, iid, name, off, n)
    return {"size": size, "off": off, "data": base64.b64encode(data).decode("ascii")}


@router.post("/boards/{bid}/comp/{iid}/action")
def post_comp_action(bid: str, iid: str, body: "CompActionBody", request: Request) -> Dict[str, Any]:
    """A component card pressed an action (hb.action). Only ids on the card AND in the owner's allowlist run."""
    client = getattr(request, "client", None)
    who = f"dashboard {getattr(client, 'host', '') or ''}".strip()
    return {"result": _board_call(board_service().comp_action, bid, iid, body.action, body.args, body.confirm, who)}


@router.post("/boards/link-preview")
def board_link_preview(body: "BoardUrlBody") -> Dict[str, Any]:
    return {"preview": board_service().preview(body.url)}


@router.get("/boards/{bid}")
def get_board(bid: str, since: int = -1) -> Dict[str, Any]:
    svc = board_service()
    out = _board_call(svc.store.since, bid, since)
    if since < 0:
        try:
            svc.refresh_waiting(bid)
        except Exception:
            pass
    return out


@router.post("/boards/{bid}/ops")
def post_board_ops(bid: str, body: "BoardOpsBody") -> Dict[str, Any]:
    doc, entry = _board_call(board_service().commit, bid, body.ops, "u", body.note)
    return {"seq": doc["seq"], "entry": entry}


@router.post("/boards/{bid}/live/{iid}/data")
def post_live_data(bid: str, iid: str, body: "LiveDataBody") -> Dict[str, Any]:
    """Update a live card's data (scripts, cron jobs). ``data`` sets keys (null deletes),
    ``push`` appends to series, ``replace`` starts from empty. Behind the dashboard's own auth."""
    doc, entry = _board_call(board_service().live_update, bid, iid, body.data, body.push, body.keep, body.replace)
    item = doc["items"].get(iid) or {}
    return {"seq": doc["seq"], "at": item.get("at"), "noop": bool(entry.get("noop"))}


@router.post("/boards/{bid}/live/{iid}/action")
def post_live_action(bid: str, iid: str, body: "LiveActionBody", request: Request) -> Dict[str, Any]:
    """Press a live card button. Only allowlisted ids run; args come from the card."""
    client = getattr(request, "client", None)
    who = f"dashboard {getattr(client, 'host', '') or ''}".strip()
    res = _board_call(board_service().live_action, bid, iid, body.action, body.index, body.confirm, who)
    return {"result": res}


@router.post("/boards/{bid}/undo")
def undo_board_entry(bid: str, body: "BoardUndoBody") -> Dict[str, Any]:
    doc, entry = _board_call(board_service().store.undo, bid, body.s, "u")
    return {"seq": doc["seq"], "entry": entry}


@router.delete("/boards/{bid}")
def delete_board(bid: str) -> Dict[str, Any]:
    _board_call(board_service().store.delete, bid)
    return {"ok": True}
