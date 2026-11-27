"""Content-addressed board assets: images (sniffed, never SVG) and HTML embeds."""
from __future__ import annotations

import base64
import binascii
import hashlib
import os
import struct
from pathlib import Path
from typing import Optional, Tuple

from . import ids

MAX_IMAGE = 5 * 1024 * 1024
MAX_HTML = 512 * 1024
MIME = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp",
        "ico": "image/x-icon", "html": "text/html"}


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


def image_size(data: bytes) -> Optional[Tuple[int, int]]:
    """Intrinsic pixel size from the header, without decoding."""
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
                    return w, h
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

    def put_html(self, text: str) -> str:
        if not isinstance(text, str):
            raise AssetError("html must be text")
        data = text.encode("utf-8")
        if not data or len(data) > MAX_HTML:
            raise AssetError(f"html must be 1 byte to {MAX_HTML // 1024} KB")
        return self._store(data, "html")

    def get(self, aid: str) -> Tuple[str, bytes]:
        path = self._path(aid)
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            raise AssetError("no such asset") from None
        return MIME[aid.rsplit(".", 1)[1]], data
