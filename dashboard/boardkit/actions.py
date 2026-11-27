"""Live-card actions: an owner-written allowlist, never anything a card can supply.

A button on a live card names an action **id**. The id must exist in the registry, which is
loaded from JSON files the machine owner writes in
``$HERMES_HOME/plugin-data/home-dashboard/live-actions/*.json`` (or registered in-process by
Python code with :func:`register`). Each entry fixes the command (argv list, run without a
shell) or the HTTP request, an argument schema, a timeout, and whether it is destructive.

Boards, agents and HTML embeds can only point at ids; the arguments a button carries are
checked against the schema and substituted as whole argv elements, so there is no shell and
nothing to inject. Destructive actions need ``confirm: true`` from the UI (it shows a dialog),
and every invocation, allowed or refused, is appended to ``live-actions.log.jsonl``.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

ID = re.compile(r"[a-z0-9][a-z0-9._-]{0,63}")
ARG = re.compile(r"[A-Za-z_][A-Za-z0-9_]{0,31}")
PLACEHOLDER = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]{0,31})\}")
# default for string args: no leading dash (no option injection), no spaces, no shell metas
SAFE_STRING = r"^[A-Za-z0-9_][A-Za-z0-9_.:@/+=,-]{0,127}$"
ARG_TYPES = ("string", "int", "number", "bool", "enum")
METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")
MAX_TIMEOUT = 600
OUT_TAIL = 2000
LOG_KEEP = 2000
BASE_PATH = "/usr/local/bin:/usr/bin:/bin"


class ActionError(ValueError):
    """Refused before anything ran (unknown id, disabled, bad args, missing confirm)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _text(v: Any, cap: int, field: str) -> str:
    if not isinstance(v, str):
        raise ValueError(f"{field} must be text")
    return v.strip()[:cap]


def _clean_args(raw: Any) -> Dict[str, Dict[str, Any]]:
    if raw is None:
        return {}
    if not isinstance(raw, dict) or len(raw) > 8:
        raise ValueError("args must be an object of up to 8 arguments")
    out: Dict[str, Dict[str, Any]] = {}
    for name, spec in raw.items():
        if not isinstance(name, str) or not ARG.fullmatch(name):
            raise ValueError(f"bad argument name {name!r}")
        if not isinstance(spec, dict):
            raise ValueError(f"argument {name}: schema must be an object")
        typ = spec.get("type", "string")
        if typ not in ARG_TYPES:
            raise ValueError(f"argument {name}: type is one of {', '.join(ARG_TYPES)}")
        s: Dict[str, Any] = {"type": typ, "required": spec.get("required", "default" not in spec) is True}
        if typ == "string":
            pat = spec.get("pattern", SAFE_STRING)
            try:
                re.compile(pat)
            except (re.error, TypeError):
                raise ValueError(f"argument {name}: bad pattern") from None
            s["pattern"] = pat
        if typ == "enum":
            ch = spec.get("choices")
            if not isinstance(ch, list) or not ch or not all(isinstance(c, (str, int)) and not isinstance(c, bool) for c in ch):
                raise ValueError(f"argument {name}: enum needs choices")
            s["choices"] = ch[:64]
        if typ in ("int", "number"):
            for k in ("min", "max"):
                if k in spec:
                    if isinstance(spec[k], bool) or not isinstance(spec[k], (int, float)):
                        raise ValueError(f"argument {name}: {k} must be a number")
                    s[k] = spec[k]
        if "default" in spec:
            s["default"] = check_arg(name, s, spec["default"])
        out[name] = s
    return out


def check_arg(name: str, spec: Dict[str, Any], value: Any) -> Any:
    typ = spec["type"]
    if typ == "bool":
        if not isinstance(value, bool):
            raise ActionError("bad_args", f"{name} must be true or false")
        return value
    if typ in ("int", "number"):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ActionError("bad_args", f"{name} must be a number")
        if typ == "int":
            if float(value) != int(value):
                raise ActionError("bad_args", f"{name} must be a whole number")
            value = int(value)
        if "min" in spec and value < spec["min"] or "max" in spec and value > spec["max"]:
            raise ActionError("bad_args", f"{name} is out of range")
        return value
    if typ == "enum":
        if value not in spec["choices"]:
            raise ActionError("bad_args", f"{name} is not one of the allowed values")
        return value
    if not isinstance(value, str) or not re.fullmatch(spec["pattern"], value) or "\x00" in value:
        raise ActionError("bad_args", f"{name} does not match its pattern")
    return value


