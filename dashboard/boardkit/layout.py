"""Board layout: tidy and insert-on-connector, as pure functions over rectangles.

Mirrors ``src/board/layout.ts`` (the UI runs the TS one on measured DOM rects; Hermes' ``tidy``
and ``insert_on_edge`` ops run this one on estimated sizes). Both are checked against
``test/fixtures/layout-cases.json``. Everything is rounded half-up like JS ``Math.round``.
"""
from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

GRID = 24
TIDY_GAP = 24
INSERT_GAP = 48

Rect = Dict[str, float]  # x, y, w, h


def _round(n: float) -> int:
    return int(math.floor(n + 0.5))


def _snap(n: float, g: int) -> float:
    return _round(n / g) * g


def tidy_plan(blocks: Sequence[Dict[str, Any]], gap: int = TIDY_GAP, grid: int = GRID,
              max_w: Optional[float] = None, fixed: Optional[Sequence[Rect]] = None) -> List[Dict[str, Any]]:
    """blocks: [{ids: [..], rect: {x,y,w,h}}] -> [{ids, x, y}] in reading order."""
    if not blocks:
        return []
    x0 = min(b["rect"]["x"] for b in blocks)
    y0 = min(b["rect"]["y"] for b in blocks)
    x1 = max(b["rect"]["x"] + b["rect"]["w"] for b in blocks)
    if max_w is None:
        max_w = min(2400, max(640, x1 - x0))

    def key_yx(b):
        return (b["rect"]["y"], b["rect"]["x"], b["ids"][0])

    def key_xy(b):
        return (b["rect"]["x"], b["ids"][0])

    rows: List[Dict[str, Any]] = []
    for b in sorted(blocks, key=key_yx):
        r = b["rect"]
        row = rows[-1] if rows else None
        if row is not None:
            overlap = min(row["bottom"], r["y"] + r["h"]) - max(row["top"], r["y"])
            if overlap >= 0.4 * min(r["h"], row["bottom"] - row["top"]):
                row["items"].append(b)
                row["top"] = min(row["top"], r["y"])
                row["bottom"] = max(row["bottom"], r["y"] + r["h"])
                continue
        rows.append({"top": r["y"], "bottom": r["y"] + r["h"], "items": [b]})

    lines: List[List[Dict[str, Any]]] = []
    for row in rows:
        cur: List[Dict[str, Any]] = []
        w = 0.0
        for b in sorted(row["items"], key=key_xy):
            if cur and w + gap + b["rect"]["w"] > max_w:
                lines.append(cur)
                cur, w = [], 0.0
            w += (gap if cur else 0) + b["rect"]["w"]
            cur.append(b)
        if cur:
            lines.append(cur)

    out: List[Dict[str, Any]] = []
    y = _snap(y0, grid)
    left = _snap(x0, grid)
    for line in lines:
        x = left
        for b in line:
            out.append({"ids": b["ids"], "x": _round(x), "y": _round(y)})
            x += b["rect"]["w"] + gap
        y += max(b["rect"]["h"] for b in line) + gap
    # Items that stay put (wired ones, frames) are obstacles: a block landing on one moves
    # below it, so nothing ends up on top of anything.
    if fixed:
        size = {b["ids"][0]: b["rect"] for b in blocks}
        for _ in range(20):
            bottom = None
            for o in out:
                r = size[o["ids"][0]]
                for f in fixed:
                    if (o["x"] < f["x"] + f["w"] and o["x"] + r["w"] > f["x"]
                            and o["y"] < f["y"] + f["h"] and o["y"] + r["h"] > f["y"]):
                        bottom = f["y"] + f["h"] if bottom is None else max(bottom, f["y"] + f["h"])
            if bottom is None:
                break
            top = min(o["y"] for o in out)
            dy = max(_snap(bottom + gap - top, grid), grid)
            for o in out:
                o["y"] = _round(o["y"] + dy)
    return out


def insert_plan(a: Rect, b: Rect, size: Dict[str, float], gap: int = INSERT_GAP,
                shift_b: bool = True) -> Dict[str, Any]:
    """Where a ``size`` item goes between rects A and B, and how far B moves to make room."""
    hgap = max(b["x"] - (a["x"] + a["w"]), a["x"] - (b["x"] + b["w"]))
    vgap = max(b["y"] - (a["y"] + a["h"]), a["y"] - (b["y"] + b["h"]))
    horizontal = hgap > 0 and hgap >= vgap
    dx = dy = 0
    if horizontal:
        fwd = b["x"] >= a["x"] + a["w"]
        space = b["x"] - (a["x"] + a["w"]) if fwd else a["x"] - (b["x"] + b["w"])
        more = 0 if not shift_b else max(0, size["w"] + 2 * gap - space)
        dx = _round((1 if fwd else -1) * more)
        edge_a = a["x"] + a["w"] if fwd else a["x"]
        edge_b = b["x"] + dx if fwd else b["x"] + b["w"] + dx
        x = (edge_a + edge_b) / 2 - size["w"] / 2
        y = (a["y"] + a["h"] / 2 + b["y"] + b["h"] / 2) / 2 - size["h"] / 2
    else:
        fwd = b["y"] + b["h"] / 2 >= a["y"] + a["h"] / 2
        space = b["y"] - (a["y"] + a["h"]) if fwd else a["y"] - (b["y"] + b["h"])
        more = 0 if not shift_b else max(0, size["h"] + 2 * gap - space)
        dy = _round((1 if fwd else -1) * more)
        edge_a = a["y"] + a["h"] if fwd else a["y"]
        edge_b = b["y"] + dy if fwd else b["y"] + b["h"] + dy
        y = (edge_a + edge_b) / 2 - size["h"] / 2
        x = (a["x"] + a["w"] / 2 + b["x"] + b["w"] / 2) / 2 - size["w"] / 2
    return {"x": _round(x), "y": _round(y), "shift": {"dx": dx, "dy": dy}}


def downstream(edges: Iterable[Tuple[str, str]], start: str, stop: str) -> List[str]:
    """Ids reachable from ``start`` along a->b edges; just ``[start]`` if that loops to ``stop``."""
    nxt: Dict[str, List[str]] = {}
    for a, b in edges:
        nxt.setdefault(a, []).append(b)
    seen = {start}
    queue = [start]
    while queue:
        cur = queue.pop(0)
        for n in nxt.get(cur, []):
            if n == stop:
                return [start]
            if n not in seen:
                seen.add(n)
                queue.append(n)
    return sorted(seen)
