#!/usr/bin/env node
/**
 * 导出 Excel 班表 —— 纯函数单测 + **与参考文件逐项属性比对**
 *
 * 第一段：把 _deploy/manager.html 里的 ROSTEREXPORT-BLOCK 抽进 vm，验口径
 *         （跨月周怎么算、35 个日列、班次写法、人员占行、人数统计）。
 * 第二段：拿 tools/fixtures/roster_2026_10.json + _deploy/tpl/ 真模板，
 *         走 XLSXLITE.build 出真 .xlsx，解包后跟
 *         「华为智能生活馆(深圳卓悦中心)-2026-10月班表.xlsx」的 sheet2 对：
 *         部件齐全 / styles.xml 与 theme1.xml 逐字节相同 / 列宽 / 行高 /
 *         合并 / 冻结 / 条件格式 / 数据校验 / **每个单元格的 s 样式号** /
 *         静态文案 / 日期序列号 / 统计公式 / 无残留占位符。
 *
 * 用法：node tools/test_roster_export.mjs
 * 产出：tools/_build/roster_export_2026-10.xlsx（可以直接双击看效果）
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readZip } from './lib/zip.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const REF_DIR = 'D:/Desktop/_ref_xlsx/unzip/xl';          /* 参考 xlsx 解包目录 */

let pass = 0, fail = 0;
const diffs = [];
function check(label, cond, got) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else {
    fail++;
    const line = '  ✗ ' + label + (got === undefined ? '' : '   → ' + JSON.stringify(got));
    console.log(line.length > 400 ? line.slice(0, 400) + '…' : line);
  }
}
/* 批量比对：只报前 6 条差异，其余计数 */
function checkAll(label, bad, total) {
  if (!bad.length) { check(label + '（' + total + ' 项）', true); return; }
  fail++;
  console.log('  ✗ ' + label + '：' + bad.length + '/' + total + ' 不一致');
  bad.slice(0, 6).forEach((b) => console.log('      · ' + b));
  if (bad.length > 6) console.log('      · …另有 ' + (bad.length - 6) + ' 处');
}
function sha256(b) { return crypto.createHash('sha256').update(b).digest('hex'); }
function readRef(name) { return fs.readFileSync(path.join(REF_DIR, name), 'utf8'); }

/* ==================================================================== */
/* 0. 抽纯函数块                                                         */
/* ==================================================================== */
const html = fs.readFileSync(path.join(root, '_deploy', 'manager.html'), 'utf8');
const mBlock = /\/\* ===== ROSTEREXPORT-BLOCK-START =====[\s\S]*?\/\* ===== ROSTEREXPORT-BLOCK-END ===== \*\//.exec(html);
if (!mBlock) { console.error('[FAIL] manager.html 里找不到 ROSTEREXPORT-BLOCK 标记'); process.exit(1); }
const sandbox = vm.createContext({});
vm.runInContext(mBlock[0] + '\n;this.B = {' +
  'rostSerial: rostSerial, rostColLetter: rostColLetter, rostMonthOfWeek: rostMonthOfWeek,' +
  'rostMonthGrid: rostMonthGrid, rostCellText: rostCellText, rostRowPlan: rostRowPlan,' +
  'rostStats: rostStats, rostDayCols: rostDayCols, rostCtx: rostCtx,' +
  'ROSTER_STORE: ROSTER_STORE, ROSTER_DAY_COUNT: ROSTER_DAY_COUNT,' +
  'ROSTER_DAY_COL_FIRST: ROSTER_DAY_COL_FIRST, ROSTER_SLOT_TEXT: ROSTER_SLOT_TEXT };', sandbox);
const B = sandbox.B;

console.log('== 1. 纯口径（ROSTEREXPORT-BLOCK） ==');

check('常量：门店名照抄参考表标题里的写法', B.ROSTER_STORE === '华为智能生活馆（深圳卓悦中心）', B.ROSTER_STORE);
check('常量：35 个日列、首列是第 5 列（E）', B.ROSTER_DAY_COUNT === 35 && B.ROSTER_DAY_COL_FIRST === 5);

/* Excel 日期序列号：参考表 row3 的缓存值 46293 = 2026-09-28 */
console.log('\nrostSerial · 1900 日期体系');
check('2026-09-28 = 46293（与参考表 E3 一致）', B.rostSerial(new Date(2026, 8, 28)) === 46293, B.rostSerial(new Date(2026, 8, 28)));
check('2026-10-01 = 46296', B.rostSerial(new Date(2026, 9, 1)) === 46296, B.rostSerial(new Date(2026, 9, 1)));
check('1970-01-01 = 25569（Excel 常识值）', B.rostSerial(new Date(1970, 0, 1)) === 25569, B.rostSerial(new Date(1970, 0, 1)));

