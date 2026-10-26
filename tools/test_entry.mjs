// =============================================================
// tools/test_entry.mjs · 站点入口（_deploy/index.html）分流测试
//
// 根路径不能再落到旧单机版；按会话把用户送到对应页面。
// 运行：node tools/test_entry.mjs
// =============================================================

import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('_deploy/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) {
  console.error('FAIL: index.html 里没找到入口脚本');
  process.exit(1);
}
const code = m[1];

let pass = 0;
let fail = 0;
function check(name, got, want) {
  if (got === want) {
    pass++;
    console.log(`  [OK]   ${name} -> ${got}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${name} -> ${got} (want ${want})`);
  }
}

function run(sessionRaw, opts = {}) {
  let target = '';
  const store = {
    getItem: (k) => (k === 'sr.session' ? sessionRaw : null),
  };
  const ctx = {
    localStorage: opts.noStorage ? { getItem() { throw new Error('blocked'); } } : store,
    Date,
    Number,
    JSON,
    location: { replace: (t) => { target = t; } },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return target;
}

const alive = (role, extra = {}) =>
  JSON.stringify({
    access_token: 'tok-0123456789abcdef',
    role,
    expires_at: Date.now() + 3600_000,
    ...extra,
  });

console.log('== entry routing ==');
check('没有会话', run(null), 'login.html');
check('会话 JSON 坏掉', run('{oops'), 'login.html');
check('localStorage 被禁用', run(null, { noStorage: true }), 'login.html');
check('空对象', run('{}'), 'login.html');
check('没有 access_token', run(JSON.stringify({ role: 'manager', expires_at: Date.now() + 1000 })), 'login.html');
check('经理会话', run(alive('manager')), 'manager.html');
check('只读账号会话', run(alive('viewer')), 'manager.html');
check('员工会话', run(alive('employee')), 'me.html');
check('会话已过期', run(alive('manager', { expires_at: Date.now() - 1000 })), 'login.html');
check('没有 expires_at 视为有效', run(JSON.stringify({ access_token: 'tok-0123456789abcdef', role: 'employee' })), 'me.html');

console.log('\n== entry page shape ==');
const kb = html.length / 1024;
check('入口页足够轻（<8KB）', kb < 8, true);
check('入口页不再内嵌旧单机版', html.includes('排班工具') || html.includes('app_merged') ? false : true, true);
check('入口页提供无 JS 兜底链接', html.includes('<a href="login.html">') && html.includes('<a href="register.html">'), true);

console.log(`\n${fail === 0 ? `ALL PASSED (${pass})` : `FAILED ${fail} / ${pass + fail}`}`);
process.exit(fail === 0 ? 0 : 1);
