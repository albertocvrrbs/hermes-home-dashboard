"""Identifiers: compact item ids, random board ids, content-addressed asset names."""
from __future__ import annotations

import re
import secrets
from typing import Any

_BID = re.compile(r"[a-z0-9]{8}")
_AID = re.compile(r"[a-f0-9]{16}\.(png|jpg|gif|webp|ico|html)")
_ITEM = re.compile(r"[a-z0-9]{1,8}")
_REF = re.compile(r"\$[A-Za-z0-9_]{1,16}")
_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"


def item_id(n: int) -> str:
    """Base36 of a per-board counter: 0 -> "0", 35 -> "z", 36 -> "10"."""
    if n < 0:
        raise ValueError("negative id")
    out = ""
    while True:
        n, r = divmod(n, 36)
        out = _DIGITS[r] + out
        if n == 0:
            return out


def item_index(iid: str) -> int:
    return int(iid, 36)


def new_bid() -> str:
    return "".join(secrets.choice(_DIGITS) for _ in range(8))


def valid_bid(value: Any) -> bool:
    return isinstance(value, str) and _BID.fullmatch(value) is not None


def valid_aid(value: Any) -> bool:
    return isinstance(value, str) and _AID.fullmatch(value) is not None


def valid_item_id(value: Any) -> bool:
    return isinstance(value, str) and _ITEM.fullmatch(value) is not None


def is_ref(value: Any) -> bool:
    return isinstance(value, str) and _REF.fullmatch(value) is not None