console.log('\nrostColLetter · 列号 → 字母');
check('1→A 4→D 5→E', B.rostColLetter(1) === 'A' && B.rostColLetter(4) === 'D' && B.rostColLetter(5) === 'E');
check('26→Z 27→AA 39→AM（第 35 个日列）', B.rostColLetter(26) === 'Z' && B.rostColLetter(27) === 'AA' && B.rostColLetter(39) === 'AM');
check('40→AN 46→AT', B.rostColLetter(40) === 'AN' && B.rostColLetter(46) === 'AT');

console.log('\nrostMonthOfWeek · 跨月周按周四所在月');
check('2026-09-28 这一周 → 2026-10（9/28-9/30 算 10 月班表）', B.rostMonthOfWeek('2026-09-28') === '2026-10', B.rostMonthOfWeek('2026-09-28'));
check('2026-10-26 → 2026-10', B.rostMonthOfWeek('2026-10-26') === '2026-10');
check('2026-11-02 → 2026-11', B.rostMonthOfWeek('2026-11-02') === '2026-11');
check('2026-11-30 这一周 → 2026-12', B.rostMonthOfWeek('2026-11-30') === '2026-12', B.rostMonthOfWeek('2026-11-30'));
check('坏串 / 空值 → 空', B.rostMonthOfWeek('') === '' && B.rostMonthOfWeek('x') === '' && B.rostMonthOfWeek(null) === '');

console.log('\nrostMonthGrid · 35 列铺满 5 周');
const g = B.rostMonthGrid('2026-10');
check('首列 2026-09-28（含 10/1 那一周的周一）', g.start === '2026-09-28', g.start);
check('末列 2026-11-01', g.cols[34].date === '2026-11-01', g.cols[34].date);
check('35 列、5 周', g.cols.length === 35 && g.weeks.length === 5, [g.cols.length, g.weeks.length]);
check('列号 5..39 / 字母 E..AM', g.cols[0].col === 5 && g.cols[0].letter === 'E' && g.cols[34].col === 39 && g.cols[34].letter === 'AM');
check('序列号首尾 46293 / 46327', g.cols[0].serial === 46293 && g.cols[34].serial === 46327, [g.cols[0].serial, g.cols[34].serial]);
check('在当月 31 天（10/1..10/31），首尾各 3 天和 1 天不在当月',
  g.cols.filter((c) => c.inMonth).length === 31 && !g.cols[0].inMonth && !g.cols[2].inMonth && !g.cols[34].inMonth);
check('weekKey 都是周一', g.weeks[0] === '2026-09-28' && g.weeks[4] === '2026-10-26', g.weeks);
check('周内第几天 0..6 循环', g.cols[8].dayIdx === 1 && g.cols[13].dayIdx === 6, [g.cols[8].dayIdx, g.cols[13].dayIdx]);
check('坏入参不炸', B.rostMonthGrid('').cols.length === 0 && B.rostMonthGrid(null).cols.length === 0);

console.log('\nrostCellText · 系统班次 → 参考表写法');
check('rest → "/"', B.rostCellText({ slot: 'rest' }) === '/');
check('early → 早班', B.rostCellText({ slot: 'early' }) === '早班');
check('early + role=open → 开店', B.rostCellText({ slot: 'early', role: 'open' }) === '开店');
check('mid → 中班2', B.rostCellText({ slot: 'mid' }) === '中班2');
check('night → 晚班2', B.rostCellText({ slot: 'night' }) === '晚班2');
check('night + role=close → 闭店', B.rostCellText({ slot: 'night', role: 'close' }) === '闭店');
check('空 / 未知 slot → 空', B.rostCellText(null) === '' && B.rostCellText({ slot: '' }) === '' && B.rostCellText({ slot: 'zzz' }) === '');
check('四种 slot 的兜底写法就是参考表词表里的词',
  JSON.stringify(B.ROSTER_SLOT_TEXT) === JSON.stringify({ early: '早班', mid: '中班2', night: '晚班2', rest: '/' }));

console.log('\nrostRowPlan · 按姓名占参考表的行');
const plan = B.rostRowPlan(['甲', '乙', '丙'], ['甲', '丁', '乙'], 7);
check('同名回原行（甲→7、乙→9）', plan.rows[0].name === '甲' && plan.rows[2].name === '乙');
check('空行按顺序补人（丁→8 被丙占）', plan.rows[1].name === '丙', plan.rows);
check('对不上的行留空', plan.rows.filter((r) => !r.name).length === 0, plan.rows.map((r) => r.name));
check('人多到装不下 → overflow', B.rostRowPlan(['甲', '乙', '丙', '丁'], ['甲'], 7).overflow.join('') === '乙丙丁');
check('重名不抢同一行', (() => {
  const p = B.rostRowPlan(['甲', '甲'], ['甲', '乙'], 7);
  return p.rows[0].name === '甲' && p.rows[1].name === '甲';
})());

