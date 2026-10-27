# -*- coding: utf-8 -*-
"""ui.css 桌面媒体查询静态自检：括号配对、@media/@supports 嵌套合法、gutter 落点正确。"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "_deploy", "ui.css")

def main():
    s = io.open(CSS, encoding="utf-8").read()
    fails = []

    # 1. 括号配对
    if s.count("{") != s.count("}"):
        fails.append("花括号不配对：%d 开 / %d 闭" % (s.count("{"), s.count("}")))

    # 2. 块栈：@media / @supports 必须正确闭合（不允许出现无块声明的裸 @media）
    depth = 0
    for i, line in enumerate(s.splitlines(), 1):
        t = line.strip()
        if t.startswith("@media") or t.startswith("@supports"):
            if depth == 0 and "{" not in t:
                fails.append("L%d 裸 @media/@supports（未开块）：%s" % (i, t))
        depth += line.count("{") - line.count("}")

    # 3. 桌面媒体查询存在且包含两条 gutter 契约（按花括号配对切块，避免误匹配子块）
    def block_at(marker):
        i = s.find(marker)
        if i < 0:
            return None
        n = 0
        for j in range(i, len(s)):
            if s[j] == "{":
                n += 1
            elif s[j] == "}":
                n -= 1
                if n == 0:
                    return s[i:j + 1]
        return None

    desk = block_at("@media (min-width: 721px) {")
    if not desk:
        fails.append("缺少 @media (min-width: 721px) 块")
    else:
        if not re.search(r"html\s*\{[^}]*scrollbar-gutter:\s*stable", desk):
            fails.append("桌面块里 html 没有 scrollbar-gutter: stable")
        if not re.search(r"\.sheet-wrap\s*\{[^}]*scrollbar-gutter:\s*stable", desk):
            fails.append("桌面块里 .sheet-wrap 没有 scrollbar-gutter: stable")

    # 4. 基础层 fallback 仍在
    if "@supports not (scrollbar-gutter: stable)" not in s:
        fails.append("缺少 @supports not 回退")

    # 5. 移动端断点没被破坏
    for needle in ("@media (max-width: 720px)", "@media (max-width: 560px)"):
        if needle not in s:
            fails.append("缺少断点 %s" % needle)

    # 6. .sheet-wrap 必须仍在移动端取消限高
    mob = block_at("@media (max-width: 720px) {\n  .wb {")
    if not mob or ".sheet-wrap" not in mob or "max-height: none" not in mob:
        fails.append("移动端 .sheet-wrap max-height: none 丢失")

    print("ui.css %d bytes, %d 行" % (len(s.encode("utf-8")), s.count("\n") + 1))
    for i, line in enumerate(s.splitlines(), 1):
        t = line.strip()
        if t.startswith("scrollbar-gutter") or "scrollbar-gutter" in t and t.endswith("{"):
            print("  L%-5d %s" % (i, t))

    if fails:
        print("\nFAIL:")
        for f in fails:
            print("  - " + f)
        return 1
    print("\nCSS MEDIA CHECKS PASSED")
    return 0

if __name__ == "__main__":
    sys.exit(main())
