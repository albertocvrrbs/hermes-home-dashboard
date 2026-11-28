"""Collision-free placement for the board, as pure functions over rectangles.

Mirrors ``src/board/place.ts`` (the UI runs the TS one on measured DOM rects; Hermes' ``add``,
imports and the ``resolve_overlaps`` op run this one on estimated sizes). Both are checked against
``test/fixtures/place-cases.json``. Everything is rounded half-up like JS ``Math.round``.

Importers: call :func:`place_batch` with the obstacle rects of the board (``rects_of_items``) and
the sizes of what you are adding (``estimate_size``); nothing else is needed to be overlap-free.
"""
from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

PLACE_GAP = 24
THUMB_MIN, THUMB_MAX, THUMB_DEFAULT = 96, 200, 128
NEAR = 100
UP = 3

Box = Dict[str, float]  # x, y, w, h

# a copy of engine.DEFAULT_SIZE / SHAPE_SIZE (a test keeps them equal; engine imports this module)
SIZES: Dict[str, Tuple[int, int]] = {
    "card": (256, 120), "todo": (304, 240), "col": (276, 320), "link": (276, 250),
    "image": (372, 260), "embed": (452, 320), "video": (400, 260), "board": (212, 170),
    "frame": (480, 320), "box": (196, 62), "text": (420, 40), "draw": (120, 80),
    "live": (400, 300), "shape": (160, 56), "comp": (480, 320),
}
SHAPES: Dict[str, Tuple[int, int]] = {"rect": (160, 56), "diamond": (150, 100), "pill": (150, 48), "circle": (72, 72)}

IMAGE_CHROME = 2 + 6
CAP_LINE = 15.6


def _round(n: float) -> int:
    return int(math.floor(n + 0.5))


def _lines(chars: float, per_line: float) -> int:
    return max(1, int(math.ceil(chars / max(1, per_line))))


# ── intrinsic shape of media ─────────────────────────────────────────────

def aspect_of(item: Dict[str, Any]) -> Optional[float]:
    iw, ih = item.get("iw"), item.get("ih")
    if isinstance(iw, (int, float)) and isinstance(ih, (int, float)) and iw > 0 and ih > 0:
        return iw / ih
    return None


def stage_ratio(item: Dict[str, Any]) -> float:
    video = item.get("video")
    if video:
        return 9 / 16 if video.get("vert") else 16 / 9
    r = aspect_of(item)
    return 16 / 9 if r is None else min(2.4, max(0.5, r))


# ── how big a card is ────────────────────────────────────────────────────

