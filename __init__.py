"""Hermes Home dashboard plugin package root (agent half).

The dashboard API (``dashboard/plugin_api.py``) and the Desktop UI (``desktop/plugin.js``)
are mounted separately by their hosts. This root registers the agent side of Boards:

- tools ``board_read``, ``board_apply``, ``board_render`` (toolset ``board``) so Hermes can
  read and write the boards the user sees in the Home dashboard;
- a ``pre_llm_call`` hook that, for sessions linked to a board only, tells the model in a few
  lines what the user changed on the board since its last turn.

Board data lives in ``$HERMES_HOME/plugin-data/home-dashboard/boards/``.
(The root ``__init__.py`` itself was added in PR #4 by @AgJavis-hub; reported in #5 and #6.)
"""
from __future__ import annotations

from pathlib import Path
from typing import Any


def _hermes_home() -> Path:
    try:
        from hermes_constants import get_hermes_home
        return Path(get_hermes_home())
    except Exception:  # pragma: no cover - standalone
        import os
        val = (os.environ.get("HERMES_HOME") or "").strip()
        return Path(val) if val else Path.home() / ".hermes"


def register(ctx: Any) -> None:
    from .dashboard.boardkit.agent import SCHEMAS, BoardAgent
    from .dashboard.boardkit.service import BoardService

    try:
        profile = str(getattr(ctx, "profile_name", "") or "default")
    except Exception:
        profile = "default"
    root = _hermes_home() / "plugin-data" / "home-dashboard" / "boards"
    agent = BoardAgent(BoardService(root), profile=profile)
    for name in ("board_read", "board_apply", "board_render"):
        ctx.register_tool(
            name=name,
            toolset="board",
            schema=SCHEMAS[name],
            handler=getattr(agent, name),
            description=SCHEMAS[name]["description"],
        )
    ctx.register_hook("pre_llm_call", agent.pre_llm_call)
