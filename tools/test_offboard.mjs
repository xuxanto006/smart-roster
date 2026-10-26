// =============================================================
// tools/test_offboard.mjs · offboard 函数全分支测试（mock PostgREST + GoTrue）
//
// 前置：npx esbuild supabase/functions/offboard/index.ts --bundle --format=esm \
//         --platform=neutral --target=es2022 --outfile=tools/_build/f/offboard.mjs
// 运行：node test_offboard.mjs
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

const MGR = '10000000-0000-4000-8000-000000000001';
const MGR2 = '10000000-0000-4000-8000-000000000009';
const EMP = '10000000-0000-4000-8000-000000000002';
const OFF = '10000000-0000-4000-8000-000000000011';
const PEND = '10000000-0000-4000-8000-000000000012';

const calls = [];
const S = {
  tokenUsers: {
    'tok-manager-0123456789abcdef': MGR,
    'tok-employee-0123456789abcdef': EMP,
  },
  profilesById: {},
  managers: [],
  devices: [],
  bans: [],
  offboardBanned: 2,
  banFails: false,
  unbanFails: [],
  rpcOffboardCalls: 0,
  rpcReactivateCalls: 0,
  banDurations: [],
  unbanned: [],
};

reset();
function reset(over = {}) {
  calls.length = 0;
  Object.assign(
    S,
    {
      profilesById: {
        [MGR]: { id: MGR, username: 'mgr01', display_name: '王经理', role: 'manager', status: 'active', staff_name: null, last_login_at: '2026-10-27T01:00:00Z', disabled_at: null, disabled_reason: null, created_at: '2026-10-01T00:00:00Z' },
        [MGR2]: { id: MGR2, username: 'mgr02', display_name: '李经理', role: 'manager', status: 'active', staff_name: null, last_login_at: null, disabled_at: null, disabled_reason: null, created_at: '2026-10-01T00:00:00Z' },
        [EMP]: { id: EMP, username: 'emp01', display_name: '何广友', role: 'employee', status: 'active', staff_name: '何广友', last_login_at: null, disabled_at: null, disabled_reason: null, created_at: '2026-10-02T00:00:00Z' },
        [OFF]: { id: OFF, username: 'gone01', display_name: '离职的', role: 'employee', status: 'disabled', staff_name: '王秋千', last_login_at: '2026-10-20T00:00:00Z', disabled_at: '2026-10-21T00:00:00Z', disabled_reason: '离职封禁', created_at: '2026-10-03T00:00:00Z' },
        [PEND]: { id: PEND, username: 'new01', display_name: '待审核', role: 'employee', status: 'pending', staff_name: null, last_login_at: null, disabled_at: null, disabled_reason: null, created_at: '2026-10-26T00:00:00Z' },
      },
      managers: [{ id: MGR }, { id: MGR2 }],
      devices: [
        { id: 1, profile_id: EMP, device_hash: 'dev-hash-emp-1', ua: 'iPhone', first_seen: '2026-10-20T00:00:00Z', last_seen: '2026-10-27T00:00:00Z', revoked_at: null },
        { id: 2, profile_id: EMP, device_hash: 'dev-hash-emp-2', ua: 'Mac', first_seen: '2026-10-19T00:00:00Z', last_seen: '2026-10-25T00:00:00Z', revoked_at: '2026-10-25T01:00:00Z' },
        { id: 3, profile_id: OFF, device_hash: 'dev-hash-off-1', ua: 'Android', first_seen: '2026-10-01T00:00:00Z', last_seen: '2026-10-21T00:00:00Z', revoked_at: '2026-10-21T00:00:00Z' },
      ],
      bans: [
        { device_hash: 'dev-hash-emp-2', reason: '管理员手动拉黑', banned_at: '2026-10-25T01:00:00Z', lifted_at: null },
        { device_hash: 'dev-hash-off-1', reason: '离职封禁', banned_at: '2026-10-21T00:00:00Z', lifted_at: null },
        { device_hash: 'dev-hash-old-9', reason: '旧封禁', banned_at: '2026-09-01T00:00:00Z', lifted_at: '2026-09-02T00:00:00Z' },
      ],
      offboardBanned: 2,
      banFails: false,
      unbanFails: [],
      rpcOffboardCalls: 0,
      rpcReactivateCalls: 0,
      banDurations: [],
      unbanned: [],
    },
    over,
  );
}

