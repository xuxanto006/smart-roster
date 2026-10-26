#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""app_merged.html 静态完整性体检：死引用 / 重复定义 / 悬空 id / 未定义 CSS 变量 / 标签配对。"""
import re, io, collections

P = "/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html"
h = io.open(P, encoding="utf-8", errors="replace").read()

html_part = h[:h.find("<script>")] if "<script>" in h else h
js = "".join(re.findall(r"<script[^>]*>(.*?)</script>", h, re.S))
css = "".join(re.findall(r"<style[^>]*>(.*?)</style>", h, re.S))

problems = []

# 1) HTML 里定义的 id
ids = set(re.findall(r'\bid="([^"]+)"', html_part))
# 2) JS 里 getElementById 的引用
refs = collections.Counter(re.findall(r'getElementById\(\s*["\']([^"\']+)["\']\s*\)', js))
missing = {k: v for k, v in refs.items() if k not in ids}
print("=== 1. getElementById 悬空引用 ===")
if missing:
    for k, v in sorted(missing.items()):
        problems.append(f"getElementById('{k}') x{v} 但 HTML 无此 id")
        print(f"  ✗ {k}  (引用 {v} 次)")
else:
    print("  ✓ 无悬空引用")

# 3) JS 函数定义
defs = collections.Counter(re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", js))
dup = {k: v for k, v in defs.items() if v > 1}
print("\n=== 2. 重复函数定义 ===")
if dup:
    for k, v in sorted(dup.items()):
        problems.append(f"函数 {k}() 重复定义 {v} 次")
        print(f"  ✗ {k}()  x{v}")
else:
    print("  ✓ 无重复定义")

# 4) on* 事件属性里调用的函数是否存在
calls = set()
for attr in re.findall(r'\bon(?:click|change|input|keydown|focus|blur)="([^"]+)"', html_part):
    for fn in re.findall(r"\b([A-Za-z_$][\w$]*)\s*\(", attr):
        if fn not in ("if", "for", "return", "typeof", "this"):
            calls.add(fn)
var_names = set(re.findall(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)", js))
undef = sorted(c for c in calls if c not in defs and c not in var_names)
print(f"\n=== 3. 事件属性调用的函数（{len(calls)} 个）是否存在 ===")
if undef:
    for u in undef:
        problems.append(f"事件属性调用了未定义函数 {u}()")
        print(f"  ✗ {u}()")
else:
    print("  ✓ 全部有定义")

# 5) CSS 变量：用了但没定义
defined = set(re.findall(r"(--[\w-]+)\s*:", css))
used = set(re.findall(r"var\((--[\w-]+)", css + js))
undef_var = sorted(used - defined)
print(f"\n=== 4. CSS 变量（定义 {len(defined)} / 使用 {len(used)}）===")
if undef_var:
    for v in undef_var:
        problems.append(f"CSS 变量 {v} 使用但未定义")
        print(f"  ✗ {v}")
else:
    print("  ✓ 无未定义变量")

# 6) 标签配对（块级）
BLOCK = ["div", "section", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "ul", "li", "aside", "main", "header", "footer", "nav", "button", "label", "span"]
print("\n=== 5. 标签配对 ===")
bad = False
for t in BLOCK:
    o = len(re.findall(r"<%s(?=[\s>])" % t, html_part))
    c = len(re.findall(r"</%s>" % t, html_part))
    if o != c:
        bad = True
        problems.append(f"<{t}> 开 {o} / 闭 {c} 不配对")
        print(f"  ✗ <{t}>: {o} 开 / {c} 闭")
if not bad:
    print("  ✓ 全部配对")

# 7) 悬空的 CSS 类（HTML 未用）——只统计我们新增骨架相关的
print("\n=== 6. 未使用的 CSS 类（可能是残留）===")
declared = set(re.findall(r"\.([a-zA-Z][\w-]{2,30})(?=[\s,:.{\[])", css))
used_cls = set()
for g in re.findall(r'class="([^"]+)"', html_part):
    used_cls |= set(g.split())
for g in re.findall(r'class="([^"]+)"', js):
    used_cls |= set(g.split())
unused = sorted(declared - used_cls)
# 只报告与 swap / 新增骨架相关的残留
focus = [u for u in unused if re.search(r"swap|conflict|chip|metric", u)]
print(f"  共 {len(unused)} 个未使用；其中与本次改动相关的 {len(focus)} 个：")
for u in focus:
    print(f"    · {u}")

print("\n" + "=" * 46)
print(f"发现 {len(problems)} 个问题")
for p in problems:
    print("  -", p)
