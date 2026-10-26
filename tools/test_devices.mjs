// =============================================================
// tools/test_devices.mjs · devices 函数全分支测试（mock PostgREST + GoTrue）
//
// 前置：npx esbuild supabase/functions/devices/index.ts --bundle --format=esm \
//         --platform=neutral --target=es2022 --outfile=tools/_build/f/devices.mjs
// 运行：node test_devices.mjs
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
const EMP = '10000000-0000-4000-8000-000000000002';
const OFF = '10000000-0000-4000-8000-000000000011';

const calls = [];
const S = {
  tokenUsers: { 'tok-manager-0123456789abcdef': MGR, 'tok-employee-0123456789abcdef': EMP },
  profilesById: {},
  devices: [],
  bans: [],
  unbanResult: true,
  rpcBan: [],
};

reset();
function reset(over = {}) {
  calls.length = 0;
  Object.assign(
    S,
    {
      profilesById: {
        [MGR]: { id: MGR, username: 'mgr01', display_name: '王经理', role: 'manager', status: 'active', staff_name: null },
        [EMP]: { id: EMP, username: 'emp01', display_name: '何广友', role: 'employee', status: 'active', staff_name: '何广友' },
        [OFF]: { id: OFF, username: 'gone01', display_name: '离职的', role: 'employee', status: 'disabled', staff_name: '王秋千' },
      },
      devices: [
        { id: 1, profile_id: EMP, device_hash: 'AAAABBBBCCCCDDDD1111', ua: 'iPhone', first_seen: '2026-10-20T00:00:00Z', last_seen: '2026-10-27T00:00:00Z', revoked_at: null },
        { id: 2, profile_id: EMP, device_hash: 'EEEFFFFFGGGGHHHH2222', ua: 'Mac', first_seen: '2026-10-19T00:00:00Z', last_seen: '2026-10-25T00:00:00Z', revoked_at: '2026-10-25T01:00:00Z' },
        { id: 3, profile_id: OFF, device_hash: 'IIIJJJJJKKKKLLLL3333', ua: 'Android', first_seen: '2026-10-01T00:00:00Z', last_seen: '2026-10-21T00:00:00Z', revoked_at: '2026-10-21T00:00:00Z' },
      ],
      bans: [
        { device_hash: 'EEEFFFFFGGGGHHHH2222', reason: '管理员手动拉黑', banned_at: '2026-10-25T01:00:00Z', lifted_at: null },
        { device_hash: 'IIIJJJJJKKKKLLLL3333', reason: '离职封禁', banned_at: '2026-10-21T00:00:00Z', lifted_at: null },
        { device_hash: 'ZZZZZZZZZZZZZZZZ9999', reason: '旧封禁', banned_at: '2026-09-01T00:00:00Z', lifted_at: '2026-09-02T00:00:00Z' },
      ],
      unbanResult: true,
      rpcBan: [],
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
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?id=in.(')) {
    const raw = path.slice('/rest/v1/profiles?id=in.('.length).split(')')[0];
    const ids = raw.split(',').map((s) => decodeURIComponent(s));
    return jsonRes(ids.map((i) => S.profilesById[i]).filter(Boolean));
  }
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    const id = decodeURIComponent(path.slice('/rest/v1/profiles?id=eq.'.length).split('&')[0]);
    const p = S.profilesById[id];
    return jsonRes(p ? [p] : []);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/devices?device_hash=eq.')) {
    const hash = decodeURIComponent(path.slice('/rest/v1/devices?device_hash=eq.'.length).split('&')[0]);
    return jsonRes(S.devices.filter((d) => d.device_hash === hash));
  }
  if (method === 'GET' && path.startsWith('/rest/v1/devices?select=')) {
    return jsonRes(S.devices);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/device_bans?select=')) {
    return jsonRes(S.bans);
  }
  if (method === 'PATCH' && path.startsWith('/rest/v1/devices?device_hash=eq.')) {
    const hash = decodeURIComponent(path.slice('/rest/v1/devices?device_hash=eq.'.length));
    for (const d of S.devices) if (d.device_hash === hash) Object.assign(d, body);
    return new Response(null, { status: 204 });
  }
  if (method === 'POST' && path === '/rest/v1/rpc/ban_device') {
    S.rpcBan.push(body);
    return new Response(null, { status: 204 });
  }
  if (method === 'POST' && path === '/rest/v1/rpc/unban_device') {
    return jsonRes(S.unbanResult);
  }

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

await import('./_build/f/devices.mjs');

async function call(payload, opts = {}) {
  const method = opts.method ?? 'POST';
  const headers = { origin: 'http://localhost' };
  const init = { method, headers };
  if (method === 'POST') {
    headers['content-type'] = 'text/plain;charset=UTF-8';
    init.body = opts.raw ?? JSON.stringify(payload ?? {});
  }
  const res = await handler(new Request('http://x/functions/v1/devices', init));
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
  const r = await call({ token: 'tok-employee-0123456789abcdef', action: 'list' });
  ok('员工 → FORBIDDEN 403', r.data.code === 'FORBIDDEN' && r.status === 403, r.data);
}

// =============================================================
console.log('\n=== list ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'list' }));
  ok('ok:true', r.data.ok === true, r.data);
  ok('stats: 3 台设备 / 1 台在线 / 2 个在封 / 1 个曾解封',
    r.data.stats.devices === 3 && r.data.stats.live === 1 &&
    r.data.stats.banned_live === 2 && r.data.stats.bans_lifted === 1, r.data.stats);
  const d1 = r.data.devices.find((d) => d.id === 1);
  ok('设备关联到账号名', d1.username === 'emp01' && d1.display_name === '何广友', d1);
  ok('未被封的设备 banned=false', d1.banned === false, d1.banned);
  const d2 = r.data.devices.find((d) => d.id === 2);
  ok('在黑名单里的设备 banned=true', d2.banned === true, d2.banned);
  ok('吊销过的设备 revoked_at 有值', !!d2.revoked_at, d2.revoked_at);
  const b1 = r.data.bans.find((b) => b.device_hash === 'EEEFFFFFGGGGHHHH2222');
  ok('黑名单返回 active=true + 属主账号', b1.active === true && b1.username === 'emp01', b1);
  const b3 = r.data.bans.find((b) => b.device_hash === 'ZZZZZZZZZZZZZZZZ9999');
  ok('已解封的黑名单 active=false', b3.active === false, b3);
  ok('找不到属主的黑名单 username=null', b3.username === null, b3.username);
}

// =============================================================
console.log('\n=== ban ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'ban', device_hash: 'short' }));
  ok('hash 太短 → BAD_HASH', r.data.code === 'BAD_HASH', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'ban', device_hash: '带中文的设备号带中文的设备号' }));
  ok('hash 含中文 → BAD_HASH', r.data.code === 'BAD_HASH', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'ban' }));
  ok('没传 hash → BAD_HASH', r.data.code === 'BAD_HASH', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'ban', device_hash: 'AAAABBBBCCCCDDDD1111', reason: '外借账号' }));
  ok('拉黑成功 ok:true', r.data.ok === true && r.data.banned === true, r.data);
  ok('  RPC 传了 hash/actor/reason',
    S.rpcBan[0]?.p_device_hash === 'AAAABBBBCCCCDDDD1111' &&
    S.rpcBan[0]?.p_actor === MGR && S.rpcBan[0]?.p_reason === '外借账号', S.rpcBan[0]);
  ok('  reason 回显', r.data.reason === '外借账号', r.data.reason);
}
{
  reset();
  const r = await call(asMgr({ action: 'ban', device_hash: 'AAAABBBBCCCCDDDD1111' }));
  ok('不填理由 → 兜底「管理员手动拉黑」', S.rpcBan[0]?.p_reason === '管理员手动拉黑', S.rpcBan[0]);
}

