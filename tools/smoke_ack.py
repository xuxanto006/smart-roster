# -*- coding: utf-8 -*-
"""「已知晓」回执的离线冒烟：用假数据跑 me.html / manager.html 的前端逻辑。

为什么需要它：
  ack 是登录后才有的页面行为，命令行里既没有 node 也没有真实账号，
  所以这里把 auth-core.js 换成一个内存版假 SR（session / db / api / ui），
  再用无头 Edge 真正执行页面里的那段 JS，验证：
    员工端   载入 → 出现「我已看过，确认知晓」→ 点击 → 变成「已确认知晓」
    经理端   载入 → 徽标出现「已知晓 2/3」，未确认的人写进 title

用法：python tools/smoke_ack.py
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from websockets.sync.client import connect

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "_deploy"
TMP = Path(os.environ["TEMP"]) / "sr-ack-smoke"

P1 = "11111111-1111-4111-8111-111111111111"

STUB = r"""
(function () {
  window.__errors = [];
  window.addEventListener('error', function (e) { window.__errors.push(String(e.message)); });
  window.__calls = [];

  var DATA = __DATA__;

  function $(sel) { return document.querySelector(sel); }
  function ok(rows) { return Promise.resolve({ http: 200, ok: true, data: rows || [], raw: '' }); }

  var SR = {
    $: $,
    $$: function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); },
    session: {
      get: function () {
        return { access_token: 'fake-token-for-smoke', username: 'smoke', display_name: '冒烟测试', role: __ROLE__ };
      },
      clear: function () {}
    },
    db: {
      select: function (table, query) { return ok(DATA[table]); },
      insert: function () { return ok([]); },
      upsert: function () { return ok([]); },
      patch: function () { return ok([]); },
      del: function () { return ok([]); }
    },
    api: {
      call: function (fn, opts) {
        /* auth 必须记下来：ack 在 Supabase 侧开了 Verify JWT，
           忘了传 auth 会先被网关 401 掉，函数体根本跑不到。 */
        window.__calls.push({
          fn: fn,
          auth: (opts && opts.auth) || null,
          body: (opts && opts.body) || null
        });
        if (fn === 'ack') {
          return Promise.resolve({
            http: 200,
            data: { ok: true, already: false, publish_id: __P__, seen_at: '2026-10-27T02:03:00.000Z' }
          });
        }
        return Promise.resolve({ http: 200, data: { ok: false, error: 'unexpected' } });
      }
    },
    ui: {
      toast: function () {},
      shake: function () {},
      confetti: function () {},
      setLoading: function () {},
      ripple: function () {}
    }
  };
  window.SR = SR;
})();
"""


def build(page, role, data, name):
    src = (DEPLOY / page).read_text(encoding="utf-8")
    stub = (STUB.replace("__DATA__", json.dumps(data, ensure_ascii=False))
                .replace("__ROLE__", json.dumps(role))
                .replace("__P__", json.dumps(P1)))
    marker = '<script src="auth-core.js"></script>'
    if marker not in src:
        raise SystemExit("找不到 auth-core.js 的引用：" + page)
    out = TMP / name
    out.write_text(src.replace(marker, "<script>" + stub + "</script>"), encoding="utf-8")
    return out


def week_rows():
    return [{"publish_id": P1, "day": d, "slot": ("early" if d < 5 else "rest"),
             "role": ("open" if d == 0 else None)} for d in range(7)]


EMPLOYEE_DATA = {
    "published_shifts": week_rows(),
    "publish_deliveries": [{"id": 9, "publish_id": P1, "status": "pending", "seen_at": None}],
}

MANAGER_DATA = {
    "weeks": [{"week_key": "2026-10-26", "status": "published"}],
    "staff": [
        {"name": "张三", "domain": "3c", "module": "A", "position": "顾问", "level": "P4"},
        {"name": "李四", "domain": "3c", "module": "A", "position": "顾问", "level": "P4"},
        {"name": "王五", "domain": "hongmeng", "module": "B", "position": "顾问", "level": "P3"},
    ],
    "shifts": [{"staff_name": "张三", "day": 0, "slot": "early", "role": None}],
    "publish_versions": [{"publish_id": P1, "version": 3, "published_at": "2026-10-26T01:00:00Z"}],
    "publish_deliveries": [
        {"staff_name": "张三", "status": "seen"},
        {"staff_name": "李四", "status": "seen"},
        {"staff_name": "王五", "status": "pending"},
    ],
}


class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.n = 0

    def send(self, method, params=None, timeout=20):
        self.n += 1
        mid = self.n
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        end = time.time() + timeout
        while time.time() < end:
            msg = json.loads(self.ws.recv(timeout=timeout))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError("%s -> %s" % (method, msg["error"]))
                return msg.get("result", {})
        raise TimeoutError(method)

    def ev(self, expr):
        r = self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        return r.get("result", {}).get("value")


def wait_targets(port, deadline=30):
    url = "http://127.0.0.1:%d/json/list" % port
    end = time.time() + deadline
    while time.time() < end:
        try:
            with urllib.request.urlopen(url, timeout=2) as f:
                tabs = json.load(f)
            pages = [t for t in tabs if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
            if pages:
                return pages
        except Exception:
            pass
        time.sleep(0.25)
    raise RuntimeError("Edge 调试端口没起来")


def main():
    TMP.mkdir(parents=True, exist_ok=True)
    emp = build("me.html", "employee", EMPLOYEE_DATA, "me.html")
    mgr = build("manager.html", "manager", MANAGER_DATA, "manager.html")

    port = 9351
    prof = Path(os.environ["TEMP"]) / ("edge-ack-%d" % port)
    proc = subprocess.Popen([
        EDGE, "--headless=new", "--remote-debugging-port=%d" % port,
        "--user-data-dir=%s" % prof, "--no-first-run", "--no-default-browser-check",
        "--window-size=1280,900", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    fails = []
    try:
        tabs = wait_targets(port)
        with connect(tabs[0]["webSocketDebuggerUrl"], max_size=8 << 20) as ws:
            cdp = CDP(ws)
            cdp.send("Page.enable")
            cdp.send("Runtime.enable")

            # ---------- 员工端 ----------
            cdp.send("Page.navigate", {"url": emp.as_uri()})
            time.sleep(1.5)

            txt = cdp.ev("(document.querySelector('.ackbar')||{}).textContent || ''")
            btn = cdp.ev("!!document.querySelector('#ackBtn')")
            done0 = cdp.ev("!!document.querySelector('.ackbar.done')")
            print("员工端 · 回执条:", (txt or "").strip()[:60])
            if not btn:
                fails.append("员工端没有渲染出 #ackBtn")
            if done0:
                fails.append("员工端一开始就显示已确认，状态判断错了")

            cdp.ev("document.querySelector('#ackBtn').click()")
            time.sleep(0.6)

            calls = cdp.ev("JSON.stringify(window.__calls)")
            txt2 = cdp.ev("(document.querySelector('.ackbar.done')||{}).textContent || ''")
            print("员工端 · 点击后:", (txt2 or "").strip()[:60])
            print("员工端 · 发出的请求:", calls)
            if not txt2:
                fails.append("点击后没有变成已确认状态（.ackbar.done 缺失）")
            if "已确认知晓" not in (txt2 or ""):
                fails.append("已确认文案不对：%s" % txt2)
            try:
                first = json.loads(calls)[0]
                body = first["body"]
                if body.get("publish_id") != P1 or not body.get("token"):
                    fails.append("ack 请求体不对：%s" % body)
                # 必须带 auth：否则网关先 401，函数体跑不到
                if first.get("auth") != "fake-token-for-smoke":
                    fails.append("ack 没带 auth（Supabase 网关要 Verify JWT），实际：%r" % first.get("auth"))
            except Exception:
                fails.append("ack 请求没有发出去")
            errs = cdp.ev("JSON.stringify(window.__errors)")
            if errs not in (None, "[]"):
                fails.append("员工端 JS 报错：%s" % errs)

            # ---------- 经理端 ----------
            cdp.send("Page.navigate", {"url": mgr.as_uri()})
            time.sleep(1.5)

            badge = cdp.ev("(document.querySelector('#pubBadge')||{}).textContent || ''")
            title = cdp.ev("(document.querySelector('#pubBadge')||{}).title || ''")
            print("经理端 · 徽标:", (badge or "").strip())
            print("经理端 · 提示:", (title or "").strip())
            if "已知晓 2/3" not in (badge or ""):
                fails.append("经理端徽标没有出现「已知晓 2/3」，实际：%s" % badge)
            if "王五" not in (title or ""):
                fails.append("经理端没有把未确认的人写进 title，实际：%s" % title)
            errs2 = cdp.ev("JSON.stringify(window.__errors)")
            if errs2 not in (None, "[]"):
                fails.append("经理端 JS 报错：%s" % errs2)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except Exception:
            proc.kill()

    print("")
    if fails:
        print("SMOKE FAILED:")
        for f in fails:
            print("  - " + f)
        return 1
    print("SMOKE PASSED: 员工端确认 + 经理端计数 都正常")
    return 0


if __name__ == "__main__":
    sys.exit(main())
