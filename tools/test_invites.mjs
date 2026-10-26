// =============================================================
// tools/test_invites.mjs · invites 函数全分支测试（mock PostgREST + GoTrue）
//
// 前置：npx esbuild supabase/functions/invites/index.ts --bundle --format=esm \
//         --platform=neutral --target=es2022 --outfile=tools/_build/f/invites.mjs
// 运行：node test_invites.mjs
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

const calls = [];
const S = {
  tokenUsers: { 'tok-manager-0123456789abcdef': MGR, 'tok-employee-0123456789abcdef': EMP },
  profilesById: {},
  codes: [],
  uses: [],
  names: [],
  failInsertTimes: 0,
  inserted: [],
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
      },
      codes: [],
      uses: [],
      names: [],
      failInsertTimes: 0,
      inserted: [],
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

  // ---- invite_codes 单条 ----
  if (method === 'GET' && path.startsWith('/rest/v1/invite_codes?code=eq.')) {
    const code = decodeURIComponent(path.slice('/rest/v1/invite_codes?code=eq.'.length).split('&')[0]);
    const row = S.codes.find((c) => c.code === code);
    return jsonRes(row ? [row] : []);
  }
  // ---- invite_codes 列表 ----
  if (method === 'GET' && path.startsWith('/rest/v1/invite_codes?select=')) {
    return jsonRes(S.codes);
  }
  // ---- invite_uses ----
  if (method === 'GET' && path.startsWith('/rest/v1/invite_uses?select=')) {
    return jsonRes(S.uses);
  }
  // ---- profiles by id list: in.(a,b) ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?id=in.(')) {
    const raw = path.slice('/rest/v1/profiles?id=in.('.length).split(')')[0];
    const ids = raw.split(',').map((s) => decodeURIComponent(s));
    return jsonRes(ids.map((i) => ({ id: i, username: 'u_' + i.slice(-4), display_name: '名字' + i.slice(-4), status: 'pending' })));
  }
  // ---- profiles 单条 ----
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    const id = decodeURIComponent(path.slice('/rest/v1/profiles?id=eq.'.length).split('&')[0]);
    const p = S.profilesById[id];
    return jsonRes(p ? [p] : []);
  }

  // ---- 写入 ----
  if (method === 'POST' && path === '/rest/v1/audit_logs') return jsonRes([{}], 201);
  if (method === 'POST' && path === '/rest/v1/invite_codes') {
    S.inserted.push(body);
    if (S.failInsertTimes > 0) {
      S.failInsertTimes -= 1;
      return jsonRes({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
    }
    const row = {
      ...body,
      used_count: 0,
      disabled: body.disabled ?? false,
      created_at: '2026-10-27T00:00:00.000Z',
    };
    return jsonRes([row], 201);
  }
  if (method === 'PATCH' && path.startsWith('/rest/v1/invite_codes?code=eq.')) {
    const code = decodeURIComponent(path.slice('/rest/v1/invite_codes?code=eq.'.length).split('&')[0]);
    const row = S.codes.find((c) => c.code === code);
    if (row) Object.assign(row, body);
    return new Response(null, { status: 204 });
  }
  if (method === 'DELETE' && path.startsWith('/rest/v1/invite_codes?code=eq.')) {
    const code = decodeURIComponent(path.slice('/rest/v1/invite_codes?code=eq.'.length).split('&')[0]);
    S.codes = S.codes.filter((c) => c.code !== code);
    return new Response(null, { status: 204 });
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
const patched = () => calls.find((c) => c.method === 'PATCH');
const audited = (action) =>
  calls.find((c) => c.method === 'POST' && c.path === '/rest/v1/audit_logs' && c.body?.action === action);

await import('./_build/f/invites.mjs');

async function call(payload, opts = {}) {
  const method = opts.method ?? 'POST';
  const headers = { origin: 'http://localhost' };
  const init = { method, headers };
  if (method === 'POST') {
    headers['content-type'] = 'text/plain;charset=UTF-8';
    init.body = opts.raw ?? JSON.stringify(payload ?? {});
  }
  const res = await handler(new Request('http://x/functions/v1/invites', init));
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, text, headers: res.headers };
}

const asMgr = (extra) => ({ token: 'tok-manager-0123456789abcdef', ...extra });
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const row = (over) => ({
  code: 'ABCD2345',
  max_uses: 5,
  used_count: 0,
  starts_at: iso(-3600_000),
  ends_at: null,
  disabled: false,
  note: null,
  created_by: MGR,
  created_at: iso(0),
  ...over,
});

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
{
  reset();
  const r = await call(asMgr({ action: 'nope' }));
  ok('未知 action → BAD_ACTION', r.data.code === 'BAD_ACTION', r.data);
}

// =============================================================
console.log('\n=== list ===');
// =============================================================
{
  reset({
    codes: [
      row({ code: 'ACTIVE01', used_count: 1, max_uses: 5 }),
      row({ code: 'EXPIRED1', ends_at: iso(-60000) }),
      row({ code: 'FUTURE01', starts_at: iso(3600_000) }),
      row({ code: 'FULL0001', used_count: 5, max_uses: 5 }),
      row({ code: 'OFF00001', disabled: true }),
    ],
    uses: [
      { code: 'ACTIVE01', profile_id: EMP, used_at: iso(-120000) },
      { code: 'ACTIVE01', profile_id: '10000000-0000-4000-8000-000000000003', used_at: iso(-60000) },
    ],
  });
  const r = await call(asMgr({ action: 'list' }));
  ok('ok:true', r.data.ok === true, r.data);
  const st = Object.fromEntries(r.data.codes.map((c) => [c.code, c.status]));
  ok('在用 → active', st.ACTIVE01 === 'active', st);
  ok('过期 → expired', st.EXPIRED1 === 'expired', st);
  ok('未到时间 → not_started', st.FUTURE01 === 'not_started', st);
  ok('次数用完 → exhausted', st.FULL0001 === 'exhausted', st);
  ok('已停用 → disabled（优先级最高）', st.OFF00001 === 'disabled', st);
  ok('stats.total=5', r.data.stats.total === 5, r.data.stats);
  ok('stats.active=1', r.data.stats.active === 1, r.data.stats);
  ok('stats.used=6（各码 used_count 之和）', r.data.stats.used === 6, r.data.stats);
  ok('uses 关联到账号名', r.data.uses[0].username && r.data.uses[0].account_status === 'pending', r.data.uses[0]);
  ok('uses 条数正确', r.data.uses.length === 2, r.data.uses);
}

// =============================================================
console.log('\n=== create ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'create' }));
  ok('最简创建 → ok:true', r.data.ok === true, r.data);
  ok('  默认 max_uses=1', r.data.invite.max_uses === 1, r.data.invite);
  ok('  自动生成 8 位码', /^[A-Z0-9]{8}$/.test(r.data.invite.code), r.data.invite.code);
  ok('  不含易混字符 I/O/0/1', !/[IO01]/.test(r.data.invite.code), r.data.invite.code);
  ok('  状态 active', r.data.invite.status === 'active', r.data.invite.status);
  ok('  落库带了 created_by', S.inserted[0].created_by === MGR, S.inserted[0]);
  ok('  写了审计 invite_create', !!audited('invite_create'), calls.map((c) => c.path));
}
{
  reset();
  const r = await call(asMgr({ action: 'create', code: 'abc-2345', max_uses: 3, note: '十月批次', ends_at: iso(86400_000) }));
  ok('指定码自动转大写', r.data.invite.code === 'ABC-2345', r.data.invite.code);
  ok('max_uses 生效', r.data.invite.max_uses === 3, r.data.invite);
  ok('note 落库', r.data.invite.note === '十月批次', r.data.invite.note);
}
{
  reset();
  const r = await call(asMgr({ action: 'create', code: 'ab' }));
  ok('码太短 → BAD_CODE', r.data.code === 'BAD_CODE', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'create', code: '中文码' }));
  ok('中文码 → BAD_CODE', r.data.code === 'BAD_CODE', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'create', max_uses: 0 }));
  ok('max_uses=0 → BAD_MAX_USES', r.data.code === 'BAD_MAX_USES', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'create', max_uses: 100000 }));
  ok('max_uses 超上限 → BAD_MAX_USES', r.data.code === 'BAD_MAX_USES', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'create', max_uses: 2.5 }));
  ok('max_uses 非整数 → BAD_MAX_USES', r.data.code === 'BAD_MAX_USES', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'create', starts_at: 'not-a-date' }));
  ok('时间乱填 → BAD_TIME', r.data.code === 'BAD_TIME', r.data);
}
{
  reset();
  const r = await call(asMgr({ action: 'create', starts_at: iso(3600_000), ends_at: iso(0) }));
  ok('结束早于开始 → BAD_WINDOW', r.data.code === 'BAD_WINDOW', r.data);
}
{
  reset();
  S.failInsertTimes = 1;
  const r = await call(asMgr({ action: 'create' }));
  ok('自动生成撞码后重试成功', r.data.ok === true && S.inserted.length === 2, { inserted: S.inserted.length });
  ok('  两次生成的码不一样', S.inserted[0].code !== S.inserted[1].code, S.inserted.map((x) => x.code));
}
{
  reset();
  S.failInsertTimes = 1;
  const r = await call(asMgr({ action: 'create', code: 'TAKEN001' }));
  ok('手填的码已存在 → CODE_TAKEN（不自动换码）', r.data.code === 'CODE_TAKEN', r.data);
}

