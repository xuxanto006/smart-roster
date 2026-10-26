// =============================================================
// tools/test_register_login.mjs · 用 mock 的 PostgREST/GoTrue 跑 register 与 login 全部分支
//
// 前置（由 PowerShell 脚本执行）：
//   esbuild supabase/functions/register/index.ts --bundle --format=esm --outfile=tools/_build/f/register.mjs
//   esbuild supabase/functions/login/index.ts    --bundle --format=esm --outfile=tools/_build/f/login.mjs
//   esbuild supabase/functions/_shared/captcha.ts --format=esm       --outfile=tools/_build/f/captcha.mjs
// 运行：node tools/test_register_login.mjs
// =============================================================

const BASE = 'https://t.supabase.co';
process.env.SUPABASE_URL = BASE;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key-for-test';
process.env.SUPABASE_ANON_KEY = 'anon-key-for-test';
process.env.CAPTCHA_SECRET = 'test-secret-0123456789abcdef';

// ---------- 捕获 Deno.serve 注册的处理器 ----------
let handler = null;
globalThis.Deno = {
  env: { get: (k) => process.env[k] },
  serve: (h) => {
    handler = h;
  },
};

// ---------- mock 状态 ----------
const calls = [];
const mock = {
  dupUsername: [],
  staffFound: [{ name: '何广友' }],
  staffClaimed: [],
  checkInvite: 'ok',
  redeemResult: 'ok',
  createUserResult: { id: '11111111-1111-1111-1111-111111111111' },
  createUserError: null,
  guard: [{ allowed: true, reason: 'ok', profile_id: 'uuid-1', display_name: '何广友', role: 'employee' }],
  signIn: { ok: true },
  touch: 'ok',
};

function resetCalls() {
  calls.length = 0;
}

function jsonRes(body, status = 200) {
  // 204 不允许携带 body，否则 Node 的 Response 构造函数会直接抛错
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const method = String(init.method ?? 'GET').toUpperCase();
  const path = u.replace(BASE, '');
  let body = null;
  try {
    body = init.body ? JSON.parse(String(init.body)) : null;
  } catch {
    body = init.body ?? null;
  }
  calls.push({ path, method, body });

  // ---- PostgREST 查询 ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?username=')) {
    return jsonRes(mock.dupUsername);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/staff?name=')) {
    return jsonRes(mock.staffFound);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?staff_name=')) {
    return jsonRes(mock.staffClaimed);
  }

  // ---- RPC ----
  if (path === '/rest/v1/rpc/check_invite') return jsonRes(mock.checkInvite);
  if (path === '/rest/v1/rpc/redeem_invite') return jsonRes(mock.redeemResult);
  if (path === '/rest/v1/rpc/login_guard') return jsonRes(mock.guard);
  if (path === '/rest/v1/rpc/touch_device') return jsonRes(mock.touch);

  // ---- 写入 ----
  if (method === 'POST' && path === '/rest/v1/profiles') {
    return jsonRes([{ id: body.id }], 201);
  }
  if (method === 'POST' && path === '/rest/v1/audit_logs') return jsonRes([{}], 201);
  if (method === 'POST' && path === '/rest/v1/auth_logs') return jsonRes([{}], 201);
  if (method === 'DELETE' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    return new Response(null, { status: 204 });
  }

  // ---- GoTrue Admin ----
  if (method === 'POST' && path === '/auth/v1/admin/users') {
    if (mock.createUserError) {
      return jsonRes({ error: mock.createUserError }, 422);
    }
    return jsonRes({ id: mock.createUserResult.id, email: body.email }, 200);
  }
  if (method === 'DELETE' && path.startsWith('/auth/v1/admin/users/')) {
    return jsonRes({}, 200);
  }

  // ---- GoTrue 登录 ----
  if (method === 'POST' && path.startsWith('/auth/v1/token?grant_type=password')) {
    if (!mock.signIn.ok) {
      return jsonRes({ error_code: 'invalid_grant', msg: 'Invalid login credentials' }, 400);
    }
    return jsonRes(
      {
        access_token: 'access-token-xyz',
        refresh_token: 'refresh-token-xyz',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'uuid-1' },
      },
      200,
    );
  }
  if (method === 'POST' && path === '/auth/v1/logout') return jsonRes({}, 204);

  return jsonRes({ error: 'unmocked ' + method + ' ' + path }, 500);
};

