# -*- coding: utf-8 -*-
"""把 supabase/functions/<name>/index.ts 连同 ../_shared 依赖，合并成一个可粘贴到
Supabase Dashboard 编辑器里的单文件（等价于 tools/build_functions.ps1 里 esbuild 的产物）。

为什么需要它：Dashboard 的 "Via Editor" 部署不支持 ../_shared 相对导入，
CLI 部署又要 Docker，而 esbuild 需要 node/npx。这台机器上 node 不一定在，
所以这里做一个只处理「本项目这种简单 import/export」的极简内联器：
  · 只处理 `import { .. } from './x.ts'` / `'../_shared/x.ts'`（本项目全部如此）
  · 按依赖顺序把每个模块只内联一次，去掉 import 行和行首 export 关键字
  · 内联完成后检查文件里不能再有 import/export 语句

用法：
  python tools/bundle_fn.py ack
  python tools/bundle_fn.py publish --out tools/_build/f/publish.ts
"""
import io
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FUNCS = ROOT / "supabase" / "functions"

IMPORT_RE = re.compile(
    r"^[ \t]*import\s+(?:type\s+)?\{[^}]*\}\s+from\s+['\"]([^'\"]+)['\"];?[ \t]*\n",
    re.M,
)
EXPORT_RE = re.compile(r"^([ \t]*)export\s+(?=(?:async\s+)?(?:function|const|let|type|interface|class)\b)", re.M)


class Bundler:
    def __init__(self):
        self.parts = []
        self.done = set()

    def add(self, path: Path, depth=0):
        key = path.resolve()
        if key in self.done:
            return
        self.done.add(key)

        src = io.open(path, encoding="utf-8").read()

        # 先内联依赖（深度优先），再放自己的代码
        for m in IMPORT_RE.finditer(src):
            spec = m.group(1)
            if not spec.startswith("."):
                raise SystemExit(
                    "%s 里出现非相对导入 %r：内联器处理不了，请改用 esbuild 打包" % (path, spec)
                )
            dep = (path.parent / spec).resolve()
            if not dep.exists():
                raise SystemExit("找不到依赖 %s（被 %s 引用）" % (dep, path))
            self.add(dep, depth + 1)

        body = IMPORT_RE.sub("", src)
        body = EXPORT_RE.sub(r"\1", body)
        banner = "// ---------- %s ----------" % path.relative_to(FUNCS).as_posix()
        self.parts.append(banner + "\n" + body.strip() + "\n")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    name = sys.argv[1]
    entry = FUNCS / name / "index.ts"
    if not entry.exists():
        raise SystemExit("没有这个函数：%s" % entry)

    out = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "tools" / "_build" / "f" / ("%s.ts" % name)
    out.parent.mkdir(parents=True, exist_ok=True)

    b = Bundler()
    b.add(entry)
    text = (
        "// =============================================================\n"
        "// %s.ts · 单文件版（可直接粘贴到 Supabase Dashboard → Edge Functions → Via Editor）\n"
        "// 由 tools/bundle_fn.py 从 supabase/functions/%s/index.ts + _shared/* 内联生成\n"
        "// =============================================================\n\n" % (name, name)
    ) + "\n".join(b.parts)

    left = [ln for ln in text.splitlines() if re.match(r"^[ \t]*(import|export)\s", ln)]
    if left:
        for ln in left[:10]:
            print("  残留: " + ln)
        raise SystemExit("FAIL：还有 import/export 语句，不能粘贴部署")

    if text.count("{") != text.count("}"):
        raise SystemExit("FAIL：花括号不配对 %d/%d" % (text.count("{"), text.count("}")))

    io.open(out, "w", encoding="utf-8", newline="\n").write(text)
    print("%s  %d bytes  %d 行  内联模块 %d 个" % (
        out.relative_to(ROOT), len(text.encode("utf-8")), text.count("\n") + 1, len(b.done)))
    print("模块顺序: " + ", ".join(sorted(p.relative_to(FUNCS).as_posix() for p in b.done)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
