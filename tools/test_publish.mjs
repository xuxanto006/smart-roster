// =============================================================
// tools/test_publish.mjs · publish 函数全分支测试（mock PostgREST + GoTrue）
//
// 前置：npx esbuild supabase/functions/publish/index.ts --bundle --format=esm \
//         --platform=neutral --target=es2022 --outfile=tools/_build/f/publish.mjs
// 运行：node test_publish.mjs
//
// 覆盖：协议层 / 鉴权 / 周次校验 / 空周 / 正常发布（v1、v2）/
//       并发撞唯一约束重试 / 中途失败回滚 / 周状态还原
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
const VWR = '10000000-0000-4000-8000-000000000002';
const EMP = '10000000-0000-4000-8000-000000000003';

const WEEK = '2026-10-26'; // 周一
const calls = [];
const S = {};

function reset(over = {}) {
  calls.length = 0;
  Object.assign(
    S,
    {
      tokenUsers: {
        'tok-manager-0123456789abcdef': MGR,
        'tok-viewer-0123456789abcdef': VWR,
        'tok-employee-0123456789abcdef': EMP,
      },
      profilesById: {
        [MGR]: { id: MGR, username: 'mgr01', display_name: '王经理', role: 'manager', status: 'active', staff_name: null },
        [VWR]: { id: VWR, username: 'view01', display_name: '只读', role: 'viewer', status: 'active', staff_name: null },
        [EMP]: { id: EMP, username: 'emp01', display_name: '何广友', role: 'employee', status: 'active', staff_name: '何广友' },
      },
      weekRow: { week_key: WEEK, status: 'draft' },
      shifts: [],
      versions: [],        // { publish_id, version }
      snapshots: [],       // published_shifts 行
      deliveries: [],
      patches: [],         // weeks 的 PATCH body
      audits: [],
      failOn: '',          // 'shifts' | 'versions' | 'snapshots' | 'deliveries' | 'weeks'
      conflictOnce: false, // 第一次插版本时假装被别人抢先
      seq: 0,
    },
    over,
  );
}
reset();

