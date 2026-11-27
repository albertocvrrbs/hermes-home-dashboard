"""Live cards: a declarative block spec bound to a small data bag.

A live card (``k: "live"``) stores ``blocks`` (what to draw) and ``data`` (the values the
blocks read). Any block value may be a literal or a ``"$key"`` binding into ``data``; the
agent writes the spec once with ``board_apply`` and then only patches ``data`` (``live`` op,
REST ``POST /boards/{id}/live/{card}/data`` or a local script). Action buttons reference ids
from the owner's allowlist (``actions.py``); nothing in a card can carry a command.

Everything here is a pure sanitiser: bad input raises ``engine.OpError`` via ``LiveError``.
"""
from __future__ import annotations

import copy
import json
import math
import re
from typing import Any, Dict, List, Optional

KEY = re.compile(r"[A-Za-z_][A-Za-z0-9_.-]{0,39}")
ACTION_ID = re.compile(r"[a-z0-9][a-z0-9._-]{0,63}")
ICON = re.compile(r"[a-z][a-z0-9-]{0,31}")

STATUSES = ("running", "paused", "done", "error", "idle")
FORMATS = ("num", "int", "pct", "usd", "dur", "text")
BLOCKS = ("header", "progress", "metrics", "spark", "media", "text", "actions")

MAX_BLOCKS = 12
MAX_METRICS = 8
MAX_ACTIONS = 4
MAX_KEYS = 48
MAX_STR = 4000
MAX_SERIES = 240
MAX_LINES = 200
MAX_DATA_BYTES = 32 * 1024
DEFAULT_KEEP = 120
DEFAULT_TTL = 300


class LiveError(ValueError):
    pass


def _finite(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v))


def _num(v: Any) -> float:
    if not _finite(v):
        raise LiveError("expected a finite number")
    f = float(v)
    return int(f) if f.is_integer() and abs(f) < 2**53 else round(f, 6)


def _text(v: Any, cap: int) -> str:
    if isinstance(v, bool) or v is None:
        raise LiveError("expected text")
    if _finite(v):
        v = str(v)
    if not isinstance(v, str):
        raise LiveError("expected text")
    return v[:cap]


def is_binding(v: Any) -> bool:
    return isinstance(v, str) and len(v) > 1 and v[0] == "$" and v[1] != "$" and KEY.fullmatch(v[1:]) is not None


def _value(v: Any, cap: int = 500) -> Any:
    """A block value: a ``$key`` binding, a number, a bool or short text."""
    if is_binding(v):
        return v
    if isinstance(v, bool):
        return v
    if _finite(v):
        return _num(v)
    return _text(v, cap)


# ── data ────────────────────────────────────────────────────────────────

def _data_value(v: Any) -> Any:
    if isinstance(v, bool):
        return v
    if _finite(v):
        return _num(v)
    if isinstance(v, str):
        return v[:MAX_STR]
    if isinstance(v, list):
        if not v:
            return []
        if all(_finite(x) for x in v):
            return [_num(x) for x in v[-MAX_SERIES:]]
        if all(isinstance(x, str) for x in v):
            return [x[:300] for x in v[-MAX_LINES:]]
        raise LiveError("lists hold only numbers or only text")
    raise LiveError("values are numbers, text, true/false or lists of those")


def _key(k: Any) -> str:
    if not isinstance(k, str) or not KEY.fullmatch(k):
        raise LiveError(f"bad data key {str(k)[:20]!r} (letters, digits, _ . -; up to 40)")
    return k


def clean_data(raw: Any) -> Dict[str, Any]:
    """A whole data bag as stored on the item (no deletions)."""
    if not isinstance(raw, dict):
        raise LiveError("data must be an object")
    out: Dict[str, Any] = {}
    for k, v in raw.items():
        if v is None:
            continue
        out[_key(k)] = _data_value(v)
    _check_size(out)
    return out


def _check_size(data: Dict[str, Any]) -> None:
    if len(data) > MAX_KEYS:
        raise LiveError(f"at most {MAX_KEYS} data keys")
    if len(json.dumps(data, separators=(",", ":"), ensure_ascii=False)) > MAX_DATA_BYTES:
        raise LiveError(f"data is over {MAX_DATA_BYTES // 1024} KB")


