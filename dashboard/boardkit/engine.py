"""The board op engine: pure functions over a board document.

A batch is applied atomically (on a deep copy) and returns the new document, the inverse
batch (applying it restores the previous items) and the ``$ref`` -> id map. The TS mirror in
``src/board/model.ts`` implements the same semantics for optimistic UI updates.
"""
from __future__ import annotations

import copy
import math
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import ids
from . import live as live_mod

MAX_OPS = 200
MAX_ITEMS = 2000
MAX_TEXT = 20_000
MAX_POINTS = 400
COORD = 10_000_000

PROVIDERS = ("youtube", "vimeo", "loom", "x")

DEFAULT_SIZE: Dict[str, Tuple[int, int]] = {
    "card": (256, 120), "todo": (304, 240), "col": (276, 320), "link": (276, 250),
    "image": (372, 260), "embed": (452, 320), "video": (400, 260), "board": (212, 170),
    "frame": (480, 320), "box": (196, 62), "text": (420, 40), "draw": (120, 80),
    "live": (360, 300),
}

_COMMON = ("x", "y", "w", "h", "in")
FIELDS: Dict[str, Tuple[str, ...]] = {
    "card": _COMMON + ("title", "text", "tags", "due"),
    "todo": _COMMON + ("title", "items"),
    "col": ("x", "y", "w", "h", "title", "kids"),
    "link": _COMMON + ("url", "title", "desc", "site", "icon", "img", "st", "video"),
    "image": _COMMON + ("asset", "cap", "iw", "ih", "url"),
    "embed": _COMMON + ("asset", "title"),
    "video": _COMMON + ("src", "title", "asset", "img", "dur", "iw", "ih"),
    "board": _COMMON + ("ref", "title"),
    "frame": ("x", "y", "w", "h", "title", "note"),
    "box": ("x", "y", "w", "h", "title", "sub", "num"),
    "text": ("x", "y", "w", "h", "text", "size"),
    "draw": ("x", "y", "w", "h", "d", "sw", "tl", "c", "ds", "sm", "pr", "g"),
    "line": ("a", "b", "label"),
    "live": ("x", "y", "w", "h", "title", "blocks", "data", "ttl", "at", "tpl"),
}
KINDS = frozenset(FIELDS)

_STROKE = re.compile(r"-?\d{1,7},-?\d{1,7}(?: -?\d{1,7},-?\d{1,7})*")
_VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")
_PRESSURE = re.compile(r"[0-9]{1,%d}" % MAX_POINTS)
_GROUP = re.compile(r"[a-z0-9]{1,12}")

# Draw items: tool (absent = pen), palette colour by name (absent = the theme's ink).
INK_TOOLS = ("hl", "line", "arrow", "rect", "ellipse")
INK_COLORS = ("accent", "sage", "clay", "slate", "sand")


class OpError(ValueError):
    """A batch that cannot be applied. Nothing was changed."""


def new_doc(bid: str, name: str, now: float, parent: Optional[str] = None) -> Dict[str, Any]:
    return {
        "v": 1, "id": bid, "name": _str(name, 200) or "Untitled board", "parent": parent,
        "seq": 0, "n": 0, "session": None, "seen": 0,
        "created": int(now), "updated": int(now), "items": {},
    }


# ── field sanitisers ─────────────────────────────────────────────────────

def _num(value: Any) -> float:
    if isinstance(value, bool):
        raise OpError("expected a number")
    if isinstance(value, (int, float)):
        f = float(value)
    elif isinstance(value, str):
        try:
            f = float(value.strip())
        except ValueError:
            raise OpError(f"expected a number, got {value[:20]!r}") from None
    else:
        raise OpError("expected a number")
    if not math.isfinite(f):
        raise OpError("expected a finite number")
    return f


def _int(lo: int, hi: int) -> Callable[[Any], int]:
    def conv(value: Any) -> int:
        return int(max(lo, min(hi, round(_num(value)))))
    return conv


def _str(value: Any, cap: int) -> str:
    if isinstance(value, bool) or value is None:
        raise OpError("expected text")
    if isinstance(value, (int, float)):
        value = str(value)
    if not isinstance(value, str):
        raise OpError("expected text")
    return value[:cap]


def _text(cap: int) -> Callable[[Any], str]:
    return lambda value: _str(value, cap)


def _url(value: Any) -> str:
    s = _str(value, 2048).strip()
    if not re.match(r"https?://", s, re.I):
        raise OpError("url must be http(s)")
    return s