def estimate_size(item: Dict[str, Any]) -> Dict[str, int]:
    """Height a card will have once rendered (exact for media of known size, close for text)."""
    k = item.get("k", "card")
    dw, dh = (SHAPES.get(item.get("sh") or "rect") if k == "shape" else None) or SIZES.get(k, (200, 100))
    w = item.get("w") or dw
    if k == "image":
        r = aspect_of(item)
        art = max(60 if r is None else 0, (w - 14) / (r or 4 / 3))
        cap = item.get("cap") or ""
        cap_lines = _lines(len(cap) * 7.4, w - 24) if cap else 0
        return {"w": w, "h": _round(IMAGE_CHROME + art + 21 + CAP_LINE * cap_lines)}
    if k == "video":
        stage = (w - 2) / stage_ratio(item)
        title = item.get("title") or ""
        body = 24 + 10.5 + 7 + 18.85 * _lines(len(title) * 7.6, w - 28)
        if item.get("desc"):
            body += 4 + 17.75 * min(3, _lines(len(item["desc"]) * 6.4, w - 28))
        if item.get("by") == "h":
            body += 29
        return {"w": w, "h": _round(2 + stage + 1 + body)}
    if k == "link":
        r = aspect_of(item)
        thumb = 0.0
        if item.get("st") == "wait" or item.get("img"):
            thumb = (THUMB_DEFAULT if r is None else min(THUMB_MAX, max(THUMB_MIN, (w - 2) / r))) + 1
        if item.get("st") == "wait":
            body = 112.0
        else:
            title = item.get("title") or ((item.get("site") or "") if item.get("st") == "fail" else (item.get("url") or ""))
            body = 24 + 10.5 + 7 + 18.85 * _lines(len(title) * 7.6, w - 28)
            if item.get("desc"):
                body += 4 + 17.75 * min(3, _lines(len(item["desc"]) * 6.4, w - 28))
            if (item.get("st") == "fail" or not item.get("title")) and item.get("url"):
                body += 6 + 14 * _lines(len(item["url"]) * 6.3, w - 28)
            if item.get("by") == "h":
                body += 29
        return {"w": w, "h": _round(2 + thumb + body)}
    if k == "card":
        text = item.get("text") or ""
        quote = not item.get("title") and 0 < len(text) <= 160 and "\n" not in text
        h = 28.0
        if item.get("title"):
            h += 18.5 * _lines(len(item["title"]) * 7.6, w - 54)
        if text:
            per, inner = (8.6, w - 48) if quote else (6.5, w - 34)
            rows = sum(_lines(len(ln) * per, inner) for ln in text.split("\n"))
            h += (22.7 if quote else 18.1) * rows + (4 if item.get("title") else 0)
        if item.get("by") == "h":
            h += 23
        if item.get("tags") or item.get("due"):
            h += 24
        return {"w": w, "h": _round(max(h, 40))}
    if k == "col":
        return {"w": w, "h": 60 + 96 * len(item.get("kids") or [])}
    if k == "todo":
        return {"w": w, "h": 110 + 26 * len(item.get("items") or [])}
    if k == "live":
        return {"w": w, "h": item.get("h") or dh}
    return {"w": w, "h": item.get("h") or dh}


# ── collisions ───────────────────────────────────────────────────────────

def collides(a: Box, b: Box, gap: float = 0) -> bool:
    return (a["x"] < b["x"] + b["w"] + gap and a["x"] + a["w"] + gap > b["x"]
            and a["y"] < b["y"] + b["h"] + gap and a["y"] + a["h"] + gap > b["y"])


def overlaps(a: Box, b: Box, tol: float = 1) -> bool:
    return (min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]) > tol
            and min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]) > tol)


def free_place(want: Dict[str, float], size: Dict[str, float], obstacles: Sequence[Box],
               gap: float = PLACE_GAP, within: Optional[Box] = None) -> Dict[str, int]:
    """Nearest top-left to ``want`` where a ``size`` box keeps ``gap`` clear of every obstacle."""
    wx, wy = _round(want["x"]), _round(want["y"])
    sw, sh = size["w"], size["h"]

    order: List[Box] = list(obstacles)  # the nearest first once known: a taken spot fails fast

    def free(x: float, y: float) -> bool:
        box = {"x": x, "y": y, "w": sw, "h": sh}
        return not any(collides(box, o, gap) for o in order)

    def inside(x: float, y: float) -> bool:
        return (within is None or (x >= within["x"] and y >= within["y"]
                                   and x + sw <= within["x"] + within["w"] and y + sh <= within["y"] + within["h"]))

    if free(wx, wy) and inside(wx, wy):
        return {"x": wx, "y": wy}
    cx, cy = wx + sw / 2, wy + sh / 2
    near = sorted(obstacles, key=lambda o: ((o["x"] + o["w"] / 2 - cx) ** 2 + (o["y"] + o["h"] / 2 - cy) ** 2,
                                            o["y"], o["x"]))[:NEAR]
    seen = {id(o) for o in near}
    order = near + [o for o in obstacles if id(o) not in seen]
    xs, ys = {wx}, {wy}
    for o in near:
        xs.update((_round(o["x"] + o["w"] + gap), _round(o["x"] - sw - gap), _round(o["x"])))
        ys.update((_round(o["y"] + o["h"] + gap), _round(o["y"] - sh - gap), _round(o["y"])))
    cands = sorted(((UP * min(0, x - wx) + max(0, x - wx)) ** 2 + (UP * min(0, y - wy) + max(0, y - wy)) ** 2, y, x)
                   for x in xs for y in ys)
    if within is not None:
        for _d, y, x in cands:
            if inside(x, y) and free(x, y):
                return {"x": x, "y": y}
    for _d, y, x in cands:
        if free(x, y):
            return {"x": x, "y": y}
    bottom = max([wy] + [o["y"] + o["h"] for o in obstacles])
    return {"x": wx, "y": _round(bottom + gap)}


