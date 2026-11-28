"""Content-addressed board assets: images (sniffed, never SVG) and HTML embeds."""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import re
import struct
from pathlib import Path
from typing import Optional, Tuple

from . import ids

MAX_IMAGE = 5 * 1024 * 1024
MAX_HTML = 512 * 1024
MAX_VIDEO = 100 * 1024 * 1024
MAX_CHUNK = 4 * 1024 * 1024
MAX_RANGE = 4 * 1024 * 1024
MIME = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp",
        "ico": "image/x-icon", "html": "text/html",
        "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
        "pdf": "application/pdf", "stl": "model/stl", "obj": "model/obj",
        "3mf": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"}
VIDEO_EXT = ("mp4", "webm", "mov")
# originals kept next to their thumbnail (imported from the user's project)
DOC_EXT = ("pdf", "stl", "obj", "3mf")
MAX_DOC = 64 * 1024 * 1024
_UPLOAD = re.compile(r"[a-f0-9]{16}")


def sniff_video(head: bytes) -> Optional[str]:
    """mp4/mov from the ISO-BMFF ``ftyp`` box, webm from the EBML magic."""
    if len(head) >= 12 and head[4:8] == b"ftyp":
        return "mov" if head[8:12] == b"qt  " else "mp4"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    return None


class AssetError(ValueError):
    pass


def sniff(data: bytes) -> Optional[str]:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:4] == b"\x00\x00\x01\x00" and len(data) > 22:
        return "ico"
    return None


def jpeg_orientation(data: bytes) -> int:
    """EXIF orientation (1-8) of a JPEG, 1 when absent. 5-8 mean the picture is shown rotated by
    a quarter turn, so its displayed width and height are the stored ones swapped."""
    try:
        i = 2
        while i + 4 < len(data) and data[i] == 0xFF:
            marker = data[i + 1]
            if marker == 0xDA:
                break
            size = struct.unpack(">H", data[i + 2:i + 4])[0]
            if marker == 0xE1 and data[i + 4:i + 10] == b"Exif\x00\x00":
                tiff = data[i + 10:i + 2 + size]
                end = "<" if tiff[:2] == b"II" else ">"
                ifd = struct.unpack(end + "I", tiff[4:8])[0]
                count = struct.unpack(end + "H", tiff[ifd:ifd + 2])[0]
                for n in range(count):
                    at = ifd + 2 + 12 * n
                    tag, _typ, _cnt = struct.unpack(end + "HHI", tiff[at:at + 8])
                    if tag == 0x0112:
                        value = struct.unpack(end + "H", tiff[at + 8:at + 10])[0]
                        return value if 1 <= value <= 8 else 1
                return 1
            i += 2 + size
    except (struct.error, IndexError):
        return 1
    return 1


