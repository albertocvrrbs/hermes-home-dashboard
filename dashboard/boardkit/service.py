"""High-level board operations shared by the REST API and the agent tools."""
from __future__ import annotations

import concurrent.futures
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from . import actions as actions_mod
from . import assets as assets_mod
from . import engine, ids, links, live as live_mod, posters as posters_mod, store as store_mod, urls
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
        # the allowlist sits beside the boards folder, in the plugin data dir
        self.actions = actions_mod.Registry(self.root.parent)

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
    def prepare(self, ops: Any) -> Tuple[Any, List[Tuple[str, str]]]:
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
                if op.get("op") == "add":
                    op["item"] = item
                else:
                    op["p"] = item
            out.append(op)
        return out, todo

    def commit(self, bid: str, ops: Any, by: str = "u", note: Optional[str] = None,
               previews: str = "background") -> Tuple[Dict[str, Any], Dict[str, Any]]:
        prepared, todo = self.prepare(ops)
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
                p = {k: res[k] for k in ("title", "desc", "site", "icon", "img", "video") if k in res}
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
