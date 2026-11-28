"""The user's component library: HTML/JS components Hermes writes, versioned on disk.

A component is a small set of text files (``index.html`` plus optional ``.js`` / ``.css`` / ``.json`` /
``.svg``) living in ``<plugin-data>/components/<name>/<version>/``. Every save makes a new immutable
version (``v1``, ``v2``, ...); rolling back copies an old version forward, so history only grows.
Boards hold *instances* (kind ``comp``) that point at a component by name, follow the latest version
or pin one, and carry their own data (``cdata``) and attached data files.

Pure storage + lint: no board or HTTP knowledge here. The browser renders a component in a sandboxed,
network-less iframe with the ``window.hb`` bridge (docs/components.md is the contract).
"""
from __future__ import annotations

import base64
import binascii
import copy
import difflib
import json
import re
import shutil
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import embedlint

NAME = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")
VERSION = re.compile(r"v[1-9][0-9]{0,5}")
FILE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
ENTRY = "index.html"
CODE_EXT = (".html", ".js", ".css", ".json", ".svg", ".txt", ".md")
MAX_FILE = 1_000_000          # one code file
MAX_TOTAL = 2_000_000         # one version
MAX_FILES = 24
MAX_VERSIONS = 200
MAX_CDATA = 64 * 1024         # instance data kept in the board document (big data = files)
MAX_DATA_FILE = 48 * 1024 * 1024
MAX_DATA_FILES = 24
MAX_DEPTH = 8
SAMPLE = "sample.json"        # optional: preview data for the gallery and instances with no data


class CompError(ValueError):
    """Bad component input. Nothing was written."""


class CompNotFound(KeyError):
    pass


def _now() -> int:
    return int(time.time())


def valid_name(name: Any) -> bool:
    return isinstance(name, str) and NAME.fullmatch(name) is not None


def valid_version(v: Any) -> bool:
    return isinstance(v, str) and VERSION.fullmatch(v) is not None


# ── instance data (kept in the board doc) ───────────────────────────────

def _json_value(v: Any, depth: int = 0) -> Any:
    if depth > MAX_DEPTH:
        raise CompError(f"data nests deeper than {MAX_DEPTH} levels")
    if v is None or isinstance(v, (bool, str)):
        return v
    if isinstance(v, (int, float)):
        if isinstance(v, float) and v != v or v in (float("inf"), float("-inf")):
            raise CompError("data numbers must be finite")
        return v
    if isinstance(v, list):
        return [_json_value(x, depth + 1) for x in v]
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if not isinstance(k, str) or not k or len(k) > 80:
                raise CompError("data keys are non-empty text up to 80 chars")
            out[k] = _json_value(x, depth + 1)
        return out
    raise CompError("data must be JSON (objects, lists, numbers, text, true/false, null)")


def _check_cdata(data: Dict[str, Any]) -> Dict[str, Any]:
    if len(json.dumps(data, separators=(",", ":"), ensure_ascii=False)) > MAX_CDATA:
        raise CompError(f"component data is over {MAX_CDATA // 1024} KB: attach a data file instead "
                        "(board_component attach), the card reads it with hb.asset(name)")
    return data