def _placeholders(text: str, args: Dict[str, Any], where: str) -> None:
    for name in PLACEHOLDER.findall(text):
        if name not in args:
            raise ValueError(f"{where} uses {{{name}}} but args has no {name}")


def clean_action(raw: Any, source: str = "") -> Dict[str, Any]:
    """Validate one registry entry. Raises ValueError with a readable message."""
    if not isinstance(raw, dict):
        raise ValueError("an action is an object")
    aid = raw.get("id")
    if not isinstance(aid, str) or not ID.fullmatch(aid):
        raise ValueError("id must be lowercase a-z 0-9 . _ - (up to 64)")
    args = _clean_args(raw.get("args"))
    a: Dict[str, Any] = {
        "id": aid,
        "label": _text(raw.get("label") or aid, 40, "label"),
        "description": _text(raw.get("description") or "", 300, "description"),
        "destructive": raw.get("destructive") is True,
        "enabled": raw.get("enabled", True) is not False,
        "timeout": int(max(1, min(MAX_TIMEOUT, float(raw.get("timeout", 30))))),
        "args": args,
        "source": source,
    }
    if raw.get("confirm") is not None:
        a["confirm"] = _text(raw["confirm"], 300, "confirm")
    if raw.get("note") is not None:
        a["note"] = _text(raw["note"], 300, "note")
    if raw.get("icon") is not None:
        icon = raw["icon"]
        if not isinstance(icon, str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,31}", icon):
            raise ValueError("icon must be a short lowercase name")
        a["icon"] = icon
    has_cmd, has_http = raw.get("command") is not None, raw.get("http") is not None
    if has_cmd == has_http:
        raise ValueError("give exactly one of command (argv list) or http")
    if has_cmd:
        cmd = raw["command"]
        if not isinstance(cmd, list) or not cmd or len(cmd) > 64 or not all(isinstance(x, str) for x in cmd):
            raise ValueError("command must be a list of strings (argv), not a shell line")
        if not os.path.isabs(cmd[0]) or PLACEHOLDER.search(cmd[0]):
            raise ValueError("command[0] must be an absolute path with no placeholders")
        for x in cmd[1:]:
            _placeholders(x, args, "command")
        a["command"] = list(cmd)
        if raw.get("cwd") is not None:
            cwd = _text(raw["cwd"], 1024, "cwd")
            if not os.path.isabs(cwd):
                raise ValueError("cwd must be absolute")
            a["cwd"] = cwd
        env = raw.get("env") or {}
        if not isinstance(env, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in env.items()):
            raise ValueError("env must map names to text")
        a["env"] = dict(env)
    else:
        h = raw["http"]
        if not isinstance(h, dict):
            raise ValueError("http must be an object {method, url, headers?, json?}")
        method = str(h.get("method", "POST")).upper()
        if method not in METHODS:
            raise ValueError(f"http.method is one of {', '.join(METHODS)}")
        url = h.get("url")
        if not isinstance(url, str) or not re.match(r"https?://", url, re.I):
            raise ValueError("http.url must be http(s)")
        _placeholders(url, args, "http.url")
        headers = h.get("headers") or {}
        if not isinstance(headers, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in headers.items()):
            raise ValueError("http.headers must map names to text")
        body = h.get("json")
        if body is not None:
            _placeholders(json.dumps(body), args, "http.json")
        a["http"] = {"method": method, "url": url, "headers": dict(headers), "json": body}
    return a


def public(a: Dict[str, Any]) -> Dict[str, Any]:
    """What the UI and the agent may see: never the command, URL, headers or env."""
    out = {k: a[k] for k in ("id", "label", "description", "destructive", "enabled", "timeout") if k in a}
    for k in ("confirm", "note", "icon"):
        if k in a:
            out[k] = a[k]
    out["kind"] = "command" if "command" in a else "http" if "http" in a else "python"
    out["args"] = {n: {k: v for k, v in s.items() if k != "pattern"} for n, s in a["args"].items()}
    return out


# ── registry ────────────────────────────────────────────────────────────

_runtime: Dict[str, Tuple[Dict[str, Any], Callable[[Dict[str, Any]], Any]]] = {}
_runtime_lock = threading.Lock()


