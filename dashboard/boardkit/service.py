"""High-level board operations shared by the REST API and the agent tools."""
from __future__ import annotations

import concurrent.futures
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from . import actions as actions_mod
from . import assets as assets_mod
from . import components as comp_mod, engine, ids, importer as importer_mod, links, live as live_mod, posters as posters_mod, store as store_mod, urls
from .fetch import Fetcher

PREVIEW_BUDGET_S = 9.0


class BoardService:
    def __init__(self, root: Path, fetcher: Optional[Fetcher] = None):
        self.root = Path(root)
        self.store = store_mod.BoardStore(self.root)
        self.assets = assets_mod.AssetStore(self.root / "assets")
        self.link_cache = self.root / "links"
        self.fetcher = fetcher or Fetcher()
        self.posters = posters_mod.Posters(self.root, self.assets)
        self.importer = importer_mod.Importer(self.assets, self.posters)
        # the allowlist sits beside the boards folder, in the plugin data dir
        self.actions = actions_mod.Registry(self.root.parent)
        # the user's component library (HTML/JS components Hermes writes), beside the boards folder
        self.components = comp_mod.Library(self.root.parent / "components")

    # ── custom components ────────────────────────────────────────────────
    def comp_update(self, bid: str, iid: str, data: Any = None, push: Any = None, keep: Any = None,
                    replace: bool = False, by: str = "s") -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Patch a component card's data bag (scripts, cron jobs). Same contract as live_update."""
        op: Dict[str, Any] = {"op": "comp", "id": iid}
        for key, val in (("data", data), ("push", push), ("keep", keep)):
            if val is not None:
                op[key] = val
        if replace:
            op["replace"] = True
        return self.store.commit(bid, [op], by=by)

    def _comp_item(self, bid: str, iid: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        doc = self.store.load(bid)
        item = doc["items"].get(iid) if ids.valid_item_id(iid) else None
        if not item or item.get("k") != "comp":
            raise store_mod.NotFound("no such component card")
        return doc, item

    def comp_attach(self, bid: str, iid: str, name: str, data: bytes, by: str = "s") -> Dict[str, Any]:
        """Attach (or replace) a data file on a component card; the card reads it with hb.asset(name)."""
        _, item = self._comp_item(bid, iid)
        try:
            n = self.components.put_data_file(bid, iid, name, data)
        except comp_mod.CompError as e:
            raise engine.OpError(str(e)) from None
        files = dict(item.get("files") or {})
        files[name] = {"n": n, "r": int(files.get(name, {}).get("r", 0)) + 1}
        self.store.commit(bid, [{"op": "set", "id": iid, "p": {"files": files}}], by=by)
        return {"name": name, "bytes": n, "rev": files[name]["r"]}

    def comp_file(self, bid: str, iid: str, name: str, off: int = 0, n: int = 4 * 1024 * 1024) -> Tuple[int, bytes]:
        self._comp_item(bid, iid)
        try:
            return self.components.read_data_file(bid, iid, name, off, n)
        except comp_mod.CompNotFound:
            raise store_mod.NotFound("no such data file") from None

    def comp_action(self, bid: str, iid: str, action: str, args: Optional[Dict[str, Any]] = None,
                    confirm: bool = False, who: str = "dashboard") -> Dict[str, Any]:
        """A component pressed an action. Only ids the card lists (and the owner registered) run; the
        registry validates the args against the action's own schema."""
        _, item = self._comp_item(bid, iid)
        if not isinstance(action, str) or action not in (item.get("actions") or []):
            raise actions_mod.ActionError("not_on_card", f"this card is not allowed to run {str(action)[:64]!r}")
        title = (item.get("title") or item.get("comp") or "")[:60]
        return self.actions.invoke(action, args if isinstance(args, dict) else {}, confirm=confirm, who=who,
                                   board=bid, card=f"{iid} {title}".strip())

    def comp_touch(self, name: str) -> int:
        """The library changed: stamp unpinned instances so open boards reload them."""
        n = 0
        for row in self.store.list():
            try:
                doc = self.store.load(row["id"])
            except store_mod.NotFound:
                continue
            ops = [{"op": "set", "id": i, "p": {"at": max(int(__import__("time").time()), int(it.get("at") or 0) + 1)}}
                   for i, it in doc["items"].items() if it.get("k") == "comp" and it.get("comp") == name and not it.get("ver")]
            if ops:
                try:
                    self.store.commit(row["id"], ops, by="s")
                    n += len(ops)
                except (engine.OpError, store_mod.NotFound):
                    pass
        return n

    def comp_save(self, name: str, by: str = "h", **kw: Any) -> Dict[str, Any]:
        try:
            res = self.components.save(name, by=by, **kw)
        except comp_mod.CompError as e:
            raise engine.OpError(str(e)) from None
        if not res.get("noop"):
            self.comp_touch(name)
        return res

    # ── live cards ───────────────────────────────────────────────────────
    def live_update(self, bid: str, iid: str, data: Any = None, push: Any = None, keep: Any = None,
                    replace: bool = False, by: str = "s") -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Patch a live card's data. Scripts and the REST route write as ``s`` (system), so the
        change never counts as the user's edit nor lands in anyone's undo stack."""
        op: Dict[str, Any] = {"op": "live", "id": iid}
        if data is not None:
            op["data"] = data
        if push is not None:
            op["push"] = push
        if keep is not None:
            op["keep"] = keep
        if replace:
            op["replace"] = True
        return self.store.commit(bid, [op], by=by)

    def live_action(self, bid: str, iid: str, action: str, index: Optional[int] = None,
                    confirm: bool = False, who: str = "dashboard") -> Dict[str, Any]:
        """Press a button: the action id must be on that card, and its args come from the card
        (never from the request)."""
        doc = self.store.load(bid)
        item = doc["items"].get(iid) if ids.valid_item_id(iid) else None
        if not item or item.get("k") != "live":
            raise store_mod.NotFound("no such live card")
        refs = live_mod.action_refs(item)
        ref = None
        if index is not None and 0 <= index < len(refs) and refs[index].get("action") == action:
            ref = refs[index]
        if ref is None:
            ref = next((r for r in refs if r.get("action") == action), None)
        if ref is None:
            raise actions_mod.ActionError("not_on_card", f"this card has no {str(action)[:64]!r} button")
        args = live_mod.bound_args(ref, item.get("data") or {})
        title = (item.get("title") or "")[:60]
        return self.actions.invoke(action, args, confirm=confirm, who=who, board=bid,
                                   card=f"{iid} {title}".strip())

    # ── video ────────────────────────────────────────────────────────────
    def poster(self, src: Optional[str] = None, asset: Optional[str] = None, generate: bool = True) -> Dict[str, Any]:
        return self.posters.get(src=src, asset=asset, generate=generate)

    def upload_video_chunk(self, upload: str, index: int, total: int, data: str) -> Dict[str, Any]:
        aid = self.assets.put_video_chunk(upload, index, total, data)
        if aid is None:
            return {"next": index + 1}
        out: Dict[str, Any] = {"asset": aid}
        out.update({k: v for k, v in self.posters.get(asset=aid).items() if k in ("img", "dur", "iw", "ih", "st")})
        return out

    # ── op preparation (runs before the engine) ──────────────────────────
    def prepare(self, ops: Any, by: str = "u", report: Optional[Dict[str, Any]] = None) -> Tuple[Any, List[Tuple[str, str]]]:
        """Turn agent/user conveniences into plain fields: embed ``html`` -> asset, a link
        ``url`` classified into image / video / link, and mark URLs that need a preview.
        Returns the ops and the list of ``(ref_or_id, url)`` to preview after commit."""
        if not isinstance(ops, list):
            return ops, []
        out: List[Any] = []
        todo: List[Tuple[str, str]] = []
        for i, op in enumerate(ops):
            if not isinstance(op, dict):
                out.append(op)
                continue
            if op.get("op") == "import":
                out.append(self._import(op, i, by, report))
                continue
            op = dict(op)
            item = op.get("item") if op.get("op") == "add" else op.get("p") if op.get("op") == "set" else None
            if isinstance(item, dict):
                item = dict(item)
                if "html" in item:
                    html = item.pop("html")
                    try:
                        item["asset"] = self.assets.put_html(html)
                    except assets_mod.AssetError as e:
                        raise engine.OpError(f"op {i}: {e}") from None
                if op.get("op") == "add":
                    kind = item.get("k")
                    url = item.get("url") if kind in ("link", "image") else item.get("src") if kind == "video" else None
                    if isinstance(url, str):
                        cls = urls.classify(url)
                        if cls is None:
                            raise engine.OpError(f"op {i}: url must be http(s)")
                        if kind == "link" and cls["kind"] == "image":
                            item["k"] = kind = "image"
                        elif kind == "link" and cls["kind"] == "file-video":
                            item = {**{k: v for k, v in item.items() if k != "url"}, "k": "video", "src": url}
                            kind = "video"
                        elif kind == "link" and cls["kind"] == "video":
                            video = {"p": cls["p"], "id": cls["id"]}
                            if cls.get("vert"):
                                video["vert"] = True
                            item.setdefault("video", video)
                        needs = (kind == "link" and not item.get("title")) or (kind == "image" and not item.get("asset"))
                        if needs:
                            if kind == "link":
                                item["st"] = "wait"
                            ref = op.get("ref") or f"$p{i}"
                            op["ref"] = ref
                            todo.append((ref, url))
                self.fill_dims(item, replace=op.get("op") == "set")
                if op.get("op") == "add":
                    op["item"] = item
                else:
                    op["p"] = item
            out.append(op)
        return out, todo

    def fill_dims(self, item: Dict[str, Any], replace: bool = False) -> None:
        """Stamp the intrinsic ``iw``/``ih`` of the item's main picture (image asset, video
        poster, link thumbnail) so the card gets its final shape on first paint. ``replace``:
        a patch that swaps the picture, whose old dims no longer apply."""
        if item.get("iw") and item.get("ih"):
            return
        kind = item.get("k")
        if replace and not ("asset" in item or "img" in item):
            return
        if not replace and kind not in ("image", "video", "link"):
            return
        size = None
        try:
            asset = item.get("asset")
            if isinstance(asset, str) and asset.rsplit(".", 1)[-1] in assets_mod.VIDEO_EXT:
                rec = self.posters.get(asset=asset)
                if rec.get("iw") and rec.get("ih"):
                    size = (rec["iw"], rec["ih"])
            elif isinstance(asset, str) and not asset.endswith(".html"):
                size = assets_mod.image_size(self.assets.get(asset)[1])
            if size is None and isinstance(item.get("img"), str):
                size = assets_mod.image_size(self.assets.get(item["img"])[1])
        except (assets_mod.AssetError, OSError, ValueError, KeyError):
            size = None
        if size:
            item["iw"], item["ih"] = int(size[0]), int(size[1])

    def _import(self, op: Dict[str, Any], i: int, by: str, report: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """``{op:'import', paths, ...}`` -> a ``place`` op with copied assets. Agent-only: reading
        files off the machine is what the agent tool is for; the REST routes never get it."""
        if by != "h":
            raise engine.OpError(f"op {i} (import): only Hermes can import files (use board_apply)")
        try:
            place, rows, skipped = self.importer.run(op, i)
        except importer_mod.ImportRefused as e:
            raise engine.OpError(f"op {i} (import): {e}") from None
        if report is not None:
            report.setdefault("imported", []).extend(rows)
            if skipped:
                report.setdefault("skipped", []).extend(skipped)
        return place

    def commit(self, bid: str, ops: Any, by: str = "u", note: Optional[str] = None,
               previews: str = "background", report: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        prepared, todo = self.prepare(ops, by=by, report=report)
        doc, entry = self.store.commit(bid, prepared, by=by, note=note)
        refs = entry.get("ids") or {}
        pending = [(refs.get(r, r), url) for r, url in todo if ids.valid_item_id(refs.get(r, r))]
        if pending:
            if previews == "wait":
                self.fill_previews(bid, pending, budget=PREVIEW_BUDGET_S)
                doc = self.store.load(bid)
            elif previews == "background":
                threading.Thread(target=self.fill_previews, args=(bid, pending), daemon=True,
                                 name="board-link-preview").start()
        return doc, entry

    # ── link previews ────────────────────────────────────────────────────
    def preview(self, url: str) -> Dict[str, Any]:
        return links.preview(url, self.fetcher, self.assets, self.link_cache)

    def fill_previews(self, bid: str, pending: Iterable[Tuple[str, str]], budget: float = 20.0) -> None:
        pending = list(pending)
        if not pending:
            return
        results: Dict[str, Dict[str, Any]] = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(pending))) as pool:
            futures = {pool.submit(self.preview, url): iid for iid, url in pending}
            try:
                for fut in concurrent.futures.as_completed(futures, timeout=budget):
                    try:
                        results[futures[fut]] = fut.result()
                    except Exception:
                        results[futures[fut]] = {"st": "fail"}
            except concurrent.futures.TimeoutError:
                pass
        try:
            doc = self.store.load(bid)
        except store_mod.NotFound:
            return
        ops = []
        for iid, res in results.items():
            item = doc["items"].get(iid)
            if not item:
                continue
            if item["k"] == "image":
                p = {k: res[k] for k in ("asset", "iw", "ih") if k in res}
                if res.get("kind") != "image" or not p:
                    continue
            elif item["k"] == "link":
                p = {k: res[k] for k in ("title", "desc", "site", "icon", "img", "video", "iw", "ih") if k in res}
                p["st"] = res.get("st", "fail")
            else:
                continue
            ops.append({"op": "set", "id": iid, "p": p})
        if ops:
            try:
                self.store.commit(bid, ops, by="s")
            except (engine.OpError, store_mod.NotFound):
                pass

    def refresh_waiting(self, bid: str) -> int:
        """Re-run previews for link/image items still waiting (e.g. the process that started
        them exited). Returns how many were started."""
        doc = self.store.load(bid)
        pending = [(iid, it["url"]) for iid, it in doc["items"].items()
                   if it.get("url") and ((it["k"] == "link" and it.get("st") == "wait") or
                                         (it["k"] == "image" and not it.get("asset")))]
        if pending:
            threading.Thread(target=self.fill_previews, args=(bid, pending[:12]), daemon=True).start()
        return len(pending)
