#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抽取离线包的关键组件 CSS，用来复刻它的『组件骨架』。"""
import re, io

P = "/Users/xianyu/Desktop/门店智能排班系统-离线部署包/门店智能排班系统-离线版.html"
html = io.open(P, encoding="utf-8", errors="replace").read()
css = "".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))

# 取出所有规则
rules = re.findall(r"([^{}]+)\{([^{}]*)\}", css)

WANT = ["topbar", "sidebar", "schedule-table", "shift-cell", "week-badge",
        "exception-card", "domain-tabs", "schedule-head", "schedule-card",
        "table-card", "data-table", "nav-item", "chip", "qual-grid", "form-grid",
        "capacity-card", "demand-card", "schedule-summary", "rest-count", "dot"]

seen = set()
print("=== 关键组件 CSS（原文摘录）===")
for sel, body in rules:
    sel = sel.strip()
    if not sel or sel.startswith("@") or sel.startswith(":root") or sel.startswith("from") or sel.startswith("to"):
        continue
    # 只取类名里含目标词的短规则
    if len(sel) > 160:
        continue
    for w in WANT:
        if re.search(r"\.%s(?![A-Za-z0-9_-])" % re.escape(w), sel):
            key = sel
            if key in seen:
                break
            seen.add(key)
            b = " ".join(body.split())
            if len(b) > 300:
                b = b[:300] + "…"
            print(f"\n{sel} {{\n  {b}\n}}")
            break

print("\n\n=== 全局排版基调 ===")
for sel, body in rules:
    s = sel.strip()
    if s in ("body", "html", "*", "table", "button", "input", "select"):
        b = " ".join(body.split())
        if len(b) > 420:
            b = b[:420] + "…"
        print(f"{s} {{ {b} }}")