def register(spec: Dict[str, Any], handler: Callable[[Dict[str, Any]], Any]) -> None:
    """Register an in-process action from Python code (it runs in the process that serves the
    board API). ``spec`` is a registry entry without command/http; ``handler(args)`` returns a
    short text or dict and raises to fail."""
    raw = dict(spec)
    raw.pop("command", None)
    raw.pop("http", None)
    raw["command"] = ["/bin/true"]  # validated shape; never executed for python actions
    a = clean_action(raw, source="python")
    a.pop("command", None)
    a.pop("env", None)
    a.pop("cwd", None)
    with _runtime_lock:
        _runtime[a["id"]] = (a, handler)


def unregister(aid: str) -> None:
    with _runtime_lock:
        _runtime.pop(aid, None)


class Registry:
    def __init__(self, root: Path):
        """``root`` is the plugin data dir (``…/plugin-data/home-dashboard``)."""
        self.root = Path(root)
        self.dir = self.root / "live-actions"
        self.log_path = self.root / "live-actions.log.jsonl"
        self._busy: Dict[str, threading.Lock] = {}
        self._busy_lock = threading.Lock()

    def load(self) -> Tuple[Dict[str, Dict[str, Any]], List[str]]:
        """All valid actions by id, plus readable problems for the invalid ones."""
        actions: Dict[str, Dict[str, Any]] = {}
        problems: List[str] = []
        files = sorted(self.dir.glob("*.json")) if self.dir.is_dir() else []
        for path in files:
            try:
                data = json.loads(path.read_text("utf-8"))
            except (OSError, ValueError) as e:
                problems.append(f"{path.name}: {e}")
                continue
            entries = data.get("actions") if isinstance(data, dict) else data
            if not isinstance(entries, list):
                problems.append(f"{path.name}: expected {{\"actions\": [...]}}")
                continue
            for i, raw in enumerate(entries):
                try:
                    a = clean_action(raw, source=path.name)
                except (ValueError, TypeError) as e:
                    problems.append(f"{path.name}[{i}]: {e}")
                    continue
                if a["id"] in actions:
                    problems.append(f"{path.name}[{i}]: duplicate id {a['id']}")
                    continue
                actions[a["id"]] = a
        with _runtime_lock:
            for aid, (a, _) in _runtime.items():
                actions.setdefault(aid, a)
        return actions, problems

    def list_public(self) -> Dict[str, Any]:
        actions, problems = self.load()
        return {"actions": [public(a) for a in actions.values()], "problems": problems,
                "dir": str(self.dir)}

    # ── invocation ──────────────────────────────────────────────────────
    def resolve_args(self, a: Dict[str, Any], given: Dict[str, Any]) -> Dict[str, Any]:
        schema = a["args"]
        for k in given:
            if k not in schema:
                raise ActionError("bad_args", f"{a['id']} takes no argument {k}")
        out: Dict[str, Any] = {}
        for name, spec in schema.items():
            if name in given and given[name] is not None:
                out[name] = check_arg(name, spec, given[name])
            elif "default" in spec:
                out[name] = spec["default"]
            elif spec.get("required"):
                raise ActionError("bad_args", f"{a['id']} needs {name}")
        return out

    def invoke(self, aid: str, given: Optional[Dict[str, Any]] = None, *, confirm: bool = False,
               who: str = "dashboard", board: str = "", card: str = "") -> Dict[str, Any]:
        """Run one action. Returns ``{ok, code, out, ms}``; raises ActionError when refused.
        Both outcomes are logged."""
        started = time.time()
        entry: Dict[str, Any] = {"t": round(started, 3), "action": str(aid)[:64], "who": who[:120],
                                 "board": board, "card": card}
        try:
            actions, _ = self.load()
            a = actions.get(aid) if isinstance(aid, str) else None
            if a is None:
                raise ActionError("unknown", f"no registered action {str(aid)[:64]!r}")
            if not a["enabled"]:
                raise ActionError("disabled", f"{aid} is registered but disabled")
            if a["destructive"] and confirm is not True:
                raise ActionError("confirm", f"{aid} is destructive and needs confirmation")
            args = self.resolve_args(a, given or {})
            entry["args"] = args
        except ActionError as e:
            entry.update(ok=False, refused=e.code, out=str(e))
            self._log(entry)
            raise
        lock = self._lock_for(aid)
        if not lock.acquire(blocking=False):
            entry.update(ok=False, refused="busy", out="already running")
            self._log(entry)
            raise ActionError("busy", f"{aid} is already running")
        try:
            ok, code, out = self._run(a, args)
        finally:
            lock.release()
        ms = int((time.time() - started) * 1000)
        entry.update(ok=ok, code=code, out=out[-OUT_TAIL:], ms=ms)
        self._log(entry)
        return {"ok": ok, "code": code, "out": out[-300:].strip(), "ms": ms, "action": aid}

    def _lock_for(self, aid: str) -> threading.Lock:
        with self._busy_lock:
            return self._busy.setdefault(aid, threading.Lock())

    def _run(self, a: Dict[str, Any], args: Dict[str, Any]) -> Tuple[bool, Any, str]:
        if a.get("source") == "python":
            with _runtime_lock:
                handler = _runtime.get(a["id"], (None, None))[1]
            if handler is None:
                return False, "gone", "handler is no longer registered"
            try:
                res = handler(dict(args))
            except Exception as e:  # the handler's failure is the action's result
                return False, "error", f"{type(e).__name__}: {e}"[:OUT_TAIL]
            return True, 0, res if isinstance(res, str) else json.dumps(res, ensure_ascii=False)[:OUT_TAIL]
        sub = {k: ("true" if v is True else "false" if v is False else str(v)) for k, v in args.items()}
        if "command" in a:
            argv = [a["command"][0]] + [PLACEHOLDER.sub(lambda m: sub[m.group(1)], x) for x in a["command"][1:]]
            env = {"PATH": BASE_PATH, "HOME": os.environ.get("HOME", "/"), "LANG": "C.UTF-8", **a.get("env", {})}
            try:
                p = subprocess.run(argv, shell=False, cwd=a.get("cwd"), env=env, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=a["timeout"])
            except subprocess.TimeoutExpired as e:
                tail = (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else ""
                return False, "timeout", (tail + f"\n(timed out after {a['timeout']} s)").strip()
            except OSError as e:
                return False, "oserror", str(e)
            out = p.stdout.decode("utf-8", "replace") if p.stdout else ""
            return p.returncode == 0, p.returncode, out
        h = a["http"]
        url = PLACEHOLDER.sub(lambda m: urllib.parse.quote(sub[m.group(1)], safe=""), h["url"])
        body = None
        headers = dict(h["headers"])
        if h.get("json") is not None:
            body = json.dumps(_fill_json(h["json"], args)).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")
        req = urllib.request.Request(url, data=body, method=h["method"], headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=a["timeout"]) as resp:
                text = resp.read(OUT_TAIL * 2).decode("utf-8", "replace")
                return 200 <= resp.status < 300, resp.status, text
        except urllib.error.HTTPError as e:
            return False, e.code, (e.read(OUT_TAIL) or b"").decode("utf-8", "replace")
        except (urllib.error.URLError, OSError) as e:
            return False, "connect", str(e)[:300]

    def _log(self, entry: Dict[str, Any]) -> None:
        try:
            self.root.mkdir(parents=True, exist_ok=True)
            with open(self.log_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")
            if os.path.getsize(self.log_path) > 4 * 1024 * 1024:
                lines = self.log_path.read_text("utf-8").splitlines()[-LOG_KEEP:]
                tmp = self.log_path.with_name(f".{self.log_path.name}.{os.getpid()}.tmp")
                tmp.write_text("\n".join(lines) + "\n", encoding="utf-8")
                os.replace(tmp, self.log_path)
        except OSError:
            pass

    def history(self, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            lines = self.log_path.read_text("utf-8").splitlines()[-max(1, min(500, limit)):]
        except FileNotFoundError:
            return []
        out = []
        for line in lines:
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
        return out


def _fill_json(value: Any, args: Dict[str, Any]) -> Any:
    """``"{name}"`` alone becomes the typed value; inside a longer string it is text."""
    if isinstance(value, str):
        m = PLACEHOLDER.fullmatch(value)
        if m:
            return args.get(m.group(1))
        return PLACEHOLDER.sub(lambda mm: str(args.get(mm.group(1), "")), value)
    if isinstance(value, list):
        return [_fill_json(v, args) for v in value]
    if isinstance(value, dict):
        return {k: _fill_json(v, args) for k, v in value.items()}
    return value
