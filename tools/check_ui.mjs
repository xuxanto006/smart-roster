import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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

// 前端绝不允许自己「写」快照 / 投递表（只能通过 publish 函数）；
// 读投递记录是允许的：工作台靠它显示「谁已读」。
let mgrWriteSnap = 0;
for (const tbl of ['published_shifts', 'publish_deliveries']) {
  for (const op of ['upsert', 'insert', 'patch', 'del']) {
    if (mgr.includes(`SR.db.${op}('${tbl}'`)) {
      problems++;
      mgrWriteSnap++;
      say(`  [FAIL] manager.html: 直接写 ${tbl}（应由 publish 函数负责）`);
    }
  }
}
if (mgrWriteSnap === 0) say('  [OK]   manager.html: 没有直接写快照/投递表');

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
const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const idxNeed = [
  ['index: 默认去登录页', "var to = 'login.html'"],
  ['index: 员工会话去我的班表', "s.role === 'employee' ? 'me.html'"],
  ['index: 经理/只读会话去工作台', ": 'manager.html'"],
  ['index: 用 replace 不留历史栈', 'location.replace(to)'],
  ['index: 会话失效回登录页', 'go(window.SR && SR.session ? SR.session.get() : null)'],
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

// ---------- 4f. 开发快捷登录（一键登录 · 选身份） ----------
say('\n== 4f. dev quick login ==');
const loginSrc = pageSrc['login.html'];
const quickNeed = [
  ['login: 快捷面板默认隐藏（不靠 JS 也守着）', 'id="quick" hidden'],
  ['login: 白名单 / 开关判定', 'function quickAllowed()'],
  ['login: 本机白名单', "'localhost'"],
  ['login: dev=1 强制显示 / dev=0 强制隐藏', 'dev=0'],
  ['login: 本机开关 localStorage sr_quick', "'sr_quick'"],
  ['login: 凭据只存本机', "'sr_quick_cred_v1'"],
  ['login: 设置面板可收起（.quick [hidden] 不能被 display:flex 盖掉）', '.quick [hidden]'],
  ['login: 有「不再显示」出口', 'id="quickOff"'],
  ['login: 一键登录仍要 captcha_token', 'captcha_token: d1.token'],
  ['login: 一键登录走真实 login 函数', 'SR.api.login({'],
  ['login: 点「管理员」必须是 manager/viewer', "kind === 'manager' && !isMgr"],
  ['login: 点「普通用户」不能是经理', "kind === 'employee' && isMgr"],
  ['login: URL 种子用完抹掉地址栏密码', 'history.replaceState'],
  ['login: 结果态要收起快捷面板', "$('#quick').style.display = 'none'"],
  ['login: 内置账号总开关（DEV_SEED.on）', 'var DEV_SEED = {'],
  ['login: 内置账号总开关能一刀关掉', 'if (!DEV_SEED.on) return false;'],
  ['login: 内置账号优先度低于本机凭据', 'if (!all.manager || !all.manager.u) all.manager = DEV_SEED.manager'],
  ['login: 内置密码不会被写回 localStorage', 'all = quickLoadRaw(), dirty = false;'],
  /* 前端显示 test、库里还是旧名 xmt 的兜底：必须只在「内置凭据 + 查无此人/密码不对」时启用 */
  ['login: 内置员工旧名兜底只在 DEV_SEED 里声明', "legacy: { u: 'xmt' }"],
  ['login: 兜底判定是独立函数（可单测）', 'function legacyOf(kind, c)'],
  ['login: 兜底仍受 seedAllowed 约束（?dev=0 一并失效）', 'if (!seedAllowed()) return null;'],
  ['login: 只有账号密码都对上内置那份才兜底', 'if (c.p !== seed.p) return null;'],
  ['login: 只有查无此人/密码不对才换旧账号', "d.reason !== 'BAD_CREDENTIALS' && d.reason !== 'NO_SUCH_USER'"],
  ['login: 兜底重新取题再登（不复用旧 token）', 'return tryLogin(alt)'],
  ['login: 兜底成功要用 toast 点明旧账号', "改名前的 ' + alt.u + ' 登录"],
  ['login: 两个都失败要说清楚（指向 007）', '先在 Supabase 执行 007 迁移'],
  ['login: 成功后按实际登录的账号写会话', 'onSuccess(res, used)'],
  /* 点一下要看得见「账号、密码被逐字打进输入框」，而不是瞬间填好 */
  ['login: 逐字填入是独立函数（可单测）', 'function typeInto(input, text)'],
  ['login: 每字 45ms（眼睛跟得上）', 'var TYPE_MS = 45;'],
  ['login: 打字期间给输入框高亮', "input.classList.add('typing')"],
  ['login: 打完收掉高亮', "input.classList.remove('typing')"],
  ['login: 高亮样式真的存在', '.input.typing'],
  ['login: 手机端先滚到表单再打字', 'function revealForm()'],
  ['login: 打字前提示「正在填入账号」', "'正在填入账号…'"],
  ['login: 打字后提示「正在填入密码」', "'正在填入密码…'"],
  ['login: 兜底换账号时输入框也跟着改', "typeInto($('#u'), String(alt.u).trim().toLowerCase())"],
  ['login: viewer 点普通用户要单独解释', '只读(viewer)'],
  ['login: viewer 的出口指向 008 迁移', '008_dev_test_employee.sql'],
];
for (const [label, needle] of quickNeed) {
  if (loginSrc.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 内置账号的开关逻辑必须同时受 ?dev=0 与本机 sr_quick 控制（公网默认开着，但随时能收）
const seedFn = (/function seedAllowed\(\) \{[\s\S]*?\n  \}/.exec(loginSrc) || [])[0] || '';
if (!seedFn) {
  problems++;
  say('  [FAIL] login.html: 找不到 seedAllowed()');
} else if (!/DEV_SEED\.on/.test(seedFn) || !/dev=0/.test(seedFn) || !/QUICK\.flag/.test(seedFn)) {
  problems++;
  say('  [FAIL] login.html: seedAllowed() 缺少开关（要同时认 DEV_SEED.on / ?dev=0 / 本机 sr_quick）');
} else {
  say('  [OK]   login.html: 内置账号三个开关齐全（DEV_SEED.on / ?dev=0 / 本机 sr_quick）');
}

// 快捷面板里每个 id 都必须真的在页面里（addEventListener 直接崩的那种错）
for (const id of ['quick', 'quickForm', 'quickCfg', 'quickOff', 'quickMgr', 'quickEmp', 'qkId', 'qkU', 'qkP', 'qkSave', 'qkClear']) {
  if (!new RegExp(`\\sid="${id}"`).test(loginSrc)) {
    problems++;
    say(`  [FAIL] login.html: 快捷面板缺少 #${id}`);
  }
}
say('  [OK]   login.html: 快捷面板 11 个控件 id 齐全');

// 账号密码绝不允许写进页面（唯一例外：整块 DEV_SEED，且只在开发状态生效）
const seedBlock = (/var DEV_SEED = \{[\s\S]*?\n  \};/.exec(loginSrc) || [])[0] || '';
const loginNoSeed = loginSrc.replace(seedBlock, '');
const credLeak = /(mgr|emp)=[A-Za-z0-9_.-]{2,}\|[^\s&"']{4,}/.test(loginNoSeed)
  || /password\s*:\s*['"][^'"]{4,}['"]/.test(loginNoSeed)
  || /\bu\s*:\s*['"][a-z0-9_]{3,20}['"]\s*,\s*p\s*:\s*['"][^'"]+['"]/.test(loginNoSeed);
if (credLeak) {
  problems++;
  say('  [FAIL] login.html: 疑似把账号密码硬编码进页面（只允许存本机 localStorage）');
} else {
  say('  [OK]   login.html: 没有硬编码的账号密码');
}

// DEV_SEED 是唯一允许出现明文密码的地方：每个密码只许出现一次、且必须在 DEV_SEED 里
for (const pw of ['huawei@123', '12345678']) {
  const n = loginSrc.split(pw).length - 1;
  if (n !== 1 || !seedBlock.includes(pw)) {
    problems++;
    say(`  [FAIL] login.html: 开发账号密码只能出现在 DEV_SEED 块里（"${pw}" 出现 ${n} 次）`);
  }
}
if (seedBlock.includes('huawei@123') && seedBlock.includes('12345678')) {
  say('  [WARN] login.html: 内置开发账号是明文（superadmin / test），且公网默认生效');
  say('         → 收口：DEV_SEED.on=false（内置账号失效）或 QUICK.on=false（整块面板消失），改完重新部署');
}

// 快捷登录要能自己解出服务端算式（题面就是 "12 + 7 = ?" 这种）
const qFnSrc = (/function solveQuestion\(text\) \{[\s\S]*?\n  \}/.exec(loginSrc) || [])[0];
if (!qFnSrc) {
  problems++;
  say('  [FAIL] login.html: 找不到 solveQuestion()');
} else {
  let qFn = null;
  try { qFn = vm.runInNewContext('(' + qFnSrc + ')', {}); } catch (e) { qFn = null; }
  if (typeof qFn !== 'function') {
    problems++;
    say('  [FAIL] login.html: solveQuestion 无法解析（' + String(qFnSrc).slice(0, 40) + '…）');
  } else {
    const qCases = [['12 + 7 = ?', 19], ['13 - 5 = ?', 8], ['3 + 4 = ?', 7],
      ['20 - 20 = ?', 0], ['9 - 12 = ?', -3]];
    const bad = qCases.filter(([q, want]) => qFn(q) !== want);
    if (bad.length) {
      problems++;
      say('  [FAIL] solveQuestion 解错了：' + bad.map(([q, w]) => `${q} 应为 ${w}`).join(' / '));
    } else {
      say(`  [OK]   solveQuestion 能解服务端题面（${qCases.length} 例）`);
    }
    if ([null, undefined, '', '??', '12 * 7 = ?'].some((x) => qFn(x) !== null)) {
      problems++;
      say('  [FAIL] solveQuestion 对非算式应返回 null（否则会拿错答案去登录）');
    } else {
      say('  [OK]   solveQuestion 对非算式返回 null');
    }
  }
}

// ---------- 4g. 记住登录（这台设备 30 天免密） ----------
say('\n== 4g. remember this device ==');
const idxSrc = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const remNeed = [
  ['login: 有「记住这台设备」勾选框', 'id="remember"'],
  ['login: 记住的选择下次沿用', "'sr.rememberPref'"],
  ['login: 登录成功按勾选写会话', 'SR.session.from(res, username, keep)'],
  ['login: 记住后自动进入（不用再输密码）', 'SR.session.ensure()'],
  ['login: 想换账号可 ?stay=1', 'stay=1'],
  ['login: 结果页显示这台设备的状态', "'已记住 · 30 天内免密'"],
  ['auth-core: 记住时长 30 天', 'REMEMBER_DAYS = 30'],
  ['auth-core: 会话记 keep_until', 'keep_until: keep ? Date.now() + REMEMBER_DAYS * 86400000 : 0'],
  ['auth-core: 续期端点', "'/auth/v1/token?grant_type=refresh_token'"],
  ['auth-core: 续期失败 400/401 才清会话', 'r.status === 400 || r.status === 401'],
  ['auth-core: 导出 ensure / refresh / raw', 'ensure: ensureSession'],
  ['auth-core: REST 统一走 authToken（过期自动续）', 'function authToken()'],
  ['index: 先续期再决定去哪', 'SR.session.ensure().then(go, go)'],
  ['index: 只有记住的会话才续期（不记住的过期就回登录页）', 'raw && raw.remember'],
];
for (const [label, needle] of remNeed) {
  const srcMap = { 'auth-core': core, 'login': loginSrc, 'index': idxSrc };
  const src = srcMap[label.split(':')[0]];
  if (src && src.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 「记住登录」必须真的是续期，不许把 expires_at 直接改成永久（那等于伪造本地过期时间）
if (/expires_at\s*=\s*Date\.now\(\)\s*\+\s*365/.test(core) || /keep_until\s*=\s*0\s*;\s*\/\*.*永久/.test(core)) {
  problems++;
  say('  [FAIL] auth-core: 别用「把过期时间改成永久」的假记住');
} else {
  say('  [OK]   auth-core: 记住登录靠 refresh_token 续期，不是改本地过期时间');
}

// ---------- 4h. 导入到手机日历（.ics） ----------
say('\n== 4h. calendar import ==');
const calNeed = [
  ['me: 早/中/晚一/晚二 四套时间', "night2: { label: '晚二班', start: '13:30', end: '22:30' }"],
  ['me: 周五/周六的晚班按晚二', 'return (d === 4 || d === 5) ? CAL_TIMES.night2 : CAL_TIMES.night;'],
  ['me: 休息 / 未排 / 未知班次不进日历', "if (!slot || slot === 'rest') return null;"],
  ['me: ics 用 UTC 时刻（不依赖时区库）', "cal2(d.getUTCHours()) + cal2(d.getUTCMinutes()) + '00Z'"],
  ['me: ics 按字节折行（中文 3 字节）', 'function calBytes(s)'],
  ['me: UID 稳定（重复导入不重复建）', "'@smart-roster'"],
  ['me: 上班前 30 分钟提醒', "'TRIGGER:-PT30M'"],
  ['me: 优先走系统分享面板（iOS/鸿蒙/安卓）', 'navigator.canShare({ files: [file] })'],
  ['me: 分享不可用则下载 .ics', 'a.download = name'],
  ['me: 再兜底复制日程文本', 'navigator.clipboard.writeText'],
  ['me: 有「导入到日历」按钮', 'id="calShare"'],
  ['me: 分享没日历时可「存成 .ics」', 'id="calSave"'],
  ['me: 有「复制日程」按钮', 'id="calCopy"'],
  ['me: 日历卡真的挂进渲染', 'h += calCardHtml();'],
];
for (const [label, needle] of calNeed) {
  if (me.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 导出纯函数块必须真的能抽出来跑单测（不掺 DOM / 网络 / 会话）
const calStart = me.indexOf('/* ===== CAL-BLOCK-START ===== */');
const calEnd = me.indexOf('/* ===== CAL-BLOCK-END ===== */');
if (calStart < 0 || calEnd <= calStart) {
  problems++;
  say('  [FAIL] me.html: 缺少 CAL-BLOCK 标记（tools/test_me_calendar.mjs 靠它抽源码）');
} else {
  const calBlock = me.slice(calStart, calEnd);
  const dirty = ['document.', 'navigator.', 'SR.', 'location.', 'localStorage'].filter((x) => calBlock.includes(x));
  if (dirty.length) {
    problems++;
    say(`  [FAIL] me.html: CAL-BLOCK 里不该有 ${dirty.join(' / ')}（纯函数才能单测）`);
  } else {
    say('  [OK]   me.html: CAL-BLOCK 是纯函数块（无 DOM / 网络 / 会话）');
  }
}

// 员工端仍然全程只读：导入日历不该产生任何写库请求
if (/SR\.db\.(upsert|insert|patch|del)/.test(me)) {
  problems++;
  say('  [FAIL] me.html: 导入日历引入了写库操作（员工端必须只读）');
} else {
  say('  [OK]   me.html: 导入日历不需要写库（纯前端生成 .ics）');
}

// ---------- 4i. 经理端三种看法 / 全屏 / 日期浮窗 ----------
say('\n== 4i. roster views (fullscreen / overview / day) ==');
const viewNeed = [
  ['manager: 有「表格 / 总览 / 按天」三个视图按钮', mgr, 'id="viewSeg"'],
  ['manager: 三种看法放在同一个 #viewBox（全屏只作用于这块）', mgr, 'id="viewBox"'],
  ['manager: 有全屏编辑按钮', mgr, 'id="fsBtn"'],
  ['manager: 全屏里有退出按钮', mgr, 'id="fsExit"'],
  ['manager: 总览容器', mgr, 'id="overviewWrap"'],
  ['manager: 按天容器', mgr, 'id="dayWrap"'],
  ['manager: 日期浮窗容器', mgr, 'id="dayOv"'],
  ['manager: 浮窗能一键进全屏', mgr, 'id="dayFs"'],
  ['manager: 表格日期表头可点（点开当天所有人）', mgr, 'data-dayhead="'],
  ['manager: 总览的格子可点（点开当天所有人）', mgr, 'data-ov="'],
  ['manager: 有「当天所有人」面板渲染', mgr, 'function openDay(day)'],
  ['manager: 有总览渲染', mgr, 'function renderOverview()'],
  ['manager: 有按天渲染', mgr, 'function renderDay()'],
  ['manager: 三块只画一块', mgr, 'function renderView()'],
  ['manager: 选过的看法记在本机', mgr, "localStorage.getItem('sr.mgrView')"],
  ['manager: 手机默认「按天」（替代左右横滑）', mgr, "window.innerWidth <= 720 ? 'day' : 'sheet'"],
  ['manager: 全屏是 CSS 铺满（iOS 也能用），不是 Fullscreen API', mgr, '.viewbox.fs {'],
  ['manager: 全屏时锁住页面滚动', mgr, 'body.fs-open'],
  ['manager: Esc 能退全屏 / 关浮窗', mgr, "if (e.key !== 'Escape') return;"],
  ['manager: 换周后「按天」落回今天', mgr, 'S.day = mgrDayIdx(week, new Date());'],
  ['manager: 三种看法共用一套班次快捷按钮', mgr, 'function miniBtns(cur, disabled)'],
];
for (const [label, src, needle] of viewNeed) {
  if (src.includes(needle)) say(`  [OK]   ${label}`);
  else { problems++; say(`  [FAIL] ${label}: "${needle}" not found`); }
}

// 纯函数块必须能抽出来单测（tools/test_manager_views.mjs）
const mvStart = mgr.indexOf('/* ===== MGRVIEW-BLOCK-START =====');
const mvEnd = mgr.indexOf('/* ===== MGRVIEW-BLOCK-END =====');
if (mvStart < 0 || mvEnd <= mvStart) {
  problems++;
  say('  [FAIL] manager.html: 缺少 MGRVIEW-BLOCK 标记（tools/test_manager_views.mjs 靠它抽源码）');
} else {
  const mvBlock = mgr.slice(mvStart, mvEnd);
  const dirty = ['document.', 'navigator.', 'SR.', 'location.', 'localStorage'].filter((x) => mvBlock.includes(x));
  if (dirty.length) {
    problems++;
    say(`  [FAIL] manager.html: MGRVIEW-BLOCK 里不该有 ${dirty.join(' / ')}（纯函数才能单测）`);
  } else {
    say('  [OK]   manager.html: MGRVIEW-BLOCK 是纯函数块（无 DOM / 网络 / 会话）');
  }
}

// 三种看法必须共用同一份草稿（不能各画各的，也不能绕开 setSlot 直接改 S.grid）
if (/S\.grid\[[^\]]+\]\s*\.slot\s*=/.test(mgr.replace(/function setSlot\(k, slot, btn, day, role\)[\s\S]*?\n  \}/, ''))) {
  problems++;
  say('  [FAIL] manager.html: setSlot 之外还在直接写 S.grid[...].slot（会绕过落草稿）');
} else {
  say('  [OK]   manager.html: 改班次只走 setSlot（三种看法共用一条写路径）');
}

// ---------- 5. 体积 ----------
say('\n== 5. sizes ==');
for (const f of [...cssFiles, 'auth-core.js', ...files]) {
  const b = fs.statSync(path.join(dir, f)).size;
  say(`  ${f.padEnd(14)} ${(b / 1024).toFixed(1)} KB`);
}

say('\n' + (problems === 0 ? 'ALL CHECKS PASSED' : `PROBLEMS: ${problems}`));
process.exit(problems === 0 ? 0 : 1);