def clean_cdata(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise CompError("data must be an object")
    return _check_cdata({k: v for k, v in _json_value(raw).items() if v is not None})


def merge_cdata(current: Optional[Dict[str, Any]], patch: Any = None, push: Any = None,
                keep: Any = None, replace: bool = False) -> Dict[str, Any]:
    """``patch`` sets top-level keys (null deletes), ``push`` appends values to lists (trimmed to
    ``keep``, default 600), ``replace`` starts from empty."""
    out: Dict[str, Any] = {} if replace else copy.deepcopy(current or {})
    if patch is not None:
        if not isinstance(patch, dict):
            raise CompError("data must be an object")
        for k, v in _json_value(patch).items():
            if v is None:
                out.pop(k, None)
            else:
                out[k] = v
    if push is not None:
        if not isinstance(push, dict):
            raise CompError("push must be an object of key: value(s)")
        n = 600 if keep is None else int(max(1, min(20000, float(keep))))
        for k, v in _json_value(push).items():
            cur = out.get(k)
            if not isinstance(cur, list):
                cur = []
            cur.extend(v if isinstance(v, list) else [v])
            out[k] = cur[-n:]
    return _check_cdata(out)


def clean_files_map(raw: Any) -> Dict[str, Dict[str, int]]:
    """``files`` on an instance: attached data files, name -> {n: bytes, r: revision}."""
    if not isinstance(raw, dict) or len(raw) > MAX_DATA_FILES:
        raise CompError(f"files is an object of at most {MAX_DATA_FILES} entries")
    out = {}
    for k, v in raw.items():
        if not isinstance(k, str) or not FILE.fullmatch(k) or not isinstance(v, dict):
            raise CompError("bad data file entry")
        out[k] = {"n": int(max(0, min(MAX_DATA_FILE, v.get("n", 0)))), "r": int(max(0, min(10**9, v.get("r", 0))))}
    return out


def clean_actions(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        raise CompError("actions is a list of registered action ids")
    out: List[str] = []
    for a in raw[:12]:
        if isinstance(a, dict):
            a = a.get("action")
        if not isinstance(a, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{0,63}", a):
            raise CompError("bad action id")
        if a not in out:
            out.append(a)
    return out


# ── lint (advice for the agent, never blocks) ───────────────────────────

_NET = re.compile(r"\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(|\bimport\s*\(|<script[^>]+\bsrc\s*=\s*[\"']https?:|"
                  r"<link[^>]+href\s*=\s*[\"']https?:|<img[^>]+src\s*=\s*[\"']https?:", re.I)
_HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d")


def lint(files: Dict[str, str]) -> List[str]:
    """Warnings for a component version. Empty = nothing to say."""
    out: List[str] = []
    html = files.get(ENTRY, "")
    allsrc = "\n".join(files.values())
    out.extend(embedlint.lint_embed(html))
    if "hb." not in allsrc and "window.hb" not in allsrc:
        out.append("never touches the hb bridge: read data with hb.data / hb.onData(fn), size with hb.size / "
                   "hb.onResize(fn); see the component rules")
    elif "hb.onData" not in allsrc and "hb.data" not in allsrc and "hb.asset" not in allsrc:
        out.append("does not read hb.data / hb.onData: the card cannot show what Hermes or a script sends it")
    if not re.search(r"hb\.onResize|addEventListener\(\s*['\"]resize|ResizeObserver|hermes\.onResize", allsrc):
        out.append("no resize handling: the card can be resized, so redraw from hb.onResize(fn) (or use fluid "
                   "layout / svg viewBox)")
    if _NET.search(allsrc):
        out.append("network access is blocked in the sandbox (CSP connect-src none): ship big data as an attached "
                   "file and read it with hb.asset(name), small data through hb.data")
    if len(_HEX.findall(allsrc)) > 6:
        out.append("many hardcoded colours: use the theme vars (var(--foreground), var(--accent), var(--chart-1..5), "
                   "var(--border), var(--card)) or hb.theme so the component follows the board's look")
    if re.search(r"requestAnimationFrame", allsrc) and "hb.clock" not in allsrc:
        out.append("animates with its own requestAnimationFrame clock: if it should follow a video or a playhead, "
                   "draw from hb.clock (t, playing, onTick) so linked cards stay in sync")
    return out[:12]


# ── library ─────────────────────────────────────────────────────────────

def _text(value: Any, cap: int) -> str:
    return value[:cap] if isinstance(value, str) else ""


def _clean_files(raw: Any) -> Dict[str, str]:
    if not isinstance(raw, dict):
        raise CompError("files must be an object of filename: text")
    out: Dict[str, str] = {}
    for fname, body in raw.items():
        if not isinstance(fname, str) or not FILE.fullmatch(fname) or not fname.lower().endswith(CODE_EXT):
            raise CompError(f"bad file name {str(fname)[:30]!r} (letters, digits . _ -; one of {', '.join(CODE_EXT)})")
        if not isinstance(body, str):
            raise CompError(f"{fname}: content must be text")
        if len(body.encode("utf-8")) > MAX_FILE:
            raise CompError(f"{fname} is over {MAX_FILE // 1000} KB: split it, or attach data as a data file")
        out[fname] = body
    return out


def _apply_edits(files: Dict[str, str], edits: Any) -> Dict[str, str]:
    """edits: [{file?, find, replace}] literal, must match exactly once (``all:true`` for every match)."""
    if not isinstance(edits, list) or not edits:
        raise CompError("edits is a non-empty list of {file?, find, replace}")
    out = dict(files)
    for i, e in enumerate(edits[:60]):
        if not isinstance(e, dict) or not isinstance(e.get("find"), str) or not e["find"] \
                or not isinstance(e.get("replace", ""), str):
            raise CompError(f"edit {i}: needs find (text) and replace (text)")
        fname = e.get("file") or ENTRY
        if fname not in out:
            raise CompError(f"edit {i}: no file {str(fname)[:40]!r}")
        n = out[fname].count(e["find"])
        if n == 0:
            raise CompError(f"edit {i}: {e['find'][:50]!r} not found in {fname}")
        if n > 1 and e.get("all") is not True:
            raise CompError(f"edit {i}: {e['find'][:50]!r} matches {n} times in {fname} (add context or all:true)")
        out[fname] = out[fname].replace(e["find"], e.get("replace", ""))
    return out


class Library:
    """``root`` is ``<plugin-data>/components``."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self._lock = threading.RLock()

    # paths
    def _dir(self, name: str) -> Path:
        if not valid_name(name):
            raise CompError("component name: 1-40 chars, lowercase letters, digits and dashes")
        return self.root / name

    def _meta_path(self, name: str) -> Path:
        return self._dir(name) / "meta.json"

    def _read_meta(self, name: str) -> Dict[str, Any]:
        try:
            return json.loads(self._meta_path(name).read_text("utf-8"))
        except (OSError, ValueError):
            raise CompNotFound(f"no component named {str(name)[:40]!r}") from None

    def _write_meta(self, name: str, meta: Dict[str, Any]) -> None:
        p = self._meta_path(name)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
        tmp.replace(p)

    # reading
    def exists(self, name: str) -> bool:
        return valid_name(name) and self._meta_path(name).is_file()

    def meta(self, name: str) -> Dict[str, Any]:
        return self._read_meta(name)

    def files(self, name: str, ver: Optional[str] = None) -> Tuple[str, Dict[str, str]]:
        meta = self._read_meta(name)
        ver = ver or meta["current"]
        if not valid_version(ver) or not any(v["v"] == ver for v in meta["versions"]):
            raise CompNotFound(f"{name} has no version {str(ver)[:12]!r}")
        d = self._dir(name) / ver
        out = {}
        for p in sorted(d.iterdir()):
            if p.is_file():
                out[p.name] = p.read_text("utf-8", "replace")
        return ver, out

    def list(self) -> List[Dict[str, Any]]:
        rows = []
        if not self.root.is_dir():
            return rows
        for d in sorted(self.root.iterdir()):
            if not d.is_dir() or not valid_name(d.name):
                continue
            try:
                m = self._read_meta(d.name)
            except CompNotFound:
                continue
            cur = next((v for v in m["versions"] if v["v"] == m["current"]), m["versions"][-1])
            rows.append({"name": m["name"], "title": m.get("title") or m["name"], "desc": m.get("desc", ""),
                         "current": m["current"], "versions": len(m["versions"]), "updated": cur.get("at", 0),
                         "by": cur.get("by", "h"), "size": cur.get("size", 0)})
        rows.sort(key=lambda r: -r["updated"])
        return rows

    def assemble(self, name: str, ver: Optional[str] = None) -> Dict[str, Any]:
        """One HTML document: local ``<script src>`` / ``<link rel=stylesheet href>`` inlined, so the
        iframe needs no network and no second request. Includes meta and optional sample data."""
        meta = self._read_meta(name)
        ver, files = self.files(name, ver)
        html = files.get(ENTRY, "")

        def script(m: "re.Match[str]") -> str:
            f = files.get(m.group(2))
            if f is None:
                return m.group(0)
            return "<script%s>%s</script>" % (m.group(1) or "", f.replace("</script", "<\\/script"))

        def style(m: "re.Match[str]") -> str:
            href = m.group(1) or m.group(2)
            f = files.get(href)
            return m.group(0) if f is None else "<style>%s</style>" % f.replace("</style", "<\\/style")

        html = re.sub(r"""<script((?:\s+(?!src\b)[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s+src=["']([^"']+)["'][^>]*>\s*</script>""",
                      script, html, flags=re.I)
        html = re.sub(r"""<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>|"""
                      r"""<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>""",
                      style, html, flags=re.I)
        sample = None
        if SAMPLE in files:
            try:
                sample = json.loads(files[SAMPLE])
            except ValueError:
                sample = None
        return {"name": name, "version": ver, "current": meta["current"], "title": meta.get("title") or name,
                "desc": meta.get("desc", ""), "html": html, "sample": sample,
                "versions": [{k: v[k] for k in ("v", "at", "by", "note", "size") if k in v} for v in meta["versions"]],
                "files": sorted(files)}

    # writing
    def save(self, name: str, *, html: Optional[str] = None, files: Optional[Dict[str, Any]] = None,
             edits: Any = None, remove: Any = None, replace: bool = False, title: Optional[str] = None,
             desc: Optional[str] = None, note: Optional[str] = None, by: str = "h") -> Dict[str, Any]:
        """Create the component, or add a version. ``html`` is shorthand for ``files.index.html``.
        On an existing component, ``files`` / ``edits`` change the current version (``replace:true``
        starts empty instead); nothing changed = no new version."""
        with self._lock:
            d = self._dir(name)
            exists = self._meta_path(name).is_file()
            base: Dict[str, str] = {}
            meta: Dict[str, Any] = {}
            if exists:
                meta = self._read_meta(name)
                if not replace:
                    _, base = self.files(name)
            elif edits is not None:
                raise CompError("edits need an existing component; create it with html or files first")
            new = dict(base)
            given: Dict[str, str] = {}
            if files is not None:
                given.update(_clean_files(files))
            if html is not None:
                given.update(_clean_files({ENTRY: html}))
            new.update(given)
            if edits is not None:
                new = _apply_edits(new, edits)
            if remove is not None:
                if not isinstance(remove, list):
                    raise CompError("remove is a list of file names")
                for r in remove:
                    if r == ENTRY:
                        raise CompError(f"{ENTRY} cannot be removed")
                    new.pop(r, None)
            new = _clean_files(new)
            if ENTRY not in new:
                raise CompError(f"a component needs {ENTRY} (the page the card shows)")
            if len(new) > MAX_FILES:
                raise CompError(f"at most {MAX_FILES} files per component")
            size = sum(len(v.encode("utf-8")) for v in new.values())
            if size > MAX_TOTAL:
                raise CompError(f"component is over {MAX_TOTAL // 1_000_000} MB")
            changed_meta = False
            if title is not None and _text(title, 120) != meta.get("title"):
                changed_meta = True
            if desc is not None and _text(desc, 400) != meta.get("desc"):
                changed_meta = True
            if exists and new == base and not changed_meta:
                return {"name": name, "version": meta["current"], "created": False, "noop": True,
                        "warnings": lint(new)}
            if exists and new == base:
                meta["title"] = _text(title, 120) if title is not None else meta.get("title", name)
                meta["desc"] = _text(desc, 400) if desc is not None else meta.get("desc", "")
                self._write_meta(name, meta)
                return {"name": name, "version": meta["current"], "created": False, "noop": False,
                        "warnings": lint(new)}
            if not exists:
                meta = {"name": name, "title": _text(title, 120) or name, "desc": _text(desc, 400),
                        "current": "", "versions": []}
            elif title is not None:
                meta["title"] = _text(title, 120) or meta.get("title", name)
            if exists and desc is not None:
                meta["desc"] = _text(desc, 400)
            if len(meta["versions"]) >= MAX_VERSIONS:
                raise CompError(f"{name} has {MAX_VERSIONS} versions; make a new component or delete this one")
            n = 1 + max([int(v["v"][1:]) for v in meta["versions"]] or [0])
            ver = f"v{n}"
            tmp = d / f".{ver}.tmp"
            if tmp.exists():
                shutil.rmtree(tmp)
            tmp.mkdir(parents=True)
            for fname, body in new.items():
                (tmp / fname).write_text(body, "utf-8")
            tmp.replace(d / ver)
            meta["versions"].append({"v": ver, "at": _now(), "by": by if by in ("h", "u", "s") else "h",
                                     "note": _text(note, 200), "size": size, "files": sorted(new)})
            meta["current"] = ver
            self._write_meta(name, meta)
            return {"name": name, "version": ver, "created": not exists, "noop": False, "warnings": lint(new),
                    "previous": meta["versions"][-2]["v"] if len(meta["versions"]) > 1 else None}

    def rollback(self, name: str, to: str, by: str = "h") -> Dict[str, Any]:
        with self._lock:
            meta = self._read_meta(name)
            _, old = self.files(name, to)
            res = self.save(name, files=old, replace=True, note=f"rollback to {to}", by=by)
            if res.get("noop"):
                # the current version already equals the target
                return {**res, "rolled_back_to": to}
            return {**res, "rolled_back_to": to, "was": meta["current"]}

    def diff(self, name: str, a: Optional[str] = None, b: Optional[str] = None, limit: int = 6000) -> Dict[str, Any]:
        meta = self._read_meta(name)
        vs = [v["v"] for v in meta["versions"]]
        b = b or meta["current"]
        if a is None:
            i = vs.index(b) if b in vs else len(vs) - 1
            a = vs[i - 1] if i > 0 else None
        _, fb = self.files(name, b)
        fa = self.files(name, a)[1] if a else {}
        lines: List[str] = []
        for fname in sorted(set(fa) | set(fb)):
            lines.extend(difflib.unified_diff(fa.get(fname, "").splitlines(), fb.get(fname, "").splitlines(),
                                              f"{a or '-'}/{fname}", f"{b}/{fname}", lineterm="", n=2))
        text = "\n".join(lines)
        return {"name": name, "from": a, "to": b, "diff": text[:limit], "truncated": len(text) > limit,
                "same": not lines}

    def delete(self, name: str) -> bool:
        with self._lock:
            d = self._dir(name)
            if not d.is_dir():
                return False
            shutil.rmtree(d)
            return True

    # instance data files: <root>/_files/<bid>/<iid>/<name>
    def _data_dir(self, bid: str, iid: str) -> Path:
        if not re.fullmatch(r"[a-z0-9]{1,16}", bid or "") or not re.fullmatch(r"[a-z0-9]{1,12}", iid or ""):
            raise CompError("bad board or item id")
        return self.root / "_files" / bid / iid

    def put_data_file(self, bid: str, iid: str, fname: str, data: bytes, existing: int = 0) -> int:
        if not isinstance(fname, str) or not FILE.fullmatch(fname):
            raise CompError("data file name: letters, digits . _ - (max 64)")
        if len(data) > MAX_DATA_FILE:
            raise CompError(f"data file is over {MAX_DATA_FILE // (1024 * 1024)} MB")
        d = self._data_dir(bid, iid)
        d.mkdir(parents=True, exist_ok=True)
        if not (d / fname).exists() and len(list(d.iterdir())) >= MAX_DATA_FILES:
            raise CompError(f"at most {MAX_DATA_FILES} data files per card")
        tmp = d / f".{fname}.tmp"
        tmp.write_bytes(data)
        tmp.replace(d / fname)
        return len(data)

    def read_data_file(self, bid: str, iid: str, fname: str, off: int = 0, n: int = 4 * 1024 * 1024) -> Tuple[int, bytes]:
        if not isinstance(fname, str) or not FILE.fullmatch(fname):
            raise CompNotFound("no such data file")
        p = self._data_dir(bid, iid) / fname
        if not p.is_file():
            raise CompNotFound("no such data file")
        size = p.stat().st_size
        off = max(0, int(off))
        with p.open("rb") as fh:
            fh.seek(off)
            return size, fh.read(max(0, min(int(n), 8 * 1024 * 1024)))

    def remove_data_file(self, bid: str, iid: str, fname: str) -> bool:
        p = self._data_dir(bid, iid) / fname
        if p.is_file():
            p.unlink()
            return True
        return False


def decode_b64(data: str) -> bytes:
    try:
        return base64.b64decode(data, validate=False)
    except (binascii.Error, ValueError):
        raise CompError("data is not valid base64") from None