// ---------- 断言工具 ----------
let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ' → ' + JSON.stringify(extra).slice(0, 200) : ''}`);
  }
}

function called(sub) {
  return calls.some((c) => c.path.includes(sub));
}

function countCalled(sub) {
  return calls.filter((c) => c.path.includes(sub)).length;
}

function setMock(over) {
  Object.assign(mock, {
    dupUsername: [],
    staffFound: [{ name: '何广友' }],
    staffClaimed: [],
    checkInvite: 'ok',
    redeemResult: 'ok',
    createUserResult: { id: '11111111-1111-1111-1111-111111111111' },
    createUserError: null,
    guard: [{ allowed: true, reason: 'ok', profile_id: 'uuid-1', display_name: '何广友', role: 'employee' }],
    signIn: { ok: true },
    touch: 'ok',
  }, over);
}

// ---------- 载入两个函数 + captcha ----------
const cap = await import('./_build/f/captcha.mjs');
const captchaSecret = process.env.CAPTCHA_SECRET;
await import('./_build/f/register.mjs');
const registerHandler = handler;

handler = null;
await import('./_build/f/login.mjs');
const loginHandler = handler;

function answerOf(question) {
  const m = /^(\d+) ([+\-]) (\d+) = \?$/.exec(question);
  return m[2] === '+' ? String(Number(m[1]) + Number(m[3])) : String(Number(m[1]) - Number(m[3]));
}

async function postRegister(payload) {
  const t = await cap.issueCaptcha(captchaSecret);
  const res = await registerHandler(
    new Request('http://x/functions/v1/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        username: 'test01',
        password: 'passw0rd!',
        invite_code: 'ABC123',
        staff_name: '何广友',
        captcha_token: t.token,
        captcha_answer: answerOf(t.question),
        ...payload,
      }),
    }),
  );
  return { status: res.status, data: await res.json() };
}

async function postLogin(payload) {
  // 登录现在必须带服务端签发的算式验证码；默认给一张正确答好的，用例里可以覆盖成错的/空的
  const t = await cap.issueCaptcha(captchaSecret);
  const res = await loginHandler(
    new Request('http://x/functions/v1/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        username: 'test01',
        password: 'passw0rd!',
        device_id: 'abcdef0123456789abcdef',
        captcha_token: t.token,
        captcha_answer: answerOf(t.question),
        ...payload,
      }),
    }),
  );
  return { status: res.status, data: await res.json() };
}

// 注册第 1 步的邀请码预检（不需要验证码）
async function postCheckInvite(payload) {
  const res = await registerHandler(
    new Request('http://x/functions/v1/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ action: 'check_invite', invite_code: 'ABC123', ...payload }),
    }),
  );
  return { status: res.status, data: await res.json() };
}

// =============================================================
console.log('\n=== register ===');
// =============================================================

setMock({});
resetCalls();
{
  const r = await postRegister({ captcha_answer: '999' });
  ok('验证码答错 → CAPTCHA_FAILED', r.data.code === 'CAPTCHA_FAILED', r.data);
  ok('  且没有建号、没有查库', !called('/auth/v1/admin/users') && calls.length === 0, calls.map((c) => c.path));
}

setMock({});
resetCalls();
{
  const r = await postRegister({ username: 'AB' });
  ok('账号名太短 → BAD_USERNAME', r.data.code === 'BAD_USERNAME', r.data);
}
setMock({});
{
  const r = await postRegister({ username: '张三' });
  ok('账号名含中文 → BAD_USERNAME', r.data.code === 'BAD_USERNAME', r.data);
}
setMock({});
{
  const r = await postRegister({ password: '123' });
  ok('密码太短 → BAD_PASSWORD', r.data.code === 'BAD_PASSWORD', r.data);
}
setMock({});
{
  const r = await postRegister({ invite_code: '' });
  ok('邀请码为空 → BAD_INVITE', r.data.code === 'BAD_INVITE', r.data);
}

setMock({ dupUsername: [{ id: 'x', username: 'test01', staff_name: null }] });
resetCalls();
{
  const r = await postRegister({});
  ok('账号名已存在 → USERNAME_TAKEN', r.data.code === 'USERNAME_TAKEN', r.data);
  ok('  且没有建号', !called('/auth/v1/admin/users'));
}

setMock({ staffFound: [] });
{
  const r = await postRegister({});
  ok('员工名单里没这人 → STAFF_NOT_FOUND', r.data.code === 'STAFF_NOT_FOUND', r.data);
}

setMock({ staffClaimed: [{ id: 'y', username: 'other' }] });
{
  const r = await postRegister({});
  ok('员工已被认领 → STAFF_TAKEN', r.data.code === 'STAFF_TAKEN', r.data);
}

setMock({ checkInvite: 'EXPIRED' });
resetCalls();
{
  const r = await postRegister({});
  ok('邀请码过期 → INVITE_INVALID', r.data.code === 'INVITE_INVALID', r.data);
  ok('  提示文案正确', r.data.error.includes('过期'), r.data.error);
  ok('  且没有建号（先预检省一次建号）', !called('/auth/v1/admin/users'));
}

setMock({ createUserError: 'User already registered' });
{
  const r = await postRegister({});
  ok('Auth 层已存在 → USERNAME_TAKEN', r.data.code === 'USERNAME_TAKEN', r.data);
}

setMock({ redeemResult: 'EXHAUSTED' });
resetCalls();
{
  const r = await postRegister({});
  ok('建号后邀请码被抢光 → INVITE_INVALID', r.data.code === 'INVITE_INVALID', r.data);
  ok('  回滚：删掉了刚建的 Auth 用户', called('/auth/v1/admin/users/11111111'), calls.map((c) => c.method + ' ' + c.path));
  ok('  回滚：删掉了刚写的 profile',
    calls.some((c) => c.method === 'DELETE' && c.path.startsWith('/rest/v1/profiles?id=eq.')),
    calls.map((c) => c.method + ' ' + c.path));
  const iProfile = calls.findIndex((c) => c.method === 'POST' && c.path === '/rest/v1/profiles');
  const iRedeem = calls.findIndex((c) => c.path === '/rest/v1/rpc/redeem_invite');
  ok('  profile 必须写在 redeem_invite 之前（invite_uses 外键约束）',
    iProfile >= 0 && iRedeem > iProfile,
    calls.map((c) => c.method + ' ' + c.path));
}

setMock({});
resetCalls();
{
  const r = await postRegister({ apply_note: '我是3C组的' });
  ok('正常注册 → ok:true', r.data.ok === true, r.data);
  ok('  status = pending', r.data.status === 'pending');
  const ins = calls.find((c) => c.method === 'POST' && c.path === '/rest/v1/profiles');
  ok('  写入 profile: status=pending / role=employee',
    ins && ins.body.status === 'pending' && ins.body.role === 'employee', ins && ins.body);
  ok('  staff_name 绑定正确', ins && ins.body.staff_name === '何广友');
  ok('  写了审计日志', called('/rest/v1/audit_logs'));
}

setMock({});
{
  const r = await postRegister({ staff_name: '' });
  ok('不填员工名也能注册（待审核时绑定）', r.data.ok === true, r.data);
}

// =============================================================
console.log('\n=== register.check_invite ===');
// =============================================================

setMock({});
resetCalls();
{
  const r = await postCheckInvite({});
  ok('有效邀请码 → ok:true', r.data.ok === true, r.data);
  ok('  回显规范化后的大写邀请码', r.data.invite === 'ABC123', r.data);
  ok('  只查了 check_invite，没有建号', !called('/auth/v1/admin/users'));
}

setMock({ checkInvite: 'NOT_FOUND' });
{
  const r = await postCheckInvite({});
  ok('码不存在 → INVITE_INVALID', r.data.code === 'INVITE_INVALID', r.data);
  ok('  提示文案可读', r.data.error.includes('不存在'), r.data.error);
}

setMock({ checkInvite: 'DISABLED' });
{
  const r = await postCheckInvite({});
  ok('码被停用 → INVITE_INVALID', r.data.code === 'INVITE_INVALID', r.data);
}

setMock({ checkInvite: 'EXHAUSTED' });
{
  const r = await postCheckInvite({});
  ok('次数用完 → INVITE_INVALID', r.data.code === 'INVITE_INVALID', r.data);
}

setMock({});
{
  const r = await postCheckInvite({ invite_code: 'ab' });
  ok('码太短 → BAD_INVITE', r.data.code === 'BAD_INVITE', r.data);
}

// =============================================================
console.log('\n=== login ===');
// =============================================================

setMock({});
resetCalls();
{
  const r = await postLogin({ captcha_token: '' });
  ok('没带验证码 → CAPTCHA_REQUIRED', r.data.reason === 'CAPTCHA_REQUIRED', r.data);
  ok('  没查库', calls.length === 0, calls.map((c) => c.path));
}

setMock({});
resetCalls();
{
  const r = await postLogin({ captcha_answer: '999' });
  ok('验证码答错 → CAPTCHA_FAILED', r.data.reason === 'CAPTCHA_FAILED', r.data);
  ok('  没查库（不进 login_guard）', calls.length === 0, calls.map((c) => c.path));
  ok('  没去校验密码', !called('/auth/v1/token'));
}

setMock({ guard: [{ allowed: false, reason: 'PENDING_APPROVAL', profile_id: 'uuid-1', display_name: '', role: 'employee' }] });
resetCalls();
{
  const r = await postLogin({});
  ok('待审核 → PENDING_APPROVAL', r.data.reason === 'PENDING_APPROVAL', r.data);
  ok('  文案提到审核', r.data.message.includes('审核'), r.data.message);
  ok('  没去校验密码', !called('/auth/v1/token'));
  ok('  记了失败日志', called('/rest/v1/auth_logs'));
}

setMock({ guard: [{ allowed: false, reason: 'DEVICE_BANNED', profile_id: 'uuid-1', display_name: '', role: 'employee' }] });
{
  const r = await postLogin({});
  ok('设备被拉黑 → DEVICE_BANNED', r.data.reason === 'DEVICE_BANNED', r.data);
}

setMock({ guard: [{ allowed: false, reason: 'DISABLED', profile_id: 'uuid-1', display_name: '', role: 'employee' }] });
{
  const r = await postLogin({});
  ok('账号停用 → DISABLED', r.data.reason === 'DISABLED', r.data);
}

setMock({ guard: [{ allowed: false, reason: 'TOO_MANY_FAILS', profile_id: 'uuid-1', display_name: '', role: 'employee' }] });
{
  const r = await postLogin({});
  ok('失败锁定 → TOO_MANY_FAILS', r.data.reason === 'TOO_MANY_FAILS', r.data);
}

setMock({ signIn: { ok: false } });
{
  const r = await postLogin({});
  ok('密码错 → BAD_CREDENTIALS', r.data.reason === 'BAD_CREDENTIALS', r.data);
  ok('  文案不暴露账号是否存在', r.data.message === '账号或密码不对', r.data.message);
}

setMock({});
resetCalls();
{
  const r = await postLogin({ device_id: 'short' });
  ok('设备号格式异常 → BAD_DEVICE', r.data.reason === 'BAD_DEVICE', r.data);
  ok('  没查库（格式不对就别浪费一次 RPC）', calls.length === 0, calls.map((c) => c.path));
}

setMock({ touch: 'BANNED' });
resetCalls();
{
  const r = await postLogin({});
  ok('登录成功但设备被拉黑 → DEVICE_BANNED', r.data.reason === 'DEVICE_BANNED', r.data);
  ok('  立刻作废刚签发的会话', called('/auth/v1/logout'));
}

setMock({});
resetCalls();
{
  const r = await postLogin({});
  ok('正常登录 → ok:true', r.data.ok === true, r.data);
  ok('  返回 access_token', r.data.session && r.data.session.access_token === 'access-token-xyz');
  ok('  返回角色', r.data.profile && r.data.profile.role === 'employee');
  ok('  登记了设备', called('/rest/v1/rpc/touch_device'));
  ok('  记了成功日志', called('/rest/v1/auth_logs'));
  const dev = calls.find((c) => c.path === '/rest/v1/rpc/touch_device');
  ok('  传入的是 device_id + ua', dev && dev.body.p_device_hash === 'abcdef0123456789abcdef');
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
