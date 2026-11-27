#!/usr/bin/env python3
"""Example adapter: a reinforcement-learning run folder -> a Home Dashboard live card.

Written for the author's quadruped ("spider") trainer, whose run folders look like this
(field names are the trainer's own, in Spanish):

    <runs>/<run>/estado.json      {fase, donde, exito_pct, caidas_pct, capitulo_actual, nivel,
                                   minutos, minutos_tope, segundos_corriendo, costo_usd, tope_usd, ...}
    <runs>/<run>/metricas.jsonl   one row per iteration {pasos, exito_pct, caidas_pct, ...}
    <runs>/<run>/log.txt          terminal-style log
    <runs>/<run>/capitulos/       cap_NNN.json checkpoints, optional cap_NNN.mp4/.webm clips
    <runs>/<run>/control.json     {"detener": true} asks the trainer to stop cleanly

It only READS the run folder (except ``stop``), and writes the card through the plugin's local
board store. It pushes only when the run's files changed, so a run that stops reporting turns
the card "stale" after its TTL instead of looking alive. Adapt ``build_data`` to your trainer.

    spider_adapter.py print  --runs-dir R --run v9                     # dry run: print the data bag
    spider_adapter.py create --runs-dir R --run v9 --board "Training"   # add the card (training template)
    spider_adapter.py push   --runs-dir R --run v9 --board "Training" --card 1a [--every 30]
    spider_adapter.py stop   --runs-dir R --run v9                     # clean stop via control.json

The Stop button is wired through an action id (``spider.stop``) that you register yourself in
``live-actions/`` - see ``actions.spider.json`` next to this file. It ships DISABLED.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

PHASE = {  # trainer phase -> live card status
    "entrenando": "running", "detenido": "paused", "terminado": "done", "fallo": "error",
    "en_cola": "idle", "iniciando": "idle", "instalando": "idle", "listo": "idle",
}
RUN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")


def hermes_home() -> Path:
    val = (os.environ.get("HERMES_HOME") or "").strip()
    return Path(val) if val else Path.home() / ".hermes"


def load_service(plugin_dir: Optional[Path] = None):
    base = plugin_dir or hermes_home() / "plugins" / "home-dashboard"
    sys.path.insert(0, str(base / "dashboard"))
    from boardkit.service import BoardService  # type: ignore
    return BoardService(hermes_home() / "plugin-data" / "home-dashboard" / "boards")


def run_dir(runs: Path, run: str) -> Path:
    if not RUN.match(run):
        raise SystemExit("bad run name")
    d = (runs / run).resolve()
    if d.parent != runs.resolve() or not d.is_dir():
        raise SystemExit(f"no run folder {d}")
    return d


def read_json(path: Path) -> Dict[str, Any]:
    try:
        data = json.loads(path.read_text("utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def metric_rows(path: Path, tail_bytes: int = 2_000_000) -> List[Dict[str, Any]]:
    try:
        with open(path, "rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            fh.seek(max(0, size - tail_bytes))
            raw = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return []
    rows = []
    for line in raw[1:] if size > tail_bytes else raw:
        try:
            rows.append(json.loads(line))
        except ValueError:
            continue
    return rows


def sample(values: List[float], n: int = 120) -> List[float]:
    if len(values) <= n:
        return values
    step = (len(values) - 1) / (n - 1)
    return [values[round(i * step)] for i in range(n)]


def tail_lines(path: Path, n: int = 6) -> str:
    try:
        with open(path, "rb") as fh:
            fh.seek(0, 2)
            fh.seek(max(0, fh.tell() - 8192))
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return ""
    return "\n".join(line[:160] for line in lines[-n:])


def latest_clip(d: Path, video_dir: Optional[Path]) -> Optional[Path]:
    clips = []
    for base in [p for p in (video_dir, d / "capitulos") if p]:
        if base.is_dir():
            clips += [p for p in base.iterdir() if p.suffix.lower() in (".mp4", ".webm")]
    return max(clips, key=lambda p: p.stat().st_mtime) if clips else None


def num(v: Any) -> Optional[float]:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None


def build_data(d: Path, run: str, title: Optional[str] = None) -> Dict[str, Any]:
    st = read_json(d / "estado.json")
    rows = metric_rows(d / "metricas.jsonl")
    succ = [r["exito_pct"] for r in rows if num(r.get("exito_pct")) is not None]
    status = PHASE.get(str(st.get("fase")), "idle")
    data: Dict[str, Any] = {"name": title or f"Training · {run}", "run": run, "status": status}
    bits = []
    if st.get("capitulo_actual") is not None:
        bits.append(f"chapter {st['capitulo_actual']}")
    if num(st.get("nivel")) is not None:
        bits.append(f"level {st['nivel']:.2f}")
    if st.get("donde"):
        bits.append(str(st["donde"]).upper())
    if status == "idle" and st.get("fase"):
        bits.append(str(st["fase"]))
    data["stage"] = " · ".join(bits)
    mins, cap = num(st.get("minutos")), num(st.get("minutos_tope"))
    cost, top = num(st.get("costo_usd")), num(st.get("tope_usd"))
    if mins is not None and cap:
        data["progress"] = round(min(1.0, mins / cap), 4)
        data["progress_label"] = f"Time budget · {mins:.0f} of {cap:.0f} min"
        if status == "running":
            data["eta"] = max(0, round((cap - mins) * 60))
    elif cost is not None and top:
        data["progress"] = round(min(1.0, cost / top), 4)
        data["progress_label"] = f"Budget · ${cost:.2f} of ${top:.2f}"
    if num(st.get("exito_pct")) is not None:
        data["success"] = st["exito_pct"]
    elif succ:
        data["success"] = succ[-1]
    if len(succ) > 10:
        data["success_delta"] = round(succ[-1] - succ[-max(2, len(succ) // 10)], 1)
    if num(st.get("segundos_corriendo")) is not None:
        data["elapsed"] = st["segundos_corriendo"]
    elif mins is not None:
        data["elapsed"] = round(mins * 60)
    if cost is not None:
        data["cost"] = cost
    if num(st.get("caidas_pct")) is not None:
        data["falls"] = st["caidas_pct"]
    if succ:
        data["success_hist"] = [round(v, 1) for v in sample(succ)]
    log = tail_lines(d / "log.txt")
    if log:
        data["log"] = log
    return data


_uploaded: Dict[str, str] = {}


def upload_clip(svc, clip: Path) -> Optional[str]:
    """Upload a clip once (content-addressed); returns the video asset id."""
    key = f"{clip}:{clip.stat().st_mtime_ns}:{clip.stat().st_size}"
    if key in _uploaded:
        return _uploaded[key]
    if clip.stat().st_size > 100 * 1024 * 1024:
        return None
    data = clip.read_bytes()
    up = hashlib.sha256(key.encode()).hexdigest()[:16]
    chunk = 3 * 1024 * 1024
    n = max(1, math.ceil(len(data) / chunk))
    res: Dict[str, Any] = {}
    for i in range(n):
        res = svc.upload_video_chunk(up, i, n, base64.b64encode(data[i * chunk:(i + 1) * chunk]).decode())
    _uploaded[key] = res.get("asset")
    return _uploaded[key]


def signature(d: Path) -> tuple:
    out = []
    for name in ("estado.json", "metricas.jsonl", "log.txt"):
        try:
            s = (d / name).stat()
            out.append((name, s.st_mtime_ns, s.st_size))
        except OSError:
            out.append((name, 0, 0))
    return tuple(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=("print", "create", "push", "stop"))
    ap.add_argument("--runs-dir", type=Path, required=True)
    ap.add_argument("--run", required=True)
    ap.add_argument("--board", help="board id or name")
    ap.add_argument("--card", help="live card id (push)")
    ap.add_argument("--title", help="card title (default 'Training · <run>')")
    ap.add_argument("--video-dir", type=Path, help="folder with evaluation clips (default <run>/capitulos)")
    ap.add_argument("--every", type=float, default=0, help="keep pushing every N seconds (push)")
    ap.add_argument("--ttl", type=int, default=300, help="seconds without news before the card says stale")
    ap.add_argument("--plugin-dir", type=Path)
    a = ap.parse_args()
    d = run_dir(a.runs_dir, a.run)

    if a.cmd == "print":
        print(json.dumps(build_data(d, a.run, a.title), indent=2, ensure_ascii=False))
        return 0
    if a.cmd == "stop":
        tmp = d / ".control.json.tmp"
        tmp.write_text(json.dumps({"detener": True}), encoding="utf-8")
        os.replace(tmp, d / "control.json")
        print(f"stop requested for {a.run}")
        return 0

    svc = load_service(a.plugin_dir)
    if not a.board:
        raise SystemExit("--board is required")
    doc = svc.store.find(a.board) or (svc.store.create(a.board) if a.cmd == "create" else None)
    if doc is None:
        raise SystemExit(f"no board {a.board!r}")
    if a.cmd == "create":
        item = {"k": "live", "tpl": "training", "title": a.title or f"Training · {a.run}", "ttl": a.ttl, "w": 400,
                "actions": [{"action": "spider.stop", "label": "Stop", "args": {"run": "$run"}}],
                "data": build_data(d, a.run, a.title)}
        _, entry = svc.commit(doc["id"], [{"op": "add", "ref": "$card", "item": item}], by="s")
        print(json.dumps({"board": doc["id"], "card": entry["ids"]["$card"]}))
        return 0

    if not a.card:
        raise SystemExit("--card is required (create prints it)")
    last = None
    while True:
        sig = signature(d)
        if sig != last:
            data = build_data(d, a.run, a.title)
            clip = latest_clip(d, a.video_dir)
            if clip:
                asset = upload_clip(svc, clip)
                if asset:
                    data["video"] = asset
                    data["video_caption"] = f"latest clip · {clip.stem}"
            new, _ = svc.live_update(doc["id"], a.card, data)
            print(f"{time.strftime('%H:%M:%S')} pushed seq {new['seq']} status {data['status']}", flush=True)
            last = sig
        if not a.every:
            return 0
        time.sleep(max(5.0, a.every))


if __name__ == "__main__":
    sys.exit(main())