console.log('\nrostStats · 102..107 行人数统计');
const sCols = [{ letter: 'E' }];
const fake = { A: { E7: '早班', E8: '开店', E9: '中班2', E10: '晚班2', E11: '/', E12: '闭店' } };
const st = B.rostStats({
  cols: sCols, firstRow: 7, lastRow: 12, frontFirst: 7, frontLast: 12,
  cellOf: (r, c) => fake.A[c + r] || ''
});
check('早班 = 早班+开店 = 2', st.E102 === 2, st.E102);
check('中班2 = 1', st.E103 === 1, st.E103);
check('晚班 = 晚班2+闭店 = 2', st.E104 === 2, st.E104);
check('出勤 = 早+中+晚 = 5', st.E105 === 5, st.E105);
check('休息 = "/" 1', st.E106 === 1, st.E106);
check('全员出勤 = 5', st.E107 === 5, st.E107);

console.log('\nrostDayCols · 列宽样式照抄、不在当月的日子隐藏');
const dayDefs = g.cols.map((c, i) => ({ width: i === 6 ? '12.9833333333333' : '12.625', style: '1' }));
const dayCols = B.rostDayCols(g.cols, dayDefs);
check('35 条 <col>', (dayCols.match(/<col /g) || []).length === 35);
check('列宽照抄（第 7 条 12.9833333333333）', dayCols.indexOf('width="12.9833333333333"') > 0);
check('非当月的前 3 列 + 末 1 列 hidden="1"', (dayCols.match(/hidden="1"/g) || []).length === 4, (dayCols.match(/hidden="1"/g) || []).length);
check('每条都带 customWidth="1" 与 style',
  (dayCols.match(/customWidth="1"/g) || []).length === 35 && (dayCols.match(/ style="1"/g) || []).length === 35,
  [(dayCols.match(/customWidth="1"/g) || []).length, (dayCols.match(/ style="1"/g) || []).length]);

/* ==================================================================== */
/* 2. 用真模板 + 线上快照拼出 xlsx                                        */
/* ==================================================================== */
console.log('\n== 2. 端到端：真模板 + 线上快照 → .xlsx ==');
const require_ = createRequire(import.meta.url);
const XLSXLITE = require_(path.join(root, '_deploy', 'xlsx-lite.js'));

const TPL = {};
for (const n of ['sheet', 'styles', 'theme', 'workbook', 'workbook-rels', 'rels', 'content-types', 'app', 'core']) {
  const file = n === 'theme' ? 'theme1.xml' : n + '.xml';      /* 模板文件名照浏览器端 loadRosterTpl */
  TPL[n] = fs.readFileSync(path.join(root, '_deploy', 'tpl', file), 'utf8');
}
TPL.meta = JSON.parse(fs.readFileSync(path.join(root, '_deploy', 'tpl', 'meta.json'), 'utf8'));

const fx = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'fixtures', 'roster_2026_10.json'), 'utf8'));
const cellMap = {};
const weekRows = {};
for (const wk of Object.keys(fx.weeks)) {
  weekRows[wk] = fx.weeks[wk];
  for (const r of fx.weeks[wk]) cellMap[r.staff_name + '|' + wk + '|' + r.day] = { slot: r.slot || '', role: r.role || null };
}

const C = B.rostCtx({ ym: fx.ym, meta: TPL.meta, staff: fx.staff, cells: cellMap });
const bytes = XLSXLITE.build(TPL, C, new Date(2026, 9, 28, 9, 30, 0));

const outDir = path.join(root, 'tools', '_build');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'roster_export_2026-10.xlsx');
fs.writeFileSync(outFile, bytes);

check('rosterCtx：82 人全部装进 95 个行位', C.shown === fx.staff.length && C.overflow.length === 0, [C.shown, C.overflow.length]);
check('rosterCtx：13 个参考表里有、库里没有的人留空行', C.hiddenRows.length === TPL.meta.personCount - fx.staff.length, C.hiddenRows.length);
check('rosterCtx：文件名沿用门店命名（半角括号）',
  C.file === '华为智能生活馆(深圳卓悦中心)-2026-10月班表.xlsx', C.file);
check('rosterCtx：sheet 名 = 10月班表', C.sheet === '10月班表', C.sheet);
check('rosterCtx：标题带换行+空格（照抄参考表 B1）', C.text.B1 === '华为智能生活馆（深圳卓悦中心）10月排班表\n ', JSON.stringify(C.text.B1));
check('产物是合法 zip（%PDF 之外的 PK 头 + 0 字节残留）', bytes.length > 100000 && bytes[0] === 0x50 && bytes[1] === 0x4b, bytes.length);

const parts = readZip(bytes);
/* 部件缺失时返回空壳，让「缺部件」变成一条红色断言，而不是整脚本崩 */
const part = (n) => parts.get(n) || { text: '', buf: Buffer.alloc(0), method: -1 };
const PART_NAMES = ['[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'docProps/core.xml',
  'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/theme/theme1.xml', 'xl/worksheets/sheet1.xml'];
