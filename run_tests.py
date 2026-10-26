#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量跑测试脚本，带超时，逐个报告 PASS/FAIL/TIMEOUT。"""
import subprocess, glob, os, sys, time

NODE = "/Users/xianyu/.workbuddy/binaries/node/versions/22.22.2-3/bin/node"
os.chdir("/Users/xianyu/WorkBuddy/2026-09-02-11-41-05")

pats = sys.argv[1:] or ["test_*.js"]
files = []
for p in pats:
    files += sorted(glob.glob(p))
files = [f for f in files if "sweep" not in f and f not in ("stress.js", "stress_mw.js")]

TMO = 150
res = {"PASS": [], "FAIL": [], "TIMEOUT": [], "ERR": []}
for f in files:
    t0 = time.time()
    try:
        p = subprocess.run([NODE, f], capture_output=True, text=True, timeout=TMO)
        dt = time.time() - t0
        if p.returncode == 0:
            res["PASS"].append((f, dt, p.stdout))
        else:
            res["FAIL"].append((f, dt, (p.stdout or "") + (p.stderr or "")))
    except subprocess.TimeoutExpired:
        res["TIMEOUT"].append((f, TMO, ""))
    except Exception as e:
        res["ERR"].append((f, 0, str(e)))

for k in ("FAIL", "TIMEOUT", "ERR", "PASS"):
    print(f"\n===== {k} ({len(res[k])}) =====")
    for f, dt, out in res[k]:
        print(f"  {f}  [{dt:.1f}s]")
        if k in ("FAIL", "ERR") and out:
            tail = [l for l in out.strip().splitlines() if l.strip()][-6:]
            for l in tail:
                print("      " + l[:150])
print(f"\n汇总: PASS {len(res['PASS'])} / FAIL {len(res['FAIL'])} / TIMEOUT {len(res['TIMEOUT'])} / ERR {len(res['ERR'])}  共 {len(files)}")
