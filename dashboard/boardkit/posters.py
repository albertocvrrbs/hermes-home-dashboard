"""Video posters: one still frame (and the duration) for every video card, without playing it.

Uploaded videos get theirs at upload; cards that point at a video URL, or videos uploaded
before this existed, get one lazily the first time a viewer asks for it. Posters are plain
image assets (``assets/<hash>.jpg``) and the mapping lives in ``posters/<key>.json``, keyed by
the video asset id or URL, so filling them in never edits a board.

Frames come from ``ffmpeg`` on the server (a frame at ~1 s, or 10 % into short clips). When
ffmpeg is missing or the video can't be fetched, the client grabs a frame itself
(``<video preload=metadata>`` + canvas) and stores it with :meth:`Posters.put_client`.
Remote videos are downloaded with the SSRF-guarded fetcher (public addresses only).
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from . import assets as assets_mod
from . import ids
from .fetch import FetchError, Fetcher

RETRY_FAILED_S = 3600
FFMPEG_TIMEOUT_S = 40
MAX_POSTER = 2 * 1024 * 1024


def pick_time(duration: Optional[float]) -> float:
    """~1 s in, or 10 % into clips shorter than 10 s; 0 when the length is unknown/tiny."""
    if not duration or duration <= 0:
        return 1.0
    if duration < 10:
        return round(max(0.0, duration * 0.1), 3)
    return 1.0


class Posters:
    def __init__(self, root: Path, store: assets_mod.AssetStore,
                 fetcher_factory: Optional[Callable[[], Fetcher]] = None,
                 ffmpeg: Optional[str] = None, ffprobe: Optional[str] = None):
        self.dir = Path(root) / "posters"
        self.assets = store
        self.fetcher_factory = fetcher_factory or (lambda: Fetcher(deadline=45.0))
        self.ffmpeg = ffmpeg if ffmpeg is not None else shutil.which("ffmpeg")
        self.ffprobe = ffprobe if ffprobe is not None else shutil.which("ffprobe")
        self._locks: Dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    # ── keys and records ─────────────────────────────────────────────────
    @staticmethod
    def key(src: Optional[str] = None, asset: Optional[str] = None) -> str:
        if asset:
            if not ids.valid_aid(asset) or asset.rsplit(".", 1)[1] not in assets_mod.VIDEO_EXT:
                raise assets_mod.AssetError("not a video asset")
            basis = "a:" + asset
        elif isinstance(src, str) and src.lower().startswith(("http://", "https://")) and len(src) <= 2048:
            basis = "u:" + src.strip()
        else:
            raise assets_mod.AssetError("poster needs a video asset or an http(s) src")
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:16]

    def _rec_path(self, key: str) -> Path:
        return self.dir / f"{key}.json"

    def read(self, key: str) -> Optional[Dict[str, Any]]:
        try:
            rec = json.loads(self._rec_path(key).read_text("utf-8"))
            return rec if isinstance(rec, dict) else None
        except (OSError, ValueError):
            return None

    def _write(self, key: str, rec: Dict[str, Any]) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        path = self._rec_path(key)
        tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
        tmp.write_text(json.dumps(rec, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, path)

    @staticmethod
    def public(rec: Dict[str, Any]) -> Dict[str, Any]:
        return {k: rec[k] for k in ("st", "img", "dur", "iw", "ih", "by", "reason") if k in rec}

    def _lock(self, key: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(key, threading.Lock())

    # ── lookup / generation ──────────────────────────────────────────────
    def get(self, src: Optional[str] = None, asset: Optional[str] = None, generate: bool = True,
            now: Optional[float] = None) -> Dict[str, Any]:
        key = self.key(src, asset)
        rec = self.read(key)
        now = now or time.time()
        if rec and (rec.get("st") == "ok" or now - rec.get("at", 0) < RETRY_FAILED_S or not generate):
            return self.public(rec)
        if not generate:
            return {"st": "none"}
        with self._lock(key):
            rec = self.read(key)
            if rec and (rec.get("st") == "ok" or now - rec.get("at", 0) < RETRY_FAILED_S):
                return self.public(rec)
            rec = self._generate(src, asset)
            rec["at"] = int(now)
            self._write(key, rec)
            return self.public(rec)

    def _generate(self, src: Optional[str], asset: Optional[str]) -> Dict[str, Any]:
        if not self.ffmpeg:
            return {"st": "fail", "reason": "no-ffmpeg"}
        tmp_path: Optional[str] = None
        try:
            if asset:
                try:
                    path = str(self.assets.path_of(asset))
                except assets_mod.AssetError:
                    return {"st": "fail", "reason": "missing"}
            else:
                try:
                    resp = self.fetcher_factory().get(src, want="video")
                except FetchError as e:
                    return {"st": "fail", "reason": f"fetch-{e.code}"}
                fd, tmp_path = tempfile.mkstemp(prefix="hb-video-", suffix=".bin")
                with os.fdopen(fd, "wb") as fh:
                    fh.write(resp.body)
                path = tmp_path
            return self.frame(path)
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    def probe(self, path: str) -> Dict[str, Any]:
        if not self.ffprobe:
            return {}
        try:
            p = subprocess.run([self.ffprobe, "-v", "error", "-select_streams", "v:0",
                                "-show_entries", "stream=width,height:format=duration", "-of", "json", path],
                               stdin=subprocess.DEVNULL, capture_output=True, timeout=20)
            info = json.loads(p.stdout or b"{}")
        except (OSError, ValueError, subprocess.TimeoutExpired):
            return {}
        out: Dict[str, Any] = {}
        try:
            d = float((info.get("format") or {}).get("duration") or 0)
            if d > 0:
                out["dur"] = round(d, 2)
        except (TypeError, ValueError):
            pass
        streams = info.get("streams") or []
        if streams and isinstance(streams[0], dict):
            w, h = streams[0].get("width"), streams[0].get("height")
            if isinstance(w, int) and isinstance(h, int) and w > 0 and h > 0:
                out["iw"], out["ih"] = w, h
        return out

    def frame(self, path: str) -> Dict[str, Any]:
        meta = self.probe(path)
        jpg = b""
        for t in dict.fromkeys((pick_time(meta.get("dur")), 0.0)):
            try:
                p = subprocess.run([self.ffmpeg, "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1",
                                    "-vf", "scale='min(960,iw)':-2", "-q:v", "4", "-f", "image2pipe",
                                    "-vcodec", "mjpeg", "pipe:1"],
                                   stdin=subprocess.DEVNULL, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
                jpg = p.stdout or b""
            except (OSError, subprocess.TimeoutExpired):
                jpg = b""
            if jpg.startswith(b"\xff\xd8\xff"):
                break
        if not jpg.startswith(b"\xff\xd8\xff"):
            return {"st": "fail", "reason": "decode", **meta}
        try:
            img = self.assets.put_bytes(jpg, MAX_POSTER)
        except assets_mod.AssetError:
            return {"st": "fail", "reason": "store", **meta}
        rec: Dict[str, Any] = {"st": "ok", "img": img, "by": "ffmpeg", **meta}
        if "iw" not in rec:
            size = assets_mod.image_size(jpg)
            if size:
                rec["iw"], rec["ih"] = size
        return rec

    def put_client(self, src: Optional[str], asset: Optional[str], data_b64: str,
                   dur: Any = None, now: Optional[float] = None) -> Dict[str, Any]:
        """A frame grabbed by the browser. Never replaces a server poster."""
        key = self.key(src, asset)
        with self._lock(key):
            rec = self.read(key)
            if rec and rec.get("st") == "ok":
                return self.public(rec)
            if not isinstance(data_b64, str):
                raise assets_mod.AssetError("data must be base64 text")
            try:
                raw = base64.b64decode("".join(data_b64.split(",", 1)[-1].split()), validate=True)
            except (binascii.Error, ValueError):
                raise assets_mod.AssetError("data is not valid base64") from None
            img = self.assets.put_bytes(raw, MAX_POSTER)
            new: Dict[str, Any] = {"st": "ok", "img": img, "by": "client", "at": int(now or time.time())}
            size = assets_mod.image_size(raw)
            if size:
                new["iw"], new["ih"] = size
            if isinstance(dur, (int, float)) and not isinstance(dur, bool) and 0 < dur < 360_000:
                new["dur"] = round(float(dur), 2)
            self._write(key, new)
            return self.public(new)