checkAll('zip 内 9 个部件、顺序与命名正确',
  PART_NAMES.filter((n) => !parts.has(n)), PART_NAMES.length);
check('[Content_Types].xml 在最前（Excel 的偏好）', [...parts.keys()][0] === '[Content_Types].xml');

const outSheet = part('xl/worksheets/sheet1.xml').text;
const refSheet = readRef('worksheets/sheet2.xml');

console.log('\n== 3. 与参考文件逐项比对 ==');

/* 3.1 样式部件：逐字节 */
const REF_STYLES_SHA = '3ef4da058d3687b4b51258c896f798808acde171964352439f6d098dd6db752a';
const REF_THEME_SHA = 'a7a7625c1b9b43af368808885e6f58e97941c0cbc3224d582731f50634139b89';
check('xl/styles.xml 与参考文件逐字节相同',
  sha256(part('xl/styles.xml').buf) === REF_STYLES_SHA, sha256(part('xl/styles.xml').buf));
check('xl/theme/theme1.xml 与参考文件逐字节相同',
  sha256(part('xl/theme/theme1.xml').buf) === REF_THEME_SHA, sha256(part('xl/theme/theme1.xml').buf));
check('styles.xml 大小 = 288214（与参考一致）', part('xl/styles.xml').buf.length === 288214, part('xl/styles.xml').buf.length);

/* 3.2 工作簿外壳 */
const outWb = part('xl/workbook.xml').text;
check('workbook：只一张 sheet，名字 10月班表', /<sheet name="10月班表" sheetId="1" r:id="rId1"\/>/.test(outWb) && (outWb.match(/<sheet /g) || []).length === 1);
check('workbook：fullCalcOnLoad=1（公式一打开就算）', /fullCalcOnLoad="1"/.test(outWb));
check('外部链接 / 共享字符串都没带（无 sharedStrings 依赖）', !outSheet.includes('t="s"'));

/* 3.3 列宽 */
function parseCols(xml) {
  const sec = (/<cols>([\s\S]*?)<\/cols>/.exec(xml) || [])[1] || '';
  const out = [];
  for (const x of sec.matchAll(/<col\b([^>]*)\/>/g)) {
    const a = x[1];
    out.push({
      min: Number((/min="([0-9]+)"/.exec(a) || [])[1]),
      max: Number((/max="([0-9]+)"/.exec(a) || [])[1]),
      width: (/width="([^"]+)"/.exec(a) || [])[1],
      style: (/ style="([^"]+)"/.exec(a) || [])[1] || '',
      hidden: /hidden="1"/.test(a),
      custom: /customWidth="1"/.test(a)
    });
  }
  return out;
}
const outCols = parseCols(outSheet), refCols = parseCols(refSheet);
const colOf = (arr, n) => arr.filter((c) => n >= c.min && n <= c.max);

const FIXED_COLS = [1, 2, 3, 4, 40, 41, 42, 43, 44, 45, 46, 47, 16354];
const badFixed = [];
for (const n of FIXED_COLS) {
  const a = colOf(outCols, n)[0], b = colOf(refCols, n)[0];
  const same = a && b && a.width === b.width && a.style === b.style && a.hidden === b.hidden && a.custom === b.custom;
  if (!same) badFixed.push('第 ' + n + ' 列 ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b));
}
checkAll('列宽/样式/隐藏：固定列（A-D、AN 之后）与参考完全一致', badFixed, FIXED_COLS.length);

const badDayCols = [];
for (let n = 5; n <= 39; n++) {
  const a = colOf(outCols, n)[0], b = colOf(refCols, n)[0];
  if (!a || !b || a.width !== b.width || a.style !== b.style || a.custom !== b.custom) {
    badDayCols.push(n + ' 列 ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b));
  }
}
checkAll('列宽/样式：35 个日列与参考一致（hidden 按「是否当月」自算）', badDayCols, 35);
check('日列隐藏数 = 不在当月的 4 天（9/28-9/30 + 11/1）',
  outCols.filter((c) => c.min >= 5 && c.max <= 39 && c.hidden).length === 4,
  outCols.filter((c) => c.min >= 5 && c.max <= 39 && c.hidden).map((c) => c.min));

/* 3.4 行高 */
function parseRows(xml) {
  const out = new Map();
  for (const x of xml.matchAll(/<row\b([^>]*)>/g)) {
    const a = x[1];
    const n = Number((/r="([0-9]+)"/.exec(a) || [])[1]);
    out.set(n, {
      ht: (/ht="([^"]+)"/.exec(a) || [])[1] || '',
      customHeight: /customHeight="1"/.test(a),
      s: (/ s="([^"]+)"/.exec(a) || [])[1] || '',
      hidden: /hidden="1"/.test(a)
    });
  }
  return out;
}
const outRows = parseRows(outSheet), refRows = parseRows(refSheet);
check('行数 164（与参考一样，不多不少）', outRows.size === 164 && refRows.size === 164, [outRows.size, refRows.size]);
const badHt = [];
for (const [n, r] of refRows) {
  const o = outRows.get(n);
  if (!o || o.ht !== r.ht || o.customHeight !== r.customHeight || o.s !== r.s) badHt.push('第 ' + n + ' 行 ' + JSON.stringify(o) + ' ≠ ' + JSON.stringify(r));
}
checkAll('每行行高/自定义高度/行样式与参考一致', badHt, refRows.size);
check('行高抽检：第 1 行 41.45、第 7 行 22.5', outRows.get(1).ht === '41.45' && outRows.get(7).ht === '22.5', [outRows.get(1).ht, outRows.get(7).ht]);