function jsonRes(body, status = 200) {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
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

  if (method === 'GET' && path === '/auth/v1/user') {
    const token = String((init.headers ?? {}).Authorization ?? '').replace(/^Bearer /, '');
    const id = S.tokenUsers[token];
    return id ? jsonRes({ id }) : jsonRes({ message: 'invalid JWT' }, 401);
  }
  if (method === 'PUT' && path.startsWith('/auth/v1/admin/users/')) {
    const id = decodeURIComponent(path.slice('/auth/v1/admin/users/'.length));
    if (S.banFails) {
      calls.push({ path: 'BAN_FAILED', method, body, id });
      return jsonRes({ message: 'boom' }, 500);
    }
    S.banDurations.push({ id, duration: body?.ban_duration });
    return jsonRes({ id, ban_duration: body?.ban_duration });
  }

  // ---- profiles ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?role=eq.manager')) {
    return jsonRes(S.managers);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?username=eq.')) {
    const name = decodeURIComponent(path.slice('/rest/v1/profiles?username=eq.'.length).split('&')[0]);
    const hit = Object.values(S.profilesById).find((p) => p.username === name);
    return jsonRes(hit ? [hit] : []);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    const id = decodeURIComponent(path.slice('/rest/v1/profiles?id=eq.'.length).split('&')[0]);
    const p = S.profilesById[id];
    return jsonRes(p ? [p] : []);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?select=')) {
    return jsonRes(Object.values(S.profilesById));
  }

  // ---- devices ----
  if (method === 'GET' && path.startsWith('/rest/v1/devices?profile_id=eq.')) {
    const id = decodeURIComponent(path.slice('/rest/v1/devices?profile_id=eq.'.length).split('&')[0]);
    return jsonRes(S.devices.filter((d) => d.profile_id === id));
  }
  if (method === 'GET' && path.startsWith('/rest/v1/devices?select=')) {
    return jsonRes(S.devices);
  }

  // ---- device_bans ----
  if (method === 'GET' && path.startsWith('/rest/v1/device_bans?select=')) {
    return jsonRes(S.bans);
  }

  // ---- RPC ----
  if (method === 'POST' && path === '/rest/v1/rpc/offboard_profile') {
    S.rpcOffboardCalls += 1;
    return jsonRes(S.offboardBanned);
  }
  if (method === 'POST' && path === '/rest/v1/rpc/reactivate_profile') {
    S.rpcReactivateCalls += 1;
    return new Response(null, { status: 204 });
  }
  if (method === 'POST' && path === '/rest/v1/rpc/unban_device') {
    const hash = body?.p_device_hash;
    if (S.unbanFails.includes(hash)) return jsonRes({ message: 'boom' }, 500);
    S.unbanned.push(hash);
    return jsonRes(true);
  }

  if (method === 'POST' && path === '/rest/v1/audit_logs') return jsonRes([{}], 201);

  return jsonRes({ error: 'unmocked ' + method + ' ' + path }, 500);
};

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

await import('./_build/f/offboard.mjs');

async function call(payload, opts = {}) {
  const method = opts.method ?? 'POST';
  const headers = { origin: 'http://localhost' };
  const init = { method, headers };
  if (method === 'POST') {
    headers['content-type'] = 'text/plain;charset=UTF-8';
    init.body = opts.raw ?? JSON.stringify(payload ?? {});
  }
  const res = await handler(new Request('http://x/functions/v1/offboard', init));
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, text };
}

const asMgr = (extra) => ({ token: 'tok-manager-0123456789abcdef', ...extra });

