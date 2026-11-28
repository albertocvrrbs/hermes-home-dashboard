"""Presentation tour: an ordered list of stops stored on the board document (``doc["tour"]``).

A stop is one of: a frame, any item, a nested-board card, or a saved camera view / world rect.
The ``tour`` op lets Hermes (or the UI) build the whole tour in one call; the frontend plays it
with eased camera flights (src/board/tour.ts). Normalised shape::

    doc["tour"] = {"stops": [{"k": "frame|item|board|view", "id"?, "r"?: {x,y,w,h}, "v"?: {x,y,z},
                              "t"?: title, "dw"?: seconds}], "loop"?: True, "dw"?: seconds, "t"?: title}
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional

MAX_STOPS = 100
DW_MAX = 600.0


class TourError(ValueError):
    pass


def _num(v: Any, lo: float, hi: float) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise TourError("expected a number")
    if v != v or v in (float("inf"), float("-inf")):
        raise TourError("expected a finite number")
    return max(lo, min(hi, float(v)))


def _dwell(v: Any) -> float:
    return round(_num(v, 0.0, DW_MAX), 2)


def _clip(v: Any, n: int) -> str:
    return str(v).strip()[:n]


def _reading_order(rects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Top-to-bottom rows, left-to-right inside a row (a row = frames whose tops are close)."""
    rows: List[List[Dict[str, Any]]] = []
    for r in sorted(rects, key=lambda r: (r["y"], r["x"])):
        for row in rows:
            if abs(r["y"] - row[0]["y"]) <= max(40.0, 0.5 * min(r["h"], row[0]["h"])):
                row.append(r)
                break
        else:
            rows.append([r])
    return [r for row in rows for r in sorted(row, key=lambda r: r["x"])]


def clean_stop(batch: Any, raw: Any) -> Dict[str, Any]:
    """One stop from an id/ref string or a dict {id|item, rect, view, t, dw}."""
    if isinstance(raw, str):
        raw = {"id": raw}
    if not isinstance(raw, dict):
        raise TourError("a stop is an item id or an object")
    out: Dict[str, Any] = {}
    ident = raw.get("id", raw.get("item"))
    if ident is not None:
        iid = batch.resolve(ident)
        kind = batch.items[iid].get("k")
        if kind == "line":
            raise TourError(f"{iid} is a connector; stop on an item or a rect")
        out["k"] = "frame" if kind == "frame" else "board" if kind == "board" else "item"
        out["id"] = iid
    elif isinstance(raw.get("rect"), dict):
        r = raw["rect"]
        try:
            out["r"] = {"x": round(_num(r.get("x"), -1e7, 1e7)), "y": round(_num(r.get("y"), -1e7, 1e7)),
                        "w": max(1, round(_num(r.get("w"), 1, 1e5))), "h": max(1, round(_num(r.get("h"), 1, 1e5)))}
        except TourError:
            raise TourError("rect needs numeric x, y, w, h") from None
        out["k"] = "view"
    elif isinstance(raw.get("view"), dict):
        v = raw["view"]
        try:
            out["v"] = {"x": round(_num(v.get("x"), -1e8, 1e8), 1), "y": round(_num(v.get("y"), -1e8, 1e8), 1),
                        "z": round(_num(v.get("z"), 0.05, 4.0), 3)}
        except TourError:
            raise TourError("view needs numeric x, y, z") from None
        out["k"] = "view"
    else:
        raise TourError("a stop needs id, rect or view")
    if raw.get("t") is not None or raw.get("title") is not None:
        t = _clip(raw.get("t", raw.get("title")), 120)
        if t:
            out["t"] = t
    if raw.get("dw") is not None or raw.get("dwell") is not None:
        try:
            dw = _dwell(raw.get("dw", raw.get("dwell")))
        except TourError:
            raise TourError("dwell is seconds (a number)") from None
        if dw > 0:
            out["dw"] = dw
    return out


def frames_in_order(items: Dict[str, Dict[str, Any]], rect_of: Any) -> List[str]:
    rects = []
    for iid, it in items.items():
        if it.get("k") == "frame" and not it.get("in"):
            r = rect_of(iid)
            if r:
                rects.append({"id": iid, **r})
    return [r["id"] for r in _reading_order(rects)]


