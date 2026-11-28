"""Advisory lint for Hermes-authored (themed) HTML embeds.

Returns human-readable WARNINGS for the agent; it never rejects. It only runs on embeds that carry
``theme: true`` - a user's own pasted page renders exactly as authored and is not our business.
"""
from __future__ import annotations

import re
from typing import List

MAX_FIXED_PX = 400

_STYLE = re.compile(r"<style\b[^>]*>(.*?)</style>", re.I | re.S)
_RULE = re.compile(r"([^{}@]+)\{([^{}]*)\}")
_ROOT_SEL = re.compile(r"(^|[\s,>+~])(html|body|:root)(?=$|[\s,.:#\[>+~])", re.I)
_WIDTH = re.compile(r"(?<![\w-])(min-)?width\s*:\s*(\d+(?:\.\d+)?)px", re.I)
_BG = re.compile(r"(?<![\w-])background(?:-color)?\s*:\s*([^;}]+)", re.I)
_BODY_TAG = re.compile(r"<(html|body)\b([^>]*)>", re.I)
_STYLE_ATTR = re.compile(r"""style\s*=\s*("([^"]*)"|'([^']*)')""", re.I)
_SVG_TOKEN = re.compile(r"<(/?)svg\b([^>]*)>", re.I)
_TRANSPARENT = re.compile(r"^(transparent|none|inherit|initial|unset|revert)\b|rgba\([^)]*,\s*0(\.0+)?\s*\)|rgba?\([^)]*/\s*0(\.0+)?%?\s*\)", re.I)
_FONTS = re.compile(r"@import|@font-face|fonts\.(googleapis|gstatic)\.com|<link\b[^>]*stylesheet", re.I)


def _declarations(html: str):
    """Yield (what, declarations) for every rule or inline style that targets html/body/:root."""
    for block in _STYLE.findall(html):
        block = re.sub(r"/\*.*?\*/", "", block, flags=re.S)
        for sel, body in _RULE.findall(block):
            m = _ROOT_SEL.search(sel.strip())
            if m:
                yield m.group(2).lower(), body
    for tag, attrs in _BODY_TAG.findall(html):
        m = _STYLE_ATTR.search(attrs)
        if m:
            yield tag.lower(), m.group(2) or m.group(3) or ""
        w = re.search(r"""\bwidth\s*=\s*["']?(\d+)""", attrs, re.I)
        if w:
            yield tag.lower(), f"width:{w.group(1)}px"


def _root_svgs_without_viewbox(html: str) -> int:
    depth, bad = 0, 0
    for close, attrs in _SVG_TOKEN.findall(html):
        if close:
            depth = max(0, depth - 1)
            continue
        if depth == 0 and not re.search(r"\bviewBox\s*=", attrs, re.I):
            bad += 1
        if not attrs.rstrip().endswith("/"):
            depth += 1
    return bad


def lint_embed(html: str) -> List[str]:
    """Warnings for a themed embed. Empty list = nothing to say."""
    if not isinstance(html, str):
        return []
    out: List[str] = []
    wide, bg = set(), set()
    for what, body in _declarations(html):
        for mn, num in _WIDTH.findall(body):
            if float(num) > MAX_FIXED_PX:
                wide.add(what)
        for val in _BG.findall(body):
            if not _TRANSPARENT.search(val.strip()):
                bg.add(what)
    if wide:
        out.append(f"fixed width over {MAX_FIXED_PX}px on {'/'.join(sorted(wide))}: the card can be resized, so use "
                   "width:100%/max-width, flex, grid or container queries instead")
    if bg:
        out.append(f"opaque background on {'/'.join(sorted(bg))}: leave it transparent so the embed blends with the "
                   "board (use var(--card) for panels inside it)")
    n = _root_svgs_without_viewbox(html)
    if n:
        out.append(f"{n} root <svg> without viewBox: it will not scale with the card; add viewBox and "
                   "width:100%;height:auto (or height:100%)")
    if _FONTS.search(html):
        out.append("external fonts/stylesheets are blocked in the sandbox: use var(--font-sans) / var(--font-mono)")
    return out
