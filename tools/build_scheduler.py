# -*- coding: utf-8 -*-
"""从 app_merged.html 抽出排班引擎，生成 _deploy/scheduler.js（对应算法文档 N14）。

为什么要「生成」而不是「手抄一份」：
  引擎有 100+ 个互相调用的函数，手抄必然漂移 —— 改了一边忘了另一边，
  结果就是两边跑出来的班表不一样，谁也说不清哪个对。
  所以这里做**逐字节切片**：scheduler.js 里每个核心函数都与 app_merged.html
  的源码完全一致。改算法只需改 app_merged.html 再重跑本脚本。

生成物结构（顺序固定，便于 diff）：
  ① 宿主钩子  —— 触碰 DOM / localStorage / 提示框的函数不搬走，换成可注入的空实现
  ② 注入常量  —— 名单 / 领域谓词 / 免排名单等顶层 const，原样切片
  ③ 引擎核心  —— 106 个纯计算函数，原样切片
  ④ 对外 API  —— loadInput / generateWeek / repatch / checkWeek

用法：
  python tools/build_scheduler.py            # 生成 _deploy/scheduler.js
  python tools/build_scheduler.py --check    # 校验磁盘文件是否已漂移
  python tools/build_scheduler.py --report   # 只打印抽取边界，不写文件
退出码 0 = 成功/一致；1 = 边界不符或已漂移。
"""
import argparse
import hashlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app_merged.html"
OUT = ROOT / "_deploy" / "scheduler.js"

# 引擎入口：从这四个出发做传递闭包，能到达的就是引擎的全部代码
ROOTS = ["autoSchedule", "repatchWeek", "batchScheduleWeeks", "assignRoles"]

# 触碰宿主环境的信号：命中即「不搬走，改成钩子」
STUB_PAT = (r"\bdocument\b|\blocalStorage\b|\btoast\s*\(|\bconfirm\s*\(|\bwindow\b"
            r"|\bsetTimeout\s*\(|\bdownloadFile\s*\(|\bdom\s*\(|\bsave\s*\(|\brender[A-Z]\w*\s*\(")

# 冻结的钩子名单：抽取边界一变就必须由人确认，所以断言「集合完全相等」。
# 名单是**实测**出来的（打码掉字符串/注释后做闭包），不是估的：
# 引擎真正会调用的宿主函数只有 toast / save / renderAll / confirm / removeStaff /
# closeStaffProfile 六个，其余是为了「搬过来也不会崩」一并打桩（空实现）。
EXPECTED_STUBS = {
    "save", "toast", "removeStaff", "renderRestHints", "switchDomain",
    "renderDomainTabs", "renderAll", "updateClearBtns", "switchView", "renderDash",
    "renderDashChecks", "renderStaffFilters", "renderStaff", "openStaffProfile",
    "renderCompliance", "renderReqForm", "renderRequests",
    "renderRequestConflict", "renderMustWork", "renderMustWorkConflict", "renderNeedsInfo",
    "renderSchedNeeds", "renderTable", "renderShiftTimes", "renderHealth", "renderRoles",
    "updateSaveSnapshotBtn", "renderArchivePanel", "setSelectOptions", "personEfficiencyRows",
    "renderPeopleEfficiency", "renderQuarterTrend", "renderMonthStats", "renderYearTrend",
    "renderAnalytics", "renderStats",
}
EXPECTED_CORE_COUNT = 114
EXPECTED_CORE_LINES = 3706

# 引擎用到、但不属于任何一类的宿主全局。
HOST_GLOBALS = ["confirm"]

JS_KEYWORDS = {
    "true", "false", "null", "undefined", "this", "typeof", "instanceof", "in", "of", "new",
    "delete", "void", "function", "return", "const", "let", "var", "if", "else", "for", "while",
    "do", "break", "continue", "switch", "case", "default", "try", "catch", "finally", "throw",
    "class", "extends", "super", "yield", "await", "async", "static", "get", "set", "NaN",
    "Infinity",
}
JS_GLOBALS = {
    "Math", "JSON", "Date", "Object", "Array", "String", "Number", "Boolean", "Set", "Map",
    "WeakMap", "WeakSet", "Promise", "RegExp", "Error", "TypeError", "RangeError", "Symbol",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent",
    "encodeURI", "decodeURI", "Intl", "globalThis", "console",
}


