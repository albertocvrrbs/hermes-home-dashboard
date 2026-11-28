"""Rasterise a board region to PNG (Pillow) so the agent can look at a sketch."""
from __future__ import annotations

import io
import math
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

from . import assets as assets_mod
from . import bulk
from .engine import DEFAULT_SIZE

MAX_SIDE = 1600
BG = (3, 25, 25)
INK = (243, 236, 227)
ACCENT = (255, 227, 196)
RULE = (60, 70, 66)
MARKS = {"ok": ((120, 190, 130), "ok"), "fail": ((220, 110, 100), "fail"), "wait": ((210, 180, 100), "wait")}
PEN = {"accent": ACCENT, "sage": (127, 162, 135), "clay": (196, 126, 98), "slate": (124, 147, 180), "sand": (191, 160, 96)}


# a system font with accents and Ñ (Pillow's built-in one draws boxes for anything outside ASCII)
FONT_FILES = ("DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
              "/usr/share/fonts/noto/NotoSans-Regular.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/arial.ttf")


def _font(ImageFont: Any, size: int) -> Any:
    for f in FONT_FILES:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


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
    w = it.get("w") or dw
    if it["k"] in ("image", "video") and it.get("iw") and it.get("ih"):  # the board ignores h for pictures
        return it["x"], it["y"], w, bulk._media_h(it["k"], w, it["iw"], it["ih"])  # same height the board gives it
    if it.get("h") is None and it["k"] == "card":
        return it["x"], it["y"], w, bulk._card_h(it, w)
    return it["x"], it["y"], w, it.get("h") or dh


def _edge(rect: Tuple[int, int, int, int], toward: Tuple[float, float]) -> Tuple[float, float]:
    """Where the segment from the rect's centre to ``toward`` leaves the rect."""
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h / 2
    dx, dy = toward[0] - cx, toward[1] - cy
    if not dx and not dy:
        return cx, cy
    t = min(w / 2 / abs(dx) if dx else math.inf, h / 2 / abs(dy) if dy else math.inf)
    return cx + dx * t, cy + dy * t


def _fit(draw: Any, text: str, font: Any, width: float) -> str:
    """Cut ``text`` with an ellipsis so it fits ``width`` pixels."""
    try:
        if draw.textlength(text, font=font) <= width:
            return text
        while text and draw.textlength(text + "…", font=font) > width:
            text = text[:-1]
        return text + "…" if text else ""
    except AttributeError:  # Pillow without textlength
        return text[: max(1, int(width / 7))]


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
    font = _font(ImageFont, max(10, int(15 * scale)))

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
        # pictures: an image's asset, a video's poster frame (``img``)
        pic_id = it.get("asset") if it["k"] == "image" else it.get("img") if it["k"] in ("video", "link") else None
        if pic_id:
            try:
                _, data = store.get(pic_id)
                pic = Image.open(io.BytesIO(data)).convert("RGB")
                pic.thumbnail((max(1, int(b[0] - a[0])), max(1, int(b[1] - a[1]))))
                img.paste(pic, (int(a[0] + (b[0] - a[0] - pic.width) / 2), int(a[1] + (b[1] - a[1] - pic.height) / 2)))
            except Exception:
                pass
        if it["k"] == "col":
            for n, kid in enumerate(it.get("kids") or []):
                sub = items.get(kid) or {}
                line = sub.get("title") or sub.get("text") or sub.get("k", "")
                draw.text((a[0] + 12, a[1] + (30 + 22 * n) * scale), "· " + " ".join(str(line).split())[:40],
                          fill=INK, font=font)
        label = it.get("title") or it.get("text") or it.get("cap") or it.get("url") or it["k"]
        if it["k"] == "comp":
            label = f"{it.get('title') or ''} [component {it.get('comp', '?')}]".strip()
        num = f"{it['num']} " if it.get("num") else ""
        draw.text((a[0] + 6, a[1] + 5), _fit(draw, (num + " ".join(str(label).split()))[:60], font, b[0] - a[0] - 12), fill=INK, font=font)
        # second line: a box's subtitle, a card's body (when it has a title), a frame's note
        second = it.get("sub") or (it.get("text") if it.get("title") else None) or (it.get("note") if it["k"] == "frame" else None)
        if second and (b[1] - a[1]) > 34 * scale:
            draw.text((a[0] + 6, a[1] + 5 + 19 * max(scale, .6)), _fit(draw, " ".join(str(second).split()), font, b[0] - a[0] - 12),
                      fill=(170, 170, 160), font=font)
        if it["k"] in ("live", "comp"):
            bag = it.get("data") if it["k"] == "live" else it.get("cdata")
            rows = [f"{k2}: {v}" for k2, v in (bag or {}).items() if isinstance(v, (str, int, float)) and not isinstance(v, bool)]
            for n, row in enumerate(rows[:8]):
                y = a[1] + 5 + (19 * (n + 2)) * max(scale, .6)
                if y > b[1] - 36 * max(scale, .6):
                    break
                draw.text((a[0] + 6, y), _fit(draw, row, font, b[0] - a[0] - 12), fill=(170, 170, 160), font=font)
        if it.get("sync"):
            draw.text((b[0] - 70 * max(scale, .6), b[1] - 18 * max(scale, .6)), f"sync:{it['sync']}"[:14], fill=ACCENT, font=font)
        if it.get("mark") in MARKS:
            color, word = MARKS[it["mark"]]
            r = max(7, int(11 * scale))
            draw.ellipse([b[0] - 2 * r - 4, a[1] + 4, b[0] - 4, a[1] + 4 + 2 * r], fill=color)
            draw.text((b[0] - 2 * r - 4 - 40 * max(scale, .6), a[1] + 4), word, fill=color, font=font)
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
        # clip centre-to-centre to the two items' edges, like the board draws them
        for i in (0, 1):
            v = it.get("ab"[i])
            if isinstance(v, str) and v in rects:
                ends[i] = _edge(rects[v], ends[1 - i])
        p, q = tx(*ends[0]), tx(*ends[1])
        draw.line([p, q], fill=ACCENT if it.get("by") == "h" else INK, width=2)
        draw.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=ACCENT)
        if it.get("label"):
            text = " ".join(str(it["label"]).split())[:40]
            mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
            try:
                l, t, r, bt = draw.textbbox((0, 0), text, font=font)
            except AttributeError:  # very old Pillow
                l, t, r, bt = 0, 0, 7 * len(text), 12
            tw, th = r - l, bt - t
            draw.rectangle([mx - tw / 2 - 3, my - th / 2 - 2, mx + tw / 2 + 3, my + th / 2 + 2], fill=BG)
            draw.text((mx - tw / 2, my - th / 2 - t), text, fill=ACCENT, font=font)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    return {"path": str(out_path), "width": W, "height": H,
            "region": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}, "scale": round(scale, 3)}
