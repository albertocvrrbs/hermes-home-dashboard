"""Agent half of the board: tools (board_read / board_apply / board_render) and the
pre_llm_call hook that tells a linked session what the user changed between turns."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from . import engine, summary
from .render import render_png
from .service import BoardService
from .store import NotFound

MARKER = re.compile(r"\[board:([a-z0-9]{8})\]")
HOOK_LIMIT = 1500

_OPS_HELP = (
    "ops: [{op:'add', ref:'$a', item:{k, x, y, w?, h?, ...}}, {op:'set', id, p:{...}} (null removes a field), "
    "{op:'del', id}, {op:'board', p:{name}}]. Use '$refs' to point at items added in the same batch. "
    "Kinds: card{title,text,tags,due} · todo{title,items:[{t,done}]} · col{title} (add cards with in:'<col>') · "
    "box{num,title,sub} (diagram node, ~196x62) · line{a,b,label} (connector; a/b = ids or [x,y]) · "
    "frame{title,note,w,h} (titled region) · text{text,size:'h'|'p'} · link{url} (preview fetched for you; video "
    "and image URLs become players/images) · embed{title,html} (sandboxed HTML, scripts only, no network) · "
    "board{ref}. Coordinates are world px; leave ~60px gaps; columns are 276 wide."
)

SCHEMAS: Dict[str, Dict[str, Any]] = {
    "board_read": {
        "name": "board_read",
        "description": (
            "Read a Home Dashboard board (infinite canvas shared with the user). Returns a compact outline, one "
            "line per item: '<id> <kind>[*=yours] @x,y WxH \"title\" text #tags'. By default only what the user "
            "changed since you last looked; full:true for everything. Omit board to use the board linked to this "
            "session. create:true makes a new board with that name (and links it here)."),
        "parameters": {"type": "object", "properties": {
            "board": {"type": "string", "description": "Board id or name."},
            "full": {"type": "boolean", "description": "Whole outline instead of changes."},
            "create": {"type": "boolean", "description": "Create the board if no board has this name."},
        }},
    },
    "board_apply": {
        "name": "board_apply",
        "description": (
            "Write on a board in ONE atomic batch (do whole diagrams in a single call). The user watches your "
            "cursor move through the ops. " + _OPS_HELP + " note: one short sentence for the user's log "
            "('Turned your sketch into a 4-step flow')."),
        "parameters": {"type": "object", "properties": {
            "board": {"type": "string", "description": "Board id or name (default: linked board)."},
            "ops": {"type": "array", "items": {"type": "object"}, "description": "Batch of ops (max 200)."},
            "note": {"type": "string", "description": "What you did, one sentence."},
            "create": {"type": "boolean", "description": "Create the board if it does not exist."},
        }, "required": ["ops"]},
    },
    "board_render": {
        "name": "board_render",
        "description": (
            "Render a board (or some items / a region) to a PNG and return its path, so you can look at the "
            "user's freehand sketches with your vision tool before redrawing them as clean boxes and lines."),
        "parameters": {"type": "object", "properties": {
            "board": {"type": "string"},
            "ids": {"type": "array", "items": {"type": "string"}, "description": "Only these items."},
            "region": {"type": "object", "description": "{x, y, w, h} in world px."},
        }},
    },
}


def _dump(data: Dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def _message_text(message: Any) -> str:
    if isinstance(message, str):
        return message
    if isinstance(message, list):
        return " ".join(p.get("text", "") for p in message if isinstance(p, dict) and isinstance(p.get("text"), str))
    return ""


class BoardAgent:
    def __init__(self, service: BoardService, profile: str = "default"):
        self.svc = service
        self.profile = profile or "default"

    # ── helpers ──────────────────────────────────────────────────────────
    def _resolve(self, args: Dict[str, Any], session_id: Optional[str]):
        key = args.get("board")
        doc, created = None, False
        if isinstance(key, str) and key.strip():
            doc = self.svc.store.find(key)
            if doc is None and args.get("create"):
                doc = self.svc.store.create(key.strip()[:200])
                created = True
        elif session_id:
            bid = self.svc.store.board_for_session(session_id)
            doc = self.svc.store.load(bid) if bid else None
        newly_linked = False
        if doc is not None and session_id and not doc.get("session"):
            newly_linked = self.svc.store.link_session(doc["id"], session_id, self.profile)
            if newly_linked:
                doc = self.svc.store.load(doc["id"])
        return doc, created, newly_linked

    def _missing(self, args: Dict[str, Any]) -> str:
        boards = [{"id": b["id"], "name": b["name"], "items": b["count"]} for b in self.svc.store.list()[:30]]
        what = f"no board named {args.get('board')!r}" if args.get("board") else "this session has no linked board"
        return _dump({"error": what + " (pass create:true to make one)", "boards": boards})

    # ── tools ────────────────────────────────────────────────────────────
    def board_read(self, args: Dict[str, Any], session_id: Optional[str] = None, **_: Any) -> str:
        try:
            doc, created, linked = self._resolve(args or {}, session_id)
            if doc is None:
                return self._missing(args or {})
            bid = doc["id"]
            out: Dict[str, Any] = {"board": bid, "name": doc["name"], "seq": doc["seq"]}
            if created:
                out["created"] = True
            if args.get("full") or created or linked or not doc.get("seen"):
                out["outline"] = summary.outline(doc)
            else:
                changes = summary.changes_since(doc, self.svc.store.entries(bid), doc.get("seen", 0), limit=4000)
                out["changes"] = changes
                if changes:
                    touched = [line.split()[2] if line.startswith("+") else line.split()[1]
                               for line in changes.split("; ") if line[:1] in "+~"]
                    out["outline"] = summary.outline(doc, only=[t for t in touched if t in doc["items"]])
                else:
                    out["outline"] = summary.header(doc) + "\n(nothing changed since your last read; full:true for everything)"
            self.svc.store.mark_seen(bid, doc["seq"])
            self.svc.store.set_presence(bid, "reading the board")
            return _dump(out)
        except (NotFound, engine.OpError) as e:
            return _dump({"error": str(e)})

    def board_apply(self, args: Dict[str, Any], session_id: Optional[str] = None, **_: Any) -> str:
        args = args or {}
        try:
            doc, _, _ = self._resolve(args, session_id)
            if doc is None:
                return self._missing(args)
            note = args.get("note") if isinstance(args.get("note"), str) else None
            new, entry = self.svc.commit(doc["id"], args.get("ops"), by="h", note=note, previews="wait")
            if entry.get("noop"):
                return _dump({"board": doc["id"], "seq": new["seq"], "warning": "nothing changed"})
            last = next((op.get("id") for op in reversed(entry.get("ops") or []) if op.get("id")), None)
            n = len(entry.get("ops") or [])
            self.svc.store.set_presence(doc["id"], (note or f"{n} change{'s' if n != 1 else ''}")[:80], on=last)
            out: Dict[str, Any] = {"board": doc["id"], "seq": new["seq"], "ids": entry.get("ids", {})}
            waiting = [i for i, it in new["items"].items() if it.get("st") == "wait"]
            if waiting:
                out["previews_pending"] = waiting
            return _dump(out)
        except (NotFound, engine.OpError) as e:
            return _dump({"error": str(e)})

    def board_render(self, args: Dict[str, Any], session_id: Optional[str] = None, **_: Any) -> str:
        args = args or {}
        try:
            doc, _, _ = self._resolve(args, session_id)
            if doc is None:
                return self._missing(args)
            only = args.get("ids") if isinstance(args.get("ids"), list) else None
            region = args.get("region") if isinstance(args.get("region"), dict) else None
            info = render_png(doc, self.svc.assets, self.svc.root / "renders" / f"{doc['id']}.png", only, region)
            info["hint"] = "Look at it with vision_analyze; world = region.x + px/scale."
            return _dump(info)
        except (NotFound, engine.OpError, RuntimeError, ValueError) as e:
            return _dump({"error": str(e)})

    # ── hook ─────────────────────────────────────────────────────────────
    def pre_llm_call(self, session_id: Optional[str] = None, user_message: Any = None,
                     is_first_turn: bool = False, **_: Any) -> Optional[Dict[str, str]]:
        try:
            if not session_id or not self.svc.root.is_dir():
                return None
            store = self.svc.store
            bid = store.board_for_session(session_id)
            linked_now = False
            if bid is None:
                m = MARKER.search(_message_text(user_message))
                if not m:
                    return None
                if not store.link_session(m.group(1), session_id, self.profile):
                    doc = store.load(m.group(1))
                    if (doc.get("session") or {}).get("id") != session_id:
                        return None
                bid, linked_now = m.group(1), True
            doc = store.load(bid)
            parts = []
            if linked_now or is_first_turn:
                parts.append(f'This session is linked to the board "{doc["name"]}" ({bid}). Read it with board_read '
                             "and write on it with board_apply (one batch per change set).")
            changes = summary.changes_since(doc, store.entries(bid), doc.get("seen", 0), limit=HOOK_LIMIT)
            if changes:
                parts.append(f'[Board "{doc["name"]}" ({bid}): the user changed it since your last turn: {changes}. '
                             "board_read shows the details.]")
                store.mark_seen(bid, doc["seq"])
            return {"context": "\n".join(parts)} if parts else None
        except Exception:
            return None