# ------------------------------------------------------------------ 1. 分词打码
def mask_js(text):
    """把字符串 / 模板串 / 注释 / 正则字面量替换成空格（保留换行）。

    在打码后的文本上数花括号、找顶层分号才是安全的：`if(x){ s = "}" }` 不会算错深度。
    切片时用同一批下标去**原文**取，所以搬出来的源码逐字节原样。
    """
    out = list(text)
    n = len(text)
    i = 0
    # 上下文栈：代码帧 = [花括号深度, 是否由 ${ 进入]；字符串帧 = 'sq' / 'dq' / 'tpl'
    stack = [[0, False]]
    prev = ""

    def blank(a, b):
        for k in range(a, min(b, n)):
            if out[k] != "\n":
                out[k] = " "

    while i < n:
        c = text[i]
        frame = stack[-1]
        kind = frame if isinstance(frame, str) else "code"

        if kind in ("sq", "dq"):
            if c == "\\":
                blank(i, i + 2)
                i += 2
                continue
            if (kind == "sq" and c == "'") or (kind == "dq" and c == '"'):
                stack.pop()
            blank(i, i + 1)
            i += 1
            continue

        if kind == "tpl":
            if c == "\\":
                blank(i, i + 2)
                i += 2
                continue
            if c == "`":
                stack.pop()
                blank(i, i + 1)
                i += 1
                continue
            if c == "$" and i + 1 < n and text[i + 1] == "{":
                blank(i, i + 2)
                stack.append([0, True])      # [该代码帧内的花括号深度, 是否由 ${ 进入]
                i += 2
                continue
            blank(i, i + 1)
            i += 1
            continue

        # ---- 普通代码（深度记在帧上：模板串里嵌代码、代码里再嵌模板串，深度不能共用）----
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            j = n if j < 0 else j
            blank(i, j)
            i = j
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            blank(i, j)
            i = j
            continue
        if c in "\"'":
            stack.append("sq" if c == "'" else "dq")
            blank(i, i + 1)
            i += 1
            continue
        if c == "`":
            stack.append("tpl")
            blank(i, i + 1)
            i += 1
            continue
        if c == "/" and (prev == "" or prev in "(,=:[!&|?{};+-*%^~<>"):
            j = i + 1
            in_class = False
            while j < n:
                ch = text[j]
                if ch == "\\":
                    j += 2
                    continue
                if ch == "\n":
                    break
                if ch == "[":
                    in_class = True
                elif ch == "]":
                    in_class = False
                elif ch == "/" and not in_class:
                    j += 1
                    break
                j += 1
            else:
                j = i + 1
            while j < n and text[j].isalpha():
                j += 1
            blank(i, j)
            i = j
            prev = ")"
            continue
        if c == "{":
            frame[0] += 1
            prev = c
            i += 1
            continue
        if c == "}":
            if frame[1] and frame[0] == 0:
                stack.pop()                  # 结束 ${...}，回到模板串
                blank(i, i + 1)              # 连这个 } 一起打码：${ 已打码，留着它会多出个闭括号
            else:
                frame[0] -= 1
            prev = c
            i += 1
            continue
        if not c.isspace():
            prev = c
        i += 1
    return "".join(out), stack[0][0]


# ------------------------------------------------------------------ 2. 顶层声明
class Decl:
    __slots__ = ("kind", "name", "start", "end")

    def __init__(self, kind, name, start, end):
        self.kind, self.name, self.start, self.end = kind, name, start, end


