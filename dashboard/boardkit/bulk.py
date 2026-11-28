"""Bulk and compound board ops, expanded by the engine into plain ``add`` / ``set`` ops.

Because they expand to ordinary ops, one ``board_apply`` batch holding any number of them is one
atomic commit and ONE undo step, and clients replay the normalised forward ops as usual.

``place``      add many items on a tidy grid (what ``import`` produces; also usable directly)
``set_where``  set fields on every item matching a filter (mark 37 stations ok/fail/wait ...)
``zones``      create titled frames (row / column / grid), move items into them by rule, lay each
               zone out on the 24px grid with uniform spacing and size the frames to fit
``arrange``    grid-pack a frame's items (or the matching items) with uniform spacing

Filter (``where``): ids, k (kind or list), tag, text (substring, case-insensitive, any of a list),
num ('12' / '10-20' / [1,2,3]), mark ('ok'|'fail'|'wait'|'none'), by ('h'|'u'), frame (id: items
whose centre lies inside it), in (column id: its kids).
"""
from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Tuple

from . import place as place_mod

GRID = 24
TOP_PAD = 72          # frame label + breathing room (multiple of the grid)
SIDE_PAD = 24
MIN_ZONE = (312, 240)
MAX_MATCH = 600
MARKS = ("ok", "fail", "wait")


def _err(msg: str) -> Exception:
    from .engine import OpError
    return OpError(msg)


def _round(n: float) -> int:
    return int(math.floor(n + 0.5))


def up(n: float, g: int = GRID) -> int:
    return int(math.ceil(n / g - 1e-9) * g)


def snap(n: float, g: int = GRID) -> int:
    return _round(n / g) * g


def _gap(raw: Any, default: int) -> int:
    if raw is None:
        return default
    try:
        return int(max(8, min(240, round(float(raw)))))
    except (TypeError, ValueError):
        raise _err("gap must be a number") from None


# ── size estimates (the server has no DOM; over-estimating only adds air, never overlap) ──

def est_size(batch: Any, iid: str) -> Tuple[int, int]:
    from .engine import DEFAULT_SIZE
    it = batch.items[iid]
    rect = batch.rect_of(iid)
    w = int(rect["w"]) if rect else DEFAULT_SIZE.get(it["k"], (200, 100))[0]
    h = int(rect["h"]) if rect else DEFAULT_SIZE.get(it["k"], (200, 100))[1]
    if it["k"] in ("image", "video") and it.get("iw") and it.get("ih"):  # h is ignored by the board
        h = _media_h(it["k"], it.get("w") or w, it["iw"], it["ih"])
    elif it.get("h") is None and it["k"] == "card":
        h = _card_h(it, w)
    elif it.get("h") is None and it["k"] == "text":
        h = _text_h(it, w)
    return max(1, w), max(1, h)


def _text_h(it: Dict[str, Any], w: float) -> int:
    """Free text grows with its lines on the board; a 40 px guess let notes run into what was below."""
    big = it.get("size") == "h"
    chars = max(8, int(w / (13.5 if big else 7.6)))
    lines = sum(max(1, math.ceil(len(ln) / chars)) for ln in str(it.get("text") or "").split("\n"))
    return max(40, min(1600, lines * (34 if big else 22) + 8))


def _media_h(kind: str, w: float, iw: float, ih: float) -> int:
    ratio = ih / iw if iw else 0.6
    return int(round((w - 14) * ratio + 56)) if kind == "image" else int(round((w - 2) * ratio + 84))


def _card_h(it: Dict[str, Any], w: float) -> int:
    chars = max(14, int((w - 34) / 7.4))
    lines = sum(max(1, math.ceil(len(ln) / chars)) for ln in (it.get("text") or "").split("\n")) if it.get("text") else 0
    h = 28 + (26 if it.get("title") else 0) + 19 * lines + (26 if it.get("tags") else 0) + (20 if it.get("due") else 0)
    return max(64, min(900, h))


# ── packing ──────────────────────────────────────────────────────────────

