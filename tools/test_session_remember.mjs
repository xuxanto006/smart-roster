// =============================================================
// tools/test_session_remember.mjs · 「记住这台设备」会话层测试
// -------------------------------------------------------------
// 把 _deploy/auth-core.js 放进 vm 沙箱（假 window/document/localStorage/fetch），
// 盯住四件事：
//   ① 记住登录会写 keep_until=+30 天；不记住不写；
//   ② 1 小时到点后不踢人：用 refresh_token 静默续期；
//   ③ 30 天到点 / refresh 被拒（400、401）才真的清会话；
//   ④ 续期成功后，REST 请求要带新的 access_token（不是旧的那张废票）。
// 用法：node tools/test_session_remember.mjs
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const src = fs.readFileSync(path.resolve('_deploy/auth-core.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`); }
}

/* 起一个沙箱：fetch 由用例自定义，localStorage 是内存 Map */
function boot(opts) {
  const o = opts || {};
  const store = new Map(Object.entries(o.session ? { 'sr.session': JSON.stringify(o.session) } : {}));
  const calls = [];
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }
  };
  const fetchStub = (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    /* 用 Promise.resolve().then 包一层：用例里「同步抛错」也能变成 rejected promise，
       和真实 fetch 的失败方式一致 */
    return Promise.resolve().then(() => {
      const r = o.fetch ? o.fetch(String(url), init || {}) : { ok: true, status: 200, body: '[]' };
      return {
        ok: !!r.ok,
        status: r.status || 200,
        text: () => Promise.resolve(r.body === undefined ? '[]' : r.body)
      };
    });
  };
  const doc = {
    addEventListener() {},
    querySelector: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} }),
    body: { appendChild() {} }
  };
  const sandbox = {
    console,
    document: doc,
    navigator: { userAgent: 'node', onLine: true },
    localStorage: ls,
    fetch: fetchStub,
    setTimeout, clearTimeout,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    crypto: globalThis.crypto,
    AbortController: globalThis.AbortController,
    requestAnimationFrame: (fn) => setTimeout(fn, 0)
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { SR: sandbox.SR, store, calls, ls };
}

const now = Date.now();
const live = (role, extra) => Object.assign({
  access_token: 'AT-LIVE', refresh_token: 'RT', expires_in: 3600,
  expires_at: now + 3600 * 1000, username: 'boss', role: role || 'manager',
  display_name: 'Boss', remember: true, keep_until: now + 30 * 86400000, saved_at: now
}, extra || {});
const dead = (extra) => live('manager', Object.assign({ access_token: 'AT-OLD', expires_at: now - 1000 }, extra || {}));

console.log('== 记住这台设备 · 会话层 ==');

// ① 登录成功时按勾选写 keep_until
{
  const { SR } = boot();
  const resp = { data: { session: { access_token: 'A', refresh_token: 'R', expires_in: 3600 }, profile: { username: 'boss', role: 'manager', display_name: 'Boss' } } };
  const keep = SR.session.from(resp, 'boss', true);
  const once = SR.session.from(resp, 'boss', false);
  check('勾了「记住」→ remember=true', keep.remember === true);
  check('勾了「记住」→ keep_until ≈ 30 天后', Math.abs(keep.keep_until - (Date.now() + 30 * 86400000)) < 5000, keep.keep_until - Date.now());
  check('没勾 → remember=false 且 keep_until=0', once.remember === false && once.keep_until === 0);
  check('无论勾不勾都留 refresh_token', keep.refresh_token === 'R' && once.refresh_token === 'R');
}

// ② 没过期的会话：直接用，不打网络
{
  const { SR, calls } = boot({ session: live() });
  const got = SR.session.get();
  check('有效期内 get() 返回会话', got && got.access_token === 'AT-LIVE');
  const s = await SR.session.ensure();
  check('有效期内 ensure() 不触发续期', calls.length === 0 && s.access_token === 'AT-LIVE', calls.length);
}

