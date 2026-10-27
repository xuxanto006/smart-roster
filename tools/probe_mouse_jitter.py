# -*- coding: utf-8 -*-
"""用 CDP 驱动无头 Edge，在桌面上逐个坐标移动鼠标，逐帧读取布局指纹。

目的：确认「移动鼠标就抖」到底是【布局回流】（rect 会变）还是【纯合成重绘】（rect 不变）。

用法：
  python tools/probe_mouse_jitter.py _deploy/login.html
  python tools/probe_mouse_jitter.py _deploy/manager.html 1440 900
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

FINGERPRINT = r"""
(function () {
  function r(sel) {
    var e = document.querySelector(sel);
    if (!e) return null;
    var b = e.getBoundingClientRect();
    return [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10,
            Math.round(b.width * 10) / 10, Math.round(b.height * 10) / 10];
  }
  var de = document.documentElement;
  var moved = [];
  document.querySelectorAll('*').forEach(function (e) {
    var t = e.style && e.style.transform;
    if (t) moved.push((e.className || e.tagName) + ' | ' + t);
  });
  return JSON.stringify({
    iw: window.innerWidth,
    cw: de.clientWidth,
    ch: de.clientHeight,
    sy: Math.round(window.scrollY),
    sh: document.body.scrollHeight,
    dsh: de.scrollHeight,
    card: r('.card'),
    page: r('.page'),
    legal: r('.legal'),
    topbar: r('.topbar'),
    wrap: r('.wrap'),
    sheet: r('.sheet-wrap'),
    transforms: moved
  });
})()
"""


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
        r = self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True,
                                           "awaitPromise": False})
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
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    page = (ROOT / sys.argv[1]) if not os.path.isabs(sys.argv[1]) else Path(sys.argv[1])
    w = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
    h = int(sys.argv[3]) if len(sys.argv) > 3 else 800
    url = page.as_uri()

    port = 9345
    tmp = Path(os.environ["TEMP"]) / ("edge-jitter-%d" % port)
    proc = subprocess.Popen([
        EDGE, "--headless=new", "--remote-debugging-port=%d" % port,
        "--user-data-dir=%s" % tmp, "--no-first-run", "--no-default-browser-check",
        "--window-size=%d,%d" % (w, h), "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        tabs = wait_targets(port)
        with connect(tabs[0]["webSocketDebuggerUrl"], max_size=8 << 20) as ws:
            cdp = CDP(ws)
            cdp.send("Page.enable")
            cdp.send("Runtime.enable")
            cdp.send("Page.navigate", {"url": url})
            time.sleep(2.5)
            print("page:", url)
            print("title:", cdp.ev("document.title"))

            seen = {}
            order = []
            # 覆盖整屏的扫描路径（含按钮/卡片区域）
            pts = []
            for i in range(1, 9):
                pts.append((int(w * i / 9), int(h * 0.15)))
                pts.append((int(w * i / 9), int(h * 0.50)))
                pts.append((int(w * i / 9), int(h * 0.85)))
            for (x, y) in pts:
                cdp.send("Input.dispatchMouseEvent",
                         {"type": "mouseMoved", "x": x, "y": y, "button": "none",
                          "buttons": 0, "pointerType": "mouse"})
                time.sleep(0.06)
                fp = cdp.ev(FINGERPRINT)
                if fp not in seen:
                    seen[fp] = 1
                    order.append(fp)
                else:
                    seen[fp] += 1

            print("采样点: %d, 不同指纹: %d" % (len(pts), len(order)))
            base = json.loads(order[0])
            for i, fp in enumerate(order):
                d = json.loads(fp)
                print("\n--- 指纹 #%d (命中 %d 次) ---" % (i + 1, seen[fp]))
                for k in ("iw", "cw", "ch", "sy", "sh", "dsh", "card", "page",
                          "legal", "topbar", "wrap", "sheet"):
                    if d.get(k) != base.get(k):
                        print("  [变化] %s: %s  ->  %s" % (k, base.get(k), d.get(k)))
                if i == 0:
                    print("  iw=%s cw=%s ch=%s sh=%s dsh=%s" %
                          (d["iw"], d["cw"], d["ch"], d["sh"], d["dsh"]))
                    print("  card=%s legal=%s" % (d["card"], d["legal"]))
                if d.get("transforms"):
                    print("  行内 transform:", d["transforms"])

            if len(order) == 1:
                print("\n结论：移动鼠标过程中布局完全不变 → 抖动不是布局回流，"
                      "而是合成/重绘层（backdrop-filter、混合层等）。")
            else:
                print("\n结论：移动鼠标时布局在变 → 是真实回流（rect/scrollHeight 变化）。")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except Exception:
            proc.kill()
    return 0


if __name__ == "__main__":
    sys.exit(main())
