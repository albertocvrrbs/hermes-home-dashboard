"""Home dashboard plugin backend.

Mounted at /api/plugins/home-dashboard/ by the Hermes dashboard host.
Persists the widget layout to a JSON file inside the plugin's own directory
so it survives Hermes updates (the plugin lives under ~/.hermes/plugins/,
outside the repo that `git reset --hard` touches).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

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


def _valid_layout(layout: Any) -> bool:
    if not isinstance(layout, dict) or layout.get("version") != 1:
        return False
    widgets = layout.get("widgets")
    if not isinstance(widgets, list) or len(widgets) > _MAX_WIDGETS:
        return False
    for w in widgets:
        if not isinstance(w, dict) or not isinstance(w.get("id"), str):
            return False
        if not all(isinstance(w.get(k), int) for k in ("gx", "gy", "gw", "gh")):
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