def place_batch(sizes: Iterable[Dict[str, float]], want: Dict[str, float], obstacles: Sequence[Box],
                gap: float = PLACE_GAP, within: Optional[Box] = None) -> List[Dict[str, int]]:
    taken = list(obstacles)
    out = []
    for s in sizes:
        p = free_place(want, s, taken, gap, within)
        out.append(p)
        taken.append({"x": p["x"], "y": p["y"], "w": s["w"], "h": s["h"]})
    return out


# ── cleaning up an existing board ────────────────────────────────────────

def resolve_plan(entries: Sequence[Dict[str, Any]], gap: float = PLACE_GAP, tol: float = 1) -> List[Dict[str, Any]]:
    """entries: [{id, rect, anchored?, within?}] -> [{id, x, y}] for the ones that move."""
    settled: List[Box] = [e["rect"] for e in entries if e.get("anchored")]
    order = sorted((e for e in entries if not e.get("anchored")),
                   key=lambda e: (e["rect"]["y"], e["rect"]["x"], e["id"]))
    pending = {e["id"]: e["rect"] for e in order}
    out: List[Dict[str, Any]] = []
    for e in order:
        del pending[e["id"]]
        rect = e["rect"]
        if any(overlaps(rect, s, tol) for s in settled):
            others = settled + list(pending.values())
            p = free_place({"x": rect["x"], "y": rect["y"]}, rect, others, gap, e.get("within"))
            rect = {"x": p["x"], "y": p["y"], "w": rect["w"], "h": rect["h"]}
            out.append({"id": e["id"], "x": p["x"], "y": p["y"]})
        settled.append(rect)
    return out


def push_plan(entries: Sequence[Dict[str, Any]], grown: str, gap: float = PLACE_GAP, tol: float = 1) -> Dict[str, Any]:
    rects = {e["id"]: dict(e["rect"]) for e in entries}
    anchored = {e["id"] for e in entries if e.get("anchored")}
    origin = {e["id"]: (e["rect"]["x"], e["rect"]["y"]) for e in entries}
    order = sorted(rects)
    blocked: set = set()
    queue = [grown]
    guard = 0
    while queue and guard < 400:
        guard += 1
        sid = queue.pop(0)
        s = rects.get(sid)
        if s is None:
            continue
        for iid in order:
            if iid == sid or (iid == grown and sid != grown):
                continue
            m = rects[iid]
            if not overlaps(s, m, tol):
                continue
            if iid in anchored:
                blocked.add(iid)
                continue
            below = m["y"] + m["h"] / 2 >= s["y"] + s["h"] / 2
            right = m["x"] + m["w"] / 2 >= s["x"] + s["w"] / 2
            dy = s["y"] + s["h"] + gap - m["y"] if below else m["y"] + m["h"] + gap - s["y"]
            dx = s["x"] + s["w"] + gap - m["x"] if right else m["x"] + m["w"] + gap - s["x"]
            if dy <= dx * 1.6:
                m["y"] = _round(m["y"] + dy if below else m["y"] - dy)
            else:
                m["x"] = _round(m["x"] + dx if right else m["x"] - dx)
            queue.append(iid)
    moves = []
    for iid in order:
        if iid == grown:
            continue
        r, o = rects[iid], origin[iid]
        if (r["x"], r["y"]) != o:
            moves.append({"id": iid, "x": r["x"], "y": r["y"]})
    return {"moves": moves, "blocked": sorted(blocked)}
