// =============================================================
// tools/test_review.mjs · review 函数全分支测试（mock PostgREST + GoTrue）
//
// 前置：npx esbuild supabase/functions/review/index.ts --bundle --format=esm \
//         --platform=neutral --target=es2022 --outfile=tools/_build/f/review.mjs
// 运行：node tools/test_review.mjs
//
// 注意：请求体一律用 Content-Type: text/plain + JSON 文本，
//       与浏览器端「简单请求、避开预检」的真实发法保持一致。
// =============================================================

const BASE = 'https://t.supabase.co';
process.env.SUPABASE_URL = BASE;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key-for-test';
process.env.SUPABASE_ANON_KEY = 'anon-key-for-test';

let handler = null;
globalThis.Deno = {
  env: { get: (k) => process.env[k] },
  serve: (h) => {
    handler = h;
  },
};

// ---------------- mock 状态 ----------------
const calls = [];
const S = {
  tokenUsers: {
    'tok-manager-0123456789abcdef': '10000000-0000-4000-8000-000000000001',
    'tok-employee-0123456789abcdef': '10000000-0000-4000-8000-000000000002',
  },
  profilesById: {},
  pending: [],
  statusRows: [],
  claims: [],
  claimedByName: {},
  staff: [],
  staffNames: [],
  deleteFails: false,
};

function reset(over = {}) {
  calls.length = 0;
  Object.assign(S, {
    pending: [],
    statusRows: [],
    claims: [],
    claimedByName: {},
    staff: [{ name: '何广友', module: '3c', position: '销售', domain: '3c' }],
    staffNames: ['何广友'],
    deleteFails: false,
    profilesById: {
      '10000000-0000-4000-8000-000000000001': {
        id: '10000000-0000-4000-8000-000000000001',
        username: 'mgr01',
        display_name: '王经理',
        role: 'manager',
        status: 'active',
        staff_name: null,
      },
      '10000000-0000-4000-8000-000000000002': {
        id: '10000000-0000-4000-8000-000000000002',
        username: 'emp01',
        display_name: '何广友',
        role: 'employee',
        status: 'active',
        staff_name: '何广友',
      },
    },
  }, over);
}

function jsonRes(body, status = 200) {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function q(u, key) {
  const v = new URL(u).searchParams.get(key);
  return v === null ? null : v;
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
  calls.push({ path, method, body, headers: init.headers ?? {} });

  // ---- GoTrue：token 换用户 ----
  if (method === 'GET' && path === '/auth/v1/user') {
    const auth = String((init.headers ?? {}).Authorization ?? '');
    const token = auth.replace(/^Bearer /, '');
    const id = S.tokenUsers[token];
    if (!id) return jsonRes({ message: 'invalid JWT' }, 401);
    return jsonRes({ id });
  }

  // ---- PostgREST：按 id 查 profile ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    const id = decodeURIComponent(path.slice('/rest/v1/profiles?id=eq.'.length).split('&')[0]);
    const p = S.profilesById[id];
    return jsonRes(p ? [p] : []);
  }
  // ---- PostgREST：待审核列表 ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?status=eq.pending')) {
    return jsonRes(S.pending);
  }
  // ---- PostgREST：状态计数 ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?select=status')) {
    return jsonRes(S.statusRows);
  }
  // ---- PostgREST：全部认领关系 ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?staff_name=not.is.null')) {
    return jsonRes(S.claims);
  }
  // ---- PostgREST：某员工被谁占用 ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?staff_name=eq.')) {
    const name = decodeURIComponent(path.slice('/rest/v1/profiles?staff_name=eq.'.length).split('&')[0]);
    return jsonRes(S.claimedByName[name] ?? []);
  }
  // ---- PostgREST：员工名单 ----
  if (method === 'GET' && path.startsWith('/rest/v1/staff?name=eq.')) {
    const name = decodeURIComponent(path.slice('/rest/v1/staff?name=eq.'.length).split('&')[0]);
    return jsonRes(S.staffNames.includes(name) ? [{ name }] : []);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/staff?active=eq.true')) {
    return jsonRes(S.staff);
  }

  // ---- 写入 ----
  if (method === 'POST' && path === '/rest/v1/audit_logs') return jsonRes([{}], 201);
  if (method === 'PATCH' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    return new Response(null, { status: 204 });
  }
  if (method === 'DELETE' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    return new Response(null, { status: 204 });
  }
  if (method === 'DELETE' && path.startsWith('/auth/v1/admin/users/')) {
    if (S.deleteFails) return jsonRes({ message: 'boom' }, 500);
    return jsonRes({}, 200);
  }

  return jsonRes({ error: 'unmocked ' + method + ' ' + path }, 500);
};