def scan_decls(text, masked):
    """找出顶层 function / const|let|var 声明及其精确行范围。"""
    line_start = [m.end() for m in re.finditer("\n", text)]
    line_start = [0] + line_start + [len(text)]

    depth_at_line = []
    d = 0
    for ln in range(len(line_start) - 1):
        depth_at_line.append(d)
        seg = masked[line_start[ln]:line_start[ln + 1]]
        d += seg.count("{") - seg.count("}")

    decls = {}
    func_re = re.compile(r"^function\s+([A-Za-z_$][\w$]*)\s*\(")
    var_re = re.compile(r"^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=|;)")
    total_lines = len(line_start) - 1
    for ln in range(total_lines):
        if depth_at_line[ln] != 0:
            continue
        stripped = text[line_start[ln]:line_start[ln + 1]].lstrip()
        if stripped.startswith(("//", "/*", "*")):
            continue

        m = func_re.match(stripped)
        if m:
            name = m.group(1)
            if name in decls:
                continue
            end = ln
            dd = 0
            started = False
            while end < total_lines:
                seg = masked[line_start[end]:line_start[end + 1]]
                if "{" in seg:
                    started = True
                dd += seg.count("{") - seg.count("}")
                if started and dd <= 0:
                    break
                end += 1
            if not started or dd != 0:
                raise SystemExit(f"!! 函数 {name}（行 {ln + 1}）花括号不配平")
            decls[name] = Decl("func", name, ln, end)
            continue

        m = var_re.match(stripped)
        if m:
            name = m.group(1)
            if name in decls:
                continue
            end = ln
            dd = 0
            while end < total_lines:
                seg = masked[line_start[end]:line_start[end + 1]]
                dd += (seg.count("(") + seg.count("[") + seg.count("{")
                       - seg.count(")") - seg.count("]") - seg.count("}"))
                if dd <= 0 and ";" in seg:
                    break
                end += 1
            else:
                raise SystemExit(f"!! 顶层声明 {name}（行 {ln + 1}）找不到语句结尾")
            if end >= total_lines:
                raise SystemExit(f"!! 顶层声明 {name}（行 {ln + 1}）找不到语句结尾")
            decls[name] = Decl("var", name, ln, end)
    return decls