def merge_data(current: Optional[Dict[str, Any]], patch: Any = None, push: Any = None,
               keep: Any = None, replace: bool = False) -> Dict[str, Any]:
    """New data bag: ``patch`` sets keys (null deletes), ``push`` appends to series/lines
    (trimmed to ``keep``), ``replace`` starts from empty."""
    out: Dict[str, Any] = {} if replace else copy.deepcopy(current or {})
    if patch is not None:
        if not isinstance(patch, dict):
            raise LiveError("data must be an object")
        for k, v in patch.items():
            k = _key(k)
            if v is None:
                out.pop(k, None)
            else:
                out[k] = _data_value(v)
    if push is not None:
        if not isinstance(push, dict):
            raise LiveError("push must be an object of key: value(s)")
        n = DEFAULT_KEEP if keep is None else int(max(1, min(MAX_SERIES, _num(keep))))
        for k, v in push.items():
            k = _key(k)
            vals = v if isinstance(v, list) else [v]
            cur = out.get(k)
            if not isinstance(cur, list):
                cur = []
            for x in vals:
                if _finite(x):
                    if cur and not all(_finite(y) for y in cur):
                        raise LiveError(f"{k}: cannot push a number onto text lines")
                    cur.append(_num(x))
                elif isinstance(x, str):
                    if cur and not all(isinstance(y, str) for y in cur):
                        raise LiveError(f"{k}: cannot push text onto a number series")
                    cur.append(x[:300])
                else:
                    raise LiveError(f"{k}: push numbers or text")
            cap = n if all(_finite(y) for y in cur) else min(n, MAX_LINES)
            out[k] = cur[-cap:]
    _check_size(out)
    return out


# ── blocks ──────────────────────────────────────────────────────────────

def _label(v: Any) -> str:
    return _text(v, 60)


def _fmt(v: Any) -> str:
    if v not in FORMATS:
        raise LiveError("fmt is one of " + ", ".join(FORMATS))
    return v


def _icon(v: Any) -> str:
    if not isinstance(v, str) or not ICON.fullmatch(v):
        raise LiveError("icon must be a short lowercase name")
    return v