// ---------------- 断言工具 ----------------
let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra === undefined ? '' : ' → ' + JSON.stringify(extra).slice(0, 240)}`);
  }
}
const patched = () => calls.find((c) => c.method === 'PATCH');
const deleted = (sub) => calls.find((c) => c.method === 'DELETE' && c.path.includes(sub));
const audited = (action) =>
  calls.find((c) => c.method === 'POST' && c.path === '/rest/v1/audit_logs' && c.body?.action === action);

// ---------------- 载入函数 ----------------
await import('./_build/f/review.mjs');

async function call(payload, opts = {}) {
  const method = opts.method ?? 'POST';
  const headers = { origin: 'http://localhost' };
  const init = { method, headers };
  if (method === 'POST') {
    // 与浏览器端一致：简单请求，text/plain 里塞 JSON
    headers['content-type'] = 'text/plain;charset=UTF-8';
    init.body = opts.raw ?? JSON.stringify(payload ?? {});
  }
  const res = await handler(new Request('http://x/functions/v1/review', init));
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, text, headers: res.headers };
}

const asManager = (extra) => ({ token: 'tok-manager-0123456789abcdef', ...extra });

// =============================================================
console.log('\n=== 协议层 ===');
// =============================================================
{
  const r = await call(null, { method: 'OPTIONS' });
  ok('OPTIONS 预检 → 204 且无 body（cors 修复回归）', r.status === 204 && r.text === '', r.status);
  ok('  预检带 Access-Control-Allow-Origin', r.headers.get('access-control-allow-origin') === '*');
}
{
  const r = await call(null, { method: 'GET' });
  ok('GET → 405 BAD_METHOD', r.status === 405 && r.data.code === 'BAD_METHOD', r.data);
}
{
  const r = await call(null, { raw: '{bad json' });
  ok('坏 JSON → 400 BAD_JSON', r.status === 400 && r.data.code === 'BAD_JSON', r.data);
}
{
  reset();
  const r = await call({ token: 'tok-manager-0123456789abcdef', action: 'nope' });
  ok('未知 action → BAD_ACTION', r.data.code === 'BAD_ACTION', r.data);
}

// =============================================================
console.log('\n=== 身份校验 ===');
// =============================================================
{
  reset();
  const r = await call({ action: 'list' });
  ok('没带 token → NO_TOKEN', r.data.code === 'NO_TOKEN', r.data);
  ok('  且没去打 GoTrue', calls.length === 0, calls.map((c) => c.path));
}
{
  reset();
  const r = await call({ token: 'tok-forged-0123456789abcdef', action: 'list' });
  ok('伪造 token → BAD_TOKEN', r.data.code === 'BAD_TOKEN', r.data);
}
{
  reset();
  const r = await call({ token: 'tok-employee-0123456789abcdef', action: 'list' });
  ok('员工 token → FORBIDDEN', r.data.code === 'FORBIDDEN' && r.status === 403, r.data);
}
{
  reset({
    profilesById: {
      '10000000-0000-4000-8000-000000000001': {
        id: '10000000-0000-4000-8000-000000000001', username: 'mgr01', display_name: 'x',
        role: 'manager', status: 'disabled', staff_name: null,
      },
    },
  });
  const r = await call({ token: 'tok-manager-0123456789abcdef', action: 'list' });
  ok('本账号被停用 → DISABLED', r.data.code === 'DISABLED', r.data);
}
{
  reset();
  S.tokenUsers['tok-ghost-0123456789abcdef'] = '10000000-0000-4000-8000-000000000015';
  const r = await call({ token: 'tok-ghost-0123456789abcdef', action: 'list' });
  ok('profile 不存在 → NO_PROFILE', r.data.code === 'NO_PROFILE', r.data);
  delete S.tokenUsers['tok-ghost-0123456789abcdef'];
}

// =============================================================
console.log('\n=== list ===');
// =============================================================
{
  reset({
    pending: [{
      id: '10000000-0000-4000-8000-000000000011', username: 'new01', display_name: '新来的',
      role: 'employee', status: 'pending', staff_name: null,
      apply_note: '新入职', created_at: '2026-10-01T00:00:00Z',
    }],
    statusRows: [{ status: 'pending' }, { status: 'active' }, { status: 'active' }, { status: 'disabled' }],
    claims: [{ id: '10000000-0000-4000-8000-000000000002', username: 'emp01', staff_name: '何广友' }],
  });
  const r = await call(asManager({ action: 'list' }));
  ok('ok:true', r.data.ok === true, r.data);
  ok('返回 1 条待审核', r.data.pending?.length === 1, r.data.pending);
  ok('计数正确 pending=1 active=2 disabled=1 rejected=0',
    r.data.counts.pending === 1 && r.data.counts.active === 2 &&
    r.data.counts.disabled === 1 && r.data.counts.rejected === 0, r.data.counts);
  ok('员工名单带 taken_by', r.data.staff[0].name === '何广友' && r.data.staff[0].taken_by === 'emp01', r.data.staff);
  ok('回显自己的身份', r.data.me.username === 'mgr01' && r.data.me.role === 'manager', r.data.me);
}

// =============================================================
console.log('\n=== approve ===');
// =============================================================
{
  reset();
  const r = await call(asManager({ action: 'approve', id: 'not-a-uuid' }));
  ok('id 不是 uuid → BAD_ID', r.data.code === 'BAD_ID', r.data);
}
{
  reset();
  const r = await call(asManager({ action: 'approve', id: '11111111-1111-1111-1111-111111111111' }));
  ok('账号不存在 → NOT_FOUND', r.data.code === 'NOT_FOUND', r.data);
}
{
  reset({
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000013': {
        id: '10000000-0000-4000-8000-000000000013', username: 'gone01', display_name: '离职的',
        role: 'employee', status: 'disabled', staff_name: '何广友',
      },
    },
  });
  const r = await call(asManager({ action: 'approve', id: '10000000-0000-4000-8000-000000000013' }));
  ok('目标已停用 → IS_DISABLED', r.data.code === 'IS_DISABLED', r.data);
}
{
  reset({
    pending: [],
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'new01', display_name: '新来的',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'approve', id: '10000000-0000-4000-8000-000000000011' }));
  ok('员工不绑定姓名 → NEED_STAFF', r.data.code === 'NEED_STAFF', r.data);
  ok('  且没写库', !patched(), calls.map((c) => c.method + ' ' + c.path));
}
{
  reset({
    staffNames: ['何广友'],
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'new01', display_name: '新来的',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'approve', id: '10000000-0000-4000-8000-000000000011', staff_name: '查无此人' }));
  ok('姓名不在名单 → STAFF_NOT_FOUND', r.data.code === 'STAFF_NOT_FOUND', r.data);
}
{
  reset({
    claimedByName: { 何广友: [{ id: '10000000-0000-4000-8000-000000000002', username: 'emp01', staff_name: '何广友' }] },
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'new01', display_name: '新来的',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'approve', id: '10000000-0000-4000-8000-000000000011', staff_name: '何广友' }));
  ok('员工已被别人占用 → STAFF_TAKEN', r.data.code === 'STAFF_TAKEN', r.data);
  ok('  提示里带占用者账号', String(r.data.error).includes('emp01'), r.data.error);
}
{
  reset({
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'new01', display_name: '新来的',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'approve', id: '10000000-0000-4000-8000-000000000011', staff_name: '何广友', role: 'employee' }));
  ok('正常通过 → ok:true', r.data.ok === true, r.data);
  ok('  返回 status=active', r.data.status === 'active', r.data);
  const p = patched();
  ok('  落库 status=active', p?.body?.status === 'active', p?.body);
  ok('  落库 role=employee', p?.body?.role === 'employee', p?.body);
  ok('  落库 staff_name', p?.body?.staff_name === '何广友', p?.body);
  ok('  落库 display_name 用员工名', p?.body?.display_name === '何广友', p?.body);
  ok('  落库 approved_by = 自己', p?.body?.approved_by === '10000000-0000-4000-8000-000000000001', p?.body);
  ok('  落库 approved_at 是 ISO 时间', typeof p?.body?.approved_at === 'string' && p.body.approved_at.includes('T'), p?.body);
  ok('  清掉旧的拒绝理由', p?.body?.rejected_reason === null, p?.body);
  ok('  写了审计 review_approve', !!audited('review_approve'), calls.map((c) => c.path));
}
{
  reset({
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000012': {
        id: '10000000-0000-4000-8000-000000000012', username: 'boss01', display_name: '副经理',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'approve', id: '10000000-0000-4000-8000-000000000012', role: 'manager' }));
  ok('批成 manager 时不需要绑定姓名', r.data.ok === true && r.data.staff_name === null, r.data);
  ok('  落库 role=manager', patched()?.body?.role === 'manager', patched()?.body);
}
{
  reset({
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'new01', display_name: '新来的',
        role: 'employee', status: 'pending', staff_name: '何广友',
      },
    },
  });
  const r = await call(asManager({ action: 'approve', id: '10000000-0000-4000-8000-000000000011', role: 'god' }));
  ok('非法角色 → BAD_ROLE', r.data.code === 'BAD_ROLE', r.data);
}

// =============================================================
console.log('\n=== unbind ===');
// =============================================================
{
  reset();
  const r = await call(asManager({ action: 'unbind', id: 'not-a-uuid' }));
  ok('id 不是 uuid → BAD_ID', r.data.code === 'BAD_ID', r.data);
}
{
  reset();
  const r = await call(asManager({ action: 'unbind', id: '11111111-1111-1111-1111-111111111111' }));
  ok('账号不存在 → NOT_FOUND', r.data.code === 'NOT_FOUND', r.data);
}
{
  reset(); // emp01 绑着「何广友」
  const r = await call(asManager({ action: 'unbind', id: '10000000-0000-4000-8000-000000000002' }));
  ok('员工解绑 → ok:true 且 staff_name 清空', r.data.ok === true && r.data.staff_name === null, r.data);
  ok('  落库 staff_name=null', patched()?.body?.staff_name === null, patched()?.body);
  ok('  员工解绑顺带降为只读（否则他看不到任何班表）',
    patched()?.body?.role === 'viewer' && r.data.role === 'viewer', patched()?.body);
  ok('  返回原本的角色', r.data.was_role === 'employee', r.data);
  ok('  写了审计 review_unbind', !!audited('review_unbind'), calls.map((c) => c.path));
}
{
  reset(); // mgr01 本来就没绑员工
  const r = await call(asManager({ action: 'unbind', id: '10000000-0000-4000-8000-000000000001' }));
  ok('本来就没绑 → NOT_BOUND', r.data.code === 'NOT_BOUND', r.data);
  ok('  且没写库', !patched(), calls.map((c) => c.method + ' ' + c.path));
}
{
  reset({
    profilesById: {
      '10000000-0000-4000-8000-000000000001': {
        id: '10000000-0000-4000-8000-000000000001', username: 'mgr01', display_name: '王经理',
        role: 'manager', status: 'active', staff_name: '何广友',
      },
    },
  });
  const r = await call(asManager({ action: 'unbind', id: '10000000-0000-4000-8000-000000000001', role: 'manager' }));
  ok('显式指定角色时按它落库（经理不降级）', r.data.ok === true && patched()?.body?.role === 'manager', patched()?.body);
}
{
  reset();
  const r = await call(asManager({ action: 'unbind', id: '10000000-0000-4000-8000-000000000002', role: 'god' }));
  ok('非法角色 → BAD_ROLE', r.data.code === 'BAD_ROLE', r.data);
  ok('  且没写库', !patched(), calls.map((c) => c.method + ' ' + c.path));
}

// =============================================================
console.log('\n=== reject ===');
// =============================================================
{
  reset({
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'new01', display_name: '新来的',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'reject', id: '10000000-0000-4000-8000-000000000011', reason: '名单里没你' }));
  ok('拒绝 → ok:true', r.data.ok === true && r.data.status === 'rejected', r.data);
  ok('  落库 rejected_reason', patched()?.body?.rejected_reason === '名单里没你', patched()?.body);
  ok('  写了审计 review_reject', !!audited('review_reject'), calls.map((c) => c.path));
}
{
  reset();
  const r = await call(asManager({ action: 'reject', id: '10000000-0000-4000-8000-000000000002' }));
  ok('已在用的账号不能拒绝 → NOT_PENDING', r.data.code === 'NOT_PENDING', r.data);
}

// =============================================================
console.log('\n=== purge ===');
// =============================================================
{
  reset();
  const r = await call(asManager({ action: 'purge', id: '10000000-0000-4000-8000-000000000001' }));
  ok('不能删自己 → FORBIDDEN', r.data.code === 'FORBIDDEN', r.data);
  ok('  且没删任何东西', !deleted('/auth/v1/admin/users/'), calls.map((c) => c.path));
}
{
  reset();
  const r = await call(asManager({ action: 'purge', id: '10000000-0000-4000-8000-000000000002' }));
  ok('在用的账号不能直接删 → IS_ACTIVE', r.data.code === 'IS_ACTIVE', r.data);
}
{
  reset({
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000014': {
        id: '10000000-0000-4000-8000-000000000014', username: 'boss02', display_name: '副经理',
        role: 'manager', status: 'rejected', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'purge', id: '10000000-0000-4000-8000-000000000014' }));
  ok('不能删经理账号 → FORBIDDEN', r.data.code === 'FORBIDDEN', r.data);
}
{
  reset({
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'spam01', display_name: '刷注册的',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'purge', id: '10000000-0000-4000-8000-000000000011' }));
  ok('删除成功 → deleted:true', r.data.ok === true && r.data.deleted === true, r.data);
  ok('  先删了 Auth 用户（级联带走 profile）', !!deleted('/auth/v1/admin/users/10000000-0000-4000-8000-000000000011'), calls.map((c) => c.method + ' ' + c.path));
  ok('  写了审计 review_purge', !!audited('review_purge'), calls.map((c) => c.path));
}
{
  reset({
    deleteFails: true,
    profilesById: {
      ...S.profilesById,
      '10000000-0000-4000-8000-000000000011': {
        id: '10000000-0000-4000-8000-000000000011', username: 'spam01', display_name: '刷注册的',
        role: 'employee', status: 'pending', staff_name: null,
      },
    },
  });
  const r = await call(asManager({ action: 'purge', id: '10000000-0000-4000-8000-000000000011' }));
  ok('Auth 删除失败 → DELETE_FAILED 500', r.data.code === 'DELETE_FAILED' && r.status === 500, r.data);
  ok('  不算成功、不写审计', !audited('review_purge'), calls.map((c) => c.path));
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