def slice_decl(text, decl):
    return "\n".join(text.split("\n")[decl.start:decl.end + 1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    text = SRC.read_text(encoding="utf-8")
    masked, root_depth = mask_js(text)
    if root_depth != 0:
        raise SystemExit(f"!! app_merged.html 花括号不配平（余 {root_depth}），拒绝切片")

    decls = scan_decls(text, masked)
    funcs = {n: d for n, d in decls.items() if d.kind == "func"}
    vars_ = {n: d for n, d in decls.items() if d.kind == "var"}
    bodies = {n: slice_decl(text, d) for n, d in funcs.items()}
    ident = re.compile(r"\b([A-Za-z_$][\w$]*)\b")
    local_decl = re.compile(r"\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)")

    missing = [r for r in ROOTS if r not in funcs]
    if missing:
        raise SystemExit(f"!! 找不到入口函数：{missing}")

    # ---- 传递闭包：函数 ↔ 顶层变量 互相依赖，迭代到不动点 ----
    # 为什么要把变量的依赖也算进来：DOMAINS 这个常量数组里内联了 isAdmin / isKufang
    # 这类谓词，只顺着函数体找函数会漏掉它们（inDomain 里是 d.match(name) 动态调用）。
    closure = set(ROOTS)
    needed = set()
    ident_ok = lambda s: set(ident.findall(masked_of(s)))
    while True:
        grew = False
        for n in list(closure):
            if n not in bodies:
                continue
            for nm in ident_ok(bodies[n]):
                if nm in funcs and nm not in closure:
                    closure.add(nm)
                    grew = True
                elif nm in vars_ and nm not in needed:
                    needed.add(nm)
                    grew = True
        for v in list(needed):
            for nm in ident_ok(slice_decl(text, vars_[v])):
                if nm in funcs and nm not in closure:
                    closure.add(nm)
                    grew = True
                elif nm in vars_ and nm not in needed:
                    needed.add(nm)
                    grew = True
        if not grew:
            break

    stubs = {n for n in closure if re.search(STUB_PAT, bodies[n])} - set(ROOTS)
    core = sorted(closure - stubs, key=lambda n: funcs[n].start)

    # ---- 边界断言 ----
    problems = []
    if stubs != EXPECTED_STUBS:
        problems.append("钩子集合变了：新增 %s / 消失 %s"
                        % (sorted(stubs - EXPECTED_STUBS), sorted(EXPECTED_STUBS - stubs)))
    if len(core) != EXPECTED_CORE_COUNT:
        problems.append("核心函数数 %d ≠ 预期 %d" % (len(core), EXPECTED_CORE_COUNT))
    core_lines = sum(funcs[n].end - funcs[n].start + 1 for n in core)
    if core_lines != EXPECTED_CORE_LINES:
        problems.append("核心行数 %d ≠ 预期 %d" % (core_lines, EXPECTED_CORE_LINES))
    for n in core:
        if n not in ROOTS and re.search(STUB_PAT, bodies[n]):
            problems.append("核心函数 %s 触碰了宿主环境，应改成钩子" % n)

    # ---- 自由标识符：核心用到、没在任何地方声明、也不是 JS 内建 ----
    # 只是**提示**（真正的判据是运行期：严格模式下读未声明的变量会立刻 ReferenceError），
    # 所以这里只打印，不让构建失败。
    defined = set(funcs) | set(vars_)
    info_free = {}
    for n in core:
        body = bodies[n]
        m_body = masked_of(body)
        local = collect_locals(m_body) | set(ident.findall(m_body[:m_body.find("{") + 1]))
        for nm in set(no_dot_ident.findall(m_body)):
            if nm in defined or nm in JS_KEYWORDS or nm in JS_GLOBALS or nm in local:
                continue
            info_free.setdefault(nm, []).append(n)

    if problems:
        print("!! 抽取边界与预期不符：")
        for p in problems:
            print("   -", p)
        print("\n处理：确认改动是故意的，再更新 build_scheduler.py 里的 EXPECTED_STUBS / 计数。")
        return 1

    if args.report:
        print(f"顶层函数 {len(funcs)} / 顶层变量 {len(vars_)}")
        print(f"闭包 {len(closure)} → 核心 {len(core)} 个 / {core_lines} 行，钩子 {len(stubs)} 个")
        print(f"注入常量 {len(needed)} 个（按源码顺序）:")
        for v in sorted(needed, key=lambda x: vars_[x].start):
            print(f"   行 {vars_[v].start + 1:>5}  {v}")
        if info_free:
            print("\n提示：以下标识符静态分析未找到声明（多半是解构 / 属性简写，运行期会暴露真问题）:")
            for k, v in sorted(info_free.items()):
                print(f"   {k:24s} ← {v[:4]}")
        return 0

    # ---- 生成 ----
    src_sha = hashlib.sha256(SRC.read_bytes()).hexdigest()
    buf = io.StringIO()
    w = buf.write

    w("/* eslint-disable */\n")
    w("/* ============================================================================\n")
    w("   scheduler.js —— 排班引擎（工具自动抽取生成，请勿手改）\n\n")
    w("   生成器：tools/build_scheduler.py（从 app_merged.html 逐字节切片）\n")
    w(f"   源文件 sha256 : {src_sha}\n")
    w(f"   核心函数      : {len(core)} 个 / {core_lines} 行\n")
    w(f"   宿主钩子      : {len(stubs)} 个（默认空实现，由宿主注入）\n")
    w(f"   注入常量      : {len(needed)} 个\n\n")
    w("   改算法请改 app_merged.html，然后：\n")
    w("     python tools/build_scheduler.py          # 重新生成\n")
    w("     python tools/build_scheduler.py --check  # 校验是否漂移\n")
    w("   ============================================================================ */\n")
    w("(function (root, factory) {\n")
    w("  var api = factory();\n")
    w("  if (typeof module === 'object' && module.exports) module.exports = api;\n")
    w("  if (root) root.Scheduler = api;\n")
    w("})(typeof globalThis !== 'undefined' ? globalThis : this, function () {\n")
    w("'use strict';\n\n")

    w("/* ===== ① 宿主钩子 ==========================================================\n")
    w("   触碰 DOM / localStorage / 提示框的函数不搬进来，换成可注入的空实现：\n")
    w("   浏览器注入真实的渲染函数，Edge Function 注入记录器，测试注入断言用的替身。\n")
    w("   ========================================================================== */\n")
    w("var HOST = {};\n")
    w("function bindHost(hooks){\n")
    w("  if(!hooks) return;\n")
    w("  for(var k in hooks) if(Object.prototype.hasOwnProperty.call(hooks,k)) HOST[k] = hooks[k];\n")
    w("}\n")
    for n in sorted(stubs):
        w(f"var {n} = function(){{ return HOST.{n} ? HOST.{n}.apply(null, arguments) : undefined; }};\n")
    w("\n/* 引擎直接使用的宿主全局 */\n")
    for g in HOST_GLOBALS:
        w(f"var {g} = function(){{ return HOST.{g} ? HOST.{g}.apply(null, arguments) : true; }};\n")
    w("\n")

    w("/* ===== ② 注入常量（原样切片）=============================================== */\n")
    for v in sorted(needed, key=lambda x: vars_[x].start):
        w(slice_decl(text, vars_[v]) + "\n")
    w("\n")

    w("/* ===== ③ 引擎核心（原样切片，逐字节一致）=================================== */\n")
    for n in core:
        w(slice_decl(text, funcs[n]) + "\n")
    w("\n")

    w("/* ===== ④ 对外 API ========================================================== */\n")
    api = (API_JS
           .replace("__CORE_COUNT__", str(len(core)))
           .replace("__CORE_LINES__", str(core_lines))
           .replace("__STUB_COUNT__", str(len(stubs)))
           .replace("__SRC_SHA__", src_sha)
           .replace("__CORE_NAMES__", repr(core)))
    w(api)

    generated = buf.getvalue()

    if args.check:
        if not OUT.exists():
            print("!! _deploy/scheduler.js 不存在，请先运行 python tools/build_scheduler.py")
            return 1
        current = OUT.read_text(encoding="utf-8")
        if current == generated:
            print(f"OK scheduler.js 与 app_merged.html 一致（{len(generated)} 字符）")
            return 0
        print("!! scheduler.js 已漂移：app_merged.html 改了没重新生成，或有人手改了 scheduler.js")
        cur_lines, new_lines = current.split("\n"), generated.split("\n")
        shown = 0
        for i in range(max(len(cur_lines), len(new_lines))):
            a = cur_lines[i] if i < len(cur_lines) else "<缺行>"
            b = new_lines[i] if i < len(new_lines) else "<多行>"
            if a != b:
                print(f"   行 {i + 1}:\n     磁盘: {a[:120]}\n     期望: {b[:120]}")
                shown += 1
                if shown >= 10:
                    print("   …（只显示前 10 处）")
                    break
        return 1

    OUT.write_text(generated, encoding="utf-8")
    print(f"已生成 {OUT.relative_to(ROOT)}（{len(generated)} 字符）")
    print(f"  核心函数 {len(core)} 个 / {core_lines} 行 · 宿主钩子 {len(stubs)} 个 · 注入常量 {len(needed)} 个")
    print(f"  源文件 sha256 {src_sha[:16]}…")
    if info_free:
        print("  提示：静态分析未识别的标识符", sorted(info_free)[:12], "…（运行期会暴露真问题）")
    return 0


def masked_of(body):
    """去掉字符串/注释后再找标识符，避免把中文提示语里的词当成变量名。"""
    return mask_js(body)[0]


no_dot_ident = re.compile(r"(?<![\w$.])([A-Za-z_$][\w$]*)")


def collect_locals(src):
    """收集源码里所有 function|const|let|var|class 声明的名字（含 `const a=1, b=2` 的多个声明符）。"""
    out = set()
    i = 0
    n = len(src)
    kw = re.compile(r"\b(?:function|const|let|var|class)\s+")
    for m in kw.finditer(src):
        j = m.end()
        depth = 0
        while j < n:
            c = src[j]
            if c in "([{":
                depth += 1
            elif c in ")]}":
                if depth == 0:
                    break
                depth -= 1
            elif c == ";" and depth == 0:
                break
            elif depth == 0:
                mm = re.compile(r"^([A-Za-z_$][\w$]*)").match(src[j:])
                if mm:
                    out.add(mm.group(1))
                    j += len(mm.group(1))
                    # 跳过默认值直到下一个顶层逗号 / 分号
                    while j < n:
                        ch = src[j]
                        if ch in "([{":
                            depth += 1
                        elif ch in ")]}":
                            if depth == 0:
                                break
                            depth -= 1
                        elif ch in ",;" and depth == 0:
                            break
                        j += 1
                    continue
            j += 1
    return out


API_JS = r"""
/* 状态快照：JSON 化后再还原，避免宿主拿到内部引用乱改 */
function snapshot(o){ return JSON.parse(JSON.stringify(o)); }

var STATE_DEFAULTS = snapshot(state);

/* 深合并：只覆盖 patch 里显式给出的键；数组整体替换（不逐项并） */
function deepMerge(dst, patch){
  Object.keys(patch || {}).forEach(function(k){
    var v = patch[k];
    if(v && typeof v === 'object' && !Array.isArray(v)
       && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])){
      deepMerge(dst[k], v);
    } else {
      dst[k] = v;
    }
  });
  return dst;
}

var WARNINGS = [];
function warn(msg){ WARNINGS.push(String(msg)); }

/* 装载一次生成的输入。每次装载都从默认状态起步 —— 上一次的 schedule / manual
   不能污染这一次（否则「同一个输入两次结果不同」）。
   cfg = { state:{…}, hooks:{…}, staff:[…], requests:[…], … }，常用字段可直接写在顶层 */
function loadInput(cfg){
  cfg = cfg || {};
  state = snapshot(STATE_DEFAULTS);
  WARNINGS = [];
  bindHost({
    toast: warn,
    save: function(){},
    renderAll: function(){},
    confirm: function(msg){ warn(msg); return true; }
  });
  bindHost(cfg.hooks);
  deepMerge(state, cfg.state || {});
  ['staff','staffProfiles','staffDomain','requests','mustWork','fixedRoster','groups','needs','limits','restMax',
   'schedule','roles','roleSig','manual','domain','moduleMinOn','exactShifts','weekendEarlyMax'
  ].forEach(function(k){ if(cfg[k] !== undefined) state[k] = cfg[k]; });
  return state;
}

/* 'yyyy-mm-dd' / Date / 毫秒 → 该周周一（一律按本地时区，别走 UTC） */
function toMonday(key){
  if(key instanceof Date) return mondayOf(key);
  if(typeof key === 'number') return mondayOf(new Date(key));
  var m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(key || ''));
  if(m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return mondayOf(new Date());
}

/* 生成一周（单领域）。
   opts = {
     weekKey : 该周周一，'yyyy-mm-dd'；缺省 = 今天所在周
     domain  : '3c' | 'hongmeng' | 'zunjie' | 'aftersales' | 'kufang' | 'admin' | 'manager'
     effort  : 'fast' | 'quality'
               fast    = 与旧版一键排班完全等价（攒够 MIN_POOL 且合格就收工）
               quality = N1 预算用满 + N2 局部搜索（默认）
     budgetMs: 覆盖主搜索时间预算（毫秒）
     climbMs : 覆盖局部搜索时间预算（毫秒），0 = 关闭 N2
     input   : 与 loadInput 同一个对象（不传则用 opts 自身的字段装载）
   }
   返回 { ok, weekKey, domain, grid, roles, manual, warnings, stats, ms } */
function generateWeek(opts){
  opts = opts || {};
  loadInput(opts.input || opts);

  var dom = opts.domain || state.domain || '3c';
  currentMonday = toMonday(opts.weekKey || opts.week);
  var k = curKey();

  var effort = opts.effort || 'quality';
  var t0 = Date.now();
  autoSchedule(dom, {
    fillBudget: effort === 'quality',
    budgetMs: opts.budgetMs,
    climbMs : opts.climbMs
  });
  var ms = Date.now() - t0;

  var week = state.schedule[k] || null;
  return {
    ok: !!(week && state.staff.length),
    weekKey: k,
    domain: dom,
    grid: week ? snapshot(week) : null,
    roles: snapshot(state.roles[k] || {}),
    manual: snapshot((state.manual || {})[k] || {}),
    warnings: WARNINGS.slice(),
    stats: week ? checkWeek(week, dom) : null,
    ms: ms
  };
}

/* 把 state 切到某个领域的口径：需求 / 上限 / 休息配额 / 人力池 一起换。
   这正是 autoSchedule 内部做的事（少了它，体检会把别的领域的人也算进来，
   报出一堆「三连休」「模块无人上岗」的假违规）。退出前一定还原。 */
function withScope(dom, fn){
  var bakNeeds = state.needs, bakLimits = state.limits, bakRest = state.restMax,
      bakDom = state.domain, bakStaff = state.staff, bakMonday = currentMonday;
  state.domain = dom;
  state.needs = domNeeds(dom);
  state.limits = domLimits(dom);
  state.restMax = domRestMax(dom);
  var fixedAll = allFixedRosterNames();
  state.staff = bakStaff.filter(function(n){
    return inDomain(n, dom) && !blockedInDomain(n, dom) && fixedAll.indexOf(n) < 0;
  });
  try { return fn(); }
  finally {
    state.needs = bakNeeds; state.limits = bakLimits; state.restMax = bakRest;
    state.domain = bakDom; state.staff = bakStaff; currentMonday = bakMonday;
  }
}

/* 体检：把「这一周排得怎么样」量化出来。跑分基座、经理端、A/B 对比共用这一个口径。
   注意所有指标都只统计**本领域可排班的人**，与生成期口径一致。 */
function checkWeek(week, dom){
  dom = dom || state.domain || '3c';
  /* 纯固定班表部门（行政）：没有可排班人力，但格子照样有值（固定班表写死的）。
     这种情况按「本领域全员」来体检 —— 否则会得出「需求 23、缺口 23」这种假结论。
     注意此时 fixedOnly=true，覆盖类指标不适用（引擎自己也只给提示、不给错误）。 */
  var fixedOnly = domainSchedulable(dom).length === 0 && !!fixedRosterOf(dom);
  return withScope(dom, function(){
    var scope = fixedOnly ? domainStaff(dom) : state.staff;
    var R = buildRules(curKey(), dom);
    var RArr = scope.map(function(n){ return R[n]; });
    var plan = { assign: [], restDays: [], slots: [], R: RArr };
    state.needs.forEach(function(d, di){
      ['early','mid','night'].forEach(function(sh){
        for(var i = 0; i < (+d[sh] || 0); i++) plan.slots.push({ day: di, shift: sh });
      });
    });
    var filled = 0;
    scope.forEach(function(n){
      var arr = week[n] || [];
      var list = [];
      var rest = new Set([0,1,2,3,4,5,6]);
      for(var d = 0; d < 7; d++){
        var v = arr[d] || '';
        if(v === 'early' || v === 'mid' || v === 'night'){
          list.push({ day: d, shift: v });
          rest.delete(d);
          filled++;
        }
      }
      plan.assign.push(list);
      plan.restDays.push(rest);
    });
    var rr = restRange();
    var stats = {
      domain: dom,
      staff: scope.length,
      fixedOnly: fixedOnly,
      slots: plan.slots.length,
      filled: filled,
      gaps: Math.max(0, plan.slots.length - filled),
      ruleViol : planRuleViol(plan, RArr),
      isoRest  : planIsoRest(plan),
      groupViol: planGroupViol(plan),
      run3Bad  : planRun3Rest(plan, RArr),
      modViol  : planModuleViol(plan),
      floorBad : planRestFloorViol(plan, RArr),
      shortWork: plan.assign.reduce(function(s, a){
        return s + Math.max(0, (7 - rr.min) - a.length); }, 0),
      score: scope.length ? planScore(plan) : 0
    };
    stats.hard = stats.gaps + stats.ruleViol + stats.isoRest + stats.groupViol
               + stats.run3Bad + stats.modViol + stats.floorBad;
    return stats;
  });
}

/* 按请假 / 改班微调（局部补位），opts 与 generateWeek 同构 */
function repatch(opts){
  opts = opts || {};
  loadInput(opts.input || opts);
  var dom = opts.domain || state.domain || '3c';
  currentMonday = toMonday(opts.weekKey || opts.week);
  var k = curKey();
  repatchWeek(!!opts.silent, dom);
  var week = state.schedule[k] || null;
  return {
    ok: !!week, weekKey: k, domain: dom,
    grid: week ? snapshot(week) : null,
    warnings: WARNINGS.slice(),
    stats: week ? checkWeek(week, dom) : null
  };
}

return {
  version: '1.0.0',
  core: { count: __CORE_COUNT__, lines: __CORE_LINES__, stubs: __STUB_COUNT__, source: '__SRC_SHA__' },
  get state(){ return state; },
  snapshot: function(){ return snapshot(state); },
  loadInput: loadInput,
  configure: function(patch){ return deepMerge(state, patch || {}); },
  bindHost: bindHost,
  generateWeek: generateWeek,
  repatch: repatch,
  autoSchedule: function(dom, opts){ return autoSchedule(dom || state.domain, opts); },
  batchScheduleWeeks: function(weeks, dom, opts){ return batchScheduleWeeks(weeks, dom, opts); },
  checkWeek: checkWeek,
  /* 内部函数出口（跑分基座与测试用）：fn('planScore') */
  fn: function(name){
    try { return eval(name); } catch(e){ return undefined; }
  },
  coreNames: __CORE_NAMES__
};
});
"""

if __name__ == "__main__":
    sys.exit(main())