def pack(sizes: List[Tuple[int, int]], cols: int, gap: int) -> Tuple[List[Tuple[int, int]], int, int]:
    """Row-major grid; cells are rounded up to the grid so every item lands on a multiple of 24
    (given a snapped origin and a 24-multiple gap). Returns (offsets, width, height)."""
    n = len(sizes)
    if n == 0:
        return [], 0, 0
    cols = max(1, min(cols, n))
    rows = [sizes[i:i + cols] for i in range(0, n, cols)]
    colw = [0] * cols
    for r in rows:
        for j, (w, _) in enumerate(r):
            colw[j] = max(colw[j], up(w))
    rowh = [max(up(h) for _, h in r) for r in rows]
    xs = [0]
    for w in colw[:-1]:
        xs.append(xs[-1] + w + gap)
    out: List[Tuple[int, int]] = []
    y = 0
    for ri, r in enumerate(rows):
        for j in range(len(r)):
            out.append((xs[j], y))
        y += rowh[ri] + gap
    return out, sum(colw) + gap * (cols - 1), y - gap


def auto_cols(sizes: List[Tuple[int, int]], gap: int, aspect: float = 1.5, maxcols: int = 8,
              avail: Optional[float] = None) -> int:
    n = len(sizes)
    if n <= 1:
        return 1
    best, best_score = 1, float("inf")
    for c in range(1, min(maxcols, n) + 1):
        _, w, h = pack(sizes, c, gap)
        if avail is not None and w > avail and c > 1:
            continue
        score = abs(math.log(max(w, 1) / max(h, 1)) - math.log(aspect))
        if score < best_score - 1e-9:
            best, best_score = c, score
    return best


def reading_order(batch: Any, iids: List[str]) -> List[str]:
    """Top-to-bottom rows (items overlapping vertically share a row), left-to-right inside one."""
    rects = {i: batch.rect_of(i) or {"x": 0, "y": 0, "w": 1, "h": 1} for i in iids}
    rows: List[Dict[str, Any]] = []
    for i in sorted(iids, key=lambda i: (rects[i]["y"], rects[i]["x"], i)):
        r = rects[i]
        row = rows[-1] if rows else None
        if row is not None:
            overlap = min(row["bottom"], r["y"] + r["h"]) - max(row["top"], r["y"])
            if overlap >= 0.4 * min(r["h"], row["bottom"] - row["top"]):
                row["ids"].append(i)
                row["top"] = min(row["top"], r["y"])
                row["bottom"] = max(row["bottom"], r["y"] + r["h"])
                continue
        rows.append({"top": r["y"], "bottom": r["y"] + r["h"], "ids": [i]})
    out: List[str] = []
    for row in rows:
        out.extend(sorted(row["ids"], key=lambda i: (rects[i]["x"], i)))
    return out


# ── filter ───────────────────────────────────────────────────────────────

def _texts(it: Dict[str, Any]) -> str:
    return " ".join(str(it[k]) for k in ("title", "text", "sub", "cap", "num", "label", "note", "url") if it.get(k))


def _as_list(v: Any) -> List[Any]:
    return v if isinstance(v, list) else [v]


def _num_ok(spec: Any, num: Any) -> bool:
    try:
        n = int(str(num).strip().lstrip("#"))
    except (TypeError, ValueError):
        return False
    for s in _as_list(spec):
        if isinstance(s, (int, float)) and not isinstance(s, bool):
            if n == int(s):
                return True
        elif isinstance(s, str) and "-" in s.strip("- "):
            a, _, b = s.partition("-")
            try:
                if int(a) <= n <= int(b):
                    return True
            except ValueError:
                continue
        elif isinstance(s, str):
            try:
                if n == int(s):
                    return True
            except ValueError:
                continue
    return False


