"""Project file import: Hermes brings files from the user's project onto a board.

``{op:'import', paths:[...], layout?, at?, into?, caption?, cols?, gap?, limit?}`` is expanded by
``BoardService.prepare`` into a ``place`` macro (see ``bulk.py``) whose items are ordinary
image / video / card / embed items. Everything is COPIED into the board asset store: nothing is
hotlinked and nothing is ever served from the original path.

What is accepted
  images  png jpg webp gif (downscaled above 2560 px / 5 MB) and svg (rasterised with ffmpeg)
  videos  mp4 webm mov (ffmpeg poster + duration, like uploads)
  pdf     card with a first-page thumbnail (pdftoppm / pdftocairo / mutool / gs / pypdfium2 /
          fitz, else a text preview of the first page, else an icon); the PDF itself is kept
  3d      stl obj 3mf -> shaded isometric thumbnail (``mesh.py``); the model file is kept
  text    markdown / text / code / data files -> text cards;  html -> themeless embed (decision 38)

Policy (the user's files, but an agent is asking): the real path (symlinks resolved) must sit
inside the user's home, no component below home may start with a dot (.ssh, .env, .config,
.hermes ...), names that look like secrets are refused, only regular files of the types above.
"""
from __future__ import annotations

import concurrent.futures
import fnmatch
import glob
import io
import math
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import assets as assets_mod
from . import mesh as mesh_mod

MAX_FILES_DEFAULT = 40
MAX_FILES_HARD = 100
MAX_TOTAL = 400 * 1024 * 1024
MAX_SRC_IMAGE = 40 * 1024 * 1024
MAX_TEXT_READ = 256 * 1024
MAX_TEXT = 12_000          # chars kept in a text card
MAX_SIDE = 2560
THUMB_SIDE = 900

IMAGE_EXT = {"png", "jpg", "jpeg", "webp", "gif"}
VIDEO_EXT = {"mp4", "webm", "mov", "m4v"}
MODEL_EXT = {"stl", "obj", "3mf"}
TEXT_EXT = {
    "md", "markdown", "txt", "rst", "log", "csv", "tsv", "json", "jsonl", "yaml", "yml", "toml", "ini", "cfg",
    "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "scss", "sh", "bash", "zsh", "sql", "c", "h", "cpp", "hpp",
    "cc", "rs", "go", "java", "kt", "swift", "rb", "php", "lua", "r", "m", "cs", "xml", "tex", "gcode", "ino", "vue",
    "svelte", "dockerfile", "makefile",
}
FENCE = {"py": "python", "js": "js", "mjs": "js", "cjs": "js", "ts": "ts", "tsx": "tsx", "jsx": "jsx", "sh": "bash",
         "bash": "bash", "zsh": "bash", "rs": "rust", "go": "go", "java": "java", "kt": "kotlin", "rb": "ruby",
         "cpp": "cpp", "cc": "cpp", "hpp": "cpp", "c": "c", "h": "c", "css": "css", "scss": "scss", "sql": "sql",
         "json": "json", "jsonl": "json", "yaml": "yaml", "yml": "yaml", "toml": "toml", "xml": "xml", "lua": "lua",
         "php": "php", "swift": "swift", "cs": "csharp", "ino": "cpp", "vue": "html", "svelte": "html"}
PROSE = {"md", "markdown", "txt", "rst", "log", "tex"}

# a file that looks like it holds secrets is never imported, whatever its extension
_SECRET = re.compile(r"(secret|credential|passw(or)?d|passwd|(access|auth|api|bearer|refresh)[-_]?tokens?|^tokens?\.|api[-_]?key|private[-_]?key|id_(rsa|dsa|ecdsa|ed25519)|"
                     r"\.pem$|\.key$|\.p12$|\.pfx$|\.keystore$|\.kdbx$|\.env($|\.)|^\.netrc|^\.npmrc|^\.pypirc|"
                     r"auth\.json|^cookies?)", re.I)


class ImportRefused(ValueError):
    pass


def home_root() -> Path:
    return Path(os.path.realpath(os.path.expanduser("~")))