// ③ 1 小时到点 + 记住登录：静默续期，不踢人
{
  const { SR, calls, store } = boot({
    session: dead(),
    fetch: () => ({ ok: true, status: 200, body: JSON.stringify({ access_token: 'AT-NEW', refresh_token: 'RT2', expires_in: 3600 }) })
  });
  const before = SR.session.get();
  check('过期但可续期 → get() 仍返回（不立刻踢人）', before && before.access_token === 'AT-OLD');
  const s = await SR.session.ensure();
  check('续期成功返回新 token', s && s.access_token === 'AT-NEW', s && s.access_token);
  check('续期用 refresh_token 端点', calls.length === 1 && /\/auth\/v1\/token\?grant_type=refresh_token$/.test(calls[0].url), calls[0] && calls[0].url);
  check('续期请求带 apikey（GoTrue 需要）', calls[0].init.headers.apikey && /^sb_publishable_/.test(calls[0].init.headers.apikey));
  const saved = JSON.parse(store.get('sr.session'));
  check('新 token 已落盘', saved.access_token === 'AT-NEW');
  check('续期保留 remember / keep_until（不然 30 天会越用越短）', saved.remember === true && Math.abs(saved.keep_until - live().keep_until) < 5000, saved.keep_until);
  check('续期保留身份与账号名', saved.role === 'manager' && saved.username === 'boss', saved.role);
  check('refresh_token 跟随服务端轮换', saved.refresh_token === 'RT2', saved.refresh_token);
}

// ④ 30 天到点：清掉会话，不再续期
{
  const { SR, calls, store } = boot({ session: live('manager', { keep_until: now - 1000 }) });
  check('keep_until 过期 → get() 返回 null', SR.session.get() === null);
  check('keep_until 过期 → 本机会话被清掉', !store.has('sr.session'));
  check('keep_until 过期 → 不去打续期接口', calls.length === 0);
}

// ⑤ refresh 被服务端拒绝（400/401）：清掉，别一直重试
{
  const { SR, store } = boot({
    session: dead(),
    fetch: () => ({ ok: false, status: 400, body: '{"error":"invalid_grant"}' })
  });
  const s = await SR.session.ensure();
  check('refresh 被拒 → resolve(null)', s === null);
  check('refresh 被拒 → 清掉本机会话', !store.has('sr.session'));
}

// ⑥ 网络抖动（fetch 直接抛）：保住会话，等下次再续
{
  const { SR, store } = boot({
    session: dead(),
    fetch: () => { throw new Error('offline'); }
  });
  const s = await SR.session.ensure();
  check('续期时断网 → resolve(null)（不假装登录成功）', s === null);
  check('续期时断网 → 会话仍在（离线不该被强制登出）', store.has('sr.session'));
}

// ⑦ 数据请求：token 过期时要先续期，且用新 token 发 Authorization
{
  const { SR, calls } = boot({
    session: dead(),
    fetch: (url) => {
      if (/grant_type=refresh_token/.test(url)) return { ok: true, status: 200, body: JSON.stringify({ access_token: 'AT-NEW', expires_in: 3600 }) };
      return { ok: true, status: 200, body: '[]' };
    }
  });
  const r = await SR.db.select('shifts', 'select=*');
  check('db 调用成功（自动续期后照常）', r.ok === true, r);
  const rest = calls.filter((c) => /\/rest\/v1\/shifts/.test(c.url))[0];
  check('REST 用新 token 而不是过期那张', rest && rest.init.headers.Authorization === 'Bearer AT-NEW', rest && rest.init.headers.Authorization);
  check('先续期再查（顺序对）', calls.length === 2 && !/rest\/v1/.test(calls[0].url), calls.map((c) => c.url));
}

// ⑧ 没勾「记住」的普通会话：过期后仍能续一次（页面别刚开就被踢）
{
  const { SR } = boot({
    session: dead({ remember: false, keep_until: 0 }),
    fetch: () => ({ ok: true, status: 200, body: JSON.stringify({ access_token: 'AT-NEW', expires_in: 3600 }) })
  });
  const s = await SR.session.ensure();
  check('未记住也会静默续期（同一浏览器内体验连续）', s && s.access_token === 'AT-NEW', s && s.access_token);
}

// ⑨ 什么 token 都没了：直接 401，不打网络
{
  const { SR, calls } = boot({ session: dead({ refresh_token: '' }) });
  check('无 refresh_token → get() 返回 null', SR.session.get() === null);
  const r = await SR.db.select('shifts', 'select=*');
  check('无 refresh_token → REST 直接 401 NO_TOKEN', r.http === 401 && r.code === 'NO_TOKEN', r);
  check('无 refresh_token → 没有多余请求', calls.length === 0, calls.length);
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
