"""Hermes Home dashboard plugin package root.

Hermes' agent plugin loader imports every enabled directory plugin from its
root and refuses one without an ``__init__.py`` ("No __init__.py in ..."),
which left the Python half unloaded. This plugin contributes no tools, hooks
or commands: its surface is the dashboard API (``dashboard/plugin_api.py``,
mounted separately by the dashboard host) and the Desktop UI
(``desktop/plugin.js``). So ``register`` is an intentional no-op.

Approach from PR #4 by @AgJavis-hub; reported in #5 and #6.
"""
from __future__ import annotations

from typing import Any


def register(ctx: Any) -> None:
    """No root-level tools, commands or hooks to register."""
    return None