def image_size(data: bytes) -> Optional[Tuple[int, int]]:
    """Displayed pixel size from the header, without decoding (EXIF rotation applied)."""
    try:
        kind = sniff(data)
        if kind == "png":
            return struct.unpack(">II", data[16:24])
        if kind == "gif":
            return struct.unpack("<HH", data[6:10])
        if kind == "webp":
            chunk = data[12:16]
            if chunk == b"VP8 ":
                w, h = struct.unpack("<HH", data[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if chunk == b"VP8L":
                b = data[21:25]
                w = 1 + (((b[1] & 0x3F) << 8) | b[0])
                h = 1 + (((b[3] & 0xF) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
                return w, h
            if chunk == b"VP8X":
                w = 1 + int.from_bytes(data[24:27], "little")
                h = 1 + int.from_bytes(data[27:30], "little")
                return w, h
        if kind == "jpg":
            i = 2
            while i + 9 < len(data):
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", data[i + 5:i + 9])
                    return (h, w) if jpeg_orientation(data) >= 5 else (w, h)
                if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                    i += 2
                    continue
                i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
        if kind == "ico":
            return data[6] or 256, data[7] or 256
    except (struct.error, IndexError):
        return None
    return None


class AssetStore:
    def __init__(self, root: Path):
        self.root = Path(root)

    def _path(self, aid: str) -> Path:
        if not ids.valid_aid(aid):
            raise AssetError("invalid asset id")
        path = (self.root / aid).resolve()
        if path.parent != self.root.resolve():
            raise AssetError("invalid asset id")
        return path

    def _store(self, data: bytes, ext: str) -> str:
        aid = f"{hashlib.sha256(data).hexdigest()[:16]}.{ext}"
        path = self._path(aid)
        if not path.exists():
            self.root.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(f".{aid}.{os.getpid()}.tmp")
            tmp.write_bytes(data)
            os.replace(tmp, path)
        return aid

    def put_bytes(self, data: bytes, max_bytes: int = MAX_IMAGE) -> str:
        if not data or len(data) > max_bytes:
            raise AssetError("image is empty or too large")
        ext = sniff(data)
        if ext is None:
            raise AssetError("only PNG, JPEG, GIF, WebP and ICO images are accepted")
        return self._store(data, ext)

    def put_b64(self, b64: str, max_bytes: int = MAX_IMAGE) -> str:
        if not isinstance(b64, str):
            raise AssetError("data must be base64 text")
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[-1]
        if len(b64) > (max_bytes * 4) // 3 + 16:
            raise AssetError("image too large")
        try:
            data = base64.b64decode("".join(b64.split()), validate=True)
        except (binascii.Error, ValueError):
            raise AssetError("data is not valid base64") from None
        return self.put_bytes(data, max_bytes)

    def put_file(self, path: Path, ext: str, max_bytes: int, head_check=None) -> str:
        """Copy a local file into the store (streamed + hashed; never links to ``path``)."""
        if ext not in VIDEO_EXT + DOC_EXT:
            raise AssetError("unsupported file type")
        h = hashlib.sha256()
        self.root.mkdir(parents=True, exist_ok=True)
        tmp = self.root / f".imp-{os.getpid()}-{id(h):x}.tmp"
        size = 0
        try:
            with open(path, "rb") as src, open(tmp, "wb") as dst:
                head = src.read(16)
                if head_check is not None and not head_check(head):
                    raise AssetError("file content does not match its extension")
                src.seek(0)
                for block in iter(lambda: src.read(1 << 20), b""):
                    size += len(block)
                    if size > max_bytes:
                        raise AssetError(f"file is larger than {max_bytes // (1024 * 1024)} MB")
                    h.update(block)
                    dst.write(block)
            if size == 0:
                raise AssetError("file is empty")
            aid = f"{h.hexdigest()[:16]}.{ext}"
            dest = self._path(aid)
            if dest.exists():
                tmp.unlink(missing_ok=True)
            else:
                os.replace(tmp, dest)
            return aid
        except OSError as e:
            raise AssetError(f"cannot read file: {e.strerror or e}") from None
        finally:
            tmp.unlink(missing_ok=True)

    def put_html(self, text: str) -> str:
        if not isinstance(text, str):
            raise AssetError("html must be text")
        data = text.encode("utf-8")
        if not data or len(data) > MAX_HTML:
            raise AssetError(f"html must be 1 byte to {MAX_HTML // 1024} KB")
        return self._store(data, "html")

    def get(self, aid: str) -> Tuple[str, bytes]:
        path = self._path(aid)
        if aid.rsplit(".", 1)[1] in VIDEO_EXT:
            raise AssetError("videos are read in ranges (media route)")
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            raise AssetError("no such asset") from None
        return MIME[aid.rsplit(".", 1)[1]], data

    def path_of(self, aid: str) -> Path:
        path = self._path(aid)
        if not path.exists():
            raise AssetError("no such asset")
        return path

    def read_range(self, aid: str, off: int, n: int) -> Tuple[str, int, bytes]:
        """``(mime, total size, bytes)`` of a video asset, at most MAX_RANGE per call."""
        path = self.path_of(aid)
        ext = aid.rsplit(".", 1)[1]
        if ext not in VIDEO_EXT:
            raise AssetError("not a video asset")
        total = path.stat().st_size
        off = max(0, min(total, int(off)))
        n = max(0, min(MAX_RANGE, int(n), total - off))
        with open(path, "rb") as fh:
            fh.seek(off)
            data = fh.read(n)
        return MIME[ext], total, data

    # ── chunked video upload: begin implicitly at chunk 0, finish on the last ──
    def put_video_chunk(self, upload: str, index: int, total: int, b64: str) -> Optional[str]:
        """Append chunk ``index`` of ``total``; returns the asset id after the last one."""
        if not isinstance(upload, str) or not _UPLOAD.fullmatch(upload):
            raise AssetError("upload id must be 16 hex characters")
        if not (isinstance(index, int) and isinstance(total, int) and 0 <= index < total <= 64):
            raise AssetError("bad chunk index")
        if not isinstance(b64, str) or len(b64) > (MAX_CHUNK * 4) // 3 + 16:
            raise AssetError("chunk too large")
        try:
            data = base64.b64decode("".join(b64.split(",", 1)[-1].split()), validate=True)
        except (binascii.Error, ValueError):
            raise AssetError("chunk is not valid base64") from None
        self.root.mkdir(parents=True, exist_ok=True)
        part = self.root / f".up-{upload}"
        meta = self.root / f".up-{upload}.json"
        state = {"next": 0, "size": 0}
        if index == 0:
            part.unlink(missing_ok=True)
        else:
            try:
                state = json.loads(meta.read_text("utf-8"))
            except (OSError, ValueError):
                raise AssetError("upload not started") from None
        if state["next"] != index:
            raise AssetError(f"expected chunk {state['next']}")
        if state["size"] + len(data) > MAX_VIDEO:
            part.unlink(missing_ok=True)
            meta.unlink(missing_ok=True)
            raise AssetError(f"videos are limited to {MAX_VIDEO // (1024 * 1024)} MB")
        if index == 0 and sniff_video(data[:16]) is None:
            raise AssetError("only MP4, WebM and MOV videos are accepted")
        with open(part, "ab") as fh:
            fh.write(data)
        state = {"next": index + 1, "size": state["size"] + len(data)}
        if index + 1 < total:
            meta.write_text(json.dumps(state), encoding="utf-8")
            return None
        meta.unlink(missing_ok=True)
        h = hashlib.sha256()
        with open(part, "rb") as fh:
            head = fh.read(16)
            fh.seek(0)
            for block in iter(lambda: fh.read(1 << 20), b""):
                h.update(block)
        ext = sniff_video(head) or "mp4"
        aid = f"{h.hexdigest()[:16]}.{ext}"
        dest = self._path(aid)
        if dest.exists():
            part.unlink(missing_ok=True)
        else:
            os.replace(part, dest)
        return aid