function jsonRes(body, status = 200) {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const boom = (tag) => jsonRes({ message: `${tag} exploded` }, 500);

function rowsFor(cells) {
  // cells: [[名字, day, slot, role?], ...]
  return cells.map(([staff_name, day, slot, role = null]) => ({ week_key: WEEK, staff_name, day, slot, role }));
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

  // ---------------- GoTrue ----------------
  if (method === 'GET' && path === '/auth/v1/user') {
    const token = String((init.headers ?? {}).Authorization ?? '').replace(/^Bearer /, '');
    const id = S.tokenUsers[token];
    return id ? jsonRes({ id }) : jsonRes({ message: 'invalid JWT' }, 401);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/profiles?id=eq.')) {
    const id = decodeURIComponent(path.slice('/rest/v1/profiles?id=eq.'.length).split('&')[0]);
    const p = S.profilesById[id];
    return jsonRes(p ? [p] : []);
  }

  // ---------------- 读 ----------------
  if (method === 'GET' && path.startsWith('/rest/v1/shifts?week_key=eq.')) {
    return jsonRes(S.shifts.filter((r) => r.week_key === WEEK));
  }
  if (method === 'GET' && path.startsWith('/rest/v1/weeks?week_key=eq.')) {
    const key = decodeURIComponent(path.slice('/rest/v1/weeks?week_key=eq.'.length).split('&')[0]);
    return jsonRes(S.weekRow && S.weekRow.week_key === key ? [S.weekRow] : []);
  }
  if (method === 'GET' && path.startsWith('/rest/v1/publish_versions?week_key=eq.')) {
    const max = S.versions.reduce((m, v) => Math.max(m, v.version), 0);
    return jsonRes(max ? [{ version: max }] : []);
  }

  // ---------------- 写 ----------------
  if (method === 'POST' && path === '/rest/v1/publish_versions') {
    if (S.failOn === 'versions') return boom('publish_versions');
    if (S.conflictOnce) {
      S.conflictOnce = false;
      // 模拟另一个经理在我算完版本号之后抢先发布了一版
      S.versions.push({ publish_id: 'other-' + ++S.seq, version: S.versions.reduce((m, v) => Math.max(m, v.version), 0) + 1 });
      return jsonRes({ code: '23505', message: 'duplicate key value violates unique constraint "publish_versions_week_key_version_key"' }, 409);
    }
    const id = 'pub-' + ++S.seq;
    S.versions.push({ publish_id: id, version: body.version });
    return jsonRes([{ publish_id: id, ...body, published_at: '2026-10-27T00:00:00.000Z' }], 201);
  }

  if (method === 'POST' && path === '/rest/v1/published_shifts') {
    if (S.failOn === 'snapshots') return boom('published_shifts');
    const rows = Array.isArray(body) ? body : [body];
    S.snapshots.push(...rows);
    return jsonRes(null, 201);
  }

  if (method === 'POST' && path === '/rest/v1/publish_deliveries') {
    if (S.failOn === 'deliveries') return boom('publish_deliveries');
    const rows = Array.isArray(body) ? body : [body];
    S.deliveries.push(...rows);
    return jsonRes(null, 201);
  }

  if (method === 'POST' && path === '/rest/v1/audit_logs') {
    S.audits.push(body);
    return jsonRes(null, 201);
  }

  if (method === 'PATCH' && path.startsWith('/rest/v1/weeks?week_key=eq.')) {
    if (S.failOn === 'weeks') return boom('weeks');
    S.patches.push(body);
    if (S.weekRow) S.weekRow.status = body.status ?? S.weekRow.status;
    return jsonRes(null, 204);
  }

  if (method === 'DELETE' && path.startsWith('/rest/v1/publish_versions?publish_id=eq.')) {
    const id = decodeURIComponent(path.slice('/rest/v1/publish_versions?publish_id=eq.'.length));
    const before = S.versions.length;
    S.versions = S.versions.filter((v) => v.publish_id !== id);
    // 级联删除快照与投递
    S.snapshots = S.snapshots.filter((r) => r.publish_id !== id);
    S.deliveries = S.deliveries.filter((r) => r.publish_id !== id);
    return jsonRes(null, before === S.versions.length ? 204 : 204);
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
    console.log(`  ✗ ${name}${extra === undefined ? '' : ' → ' + JSON.stringify(extra).slice(0, 260)}`);
  }
}

await import('./_build/f/publish.mjs');

async function call(payload, opts = {}) {
  const method = opts.method ?? 'POST';
  const headers = { origin: 'http://localhost' };
  const init = { method, headers };
  if (method === 'POST') {
    headers['content-type'] = 'text/plain;charset=UTF-8';
    init.body = opts.raw ?? JSON.stringify(payload ?? {});
  }
  const res = await handler(new Request('http://x/functions/v1/publish', init));
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, text };
}

const asMgr = (extra) => ({ token: 'tok-manager-0123456789abcdef', week_key: WEEK, ...extra });
const postCalls = (table) => calls.filter((c) => c.method === 'POST' && c.path === `/rest/v1/${table}`);

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
  const r = await call({ week_key: WEEK });
  ok('无 token → NO_TOKEN', r.data.code === 'NO_TOKEN', r.data);
}
{
  reset();
  const r = await call({ token: 'tok-employee-0123456789abcdef', week_key: WEEK });
  ok('员工 → FORBIDDEN 403', r.data.code === 'FORBIDDEN' && r.status === 403, r.data);
  ok('  员工没读到任何草稿', calls.filter((c) => c.path.startsWith('/rest/v1/shifts')).length === 0, calls.length);
}
{
  reset();
  const r = await call({ token: 'tok-viewer-0123456789abcdef', week_key: WEEK });
  ok('只读 viewer 也不能发布 → FORBIDDEN', r.data.code === 'FORBIDDEN', r.data);
}

// =============================================================
console.log('\n=== 周次校验 ===');
// =============================================================
{
  reset();
  const r = await call(asMgr({ week_key: '2026/10/26' }));
  ok('斜杠格式 → BAD_WEEK', r.data.code === 'BAD_WEEK', r.data);
}
{
  reset();
  const r = await call(asMgr({ week_key: '2026-10-27' }));
  ok('周二 → BAD_WEEK（必须是周一）', r.data.code === 'BAD_WEEK' && String(r.data.error).includes('周一'), r.data);
}
{
  reset();
  const r = await call(asMgr({ week_key: '2026-02-30' }));
  ok('不存在的日期 → BAD_WEEK', r.data.code === 'BAD_WEEK', r.data);
}
{
  reset();
  const r = await call(asMgr({ week_key: 20261026 }));
  ok('非字符串 → BAD_WEEK', r.data.code === 'BAD_WEEK', r.data);
}