def select(batch: Any, where: Any, *, explicit_kids: bool = False) -> List[str]:
    """Ids matching ``where`` (order: by id, then see ``reading_order`` if layout matters)."""
    if not isinstance(where, dict) or not where:
        raise _err("where must be an object like {k:'box', text:'Station'} (use ids:[...] for explicit items)")
    known = {"ids", "k", "tag", "text", "num", "mark", "by", "frame", "in"}
    extra = set(where) - known
    if extra:
        raise _err(f"unknown where key {sorted(extra)[0]!r} (use {', '.join(sorted(known))})")
    pool = list(batch.items)
    if where.get("ids") is not None:
        ids_ = where["ids"]
        if not isinstance(ids_, list) or not ids_:
            raise _err("where.ids must be a non-empty list")
        seen: List[str] = []
        for v in ids_:
            r = batch.resolve(v)
            if r not in seen:
                seen.append(r)
        pool = seen
    if where.get("in") is not None:
        cid = batch.column(where["in"])
        kids = set(batch.items[cid].get("kids") or [])
        pool = [i for i in pool if i in kids]
    if where.get("frame") is not None:
        fid = batch.resolve(where["frame"])
        if batch.items[fid]["k"] != "frame":
            raise _err(f"{fid} is not a frame")
        f = batch.rect_of(fid)
        inside = set()
        for i in pool:
            if i == fid or batch.items[i]["k"] in ("line",):
                continue
            r = batch.rect_of(i)
            if r is None:
                continue
            cx, cy = r["x"] + r["w"] / 2, r["y"] + r["h"] / 2
            if f["x"] <= cx <= f["x"] + f["w"] and f["y"] <= cy <= f["y"] + f["h"]:
                inside.add(i)
        pool = [i for i in pool if i in inside]
    kinds = None
    if where.get("k") is not None:
        kinds = set(_as_list(where["k"]))
        pool = [i for i in pool if batch.items[i]["k"] in kinds]
    elif where.get("ids") is None:
        pool = [i for i in pool if batch.items[i]["k"] != "line"]
    if where.get("tag") is not None:
        want = {str(t).lstrip("#").strip().lower() for t in _as_list(where["tag"])}
        pool = [i for i in pool if want & {str(t).lower() for t in batch.items[i].get("tags") or []}]
    if where.get("text") is not None:
        needles = [str(t).lower() for t in _as_list(where["text"]) if str(t)]
        if not needles:
            raise _err("where.text is empty")
        pool = [i for i in pool if any(n in _texts(batch.items[i]).lower() for n in needles)]
    if where.get("num") is not None:
        pool = [i for i in pool if _num_ok(where["num"], batch.items[i].get("num"))]
    if where.get("mark") is not None:
        m = where["mark"]
        if m not in MARKS + ("none",):
            raise _err("where.mark must be ok, fail, wait or none")
        pool = [i for i in pool if (batch.items[i].get("mark") or "none") == m]
    if where.get("by") is not None:
        if where["by"] not in ("h", "u"):
            raise _err("where.by must be 'h' or 'u'")
        pool = [i for i in pool if (batch.items[i].get("by") or "u") == where["by"]]
    if len(pool) > MAX_MATCH:
        raise _err(f"matched {len(pool)} items (limit {MAX_MATCH}); narrow the filter")
    return pool


def describe(where: Any) -> str:
    return ", ".join(f"{k}={v}" for k, v in where.items()) if isinstance(where, dict) else str(where)


# ── set_where ────────────────────────────────────────────────────────────

def expand_set_where(batch: Any, op: Dict[str, Any]) -> List[Dict[str, Any]]:
    """{op:'set_where', where, p}  or  {op:'set_where', rules:[{where, p}, ...]} (later rules win)."""
    rules = op.get("rules")
    if rules is None:
        rules = [{"where": op.get("where"), "p": op.get("p")}]
    if not isinstance(rules, list) or not rules or len(rules) > 100:
        raise _err("rules must be a list of 1-100 {where, p}")
    out: List[Dict[str, Any]] = []
    shadow: Dict[str, Dict[str, Any]] = {}
    total = 0
    for n, rule in enumerate(rules):
        if not isinstance(rule, dict) or not isinstance(rule.get("p"), dict) or not rule["p"]:
            raise _err(f"rule {n} needs p (the fields to set; null clears one)")
        ids_ = select(batch, rule.get("where"))
        if not ids_:
            raise _err(f"{'rule ' + str(n) + ': ' if len(rules) > 1 else ''}where matched nothing ({describe(rule.get('where'))})")
        total += len(ids_)
        for iid in ids_:
            cur = shadow.setdefault(iid, {})
            patch = {k: v for k, v in rule["p"].items()
                     if k not in ("k", "by", "in", "kids", "a", "b") and (k in batch_fields(batch, iid))}
            fresh = {k: v for k, v in patch.items() if _cur(batch, iid, cur, k) != v}
            if fresh:
                cur.update(fresh)
                out.append({"op": "set", "id": iid, "p": fresh})
    if total and not out and not any(_applicable(batch, i, r["p"]) for r in rules for i in select(batch, r["where"])):
        raise _err("none of the matched items has those fields (check p against the kind's fields)")
    return out


def batch_fields(batch: Any, iid: str) -> Tuple[str, ...]:
    from .engine import FIELDS
    return FIELDS[batch.items[iid]["k"]]


def _applicable(batch: Any, iid: str, p: Dict[str, Any]) -> bool:
    return any(k in batch_fields(batch, iid) for k in p)


