// =============================================================
// tools/test_quick_login.mjs · 登录页「一键登录（选身份）」纯逻辑测试
// -------------------------------------------------------------
// 把 login.html 里的快捷登录段（var QUICK … function quickLogin）抽出来，
// 用假 DOM / 假 SR 跑 4 个场景，盯住最容易写错的一件事：
//   **点哪个身份就必须是哪个身份**，不匹配要明确报错，不能静默进去。
// 用法：node tools/test_quick_login.mjs
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const src = fs.readFileSync(path.resolve('_deploy/login.html'), 'utf8');
const from = src.indexOf('var QUICK = {');
const to = src.indexOf('  if (quickAllowed()) {');
if (from < 0 || to < 0 || to <= from) {
  console.log('  ✗ 找不到快捷登录代码段（var QUICK / if (quickAllowed())）');
  process.exit(1);
}
const quickSrc = src.slice(from, to) + '\n;globalThis.__ql = quickLogin;';

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`); }
}

// 假 DOM：只需要 textContent / hidden / value / focus
function makeDom() {
  const els = {};
  const grab = (id) => {
    if (!els[id]) els[id] = { id, textContent: '', hidden: false, value: '', focus() {} };
    return els[id];
  };
  return { els, $: (sel) => grab(sel.replace(/^#/, '')) };
}

// 跑一个场景：kind = 'manager' | 'employee'，role 是服务端返回的真实身份
async function run(kind, opts) {
  const o = opts || {};
  const dom = makeDom();
  const store = Object.assign({}, o.creds || {});
  const ls = {
    getItem: (k) => {
      if (k === 'sr_quick_cred_v1') return JSON.stringify(store);
      if (k === 'sr_quick') return o.flag === undefined ? null : String(o.flag);
      return null;
    },
    setItem: (k, v) => { if (k === 'sr_quick_cred_v1') { const p = JSON.parse(v); Object.keys(p).forEach((x) => { store[x] = p[x]; }); } },
    removeItem: () => {}
  };
  const out = { msg: null, toast: null, result: null, loginBody: null, captchaCalls: 0, question: o.question || '8 - 4 = ?' };

  let settle;
  const done = new Promise((r) => { settle = r; });
  const sandbox = {
    location: {
      protocol: o.protocol || 'https:',
      hostname: o.host || 'smart-roster.xuxanto.workers.dev',
      search: o.search || '',
      pathname: '/login.html', hash: ''
    },
    history: { replaceState() {} },
    localStorage: ls,
    console,
    $: dom.$,
    S: { busy: false, capDead: false },
    CAP_TTL: 13,
    setMsg: (t) => { out.msg = t; },
    onFail: (d) => { out.result = { kind: 'fail', d }; settle(); },
    onSuccess: (res, u) => { out.result = { kind: 'ok', username: u, res }; settle(); },
    SR: {
      api: {
        captcha: () => { out.captchaCalls++; return Promise.resolve({ data: { ok: true, token: 'TK', question: out.question } }); },
        login: (body) => { out.loginBody = body; return Promise.resolve({ data: { ok: true, profile: { role: o.role || 'employee' } } }); }
      },
      deviceId: () => 'DEVICE',
      ua: () => 'UA',
      ui: { toast: (m, k) => { out.toast = [m, k]; } }
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(o.source || quickSrc, sandbox);
  sandbox.__ql(kind);
  const timer = new Promise((r) => setTimeout(() => r('timeout'), 2000));
  const raced = await Promise.race([done, timer]);
  out.timeout = raced === 'timeout';
  out.dom = dom.els;
  return out;
}

const MGR = { manager: { u: 'boss', p: 'pw' }, employee: { u: 'staff1', p: 'pw' } };
const EMP_AS_MGR = { manager: { u: 'staff1', p: 'pw' } }; /* 「管理员」格子里塞了员工账号 */

console.log('== 一键登录 · 选身份 ==');

// ① 内置账号关掉（?dev=0）且没存凭据：不开登录请求，直接引导去「设置账号」
{
  const r = await run('manager', { creds: {}, search: '?dev=0' });
  check('内置关掉 + 没存凭据 → 不发登录请求', r.captchaCalls === 0 && r.loginBody === null);
  check('内置关掉 + 没存凭据 → 展开设置面板 + 提示', /存一次账号密码/.test(r.msg || '') && r.dom.quickForm.hidden === false, r.msg);
  check('没存凭据时把身份下拉切到该身份', r.dom.qkId.value === 'manager', r.dom.qkId.value);
}

// ② 「管理员」里存的是员工账号：必须报错，且真的没有进后台
{
  const r = await run('manager', { creds: EMP_AS_MGR, role: 'employee' });
  check('员工账号点管理员 → 明确报错', r.result && r.result.kind === 'fail', r.result);
  check('报错内容指向「普通用户身份」', /普通用户/.test((r.result && r.result.d && r.result.d.message) || ''), r.result && r.result.d);
  check('员工账号点管理员 → 不调 onSuccess（不进工作台）', r.result && r.result.kind !== 'ok');
}

// ③ 经理账号点「管理员」：正常登录
{
  const r = await run('manager', { creds: MGR, role: 'manager' });
  check('经理点管理员 → 登录成功', r.result && r.result.kind === 'ok', r.result);
  check('登录成功带的是管理员账号', r.result && r.result.username === 'boss', r.result && r.result.username);
}

// ④ 经理账号点「普通用户」：同样拦下来（防止误点被告知进员工端）
{
  const r = await run('employee', { creds: MGR, role: 'manager' });
  check('经理点普通用户 → 明确报错', r.result && r.result.kind === 'fail', r.result);
  check('报错内容指向「管理员身份」', /管理员身份/.test((r.result && r.result.d && r.result.d.message) || ''), r.result && r.result.d);
}

// ⑤ 只读账号（viewer）也算管理员
{
  const r = await run('manager', { creds: MGR, role: 'viewer' });
  check('viewer 点管理员 → 放行（只读也算经理侧）', r.result && r.result.kind === 'ok', r.result);
}

// ⑥ 请求体必须是真登录那一套（服务端判卷照走，没有绕过 captcha）
{
  const r = await run('manager', { creds: { manager: { u: 'Boss ', p: 'pw' } }, role: 'manager' });
  const b = r.loginBody || {};
  check('登录仍带 captcha_token', b.captcha_token === 'TK', b);
  check('算式在本地解对（8-4 → "4"）', b.captcha_answer === '4', b.captcha_answer);
  check('账号名统一小写 + 去空格', b.username === 'boss', b.username);
  check('带设备号与 UA', b.device_id === 'DEVICE' && b.ua === 'UA', b);
}

// ⑦ 服务端题面异常：不能拿错答案硬登
{
  const r = await run('manager', { creds: MGR, role: 'manager', question: '今天几号？' });
  check('题面异常 → 不进登录接口', r.loginBody === null, r.loginBody);
  check('题面异常 → 落到「没走通」提示，不误报成功', r.result === null && /没走通/.test(r.msg || ''), r.msg);
}

// ⑧ 公网默认也内置（当前开发期刻意开着）：没存过凭据也能一键进
{
  const r = await run('manager', { creds: {}, role: 'manager' });
  check('公网默认：管理员内置账号直接可用', r.loginBody && r.loginBody.username === 'superadmin', r.loginBody && r.loginBody.username);
  check('公网默认：内置管理员密码正确带入', r.loginBody && r.loginBody.password === 'huawei@123');
  check('公网默认：内置账号登录成功', r.result && r.result.kind === 'ok', r.result);
}
{
  const r = await run('employee', { creds: {}, role: 'employee' });
  check('公网默认：员工内置账号 test 可直接进', r.loginBody && r.loginBody.username === 'test', r.loginBody && r.loginBody.username);
  check('公网默认：内置员工密码正确带入', r.loginBody && r.loginBody.password === '12345678');
}

// ⑨ 关掉内置的三个开关：?dev=0 / 本机 sr_quick=0 / DEV_SEED.on=false
{
  const r = await run('manager', { creds: {}, search: '?dev=0', role: 'manager' });
  check('?dev=0 → 内置账号不生效', r.loginBody === null && r.captchaCalls === 0);
}
{
  const r = await run('manager', { creds: {}, flag: '0', role: 'manager' });
  check('本机点过「不再显示」→ 内置账号不生效', r.loginBody === null && r.captchaCalls === 0);
}
{
  const offSrc = quickSrc.replace('var DEV_SEED = {\n    on: true,', 'var DEV_SEED = {\n    on: false,');
  check('测试自检：DEV_SEED 源码替换成功', offSrc !== quickSrc);
  const r = await run('manager', { creds: {}, role: 'manager', source: offSrc });
  check('DEV_SEED.on=false → 内置账号彻底失效', r.loginBody === null && r.captchaCalls === 0, r.loginBody && r.loginBody.username);
  check('DEV_SEED.on=false 时仍能引导去「设置账号」', /存一次账号密码/.test(r.msg || ''), r.msg);
}

// ⑩ 本机存过别的账号：优先用存的，不被内置覆盖
{
  const r = await run('manager', { creds: { manager: { u: 'realboss', p: 'pw' } }, role: 'manager' });
  check('本机凭据优先于内置账号', r.loginBody && r.loginBody.username === 'realboss', r.loginBody && r.loginBody.username);
}

// ⑪ 内置的员工号点「管理员」：一样要被身份校验拦住
{
  const r = await run('manager', { creds: {}, role: 'employee' });
  check('内置员工号点管理员 → 报错指路', r.result && r.result.kind === 'fail' && /普通用户/.test(r.result.d.message), r.result);
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