// =============================================================
console.log('\n=== 空周 ===');
// =============================================================
{
  reset();
  const r = await call(asMgr());
  ok('没有草稿 → EMPTY_WEEK 409', r.data.code === 'EMPTY_WEEK' && r.status === 409, r.data);
  ok('  没有写任何版本行', postCalls('publish_versions').length === 0, calls.length);
}
{
  reset();
  S.shifts = [{ week_key: WEEK, staff_name: '何广友', day: 0, slot: null, role: null }];
  const r = await call(asMgr());
  ok('slot 全为 null → EMPTY_WEEK（空壳不算班）', r.data.code === 'EMPTY_WEEK', r.data);
}

// =============================================================
console.log('\n=== 正常发布 ===');
// =============================================================
{
  reset();
  S.shifts = rowsFor([
    ['何广友', 0, 'early'],
    ['何广友', 1, 'rest'],
    ['张三', 2, 'night'],
    ['李四', 4, 'mid', 'open'],
  ]);

  const r = await call(asMgr({ note: '  本周有调休  ' }));
  ok('ok:true', r.data.ok === true, r.data);
  ok('版本 v1', r.data.version === 1, r.data.version);
  ok('员工数 3 / 格子 4 / 上班 3', r.data.staff === 3 && r.data.cells === 4 && r.data.working === 3, r.data);
  ok('每日人数 days=[1,1,1,0,1,0,0]（day1 是休息也算一格）',
    JSON.stringify(r.data.days) === JSON.stringify([1, 1, 1, 0, 1, 0, 0]), r.data.days);
  ok('版本行写了 summary',
    S.versions.length === 1 &&
    postCalls('publish_versions')[0].body.summary.staff === 3 &&
    postCalls('publish_versions')[0].body.summary.cells === 4,
    postCalls('publish_versions')[0]?.body?.summary);
  ok('note 去空白后入库「本周有调休」',
    postCalls('publish_versions')[0].body.note === '本周有调休',
    postCalls('publish_versions')[0].body.note);
  ok('published_by = 调用者',
    postCalls('publish_versions')[0].body.published_by === MGR,
    postCalls('publish_versions')[0].body.published_by);
  ok('快照 4 行，publish_id 一致',
    S.snapshots.length === 4 && S.snapshots.every((s) => s.publish_id === r.data.publish_id), S.snapshots.length);
  ok('快照 role 原样保留',
    S.snapshots.find((s) => s.staff_name === '李四').role === 'open', S.snapshots.find((s) => s.staff_name === '李四'));
  ok('投递每人一条（3 条 inapp/pending）',
    S.deliveries.length === 3 &&
    S.deliveries.every((d) => d.channel === 'inapp' && d.status === 'pending'),
    S.deliveries);
  ok('weeks 置为 published', S.patches.at(-1)?.status === 'published', S.patches);
  ok('写了审计日志 action=publish',
    S.audits.length === 1 && S.audits[0].action === 'publish' && S.audits[0].target === WEEK, S.audits[0]);
  ok('审计带 version / publish_id',
    S.audits[0].detail.version === 1 && S.audits[0].detail.publish_id === r.data.publish_id, S.audits[0].detail);
}
{
  // 第二版：版本号自增
  reset();
  S.shifts = rowsFor([['何广友', 3, 'mid']]);
  S.versions = [{ publish_id: 'old-1', version: 1 }];
  S.weekRow = { week_key: WEEK, status: 'published' };
  const r = await call(asMgr());
  ok('已经有 v1 → 这次 v2', r.data.ok === true && r.data.version === 2, r.data);
}
{
  // 非法 slot / role / day 被过滤
  reset();
  S.shifts = [
    { week_key: WEEK, staff_name: '何广友', day: 0, slot: 'early', role: 'bogus' },
    { week_key: WEEK, staff_name: '张三', day: 1, slot: 'latenight', role: null },  // 非法 slot
    { week_key: WEEK, staff_name: '', day: 2, slot: 'mid', role: null },            // 无姓名
    { week_key: WEEK, staff_name: '李四', day: 9, slot: 'mid', role: null },        // day 越界
    { week_key: WEEK, staff_name: '王五', day: 5, slot: 'rest', role: 'close' },
  ];
  const r = await call(asMgr());
  ok('只剩 2 格合法数据', r.data.ok === true && r.data.cells === 2, r.data);
  ok('非法 role 归零为 null',
    S.snapshots.find((s) => s.staff_name === '何广友').role === null, S.snapshots);
  ok('rest 不算上班人次（working=1）', r.data.working === 1, r.data.working);
}