// =============================================================
console.log('\n=== unban ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'unban', device_hash: 'bad' }));
  ok('hash 格式不对 → BAD_HASH', r.data.code === 'BAD_HASH', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'unban', device_hash: 'EEEFFFFFGGGGHHHH2222' }));
  ok('解封成功 lifted=true', r.data.ok === true && r.data.lifted === true, r.data);
  ok('  提示「可以再次登录」', String(r.data.note).includes('再次登录'), r.data.note);
}
{
  reset({ unbanResult: false });
  const r = await call(asMgr({ action: 'unban', device_hash: 'QQQQQQQQQQQQQQQQ0000' }));
  ok('本来就不在黑名单 → lifted=false', r.data.lifted === false, r.data);
  ok('  仍 ok:true（不报错，只清会话吊销）', r.data.ok === true, r.data);
  ok('  提示说明白了', String(r.data.note).includes('本来就不在'), r.data.note);
}

// =============================================================
console.log('\n=== revoke（踢下线） ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'revoke', device_hash: 'NOSUCHDEVICE0000000' }));
  ok('没有这个设备 → NOT_FOUND', r.data.code === 'NOT_FOUND', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'revoke', device_hash: 'hb' }));
  ok('hash 格式不对 → BAD_HASH', r.data.code === 'BAD_HASH', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'revoke', device_hash: 'AAAABBBBCCCCDDDD1111' }));
  ok('吊销成功，统计了在线的会话数', r.data.ok === true && r.data.revoked === 1, r.data);
  const patch = calls.find((c) => c.method === 'PATCH');
  ok('  PATCH 写了 revoked_at + revoked_by',
    typeof patch?.body?.revoked_at === 'string' && patch?.body?.revoked_by === MGR, patch?.body);
  ok('  devices 表里确实被吊销了', !!S.devices.find((d) => d.id === 1).revoked_at, null);
  ok('  提示「下次登录还能回来」（不拉黑）', String(r.data.note).includes('仍可回来'), r.data.note);
  ok('  没有动 device_bans（revoke≠ban）', S.rpcBan.length === 0, S.rpcBan.length);
}

// =============================================================
console.log('\n=== 其他 ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'nope' }));
  ok('未知 action → BAD_ACTION', r.data.code === 'BAD_ACTION', r.data);
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
