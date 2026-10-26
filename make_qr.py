#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""团队智能排班系统 —— 艺术化扫码卡
品牌配色：#F7F3EC 底 / #FDFBF7 卡片 / #3E2B23 主色 / #7A6A5E 正文
          #8B5A4A 强调 / #E2D5C8 分隔线；英文用衬线体点缀。
生成后用 OpenCV 逐档校验可扫性，取「能通过且 logo 最大」的一档。
"""
import os
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont

URL = "https://267d2497fa554854b724aede4b83caa5.app.workbuddy.link"
SRC_DIR = "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59"   # 应用目录（assets/pai_logo.png 所在）

BG     = (247, 243, 236)   # #F7F3EC
CARD   = (253, 251, 247)   # #FDFBF7
INK    = (62, 43, 35)      # #3E2B23
BODY   = (122, 106, 94)    # #7A6A5E
ACCENT = (139, 90, 74)     # #8B5A4A
LINE   = (226, 213, 200)   # #E2D5C8
RED    = (181, 67, 58)     # 花瓣红
RED_D  = (150, 52, 45)     # 花瓣暗部

W      = 1240
SS     = 3                 # 超采样倍数
QR_PX  = 680               # 二维码本体边长（最终像素）

F_CJK   = "/System/Library/Fonts/PingFang.ttc"
F_SERIF = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
F_SANS  = "/System/Library/Fonts/Helvetica.ttc"


def font(path, size):
    return ImageFont.truetype(path, int(size))


# ---------------------------------------------------------------- 文字工具
def text_ls(d, cx, y, text, f, fill, ls=0, anchor_top=True):
    """带字距的居中文字。返回底边 y。"""
    return text_ls_mixed(d, cx, y, [(text, f)], fill, ls)


def text_ls_mixed(d, cx, y, segs, fill, ls=0):
    """分段字体 + 字距的居中文字：segs = [(文本, 字体), ...]。"""
    chars = []
    for text, f in segs:
        chars += [(ch, f) for ch in text]
    ws = [d.textlength(ch, font=f) for ch, f in chars]
    total = sum(ws) + ls * (len(chars) - 1)
    x = cx - total / 2
    for (ch, f), w in zip(chars, ws):
        d.text((x, y), ch, font=f, fill=fill)
        x += w + ls
    return y + max(f.size for _, f in segs) * 1.25


def text_c(d, cx, y, text, f, fill):
    w = d.textlength(text, font=f)
    d.text((cx - w / 2, y), text, font=f, fill=fill)
    return y + f.size * 1.3


# ---------------------------------------------------------------- 华为花瓣
# 官方花瓣符号（Simple Icons 收录的 Huawei 图形，Guardsman Red #C7000B）
HUAWEI_RED = (199, 0, 11)   # #C7000B
HUAWEI_PATH = ("M3.67 6.14S1.82 7.91 1.72 9.78v.35c.08 1.51 1.22 2.4 1.22 2.4 1.83 1.79 6.26 4.04 7.3 4.55 0 0 .06.03.1-.01l.02-.04v-.04C7.52 10.8 3.67 6.14 3.67 6.14z"
"M9.65 18.6c-.02-.08-.1-.08-.1-.08l-7.38.26c.8 1.43 2.15 2.53 3.56 2.2.96-.25 3.16-1.78 3.88-2.3.06-.05.04-.09.04-.09zm.08-.78C6.49 15.63.21 12.28.21 12.28c-.15.46-.2.9-.21 1.3v.07c0 1.07.4 1.82.4 1.82.8 1.69 2.34 2.2 2.34 2.2.7.3 1.4.31 1.4.31.12.02 4.4 0 5.54 0 .05 0 .08-.05.08-.05v-.06c0-.03-.03-.05-.03-.05z"
"M9.06 3.19a3.42 3.42 0 00-2.57 3.15v.41c.03.6.16 1.05.16 1.05.66 2.9 3.86 7.65 4.55 8.65.05.05.1.03.1.03a.1.1 0 00.06-.1c1.06-10.6-1.11-13.42-1.11-13.42-.32.02-1.19.23-1.19.23z"
"m8.299 2.27s-.49-1.8-2.44-2.28c0 0-.57-.14-1.17-.22 0 0-2.18 2.81-1.12 13.43.01.07.06.08.06.08.07.03.1-.03.1-.03.72-1.03 3.9-5.76 4.55-8.64 0 0 .36-1.4.02-2.34z"
"m-2.92 13.07s-.07 0-.09.05c0 0-.01.07.03.1.7.51 2.85 2 3.88 2.3 0 0 .16.05.43.06h.14c.69-.02 1.9-.37 3-2.26l-7.4-.25z"
"m7.83-8.41c.14-2.06-1.94-3.97-1.94-3.98 0 0-3.85 4.66-6.67 10.8 0 0-.03.08.02.13l.04.01h.06c1.06-.53 5.46-2.77 7.28-4.54 0 0 1.15-.93 1.21-2.42z"
"m1.52 2.14s-6.28 3.37-9.52 5.55c0 0-.05.04-.03.11 0 0 .03.06.07.06 1.16 0 5.56 0 5.67-.02 0 0 .57-.02 1.27-.29 0 0 1.56-.5 2.37-2.27 0 0 .73-1.45.17-3.14z")

import math, re

def _arc_points(x1, y1, rx, ry, phi, fA, fS, x2, y2, steps=32):
    """SVG 椭圆弧（端点参数）→ 采样点列（标准 F.6.5 算法）。"""
    if rx == 0 or ry == 0 or (x1 == x2 and y1 == y2):
        return [(x2, y2)]
    phi = math.radians(phi)
    dx2, dy2 = (x1 - x2) / 2, (y1 - y2) / 2
    x1p =  math.cos(phi) * dx2 + math.sin(phi) * dy2
    y1p = -math.sin(phi) * dx2 + math.cos(phi) * dy2
    rx, ry = abs(rx), abs(ry)
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1:
        s = math.sqrt(lam)
        rx, ry = rx * s, ry * s
    den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2
    num = rx ** 2 * ry ** 2 - den
    c = math.sqrt(max(0.0, num / den)) if den else 0.0
    if fA == fS:
        c = -c
    cxp, cyp = c * rx * y1p / ry, -c * ry * x1p / rx
    cx = math.cos(phi) * cxp - math.sin(phi) * cyp + (x1 + x2) / 2
    cy = math.sin(phi) * cxp + math.cos(phi) * cyp + (y1 + y2) / 2
    def ang(ux, uy, vx, vy):
        dd = math.hypot(ux, uy) * math.hypot(vx, vy)
        a = math.acos(max(-1.0, min(1.0, (ux * vx + uy * vy) / dd)))
        return a if ux * vy - uy * vx >= 0 else -a
    th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not fS and dth > 0: dth -= 2 * math.pi
    if fS and dth < 0:     dth += 2 * math.pi
    out = []
    for k in range(1, steps + 1):
        t = th1 + dth * k / steps
        ct, st = math.cos(t), math.sin(t)
        out.append((cx + rx * ct * math.cos(phi) - ry * st * math.sin(phi),
                    cy + rx * ct * math.sin(phi) + ry * st * math.cos(phi)))
    return out


def _cubic_points(x0, y0, c1x, c1y, c2x, c2y, x3, y3, steps=28):
    pts = []
    for k in range(1, steps + 1):
        t = k / steps
        mt = 1 - t
        pts.append((mt**3*x0 + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t**3*x3,
                    mt**3*y0 + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t**3*y3))
    return pts


NUM_RE = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")

class _R:
    """顺序读取器：命令字母 / 数字 / 弧线旗标分开读，
    否则 '00-2.57' 这种两个旗标连写会被正则吞成一个数。"""
    def __init__(self, d):
        self.d, self.i = d, 0
    def _ws(self):
        while self.i < len(self.d) and self.d[self.i] in " \t\r\n,":
            self.i += 1
    def cmd(self):
        self._ws()
        if self.i < len(self.d) and self.d[self.i].isalpha():
            c = self.d[self.i]
            self.i += 1
            return c
        return None
    def num(self):
        self._ws()
        m = NUM_RE.match(self.d, self.i)
        if not m:
            raise ValueError(f"位置 {self.i} 处期望数字：…{self.d[self.i:self.i+12]!r}")
        self.i = m.end()
        return float(m.group())
    def flag(self):
        self._ws()
        if self.d[self.i] not in "01":
            raise ValueError(f"位置 {self.i} 处期望旗标 0/1：…{self.d[self.i:self.i+12]!r}")
        self.i += 1
        return int(self.d[self.i - 1])


def path_subpaths(d):
    """极简 SVG path 解析器（够用即可）：M/L/H/V/C/S/Q/T/A/Z 大小写 → 子路径点列。"""
    r = _R(d)
    subs, cur = [], []
    x = y = sx = sy = 0.0
    last = None                 # 上一条命令（隐式重复用；M 的后续按 L 处理）
    prev_c2 = None              # 上一条 C/S 的第二控制点（绝对坐标），S 用来做反射

    def flush():
        nonlocal cur
        if len(cur) > 2:
            subs.append(cur)
        cur = []

    while True:
        c = r.cmd()
        if c is None:
            if last is None or r.i >= len(r.d):   # 数据读完（含最后是 Z 的情况）
                break
            c = last if last.upper() != "M" else ("l" if last == "m" else "L")
        else:
            last = c
        rel = c.islower()
        C = c.upper()
        if C == "Z":
            if cur:
                cur.append((sx, sy))
            x, y = sx, sy
            flush()
            prev_c2 = None
            continue
        if C == "M":
            nx, ny = (x + r.num(), y + r.num()) if rel else (r.num(), r.num())
            flush()
            sx, sy = x, y = nx, ny
            cur = [(x, y)]
            last = "l" if rel else "L"        # M 后续隐式按 L 处理
            prev_c2 = None
        elif C == "L":
            x, y = (x + r.num(), y + r.num()) if rel else (r.num(), r.num())
            cur.append((x, y))
            prev_c2 = None
        elif C == "H":
            x = x + r.num() if rel else r.num()
            cur.append((x, y))
            prev_c2 = None
        elif C == "V":
            y = y + r.num() if rel else r.num()
            cur.append((x, y))
            prev_c2 = None
        elif C == "C":
            x0, y0 = x, y
            a, b, cc, dd = r.num(), r.num(), r.num(), r.num()
            if rel:
                c1x, c1y, c2x, c2y = x0 + a, y0 + b, x0 + cc, y0 + dd
                x, y = x0 + r.num(), y0 + r.num()
            else:
                c1x, c1y, c2x, c2y = a, b, cc, dd
                x, y = r.num(), r.num()
            cur += _cubic_points(x0, y0, c1x, c1y, c2x, c2y, x, y)
            prev_c2 = (c2x, c2y)
        elif C == "S":
            cx2, cy2 = (2 * x - prev_c2[0], 2 * y - prev_c2[1]) if prev_c2 else (x, y)
            x0, y0 = x, y
            a, b = r.num(), r.num()
            if rel:
                c2x, c2y = x0 + a, y0 + b
                x, y = x0 + r.num(), y0 + r.num()
            else:
                c2x, c2y = a, b
                x, y = r.num(), r.num()
            cur += _cubic_points(x0, y0, cx2, cy2, c2x, c2y, x, y)
            prev_c2 = (c2x, c2y)
        elif C == "A":
            rx, ry, rot = r.num(), r.num(), r.num()
            fA, fS = r.flag(), r.flag()
            x2, y2 = (x + r.num(), y + r.num()) if rel else (r.num(), r.num())
            cur += _arc_points(x, y, rx, ry, rot, fA, fS, x2, y2)
            x, y = x2, y2
            prev_c2 = None
    flush()
    return subs


def pai_logo(size):
    """「排」字 logo（用户提供的透明 PNG，assets/pai_logo.png），等比缩放居中。"""
    src = Image.open(SRC_DIR + "/assets/pai_logo.png").convert("RGBA")
    s = size / max(src.size)
    w, h = max(1, round(src.size[0] * s)), max(1, round(src.size[1] * s))
    glyph = src.resize((w, h), Image.LANCZOS)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(glyph, ((size - w) // 2, (size - h) // 2), glyph)
    return img


# ---------------------------------------------------------------- 花瓣 logo
def petal_logo(size):
    """6 片旋转花瓣（品牌 FOCUS 的红色花瓣意象），4 倍超采样后缩回。"""
    S = 4
    L = size * S
    img = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    cx = cy = L / 2
    pw, ph = L * 0.30, L * 0.54
    for i in range(6):
        lay = Image.new("RGBA", (L, L), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        x0, y0 = cx - pw / 2, cy - L * 0.235 - ph / 2
        col = (RED if i % 2 == 0 else RED_D) + (228,)
        ld.ellipse([x0, y0, x0 + pw, y0 + ph], fill=col)
        img = Image.alpha_composite(img, lay.rotate(i * 60, resample=Image.BICUBIC, center=(cx, cy)))
    d = ImageDraw.Draw(img)
    r = L * 0.072
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK + (255,))
    return img.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- 二维码
def build_matrix(url):
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=10, border=0)
    qr.add_data(url)
    qr.make(fit=True)
    return qr.get_matrix()


def _in_finder(n, r, c):
    for r0, c0 in ((0, 0), (0, n - 7), (n - 7, 0)):
        if r0 <= r < r0 + 7 and c0 <= c < c0 + 7:
            return True
    return False


def draw_qr(m, px, fg=INK, bg=CARD, ratio=0.88, rad=0.30):
    """圆角模块 + 圆角定位角。数据模块略微内缩，留出呼吸缝。"""
    n = len(m)
    s = px / n
    img = Image.new("RGB", (px, px), bg)
    d = ImageDraw.Draw(img)
    pad = (1 - ratio) / 2 * s
    for r in range(n):
        for c in range(n):
            if not m[r][c] or _in_finder(n, r, c):
                continue
            x, y = c * s + pad, r * s + pad
            d.rounded_rectangle([x, y, x + s * ratio, y + s * ratio],
                                radius=s * ratio * rad, fill=fg)
    for r0, c0 in ((0, 0), (0, n - 7), (n - 7, 0)):
        x0, y0 = c0 * s, r0 * s
        d.rounded_rectangle([x0, y0, x0 + 7 * s, y0 + 7 * s], radius=7 * s * 0.30, fill=fg)
        d.rounded_rectangle([x0 + s, y0 + s, x0 + 6 * s, y0 + 6 * s], radius=6 * s * 0.28, fill=bg)
        d.rounded_rectangle([x0 + 2 * s, y0 + 2 * s, x0 + 5 * s, y0 + 5 * s], radius=5 * s * 0.30, fill=fg)
    return img


def with_logo(qr_img, ratio):
    """中心挖一块底色圆角板，再压上花瓣。遮挡要干净，不能留半截模块。"""
    px = qr_img.size[0]
    img = qr_img.copy()
    L = px * ratio
    plate = L * 1.20
    x0 = y0 = (px - plate) / 2
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x0 + plate, y0 + plate], radius=plate * 0.26, fill=CARD)
    lg = pai_logo(int(L))
    img.paste(lg, (int((px - L) / 2), int((px - L) / 2)), lg)
    return img


# ---------------------------------------------------------------- 可扫性校验
def _read(pil_img):
    """优先 zxing-cpp（对花式码的容忍度比 OpenCV 高），没有就退回 OpenCV。"""
    try:
        import zxingcpp
        r = zxingcpp.read_barcode(pil_img.convert("RGB"))
        return r.text if r else ""
    except ImportError:
        pass
    import cv2
    import numpy as np
    arr = cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)
    det = cv2.QRCodeDetector()
    return det.detectAndDecode(arr)[0] or det.detectAndDecodeCurved(arr)[0]


def decodes(pil_img, widths=(1240, 900, 620, 460)):
    """在若干尺寸下都能解出来才算过（模拟手机远近、不同清晰度扫描）。"""
    ok = []
    for w in widths:
        if w >= pil_img.size[0]:
            im = pil_img
        else:
            h = max(1, int(pil_img.size[1] * w / pil_img.size[0]))
            im = pil_img.resize((w, h), Image.LANCZOS)
        txt = _read(im)
        ok.append((w, bool(txt), txt))
    return ok


# ---------------------------------------------------------------- 主流程
def compose(qr_img):
    n = len(build_matrix(URL))
    quiet = int(round(4 * (QR_PX / n)))          # 4 个模块的静区
    card = QR_PX + quiet * 2
    top_card = 372
    H = top_card + card + 452

    img = Image.new("RGB", (W * SS, H * SS), BG)
    d = ImageDraw.Draw(img)
    cx = W * SS / 2
    P = lambda v: int(round(v * SS))              # 逻辑像素 → 画布像素（必须取整，paste 不接受浮点）

    # 外框
    d.rounded_rectangle([P(44), P(44), P(W - 44), P(H - 44)],
                        radius=P(18), outline=LINE, width=max(1, int(P(2))))

    f_kick  = font(F_SERIF, 27 * SS)
    f_title = ImageFont.truetype(F_CJK, 74 * SS, index=8)      # PingFang SC Semibold
    f_cap   = ImageFont.truetype(F_CJK, 37 * SS, index=8)
    f_cjk   = font(F_CJK, 23 * SS)
    f_sub   = font(F_CJK, 24 * SS)
    f_hint  = font(F_CJK, 21 * SS)
    f_foot  = font(F_SERIF, 23 * SS)
    f_url   = font(F_SANS, 19 * SS)

    y = P(126)
    text_ls(d, cx, y, "TEAM  SCHEDULER", f_kick, ACCENT, ls=P(7))
    y = P(186)
    text_c(d, cx, y, "团队智能排班系统", f_title, INK)

    # 分隔线
    y = P(316)
    d.line([cx - P(84), y, cx + P(84), y], fill=LINE, width=max(1, int(P(2))))

    # 卡片
    cbx, cby = P((W - (card + 40)) / 2), P(top_card - 20)
    cbw = P(card + 40)
    d.rounded_rectangle([cbx, cby, cbx + cbw, cby + cbw], radius=P(26), fill=CARD)
    d.rounded_rectangle([cbx, cby, cbx + cbw, cby + cbw], radius=P(26), outline=LINE, width=max(1, int(P(1))))

    # 二维码按超采样分辨率直接生成、直接贴上，不经过二次缩放，
    # 否则 3 倍放大再缩回来会让模块边缘发虚，直接影响识别率
    qx = cbx + (cbw - P(QR_PX)) // 2
    qy = cby + (cbw - P(QR_PX)) // 2
    img.paste(qr_img, (qx, qy))

    y = P(top_card + card + 62)
    text_c(d, cx, y, "扫码即用 · 无需登录", f_cap, INK)
    y = P(top_card + card + 126)
    text_c(d, cx, y, "31 人名册与全部排班规则已内置，打开即是这套配置", f_sub, BODY)
    y = P(top_card + card + 166)
    text_c(d, cx, y, "建议在电脑上打开，手机请横屏查看完整班表", f_hint, BODY)

    y = P(H - 128)
    text_ls_mixed(d, cx, y, [("LINI  ", f_foot), ("木栖", f_cjk), ("  ·  STUDIO", f_foot)],
                  ACCENT, ls=P(5))
    y = P(H - 84)
    text_c(d, cx, y, URL, f_url, BODY)

    return img.resize((W, H), Image.LANCZOS)


def main():
    m = build_matrix(URL)
    print(f"矩阵 {len(m)}×{len(m)} ｜ 纠错等级 H（30%）")

    chosen = None
    for ratio in (0.34, 0.32, 0.30, 0.28, 0.26, 0.22, 0.18):
        qr = with_logo(draw_qr(m, QR_PX * SS), ratio)
        res = decodes(qr, widths=(QR_PX * SS, 900, 560, 400))
        good = all(ok for _, ok, _ in res)
        print(f"  logo 占比 {ratio:.0%} → " + "  ".join(f"{w}px:{'✅' if ok else '❌'}" for w, ok, _ in res))
        if good:
            chosen = (ratio, qr)
            break
    if not chosen:
        raise SystemExit("所有档位都扫不出来，需要减小 logo 或降低圆角")

    ratio, qr = chosen
    print(f"采用 logo 占比 {ratio:.0%}")

    poster = compose(qr)
    res = decodes(poster, widths=(1240, 900, 620, 460))
    print("成品校验：" + "  ".join(f"{w}px:{'✅' if ok else '❌'}" for w, ok, _ in res))
    for w, ok, txt in res:
        if ok and txt != URL:
            print(f"  ⚠️ {w}px 解出的内容和原链接不一致：{txt}")
    if not all(ok for _, ok, _ in res):
        raise SystemExit("成品扫不出来")

    out = "/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/分享/排班系统_扫码卡.png"
    poster.save(out, "PNG", optimize=True)
    print("已保存：" + out, poster.size)

    # 附一张纯二维码方形版（直接贴进群公告 / 聊天用）
    sq = 1080
    n2 = len(m)
    quiet = int(round(4 * (sq / n2)))            # 4 模块静区
    bare = Image.new("RGB", (sq + quiet * 2, sq + quiet * 2), CARD)
    q = with_logo(draw_qr(m, sq * SS), ratio).resize((sq, sq), Image.LANCZOS)
    bare.paste(q, (quiet, quiet))
    out2 = "/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/分享/排班系统_二维码_纯码.png"
    bare.save(out2, "PNG", optimize=True)
    chk = decodes(bare, widths=(bare.size[0], 640, 420))
    print("纯码校验：" + "  ".join(f"{w}px:{'✅' if ok else '❌'}" for w, ok, _ in chk))
    print("已保存：" + out2, bare.size)


if __name__ == "__main__":
    main()
