// =============================================================
// tools/test_me_calendar.mjs · 员工端「导入到手机日历」纯逻辑测试
// -------------------------------------------------------------
// 把 me.html 里 CAL-BLOCK 那段纯函数原样抽出来跑（不碰 DOM），盯住三件事：
//   ① 班次时间口径：早 09:30–18:30 / 中 12:00–21:00 / 晚一 13:00–22:00 / 晚二 13:30–22:30
//   ② 周五、周六的晚班必须按「晚二」
//   ③ 导出的 .ics 真能进日历：UTC 时刻算对、每行 ≤75 字节、CRLF、UID 稳定
// 用法：node tools/test_me_calendar.mjs
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const src = fs.readFileSync(path.resolve('_deploy/me.html'), 'utf8');
const from = src.indexOf('/* ===== CAL-BLOCK-START ===== */');
const to = src.indexOf('/* ===== CAL-BLOCK-END ===== */');
if (from < 0 || to < 0 || to <= from) {
  console.log('  ✗ 找不到 CAL-BLOCK（导出日历的纯函数段）');
  process.exit(1);
}
const block = src.slice(from, to) +
  '\n;globalThis.__ex = { calShift, calStamp, calDateOf, calItems, calLine, plainCalendar, buildIcs, icsName, calBytes, calFold, CAL_TIMES };';

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`); }
}

const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const E = sandbox.__ex;

/* 独立算一遍期望的 UTC 串（不借助被测代码，避免自证） */
function utc(dateStr, hh, mm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh - 8, mm));
  return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
/* 展开折行后的物理行 */
function foldLines(ics) { return ics.split('\r\n').filter((l) => l !== ''); }
function evs(ics) {
  const u = ics.replace(/\r\n /g, '');
  const out = [];
  const re = /BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = re.exec(u))) {
    const o = {};
    m[1].split('\r\n').forEach((line) => {
      const i = line.indexOf(':');
      if (i > 0) {
        const k = line.slice(0, i);
        if (!(k in o)) o[k] = line.slice(i + 1);
      }
    });
    out.push(o);
  }
  return out;
}

const WEEK = '2026-10-26';   /* 必须是周一，下面先自检 */
const ROWS = [
  { day: 0, slot: 'early', role: 'open' },
  { day: 1, slot: 'rest' },
  { day: 2, slot: 'mid' },
  { day: 3, slot: 'night' },
  { day: 4, slot: 'night', role: 'close' },
  { day: 5, slot: 'night' },
  { day: 6, slot: '' }
];

console.log('== 导入日历 · 班次时间 ==');

check('测试自检：2026-10-26 是周一', new Date(Date.UTC(2026, 9, 26)).getUTCDay() === 1, new Date(Date.UTC(2026, 9, 26)).getUTCDay());

// ① 三种基本班次的时间口径
{
  const e = E.calShift('early', 0);
  check('早班 09:30–18:30', e.start === '09:30' && e.end === '18:30', e);
  const m = E.calShift('mid', 2);
  check('中班 12:00–21:00', m.start === '12:00' && m.end === '21:00', m);
  const n1 = E.calShift('night', 0);
  check('周一晚班 = 晚一 13:00–22:00', n1.label === '晚一班' && n1.start === '13:00' && n1.end === '22:00', n1);
}

// ② 周五、周六 → 晚二；其余日子仍是晚一
{
  const fri = E.calShift('night', 4);
  const sat = E.calShift('night', 5);
  check('周五晚班 = 晚二 13:30–22:30', fri.label === '晚二班' && fri.start === '13:30' && fri.end === '22:30', fri);
  check('周六晚班 = 晚二 13:30–22:30', sat.label === '晚二班' && sat.start === '13:30' && sat.end === '22:30', sat);
  const others = [0, 1, 2, 3, 6].map((d) => E.calShift('night', d));
  check('周一~周四、周日仍是晚一', others.every((t) => t.label === '晚一班'), others.map((t) => t.label));
}

// ④ 休息 / 未排 / 未知班次不进日历
{
  check('休息不导出', E.calShift('rest', 2) === null);
  check('未排班不导出', E.calShift('', 2) === null);
  check('未知班次不导出', E.calShift('weird', 2) === null);
}

console.log('\n== 导入日历 · 日期与 UTC ==');

// ⑤ 周一 + 第几天 = 正确日期（跨月也要对）
{
  check('第 0 天 = 周一', E.calDateOf(WEEK, 0) === '2026-10-26', E.calDateOf(WEEK, 0));
  check('第 6 天 = 周日（跨月）', E.calDateOf(WEEK, 6) === '2026-11-01', E.calDateOf(WEEK, 6));
  check('第 4 天 = 周五', E.calDateOf(WEEK, 4) === '2026-10-30', E.calDateOf(WEEK, 4));
}

// ⑥ UTC 换算：本地 09:30 → 01:30Z；22:30 → 14:30Z（当天，不跨日）
{
  check('09:30 本地 = 013000Z', E.calStamp('2026-10-26', '09:30') === utc('2026-10-26', 9, 30), E.calStamp('2026-10-26', '09:30'));
  check('18:30 本地 = 103000Z', E.calStamp('2026-10-26', '18:30') === utc('2026-10-26', 18, 30), E.calStamp('2026-10-26', '18:30'));
  check('22:30 本地 = 143000Z（不跨到次日）', E.calStamp('2026-10-30', '22:30') === utc('2026-10-30', 22, 30), E.calStamp('2026-10-30', '22:30'));
  check('22:30 的 UTC 日期仍是当天', E.calStamp('2026-10-30', '22:30').slice(0, 8) === '20261030', E.calStamp('2026-10-30', '22:30'));
}

console.log('\n== 导入日历 · 事件清单 ==');

// ⑦ 只留 5 个工作日（周一早/周三中/周四晚一/周五晚二/周六晚二）
{
  const items = E.calItems(ROWS, WEEK);
  check('只导出真正上班的 5 天', items.length === 5, items.map((i) => i.day));
  check('按周一→周日排序', items.map((i) => i.day).join(',') === '0,2,3,4,5', items.map((i) => i.day));
  const fri = items.find((i) => i.day === 4);
  check('周五那条用的就是晚二时段', fri.label === '晚二班' && fri.startAt === utc('2026-10-30', 13, 30), fri);
  const thu = items.find((i) => i.day === 3);
  check('周四那条仍是晚一', thu.label === '晚一班' && thu.startAt === utc('2026-10-29', 13, 0), thu);
  const mon = items.find((i) => i.day === 0);
  check('开店标记会被带出来', mon.role === 'open', mon.role);
}

// ⑧ 预览文案（UI 上那串 chip）
{
  const text = E.plainCalendar(ROWS, WEEK);
  const lines = text.split('\n');
  check('纯文本 5 行', lines.length === 5, lines);
  check('首行 = 周一 10/26 早班 09:30–18:30', lines[0] === '周一 10/26 早班 09:30–18:30', lines[0]);
  check('周五那行显示晚二 13:30–22:30', /周五 10\/30 晚二班 13:30–22:30/.test(text), lines);
}

console.log('\n== 导入日历 · .ics 文件 ==');

const ics = E.buildIcs(ROWS, WEEK, 'zhangsan');

{
  check('文件名 roster-<周一>.ics', E.icsName(WEEK) === 'roster-2026-10-26.ics', E.icsName(WEEK));
  check('以 BEGIN:VCALENDAR 开头', ics.startsWith('BEGIN:VCALENDAR\r\n'), ics.slice(0, 20));
  check('以 END:VCALENDAR 收尾', ics.endsWith('END:VCALENDAR\r\n'), JSON.stringify(ics.slice(-20)));
  check('带 VERSION:2.0', /^VERSION:2\.0\r$/m.test(ics));
  check('5 个 VEVENT（休息/未排没混进来）', evs(ics).length === 5, evs(ics).length);
  check('每个事件都有 30 分钟前提醒', (ics.match(/TRIGGER:-PT30M/g) || []).length === 5);
  check('没有裸 LF（ics 只认 CRLF）', !/[^\r]\n/.test(ics));
  check('每行 ≤75 字节（ics 规范）', foldLines(ics).every((l) => E.calBytes(l) <= 75),
    foldLines(ics).filter((l) => E.calBytes(l) > 75));
}

// ⑨ 事件字段逐项核对
{
  const list = evs(ics);
  const mon = list[0];
  check('早班 DTSTART/DTEND 正确', mon.DTSTART === utc('2026-10-26', 9, 30) && mon.DTEND === utc('2026-10-26', 18, 30), mon);
  check('SUMMARY 是班次名', mon.SUMMARY === '早班', mon.SUMMARY);
  check('DESCRIPTION 带日期与开店', /周一 10\/26 早班 09:30–18:30/.test(mon.DESCRIPTION) && /开店/.test(mon.DESCRIPTION), mon.DESCRIPTION);
  check('有 DTSTAMP', /^\d{8}T\d{6}Z$/.test(mon.DTSTAMP || ''), mon.DTSTAMP);
  const fri = list.find((x) => /2026-10-30/.test(x.UID));
  check('周五事件是晚二时段', fri.DTSTART === utc('2026-10-30', 13, 30) && fri.DTEND === utc('2026-10-30', 22, 30), fri);
  check('周五事件 SUMMARY=晚二班', fri.SUMMARY === '晚二班', fri.SUMMARY);
  const sat = list.find((x) => /2026-10-31/.test(x.UID));
  check('周六事件也是晚二', sat.SUMMARY === '晚二班' && sat.DTSTART === utc('2026-10-31', 13, 30), sat);
}

// ⑩ UID 必须稳定（重复导入不会变成两条）且唯一
{
  const a = evs(E.buildIcs(ROWS, WEEK, 'zhangsan')).map((e) => e.UID);
  const b = evs(E.buildIcs(ROWS, WEEK, 'zhangsan')).map((e) => e.UID);
  check('两次导出的 UID 完全一致', a.join('|') === b.join('|'), a);
  check('5 个 UID 互不重复', new Set(a).size === 5, a);
  check('UID 带账号名（换人不会互相覆盖）', a.every((u) => u.startsWith('zhangsan-')), a);
  check('账号名里的怪字符被清掉', evs(E.buildIcs(ROWS, WEEK, '张三@x')).every((e) => /^x-/.test(e.UID)), evs(E.buildIcs(ROWS, WEEK, '张三@x')).map((e) => e.UID));
}

// ⑪ 空周 / 只休息：不该产出事件，也不该崩
{
  check('整周休息 → 0 个事件', evs(E.buildIcs([{ day: 0, slot: 'rest' }], WEEK, 'u')).length === 0);
  check('空行 → 0 个事件', evs(E.buildIcs([], WEEK, 'u')).length === 0);
  check('空行 → 纯文本为空串', E.plainCalendar([], WEEK) === '');
  check('空行仍是合法 ics 外壳', E.buildIcs([], WEEK, 'u').startsWith('BEGIN:VCALENDAR'));
}

// ⑫ 折行：长中文描述也要 ≤75 字节，且展开后内容完整
{
  const long = [{ day: 4, slot: 'night', role: 'close' }];
  const s = E.buildIcs(long, WEEK, 'a_very_long_username_for_folding_test');
  const phys = foldLines(s);
  check('长描述折行后仍 ≤75 字节', phys.every((l) => E.calBytes(l) <= 75), phys.filter((l) => E.calBytes(l) > 75));
  check('折行发生在长行上（确实折了）', phys.some((l) => l.startsWith(' ')), phys);
  const e = evs(s)[0];
  check('展开后 DESCRIPTION 完整', /周五 10\/30 晚二班 13:30–22:30/.test(e.DESCRIPTION), e.DESCRIPTION);
  check('展开后 UID 完整', e.UID === 'a_very_long_username_for_folding_test-2026-10-30-4@smart-roster', e.UID);
}

// ⑬ calBytes 本身（中文 3 字节 / ASCII 1 字节 / emoji 4 字节）
{
  check('中文按 3 字节算', E.calBytes('早班') === 6, E.calBytes('早班'));
  check('ASCII 按 1 字节算', E.calBytes('abc') === 3, E.calBytes('abc'));
  check('emoji 按 4 字节算', E.calBytes('🙂') === 4, E.calBytes('🙂'));
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