def build(batch: Any, op: Dict[str, Any], prev: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The new tour for a ``tour`` op, or None to remove it. Raises TourError."""
    if op.get("clear") is True or (("stops" in op) and op["stops"] is None and "from" not in op):
        return None
    tour: Dict[str, Any] = copy.deepcopy(prev) if prev else {"stops": []}
    stops: List[Dict[str, Any]] = list(tour.get("stops") or [])
    src = op.get("from")
    if src is not None:
        if src not in ("frames", "boards"):
            raise TourError("from is 'frames' or 'boards'")
        if src == "frames":
            ids = frames_in_order(batch.items, batch.rect_of)
        else:
            rects = [{"id": i, **batch.rect_of(i)} for i, it in batch.items.items()
                     if it.get("k") == "board" and batch.rect_of(i)]
            ids = [r["id"] for r in _reading_order(rects)]
        stops = [clean_stop(batch, i) for i in ids]
    if "stops" in op:
        if not isinstance(op["stops"], list):
            raise TourError("stops must be a list")
        stops = [clean_stop(batch, s) for s in op["stops"]]
    if "add" in op:
        if not isinstance(op["add"], list):
            raise TourError("add must be a list")
        new = [clean_stop(batch, s) for s in op["add"]]
        at = op.get("at")
        if isinstance(at, int) and not isinstance(at, bool):
            at = max(0, min(len(stops), at))
            stops[at:at] = new
        else:
            stops.extend(new)
    if "remove" in op:
        if not isinstance(op["remove"], list):
            raise TourError("remove must be a list of item ids or stop positions")
        drop = set()
        for r in op["remove"]:
            if isinstance(r, int) and not isinstance(r, bool):
                drop.add(r)
            else:
                rid = batch.resolve(r, must_exist=False)
                drop.update(i for i, s in enumerate(stops) if s.get("id") == rid)
        stops = [s for i, s in enumerate(stops) if i not in drop]
    if len(stops) > MAX_STOPS:
        raise TourError(f"a tour has at most {MAX_STOPS} stops")
    tour["stops"] = stops
    if "loop" in op:
        if op["loop"]:
            tour["loop"] = True
        else:
            tour.pop("loop", None)
    if "dw" in op or "dwell" in op:
        dw = _dwell(op.get("dw", op.get("dwell")))
        if dw > 0:
            tour["dw"] = dw
        else:
            tour.pop("dw", None)
    if "t" in op or "title" in op:
        t = _clip(op.get("t", op.get("title")) or "", 120)
        if t:
            tour["t"] = t
        else:
            tour.pop("t", None)
    if not stops and not any(k in tour for k in ("loop", "dw", "t")):
        return None
    return tour


def coerce(batch: Any, raw: Any) -> Optional[Dict[str, Any]]:
    """A stored-form tour (from the UI, an undo or a replay), sanitised. Stops that point at items
    which no longer exist are dropped instead of failing the batch."""
    if raw is None:
        return None
    if not isinstance(raw, dict) or not isinstance(raw.get("stops", []), list):
        raise TourError("tour needs an object with stops")
    stops = []
    for s in raw.get("stops", [])[:MAX_STOPS]:
        if isinstance(s, dict) and s.get("id") is not None and s["id"] not in batch.items:
            continue
        stops.append(clean_stop(batch, s))
    out: Dict[str, Any] = {"stops": stops}
    if raw.get("loop"):
        out["loop"] = True
    for key in ("dw", "t"):
        if raw.get(key):
            out[key] = _dwell(raw[key]) if key == "dw" else _clip(raw[key], 120)
    if not stops and len(out) == 1:
        return None
    return out


def outline_line(doc: Dict[str, Any]) -> str:
    """One line for board_read: the tour as ordered stops ('' when there is none)."""
    tour = doc.get("tour")
    if not tour or not tour.get("stops"):
        return ""
    items = doc.get("items") or {}
    bits = []
    for i, s in enumerate(tour["stops"], 1):
        if "id" in s:
            it = items.get(s["id"])
            name = s.get("t") or ((it or {}).get("title") or (it or {}).get("text") or "").strip()[:30]
            gone = "" if it else " (missing)"
            bits.append(f"{i}:{s['id']}{' ' + chr(34) + name + chr(34) if name else ''}{gone}")
        else:
            bits.append(f"{i}:{'rect' if 'r' in s else 'view'}{' ' + chr(34) + s['t'] + chr(34) if s.get('t') else ''}")
        if s.get("dw"):
            bits[-1] += f" {s['dw']:g}s"
    extra = (" loop" if tour.get("loop") else "") + (f" dwell={tour['dw']:g}s" if tour.get("dw") else "")
    title = f' "{tour["t"]}"' if tour.get("t") else ""
    return f"tour{title}{extra}: " + " > ".join(bits)
