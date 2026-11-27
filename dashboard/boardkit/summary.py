"""Compact text views of a board for the agent: the outline and the change summary."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

_POS_KEYS = ("x", "y", "w", "h", "in", "kids")


def _clip(text: Any, n: int) -> str:
    s = " / ".join(str(text or "").split("\n")).strip()
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


def label(item: Dict[str, Any], n: int = 60) -> str:
    for key in ("title", "text", "cap", "url", "src", "label", "note"):
        if item.get(key):
            return _clip(item[key], n)
    return ""


def item_line(iid: str, it: Dict[str, Any], text_len: int = 80) -> str:
    k = it.get("k", "?")
    parts = [f"{iid} {k}{'*' if it.get('by') == 'h' else ''}"]
    if k == "line":
        ends = []
        for end in ("a", "b"):
            v = it.get(end)
            ends.append(f"[{v[0]},{v[1]}]" if isinstance(v, list) else str(v))
        parts.append("->".join(ends))
        if it.get("label"):
            parts.append(f'"{_clip(it["label"], 40)}"')
        return " ".join(parts)
    if it.get("in"):
        parts.append(f"in={it['in']}")
    elif "x" in it:
        parts.append(f"@{it.get('x')},{it.get('y')}")
    if "w" in it and "h" in it:
        parts.append(f"{it['w']}x{it['h']}")
    elif "w" in it:
        parts.append(f"{it['w']}w")
    if k == "box" and it.get("num"):
        parts.append(str(it["num"]))
    if it.get("title"):
        parts.append(f'"{_clip(it["title"], 60)}"')
    if k == "card" and it.get("text"):
        parts.append(_clip(it["text"], text_len))
    elif k == "text" and it.get("text"):
        parts.append(f'{it.get("size", "p")}:"{_clip(it["text"], text_len)}"')
    elif k == "box" and it.get("sub"):
        parts.append(f"({_clip(it['sub'], 40)})")
    elif k == "todo":
        items = it.get("items") or []
        done = sum(1 for x in items if x.get("done"))
        shown = "; ".join(f"[{'x' if x.get('done') else ' '}] {_clip(x.get('t'), 40)}" for x in items[:12])
        more = f"; +{len(items) - 12}" if len(items) > 12 else ""
        parts.append(f"{done}/{len(items)}: {shown}{more}")
    elif k == "col":
        parts.append(f"kids={len(it.get('kids') or [])}")
    elif k == "link":
        if it.get("url"):
            parts.append(f"<{_clip(it['url'], 90)}>")
        if it.get("video"):
            parts.append(f"video:{it['video'].get('p')}")
        if it.get("st") == "wait":
            parts.append("(preview loading)")
    elif k == "image":
        parts.append(f"image{' ' + _clip(it.get('cap'), 50) if it.get('cap') else ''}")
    elif k == "embed":
        parts.append("html")
    elif k == "video" and it.get("src"):
        parts.append(f"<{_clip(it['src'], 90)}>")
    elif k == "board":
        parts.append(f"board={it.get('ref')}")
    elif k == "frame" and it.get("note"):
        parts.append(_clip(it["note"], 60))
    elif k == "draw":
        pts = (it.get("d") or "").count(" ") + 1 if it.get("d") else 0
        parts.append(f"sketch {pts}pts")
    if it.get("tags"):
        parts.append(" ".join(f"#{t}" for t in it["tags"]))
    if it.get("due"):
        parts.append(f"due:{it['due']}")
    return " ".join(parts)


def header(doc: Dict[str, Any]) -> str:
    items = doc.get("items") or {}
    sess = "session linked" if doc.get("session") else "no session"
    return (f'board {doc["id"]} "{doc.get("name", "")}" seq {doc.get("seq", 0)} · '
            f"{len(items)} items · {sess} · *=yours")


def outline(doc: Dict[str, Any], only: Optional[Iterable[str]] = None, limit: int = 12_000) -> str:
    items = doc.get("items") or {}
    keys = list(only) if only is not None else sorted(items, key=lambda i: (len(i), i))
    lines = [header(doc)]
    size = len(lines[0])
    text_len = 80 if len(keys) < 150 else 40
    for n, iid in enumerate(keys):
        it = items.get(iid)
        if it is None:
            continue
        line = item_line(iid, it, text_len)
        if size + len(line) + 1 > limit:
            lines.append(f"… {len(keys) - n} more items (board_read with full:true shows them in pages of {limit} chars)")
            break
        lines.append(line)
        size += len(line) + 1
    return "\n".join(lines)


def _kind_of(entry: Dict[str, Any], iid: str) -> str:
    for op in entry.get("inv") or []:
        if op.get("op") == "put" and op.get("id") == iid:
            return op.get("item", {}).get("k", "item")
    return "item"


def changes_since(doc: Dict[str, Any], entries: List[Dict[str, Any]], seen: int,
                  limit: int = 1500, by: str = "u") -> str:
    """One line per item the user touched after ``seen``, oldest first. Empty when nothing."""
    items = doc.get("items") or {}
    order: List[str] = []
    state: Dict[str, Dict[str, Any]] = {}
    renamed = None
    for entry in entries:
        if entry.get("s", 0) <= seen or entry.get("by") != by:
            continue
        for op in entry.get("ops") or []:
            kind = op.get("op")
            if kind == "board":
                renamed = (op.get("p") or {}).get("name", renamed)
                continue
            iid = op.get("id")
            if not isinstance(iid, str):
                continue
            st = state.get(iid)
            if st is None:
                st = state[iid] = {"added": False, "deleted": False, "fields": set(), "kind": None}
                order.append(iid)
            if kind == "put":
                st["added"] = True
                st["deleted"] = False
                st["kind"] = (op.get("item") or {}).get("k")
            elif kind == "set":
                st["fields"].update((op.get("p") or {}).keys())
            elif kind == "del":
                st["deleted"] = True
                st["kind"] = st["kind"] or _kind_of(entry, iid)
    lines: List[str] = []
    for iid in order:
        st = state[iid]
        it = items.get(iid)
        if st["deleted"]:
            if not st["added"]:
                lines.append(f"- {st['kind'] or 'item'} {iid} deleted")
            continue
        if it is None:
            continue
        if st["added"]:
            lab = label(it)
            lines.append(f"+ {it['k']} {iid}" + (f' "{lab}"' if lab else "") + (f" in {it['in']}" if it.get("in") else ""))
            continue
        fields = st["fields"]
        moved = fields & {"x", "y"}
        other = sorted(fields - set(_POS_KEYS))
        bits = []
        if "in" in fields:
            bits.append(f"moved into column {it['in']}" if it.get("in") else "moved out of its column")
        elif moved:
            bits.append("moved")
        if fields & {"w", "h"}:
            bits.append("resized")
        if "kids" in fields:
            bits.append("reordered")
        if other:
            if it.get("k") == "todo" and "items" in other:
                todo = it.get("items") or []
                bits.append(f"checklist now {sum(1 for x in todo if x.get('done'))}/{len(todo)} done")
                other = [f for f in other if f != "items"]
            if other:
                lab = label(it, 40)
                bits.append("edited " + ",".join(other) + (f' "{lab}"' if lab else ""))
        lines.append(f"~ {iid} " + ", ".join(bits))
    if renamed is not None:
        lines.insert(0, f'~ board renamed "{renamed}"')
    if not lines:
        return ""
    out: List[str] = []
    size = 0
    for n, line in enumerate(lines):
        if size + len(line) + 2 > limit:
            out.append(f"… and {len(lines) - n} more")
            break
        out.append(line)
        size += len(line) + 2
    return "; ".join(out)
