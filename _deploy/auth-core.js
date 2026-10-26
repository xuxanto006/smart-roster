/* ============================================================
   auth-core.js · 认证页公共层
   - 与 Supabase Edge Functions 通信（captcha / register / login）
   - 设备指纹、会话存储
   - 液态玻璃交互：涟漪、3D 倾斜、光斑跟随、撒花、Toast
   无外部依赖，暴露 window.SR
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'https://xoqvrkqxtipkavmfaxyy.supabase.co';
  var KEY = 'sb_publishable_Jc4L1kJ4RvLQaTrMvtrt7A_iMLGyAFx';
  var DEVICE_KEY = 'sr.device';
  var SESSION_KEY = 'sr.session';
  var LAST_USER_KEY = 'sr.lastUser';

  /* ---------------- 基础工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomId(nBytes) {
    var a = new Uint8Array(nBytes);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var i = 0; i < nBytes; i++) a[i] = Math.floor(Math.random() * 256);
    return b64url(a);
  }

  /* 设备指纹：24 字节 -> 32 字符 base64url，满足服务端 ^[A-Za-z0-9_-]{16,128}$ */
  function deviceId() {
    try {
      var v = localStorage.getItem(DEVICE_KEY);
      if (!v || !/^[A-Za-z0-9_-]{16,128}$/.test(v)) {
        v = randomId(24);
        localStorage.setItem(DEVICE_KEY, v);
      }
      return v;
    } catch (e) {
      return randomId(24);
    }
  }

  function ua() {
    try { return String(navigator.userAgent || '').slice(0, 300); } catch (e) { return ''; }
  }

  /* ---------------- 网络层 ---------------- */
  /* Edge Functions 全部走「简单请求」（Simple Request），刻意避开 CORS 预检：
       - 不带 apikey / Authorization 等自定义头（这些函数用服务端密钥，不需要）
       - POST 的 Content-Type 用 text/plain（application/json 会触发预检）
     Deno 的 req.json() 只解析 body，不看 Content-Type，所以服务端照常工作。
     实测：2026-10 线上环境这样发可直达函数，省掉 OPTIONS 往返。 */
  function call(fn, opts) {
    var o = opts || {};
    var url = BASE + '/functions/v1/' + fn;
    var ctrl = null;
    var timer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { ctrl.abort(); }, 20000);
    } catch (e) { /* 老浏览器忽略 */ }

    var init = {
      method: o.method || 'POST',
      cache: 'no-store'
    };
    if (o.body) {
      init.headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
      init.body = JSON.stringify(o.body);
    } else {
      init.headers = {};
    }
    if (ctrl) init.signal = ctrl.signal;

    return fetch(url, init).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : {}; }
        catch (e) { data = { ok: false, code: 'BAD_RESPONSE', error: '返回格式异常' }; }
        return { http: r.status, data: data, raw: text };
      });
    }).catch(function (e) {
      var aborted = e && e.name === 'AbortError';
      var offline = (typeof navigator !== 'undefined') && navigator.onLine === false;
      return {
        http: 0,
        net: true,
        data: {
          ok: false,
          code: aborted ? 'TIMEOUT' : (offline ? 'OFFLINE' : 'NETWORK'),
          error: aborted ? '请求超时，请检查网络后重试'
            : (offline ? '当前无网络连接，请检查网络' : '无法连接服务器，请检查网络')
        },
        raw: ''
      };
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res;
    });
  }

  /* ttl 可选：有效期秒数（服务端夹到 10–300，缺省 180）。登录页传 13，注册页用默认 */
  function captcha(ttl) {
    var q = ttl ? ('?ttl=' + encodeURIComponent(ttl)) : '';
    return call('captcha' + q, { method: 'GET' });
  }
  function login(body) { return call('login', { method: 'POST', body: body }); }
  function register(body) { return call('register', { method: 'POST', body: body }); }
  /* 邀请码预检：注册第 1 步「下一步」用来向服务端确认真实有效（存在 / 未停用 / 在有效期 / 次数未用完） */
  function checkInvite(code) {
    return call('register', { method: 'POST', body: { action: 'check_invite', invite_code: code } });
  }

  /* ---------------- 会话 ---------------- */
  function saveSession(payload) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (e) {}
  }
  function getSession() {
    try {
      var s = localStorage.getItem(SESSION_KEY);
      if (!s) return null;
      var o = JSON.parse(s);
      if (!o || !o.access_token) return null;
      if (o.expires_at && Date.now() > o.expires_at) return null;
      return o;
    } catch (e) { return null; }
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function lastUser() { try { return localStorage.getItem(LAST_USER_KEY) || ''; } catch (e) { return ''; } }
  function setLastUser(u) { try { localStorage.setItem(LAST_USER_KEY, u); } catch (e) {} }

  function sessionFrom(resp, username) {
    var d = resp && resp.data ? resp.data : {};
    var s = d.session || {};
    var p = d.profile || {};
    return {
      access_token: s.access_token || '',
      refresh_token: s.refresh_token || '',
      expires_in: s.expires_in || 3600,
      expires_at: Date.now() + ((s.expires_in || 3600) * 1000),
      username: p.username || username,
      role: p.role || 'employee',
      display_name: p.display_name || p.username || username,
      saved_at: Date.now()
    };
  }

  /* ---------------- UI：Toast ---------------- */
  function toast(msg, kind) {
    var wrap = $('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .35s, transform .35s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 380);
    }, 3400);
    while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild);
  }

  /* ---------------- UI：抖动 ---------------- */
  function shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(function () { el.classList.remove('shake'); }, 560);
  }

  /* ---------------- UI：按钮涟漪 ---------------- */
  function mountRipple() {
    document.addEventListener('pointerdown', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.btn') : null;
      if (!b || b.disabled) return;
      var r = b.getBoundingClientRect();
      var s = document.createElement('span');
      s.className = 'ripple';
      s.style.left = (e.clientX - r.left) + 'px';
      s.style.top = (e.clientY - r.top) + 'px';
      b.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 680);
    }, { passive: true });
  }

  /* ---------------- UI：卡片 3D 倾斜 + 高光跟随 ---------------- */
  function mountTilt(card, maxDeg) {
    if (!card) return;
    var max = typeof maxDeg === 'number' ? maxDeg : 5;
    var hoverOK = window.matchMedia && window.matchMedia('(hover:hover)').matches;
    if (!hoverOK) return;
    var raf = null, rx = 0, ry = 0;

    function apply() {
      raf = null;
      card.style.transform = 'perspective(1200px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    }
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      rx = -(py - 0.5) * 2 * max;
      ry = (px - 0.5) * 2 * max;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    card.addEventListener('pointerleave', function () {
      card.style.transform = '';
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '0%');
    });
  }

  /* ---------------- UI：鼠标液态光斑 ---------------- */
  function mountLiquidDot() {
    if (!window.matchMedia || !window.matchMedia('(hover:hover)').matches) return;
    var d = document.createElement('div');
    d.className = 'liquid-dot';
    document.body.appendChild(d);

    var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    var cx = tx, cy = ty, raf = null, seen = false, idle = 0;

    function loop() {
      raf = null;
      cx += (tx - cx) * 0.085;
      cy += (ty - cy) * 0.085;
      d.style.transform = 'translate3d(' + (cx - 210).toFixed(1) + 'px,' + (cy - 210).toFixed(1) + 'px,0)';
      if (Math.abs(tx - cx) > 0.6 || Math.abs(ty - cy) > 0.6) raf = requestAnimationFrame(loop);
      else { idle = 0; }
    }
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!seen) {
        seen = true; cx = tx; cy = ty;
        document.body.classList.add('has-pointer');
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }

  /* ---------------- UI：撒花 ---------------- */
  function confetti(n) {
    var count = typeof n === 'number' ? n : 28;
    var box = document.createElement('div');
    box.className = 'confetti';
    document.body.appendChild(box);
    var colors = ['#3fe0d0', '#4aa8ff', '#a78bfa', '#ffc46b', '#8ef0a0', '#ff6f8b'];
    for (var i = 0; i < count; i++) {
      var p = document.createElement('i');
      var a = (Math.PI * 2 * i) / count + Math.random() * 0.55;
      var dist = 130 + Math.random() * 210;
      p.style.background = colors[i % colors.length];
      p.style.color = colors[i % colors.length];
      p.style.setProperty('--tx', (Math.cos(a) * dist).toFixed(0) + 'px');
      p.style.setProperty('--ty', (Math.sin(a) * dist - 60).toFixed(0) + 'px');
      p.style.setProperty('--rz', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      p.style.animationDelay = (Math.random() * 0.14).toFixed(2) + 's';
      box.appendChild(p);
    }
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1900);
  }

  /* ---------------- UI：倒计时圆环 ---------------- */
  function startRing(svg, totalSeconds, onDone) {
    if (!svg) return function () {};
    var fg = svg.querySelector('.fg');
    if (!fg) return function () {};
    var R = 13, LEN = 2 * Math.PI * R;
    fg.style.strokeDasharray = LEN;
    fg.style.strokeDashoffset = '0';
    svg.classList.remove('low', 'dead');
    var left = totalSeconds;
    var id = setInterval(function () {
      left -= 1;
      var p = Math.max(0, left / totalSeconds);
      fg.style.strokeDashoffset = (LEN * (1 - p)).toFixed(2);
      if (p <= 0.25) svg.classList.add('low');
      if (left <= 0) {
        clearInterval(id);
        svg.classList.add('dead');
        if (typeof onDone === 'function') onDone();
      }
    }, 1000);
    return function () { clearInterval(id); };
  }

  /* ---------------- UI：在线状态 ---------------- */
  function mountNet(pill) {
    if (!pill) return;
    function sync() {
      var on = navigator.onLine !== false;
      pill.classList.toggle('off', !on);
      var label = pill.querySelector('.lab');
      if (label) label.textContent = on ? '云端在线' : '离线';
    }
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  }

  /* ---------------- UI：按钮 loading ---------------- */
  function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('loading', !!on);
  }

  window.SR = {
    BASE: BASE,
    KEY: KEY,
    $: $,
    $$: $$,
    deviceId: deviceId,
    ua: ua,
    api: { call: call, captcha: captcha, login: login, register: register, checkInvite: checkInvite },
    session: {
      save: saveSession,
      get: getSession,
      clear: clearSession,
      from: sessionFrom,
      lastUser: lastUser,
      setLastUser: setLastUser
    },
    ui: {
      toast: toast,
      shake: shake,
      confetti: confetti,
      ripple: mountRipple,
      tilt: mountTilt,
      liquidDot: mountLiquidDot,
      startRing: startRing,
      net: mountNet,
      setLoading: setLoading
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    mountRipple();
    mountLiquidDot();
  });
})();