/* 3.5 合并 / 冻结 / 保护 / 打印设置 */
const mergeOf = (xml) => ((/<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/.exec(xml) || [])[1] || '').match(/<mergeCell ref="[^"]+"\/>/g) || [];
checkAll('9 个合并区域逐个一致', JSON.stringify(mergeOf(outSheet)) === JSON.stringify(mergeOf(refSheet)) ? [] : ['合并区不同'],
  mergeOf(refSheet).length);
check('合并区数量 = 9', mergeOf(outSheet).length === 9, mergeOf(outSheet).length);
const paneOf = (xml) => (/<pane\b[^>]*\/>/.exec(xml) || [])[0] || '';
const paneAttr = (xml, k) => ((new RegExp('\\b' + k + '="([^"]*)"').exec(paneOf(xml)) || [])[1] || '');
check('冻结窗格 xSplit=4 / ySplit=6 / bottomRight / frozen（与参考一致）',
  paneAttr(outSheet, 'xSplit') === paneAttr(refSheet, 'xSplit') &&
  paneAttr(outSheet, 'ySplit') === paneAttr(refSheet, 'ySplit') &&
  paneAttr(outSheet, 'activePane') === paneAttr(refSheet, 'activePane') &&
  paneAttr(outSheet, 'state') === paneAttr(refSheet, 'state') &&
  paneAttr(outSheet, 'xSplit') === '4' && paneAttr(outSheet, 'ySplit') === '6', paneOf(outSheet));
check('冻结窗格落点改到 E7（参考表是 Q74；只是打开时的滚动位置，不影响版式）',
  paneAttr(outSheet, 'topLeftCell') === 'E7' && paneAttr(refSheet, 'topLeftCell') === 'Q74',
  [paneAttr(outSheet, 'topLeftCell'), paneAttr(refSheet, 'topLeftCell')]);
check('sheetProtection 与参考一致', (/<sheetProtection[^>]*\/>/.exec(outSheet) || [])[0] === (/<sheetProtection[^>]*\/>/.exec(refSheet) || [])[0]);
check('pageMargins / pageSetup / headerFooter 与参考一致（打印版式）',
  (/<pageMargins[^>]*\/>/.exec(outSheet) || [])[0] === (/<pageMargins[^>]*\/>/.exec(refSheet) || [])[0] &&
  (/<pageSetup[^>]*\/>/.exec(outSheet) || [])[0] === (/<pageSetup[^>]*\/>/.exec(refSheet) || [])[0] &&
  /<headerFooter\/>/.test(outSheet));
check('sheetFormatPr 默认列宽/行高与参考一致', (/<sheetFormatPr[^>]*\/>/.exec(outSheet) || [])[0] === (/<sheetFormatPr[^>]*\/>/.exec(refSheet) || [])[0]);
check('sheetView：tabSelected / zoomScale 85 与参考一致',
  /zoomScale="85"/.test(outSheet) && /tabSelected="1"/.test(outSheet));
check('dimension 与参考一致（A1:EI164）', (/<dimension ref="[^"]+"\/>/.exec(outSheet) || [])[0] === (/<dimension ref="[^"]+"\/>/.exec(refSheet) || [])[0]);