def _cur(batch: Any, iid: str, shadow: Dict[str, Any], key: str) -> Any:
    return shadow[key] if key in shadow else batch.items[iid].get(key)


# ── place ────────────────────────────────────────────────────────────────

def _content_origin(batch: Any, exclude: Iterable[str] = ()) -> Tuple[int, int]:
    skip = set(exclude)
    xs, ys = [], []
    for iid, it in batch.items.items():
        if iid in skip or "x" not in it or "y" not in it or it.get("in"):
            continue
        r = batch.rect_of(iid)
        if r is None:
            continue
        xs.append(r["x"] + r["w"])
        ys.append(r["y"])
    if not xs:
        return 0, 0
    return snap(max(xs) + 80), snap(min(ys))


def _at(raw: Any) -> Tuple[int, int]:
    try:
        if isinstance(raw, dict):
            return snap(float(raw["x"])), snap(float(raw["y"]))
        if isinstance(raw, (list, tuple)) and len(raw) == 2:
            return snap(float(raw[0])), snap(float(raw[1]))
    except (KeyError, TypeError, ValueError):
        pass
    raise _err("at must be {x, y} or [x, y]")


def expand_place(batch: Any, op: Dict[str, Any]) -> List[Dict[str, Any]]:
    """{op:'place', items:[{ref?, item:{k,...}, size?:[w,h]}], layout?:'grid'|'row'|'column', at?, into?, gap?, cols?}"""
    from .engine import DEFAULT_SIZE, KINDS, SHAPE_SIZE
    entries = op.get("items")
    if not isinstance(entries, list) or not entries:
        raise _err("place needs a non-empty items list")
    if len(entries) > 200:
        raise _err("place takes at most 200 items")
    layout = op.get("layout", "grid")
    if layout not in ("grid", "row", "column"):
        raise _err("layout must be grid, row or column")
    gap = _gap(op.get("gap"), GRID)
    sizes: List[Tuple[int, int]] = []
    adds: List[Dict[str, Any]] = []
    for n, e in enumerate(entries):
        if not isinstance(e, dict):
            raise _err(f"items[{n}] must be an object")
        item = e.get("item") if isinstance(e.get("item"), dict) else e if e.get("k") else None
        if item is None or item.get("k") not in KINDS or item["k"] in ("line", "draw"):
            raise _err(f"items[{n}] needs item.k (any kind except line and draw)")
        size = e.get("size")
        if isinstance(size, (list, tuple)) and len(size) == 2:
            sizes.append((int(size[0]), int(size[1])))
        else:
            # the shared estimate (place.py): media take their own shape, text its own height
            est = place_mod.estimate_size(item)
            sizes.append((int(est["w"]), int(est["h"])))
        # the block is laid out here and placed clear of everything as a whole: no per-item nudging
        add: Dict[str, Any] = {"op": "add", "item": {k: v for k, v in item.items() if k not in ("x", "y")}, "exact": True}
        if e.get("ref") is not None:
            add["ref"] = e["ref"]
        adds.append(add)

    into = op.get("into")
    extra: List[Dict[str, Any]] = []
    if into is not None:
        tid = batch.resolve(into)
        kind = batch.items[tid]["k"]
        if kind == "col":
            for a in adds:
                a["item"]["in"] = tid
            return adds
        if kind != "frame":
            raise _err(f"into must be a frame or a column, {tid} is a {kind}")
        f = batch.rect_of(tid)
        inner_w = f["w"] - 2 * SIDE_PAD
        cell_w = max(up(w) for w, _ in sizes)
        if layout == "row":
            cols = len(sizes)
        elif layout == "column":
            cols = 1
        elif op.get("cols") is not None:
            cols = int(max(1, min(12, round(float(op["cols"])))))
        else:
            cols = max(1, min(len(sizes), int((inner_w + gap) // (cell_w + gap))))
        offs, W, H = pack(sizes, cols, gap)
        # start below what already sits in the frame
        y0 = f["y"] + TOP_PAD
        for iid in batch.items:
            r = batch.rect_of(iid)
            if r is None or batch.items[iid]["k"] in ("frame", "line"):
                continue
            cx, cy = r["x"] + r["w"] / 2, r["y"] + r["h"] / 2
            if f["x"] <= cx <= f["x"] + f["w"] and f["y"] <= cy <= f["y"] + f["h"]:
                y0 = max(y0, up(r["y"] + r["h"] + gap - f["y"]) + f["y"])
        x0 = snap(f["x"] + SIDE_PAD)
        y0 = snap(y0)
        need_w = max(f["w"], up(W + 2 * SIDE_PAD))
        need_h = max(f["h"], up(y0 + H + SIDE_PAD - f["y"]))
        grow: Dict[str, Any] = {}
        if need_w > f["w"]:
            grow["w"] = need_w
        if need_h > f["h"]:
            grow["h"] = need_h
        if grow:
            extra.append({"op": "set", "id": tid, "p": grow})
    else:
        if layout == "row":
            cols = len(sizes)
        elif layout == "column":
            cols = 1
        elif op.get("cols") is not None:
            cols = int(max(1, min(12, round(float(op["cols"])))))
        else:
            cols = auto_cols(sizes, gap, aspect=1.6, maxcols=8)
        offs, W, H = pack(sizes, cols, gap)
        x0, y0 = _at(op["at"]) if op.get("at") is not None else _content_origin(batch)
        # the whole block steps clear of what is already there (nearest free spot, on the grid)
        spot = place_mod.free_place({"x": x0, "y": y0}, {"w": W, "h": H}, batch.obstacles(), gap=GRID)
        if (spot["x"], spot["y"]) != (x0, y0):
            x0, y0 = up(spot["x"]), up(spot["y"])
            if any(place_mod.collides({"x": x0, "y": y0, "w": W, "h": H}, o, 0) for o in batch.obstacles()):
                spot = place_mod.free_place({"x": x0, "y": y0}, {"w": W, "h": H}, batch.obstacles(), gap=2 * GRID)
                x0, y0 = up(spot["x"]), up(spot["y"])
    for a, (dx, dy) in zip(adds, offs):
        a["item"]["x"], a["item"]["y"] = x0 + dx, y0 + dy
    return extra + adds


# ── zones / arrange ──────────────────────────────────────────────────────

def _movable(batch: Any, iid: str) -> bool:
    return batch.items[iid]["k"] not in ("line", "frame", "draw", "live") or batch.items[iid]["k"] == "live"


def _claim(batch: Any, spec: Dict[str, Any], taken: set) -> List[str]:
    where = spec.get("where")
    if spec.get("ids") is not None:
        where = {**(where or {}), "ids": spec["ids"]}
    if where is None:
        return []
    explicit = where.get("ids") is not None or where.get("in") is not None
    got = select(batch, where)
    out = []
    for i in got:
        it = batch.items[i]
        if i in taken or it["k"] == "line":
            continue
        if it.get("in") and not explicit:
            continue
        out.append(i)
    # explicit id lists keep the caller's order; numbered items (stations 1..37) go by number;
    # anything else keeps its reading order on the board
    if spec.get("ids") is not None:
        return out
    top = [i for i in out if not batch.items[i].get("in")]
    kids = [i for i in out if batch.items[i].get("in")]
    nums = [_as_int(batch.items[i].get("num")) for i in top]
    if top and all(n is not None for n in nums):
        top = [i for _, i in sorted(zip(nums, top), key=lambda t: (t[0], t[1]))]
    else:
        top = reading_order(batch, top)
    return top + kids


def _center_in(r: Dict[str, float], f: Dict[str, float]) -> bool:
    cx, cy = r["x"] + r["w"] / 2, r["y"] + r["h"] / 2
    return f["x"] <= cx <= f["x"] + f["w"] and f["y"] <= cy <= f["y"] + f["h"]


def frame_members(batch: Any, fid: str, skip: Iterable[str] = ()) -> List[str]:
    """Everything that sits in a frame (by centre), nested frames and strokes included, plus connectors
    whose free ends ([x, y]) are inside it: what has to move with the frame to keep it intact."""
    f = batch.rect_of(fid)
    skip = set(skip)
    out: List[str] = []
    if not f:
        return out
    for i, it in batch.items.items():
        if i == fid or i in skip or it.get("in"):
            continue
        if it["k"] == "line":
            pts = [e for e in (it.get("a"), it.get("b")) if isinstance(e, list)]
            if pts and all(f["x"] <= p[0] <= f["x"] + f["w"] and f["y"] <= p[1] <= f["y"] + f["h"] for p in pts):
                out.append(i)
            continue
        r = batch.rect_of(i)
        if r and _center_in(r, f):
            out.append(i)
    return out


def units_of(batch: Any, ids_: List[str], skip: Iterable[str] = ()) -> List[Dict[str, Any]]:
    """Group picked items into rigid units, in the order picked: a frame travels with what is inside it (a
    diagram stays a diagram), all picked strokes travel together as one sketch, anything else alone.
    ``rect`` is the unit's box; ``ids`` everything that moves; ``lead`` the id whose order counts."""
    skip = set(skip)
    picked = [i for i in ids_ if i not in skip]
    frames = sorted([i for i in picked if batch.items[i]["k"] == "frame"],
                    key=lambda i: -((batch.rect_of(i) or {"w": 0})["w"] * (batch.rect_of(i) or {"h": 0})["h"]))
    owner: Dict[str, Dict[str, Any]] = {}
    swallowed: set = set()
    for fid in frames:
        if fid in swallowed:
            continue
        mem = frame_members(batch, fid, skip)
        rs = [r for r in (batch.rect_of(i) for i in [fid] + mem) if r]  # what pokes out of the frame counts too
        x0, y0 = min(r["x"] for r in rs), min(r["y"] for r in rs)
        box = {"x": x0, "y": y0, "w": max(r["x"] + r["w"] for r in rs) - x0, "h": max(r["y"] + r["h"] for r in rs) - y0}
        unit = {"lead": fid, "ids": [fid] + mem, "rect": box}
        owner[fid] = unit
        swallowed.update(mem)
    strokes = [i for i in picked if batch.items[i]["k"] == "draw" and i not in swallowed]
    if strokes:
        rs = [batch.rect_of(i) for i in strokes]
        x0, y0 = min(r["x"] for r in rs), min(r["y"] for r in rs)
        x1, y1 = max(r["x"] + r["w"] for r in rs), max(r["y"] + r["h"] for r in rs)
        owner[strokes[0]] = {"lead": strokes[0], "ids": strokes, "rect": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}}
        swallowed.update(strokes[1:])
    out: List[Dict[str, Any]] = []
    for i in picked:
        if i in owner:
            out.append(owner[i])
        elif i not in swallowed and batch.items[i]["k"] not in ("frame", "draw"):
            out.append({"lead": i, "ids": [i], "rect": None})
    return out


def unit_size(batch: Any, u: Dict[str, Any]) -> Tuple[int, int]:
    if u["rect"] is None:
        return est_size(batch, u["lead"])
    return max(1, int(math.ceil(u["rect"]["w"]))), max(1, int(math.ceil(u["rect"]["h"])))


def unit_moves(batch: Any, u: Dict[str, Any], x: int, y: int, ops: List[Dict[str, Any]]) -> None:
    """Ops that put unit ``u``'s box at (x, y)."""
    if u["rect"] is None:
        _hoist(batch, u["lead"], ops)
        ops.append({"op": "set", "id": u["lead"], "p": {"x": x, "y": y}})
        return
    dx, dy = round(x - u["rect"]["x"]), round(y - u["rect"]["y"])
    if not dx and not dy:
        return
    for i in u["ids"]:
        it = batch.items[i]
        if it["k"] == "line":
            p = {e: [it[e][0] + dx, it[e][1] + dy] for e in ("a", "b") if isinstance(it.get(e), list)}
            if p:
                ops.append({"op": "set", "id": i, "p": p})
        elif "x" in it and "y" in it:
            ops.append({"op": "set", "id": i, "p": {"x": it["x"] + dx, "y": it["y"] + dy}})


def _as_int(v: Any) -> Optional[int]:
    try:
        return int(str(v).strip().lstrip("#"))
    except (TypeError, ValueError):
        return None


def _hoist(batch: Any, iid: str, ops: List[Dict[str, Any]]) -> None:
    if batch.items[iid].get("in"):
        ops.append({"op": "set", "id": iid, "p": {"in": None}})


def expand_zones(batch: Any, op: Dict[str, Any]) -> List[Dict[str, Any]]:
    zones = op.get("zones")
    if not isinstance(zones, list) or not zones or len(zones) > 24:
        raise _err("zones must be a list of 1-24 {title, where?|ids?, ref?, frame?, w?, h?, cols?, note?}")
    layout = op.get("layout", "row")
    if layout not in ("row", "column", "grid"):
        raise _err("layout must be row, column or grid")
    gap = _gap(op.get("gap"), 2 * GRID)
    igap = _gap(op.get("spacing"), GRID)       # spacing between items inside a zone
    maxcols = int(max(1, min(12, round(float(op.get("cols", 6)))))) if op.get("cols") is not None else 6
    taken: set = set()
    plans: List[Dict[str, Any]] = []
    for n, z in enumerate(zones):
        if not isinstance(z, dict):
            raise _err(f"zones[{n}] must be an object")
        existing = batch.resolve(z["frame"]) if z.get("frame") is not None else None
        if existing is not None and batch.items[existing]["k"] != "frame":
            raise _err(f"{existing} is not a frame")
        if existing is None and not (isinstance(z.get("title"), str) and z["title"].strip()):
            raise _err(f"zones[{n}] needs a title (or frame: <existing frame id>)")
        if existing is not None and z.get("where") is None and z.get("ids") is None:
            z = {**z, "where": {"frame": existing}}
        moved = _claim(batch, z, taken)
        units = units_of(batch, moved, skip=taken | ({existing} if existing else set()))
        for u in units:
            taken.update(u["ids"])
        plans.append({"z": z, "frame": existing, "units": units})
    moving = taken
    prims: List[Dict[str, Any]] = []

    # sizes per unit (an item, a frame with its contents, a sketch)
    def sizes_of(units: List[Dict[str, Any]]) -> List[Tuple[int, int]]:
        return [unit_size(batch, u) for u in units]

    # 1) existing frames: grid inside, grow to fit
    for p in plans:
        if p["frame"] is None:
            continue
        f = batch.rect_of(p["frame"])
        units = p["units"]
        sz = sizes_of(units)
        cols = int(p["z"]["cols"]) if p["z"].get("cols") else auto_cols(sz, igap, 1.5, maxcols, avail=f["w"] - 2 * SIDE_PAD)
        offs, W, H = pack(sz, cols, igap)
        x0, y0 = snap(f["x"] + SIDE_PAD), snap(f["y"] + TOP_PAD)
        for u, (dx, dy) in zip(units, offs):
            unit_moves(batch, u, x0 + dx, y0 + dy, prims)
        grow = {}
        if up(W + 2 * SIDE_PAD) > f["w"]:
            grow["w"] = up(W + 2 * SIDE_PAD)
        if up(TOP_PAD + H + SIDE_PAD) > f["h"]:
            grow["h"] = up(TOP_PAD + H + SIDE_PAD)
        title = p["z"].get("title")
        if isinstance(title, str) and title.strip():
            grow["title"] = title
        if isinstance(p["z"].get("note"), str):
            grow["note"] = p["z"]["note"]
        if grow:
            prims.append({"op": "set", "id": p["frame"], "p": grow})

    # 2) new zones: size each from its content, then lay the zones out
    new = [p for p in plans if p["frame"] is None]
    for p in new:
        z = p["z"]
        sz = sizes_of(p["units"])
        want_w = int(z["w"]) if z.get("w") else None
        if z.get("cols"):
            cols = int(max(1, min(12, round(float(z["cols"])))))
        else:
            cols = auto_cols(sz, igap, 1.5, maxcols, avail=(want_w - 2 * SIDE_PAD) if want_w else None)
        offs, W, H = pack(sz, cols, igap)
        p.update(offs=offs, w=max(MIN_ZONE[0], up(W + 2 * SIDE_PAD), up(want_w) if want_w else 0),
                 h=max(MIN_ZONE[1], up(TOP_PAD + H + SIDE_PAD), up(int(z["h"])) if z.get("h") else 0))
    if new:
        if layout == "row":
            hh = max(p["h"] for p in new)
            for p in new:
                p["h"] = hh
        elif layout == "column":
            ww = max(p["w"] for p in new)
            for p in new:
                p["w"] = ww
        if layout == "grid":
            zc = int(max(1, min(6, round(float(op["cols"]))))) if op.get("cols") is not None else max(1, math.ceil(math.sqrt(len(new))))
            wcol = [0] * zc
            for i, p in enumerate(new):
                wcol[i % zc] = max(wcol[i % zc], p["w"])
            for i, p in enumerate(new):
                p["w"] = wcol[i % zc]
            rowsz = [new[i:i + zc] for i in range(0, len(new), zc)]
            for r in rowsz:
                hh = max(p["h"] for p in r)
                for p in r:
                    p["h"] = hh
        cx = cy = 0
        rowtop = 0
        for i, p in enumerate(new):
            if layout == "row":
                p["fx"], p["fy"] = cx, 0
                cx += p["w"] + gap
            elif layout == "column":
                p["fx"], p["fy"] = 0, cy
                cy += p["h"] + gap
            else:
                if i % zc == 0 and i:
                    cx, cy = 0, cy + new[i - 1]["h"] + gap
                p["fx"], p["fy"] = cx, cy
                cx += p["w"] + gap
        gw = max(p["fx"] + p["w"] for p in new)
        gh = max(p["fy"] + p["h"] for p in new)
        # origin
        if op.get("at") is not None:
            ox, oy = _at(op["at"])
        else:
            rs = [batch.rect_of(i) for i in moving if batch.rect_of(i)]
            if rs:
                ox, oy = snap(min(r["x"] for r in rs) - SIDE_PAD), snap(min(r["y"] for r in rs) - TOP_PAD)
            else:
                ox, oy = _content_origin(batch)
        # nothing else may sit under the new zones: shift the whole group below what it hits
        obstacles = []
        for i, it in batch.items.items():
            if i in moving or it["k"] in ("line", "draw") or it.get("in"):
                continue
            r = batch.rect_of(i)
            if r:
                obstacles.append(r)
        for _ in range(30):
            hit = [o for o in obstacles if ox < o["x"] + o["w"] and ox + gw > o["x"] and oy < o["y"] + o["h"] and oy + gh > o["y"]]
            if not hit:
                break
            oy = snap(max(o["y"] + o["h"] for o in hit) + gap)
        for p in new:
            ref = p["z"].get("ref")
            if ref is None:
                n = 0
                ref = "$zone0"
                used = {pp["ref"] for pp in new if pp.get("ref")} | set(batch.refs)
                while ref in used:
                    n += 1
                    ref = f"$zone{n}"
            p["ref"] = ref
            frame = {"k": "frame", "title": p["z"]["title"], "x": ox + p["fx"], "y": oy + p["fy"], "w": p["w"], "h": p["h"]}
            if isinstance(p["z"].get("note"), str):
                frame["note"] = p["z"]["note"]
            prims.append({"op": "add", "ref": ref, "item": frame})
        for p in new:
            x0, y0 = ox + p["fx"] + SIDE_PAD, oy + p["fy"] + TOP_PAD
            for u, (dx, dy) in zip(p["units"], p["offs"]):
                unit_moves(batch, u, x0 + dx, y0 + dy, prims)
    return prims


def expand_arrange(batch: Any, op: Dict[str, Any]) -> List[Dict[str, Any]]:
    """{op:'arrange', frame:<id> | ids:[...] | where:{...}, cols?, gap?}: uniform grid, grows the frame."""
    gap = _gap(op.get("gap"), GRID)
    if op.get("frame") is not None and op.get("where") is None and op.get("ids") is None:
        zone = {"frame": op["frame"], "cols": op.get("cols")}
        return expand_zones(batch, {"zones": [{k: v for k, v in zone.items() if v is not None}], "spacing": gap})
    where = op.get("where")
    if op.get("ids") is not None:
        where = {**(where or {}), "ids": op["ids"]}
    if where is None:
        raise _err("arrange needs frame, ids or where")
    if op.get("frame") is not None:
        where = {**where, "frame": op["frame"]}
    ids_ = [i for i in select(batch, where) if batch.items[i]["k"] != "line" and not batch.items[i].get("in")]
    if not ids_:
        raise _err(f"arrange matched nothing ({describe(where)})")
    ids_ = ids_ if op.get("ids") is not None else reading_order(batch, ids_)
    units = units_of(batch, ids_)  # frames bring their contents, strokes stay one sketch
    sz = [unit_size(batch, u) for u in units]
    rs = [u["rect"] or batch.rect_of(u["lead"]) for u in units]
    x0, y0 = snap(min(r["x"] for r in rs)), snap(min(r["y"] for r in rs))
    span = max(r["x"] + r["w"] for r in rs) - min(r["x"] for r in rs)
    cols = int(max(1, min(12, round(float(op["cols"]))))) if op.get("cols") else auto_cols(
        sz, gap, 1.6, 12, avail=min(2400 if all(u["rect"] is None for u in units) else 100000, max(640, span)))
    offs, _, _ = pack(sz, cols, gap)
    out: List[Dict[str, Any]] = []
    for u, (dx, dy) in zip(units, offs):
        unit_moves(batch, u, x0 + dx, y0 + dy, out)
    return out
