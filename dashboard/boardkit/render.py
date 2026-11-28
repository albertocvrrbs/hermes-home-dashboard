"""Rasterise a board region to PNG (Pillow) so the agent can look at a sketch."""
from __future__ import annotations

import io
import math
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

from . import assets as assets_mod
from .engine import DEFAULT_SIZE

MAX_SIDE = 1600
BG = (3, 25, 25)
INK = (243, 236, 227)
ACCENT = (255, 227, 196)
RULE = (60, 70, 66)
PEN = {"accent": ACCENT, "sage": (127, 162, 135), "clay": (196, 126, 98), "slate": (124, 147, 180), "sand": (191, 160, 96)}


def _layer(it: Dict[str, Any]) -> int:
    """Frames at the back, highlighter strokes under the ink, then everything else."""
    if it.get("k") == "frame":
        return 0
    return 1 if it.get("k") == "draw" and it.get("tl") == "hl" else 2


def _ink(draw: Any, it: Dict[str, Any], tx: Any, scale: float) -> None:
    pts = [tx(it["x"] + px, it["y"] + py) for px, py in _points(it)]
    if not pts:
        return
    color = PEN.get(it.get("c"), INK)
    tl = it.get("tl")
    width = max(2, int(round(float(it.get("sw") or 1.9) * 1.6 * scale)))
    if tl == "hl":
        color = tuple(int(c * 0.32 + b * 0.68) for c, b in zip(color, BG))
        width = max(4, int(round(float(it.get("sw") or 16) * scale)))
    if tl in ("rect", "ellipse") and len(pts) >= 2:
        (ax, ay), (bx, by) = pts[0], pts[-1]
        box = [min(ax, bx), min(ay, by), max(ax, bx), max(ay, by)]
        (draw.rectangle if tl == "rect" else draw.ellipse)(box, outline=color, width=width)
        return
    if len(pts) == 1:
        pts = pts * 2
    if tl in ("line", "arrow"):
        pts = [pts[0], pts[-1]]
    draw.line(pts, fill=color, width=width, joint="curve")
    if tl == "arrow":
        (ax, ay), (bx, by) = pts
        ang = math.atan2(by - ay, bx - ax)
        head = max(9.0, float(it.get("sw") or 1.9) * 4.2) * scale
        for side in (-0.5, 0.5):
            draw.line([(bx, by), (bx - head * math.cos(ang + side), by - head * math.sin(ang + side))], fill=color, width=width)


def _rect(it: Dict[str, Any], items: Dict[str, Dict[str, Any]]) -> Optional[Tuple[int, int, int, int]]:
    if it.get("k") == "line":
        return None
    if it.get("in"):
        return None  # drawn inside its column
    if "x" not in it or "y" not in it:
        return None
    dw, dh = DEFAULT_SIZE.get(it["k"], (200, 100))
    if it["k"] == "draw":
        pts = _points(it)
        if pts:
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            return it["x"] + min(xs), it["y"] + min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
    if it["k"] == "col":
        dh = 60 + 90 * len(it.get("kids") or [])
    return it["x"], it["y"], it.get("w") or dw, it.get("h") or dh


def _points(it: Dict[str, Any]):
    out = []
    for pair in (it.get("d") or "").split():
        try:
            x, y = pair.split(",")
            out.append((int(x), int(y)))
        except ValueError:
            continue
    return out


def render_png(doc: Dict[str, Any], store: assets_mod.AssetStore, out_path: Path,
               only: Optional[Iterable[str]] = None, region: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        raise RuntimeError("board_render needs Pillow in the Hermes environment") from None
    items: Dict[str, Dict[str, Any]] = doc.get("items") or {}
    keys = [k for k in (only or items) if k in items]
    rects = {k: r for k in keys if (r := _rect(items[k], items))}
    if region:
        x0, y0 = int(region.get("x", 0)), int(region.get("y", 0))
        x1, y1 = x0 + int(region.get("w", 800)), y0 + int(region.get("h", 600))
    elif rects:
        x0 = min(r[0] for r in rects.values()) - 40
        y0 = min(r[1] for r in rects.values()) - 40
        x1 = max(r[0] + r[2] for r in rects.values()) + 40
        y1 = max(r[1] + r[3] for r in rects.values()) + 40
    else:
        x0, y0, x1, y1 = 0, 0, 800, 600
    scale = min(1.0, MAX_SIDE / max(1, x1 - x0), MAX_SIDE / max(1, y1 - y0))
    W, H = max(1, int((x1 - x0) * scale)), max(1, int((y1 - y0) * scale))
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=max(10, int(15 * scale)))
    except TypeError:  # Pillow < 10.1
        font = ImageFont.load_default()

    def tx(x: float, y: float) -> Tuple[float, float]:
        return (x - x0) * scale, (y - y0) * scale

    centers: Dict[str, Tuple[float, float]] = {}
    for k, (x, y, w, h) in sorted(rects.items(), key=lambda kv: _layer(items[kv[0]])):
        it = items[k]
        centers[k] = (x + w / 2, y + h / 2)
        a, b = tx(x, y), tx(x + w, y + h)
        if it["k"] == "draw":
            _ink(draw, it, tx, scale)
            continue
        if it["k"] == "text":
            draw.text(a, str(it.get("text", ""))[:120], fill=ACCENT if it.get("size") == "h" else INK, font=font)
            continue
        outline = ACCENT if it.get("by") == "h" else RULE
        if it["k"] != "frame":
            draw.rectangle([a, b], outline=outline, width=1, fill=(10, 37, 36))
        else:
            draw.rectangle([a, b], outline=outline, width=1)
        if it["k"] == "image" and it.get("asset"):
            try:
                _, data = store.get(it["asset"])
                pic = Image.open(io.BytesIO(data)).convert("RGB")
                pic.thumbnail((max(1, int(b[0] - a[0])), max(1, int(b[1] - a[1]))))
                img.paste(pic, (int(a[0]), int(a[1])))
            except Exception:
                pass
        if it["k"] == "col":
            for n, kid in enumerate(it.get("kids") or []):
                sub = items.get(kid) or {}
                line = sub.get("title") or sub.get("text") or sub.get("k", "")
                draw.text((a[0] + 12, a[1] + (30 + 22 * n) * scale), "· " + " ".join(str(line).split())[:40],
                          fill=INK, font=font)
        label = it.get("title") or it.get("text") or it.get("cap") or it.get("url") or it["k"]
        num = f"{it['num']} " if it.get("num") else ""
        draw.text((a[0] + 6, a[1] + 5), (num + " ".join(str(label).split()))[:60], fill=INK, font=font)
        draw.text((a[0] + 6, b[1] - 18 * max(scale, .6)), k, fill=(150, 150, 140), font=font)
    for k in keys:
        it = items[k]
        if it.get("k") != "line":
            continue
        ends = []
        for end in ("a", "b"):
            v = it.get(end)
            ends.append(tuple(v) if isinstance(v, list) else centers.get(v))
        if None in ends:
            continue
        p, q = tx(*ends[0]), tx(*ends[1])
        draw.line([p, q], fill=ACCENT if it.get("by") == "h" else INK, width=2)
        draw.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=ACCENT)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    return {"path": str(out_path), "width": W, "height": H,
            "region": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}, "scale": round(scale, 3)}
