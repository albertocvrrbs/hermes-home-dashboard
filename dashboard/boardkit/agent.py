"""Agent half of the board: tools (board_read / board_apply / board_render) and the
pre_llm_call hook that tells a linked session what the user changed between turns."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from . import embedlint, engine, summary
from .render import render_png
from .service import BoardService
from .store import NotFound

MARKER = re.compile(r"\[board:([a-z0-9]{8})\]")
HOOK_LIMIT = 1500
EMBED_HOOK = (
    "HTML embeds you write (charts, widgets): set theme:true and build fluid - use the injected vars "
    "(--foreground --muted-foreground --accent --border --card --chart-1..5, --font-sans/--font-mono), transparent "
    "background, %/flex/grid/viewBox instead of fixed px widths, redraw on window 'resize', no external fonts or libs.")

BULK_HOOK = ("Big orders go in ONE board_apply: import project files (op:'import'), mark many items (op:'set_where', "
             "mark ok/fail/wait), build zones and fill them (op:'zones'); board_read {help:'bulk'} has the syntax.")

EMBED_RULES = (
    "Embed rules (HTML you write: charts, dashboards, widgets - set theme:true; leave theme off only to show the "
    "user's own pasted page untouched): the board injects CSS vars --foreground --muted-foreground --accent --border "
    "--card --background --chart-1..5, --font-sans/--font-mono, a transparent background, zero margins and "
    "color-scheme, and keeps window.hermes.{size,theme,onResize,onTheme} current. Build fluid: no fixed px widths "
    "on html/body, sizes in %/flex/grid/container queries, svg with viewBox, no body background, no external fonts "
    "or libs (no network: inline what you need), text var(--foreground)/var(--muted-foreground), gridlines "
    "var(--border), series colours var(--chart-N) (Chart.js/ECharts defaults are set for you), and redraw on "
    "'resize' (the card fires it with the real size). Warnings come back in the result; fix them."
)

BULK_RULES = (
    'BIG ORDERS = ONE CALL (one board_apply = one undo step; never one call per item): '
    "{op:'import', paths:['~/proj/renders/*_hero*.png', '~/proj/doc.pdf', '~/proj/parts/'] (files, globs or folders under the user's home; "
    "max 40 files, raise limit up to 100), layout?:'grid'|'row'|'column', cols?, gap?, at?:{x,y}, into?:<frame or col id>, "
    "caption?:'name'|'none'} COPIES the files into the board (never linked) and places them on a tidy grid: png/jpg/webp/gif/svg -> image cards, "
    'mp4/webm/mov -> video cards (poster + duration), pdf -> card with the first page (click opens it), stl/obj/3mf -> shaded 3D thumbnail '
    '(click downloads the model), md/txt/code/json/csv -> text cards, html -> untouched sandboxed embed. Hidden files (.env, .ssh ...), secrets '
    "and anything outside the home folder are refused; the result lists the created 'imported' ids and what was 'skipped' and why. "
    "{op:'set_where', where:{ids?, k?, tag?, text?, num?:'1-37', mark?, by?, frame?, in?}, p:{mark:'ok'|'fail'|'wait'|null, ...}} sets fields on EVERY match "
    "(or rules:[{where,p},...], later rules win; it errors if a where matches nothing). 'mark' is a status stamp drawn on the item: use it for "
    'ok/fail/wait states (37 stations in one op). '
    "{op:'zones', zones:[{title, note?, where?:{...}|ids?:[...], ref?, frame?:<existing frame>, cols?, w?, h?}], layout?:'row'|'column'|'grid', gap?, "
    'spacing?, cols?, at?} creates titled frames in that order (Idea -> Design -> ...), moves the matching items into each (first zone to match wins; '
    'column kids only via where.in/ids), lays them on the 24px grid with uniform spacing, sizes the frames to fit and keeps the group clear of other '
    "items. {op:'arrange', frame?:id | ids?:[...] | where?:{...}, cols?, gap?} grid-packs items (in a frame it also grows the frame). "
    'A whole reorganisation is zones + set_where + arrange (+ connectors with $refs) in the same ops list. '
)

BULK_BRIEF = (
    "BIG ORDERS = ONE CALL (one board_apply, one undo step; never one call per item): "
    "{op:'import', paths:[files|globs|folders under the user's home], layout?:'grid'|'row'|'column', cols?, at?:{x,y}, into?:<frame|col id>, "
    "caption?:'name'|'none'} copies project files in (png/jpg/webp/gif/svg, mp4/webm/mov, pdf, stl/obj/3mf with a 3D thumbnail, md/txt/code as "
    "text cards; hidden and secret files refused); "
    "{op:'set_where', where:{ids?,k?,tag?,text?,num?,mark?,frame?,in?}, p:{mark:'ok'|'fail'|'wait'|null, ...}} (or rules:[{where,p}]) edits every "
    "match (mark = status stamp); {op:'zones', zones:[{title, where?|ids?, frame?, ref?}], layout?:'row'|'column'|'grid'} makes titled frames, moves "
    "the matches in and grids them on 24px; {op:'arrange', frame?|ids?|where?, cols?} grid-packs. Full syntax: board_read {help:'bulk'}. "
)

_OPS_HELP = (
    BULK_BRIEF + "ops: [{op:'add', ref:'$a', item:{k, x, y, w?, h?, ...}}, {op:'set', id, p:{...}} (null removes a field), "
    "{op:'del', id}, {op:'board', p:{name}}, {op:'tidy', ids?:[...], gap?:24} (lay items out in a clean grid in reading "
    "order, aligned to the 24px grid with uniform gaps; omit ids for the whole board, which leaves connected diagram "
    "nodes, framed items and loose strokes alone), {op:'insert_on_edge', edge:<line id>, ref?:'$x', item:{k,...}} (put an "
    "item in the middle of a connector: splits it into A->new->B, keeps the label on A->new, pushes B and what hangs off "
    "it away if it is too tight; one undo step)]. Use '$refs' to point at items added in the same batch. "
    "Kinds: card{title,text,tags,due} · todo{title,items:[{t,done}]} · col{title} (add cards with in:'<col>') · "
    "box{num,title,sub} (diagram node, ~196x62) · shape{sh:'rect'|'diamond'|'pill'|'circle',title} (flowchart symbol: process, "
    "decision, start/end, connector; ~160x56, diamond 150x100, pill 150x48, circle 72) · line{a,b,label} (connector; a/b = ids or [x,y]) · "
    "frame{title,note,w,h} (titled region) · text{text,size:'h'|'p'} · link{url} (preview fetched for you; video "
    "and image URLs become players/images) · embed{title,html,theme} (sandboxed HTML, scripts only, no network; ALWAYS send theme:true on HTML you write, see 'Embed rules') · "
    "draw{d:'x,y x,y …' ints relative to x,y, sw, tl?:'line'|'arrow'|'rect'|'ellipse'|'hl' (shapes: d = two points; "
    "hl = translucent highlighter), c?:'accent'|'sage'|'clay'|'slate'|'sand', ds?:true dashed, g?:group id} · "
    "board{ref} · live{title, tpl:'training'|'job'|'stat' or blocks:[...], data:{...}, ttl, actions:[{action, label?, "
    "args?}]} (a card bound to your own job: blocks header{title,sub,status,icon} progress{value 0-1,label,eta} "
    "metrics{items:[{label,value,fmt,delta,good}]} spark{series,label,fmt} media{video|image,poster,caption} "
    "text{value,lines} actions{items:[{action,label?,args?}]}; any value may be '$key' read from data; fmt num|int|pct|"
    "usd|dur; status running|paused|done|error|idle). Update a live card later with {op:'live', id, data:{k:v} "
    "(null deletes), push:{series:[n]}, keep?} - cheap, no layout. Buttons can only name action ids the owner "
    "registered (board_read actions:true lists them); never put commands in a card. "
    "Coordinates are world px; leave ~60px gaps; columns are 276 wide. " + EMBED_RULES
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
            "actions": {"type": "boolean", "description": "Also list the live-card actions the owner registered "
                        "(ids you may put on live card buttons)."},
            "help": {"type": "string", "enum": ["bulk"], "description": "'bulk' returns the full syntax of import, set_where, "
                     "zones, arrange and place (big orders in one board_apply)."},
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

    def _actions(self) -> Dict[str, Any]:
        reg = self.svc.actions.list_public()
        rows = [{k: a[k] for k in ("id", "label", "description", "destructive", "enabled", "args") if k in a}
                for a in reg["actions"]]
        out: Dict[str, Any] = {"actions": rows}
        if not rows:
            out["hint"] = ("none registered; the owner adds them as JSON in " + reg["dir"] +
                           " (see the plugin README, 'Live cards')")
        if reg["problems"]:
            out["problems"] = reg["problems"][:5]
        return out

    @staticmethod
    def _embed_warnings(doc: Dict[str, Any], ops: Any) -> list:
        """Advice on HTML embeds the agent is writing (never blocks the batch). Only themed embeds are
        linted; one written without theme:true gets a single nudge."""
        out: list = []
        if not isinstance(ops, list):
            return out
        for i, op in enumerate(ops):
            if not isinstance(op, dict) or op.get("op") not in ("add", "set"):
                continue
            body = op.get("item") if op["op"] == "add" else op.get("p")
            if not isinstance(body, dict) or not isinstance(body.get("html"), str):
                continue
            prior = (doc.get("items") or {}).get(op.get("id"), {}) if op["op"] == "set" else {}
            themed = body["theme"] is True if "theme" in body else bool(prior.get("theme"))
            if not themed:
                out.append(f"op {i}: html embed without theme:true. Set theme:true on HTML you write so it gets the "
                           "board theme and responsive sizing.")
                continue
            out.extend(f"op {i}: {w}" for w in embedlint.lint_embed(body["html"]))
        return out[:12]

    # ── tools ────────────────────────────────────────────────────────────
    def board_read(self, args: Dict[str, Any], session_id: Optional[str] = None, **_: Any) -> str:
        try:
            args = args or {}
            if args.get("help") == "bulk":
                return _dump({"help": BULK_RULES})
            if args.get("actions") and not args.get("board") and not session_id:
                return _dump({"live_actions": self._actions()})
            doc, created, linked = self._resolve(args, session_id)
            if doc is None:
                if args.get("actions"):
                    return _dump({"live_actions": self._actions()})
                return self._missing(args)
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
            if args.get("actions"):
                out["live_actions"] = self._actions()
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
            embed_warnings = self._embed_warnings(doc, args.get("ops"))
            report: Dict[str, Any] = {}
            new, entry = self.svc.commit(doc["id"], args.get("ops"), by="h", note=note, previews="wait", report=report)
            if entry.get("noop"):
                return _dump({"board": doc["id"], "seq": new["seq"], "warning": "nothing changed"})
            last = next((op.get("id") for op in reversed(entry.get("ops") or []) if op.get("id")), None)
            n = len(entry.get("ops") or [])
            self.svc.store.set_presence(doc["id"], (note or f"{n} change{'s' if n != 1 else ''}")[:80], on=last)
            out: Dict[str, Any] = {"board": doc["id"], "seq": new["seq"], "ids": entry.get("ids", {})}
            if embed_warnings:
                out["warnings"] = embed_warnings
            if report.get("imported"):
                ref_ids = out["ids"]
                out["imported"] = [{**{k: v for k, v in row.items() if k != "ref"}, "id": ref_ids.get(row["ref"])}
                                   for row in report["imported"]]
            if report.get("skipped"):
                out["skipped"] = report["skipped"][:30]
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
                             "and write on it with board_apply (one batch per change set). " + BULK_HOOK + " " + EMBED_HOOK)
            changes = summary.changes_since(doc, store.entries(bid), doc.get("seen", 0), limit=HOOK_LIMIT)
            if changes:
                parts.append(f'[Board "{doc["name"]}" ({bid}): the user changed it since your last turn: {changes}. '
                             "board_read shows the details.]")
                store.mark_seen(bid, doc["seq"])
            return {"context": "\n".join(parts)} if parts else None
        except Exception:
            return None
