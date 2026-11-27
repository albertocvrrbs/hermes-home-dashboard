"""URL classification shared with the UI (src/board/urlKind.ts implements the same table;
both are tested against test/fixtures/url-cases.json)."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlsplit

_YT_ID = re.compile(r"[A-Za-z0-9_-]{11}")
_YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
             "youtube-nocookie.com", "www.youtube-nocookie.com"}
_X_HOSTS = {"x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "mobile.x.com"}
_VIDEO_EXT = (".mp4", ".webm", ".mov", ".m4v")
_IMAGE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp")


def classify(url: Any) -> Optional[Dict[str, Any]]:
    """``{"kind": "video", "p", "id", "vert"?}``, ``{"kind": "file-video"}``,
    ``{"kind": "image"}``, ``{"kind": "page"}``; ``None`` for anything that is not http(s)."""
    if not isinstance(url, str):
        return None
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        return None
    host = parts.hostname.lower()
    path = parts.path or "/"
    segs = [s for s in path.split("/") if s]

    if host in _YT_HOSTS:
        vid, vert = None, False
        if segs[:1] == ["watch"]:
            vid = (parse_qs(parts.query).get("v") or [None])[0]
        elif len(segs) >= 2 and segs[0] in ("shorts", "embed", "live", "v"):
            vid, vert = segs[1], segs[0] == "shorts"
        if vid and _YT_ID.fullmatch(vid):
            out: Dict[str, Any] = {"kind": "video", "p": "youtube", "id": vid}
            if vert:
                out["vert"] = True
            return out
    elif host in ("youtu.be", "www.youtu.be"):
        if segs and _YT_ID.fullmatch(segs[0]):
            return {"kind": "video", "p": "youtube", "id": segs[0]}
    elif host in ("vimeo.com", "www.vimeo.com", "player.vimeo.com"):
        nums = [s for s in segs if s.isdigit()]
        if nums and (host != "player.vimeo.com" or segs[:1] == ["video"]):
            return {"kind": "video", "p": "vimeo", "id": nums[0]}
    elif host in ("loom.com", "www.loom.com"):
        if len(segs) >= 2 and segs[0] in ("share", "embed") and re.fullmatch(r"[A-Za-z0-9]{8,64}", segs[1]):
            return {"kind": "video", "p": "loom", "id": segs[1]}
    elif host in _X_HOSTS:
        if len(segs) >= 3 and segs[1] == "status" and segs[2].isdigit() and len(segs[2]) <= 25:
            return {"kind": "video", "p": "x", "id": segs[2]}

    low = path.lower()
    if low.endswith(_VIDEO_EXT):
        return {"kind": "file-video"}
    if low.endswith(_IMAGE_EXT):
        return {"kind": "image"}
    return {"kind": "page"}


def oembed_endpoint(p: str, vid: str) -> Optional[str]:
    """Fixed provider endpoints (no discovery needed for known video hosts)."""
    from urllib.parse import quote
    canonical = {
        "youtube": f"https://www.youtube.com/watch?v={vid}",
        "vimeo": f"https://vimeo.com/{vid}",
        "loom": f"https://www.loom.com/share/{vid}",
        "x": f"https://x.com/i/status/{vid}",
    }.get(p)
    if canonical is None:
        return None
    q = quote(canonical, safe="")
    return {
        "youtube": f"https://www.youtube.com/oembed?format=json&url={q}",
        "vimeo": f"https://vimeo.com/api/oembed.json?url={q}",
        "loom": f"https://www.loom.com/v1/oembed?url={q}",
        "x": f"https://publish.twitter.com/oembed?omit_script=1&dnt=true&url={q}",
    }[p]
