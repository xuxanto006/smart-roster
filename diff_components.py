#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""离线包 CSS 组件类名全集 vs 我的样张类名 —— 找缺口。"""
import re, io, collections

PKG = "/Users/xianyu/Desktop/门店智能排班系统-离线部署包/门店智能排班系统-离线版.html"
MOCK = "/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/ui_mockup.html"

pkg = io.open(PKG, encoding="utf-8", errors="replace").read()
mock = io.open(MOCK, encoding="utf-8", errors="replace").read()

pkg_css = "".join(re.findall(r"<style[^>]*>(.*?)</style>", pkg, re.S))
mock_css = "".join(re.findall(r"<style[^>]*>(.*?)</style>", mock, re.S))

pkg_cls = set(re.findall(r"\.([a-zA-Z][\w-]{2,30})(?=[\s,:.{\[])", pkg_css))
mock_cls = set(re.findall(r"\.([a-zA-Z][\w-]{2,30})(?=[\s,:.{\[])", mock_css))
# 样张 HTML 里实际用到的
mock_used = set(re.findall(r'class="([^"]+)"', mock))
mock_used = {c for grp in mock_used for c in grp.split()}

missing = sorted(pkg_cls - mock_used)
print(f"离线包 CSS 类名总数: {len(pkg_cls)}")
print(f"样张已用类名: {len(mock_used)}")
print(f"\n=== 离线包有、样张没有的类名（{len(missing)}）===")

# 分组呈现
groups = {
    "排班表/班次": r"shift|schedule|rest|roster|day|legend|definition|cell|coverage|month|week",
    "需求/请假/日历": r"demand|leave|request|holiday|calendar|priority|off|法休",
    "人员/组织/资格": r"staff|employee|person|org|node|role|qual|sub|team|dept|tag|entry",
    "异常/提示": r"exception|warn|error|alert|conflict|issue|empty|state",
    "表单/操作": r"form|input|field|btn|button|action|toolbar|search|select|modal|range",
    "布局/容器": r"card|panel|wrap|grid|layout|section|page|top|side|nav|table|chip|badge|dot|tab|seg",
}
seen = set()
for label, pat in groups.items():
    hits = [c for c in missing if re.search(pat, c, re.I) and c not in seen]
    seen |= set(hits)
    print(f"\n[{label}] {len(hits)}")
    for c in hits[:40]:
        print("   ", c)
rest = [c for c in missing if c not in seen]
if rest:
    print(f"\n[其它] {len(rest)}: {', '.join(rest[:40])}")
