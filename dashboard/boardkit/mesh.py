"""3D model thumbnails: STL / OBJ / 3MF -> a shaded isometric PNG with a transparent background.

Pure Python + numpy + Pillow (all three ship with Hermes): triangles are projected with an
orthographic isometric camera, flat-shaded with one key light plus ambient, and painted back to
front. The render is 2x supersampled and downsampled, so edges are anti-aliased against the
alpha channel. Grey ramp only: it reads on dark and light themes alike.

Parsing is defensive (size caps, no network, no external entities): this reads files from the
user's project, never from the web.
"""
from __future__ import annotations

import io
import re
import struct
import zipfile
from typing import Any, Dict, List, Optional, Tuple

MAX_TRIS = 400_000       # parsed
DRAW_TRIS = 120_000      # drawn (strided above this)
MAX_MODEL_BYTES = 120 * 1024 * 1024
SIDE = 640               # longest side of the thumbnail
SS = 2                   # supersampling

EXTS = ("stl", "obj", "3mf")


class MeshError(ValueError):
    pass


def _np():
    try:
        import numpy as np
        return np
    except ImportError:
        raise MeshError("numpy is not available for 3D thumbnails") from None


# ── parsers: each returns an (n, 3, 3) float array of triangles ──────────

def parse_stl(data: bytes):
    np = _np()
    if len(data) >= 84:
        n = struct.unpack("<I", data[80:84])[0]
        if 84 + 50 * n == len(data) and n > 0:
            if n > MAX_TRIS:
                raise MeshError(f"model has {n} triangles (limit {MAX_TRIS})")
            rec = np.frombuffer(data, dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]),
                                count=n, offset=84)
            return rec["v"].astype(np.float64)
    text = data.decode("utf-8", "replace")
    nums = re.findall(r"vertex\s+(\S+)\s+(\S+)\s+(\S+)", text)
    if len(nums) < 3:
        raise MeshError("not a valid STL file")
    if len(nums) // 3 > MAX_TRIS:
        raise MeshError(f"model has more than {MAX_TRIS} triangles")
    try:
        arr = np.array(nums[: len(nums) // 3 * 3], dtype=np.float64)
    except ValueError:
        raise MeshError("not a valid STL file") from None
    return arr.reshape(-1, 3, 3)


def parse_obj(data: bytes):
    np = _np()
    verts: List[Tuple[float, float, float]] = []
    tris: List[Tuple[int, int, int]] = []
    for raw in data.decode("utf-8", "replace").splitlines():
        if raw.startswith("v "):
            p = raw.split()
            try:
                verts.append((float(p[1]), float(p[2]), float(p[3])))
            except (ValueError, IndexError):
                raise MeshError("bad vertex in OBJ") from None
        elif raw.startswith("f "):
            idx = []
            for tok in raw.split()[1:]:
                try:
                    i = int(tok.split("/")[0])
                except ValueError:
                    raise MeshError("bad face in OBJ") from None
                idx.append(i - 1 if i > 0 else len(verts) + i)
            for j in range(1, len(idx) - 1):
                tris.append((idx[0], idx[j], idx[j + 1]))
        if len(tris) > MAX_TRIS or len(verts) > MAX_TRIS * 3:
            raise MeshError(f"model has more than {MAX_TRIS} triangles")
    if not tris or not verts:
        raise MeshError("OBJ has no faces")
    v = np.array(verts, dtype=np.float64)
    t = np.array(tris, dtype=np.int64)
    if t.min() < 0 or t.max() >= len(v):
        raise MeshError("OBJ face points at a missing vertex")
    return v[t]


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_3mf(data: bytes):
    np = _np()
    import xml.etree.ElementTree as ET
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise MeshError("not a valid 3MF file") from None
    names = [n for n in zf.namelist() if n.lower().endswith(".model")]
    if not names:
        raise MeshError("3MF has no model part")
    names.sort(key=lambda n: (n.lower() != "3d/3dmodel.model", n))
    info = zf.getinfo(names[0])
    if info.file_size > MAX_MODEL_BYTES:
        raise MeshError("3MF model part is too large")
    raw = zf.read(names[0])
    if b"<!DOCTYPE" in raw[:4096].upper() or b"<!ENTITY" in raw.upper():  # no DTDs: no entity tricks
        raise MeshError("3MF with a DTD is refused")
    root = ET.fromstring(raw)
    objects: Dict[str, Any] = {}
    build: List[Tuple[str, Any]] = []

    def matrix(text: Optional[str]):
        if not text:
            return None
        try:
            v = [float(x) for x in text.split()]
        except ValueError:
            return None
        if len(v) != 12:
            return None
        m = np.eye(4)
        m[:3, :3] = np.array(v[:9]).reshape(3, 3).T  # 3MF is row-vector convention
        m[:3, 3] = v[9:]
        return m

    for el in root.iter():
        t = _local(el.tag)
        if t == "object":
            mesh = next((c for c in el if _local(c.tag) == "mesh"), None)
            comps = next((c for c in el if _local(c.tag) == "components"), None)
            if mesh is not None:
                vs = next(c for c in mesh if _local(c.tag) == "vertices")
                ts = next(c for c in mesh if _local(c.tag) == "triangles")
                v = np.array([[float(x.get("x")), float(x.get("y")), float(x.get("z"))] for x in vs])
                f = np.array([[int(x.get("v1")), int(x.get("v2")), int(x.get("v3"))] for x in ts])
                if len(f) and (f.min() < 0 or f.max() >= len(v)):
                    raise MeshError("3MF triangle points at a missing vertex")
                objects[el.get("id")] = ("mesh", v[f] if len(f) else np.zeros((0, 3, 3)))
            elif comps is not None:
                objects[el.get("id")] = ("comps", [(c.get("objectid"), matrix(c.get("transform")))
                                                   for c in comps if _local(c.tag) == "component"])
        elif t == "item" and el.get("objectid"):
            build.append((el.get("objectid"), matrix(el.get("transform"))))

    def expand(oid: str, m, depth: int = 0):
        if depth > 6 or oid not in objects:
            return []
        kind, body = objects[oid]
        if kind == "mesh":
            tri = body
            if m is not None and len(tri):
                flat = np.concatenate([tri.reshape(-1, 3), np.ones((tri.shape[0] * 3, 1))], axis=1) @ m.T
                tri = flat[:, :3].reshape(-1, 3, 3)
            return [tri]
        out = []
        for cid, cm in body:
            sub = cm if m is None else (m @ cm if cm is not None else m)
            out.extend(expand(cid, sub, depth + 1))
        return out

    parts: List[Any] = []
    for oid, m in (build or [(k, None) for k in objects]):
        parts.extend(expand(oid, m))
    parts = [p for p in parts if len(p)]
    if not parts:
        raise MeshError("3MF has no triangles")
    tri = np.concatenate(parts)
    if len(tri) > MAX_TRIS:
        raise MeshError(f"model has more than {MAX_TRIS} triangles")
    return tri


def parse(ext: str, data: bytes):
    if ext == "stl":
        return parse_stl(data)
    if ext == "obj":
        return parse_obj(data)
    if ext == "3mf":
        return parse_3mf(data)
    raise MeshError("unsupported model type")


# ── render ───────────────────────────────────────────────────────────────

def render(tri, side: int = SIDE) -> Dict[str, Any]:
    """tri: (n,3,3). Returns {png, iw, ih, tris, size:[x,y,z]} (size in model units)."""
    np = _np()
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        raise MeshError("Pillow is not available for 3D thumbnails") from None
    tri = np.asarray(tri, dtype=np.float64)
    tri = tri[np.isfinite(tri).all(axis=(1, 2))]
    if len(tri) == 0:
        raise MeshError("model has no triangles")
    total = len(tri)
    lo, hi = tri.reshape(-1, 3).min(axis=0), tri.reshape(-1, 3).max(axis=0)
    size = (hi - lo).tolist()
    if len(tri) > DRAW_TRIS:
        tri = tri[:: int(np.ceil(len(tri) / DRAW_TRIS))]
    tri = tri - (lo + hi) / 2

    az, el = np.radians(45.0), np.radians(35.264)
    d = np.array([np.cos(el) * np.sin(az), -np.cos(el) * np.cos(az), np.sin(el)])  # towards camera
    r = np.cross([0, 0, 1.0], d)
    r /= np.linalg.norm(r)
    u = np.cross(d, r)
    sx, sy, depth = tri @ r, tri @ u, tri @ d            # each (n, 3)
    x0, x1, y0, y1 = sx.min(), sx.max(), sy.min(), sy.max()
    span = max(x1 - x0, y1 - y0, 1e-9)
    pad = 0.04
    scale = side * SS / (span * (1 + 2 * pad))
    w = int(np.ceil((x1 - x0) * scale + 2 * pad * span * scale)) + 2
    h = int(np.ceil((y1 - y0) * scale + 2 * pad * span * scale)) + 2
    px = (sx - x0) * scale + pad * span * scale + 1
    py = (y1 - sy) * scale + pad * span * scale + 1

    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(n, axis=1)
    keep = ln > 1e-12
    n = n[keep] / ln[keep, None]
    n = n * np.where(n @ d < 0, -1.0, 1.0)[:, None]      # two-sided
    light = d + 0.55 * u - 0.7 * r
    light /= np.linalg.norm(light)
    lam = np.clip(n @ light, 0, 1)
    facing = np.clip(n @ d, 0, 1)
    shade = np.clip(0.22 + 0.62 * lam + 0.16 * facing, 0, 1)
    gray = (62 + 178 * shade).astype(np.uint8)
    order = np.argsort(depth[keep].mean(axis=1))          # far -> near
    px, py, gray = px[keep], py[keep], gray

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    for i in order:
        g = int(gray[i])
        c = (g, g, min(255, g + 4), 255)
        dr.polygon([(px[i, 0], py[i, 0]), (px[i, 1], py[i, 1]), (px[i, 2], py[i, 2])], fill=c, outline=c)
    out = img.resize((max(1, w // SS), max(1, h // SS)), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True)
    return {"png": buf.getvalue(), "iw": out.width, "ih": out.height, "tris": total,
            "size": [round(v, 2) for v in size]}


def thumbnail(ext: str, data: bytes) -> Dict[str, Any]:
    return render(parse(ext, data))