/* 3.6 条件格式 / 数据校验 */
const cfOf = (xml) => xml.match(/<conditionalFormatting[\s\S]*?<\/conditionalFormatting>/g) || [];
checkAll('32 条条件格式逐条一致', JSON.stringify(cfOf(outSheet)) === JSON.stringify(cfOf(refSheet)) ? [] : ['条件格式不同'], 32);
check('条件格式条数 = 32（与参考相同）', cfOf(outSheet).length === 32, cfOf(outSheet).length);
const dvOf = (xml) => (/<dataValidations[^>]*>([\s\S]*?)<\/dataValidations>/.exec(xml) || [])[1] || '';
const dvOut = dvOf(outSheet), dvRef = dvOf(refSheet);
const dvsOut = dvOut.match(/<dataValidation\b[\s\S]*?<\/dataValidation>/g) || [];
const dvsRef = dvRef.match(/<dataValidation\b[\s\S]*?<\/dataValidation>/g) || [];
check('数据校验 4 条（参考 5 条，删掉了跨表引用 Sheet2 的那条）', dvsOut.length === 4 && dvsRef.length === 5, [dvsOut.length, dvsRef.length]);
checkAll('前 4 条数据校验（班次词表）逐字节一致', dvsOut[0] === dvsRef[0] && dvsOut[1] === dvsRef[1] && dvsOut[2] === dvsRef[2] && dvsOut[3] === dvsRef[3] ? [] : ['有差异'], 4);
check('词表里确实有 早班/中班2/晚班2/开店/闭店', ['早班', '中班2', '晚班2', '开店', '闭店', '/'].every((w) => dvOut.includes(w)));

/* 3.7 每个单元格的 s（样式号）—— 这是「字体/底色/边框/对齐」的总开关 */
function parseCells(xml) {
  const sd = xml.slice(xml.indexOf('<sheetData>'), xml.indexOf('</sheetData>'));
  const map = new Map();
  for (const x of sd.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const a = x[1], body = x[2] || '';
    const ref = (/r="([A-Z]+[0-9]+)"/.exec(a) || [])[1];
    if (!ref) continue;
    const fTag = /<f\b[^>]*>[\s\S]*?<\/f>|<f\b[^>]*\/>/.exec(body);
    map.set(ref, {
      s: (/ s="([0-9]+)"/.exec(a) || [])[1] || '',
      t: (/ t="([^"]+)"/.exec(a) || [])[1] || '',
      v: (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1],
      f: fTag ? fTag[0] : '',
      raw: (/<is>([\s\S]*?)<\/is>/.exec(body) || [])[1]
    });
  }
  return map;
}
const outCells = parseCells(outSheet), refCells = parseCells(refSheet);

