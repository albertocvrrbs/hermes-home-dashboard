"""Agent half of the board: tools (board_read / board_apply / board_render) and the
pre_llm_call hook that tells a linked session what the user changed between turns."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from . import compguide, components as comp_mod, embedlint, engine, summary
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

TOUR_HOOK = (
    "Tour: frames are the slides, then ONE {op:'tour', from:'frames'} (or stops:[id | {id,t?,dw?} | {rect} | {view}]; a board card "
    "dives into the sub-board; add/remove/clear/loop/dw edit it).")

COMP_HOOK = (
    "Custom cards: board_component guide, then create and place a component (comp card); {op:'sync', ids:[video, comp...]} "
    "links them to one playhead.")

_OPS_HELP = (
    BULK_BRIEF + "ops: [{op:'add', ref:'$a', item:{k, x, y, w?, h?, ...}}, {op:'set', id, p:{...}} (null removes a field), "
    "{op:'del', id}, {op:'board', p:{name}}, {op:'tidy', ids?:[...], gap?:24} (lay items out in a clean grid in reading "
    "order, aligned to the 24px grid with uniform gaps; omit ids for the whole board, which leaves connected diagram "
    "nodes, framed items and loose strokes alone), {op:'insert_on_edge', edge:<line id>, ref?:'$x', item:{k,...}} (put an "
    "item in the middle of a connector: splits it into A->new->B, keeps the label on A->new, pushes B and what hangs off "
    "it away if it is too tight; one undo step), {op:'tour', stops:[...], add?:[...], at?, remove?:[...], from?:'frames'|'boards', "
    "clear?:true, loop?, dw?, t?} (presentation tour: stops are ids, {rect}, {view}; from:'frames' = every frame in reading order)]. Use '$refs' to point at items added in the same batch. "
    "Kinds: card{title,text,tags,due} · todo{title,items:[{t,done}]} · col{title} (add cards with in:'<col>') · "
    "box{num,title,sub} (diagram node, ~196x62) · shape{sh:'rect'|'diamond'|'pill'|'circle',title} (flowchart symbol: process, "
    "decision, start/end, connector; ~160x56, diamond 150x100, pill 150x48, circle 72) · line{a,b,label} (connector; a/b = ids or [x,y]) · "
    "frame{title,note,w,h} (titled region) · text{text,size:'h'|'p'} · link{url} (preview fetched for you; video "
    "and image URLs become players/images; image/video take w only) · embed{title,html,theme} (sandboxed HTML, scripts only, no network; ALWAYS send theme:true on HTML you write, see 'Embed rules') · "
    "draw{d:'x,y x,y …' ints relative to x,y, sw, tl?:'line'|'arrow'|'rect'|'ellipse'|'hl' (shapes: d = two points; "
    "hl = translucent highlighter), c?:'accent'|'sage'|'clay'|'slate'|'sand', ds?:true dashed, g?:group id} · "
    "board{ref} (sub-board: board_read {create:true, parent}) · live{title, tpl:'training'|'job'|'stat' or blocks:[...], data:{...}, ttl, actions:[{action, label?, "
    "args?}]} (a card bound to your own job: blocks header{title,sub,status,icon} progress{value 0-1,label,eta} "
    "metrics{items:[{label,value,fmt,delta,good}]} spark{series,label,fmt} media{video|image,poster,caption} "
    "text{value,lines} actions{items:[{action,label?,args?}]}; any value may be '$key' read from data; fmt num|int|pct|"
    "usd|dur (pct: 77 = 77 %); status running|paused|done|error|idle). Update a live card later with {op:'live', id, data:{k:v} "
    "(null deletes), push:{series:[n]}, keep?} - cheap, no layout. Buttons can only name action ids the owner "
    "registered (board_read actions:true lists them); never put commands in a card. "
    "comp{comp:'<library name>', title, w, h, cdata:{...}, ver?, actions:[ids]} (runs a component YOU wrote with the "
    "board_component tool; update its data with {op:'comp', id, data:{k:v}|push:{k:n}}) · {op:'sync', ids:[video/comp "
    "cards], group?} links cards to one shared playhead (video = master), {op:'unsync', ids?|group?}. "
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
            "parent": {"type": "string", "description": "With create: the board this one is a sub-board of (id or "
                       "name). A board card {k:'board', ref} also makes its board a sub-board of the card's board."},
            "actions": {"type": "boolean", "description": "Also list the live-card actions the owner registered "
                        "(ids you may put on live card buttons)."},
            "help": {"type": "string", "enum": ["bulk"], "description": "'bulk' returns the full syntax of import, set_where, "
                     "zones, arrange and place (big orders in one board_apply)."},
        }},
    },
    "board_component": {
        "name": "board_component",
        "description": (
            "Write, version and manage CUSTOM COMPONENTS: HTML/JS cards you create for what the user needs, saved in "
            "their component library and reusable on any board. " + compguide.COMPONENT_RULES + " Actions: "
            "list {} · guide {} (the full window.hb v1 contract; read it before your first component) · get {name, "
            "version?} (source files) · create|update {name, html | files:{'index.html':...,'app.js':...} | dir:'<local folder with index.html, app.js...>' (saves what you wrote and tested there without resending it), edits?:[{file?, "
            "find, replace}] (patch the current version), remove?:[files], replace?:true (start from empty), title?, "
            "desc?, note?} (every save = new version v1,v2...; sample.json = preview data) · diff {name, from?, to?} · "
            "rollback {name, to} (a new version copying the old one) · delete {name, confirm:true} · attach {board?, id, "
            "name, path | json | text} (attach a data file to a comp card, up to 48 MB, read with hb.asset(name)) · "
            "place {board?, name, x?, y?, w?, h?, cdata?} (shortcut for adding the card). Returns lint warnings; fix them."),
        "parameters": {"type": "object", "properties": {
            "action": {"type": "string", "enum": ["list", "guide", "get", "create", "update", "diff", "rollback",
                                                  "delete", "attach", "place"]},
            "name": {"type": "string", "description": "Component name (lowercase letters, digits, dashes) or, for "
                     "attach, the data file name."},
            "component": {"type": "string", "description": "attach/place: the library component name when `name` is the file."},
            "html": {"type": "string"}, "files": {"type": "object"},
            "edits": {"type": "array", "items": {"type": "object"}}, "remove": {"type": "array", "items": {"type": "string"}},
            "replace": {"type": "boolean"}, "title": {"type": "string"}, "desc": {"type": "string"},
            "note": {"type": "string"}, "version": {"type": "string"}, "from": {"type": "string"}, "to": {"type": "string"},
            "confirm": {"type": "boolean"}, "board": {"type": "string"}, "id": {"type": "string", "description": "attach: the comp card id."},
            "path": {"type": "string", "description": "attach: file on this machine to copy in."},
            "dir": {"type": "string", "description": "create/update: a folder on this machine holding index.html and its "
                    ".js/.css/.json/.svg/.txt/.md files (files:{} entries win over the folder's)."},
            "json": {}, "text": {"type": "string"},
            "x": {"type": "number"}, "y": {"type": "number"}, "w": {"type": "number"}, "h": {"type": "number"},
            "cdata": {"type": "object"},
        }, "required": ["action"]},
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
            "ids": {"type": "array", "items": {"type": "string"}, "description": "Only these items (a frame brings "
                    "everything inside it)."},
            "region": {"type": "object", "description": "{x, y, w, h} in world px (also accepted as `rect`)."},
        }},
    },
}


def _component_dir(path: str) -> Any:
    """The component files in a local folder (what you wrote and tested there), or an error string."""
    from pathlib import Path
    from .components import CODE_EXT, MAX_FILE, MAX_FILES
    from .importer import _SECRET
    d = Path(path).expanduser()
    if not d.is_dir():
        return f"no such folder {str(d)[:120]}"
    out: Dict[str, str] = {}
    for f in sorted(d.iterdir()):
        if not f.is_file() or f.name.startswith(".") or not f.name.lower().endswith(CODE_EXT) or _SECRET.search(f.name):
            continue
        if f.stat().st_size > MAX_FILE:
            return f"{f.name} is over {MAX_FILE // 1000} KB: attach big data to the card instead (attach)"
        try:
            out[f.name] = f.read_text("utf-8")
        except UnicodeDecodeError:
            return f"{f.name} is not UTF-8 text"
    if "index.html" not in out:
        return f"{str(d)[:120]} has no index.html"
    if len(out) > MAX_FILES:
        return f"at most {MAX_FILES} files per component"
    return out


def _with_contents(doc: Dict[str, Any], ids: List[str]) -> List[str]:
    """Render ids plus what they hold: a frame brings the items inside it, a column its cards, and
    connectors come along when both of their ends are shown."""
    from .render import _rect
    items = doc.get("items") or {}
    out = [i for i in ids if i in items]
    seen = set(out)
    for fid in [i for i in out if items[i].get("k") == "frame"]:
        fr = _rect(items[fid], items)
        if not fr:
            continue
        for k, it in items.items():
            r = None if k in seen else _rect(it, items)
            if r and fr[0] <= r[0] + r[2] / 2 <= fr[0] + fr[2] and fr[1] <= r[1] + r[3] / 2 <= fr[1] + fr[3]:
                out.append(k)
                seen.add(k)
    for k, it in items.items():
        if it.get("k") == "line" and k not in seen:
            ends = [it.get("a"), it.get("b")]
            if all(isinstance(e, str) and e in seen for e in ends):
                out.append(k)
                seen.add(k)
    return out


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
        home = self.svc.store.board_for_session(session_id) if session_id else None
        if isinstance(key, str) and key.strip():
            doc = self.svc.store.find(key)
            if doc is None and args.get("create"):
                parent = args.get("parent")
                if isinstance(parent, str) and parent.strip():
                    pdoc = self.svc.store.find(parent)
                    parent = pdoc["id"] if pdoc else None
                else:
                    parent = None
                doc = self.svc.store.create(key.strip()[:200], parent)
                created = True
        elif home:
            doc = self.svc.store.load(home)
        newly_linked = False
        # a session keeps the board it belongs to: another board it reads or creates (a sub-board) is
        # never linked in its place, or the chat panel and the change hook would follow the wrong board
        if doc is not None and session_id and not doc.get("session") and (home is None or home == doc["id"]):
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

    def _comp_warnings(self, doc: Dict[str, Any], ops: Any) -> list:
        """A comp card that names a component the library does not have (or a sync that links nothing useful)."""
        out: list = []
        if not isinstance(ops, list):
            return out
        lib = self.svc.components
        for i, op in enumerate(ops):
            if not isinstance(op, dict):
                continue
            body = op.get("item") if op.get("op") == "add" else op.get("p") if op.get("op") == "set" else None
            if isinstance(body, dict) and body.get("k", "comp" if op.get("op") == "set" else None) == "comp" \
                    and isinstance(body.get("comp"), str) and not lib.exists(body["comp"]):
                out.append(f"op {i}: component {body['comp']!r} is not in the library: create it first with "
                           "board_component (action:'list' shows what exists)")
        return out

    # ── tools ────────────────────────────────────────────────────────────
    def board_component(self, args: Dict[str, Any], session_id: Optional[str] = None, **_: Any) -> str:
        args = args or {}
        act = args.get("action")
        lib = self.svc.components
        name = args.get("name")
        try:
            if act == "guide":
                return _dump({"guide": compguide.GUIDE})
            if act == "list":
                return _dump({"components": lib.list(), "dir": str(lib.root),
                              "hint": "none yet: create one with action:'create'" if not lib.list() else None})
            if act in ("create", "update"):
                keys = ("html", "files", "edits", "remove", "replace", "title", "desc", "note")
                kw = {k: args[k] for k in keys if k in args}
                if args.get("dir"):
                    files = _component_dir(str(args["dir"]))
                    if isinstance(files, str):
                        return _dump({"error": files})
                    kw["files"] = {**files, **(kw.get("files") or {})}
                if "replace" in kw:
                    kw["replace"] = kw["replace"] is True
                res = self.svc.comp_save(name, by="h", **kw)
                self._presence(session_id, args, f"{'created' if res.get('created') else 'updated'} component {name}")
                return _dump(res)
            if act == "get":
                ver, files = lib.files(name, args.get("version"))
                meta = lib.meta(name)
                return _dump({"name": name, "version": ver, "current": meta["current"], "title": meta.get("title"),
                              "desc": meta.get("desc"), "versions": [v["v"] for v in meta["versions"]], "files": files})
            if act == "diff":
                return _dump(lib.diff(name, args.get("from"), args.get("to")))
            if act == "rollback":
                res = lib.rollback(name, args.get("to"), by="h")
                if not res.get("noop"):
                    self.svc.comp_touch(name)
                return _dump(res)
            if act == "delete":
                if args.get("confirm") is not True:
                    return _dump({"error": "delete removes the component and all its versions; ask the user, then "
                                           "call again with confirm:true"})
                gone = lib.delete(name)
                if gone:
                    self.svc.comp_touch(name)
                return _dump({"deleted": gone})
            if act == "attach":
                doc, _, _ = self._resolve(args, session_id)
                if doc is None:
                    return self._missing(args)
                if args.get("path"):
                    from pathlib import Path
                    p = Path(str(args["path"])).expanduser()
                    if not p.is_file():
                        return _dump({"error": f"no such file {str(p)[:120]}"})
                    data = p.read_bytes()
                elif "json" in args:
                    data = json.dumps(args["json"], separators=(",", ":")).encode("utf-8")
                elif isinstance(args.get("text"), str):
                    data = args["text"].encode("utf-8")
                else:
                    return _dump({"error": "attach needs path, json or text"})
                res = self.svc.comp_attach(doc["id"], str(args.get("id") or ""), str(args.get("name") or ""), data, by="h")
                return _dump({"board": doc["id"], **res})
            if act == "place":
                doc, _, _ = self._resolve(args, session_id)
                if doc is None:
                    return self._missing(args)
                comp = args.get("component") or name
                item: Dict[str, Any] = {"k": "comp", "comp": comp}
                for k in ("x", "y", "w", "h", "title", "cdata"):
                    if k in args:
                        item[k] = args[k]
                new, entry = self.svc.commit(doc["id"], [{"op": "add", "item": item}], by="h", note=f"added {comp}")
                return _dump({"board": doc["id"], "seq": new["seq"], "ids": entry.get("ids", {}),
                              "id": next((o.get("id") for o in entry.get("ops", []) if o.get("id")), None),
                              "warnings": self._comp_warnings(doc, [{"op": "add", "item": item}]) or None})
            return _dump({"error": "action is one of list, guide, get, create, update, diff, rollback, delete, attach, place"})
        except (comp_mod.CompError, comp_mod.CompNotFound, NotFound, engine.OpError) as e:
            return _dump({"error": str(e).strip("'\"")})

    def _presence(self, session_id: Optional[str], args: Dict[str, Any], act: str) -> None:
        try:
            doc, _, _ = self._resolve({"board": args.get("board")} if args.get("board") else {}, session_id)
            if doc is not None:
                self.svc.store.set_presence(doc["id"], act[:80])
        except Exception:
            pass

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
            embed_warnings = self._embed_warnings(doc, args.get("ops")) + self._comp_warnings(doc, args.get("ops"))
            report: Dict[str, Any] = {}
            new, entry = self.svc.commit(doc["id"], args.get("ops"), by="h", note=note, previews="wait", report=report)
            for op in entry.get("ops") or []:  # a board card makes the board it opens a sub-board of this one
                it = op.get("item") if op.get("op") == "put" else None
                if isinstance(it, dict) and it.get("k") == "board" and it.get("ref"):
                    self.svc.store.adopt(it["ref"], doc["id"])
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
            region = args.get("region") or args.get("rect")  # `rect` is what agents reach for first
            region = region if isinstance(region, dict) else None
            if only:
                only = _with_contents(doc, [str(i) for i in only])
            info = render_png(doc, self.svc.assets, self._render_path(doc["id"]), only, region, self._board_name)
            info["hint"] = ("Look at it with vision_analyze (a new file each call); world = region.x + px/scale. "
                            "Components show as a labelled box: the preview cannot run their HTML.")
            return _dump(info)
        except (NotFound, engine.OpError, RuntimeError, ValueError) as e:
            return _dump({"error": str(e)})

    def _render_path(self, bid: str):
        """A fresh file per render (vision tools refuse to reload the same path), keeping the last 6."""
        import time as _time
        folder = self.svc.root / "renders"
        folder.mkdir(parents=True, exist_ok=True)
        old = sorted(folder.glob(f"{bid}-*.png"), key=lambda p: p.stat().st_mtime)
        for p in old[:-5]:
            try:
                p.unlink()
            except OSError:
                pass
        return folder / f"{bid}-{int(_time.time() * 1000) % 100_000_000:08d}.png"

    def _board_name(self, bid: str) -> Optional[str]:
        try:
            d = self.svc.store.load(bid)
            n = sum(1 for v in (d.get("items") or {}).values() if v.get("k") != "line")
            return f"{d.get('name') or bid} · {n} items"
        except Exception:
            return None

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
                             "and write on it with board_apply (one batch per change set). " + BULK_HOOK + " " + COMP_HOOK + " " + TOUR_HOOK + " " + EMBED_HOOK)
            changes = summary.changes_since(doc, store.entries(bid), doc.get("seen", 0), limit=HOOK_LIMIT)
            if changes:
                parts.append(f'[Board "{doc["name"]}" ({bid}): the user changed it since your last turn: {changes}. '
                             "board_read shows the details.]")
                store.mark_seen(bid, doc["seq"])
            return {"context": "\n".join(parts)} if parts else None
        except Exception:
            return None