def _metric(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise LiveError("metrics items are objects")
    m: Dict[str, Any] = {"label": _label(raw.get("label", "")), "value": _value(raw.get("value", ""))}
    if raw.get("unit") is not None:
        m["unit"] = _text(raw["unit"], 12)
    if raw.get("delta") is not None:
        m["delta"] = _value(raw["delta"], 40)
    if raw.get("good") in ("up", "down"):
        m["good"] = raw["good"]
    if raw.get("fmt") is not None:
        m["fmt"] = _fmt(raw["fmt"])
    return m


def _action_ref(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, str):
        raw = {"action": raw}
    if not isinstance(raw, dict):
        raise LiveError("actions items are {action, label?, icon?, args?}")
    aid = raw.get("action")
    if not isinstance(aid, str) or not ACTION_ID.fullmatch(aid):
        raise LiveError("action must be a registered action id (a-z 0-9 . _ -)")
    # anything that looks like a command is refused outright, not silently dropped
    for bad in ("command", "cmd", "http", "url", "shell", "exec", "run"):
        if bad in raw:
            raise LiveError(f"actions reference an id; '{bad}' is not allowed on a card")
    a: Dict[str, Any] = {"action": aid}
    if raw.get("label") is not None:
        a["label"] = _label(raw["label"])
    if raw.get("icon") is not None:
        a["icon"] = _icon(raw["icon"])
    args = raw.get("args")
    if args is not None:
        if not isinstance(args, dict) or len(args) > 8:
            raise LiveError("args must be an object (up to 8)")
        clean = {}
        for k, v in args.items():
            if not isinstance(k, str) or not KEY.fullmatch(k):
                raise LiveError("bad arg name")
            if isinstance(v, bool) or _finite(v):
                clean[k] = v if isinstance(v, bool) else _num(v)
            elif is_binding(v):
                clean[k] = v
            elif isinstance(v, str):
                clean[k] = v[:200]
            else:
                raise LiveError(f"arg {k}: text, number or true/false")
        a["args"] = clean
    return a


def clean_block(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("t") not in BLOCKS:
        raise LiveError("each block needs t: " + ", ".join(BLOCKS))
    t = raw["t"]
    b: Dict[str, Any] = {"t": t}

    def opt(key: str, conv, *a):
        if raw.get(key) is not None:
            b[key] = conv(raw[key], *a)

    if t == "header":
        opt("title", _value, 200)
        opt("sub", _value, 300)
        opt("status", _value, 20)
        opt("icon", _icon)
    elif t == "progress":
        b["value"] = _value(raw.get("value", 0))
        opt("max", _value)
        opt("label", _value, 120)
        opt("eta", _value, 40)
    elif t == "metrics":
        items = raw.get("items")
        if not isinstance(items, list) or not items:
            raise LiveError("metrics needs items")
        b["items"] = [_metric(x) for x in items[:MAX_METRICS]]
    elif t == "spark":
        b["series"] = _value(raw.get("series", ""))
        opt("label", _label)
        opt("unit", _text, 12)
        opt("fmt", _fmt)
        opt("min", _value)
        opt("max", _value)
    elif t == "media":
        for key in ("video", "image", "poster"):
            opt(key, _value, 2048)
        opt("caption", _value, 200)
        if not any(k in b for k in ("video", "image")):
            raise LiveError("media needs video or image")
    elif t == "text":
        b["value"] = _value(raw.get("value", ""), MAX_STR)
        opt("label", _label)
        if raw.get("lines") is not None:
            b["lines"] = int(max(1, min(20, _num(raw["lines"]))))
        if raw.get("mono") is False:
            b["mono"] = False
    elif t == "actions":
        items = raw.get("items")
        if not isinstance(items, list):
            raise LiveError("actions needs items")
        b["items"] = [_action_ref(x) for x in items[:MAX_ACTIONS]]
    return b


def clean_blocks(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list) or not raw:
        raise LiveError("blocks must be a non-empty list")
    if len(raw) > MAX_BLOCKS:
        raise LiveError(f"at most {MAX_BLOCKS} blocks")
    return [clean_block(b) for b in raw]


def status_of(item: Dict[str, Any]) -> Optional[str]:
    """The card's status after bindings, for outlines and the change summary."""
    for b in item.get("blocks") or []:
        if b.get("t") == "header" and b.get("status") is not None:
            v = b["status"]
            if is_binding(v):
                v = (item.get("data") or {}).get(v[1:])
            return v if v in STATUSES else None
    return None


# ── templates ───────────────────────────────────────────────────────────
# Labels starting with "@" are translated by the UI (board.live.l.<name>); unknown ones show
# the bare name. Bindings name the data keys a script or the agent fills in.

TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "training": [
        {"t": "header", "title": "$name", "sub": "$stage", "status": "$status", "icon": "activity"},
        {"t": "progress", "value": "$progress", "label": "$progress_label", "eta": "$eta"},
        {"t": "metrics", "items": [
            {"label": "@success", "value": "$success", "fmt": "pct", "delta": "$success_delta", "good": "up"},
            {"label": "@elapsed", "value": "$elapsed", "fmt": "dur"},
            {"label": "@cost", "value": "$cost", "fmt": "usd"},
            {"label": "@falls", "value": "$falls", "fmt": "pct", "good": "down"},
        ]},
        {"t": "spark", "series": "$success_hist", "label": "@successTrend", "fmt": "pct"},
        {"t": "media", "video": "$video", "poster": "$poster", "caption": "$video_caption"},
        {"t": "text", "value": "$log", "lines": 4},
    ],
    "job": [
        {"t": "header", "title": "$name", "sub": "$stage", "status": "$status", "icon": "square-terminal"},
        {"t": "progress", "value": "$progress", "label": "$progress_label", "eta": "$eta"},
        {"t": "text", "value": "$log", "lines": 6},
    ],
    "stat": [
        {"t": "header", "title": "$name", "sub": "$stage", "status": "$status", "icon": "gauge"},
        {"t": "metrics", "items": [
            {"label": "$m1_label", "value": "$m1", "delta": "$m1_delta"},
            {"label": "$m2_label", "value": "$m2", "delta": "$m2_delta"},
        ]},
        {"t": "spark", "series": "$series", "label": "$series_label"},
    ],
}


def template(name: Any, actions: Any = None) -> List[Dict[str, Any]]:
    if name not in TEMPLATES:
        raise LiveError("tpl is one of " + ", ".join(TEMPLATES))
    blocks = copy.deepcopy(TEMPLATES[name])
    if actions:
        if not isinstance(actions, list):
            raise LiveError("actions must be a list")
        blocks.append({"t": "actions", "items": actions})
    return clean_blocks(blocks)


def action_refs(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Every action button on the card, in order."""
    out = []
    for b in item.get("blocks") or []:
        if b.get("t") == "actions":
            out.extend(b.get("items") or [])
    return out


def bound_args(ref: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    """The button's args with ``$key`` bindings read from the card's data."""
    out = {}
    for k, v in (ref.get("args") or {}).items():
        out[k] = data.get(v[1:]) if is_binding(v) else v
    return out