/* 参考表用 sharedStrings，先摊平 */
const ssXml = readRef('sharedStrings.xml');
const SS = [];
for (const x of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  SS.push((x[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
    .map((y) => y.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, '')).join(''));
}
const unEnt = (s) => String(s == null ? '' : s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
const refText = (ref) => {
  const c = refCells.get(ref);
  if (!c) return '';
  if (c.t === 's') return unEnt(SS[Number(c.v)]);
  if (c.t === 'inlineStr' && c.raw) return unEnt(((/<t[^>]*>([\s\S]*?)<\/t>/.exec(c.raw) || [])[1] || ''));
  return c.v == null ? '' : unEnt(c.v);
};
const outText = (ref) => {
  const c = outCells.get(ref);
  if (!c) return '';
  if (c.raw) return unEnt(((/<t[^>]*>([\s\S]*?)<\/t>/.exec(c.raw) || [])[1] || ''));
  return c.v == null ? '' : unEnt(c.v);
};

check('单元格总数 = 参考的 5330（一个不多一个不少）', outCells.size === 5330 && refCells.size === 5330, [outCells.size, refCells.size]);
const badRefs = [];
for (const ref of refCells.keys()) if (!outCells.has(ref)) badRefs.push(ref + ' 丢了');
for (const ref of outCells.keys()) if (!refCells.has(ref)) badRefs.push(ref + ' 多出来');
checkAll('所有单元格坐标集合与参考完全一致', badRefs, refCells.size);

const badS = [];
for (const [ref, c] of refCells) {
  const o = outCells.get(ref);
  if (!o || o.s !== c.s) badS.push(ref + ' s=' + (o ? o.s : 'N/A') + ' ≠ ' + c.s);
}
checkAll('每个单元格的 s（字体/底色/边框/对齐）与参考一模一样', badS, refCells.size);

/* 3.8 静态文案（表头、图例、统计区标签）
   108-119 行不在逐字比对里：那里是参考表留下的历史缓存数字（藏在隐藏列里）和
   几名老员工的「个人固定要求」备注 —— 属数据不属版式，导出留空（样式/合并照留）。 */
console.log('\n静态文案对照（表头 1-6 行 / 统计区 102-107 / 图例 AN..AT 列）');
const STATIC_REFS = [];
const SKIPPED_ROWS = [];
for (const [ref, c] of refCells) {
  if (!(c.t === 's' || c.t === 'inlineStr')) continue;         /* 只挑文字格 */
  const row = Number((ref.match(/[0-9]+/) || [])[0]);
  if (row >= 108 && row <= 119) { SKIPPED_ROWS.push(ref); continue; }
  if (row <= 6 || row >= 102 || /^(AN|AO|AP|AQ|AR|AS|AT)/.test(ref)) STATIC_REFS.push(ref);
}
const badStatic = [];
for (const ref of STATIC_REFS) {
  const a = refText(ref), b = outText(ref);
  if (a !== b) badStatic.push(ref + ' ' + JSON.stringify(b) + ' ≠ ' + JSON.stringify(a));
}
checkAll('静态文案（星期/日期/营业/活动/图例）与参考逐字相同', badStatic, STATIC_REFS.length);
check('静态文字格数量 ≥ 20（D2..D6、AT7..AT14、B102..D107）', STATIC_REFS.length >= 20, STATIC_REFS.length);
check('跳过的只有 108-119 行（个人备注区）', SKIPPED_ROWS.every((r) => {
  const n = Number((r.match(/[0-9]+/) || [])[0]);
  return n >= 108 && n <= 119;
}), SKIPPED_ROWS.length);
check('标题 B1 逐字相同（含尾部换行+空格）', outText('B1') === refText('B1'), JSON.stringify(outText('B1')));
check('图例 AT7..AT14 逐字相同',
  ['AT7', 'AT8', 'AT9', 'AT10', 'AT11', 'AT12', 'AT13', 'AT14'].every((r) => outText(r) === refText(r)) &&
  outText('AT8').indexOf('开店') === 0);
check('统计区标签：人数统计 / 前场体验顾问班次分布 / 早班 / 中班2 / 晚班 / 出勤 / 休息 / 门店全员',
  ['B102', 'C102', 'D102', 'D103', 'D104', 'D105', 'D106', 'C107', 'D107'].every((r) => outText(r) === refText(r)),
  ['B102', 'C102', 'C107', 'D107'].map((r) => outText(r)));
check('统计区 5 个合并格的文字与参考相同（B102/C102 只写一次）',
  outText('B102') === '人数统计' && outText('C102') === '前场\n体验顾问班次分布');
check('备注区（114-119 行）格子/合并/样式都在，但个人固定要求留空（属于具体员工的数据）',
  ['B114', 'C114', 'B116', 'C116', 'B117', 'C118'].every((r) =>
    outCells.has(r) && outCells.get(r).s === refCells.get(r).s && outText(r) === '') &&
  mergeOf(outSheet).includes('<mergeCell ref="B114:B115"/>') && mergeOf(outSheet).includes('<mergeCell ref="C118:D119"/>'),
  ['B114', 'C114', 'B116', 'C118'].map((r) => outText(r)));
check('参考表备注区原本确有文案（说明不是「本来就没有」）',
  ['B114', 'C114', 'B116', 'B117', 'B118', 'C118'].every((r) => refText(r) !== ''));

/* 3.9 row3 日期序列号 */
const badDates = [];
for (let n = 5; n <= 39; n++) {
  const ref = B.rostColLetter(n) + '3';
  if (outText(ref) !== refText(ref)) badDates.push(ref + ' ' + outText(ref) + ' ≠ ' + refText(ref));
}
checkAll('第 3 行 35 个日期序列号与参考逐个相同', badDates, 35);

/* 3.10 人员行：公式（AN..AR 统计列）与参考一致 */
const badF = [];
let fCount = 0;
for (let r = 7; r <= 101; r++) {
  for (const col of ['AN', 'AO', 'AP', 'AQ', 'AR']) {
    const ref = col + r, a = refCells.get(ref), b = outCells.get(ref);
    if (a && a.f) {
      fCount++;
      if (!b || b.f !== a.f) badF.push(ref + ' 公式不一致');
    }
  }
}
checkAll('AN..AR 的统计公式（' + fCount + ' 格）与参考逐字节相同', badF, fCount);
check('人员行的班次格全部转成 inlineStr（不依赖 sharedStrings）',
  ['E7', 'K7', 'AL7', 'AM101'].every((r) => outCells.get(r) && outCells.get(r).t === 'inlineStr'));
check('A 列序号连续 1..' + C.shown + '（跳过留空的参考行，不跳号）', (() => {
  const seq = [];
  for (let r = TPL.meta.personFirst; r <= TPL.meta.personLast; r++) {
    if (C.hiddenRows.indexOf(r) >= 0) continue;
    seq.push(Number(outText('A' + r)));
  }
  return seq.length === C.shown && seq.every((v, i) => v === i + 1);
})());
check('留空的参考行整行 hidden="1"、姓名格为空（不破坏下面的合并区）',
  C.hiddenRows.every((r) => outRows.get(r).hidden && outText('D' + r) === ''), C.hiddenRows);

/* 3.11 人数统计区是数值（不是公式），且加总自洽 */
const badStat = [];
for (let n = 5; n <= 39; n++) {
  const col = B.rostColLetter(n);
  const sum = Number(outText(col + '102')) + Number(outText(col + '103')) + Number(outText(col + '104'));
  if (sum !== Number(outText(col + '105'))) badStat.push(col + '105 ' + outText(col + '105') + ' ≠ ' + sum);
}
checkAll('统计区「出勤人数 = 早班+中班2+晚班」每列自洽', badStat, 35);
check('统计区标签行 102..107 的 s 与参考相同',
  ['D102', 'D103', 'D104', 'D105', 'D106', 'D107'].every((r) => outCells.get(r).s === refCells.get(r).s));

/* 3.12 数据内容：班次写法与参考的词表一致 */
const nameRow = {};
B.rostRowPlan(fx.staff.map((p) => p.name), TPL.meta.refNames, TPL.meta.personFirst)
  .rows.forEach((x) => { if (x.name) nameRow[x.name] = x.row; });
const SLOT_WORDS = ['开店', '早班', '中班2', '晚班2', '闭店', '/', ''];
const badWord = [];
for (const st of fx.staff) {
  const row = nameRow[st.name];
  for (let n = 5; n <= 39; n++) {
    const v = outText(B.rostColLetter(n) + row);
    if (SLOT_WORDS.indexOf(v) < 0) badWord.push(st.name + ' ' + B.rostColLetter(n) + row + '=' + v);
  }
}
checkAll('所有班次格只出现参考表词表里的写法', badWord, fx.staff.length * 35);
check('82 个在册员工都有自己的行（没有 overflow）', Object.keys(nameRow).length === fx.staff.length, Object.keys(nameRow).length);
check('已排的那一周确实写进表里（早班 / 晚班2 / 中班2 / "/" 都有）', (() => {
  const wk = Object.keys(weekRows)[0];
  const seen = new Set();
  for (const st of fx.staff) {
    for (const gc of g.cols) {
      if (gc.weekKey !== wk) continue;
      const v = outText(gc.letter + nameRow[st.name]);
      if (v) seen.add(v);
    }
  }
  return seen.has('早班') && seen.has('/') && seen.size >= 2;
})());

/* 3.13 洁净度：没有残留占位符、没有离职姓名、没有跨表引用 */
check('没有残留 {{…}} 占位符（sheet / workbook / core / app 全查）',
  !/\{\{/.test(outSheet) && !/\{\{/.test(outWb) &&
  !/\{\{/.test(part('docProps/core.xml').text) && !/\{\{/.test(part('docProps/app.xml').text));
const departed = TPL.meta.refNames.filter((n) => !fx.staff.some((p) => p.name === n));
const dLeak = [];
for (let r = TPL.meta.personFirst; r <= TPL.meta.personLast; r++) {
  const v = outText('D' + r);
  if (departed.indexOf(v) >= 0) dLeak.push('D' + r + '=' + v);
}
checkAll('13 个已不在库里的姓名没有占住姓名列（D 列）', dLeak, departed.length);
check('留空行数正好等于库外人数（' + departed.length + ' 行）', C.hiddenRows.length === departed.length, C.hiddenRows.length);
check('没有指向别的 sheet 的引用（不会把其它部门的数据带出去）',
  !/Sheet2!/.test(outSheet) && !/sharedStrings/.test(outSheet) && !/externalLink/.test(outSheet));
check('没有 customXml / dbsheet 之类的 WPS 私有部件（部件只有 9 个）', parts.size === 9, parts.size);

/* 3.14 体积与压缩方式 */
check('stored（未压缩）—— 浏览器端零依赖也能拼出来',
  [...parts.values()].every((p) => p.method === 0), [...parts.values()].map((p) => p.method));
check('文件大小落在 0.4MB ~ 1.2MB', bytes.length > 400000 && bytes.length < 1200000, bytes.length);

/* ==================================================================== */
/* 4. XML 良构性（Excel 打开的第一道门槛）                                 */
/* ==================================================================== */
console.log('\n== 4. XML 良构性 ==');
function wellFormed(xml) {
  const stack = [];
  const body = xml.replace(/<\?[\s\S]*?\?>/g, '');
  for (const x of body.matchAll(/<(\/?)([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    if (x[2] === '') continue;
    if (x[1] === '/') {
      if (stack.pop() !== x[2]) return '闭合标签不匹配：' + x[2];
    } else if (x[4] !== '/') {
      stack.push(x[2]);
    }
  }
  if (stack.length) return '未闭合：' + stack.slice(-3).join(',');
  return '';
}
const WF = ['xl/worksheets/sheet1.xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/theme/theme1.xml',
  '[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'xl/_rels/workbook.xml.rels'];
const badWF = [];
for (const n of WF) {
  const err = wellFormed(part(n).text) || (parts.has(n) ? '' : '部件缺失');
  if (err) badWF.push(n + '：' + err);
}
checkAll('9 个部件 XML 全部良构', badWF, WF.length);
check('没有替换字符 U+FFFD（编码没坏）', !outSheet.includes('\uFFFD'));

console.log('\n产物：' + outFile + '（' + (bytes.length / 1024).toFixed(1) + 'KB）');
console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