// =============================================================
console.log('\n=== 协议层 / 鉴权 ===');
// =============================================================
{
  const r = await call(null, { method: 'OPTIONS' });
  ok('OPTIONS → 204 空 body', r.status === 204 && r.text === '', r.status);
}
{
  const r = await call(null, { method: 'GET' });
  ok('GET → 405', r.status === 405 && r.data.code === 'BAD_METHOD', r.data);
}
{
  const r = await call(null, { raw: '{bad' });
  ok('坏 JSON → 400', r.status === 400 && r.data.code === 'BAD_JSON', r.data);
}
{
  reset();
  const r = await call({ action: 'list' });
  ok('无 token → NO_TOKEN', r.data.code === 'NO_TOKEN', r.data);
}
{
  reset();
  const r = await call({ token: 'tok-employee-0123456789abcdef', action: 'offboard', id: EMP });
  ok('员工 → FORBIDDEN 403', r.data.code === 'FORBIDDEN' && r.status === 403, r.data);
  ok('  且没有调停用 RPC', S.rpcOffboardCalls === 0, S.rpcOffboardCalls);
}

// =============================================================
console.log('\n=== list ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'list' }));
  ok('ok:true', r.data.ok === true, r.data);
  ok('counts: active=3 disabled=1 pending=1 rejected=0',
    r.data.counts.active === 3 && r.data.counts.disabled === 1 &&
    r.data.counts.pending === 1 && r.data.counts.rejected === 0, r.data.counts);
  ok('在封设备数=2（已解封的不算）', r.data.banned_devices === 2, r.data.banned_devices);
  const emp = r.data.accounts.find((a) => a.username === 'emp01');
  ok('emp01 设备 2 台 / 在线 1 台 / 被拉黑 1 台',
    emp.device_total === 2 && emp.device_live === 1 && emp.device_banned === 1, emp);
  ok('emp01 最近活跃时间取自设备 last_seen', emp.last_seen === '2026-10-27T00:00:00Z', emp.last_seen);
  ok('标记出「这是我」', r.data.accounts.find((a) => a.username === 'mgr01').is_self === true, null);
  ok('别人的 is_self=false', emp.is_self === false, null);
}

// =============================================================
console.log('\n=== offboard · 各种拦截 ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'offboard', id: MGR }));
  ok('停用自己 → FORBIDDEN', r.data.code === 'FORBIDDEN' && r.status === 403, r.data);
  ok('  且没调 RPC、没封 Auth', S.rpcOffboardCalls === 0 && S.banDurations.length === 0, null);
}
{
  reset();
  const r = await call(asMgr({ action: 'offboard', id: PEND }));
  ok('待审核账号 → BAD_STATUS', r.data.code === 'BAD_STATUS', r.data);
  ok('  且没调 RPC', S.rpcOffboardCalls === 0, null);
}
{
  reset();
  const r = await call(asMgr({ action: 'offboard', username: 'gone01' }));
  ok('已停用的账号 → already:true（幂等）', r.data.ok === true && r.data.already === true, r.data);
  ok('  不重复封禁', S.rpcOffboardCalls === 0 && S.banDurations.length === 0, null);
}
{
  reset();
  const r = await call(asMgr({ action: 'offboard', id: 'not-a-uuid' }));
  ok('id 格式不对 → BAD_ID', r.data.code === 'BAD_ID', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'offboard', id: '10000000-0000-4000-8000-0000000000ff' }));
  ok('账号不存在 → NOT_FOUND', r.data.code === 'NOT_FOUND', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'offboard' }));
  ok('什么都没传 → BAD_ID', r.data.code === 'BAD_ID', r.data);
}
{
  // 只剩一个 active manager：mgr01 想停用自己会被 self 拦住，
  // 所以这里测「停用最后一个经理」用一个只有 1 个 manager 的场景
  reset({ managers: [{ id: MGR2 }] });
  S.profilesById[MGR2] = { ...S.profilesById[MGR2], status: 'disabled' };
  S.profilesById[MGR] = { ...S.profilesById[MGR], status: 'active', role: 'manager' };
  S.profilesById[EMP] = { ...S.profilesById[EMP], role: 'manager', status: 'active', staff_name: '何广友' };
  const r = await call(asMgr({ action: 'offboard', id: EMP }));
  ok('停用最后一个在用经理 → LAST_MANAGER 403',
    r.data.code === 'LAST_MANAGER' && r.status === 403, r.data);
  ok('  且没调 RPC', S.rpcOffboardCalls === 0, null);
}

