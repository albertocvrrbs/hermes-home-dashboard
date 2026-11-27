"""Link previews: Open Graph / Twitter card / <title> / favicon, plus oEmbed (fixed endpoints
for known video hosts, discovered via <link rel=alternate> otherwise). Remote images are
copied into assets so the board never hotlinks. Results are cached by URL."""
from __future__ import annotations

import hashlib
import html as html_lib
import json
import os
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urljoin, urlsplit

from . import assets as assets_mod
from .fetch import FetchError, Fetcher
from .urls import classify, oembed_endpoint

CACHE_OK_S = 7 * 24 * 3600
CACHE_FAIL_S = 10 * 60


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: Dict[str, str] = {}
        self.icons: list = []
        self.oembed: Optional[str] = None
        self.title = ""
        self._in_title = False
        self.done = False

    def handle_starttag(self, tag: str, attrs) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            key = (a.get("property") or a.get("name") or a.get("itemprop") or "").strip().lower()
            if key and "content" in a and key not in self.meta:
                self.meta[key] = a["content"].strip()
        elif tag == "link":
            rel = a.get("rel", "").lower().split()
            href = a.get("href", "").strip()
            if not href:
                return
            if "icon" in rel or "apple-touch-icon" in rel:
                self.icons.append((rel, a.get("sizes", ""), href))
            elif "alternate" in rel and a.get("type", "").lower() == "application/json+oembed" and not self.oembed:
                self.oembed = href
        elif tag == "title" and not self.title:
            self._in_title = True
        elif tag == "body":
            self.done = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "head":
            self.done = True

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def _http_url(base: str, value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        absolute = urljoin(base, value.strip())
    except ValueError:
        return None
    return absolute if re.match(r"https?://", absolute, re.I) and len(absolute) <= 2048 else None


def _clean(text: Optional[str], cap: int) -> Optional[str]:
    if not text:
        return None
    s = " ".join(html_lib.unescape(text).split())
    return s[:cap] or None


def _decode(body: bytes) -> str:
    head = body[:2048].decode("ascii", "ignore").lower()
    m = re.search(r'charset=["\']?([a-z0-9_-]+)', head)
    for enc in ((m.group(1),) if m else ()) + ("utf-8", "latin-1"):
        try:
            return body.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", "replace")


def parse_meta(body: bytes, base_url: str) -> Dict[str, str]:
    p = _MetaParser()
    text = _decode(body)
    try:
        # Feed in chunks and stop at </head>: metadata never lives in the body.
        for i in range(0, len(text), 16384):
            p.feed(text[i:i + 16384])
            if p.done:
                break
    except Exception:
        pass
    m = p.meta
    out: Dict[str, str] = {}
    title = _clean(m.get("og:title") or m.get("twitter:title") or p.title, 300)
    desc = _clean(m.get("og:description") or m.get("twitter:description") or m.get("description"), 600)
    site = _clean(m.get("og:site_name") or m.get("application-name"), 120)
    image = _http_url(base_url, m.get("og:image") or m.get("og:image:url") or m.get("twitter:image")
                      or m.get("twitter:image:src"))
    icon = None
    if p.icons:
        def rank(entry):
            rel, sizes, _ = entry
            size = max((int(s) for s in re.findall(r"(\d+)x\d+", sizes)), default=16)
            return (0 if "apple-touch-icon" in rel else 1, -min(size, 64) if size <= 64 else size)
        icon = _http_url(base_url, sorted(p.icons, key=rank)[0][2])
    oembed = _http_url(base_url, p.oembed)
    for key, value in (("title", title), ("desc", desc), ("site", site), ("image", image),
                       ("icon", icon), ("oembed", oembed)):
        if value:
            out[key] = value
    return out


def _strip_tags(text: str) -> str:
    return " ".join(html_lib.unescape(re.sub(r"<[^>]+>", " ", text)).split())


def parse_oembed(body: bytes) -> Dict[str, str]:
    try:
        data = json.loads(body.decode("utf-8", "replace"))
    except ValueError:
        return {}
    if not isinstance(data, dict):
        return {}
    out: Dict[str, str] = {}
    for key, src, cap in (("title", "title", 300), ("author", "author_name", 120), ("site", "provider_name", 120)):
        v = data.get(src)
        if isinstance(v, str) and v.strip():
            out[key] = v.strip()[:cap]
    thumb = data.get("thumbnail_url")
    if isinstance(thumb, str) and re.match(r"https?://", thumb):
        out["image"] = thumb[:2048]
    snippet = data.get("html")
    if isinstance(snippet, str) and "<blockquote" in snippet.lower() and "<p" in snippet.lower():
        m = re.search(r"<p[^>]*>(.*?)</p>", snippet, re.S | re.I)
        if m:
            out["text"] = _strip_tags(m.group(1))[:600]
    return out


def _cache_path(cache_dir: Path, url: str) -> Path:
    return cache_dir / (hashlib.sha256(url.encode("utf-8")).hexdigest()[:24] + ".json")


def _cache_get(cache_dir: Path, url: str, now: float) -> Optional[Dict[str, Any]]:
    try:
        entry = json.loads(_cache_path(cache_dir, url).read_text("utf-8"))
    except (OSError, ValueError):
        return None
    ttl = CACHE_OK_S if entry.get("st") == "ok" else CACHE_FAIL_S
    if now - entry.get("_t", 0) > ttl:
        return None
    entry.pop("_t", None)
    return entry


def _cache_put(cache_dir: Path, url: str, data: Dict[str, Any], now: float) -> None:
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        path = _cache_path(cache_dir, url)
        tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
        tmp.write_text(json.dumps({**data, "_t": int(now)}), encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        pass


def _store_image(fetcher: Fetcher, store: assets_mod.AssetStore, url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        res = fetcher.get(url, "image")
        return store.put_bytes(res.body)
    except (FetchError, assets_mod.AssetError):
        return None


def preview(url: str, fetcher: Fetcher, store: assets_mod.AssetStore, cache_dir: Path,
            now: Optional[float] = None) -> Dict[str, Any]:
    """Item fields for a pasted URL: ``{kind, st, title?, desc?, site, icon?, img?, video?, ...}``.
    ``kind`` is the board item kind the URL should become (link, image, video)."""
    now = now or time.time()
    cls = classify(url)
    if cls is None:
        return {"kind": "link", "st": "fail", "error": "url"}
    cached = _cache_get(cache_dir, url, now)
    if cached is not None:
        return cached
    host = (urlsplit(url).hostname or "").lower()
    site_default = host[4:] if host.startswith("www.") else host
    out: Dict[str, Any] = {"kind": "link", "site": site_default}
    try:
        if cls["kind"] == "image":
            res = fetcher.get(url, "image")
            out = {"kind": "image", "asset": store.put_bytes(res.body)}
            size = assets_mod.image_size(res.body)
            if size:
                out["iw"], out["ih"] = size
            out["st"] = "ok"
        elif cls["kind"] == "file-video":
            out.update({"kind": "video", "title": urlsplit(url).path.rsplit("/", 1)[-1][:200], "st": "ok"})
        elif cls["kind"] == "video":
            video = {"p": cls["p"], "id": cls["id"]}
            if cls.get("vert"):
                video["vert"] = True
            out["video"] = video
            endpoint = oembed_endpoint(cls["p"], cls["id"])
            meta: Dict[str, str] = {}
            if endpoint:
                try:
                    meta = parse_oembed(fetcher.get(endpoint, "json").body)
                except FetchError:
                    meta = {}
            if cls["p"] == "youtube" and "image" not in meta:
                meta["image"] = f"https://i.ytimg.com/vi/{cls['id']}/hqdefault.jpg"
            title = meta.get("title") or meta.get("text")
            if cls["p"] == "x" and meta.get("text"):
                title = meta["text"]
            if title:
                out["title"] = title[:300]
            if meta.get("author"):
                out["desc"] = meta["author"]
            out["site"] = {"youtube": "YouTube", "vimeo": "Vimeo", "loom": "Loom", "x": "X"}[cls["p"]]
            img = _store_image(fetcher, store, meta.get("image"))
            if img:
                out["img"] = img
            out["st"] = "ok" if (title or img) else "fail"
        else:
            res = fetcher.get(url, "html")
            meta = parse_meta(res.body, res.url)
            if meta.get("oembed") and ("title" not in meta or "image" not in meta):
                try:
                    extra = parse_oembed(fetcher.get(meta["oembed"], "json").body)
                    meta.setdefault("title", extra.get("title", ""))
                    if extra.get("image"):
                        meta.setdefault("image", extra["image"])
                except FetchError:
                    pass
            for key in ("title", "desc", "site"):
                if meta.get(key):
                    out[key] = meta[key]
            img = _store_image(fetcher, store, meta.get("image"))
            if img:
                out["img"] = img
            icon = _store_image(fetcher, store, meta.get("icon") or urljoin(res.url, "/favicon.ico"))
            if icon:
                out["icon"] = icon
            out["st"] = "ok" if meta.get("title") else "fail"
    except FetchError as e:
        out["st"] = "fail"
        out["error"] = e.code
    except assets_mod.AssetError:
        out["st"] = "fail"
        out["error"] = "asset"
    _cache_put(cache_dir, url, out, now)
    return out
