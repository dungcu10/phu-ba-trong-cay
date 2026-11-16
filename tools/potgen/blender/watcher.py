"""Người gác render: chạy một lần trong Blender đang mở.

Mỗi 2 giây kiểm tra file potgen/queue/*.json. Gặp file lệnh thì xóa nó và khởi chạy
một tiến trình Blender NỀN (không giao diện) để render, ghi log vào out/log_<tên>.txt.
Nhờ vậy Claude chỉ cần thả file lệnh vào thư mục, không phải thao tác giao diện.

File lệnh ví dụ: {"line": "lines/phuong_hoang.json", "levels": "milestones"}
"""
import json
import os
import subprocess
import time

import bpy

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
QUEUE = os.path.join(ROOT, "queue")
OUT = os.path.join(ROOT, "out")
os.makedirs(QUEUE, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
_running = {"proc": None, "name": None}


def _write_state(state):
    state["time"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(os.path.join(OUT, "watcher_state.json"), "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def _tick():
    proc = _running["proc"]
    if proc is not None:
        code = proc.poll()
        if code is None:
            return 2.0
        _write_state({"state": "finished", "job": _running["name"], "exit_code": code})
        _running["proc"] = None
    jobs = sorted(f for f in os.listdir(QUEUE) if f.endswith(".json"))
    if not jobs:
        return 2.0
    name = jobs[0]
    path = os.path.join(QUEUE, name)
    try:
        with open(path, encoding="utf-8") as f:
            job = json.load(f)
    except Exception as e:  # file đang ghi dở: đợi vòng sau
        _write_state({"state": "bad_job", "job": name, "error": str(e)})
        return 2.0
    os.remove(path)
    script = os.path.join(ROOT, "blender", job.get("script", "render_line.py"))
    args = [bpy.app.binary_path, "-b", "--factory-startup", "-P", script, "--"]
    for k in ("line", "levels", "samples", "res", "style"):
        if k in job:
            v = job[k]
            if k in ("line", "style"):
                v = os.path.join(ROOT, v)
            args += ["--" + k, str(v)]
    log = open(os.path.join(OUT, "log_" + os.path.splitext(name)[0] + ".txt"), "w", encoding="utf-8")
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    _running["proc"] = subprocess.Popen(args, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                        creationflags=flags)
    _running["name"] = name
    _write_state({"state": "running", "job": name, "args": args[5:]})
    return 2.0


if not bpy.app.timers.is_registered(_tick):
    bpy.app.timers.register(_tick, first_interval=1.0, persistent=True)
_write_state({"state": "watching", "queue": QUEUE})
print("[potgen] Người gác đang chạy, thư mục lệnh:", QUEUE)
