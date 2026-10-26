import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = path.resolve('_deploy');
const files = ['index.html', 'login.html', 'register.html', 'view-account.html', 'manager.html', 'me.html'];
const cssFiles = ['ui.css', 'aqua.css'];
let problems = 0;
const say = (s) => console.log(s);

// ---------- 1. JS 语法检查（auth-core.js + 页面内联脚本） ----------
const tmp = path.resolve('tools/_tmp');
fs.mkdirSync(tmp, { recursive: true });

function checkJs(code, label) {
  const p = path.join(tmp, label + '.js');
  fs.writeFileSync(p, code, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
    const lines = code.split('\n').length;
    say(`  [OK]   ${label}: syntax ok (${lines} lines)`);
  } catch (e) {
    problems++;
    say(`  [FAIL] ${label}: ${String(e.stderr || e.message).split('\n').slice(0, 6).join('\n')}`);
  }
}

say('== 1. JavaScript syntax ==');
checkJs(fs.readFileSync(path.join(dir, 'auth-core.js'), 'utf8'), 'auth-core');

for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  blocks.forEach((m, i) => checkJs(m[1], `${f}.inline${i + 1}`));
}

// ---------- 2. CSS 括号平衡 ----------
say('\n== 2. CSS balance ==');
for (const name of cssFiles) {
  const css = fs.readFileSync(path.join(dir, name), 'utf8');
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  if (open === close) say(`  [OK]   ${name} braces balanced (${open} blocks, ${(css.length / 1024).toFixed(1)} KB)`);
  else { problems++; say(`  [FAIL] ${name} braces: { ${open} vs } ${close}`); }
}

// ---------- 3. HTML 里被 JS 引用的 #id 是否都存在 ----------
say('\n== 3. id references ==');
for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const ownIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  // 页面内联脚本里出现的 $('#xxx') / getElementById('xxx')
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const refs = new Set();
  for (const m of inline.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)) refs.add(m[1]);
  for (const m of inline.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) refs.add(m[1]);

  const missing = [...refs].filter((r) => !ownIds.has(r));
  if (missing.length === 0) say(`  [OK]   ${f}: ${refs.size} id refs all exist`);
  else { problems++; say(`  [FAIL] ${f}: missing ids -> ${missing.join(', ')}`); }

  // 未闭合的 div 粗检查
  const openDiv = (html.match(/<div\b/g) || []).length;
  const closeDiv = (html.match(/<\/div>/g) || []).length;
  if (openDiv !== closeDiv) { problems++; say(`  [WARN] ${f}: div ${openDiv} open vs ${closeDiv} close`); }
  else say(`  [OK]   ${f}: div tags balanced (${openDiv})`);
}