// =============================================================
console.log('\n=== offboard · 正常路径 ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'offboard', username: 'emp01', reason: '离职' }));
  ok('ok:true，status=disabled', r.data.ok === true && r.data.status === 'disabled', r.data);
  ok('返回被拉黑设备数=2', r.data.devices_banned === 2, r.data.devices_banned);
  ok('Auth 也封上了', r.data.auth_banned === true && r.data.warning === null, r.data);
  const rpc = calls.find((c) => c.path === '/rest/v1/rpc/offboard_profile');
  ok('RPC 传了 profile/actor/reason',
    rpc?.body?.p_profile === EMP && rpc?.body?.p_actor === MGR && rpc?.body?.p_reason === '离职', rpc?.body);
  ok('Auth 封禁时长是 100 年（876000h）',
    S.banDurations[0]?.id === EMP && S.banDurations[0]?.duration === '876000h', S.banDurations[0]);
  ok('reason 也回显', r.data.reason === '离职', r.data.reason);
}
{
  reset();
  const r = await call(asMgr({ action: 'offboard', username: 'emp01', reason: '   ' }));
  ok('reason 空白 → 兜底文案「离职封禁」', r.data.reason === '离职封禁', r.data.reason);
}
{
  reset({ banFails: true });
  const r = await call(asMgr({ action: 'offboard', id: EMP }));
  ok('Auth 封禁失败 → ok:true 但 auth_banned=false', r.data.ok === true && r.data.auth_banned === false, r.data);
  ok('  给出 warning 提示手动补', typeof r.data.warning === 'string' && r.data.warning.includes('Auth'), r.data.warning);
  ok('  数据库层仍然执行了 RPC（RLS 已失效）', S.rpcOffboardCalls === 1, S.rpcOffboardCalls);
}

// =============================================================
console.log('\n=== reactivate ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'reactivate', username: 'emp01' }));
  ok('本来就在用 → already:true', r.data.ok === true && r.data.already === true, r.data);
  ok('  没改库', S.rpcReactivateCalls === 0 && S.banDurations.length === 0, null);
}
{
  reset();
  const r = await call(asMgr({ action: 'reactivate', id: PEND }));
  ok('待审核 → BAD_STATUS', r.data.code === 'BAD_STATUS', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'reactivate', username: 'gone01' }));
  ok('恢复成功 → status=active', r.data.ok === true && r.data.status === 'active', r.data);
  ok('  调了 reactivate_profile', S.rpcReactivateCalls === 1, S.rpcReactivateCalls);
  ok('  Auth 解封（duration=none）', S.banDurations[0]?.duration === 'none', S.banDurations[0]);
  ok('  默认不解封设备（设备封禁是永久的）', S.unbanned.length === 0 && r.data.devices_lifted === 0, r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'reactivate', username: 'gone01', lift_devices: true }));
  ok('lift_devices:true → 解封该账号的设备', S.unbanned.length === 1 && S.unbanned[0] === 'dev-hash-off-1', S.unbanned);
  ok('  返回解封数量', r.data.devices_lifted === 1, r.data.devices_lifted);
}
{
  reset();
  S.devices = S.devices.filter((d) => d.profile_id !== OFF).concat([
    { id: 9, profile_id: OFF, device_hash: 'dev-hash-off-1', ua: 'A', first_seen: '2026-10-01T00:00:00Z', last_seen: '2026-10-21T00:00:00Z', revoked_at: null },
    { id: 10, profile_id: OFF, device_hash: 'dev-hash-off-2', ua: 'B', first_seen: '2026-10-02T00:00:00Z', last_seen: '2026-10-22T00:00:00Z', revoked_at: null },
  ]);
  S.unbanFails = ['dev-hash-off-2'];
  const r = await call(asMgr({ action: 'reactivate', username: 'gone01', lift_devices: true }));
  ok('一台解封失败不影响整体', r.data.ok === true, r.data);
  ok('  只统计成功的那台', r.data.devices_lifted === 1, r.data.devices_lifted);
}
{
  reset();
  const r = await call(asMgr({ action: 'reactivate' }));
  ok('没传账号 → BAD_ID', r.data.code === 'BAD_ID', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'nope' }));
  ok('未知 action → BAD_ACTION', r.data.code === 'BAD_ACTION', r.data);
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