// =============================================================
console.log('\n=== 并发：撞唯一约束后重试 ===');
// =============================================================
{
  reset();
  S.shifts = rowsFor([['何广友', 0, 'early']]);
  S.versions = [{ publish_id: 'old-1', version: 1 }];
  S.conflictOnce = true;
  const r = await call(asMgr());
  ok('第一次 409 后自动重试成功', r.data.ok === true, r.data);
  ok('  重算版本号避开别人的 v2（我发 v3）', r.data.version === 3, r.data.version);
  ok('  只留下两次 POST 尝试', postCalls('publish_versions').length === 2, postCalls('publish_versions').length);
  ok('  快照只写了一份', S.snapshots.length === 1, S.snapshots.length);
}

// =============================================================
console.log('\n=== 中途失败 → 回滚 ===');
// =============================================================
const realConsoleError = console.error;
console.error = () => {};   // 回滚场景本来就会打错误日志，保持测试输出干净
{
  reset();
  S.shifts = rowsFor([['何广友', 0, 'early']]);
  S.failOn = 'snapshots';
  const r = await call(asMgr());
  ok('快照写失败 → PUBLISH_FAILED 500', r.data.code === 'PUBLISH_FAILED' && r.status === 500, r.data);
  ok('  版本行已删除', S.versions.length === 0, S.versions);
  ok('  发了 DELETE 回滚', calls.some((c) => c.method === 'DELETE'), calls.map((c) => c.method));
  ok('  周状态还原成 draft', S.patches.at(-1)?.status === 'draft', S.patches);
  ok('  没写投递 / 审计', S.deliveries.length === 0 && S.audits.length === 0, {
    d: S.deliveries.length, a: S.audits.length,
  });
}
{
  reset();
  S.shifts = rowsFor([['何广友', 0, 'early']]);
  S.weekRow = { week_key: WEEK, status: 'published' };  // 这周之前已经发布过
  S.failOn = 'deliveries';
  const r = await call(asMgr());
  ok('投递写失败 → PUBLISH_FAILED', r.data.code === 'PUBLISH_FAILED', r.data);
  ok('  回滚后 version 行也没了', S.versions.length === 0, S.versions);
  ok('  之前已发布的状态被保留（还原成 published）', S.patches.at(-1)?.status === 'published', S.patches);
}
{
  reset();
  S.shifts = rowsFor([['何广友', 0, 'early']]);
  S.failOn = 'weeks';
  const r = await call(asMgr());
  ok('最后一步 weeks 写失败也回滚', r.data.code === 'PUBLISH_FAILED' && S.versions.length === 0, {
    code: r.data.code, versions: S.versions.length,
  });
}
{
  reset();
  S.shifts = rowsFor([['何广友', 0, 'early']]);
  S.failOn = 'versions';
  const r = await call(asMgr());
  ok('版本行没写成 → PUBLISH_FAILED 且无 DELETE', r.data.code === 'PUBLISH_FAILED' &&
    !calls.some((c) => c.method === 'DELETE'), { code: r.data.code, dels: calls.filter((c) => c.method === 'DELETE').length });
}

console.error = realConsoleError;

// =============================================================
console.log('\n=== 备注清洗 ===');
// =============================================================
{
  reset();
  S.shifts = rowsFor([['何广友', 0, 'early']]);
  const long = 'x'.repeat(400);
  const r = await call(asMgr({ note: long }));
  ok('超长备注截到 200 字', postCalls('publish_versions')[0].body.note.length === 200,
    postCalls('publish_versions')[0].body.note.length);
  ok('回显 note 也截断', r.data.note.length === 200, r.data.note.length);
}
{
  reset();
  S.shifts = rowsFor([['何广友', 0, 'early']]);
  const r = await call(asMgr({ note: '   ' }));
  ok('全空白备注 → null', postCalls('publish_versions')[0].body.note === null,
    postCalls('publish_versions')[0].body.note);
  ok('  回显 null', r.data.note === null, r.data.note);
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