// ---------- 4. 关键契约检查 ----------
say('\n== 4. API contract ==');
const core = fs.readFileSync(path.join(dir, 'auth-core.js'), 'utf8');
const need = [
  ['base url', 'xoqvrkqxtipkavmfaxyy.supabase.co'],
  ['publishable key', 'sb_publishable_Jc4L1kJ4RvLQaTrMvtrt7A_iMLGyAFx'],
  ['captcha endpoint', "'/functions/v1/' + fn"],
  ['device regex', '/^[A-Za-z0-9_-]{16,128}$/'],
  ['no custom x- header', 'x-device-id']
];
for (const [label, needle] of need) {
  const hit = core.includes(needle);
  if (label === 'no custom x- header') {
    if (hit) { problems++; say(`  [FAIL] ${label}: found "${needle}" (would break CORS preflight)`); }
    else say(`  [OK]   ${label}: none`);
    continue;
  }
  if (hit) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 32 字符设备号
const devLen = 24 * 4 / 3; // bytes -> base64url chars (no padding)
say(`  [INFO] device id length = ${Math.round(devLen)} chars (regex needs 16-128)`);

// ---------- 4b. 验证码 / 邀请码核验链路 ----------
say('\n== 4b. captcha & invite gate ==');
const capNeed = [
  ['auth-core: check_invite action', core, "action: 'check_invite'"],
  ['auth-core: checkInvite export', core, 'checkInvite: checkInvite'],
  ['auth-core: captcha 支持 ttl 参数', core, "?ttl="],
];
for (const [label, src, needle] of capNeed) {
  if (src.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

const pageSrc = {
  'login.html': fs.readFileSync(path.join(dir, 'login.html'), 'utf8'),
  'register.html': fs.readFileSync(path.join(dir, 'register.html'), 'utf8'),
};
const gateNeed = [
  ['login.html: 取服务端算式', 'SR.api.captcha('],
  ['login.html: 算式 13 秒有效', 'var CAP_TTL = 13;'],
  ['login.html: 登录带 captcha_token', 'captcha_token: S.capToken'],
  ['login.html: 处理 CAPTCHA_FAILED', "'CAPTCHA_FAILED'"],
  ['register.html: 下一步走服务端核验', 'SR.api.checkInvite('],
  ['register.html: 注册带 captcha_token', 'captcha_token: S.capToken'],
];
for (const [label, needle] of gateNeed) {
  const f = Object.keys(pageSrc).find((k) => label.startsWith(k));
  if (pageSrc[f].includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 本地算式（只在前端比对的旧实现）不该再出现在登录页
for (const bad of ['capAnswer', 'enableCap', 'newCap']) {
  if (pageSrc['login.html'].includes(bad)) {
    problems++;
    say(`  [FAIL] login.html: 仍有本地算式残留 "${bad}"`);
  }
}

// ---------- 4c. 经理端工作台契约 ----------
say('\n== 4c. manager workbench ==');
const mgr = fs.readFileSync(path.join(dir, 'manager.html'), 'utf8');
const mgrNeed = [
  ['auth-core: REST 数据层导出 db', core, 'db: db'],
  ['auth-core: upsert 带 on_conflict', core, 'on_conflict='],
  ['manager: 读草稿走 shifts 表', mgr, "select('shifts'"],
  ['manager: 周记录不存在才建（避免回退成草稿）', mgr, 'resolution=ignore-duplicates'],
  ['manager: 发布走 publish 函数', mgr, "SR.api.call('publish'"],
  ['manager: 发布带 week_key', mgr, 'week_key: S.week'],
  ['manager: 只读账号禁用格子', mgr, 'S.readonly'],
  ['manager: 401 自动回登录页', mgr, 'reauth()'],
  ['manager: 矩阵用 .grid（不能叫 .sheet，会和弹层样式打架）', mgr, '<table class="grid">'],
  ['manager: 弹层有错误条 #dlgErr', mgr, 'id="dlgErr"'],
  ['manager: 404 说清楚是函数没部署', mgr, 'publish 函数还没部署'],
];
for (const [label, src, needle] of mgrNeed) {
  if (src.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 前端绝不允许自己写快照 / 投递表（只能通过 publish 函数）
for (const bad of ['published_shifts', 'publish_deliveries']) {
  if (mgr.includes(bad)) {
    problems++;
    say(`  [FAIL] manager.html: 直接操作了 ${bad}（应由 publish 函数负责）`);
  }
}

// ---------- 4d. 员工端「我的班表」契约 ----------
say('\n== 4d. me page ==');
const me = fs.readFileSync(path.join(dir, 'me.html'), 'utf8');
const meNeed = [
  ['me: 只读自己那份快照 published_shifts', me, "select('published_shifts'"],
  ['me: 读自己的投递记录（判断最新一版）', me, "select('publish_deliveries'"],
  ['me: 按投递 id 倒序取最新', me, 'order=id.desc'],
  ['me: 401 自动回登录页', me, 'reauth()'],
  ['me: 非员工账号引导去工作台', me, 'manager.html'],
  ['me: 登录后跳这里', pageSrc['login.html'], "location.href = 'me.html'"],
];
for (const [label, src, needle] of meNeed) {
  if (src.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 员工端不允许有任何写操作，也不许碰草稿表
for (const bad of ['SR.db.upsert', 'SR.db.insert', 'SR.db.del', 'SR.db.patch', "select('shifts'", "select('publish_versions'"]) {
  if (me.includes(bad)) {
    problems++;
    say(`  [FAIL] me.html: 不该出现 ${bad}`);
  }
}

// ---------- 4e. 站点入口（根路径） ----------
say('\n== 4e. site entry ==');
const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const idxNeed = [
  ['index: 默认去登录页', "var to = 'login.html'"],
  ['index: 员工会话去我的班表', "o.role === 'employee' ? 'me.html'"],
  ['index: 经理/只读会话去工作台', ": 'manager.html'"],
  ['index: 用 replace 不留历史栈', 'location.replace(to)'],
  ['index: 会话过期回登录页', 'Date.now() < Number(o.expires_at)'],
];
for (const [label, needle] of idxNeed) {
  if (idx.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 根路径只能是轻量跳转页：旧 544KB 单机版必须让位到 legacy.html
if (idx.length > 8 * 1024) {
  problems++;
  say(`  [FAIL] index.html 太大（${(idx.length / 1024).toFixed(1)} KB）：根路径应只是跳转页`);
} else {
  say(`  [OK]   index.html 轻量跳转页 (${(idx.length / 1024).toFixed(1)} KB)`);
}
if (!fs.existsSync(path.join(dir, 'legacy.html'))) {
  problems++;
  say('  [FAIL] 缺少 legacy.html（旧单机版应保留在 /legacy.html）');
} else {
  say('  [OK]   旧单机版仍在 legacy.html');
}

// ---------- 5. 体积 ----------
say('\n== 5. sizes ==');
for (const f of [...cssFiles, 'auth-core.js', ...files]) {
  const b = fs.statSync(path.join(dir, f)).size;
  say(`  ${f.padEnd(14)} ${(b / 1024).toFixed(1)} KB`);
}

say('\n' + (problems === 0 ? 'ALL CHECKS PASSED' : `PROBLEMS: ${problems}`));
process.exit(problems === 0 ? 0 : 1);