def _enum(*choices: str) -> Callable[[Any], str]:
    def conv(value: Any) -> str:
        if value not in choices:
            raise OpError(f"expected one of {', '.join(choices)}")
        return value
    return conv


def _asset(value: Any) -> str:
    if not ids.valid_aid(value):
        raise OpError("invalid asset id")
    return value


def _bid(value: Any) -> str:
    if not ids.valid_bid(value):
        raise OpError("invalid board id")
    return value


def _tags(value: Any) -> List[str]:
    if not isinstance(value, list):
        raise OpError("tags must be a list")
    out = []
    for t in value[:12]:
        s = _str(t, 40).strip().lstrip("#").strip()
        if s:
            out.append(s)
    return out


def _todo_items(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        raise OpError("items must be a list")
    out = []
    for raw in value[:300]:
        if isinstance(raw, str):
            raw = {"t": raw}
        if not isinstance(raw, dict):
            raise OpError("todo items must be objects")
        it: Dict[str, Any] = {"t": _str(raw.get("t", ""), 500)}
        if raw.get("done") is True:
            it["done"] = True
        if raw.get("by") == "h":
            it["by"] = "h"
        if raw.get("due"):
            it["due"] = _str(raw["due"], 32)
        out.append(it)
    return out


def _stroke(value: Any) -> str:
    s = _str(value, 20 * MAX_POINTS).strip()
    if not _STROKE.fullmatch(s):
        raise OpError("stroke must be 'x,y x,y ...' integers")
    if s.count(" ") + 1 > MAX_POINTS:
        raise OpError(f"stroke has more than {MAX_POINTS} points")
    return s


def _video(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict) or value.get("p") not in PROVIDERS:
        raise OpError("video must be {p, id}")
    vid = value.get("id")
    if not isinstance(vid, str) or not _VIDEO_ID.fullmatch(vid):
        raise OpError("invalid video id")
    out: Dict[str, Any] = {"p": value["p"], "id": vid}
    if value.get("vert") is True:
        out["vert"] = True
    return out


def _flag(value: Any) -> bool:
    """Boolean style flags are stored only when on; send null to clear one."""
    if value is not True:
        raise OpError("expected true (use null to clear)")
    return True


def _pressure(value: Any) -> str:
    s = _str(value, MAX_POINTS + 1)
    if not _PRESSURE.fullmatch(s):
        raise OpError("pressure must be one digit 0-9 per point")
    return s


def _group(value: Any) -> str:
    s = _str(value, 13)
    if not _GROUP.fullmatch(s):
        raise OpError("group id must be 1-12 lowercase letters or digits")
    return s


def _sw(value: Any) -> float:
    return round(max(0.5, min(24.0, _num(value))), 1)


def _live(fn: Callable[[Any], Any]) -> Callable[[Any], Any]:
    def conv(value: Any) -> Any:
        try:
            return fn(value)
        except live_mod.LiveError as e:
            raise OpError(str(e)) from None
    return conv


def _dur(value: Any) -> float:
    return round(max(0.0, min(360_000.0, _num(value))), 2)


SANITIZE: Dict[str, Callable[[Any], Any]] = {
    "x": _int(-COORD, COORD), "y": _int(-COORD, COORD),
    "w": _int(1, 100_000), "h": _int(1, 100_000),
    "iw": _int(1, 100_000), "ih": _int(1, 100_000),
    "title": _text(500), "text": _text(MAX_TEXT), "sub": _text(300), "cap": _text(500),
    "desc": _text(1000), "site": _text(200), "label": _text(200), "note": _text(1000),
    "due": _text(32), "num": _text(8),
    "url": _url, "src": _url,
    "st": _enum("wait", "ok", "fail"), "size": _enum("h", "p", "s"),
    "asset": _asset, "icon": _asset, "img": _asset, "ref": _bid,
    "tags": _tags, "items": _todo_items, "d": _stroke, "video": _video, "sw": _sw,
    "tl": _enum(*INK_TOOLS), "c": _enum(*INK_COLORS), "ds": _flag, "sm": _flag, "pr": _pressure, "g": _group,
    "dur": _dur, "blocks": _live(live_mod.clean_blocks), "data": _live(live_mod.clean_data),
    "ttl": _int(5, 7 * 86400), "at": _int(0, 2**42), "tpl": _enum(*live_mod.TEMPLATES),
}


# ── batch application ────────────────────────────────────────────────────

class _Batch:
    def __init__(self, doc: Dict[str, Any], by: str, now: Optional[float] = None):
        self.doc = doc
        self.items: Dict[str, Dict[str, Any]] = doc["items"]
        self.by = by
        self.now = int(now if now is not None else time.time())
        self.refs: Dict[str, str] = {}
        self._place: Optional[List[int]] = None

    # ids
    def resolve(self, value: Any, *, must_exist: bool = True) -> str:
        if ids.is_ref(value):
            if value not in self.refs:
                raise OpError(f"unknown ref {value}")
            value = self.refs[value]
        if not ids.valid_item_id(value):
            raise OpError(f"invalid id {str(value)[:20]!r}")
        if must_exist and value not in self.items:
            raise OpError(f"no item {value}")
        return value

    def endpoint(self, value: Any) -> Any:
        if isinstance(value, (list, tuple)) and len(value) == 2:
            return [SANITIZE["x"](value[0]), SANITIZE["y"](value[1])]
        return self.resolve(value)

    def column(self, value: Any) -> str:
        cid = self.resolve(value)
        if self.items[cid].get("k") != "col":
            raise OpError(f"{cid} is not a column")
        return cid

    def next_id(self) -> str:
        iid = ids.item_id(self.doc["n"])
        self.doc["n"] += 1
        return iid

    # auto placement: right of existing content, stacked down
    def place(self, kind: str) -> Tuple[int, int]:
        if self._place is None:
            xs, ys = [], []
            for it in self.items.values():
                if "x" in it and "y" in it:
                    w = it.get("w") or DEFAULT_SIZE.get(it["k"], (200, 100))[0]
                    xs.append(it["x"] + w)
                    ys.append(it["y"])
            self._place = [max(xs) + 80 if xs else 0, min(ys) if ys else 0]
        x, y = self._place
        self._place[1] += DEFAULT_SIZE.get(kind, (200, 100))[1] + 24
        return x, y

    # fields
    def clean_fields(self, kind: str, raw: Dict[str, Any]) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        allowed = FIELDS[kind]
        for key, value in raw.items():
            if key not in allowed or key in ("in", "kids") or value is None:
                continue
            if key in ("a", "b"):
                out[key] = self.endpoint(value)
                continue
            if key == "label" or key in SANITIZE:
                try:
                    out[key] = SANITIZE[key](value)
                except OpError as e:
                    raise OpError(f"{key}: {e}") from None
        return out

    def remove_from_column(self, iid: str) -> Optional[Tuple[str, int]]:
        cid = self.items[iid].get("in")
        if cid and cid in self.items:
            kids = self.items[cid].setdefault("kids", [])
            if iid in kids:
                idx = kids.index(iid)
                kids.remove(iid)
                return cid, idx
        return None

    def insert_in_column(self, cid: str, iid: str, at: Any) -> None:
        kids = self.items[cid].setdefault("kids", [])
        if iid in kids:
            return
        idx = len(kids) if at is None else int(max(0, min(len(kids), round(_num(at)))))
        kids.insert(idx, iid)

    # ops
    def add(self, op: Dict[str, Any]) -> List[Dict[str, Any]]:
        raw = op.get("item")
        if not isinstance(raw, dict) or raw.get("k") not in KINDS:
            raise OpError("add needs item.k, one of " + ", ".join(sorted(KINDS)))
        kind = raw["k"]
        item: Dict[str, Any] = {"k": kind, **self.clean_fields(kind, raw)}
        if kind == "line" and ("a" not in item or "b" not in item):
            raise OpError("line needs a and b")
        if kind == "live":
            if "blocks" not in item:
                try:
                    item["blocks"] = live_mod.template(raw.get("tpl") or "job", raw.get("actions"))
                except live_mod.LiveError as e:
                    raise OpError(str(e)) from None
            # the server stamps freshness; a client-sent `at` is ignored
            item.pop("at", None)
            if item.get("data"):
                item["at"] = self.now
        iid = self.next_id()
        ref = op.get("ref")
        if ref is not None:
            if not ids.is_ref(ref):
                raise OpError("ref must look like $name")
            self.refs[ref] = iid
        if self.by == "h":
            item["by"] = "h"
        if kind == "col":
            item["kids"] = []
        if raw.get("in") is not None and "in" in FIELDS[kind]:
            cid = self.column(raw["in"])
            item.pop("x", None)
            item.pop("y", None)
            item["in"] = cid
            self.items[iid] = item
            self.insert_in_column(cid, iid, op.get("at"))
            fwd = {"op": "put", "id": iid, "item": copy.deepcopy(item),
                   "at": self.items[cid]["kids"].index(iid)}
        else:
            if kind != "line" and ("x" not in item or "y" not in item):
                x, y = self.place(kind)
                item.setdefault("x", x)
                item.setdefault("y", y)
            self.items[iid] = item
            fwd = {"op": "put", "id": iid, "item": copy.deepcopy(item)}
        return [{"op": "del", "id": iid}], fwd

    def put(self, op: Dict[str, Any]) -> List[Dict[str, Any]]:
        iid = op.get("id")
        raw = op.get("item")
        if not ids.valid_item_id(iid) or not isinstance(raw, dict) or raw.get("k") not in KINDS:
            raise OpError("put needs id and item")
        if iid in self.items:
            raise OpError(f"item {iid} already exists")
        kind = raw["k"]
        item: Dict[str, Any] = {"k": kind, **self.clean_fields(kind, raw)}
        if raw.get("by") == "h":
            item["by"] = "h"
        if kind == "col":
            item["kids"] = [k for k in raw.get("kids") or [] if ids.valid_item_id(k)]
        self.doc["n"] = max(self.doc["n"], ids.item_index(iid) + 1)
        cid = raw.get("in")
        if cid is not None and "in" in FIELDS[kind]:
            if ids.valid_item_id(cid):
                item["in"] = cid
            self.items[iid] = item
            if cid in self.items and self.items[cid].get("k") == "col":
                self.insert_in_column(cid, iid, op.get("at"))
        else:
            self.items[iid] = item
        fwd = {"op": "put", "id": iid, "item": copy.deepcopy(item)}
        if "at" in op:
            fwd["at"] = op["at"]
        return [{"op": "del", "id": iid}], fwd

    def set(self, op: Dict[str, Any]) -> List[Dict[str, Any]]:
        iid = self.resolve(op.get("id"))
        patch = op.get("p")
        if not isinstance(patch, dict):
            raise OpError("set needs p")
        item = self.items[iid]
        kind = item["k"]
        allowed = FIELDS[kind]
        inv_p: Dict[str, Any] = {}
        inv: Dict[str, Any] = {"op": "set", "id": iid, "p": inv_p}
        fwd_p: Dict[str, Any] = {}
        fwd: Dict[str, Any] = {"op": "set", "id": iid, "p": fwd_p}
        for key, value in patch.items():
            if key in ("k", "by") or key not in allowed:
                continue
            if key == "kids":
                kids = [self.resolve(k) for k in value] if isinstance(value, list) else None
                if kids is None or sorted(kids) != sorted(item.get("kids", [])):
                    raise OpError("kids can only be reordered")
                inv_p["kids"] = list(item.get("kids", []))
                item["kids"] = kids
                fwd_p["kids"] = list(kids)
                continue
            if key == "in":
                old = item.get("in")
                new = None if value is None else self.column(value)
                if new == old:
                    continue
                removed = self.remove_from_column(iid)
                inv_p["in"] = old
                if removed:
                    inv["at"] = removed[1]
                inv_p.setdefault("x", item.get("x"))
                inv_p.setdefault("y", item.get("y"))
                fwd_p["in"] = new
                if new is None:
                    item.pop("in", None)
                    if "x" not in patch or "y" not in patch:
                        col = self.items.get(old, {}) if old else {}
                        item["x"] = col.get("x", 0) + (col.get("w") or 276) + 40
                        item["y"] = col.get("y", 0)
                        fwd_p["x"], fwd_p["y"] = item["x"], item["y"]
                else:
                    item["in"] = new
                    item.pop("x", None)
                    item.pop("y", None)
                    self.insert_in_column(new, iid, op.get("at"))
                    fwd["at"] = self.items[new]["kids"].index(iid)
                    fwd_p["x"] = fwd_p["y"] = None
                continue
            if key not in inv_p:
                inv_p[key] = copy.deepcopy(item.get(key))
            if value is None:
                item.pop(key, None)
                fwd_p[key] = None
                continue
            if key in ("a", "b"):
                item[key] = self.endpoint(value)
            else:
                try:
                    item[key] = SANITIZE[key](value)
                except OpError as e:
                    raise OpError(f"{key}: {e}") from None
            fwd_p[key] = copy.deepcopy(item[key])
        return ([inv] if inv_p else []), (fwd if fwd_p else None)

    def delete(self, op: Dict[str, Any]) -> List[Dict[str, Any]]:
        iid = self.resolve(op.get("id"))
        item = self.items[iid]
        doomed = [iid] + list(item.get("kids", []) if item["k"] == "col" else [])
        doomed_set = set(doomed)
        lines = [k for k, v in self.items.items()
                 if v["k"] == "line" and k not in doomed_set
                 and any(isinstance(v.get(end), str) and v.get(end) in doomed_set for end in ("a", "b"))]
        inv: List[Dict[str, Any]] = []
        pos = None
        if item.get("in"):
            cid = item["in"]
            if cid in self.items and iid in self.items[cid].get("kids", []):
                pos = self.items[cid]["kids"].index(iid)
        first = {"op": "put", "id": iid, "item": copy.deepcopy(item)}
        if pos is not None:
            first["at"] = pos
        inv.append(first)
        for kid in doomed[1:] + lines:
            if kid in self.items:
                inv.append({"op": "put", "id": kid, "item": copy.deepcopy(self.items[kid])})
        self.remove_from_column(iid)
        for kid in doomed + lines:
            self.items.pop(kid, None)
        return inv, {"op": "del", "id": iid}

    def live(self, op: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Patch a live card's data. Normalised to a ``set`` of the whole bag + ``at``."""
        iid = self.resolve(op.get("id"))
        item = self.items[iid]
        if item["k"] != "live":
            raise OpError(f"{iid} is not a live card")
        try:
            data = live_mod.merge_data(item.get("data"), op.get("data"), op.get("push"), op.get("keep"),
                                       replace=op.get("replace") is True)
        except (live_mod.LiveError, OpError, TypeError, ValueError) as e:
            raise OpError(str(e)) from None
        inv = {"op": "set", "id": iid, "p": {"data": copy.deepcopy(item.get("data")), "at": item.get("at")}}
        item["data"] = data
        item["at"] = self.now
        return [inv], {"op": "set", "id": iid, "p": {"data": copy.deepcopy(data), "at": self.now}}

    def board(self, op: Dict[str, Any]) -> List[Dict[str, Any]]:
        patch = op.get("p")
        if not isinstance(patch, dict):
            raise OpError("board needs p")
        inv_p = {}
        if "name" in patch:
            inv_p["name"] = self.doc.get("name")
            self.doc["name"] = _str(patch["name"], 200).strip() or "Untitled board"
        if not inv_p:
            return [], None
        return [{"op": "board", "p": inv_p}], {"op": "board", "p": {"name": self.doc["name"]}}


_OPS = {"add": _Batch.add, "put": _Batch.put, "set": _Batch.set, "del": _Batch.delete, "board": _Batch.board,
        "live": _Batch.live}


def apply_batch(doc: Dict[str, Any], ops: Any, by: str = "u") -> Tuple[Dict[str, Any], List[Dict[str, Any]], Dict[str, str]]:
    """Apply ``ops`` as one atomic batch authored by ``by`` ("u" user, "h" Hermes)."""
    work, inverse, refs, _ = apply_batch_ex(doc, ops, by)
    return work, inverse, refs


def apply_batch_ex(doc: Dict[str, Any], ops: Any, by: str = "u", now: Optional[float] = None) -> Tuple[
        Dict[str, Any], List[Dict[str, Any]], Dict[str, str], List[Dict[str, Any]]]:
    """Like apply_batch, plus the normalised forward ops (ids resolved, values sanitised:
    ``add`` becomes ``put``). Replaying them on the previous document gives the same result,
    which is what the log stores and what clients replay."""
    if not isinstance(ops, list):
        raise OpError("ops must be a list")
    if len(ops) > MAX_OPS:
        raise OpError(f"at most {MAX_OPS} ops per batch")
    work = copy.deepcopy(doc)
    batch = _Batch(work, "h" if by == "h" else "u", now)
    parts: List[List[Dict[str, Any]]] = []
    forward: List[Dict[str, Any]] = []
    for i, op in enumerate(ops):
        if not isinstance(op, dict) or op.get("op") not in _OPS:
            raise OpError(f"op {i}: unknown op (use add, set, del, board, live)")
        try:
            inv, fwd = _OPS[op["op"]](batch, op)
        except OpError as e:
            raise OpError(f"op {i} ({op['op']}): {e}") from None
        parts.append(inv)
        if fwd is not None:
            forward.append(fwd)
    if len(work["items"]) > MAX_ITEMS:
        raise OpError(f"a board holds at most {MAX_ITEMS} items")
    inverse = [inv for part in reversed(parts) for inv in part]
    return work, inverse, batch.refs, forward