// =============================================================
console.log('\n=== update ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ action: 'update', code: 'NOPE0001', max_uses: 3 }));
  ok('码不存在 → NOT_FOUND', r.data.code === 'NOT_FOUND', r.data);
}
{
  reset({ codes: [row({ code: 'USED0001', max_uses: 5, used_count: 3 })] });
  const r = await call(asMgr({ action: 'update', code: 'USED0001', max_uses: 2 }));
  ok('max_uses 改到小于已用 → USED_EXCEEDS_MAX', r.data.code === 'USED_EXCEEDS_MAX', r.data);
  ok('  提示带已用次数', String(r.data.error).includes('3'), r.data.error);
  ok('  且没有写库', !patched(), calls.map((c) => c.method + ' ' + c.path));
}
{
  reset({ codes: [row({ code: 'USED0001', max_uses: 5, used_count: 3 })] });
  const r = await call(asMgr({ action: 'update', code: 'USED0001', max_uses: 3 }));
  ok('max_uses 改成正好等于已用 → 允许', r.data.ok === true, r.data);
  ok('  PATCH 里只有 max_uses', patched()?.body?.max_uses === 3, patched()?.body);
}
{
  reset({ codes: [row({ code: 'TIME0001', starts_at: iso(0), ends_at: null })] });
  const r = await call(asMgr({ action: 'update', code: 'TIME0001', ends_at: iso(-1000) }));
  ok('结束时间早于现有开始时间 → BAD_WINDOW', r.data.code === 'BAD_WINDOW', r.data);
}
{
  reset({ codes: [row({ code: 'TIME0001' })] });
  const r = await call(asMgr({ action: 'update', code: 'TIME0001', ends_at: '' }));
  ok('ends_at 传空 → 清空为 null（永不过期）', r.data.ok === true && patched()?.body?.ends_at === null, patched()?.body);
}
{
  reset({ codes: [row({ code: 'SWITCH01' })] });
  const r = await call(asMgr({ action: 'update', code: 'SWITCH01', disabled: true }));
  ok('停用 → status=disabled', r.data.invite.status === 'disabled', r.data.invite);
  ok('  落库 disabled=true', patched()?.body?.disabled === true, patched()?.body);
  ok('  写了审计 invite_update', !!audited('invite_update'), calls.map((c) => c.path));
}
{
  reset({ codes: [row({ code: 'SWITCH01' })] });
  const r = await call(asMgr({ action: 'update', code: 'SWITCH01', disabled: 'yes' }));
  ok('disabled 传字符串 → BAD_DISABLED（不静默当 false）', r.data.code === 'BAD_DISABLED', r.data);
}
{
  reset({ codes: [row({ code: 'SWITCH01' })] });
  const r = await call(asMgr({ action: 'update', code: 'SWITCH01' }));
  ok('什么都没改 → NOTHING_TO_UPDATE', r.data.code === 'NOTHING_TO_UPDATE', r.data);
}

// =============================================================
console.log('\n=== delete ===');
// =============================================================
{
  reset({ codes: [row({ code: 'USED0001', used_count: 2 })] });
  const r = await call(asMgr({ action: 'delete', code: 'USED0001' }));
  ok('用过的码不能删 → IN_USE', r.data.code === 'IN_USE', r.data);
  ok('  且没有删库', !calls.find((c) => c.method === 'DELETE'), calls.map((c) => c.method + ' ' + c.path));
}
{
  reset({ codes: [row({ code: 'NEW00001', used_count: 0 })] });
  const r = await call(asMgr({ action: 'delete', code: 'NEW00001' }));
  ok('没用的码可以删', r.data.ok === true && r.data.deleted === true, r.data);
  ok('  写了审计 invite_delete', !!audited('invite_delete'), calls.map((c) => c.path));
}
{
  reset();
  const r = await call(asMgr({ action: 'delete', code: 'MISSING1' }));
  ok('码不存在 → NOT_FOUND', r.data.code === 'NOT_FOUND', r.data);
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
