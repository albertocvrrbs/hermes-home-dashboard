"""File-backed board store: one JSON document + an append-only op log per board.

Two processes write boards (the dashboard/Webapp backend serving the UI, and the agent
process running board tools), so every read-modify-write runs under ``flock`` on
``<bid>.lock`` and documents are replaced atomically (temp file + ``os.replace``).
"""
from __future__ import annotations

import contextlib
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple

from . import engine, ids

try:  # POSIX; on Windows writes are still atomic, just not serialised across processes
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None  # type: ignore[assignment]

LOG_KEEP = 2000
MAX_BOARDS = 400
SESSIONS_FILE = "_sessions.json"


class NotFound(LookupError):
    pass


class BoardStore:
    def __init__(self, root: Path):
        self.root = Path(root)

    # ── paths ────────────────────────────────────────────────────────────
    def _path(self, bid: Any, suffix: str) -> Path:
        if not ids.valid_bid(bid):
            raise NotFound("no such board")
        path = (self.root / f"{bid}{suffix}").resolve()
        if path.parent != self.root.resolve():
            raise NotFound("no such board")
        return path

    def _ensure_root(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    @contextlib.contextmanager
    def _lock(self, bid: str) -> Iterator[None]:
        self._ensure_root()
        with open(self._path(bid, ".lock"), "a") as fh:
            if fcntl is not None:
                fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                if fcntl is not None:
                    fcntl.flock(fh.fileno(), fcntl.LOCK_UN)

    def _write_json(self, path: Path, data: Any) -> None:
        tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
        tmp.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)

    def _read_doc(self, bid: str) -> Dict[str, Any]:
        path = self._path(bid, ".json")
        try:
            doc = json.loads(path.read_text("utf-8"))
        except FileNotFoundError:
            raise NotFound("no such board") from None
        if not isinstance(doc, dict) or doc.get("id") != bid:
            raise NotFound("board file is corrupt")
        return doc

    # ── boards ───────────────────────────────────────────────────────────
    def create(self, name: str, parent: Optional[str] = None, now: Optional[float] = None) -> Dict[str, Any]:
        self._ensure_root()
        if len(self._board_files()) >= MAX_BOARDS:
            raise engine.OpError(f"at most {MAX_BOARDS} boards")
        if parent is not None and not ids.valid_bid(parent):
            parent = None
        bid = ids.new_bid()
        for _ in range(8):
            if not self._path(bid, ".json").exists():
                break
            bid = ids.new_bid()
        doc = engine.new_doc(bid, name, now or time.time(), parent=parent)
        with self._lock(bid):
            self._write_json(self._path(bid, ".json"), doc)
            self._path(bid, ".log.jsonl").touch()
        return doc

    def _board_files(self) -> List[Path]:
        if not self.root.is_dir():
            return []
        return [p for p in self.root.glob("*.json") if ids.valid_bid(p.stem)]

    def list(self) -> List[Dict[str, Any]]:
        out = []
        for path in self._board_files():
            try:
                doc = self._read_doc(path.stem)
            except (NotFound, ValueError):
                continue
            out.append(summary_row(doc))
        out.sort(key=lambda b: b["updated"], reverse=True)
        return out

    def load(self, bid: Any) -> Dict[str, Any]:
        return self._read_doc(self._path(bid, ".json").stem)

    def find(self, key: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(key, str) or not key.strip():
            return None
        key = key.strip()
        if ids.valid_bid(key):
            try:
                return self.load(key)
            except NotFound:
                pass
        folded = key.casefold()
        for row in self.list():
            if row["name"].casefold() == folded:
                return self.load(row["id"])
        return None

    def delete(self, bid: str) -> None:
        with self._lock(bid):
            src = self._path(bid, ".json")
            if not src.exists():
                raise NotFound("no such board")
            trash = self.root / ".trash"
            trash.mkdir(exist_ok=True)
            stamp = int(time.time())
            for suffix in (".json", ".log.jsonl"):
                p = self._path(bid, suffix)
                if p.exists():
                    os.replace(p, trash / f"{bid}-{stamp}{suffix}")
        sessions = self._sessions()
        if any(v == bid for v in sessions.values()):
            self._write_json(self.root / SESSIONS_FILE, {k: v for k, v in sessions.items() if v != bid})

    # ── ops ──────────────────────────────────────────────────────────────
    def commit(self, bid: Any, ops: Any, by: str = "u", note: Optional[str] = None,
               now: Optional[float] = None, undo: Optional[int] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        self._path(bid, ".json")
        with self._lock(bid):
            doc = self._read_doc(bid)
            new, inv, refs, fwd = engine.apply_batch_ex(doc, ops, by, now)
            if not fwd:
                return doc, {"s": doc["seq"], "noop": True}
            new["seq"] = doc["seq"] + 1
            new["updated"] = int(now or time.time())
            entry: Dict[str, Any] = {"s": new["seq"], "t": new["updated"], "by": by if by in ("h", "s") else "u",
                                     "ops": fwd, "inv": inv}
            if refs:
                entry["ids"] = refs
            if note:
                entry["note"] = str(note)[:300]
            if undo is not None:
                entry["undo"] = undo
            if by == "h":
                new["seen"] = new["seq"]
            self._write_json(self._path(bid, ".json"), new)
            log = self._path(bid, ".log.jsonl")
            with open(log, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, separators=(",", ":"), ensure_ascii=False) + "\n")
            every = max(1, min(100, LOG_KEEP))
            if new["seq"] % every == 0:
                self._compact(log)
        return new, public_entry(entry)

    def _compact(self, log: Path) -> None:
        lines = log.read_text("utf-8").splitlines()
        if len(lines) > LOG_KEEP:
            tmp = log.with_name(f".{log.name}.{os.getpid()}.tmp")
            tmp.write_text("\n".join(lines[-LOG_KEEP:]) + "\n", encoding="utf-8")
            os.replace(tmp, log)

    def entries(self, bid: Any) -> List[Dict[str, Any]]:
        path = self._path(bid, ".log.jsonl")
        out = []
        try:
            text = path.read_text("utf-8")
        except FileNotFoundError:
            return []
        for line in text.splitlines():
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
        return out

    def since(self, bid: Any, seq: int) -> Dict[str, Any]:
        """``{seq, hermes?}`` when nothing changed, ``{seq, entries}`` when the log covers the
        gap, else ``{seq, doc}``."""
        doc = self.load(bid)
        base: Dict[str, Any] = {"seq": doc["seq"]}
        if doc.get("hermes"):
            base["hermes"] = doc["hermes"]
        if seq == doc["seq"]:
            return base
        if 0 <= seq < doc["seq"]:
            wanted = [e for e in self.entries(bid) if e.get("s", 0) > seq]
            if wanted and wanted[0]["s"] == seq + 1 and wanted[-1]["s"] == doc["seq"]:
                return {**base, "entries": [public_entry(e) for e in wanted]}
        return {**base, "doc": doc}

    def undo(self, bid: Any, s: int, by: str = "u") -> Tuple[Dict[str, Any], Dict[str, Any]]:
        entry = next((e for e in self.entries(bid) if e.get("s") == s), None)
        if entry is None:
            raise NotFound("that change is no longer in the history")
        return self.commit(bid, entry.get("inv") or [], by=by, undo=s)

    # ── metadata (no seq bump) ───────────────────────────────────────────
    def _update(self, bid: Any, fn) -> Dict[str, Any]:
        self._path(bid, ".json")
        with self._lock(bid):
            doc = self._read_doc(bid)
            result = fn(doc)
            if result is not False:
                self._write_json(self._path(bid, ".json"), doc)
            return doc

    def set_presence(self, bid: Any, act: str, on: Optional[str] = None, now: Optional[float] = None) -> None:
        def fn(doc):
            doc["hermes"] = {"at": int(now or time.time()), "act": str(act)[:80]}
            if on:
                doc["hermes"]["on"] = on
        self._update(bid, fn)

    def mark_seen(self, bid: Any, seq: int) -> None:
        def fn(doc):
            if doc.get("seen", 0) >= seq:
                return False
            doc["seen"] = seq
        self._update(bid, fn)

    def _sessions(self) -> Dict[str, str]:
        try:
            data = json.loads((self.root / SESSIONS_FILE).read_text("utf-8"))
            return data if isinstance(data, dict) else {}
        except (FileNotFoundError, ValueError):
            return {}

    def link_session(self, bid: Any, session_id: str, profile: str = "default", force: bool = False) -> bool:
        if not isinstance(session_id, str) or not session_id or len(session_id) > 200:
            return False
        linked = {"done": False}

        def fn(doc):
            if doc.get("session") and not force:
                return False
            doc["session"] = {"id": session_id, "profile": str(profile or "default")[:64]}
            linked["done"] = True
        self._update(bid, fn)
        if linked["done"]:
            with self._lock(bid):
                sessions = self._sessions()
                sessions[session_id] = bid
                self._write_json(self.root / SESSIONS_FILE, sessions)
        return linked["done"]

    def board_for_session(self, session_id: str) -> Optional[str]:
        if not session_id:
            return None
        bid = self._sessions().get(session_id)
        return bid if ids.valid_bid(bid) and self._path(bid, ".json").exists() else None


def public_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in entry.items() if k != "inv"}


def summary_row(doc: Dict[str, Any]) -> Dict[str, Any]:
    items = doc.get("items") or {}
    return {
        "id": doc["id"], "name": doc.get("name", ""), "parent": doc.get("parent"),
        "updated": doc.get("updated", 0), "count": sum(1 for v in items.values() if v.get("k") != "line"),
        "session": doc.get("session"), "seq": doc.get("seq", 0),
    }