def check_path(path: Path) -> Path:
    """The real path if importing it is allowed; raises ImportRefused with the reason."""
    home = home_root()
    try:
        real = Path(os.path.realpath(path))
    except (OSError, ValueError):
        raise ImportRefused("cannot resolve path") from None
    try:
        rel = real.relative_to(home)
    except ValueError:
        raise ImportRefused("outside your home folder") from None
    for part in rel.parts:
        if part.startswith("."):
            raise ImportRefused("hidden file or folder (secrets live there)")
    # the path as given must not climb through a hidden folder either (symlink tricks)
    try:
        given = Path(os.path.abspath(path)).relative_to(home)
        if any(p.startswith(".") for p in given.parts):
            raise ImportRefused("hidden file or folder (secrets live there)")
    except ValueError:
        pass
    if _SECRET.search(real.name):
        raise ImportRefused("name looks like a secret")
    if not real.is_file():
        raise ImportRefused("not a regular file")
    return real


def _natural(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def kind_of(ext: str) -> Optional[str]:
    if ext in IMAGE_EXT:
        return "image"
    if ext == "svg":
        return "svg"
    if ext in VIDEO_EXT:
        return "video"
    if ext == "pdf":
        return "pdf"
    if ext in MODEL_EXT:
        return "model"
    if ext in ("html", "htm"):
        return "html"
    if ext in TEXT_EXT:
        return "text"
    return None


def _ext(path: Path) -> str:
    name = path.name.lower()
    if name in ("dockerfile", "makefile"):
        return name
    return name.rsplit(".", 1)[-1] if "." in name else ""


def expand(specs: Any, limit: int, skipped: List[Dict[str, str]]) -> List[Path]:
    """Paths / globs / folders -> candidate files (natural order, deduped, capped)."""
    if isinstance(specs, str):
        specs = [specs]
    if not isinstance(specs, list) or not specs or not all(isinstance(s, str) and s.strip() for s in specs):
        raise ImportRefused("paths must be a non-empty list of paths, globs or folders")
    found: List[Path] = []
    seen = set()

    def add(p: Path):
        key = str(p)
        if key not in seen:
            seen.add(key)
            found.append(p)

    for spec in specs[:60]:
        spec = os.path.expanduser(spec.strip())
        if not os.path.isabs(spec):
            spec = os.path.join(str(home_root()), spec)
        hits: List[str]
        if any(c in spec for c in "*?["):
            hits = sorted(glob.glob(spec, recursive=True), key=lambda s: _natural(s))
        else:
            hits = [spec]
        if not hits:
            skipped.append({"path": _shorten(Path(spec)), "reason": "no match"})
            continue
        for h in hits:
            hp = Path(h)
            if hp.is_dir():
                try:
                    kids = sorted((k for k in hp.iterdir() if not k.name.startswith(".")),
                                  key=lambda k: _natural(k.name))
                except OSError as e:
                    skipped.append({"path": h, "reason": e.strerror or "unreadable"})
                    continue
                for k in kids:
                    if k.is_file() and kind_of(_ext(k)):
                        add(k)
            elif not hp.exists():
                try:
                    inside = Path(os.path.realpath(hp)).relative_to(home_root()) is not None
                except ValueError:
                    inside = False
                skipped.append({"path": _shorten(hp) if inside else hp.name,
                                "reason": "no such file" if inside else "outside your home folder"})
            else:
                add(hp)
    if len(found) > limit:
        skipped.append({"path": f"{len(found) - limit} more", "reason": f"over the {limit}-file limit (raise limit or narrow the glob)"})
        found = found[:limit]
    return found


# ── per-kind builders: each returns (item, size, info) ───────────────────

def _shorten(p: Path) -> str:
    try:
        return "~/" + str(p.relative_to(home_root()))
    except ValueError:
        return p.name


def _image_dims(w: int, h: int, width: int) -> Tuple[int, int]:
    """Card size for an image of w x h shown ``width`` wide (art + padding + caption bar)."""
    ratio = (h / w) if w else 0.6
    return width, int(round((width - 14) * ratio + 56))


class Importer:
    def __init__(self, assets: assets_mod.AssetStore, posters: Any):
        self.assets = assets
        self.posters = posters
        self.pdf_tools = {n: shutil.which(n) for n in ("pdftoppm", "pdftocairo", "mutool", "gs")}
        self.ffmpeg = shutil.which("ffmpeg")

    # images -------------------------------------------------------------
    def _image(self, real: Path, ext: str, cap: Optional[str], width: int):
        data = real.read_bytes()
        kind = assets_mod.sniff(data)
        if kind is None or kind == "ico":
            raise ImportRefused("not a PNG, JPEG, WebP or GIF image")
        size = assets_mod.image_size(data)
        note = None
        big = len(data) > assets_mod.MAX_IMAGE or (size and max(size) > MAX_SIDE)
        if big:
            if kind == "gif" and len(data) > assets_mod.MAX_IMAGE:
                raise ImportRefused("animated GIF over 5 MB")
            data, size = self._downscale(data, kind)
            note = "downscaled"
        aid = self.assets.put_bytes(data)
        item: Dict[str, Any] = {"k": "image", "asset": aid, "w": width}
        if size:
            item["iw"], item["ih"] = size
        if cap:
            item["cap"] = cap
        w, h = _image_dims(size[0], size[1], width) if size else (width, 220)
        return item, (w, h), {"kind": "image", "note": note}

    def _downscale(self, data: bytes, kind: str):
        try:
            from PIL import Image
        except ImportError:
            raise ImportRefused("image too large and Pillow is missing to downscale it") from None
        try:
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception:
            raise ImportRefused("image cannot be decoded") from None
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        out = io.BytesIO()
        if im.mode in ("RGBA", "LA", "P") and kind in ("png", "webp", "gif"):
            im.convert("RGBA").save(out, "PNG", optimize=True)
            if out.tell() > assets_mod.MAX_IMAGE:
                out = io.BytesIO()
                im.convert("RGB").save(out, "JPEG", quality=84)
        else:
            im.convert("RGB").save(out, "JPEG", quality=86)
        if out.tell() > assets_mod.MAX_IMAGE:
            raise ImportRefused("image still over 5 MB after downscaling")
        return out.getvalue(), im.size

    def _svg(self, real: Path, cap: Optional[str], width: int):
        raw = real.read_bytes()
        if len(raw) > 4 * 1024 * 1024:
            raise ImportRefused("svg over 4 MB")
        text = raw.decode("utf-8", "replace")
        if re.search(r"<!ENTITY|<script|<foreignObject", text, re.I) or re.search(
                r"href\s*=\s*[\"'](?!#|data:)", text, re.I):
            raise ImportRefused("svg with scripts or external references")
        if not self.ffmpeg:
            raise ImportRefused("svg needs ffmpeg to be rasterised")
        with tempfile.TemporaryDirectory(prefix="hb-svg-") as tmp:
            src, dst = Path(tmp) / "in.svg", Path(tmp) / "out.png"
            src.write_bytes(raw)
            try:
                subprocess.run([self.ffmpeg, "-v", "error", "-y", "-i", str(src), "-frames:v", "1",
                                "-vf", f"scale='min({THUMB_SIDE * 2},iw*2)':-2", str(dst)],
                               stdin=subprocess.DEVNULL, capture_output=True, timeout=30)
                png = dst.read_bytes()
            except (OSError, subprocess.TimeoutExpired):
                raise ImportRefused("svg could not be rasterised") from None
        aid = self.assets.put_bytes(png)
        size = assets_mod.image_size(png)
        item: Dict[str, Any] = {"k": "image", "asset": aid, "w": width}
        if size:
            item["iw"], item["ih"] = size
        if cap:
            item["cap"] = cap
        return item, (_image_dims(*size, width) if size else (width, 220)), {"kind": "image", "note": "rasterised svg"}

    # video --------------------------------------------------------------
    def _video(self, real: Path, title: Optional[str], width: int):
        aid = self.assets.put_file(real, self._vext(real), assets_mod.MAX_VIDEO,
                                   head_check=lambda h: assets_mod.sniff_video(h) is not None)
        item: Dict[str, Any] = {"k": "video", "asset": aid, "w": width}
        if title:
            item["title"] = title
        p = self.posters.get(asset=aid)
        for key in ("img", "dur", "iw", "ih"):
            if p.get(key):
                item[key] = p[key]
        note = None if p.get("st") == "ok" else "no poster (ffmpeg missing or video undecodable)"
        h = int((width - 2) * (item["ih"] / item["iw"] if item.get("iw") and item.get("ih") else 9 / 16)) + 84
        return item, (width, h), {"kind": "video", "note": note}

    @staticmethod
    def _vext(real: Path) -> str:
        with open(real, "rb") as fh:
            return assets_mod.sniff_video(fh.read(16)) or "mp4"

    # pdf ----------------------------------------------------------------
    def _pdf_thumb(self, path: Path) -> Tuple[Optional[bytes], str]:
        with tempfile.TemporaryDirectory(prefix="hb-pdf-") as tmp:
            out = Path(tmp) / "p"
            cmds = []
            if self.pdf_tools["pdftoppm"]:
                cmds.append(("pdftoppm", [self.pdf_tools["pdftoppm"], "-png", "-f", "1", "-l", "1", "-r", "110",
                                          "-singlefile", str(path), str(out)], out.with_suffix(".png")))
            if self.pdf_tools["pdftocairo"]:
                cmds.append(("pdftocairo", [self.pdf_tools["pdftocairo"], "-png", "-f", "1", "-l", "1", "-r", "110",
                                            "-singlefile", str(path), str(out)], out.with_suffix(".png")))
            if self.pdf_tools["mutool"]:
                cmds.append(("mutool", [self.pdf_tools["mutool"], "draw", "-q", "-r", "110", "-o",
                                        str(out.with_suffix(".png")), str(path), "1"], out.with_suffix(".png")))
            if self.pdf_tools["gs"]:
                cmds.append(("ghostscript", [self.pdf_tools["gs"], "-q", "-dSAFER", "-dNOPAUSE", "-dBATCH",
                                             "-sDEVICE=png16m", "-r100", "-dFirstPage=1", "-dLastPage=1",
                                             f"-sOutputFile={out.with_suffix('.png')}", str(path)], out.with_suffix(".png")))
            for name, cmd, dst in cmds:
                try:
                    subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, timeout=40)
                    if dst.exists() and dst.stat().st_size > 0:
                        return dst.read_bytes(), name
                except (OSError, subprocess.TimeoutExpired):
                    continue
        try:
            import pypdfium2 as pdfium  # type: ignore
            pdf = pdfium.PdfDocument(str(path))
            img = pdf[0].render(scale=1.5).to_pil()
            buf = io.BytesIO()
            img.save(buf, "PNG")
            return buf.getvalue(), "pypdfium2"
        except Exception:
            pass
        try:
            import fitz  # type: ignore
            doc = fitz.open(str(path))
            return doc[0].get_pixmap(dpi=110).tobytes("png"), "pymupdf"
        except Exception:
            pass
        return self._pdf_text_preview(path), "text-preview"

    @staticmethod
    def _pdf_text_preview(path: Path) -> Optional[bytes]:
        """No renderer on this machine: draw the first page's text on a sheet (honest, not a render)."""
        try:
            from pypdf import PdfReader
            from PIL import Image, ImageDraw, ImageFont
            page = PdfReader(str(path)).pages[0]
            text = (page.extract_text() or "").strip()
        except Exception:
            return None
        if not text:  # a scan: the biggest picture on the page is the page
            try:
                best = max((im.image for im in page.images), key=lambda im: im.width * im.height, default=None)
                if best is None:
                    return None
                buf = io.BytesIO()
                best.convert("RGBA" if best.mode in ("RGBA", "LA", "P") else "RGB").save(buf, "PNG")
                return buf.getvalue()
            except Exception:
                return None
        W, H = 600, 848
        img = Image.new("RGB", (W, H), (250, 249, 246))
        dr = ImageDraw.Draw(img)
        try:
            font = ImageFont.load_default(size=15)
        except TypeError:
            font = ImageFont.load_default()
        y = 48
        for raw in text.splitlines():
            line = raw.strip()
            while line and y < H - 48:
                cut = len(line)
                while cut > 1 and dr.textlength(line[:cut], font=font) > W - 96:
                    cut -= 1
                dr.text((48, y), line[:cut], fill=(70, 70, 76), font=font)
                line = line[cut:].lstrip()
                y += 21
            if y >= H - 48:
                break
        dr.rectangle([0, 0, W - 1, H - 1], outline=(200, 198, 192))
        buf = io.BytesIO()
        img.save(buf, "PNG", optimize=True)
        return buf.getvalue()

    @staticmethod
    def _pdf_pages(path: Path) -> Optional[int]:
        try:
            from pypdf import PdfReader
            return len(PdfReader(str(path)).pages)
        except Exception:
            return None

    def _pdf(self, real: Path, cap: Optional[str], width: int):
        aid = self.assets.put_file(real, "pdf", assets_mod.MAX_DOC, head_check=lambda h: h.startswith(b"%PDF"))
        item: Dict[str, Any] = {"k": "image", "file": aid, "fk": "pdf", "w": width}
        if cap:
            item["cap"] = cap
        png, by = self._pdf_thumb(real)
        pages = self._pdf_pages(real)
        if pages:
            item["pg"] = pages
        size = None
        if png:
            png = self._fit_png(png)
            item["asset"] = self.assets.put_bytes(png)
            size = assets_mod.image_size(png)
            if size:
                item["iw"], item["ih"] = size
        if size:
            dims = _image_dims(size[0], size[1], width)
        else:
            item["iw"], item["ih"] = 3, 4
            dims = _image_dims(3, 4, width)
        note = {"text-preview": "thumbnail is a text preview (no PDF renderer: install poppler-utils or pypdfium2)"}.get(by)
        if not png:
            note = "no thumbnail (no PDF renderer and no extractable text)"
        return item, dims, {"kind": "pdf", "thumb": by if png else "none", "pages": pages, "note": note}

    @staticmethod
    def _fit_png(png: bytes) -> bytes:
        try:
            from PIL import Image
            im = Image.open(io.BytesIO(png))
            if max(im.size) > THUMB_SIDE or len(png) > assets_mod.MAX_IMAGE:
                im.load()
                im.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.LANCZOS)
                out = io.BytesIO()
                im.save(out, "PNG", optimize=True)
                return out.getvalue()
        except Exception:
            pass
        return png

    # 3d -----------------------------------------------------------------
    def _model(self, real: Path, ext: str, cap: Optional[str], width: int):
        if real.stat().st_size > mesh_mod.MAX_MODEL_BYTES:
            raise ImportRefused("model file over 120 MB")
        data = real.read_bytes()
        aid = self.assets.put_file(real, ext, assets_mod.MAX_DOC)
        item: Dict[str, Any] = {"k": "image", "file": aid, "fk": ext, "w": width}
        if cap:
            item["cap"] = cap
        info: Dict[str, Any] = {"kind": "model"}
        try:
            r = mesh_mod.thumbnail(ext, data)
            item["asset"] = self.assets.put_bytes(r["png"])
            item["iw"], item["ih"] = r["iw"], r["ih"]
            info.update(tris=r["tris"], size=r["size"])
            dims = _image_dims(r["iw"], r["ih"], width)
        except mesh_mod.MeshError as e:
            item["iw"], item["ih"] = 4, 3
            dims = _image_dims(4, 3, width)
            info["note"] = f"no thumbnail: {e}"
        return item, dims, info

    # text / html --------------------------------------------------------
    def _text(self, real: Path, ext: str, width: int):
        with open(real, "rb") as fh:
            raw = fh.read(MAX_TEXT_READ + 1)
        if b"\x00" in raw[:4096]:
            raise ImportRefused("binary file")
        truncated = len(raw) > MAX_TEXT_READ or real.stat().st_size > len(raw)
        text = raw[:MAX_TEXT_READ].decode("utf-8", "replace").replace("\r\n", "\n").rstrip()
        if len(text) > MAX_TEXT:
            cut = text[:MAX_TEXT]
            cut = cut[: cut.rfind("\n")] if "\n" in cut else cut
            text, truncated = cut, True
        if truncated:
            text = text.rstrip("\n") + "\n…(truncated)"
        if ext not in PROSE and not text.lstrip().startswith("```"):
            text = f"```{FENCE.get(ext, '')}\n{text}\n```"
        lines = sum(max(1, math.ceil(len(ln) / 40)) for ln in text.split("\n"))
        item: Dict[str, Any] = {"k": "card", "title": real.name, "text": text, "w": width}
        h = max(96, min(420, 58 + 19 * lines))
        if 58 + 19 * lines > 420:
            item["h"] = 420
        return item, (width, h), {"kind": "text", "note": "truncated" if truncated else None}

    def _html(self, real: Path, width: int):
        if real.stat().st_size > assets_mod.MAX_HTML:
            raise ImportRefused("html over 512 KB")
        aid = self.assets.put_html(real.read_text("utf-8", "replace"))
        item = {"k": "embed", "asset": aid, "title": real.name, "w": 452}
        return item, (452, 320), {"kind": "html", "note": "shown untouched (no theme), sandboxed"}

    # entry point --------------------------------------------------------
    def build_one(self, real: Path, caption: str, width: int) -> Tuple[Dict[str, Any], Tuple[int, int], Dict[str, Any]]:
        ext = _ext(real)
        k = kind_of(ext)
        cap = real.stem if caption == "name" else None
        try:
            if k == "image":
                return self._image(real, ext, cap, width)
            if k == "svg":
                return self._svg(real, cap, width)
            if k == "video":
                return self._video(real, cap, width)
            if k == "pdf":
                return self._pdf(real, cap, width)
            if k == "model":
                return self._model(real, ext, cap, width)
            if k == "html":
                return self._html(real, width)
            if k == "text":
                return self._text(real, ext, width)
        except assets_mod.AssetError as e:
            raise ImportRefused(str(e)) from None
        except OSError as e:
            raise ImportRefused(e.strerror or "unreadable") from None
        raise ImportRefused("unsupported file type")

    def run(self, op: Dict[str, Any], opno: int) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, str]]]:
        """Expand one import op into a ``place`` op. Returns (place_op, report_rows, skipped)."""
        skipped: List[Dict[str, str]] = []
        limit = op.get("limit")
        limit = MAX_FILES_DEFAULT if not isinstance(limit, int) or isinstance(limit, bool) else max(1, min(MAX_FILES_HARD, limit))
        caption = op.get("caption", "name")
        if caption not in ("name", "none"):
            raise ImportRefused("caption must be 'name' or 'none'")
        files: List[Tuple[Path, Path]] = []
        total = 0
        for cand in expand(op.get("paths", op.get("path")), limit, skipped):
            try:
                real = check_path(cand)
                if kind_of(_ext(real)) is None:
                    raise ImportRefused("unsupported file type")
                total += real.stat().st_size
                if total > MAX_TOTAL:
                    raise ImportRefused("over the 400 MB total for one import")
                files.append((cand, real))
            except ImportRefused as e:
                skipped.append({"path": _shorten(cand), "reason": str(e)})
            except OSError as e:
                skipped.append({"path": _shorten(cand), "reason": e.strerror or "unreadable"})
        width = 320
        results: List[Any] = [None] * len(files)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, max(1, len(files)))) as pool:
            futs = {pool.submit(self.build_one, real, caption, width): i for i, (_, real) in enumerate(files)}
            for fut in concurrent.futures.as_completed(futs):
                i = futs[fut]
                try:
                    results[i] = fut.result()
                except ImportRefused as e:
                    skipped.append({"path": _shorten(files[i][0]), "reason": str(e)})
                except Exception as e:  # a bad file must not sink the batch
                    skipped.append({"path": _shorten(files[i][0]), "reason": f"failed: {type(e).__name__}"})
        entries: List[Dict[str, Any]] = []
        rows: List[Dict[str, Any]] = []
        for i, res in enumerate(results):
            if res is None:
                continue
            item, size, info = res
            ref = f"$im{opno}_{len(entries)}"
            entries.append({"ref": ref, "item": item, "size": list(size)})
            row = {"ref": ref, "file": files[i][0].name, **{k: v for k, v in info.items() if v is not None}}
            rows.append(row)
        if not entries:
            reasons = "; ".join(f"{s['path']}: {s['reason']}" for s in skipped[:5]) or "nothing matched"
            raise ImportRefused(f"nothing to import ({reasons})")
        place = {"op": "place", "items": entries}
        for key in ("layout", "at", "into", "gap", "cols"):
            if op.get(key) is not None:
                place[key] = op[key]
        return place, rows, skipped
