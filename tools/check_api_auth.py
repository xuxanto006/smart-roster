# -*- coding: utf-8 -*-
"""验证 auth-core.js 的 SR.api.call 发出去的请求头。

为什么需要：
  ack 函数在 Supabase 侧开了「Verify JWT」，不带 Authorization 网关直接 401
  （UNAUTHORIZED_NO_AUTH_HEADER），函数里的 whoami 根本没机会跑。
  于是 call() 新增了 opts.auth，只给需要过网关的函数加这个头；
  其余函数（publish / login ...）必须继续是「简单请求」，否则会平白多出预检。

本脚本用无头 Edge 真正加载 _deploy/auth-core.js，拦下 fetch 看实际 init：
  · 传 auth  → 有 Authorization: Bearer <token>，Content-Type 仍是 text/plain
  · 不传     → 完全没有 Authorization，也不该有任何自定义头

用法：python tools/check_api_auth.py
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
CORE = (ROOT / "_deploy" / "auth-core.js").as_uri()
TMP = Path(os.environ["TEMP"]) / "sr-auth-check"

PAGE = """<!doctype html>
<meta charset="utf-8">
<script src="%s"></script>
<script>
window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });
window.__log = [];
window.fetch = function (url, init) {
  window.__log.push({
    url: String(url),
    headers: (init && init.headers) || {},
    body: (init && init.body) || ''
  });
  return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
};
window.__run = function () {
  return Promise.all([
    SR.api.call('ack', { method: 'POST', auth: 'TOKEN-A', body: { token: 'TOKEN-A', publish_id: 'p1' } }),
    SR.api.call('publish', { method: 'POST', body: { token: 'TOKEN-B', week_key: 'w' } }),
    SR.api.call('login', { method: 'POST', body: { username: 'u' } })
  ]).then(function (res) {
    return JSON.stringify({
      hasSR: !!window.SR,
      http: res.map(function (r) { return r.http; }),
      log: window.__log,
      errs: window.__errs
    });
  });
};
</script>
""" % CORE


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

    def ev(self, expr, await_promise=False):
        r = self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True,
                                           "awaitPromise": await_promise})
        res = r.get("result", {})
        if res.get("subtype") == "error":
            raise RuntimeError(res.get("description", "evaluate error"))
        return res.get("value")


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
    page = TMP / "index.html"
    page.write_text(PAGE, encoding="utf-8")

    port = 9357
    prof = Path(os.environ["TEMP"]) / ("edge-auth-%d" % port)
    proc = subprocess.Popen([
        EDGE, "--headless=new", "--remote-debugging-port=%d" % port,
        "--user-data-dir=%s" % prof, "--no-first-run", "--no-default-browser-check",
        "--window-size=1024,768", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    fails = []
    try:
        tabs = wait_targets(port)
        with connect(tabs[0]["webSocketDebuggerUrl"], max_size=8 << 20) as ws:
            cdp = CDP(ws)
            cdp.send("Page.enable")
            cdp.send("Runtime.enable")
            cdp.send("Page.navigate", {"url": page.as_uri()})
            time.sleep(1.2)

            raw = cdp.ev("window.__run()", await_promise=True)
            if not raw:
                print("页面没有返回结果")
                return 1
            out = json.loads(raw)

            print("auth-core 已加载:", out["hasSR"])
            if not out["hasSR"]:
                fails.append("window.SR 不存在（auth-core.js 没加载成功）")

            for i, entry in enumerate(out["log"]):
                print("\n请求 #%d  %s" % (i + 1, entry["url"]))
                for k, v in entry["headers"].items():
                    print("   %-14s %s" % (k, v))
                print("   body          %s" % entry["body"])

            if len(out["log"]) != 3:
                fails.append("只拦截到 %d 个请求，应为 3" % len(out["log"]))
            else:
                ack, pub, login = out["log"]

                if ack["headers"].get("Authorization") != "Bearer TOKEN-A":
                    fails.append("ack 没带 Authorization: Bearer <token>，过不了 Supabase 网关验签")
                if ack["headers"].get("Content-Type") != "text/plain;charset=UTF-8":
                    fails.append("ack 的 Content-Type 不是 text/plain")
                if json.loads(ack["body"]).get("publish_id") != "p1":
                    fails.append("ack 的 body 不对：%s" % ack["body"])

                for name, e in (("publish", pub), ("login", login)):
                    if "Authorization" in e["headers"]:
                        fails.append("%s 多带了 Authorization，会平白触发预检" % name)
                    if e["headers"].get("Content-Type") != "text/plain;charset=UTF-8":
                        fails.append("%s 的 Content-Type 不是 text/plain" % name)
                    extra = set(e["headers"]) - {"Content-Type"}
                    if extra:
                        fails.append("%s 带了额外自定义头 %s，会触发预检" % (name, sorted(extra)))

            if out["errs"]:
                fails.append("页面 JS 报错：%s" % out["errs"])
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except Exception:
            proc.kill()

    print("")
    if fails:
        print("AUTH HEADER CHECKS FAILED:")
        for f in fails:
            print("  - " + f)
        return 1
    print("AUTH HEADER CHECKS PASSED: ack 带 Bearer，其余仍是简单请求")
    return 0


if __name__ == "__main__":
    sys.exit(main())
