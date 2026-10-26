#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""分析「门店智能排班系统-离线版.html」的结构：设计 token、视图、功能函数、关键能力关键词。"""
import re, collections, io, sys

P = "/Users/xianyu/Desktop/门店智能排班系统-离线部署包/门店智能排班系统-离线版.html"
html = io.open(P, encoding="utf-8", errors="replace").read()
print("总字符数:", len(html))

# 1. title / meta
m = re.search(r"<title>(.*?)</title>", html, re.S)
print("\n=== TITLE ===\n", m.group(1).strip() if m else "(无)")

# 2. :root 设计 token
print("\n=== :root 设计变量 (CSS tokens) ===")
for blk in re.findall(r":root\s*\{([^}]*)\}", html)[:3]:
    for line in blk.split(";"):
        line = line.strip()
        if line.startswith("--"):
            print("  ", line[:110])

# 3. 字体
fonts = collections.Counter(re.findall(r"font-family\s*:\s*([^;}\"']{2,60})", html))
print("\n=== 字体族 Top5 ===")
for f, c in fonts.most_common(5):
    print(f"  {c:4d}  {f.strip()[:80]}")

# 4. 色板 Top20
hexes = collections.Counter(x.lower() for x in re.findall(r"#[0-9a-fA-F]{6}\b", html))
print("\n=== 十六进制色 Top20 ===")
print("  " + "  ".join(f"{c}({n})" for c, n in hexes.most_common(20)))

# 5. 视图 / 导航结构
print("\n=== 视图 section ===")
for s in re.findall(r'<section[^>]*id="([^"]+)"', html):
    print("  ", s)
print("=== 导航项 (data-view / data-go) ===")
navs = re.findall(r'data-(?:view|go|tab)="([^"]+)"', html)
print("  ", list(dict.fromkeys(navs))[:40])

# 6. JS 函数清单
fns = re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", html)
fns = [f for f in fns if f not in ("function",)]
print(f"\n=== JS 函数总数: {len(fns)}（去重 {len(set(fns))}）===")
print("  ", ", ".join(sorted(set(fns))[:150]))

# 7. 关键能力关键词命中
print("\n=== 关键能力关键词命中次数 ===")
kw = {
    "XLSX/Excel导出": r"xlsx|XLSX|SheetJS|writeFile|book_new|sheet_add",
    "节假日/法定": r"法定|节假日|调休|holiday|Holiday",
    "法休": r"法休",
    "普通Off": r"普通Off|normalOff|offQuota",
    "子岗位/模块": r"子岗位|subRole|module",
    "专家": r"专家",
    "兼职替代": r"兼职替代|partTimeSub",
    "月排班": r"月度排班|monthPlan|排整月|updateMonth",
    "上传解析": r"XLSX,CSV,TSV|readAsArrayBuffer|FileReader",
    "localStorage键": r'storeKey\s*=\s*["\']([^"\']+)["\']|localStorage\.setItem\(["\']([^"\']+)',
    "节假日数据2026": r"2026-0[1-9]-\d\d",
}
for k, pat in kw.items():
    hits = re.findall(pat, html)
    print(f"  {k:16s} {len(hits):5d}")

# 8. localStorage 主键
m = re.search(r'(?:const|var|let)\s+(?:STORE_KEY|storeKey|KEY)\s*=\s*["\']([^"\']+)["\']', html)
print("\n=== localStorage 主键 ===\n  ", m.group(1) if m else "(未识别)")

# 9. 体积构成
head_end = html.find("</head>")
style_len = sum(len(x) for x in re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))
script_len = sum(len(x) for x in re.findall(r"<script[^>]*>(.*?)</script>", html, re.S))
print(f"\n=== 体积构成 ===\n  <style> 共 {style_len:,} 字符\n  <script> 共 {script_len:,} 字符\n  head 结束位置 {head_end:,}")
