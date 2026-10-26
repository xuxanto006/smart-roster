#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""深入：UI 组件类名、可读标识符、是否有 sourcemap、布局骨架。"""
import re, collections, io

P = "/Users/xianyu/Desktop/门店智能排班系统-离线部署包/门店智能排班系统-离线版.html"
html = io.open(P, encoding="utf-8", errors="replace").read()

print("=== 是否有 sourcemap / 未压缩源码痕迹 ===")
for k in ["sourceMappingURL", "webpack", "__webpack", "React", "Vue", "createElement(App"]:
    print(f"  {k:18s} {html.count(k)}")

# CSS 组件类名
css = "".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))
cls = collections.Counter(re.findall(r"\.([a-zA-Z][\w-]{2,28})(?=[\s,:.{\[])", css))
# 只看有语义的一层类名（排除哈希样式）
buckets = {
    "导航/页签": r"nav|tab|menu|sidebar|topbar|header",
    "卡片/容器": r"card|panel|box|wrap|container|section",
    "按钮": r"btn|button|action",
    "表格": r"table|th|td|row|cell|grid",
    "徽标/状态": r"badge|tag|chip|status|dot|pill",
    "表单": r"input|select|field|form|label|checkbox",
    "班次/排班": r"shift|early|mid|night|rest|open|close|schedule|roster|shiftcell",
}
print("\n=== 语义化 CSS 类名（按用途抽样）===")
for label, pat in buckets.items():
    hits = [c for c in cls if re.search(pat, c, re.I)]
    hits.sort(key=lambda c: -cls[c])
    print(f"  [{label}] " + ", ".join(f"{c}" for c in hits[:18]))

# 可读标识符（长度>=6 且含多个音节，英文）
ids = re.findall(r"\b(?:function|const|let|var)\s+([A-Za-z][A-Za-z0-9_]{5,40})\b", html)
readable = [i for i in set(ids) if re.search(r"[a-z]{3,}[A-Z]|[a-z]{6,}", i)]
readable.sort()
print(f"\n=== 可读标识符（未被混淆，共 {len(readable)}）===")
print("  " + ", ".join(readable[:120]))

# 中文函数名/对象键（往往对应业务概念）
cn = collections.Counter(re.findall(r"[\u4e00-\u9fa5]{2,8}(?=\s*[:：])", html))
print(f"\n=== 中文业务键 Top30（共 {len(cn)} 种）===")
print("  " + "  ".join(f"{k}({v})" for k, v in cn.most_common(30)))

# 布局骨架：body 内的结构性标签
body = html[html.find("<body"):]
struct = collections.Counter(re.findall(r"<(header|nav|aside|main|section|article|footer|table|dialog)\b", body))
print(f"\n=== body 结构标签统计 ===\n  {dict(struct)}")

# 是否有明显的老系统痕迹（判断是否同源）
for k in ["团队智能排班", "行政工作台", "排班", "一键智能排班", "storeKey", "shiftScheduler"]:
    print(f"  含『{k}』: {html.count(k)}")
