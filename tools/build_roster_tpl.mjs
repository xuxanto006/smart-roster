#!/usr/bin/env node
/**
 * 由参考文件生成「导出 Excel 班表」的模板部件。
 *
 * 背景：经理端要导出的 xlsx 必须与门店现用的参考表**逐项一致**（列宽、行高、
 * 合并、字体、填充、边框、冻结、条件格式、数据校验…）。靠代码重建那 288KB
 * 的 styles.xml 与 440 种单元格样式不现实，于是反过来做：
 *
 *   把参考文件的 xlsx 当模板，原样保留 styles.xml / theme1.xml / 每个单元格的
 *   s 属性 / 行高 / 列宽 / 合并 / 公式 / 数据校验 / 条件格式，只把「数据格子」
 *   换成占位符，运行时再把真数据填进去。
 *
 * 产物（_deploy/tpl/）：
 *   sheet.xml        —— 参考 sheet2.xml 的「换数据位」版（inlineStr + 占位符）
 *   styles.xml       —— 参考文件原样拷贝（逐字节一致）
 *   theme1.xml       —— 原样
 *   workbook.xml     —— 单 sheet 版（{{SHEET}} 为页签名占位）
 *   workbook-rels.xml / rels.xml / content-types.xml / app.xml / core.xml
 *   meta.json        —— 人员行区间、35 个日列宽、参考姓名顺序、月份文案等
 *
 * 占位符三种（运行时见 _deploy/xlsx-lite.js）：
 *   {{T:REF}}        文本格（外面已经有 <c … t="inlineStr"><is><t>）
 *   {{N:REF}}        数字格（外面已经有 <v>）
 *   {{CELL:REF|s}}   整格替换（值为空时要写成自闭合 <c/>，A 列用）
 *   {{M:REF}}        月份文案（导出月份 == 参考月份时用原文，否则留空）
 *   {{H:ROW}}        行隐藏（没人占的行补 hidden="1"）
 *   {{DAYCOLS}}     35 个日列的 <col>（哪天不在本月就 hidden="1"）
 *   {{SHEET}}        页签名
 *
 * 用法：
 *   node tools/build_roster_tpl.mjs [参考文件.xlsx]
 *   （默认读 c:\Users\Administrator\Documents\xwechat_files\…\华为…-2026-10月班表.xlsx）
 */
import fs from 'node:fs';
import path from 'node:path';
import { readZip } from './lib/zip.mjs';

const DEFAULT_REF = 'c:/Users/Administrator/Documents/xwechat_files/wxid_ccjhzb8ja3p312_e069/msg/file/2026-10/华为智能生活馆(深圳卓悦中心)-2026-10月班表.xlsx';
const REF = process.argv[2] || DEFAULT_REF;
const OUT = path.resolve('_deploy', 'tpl');

if (!fs.existsSync(REF)) {
  console.error('[FAIL] 找不到参考文件：' + REF);
  process.exit(1);
}

const zip = readZip(fs.readFileSync(REF));
const sheetXml = zip.get('xl/worksheets/sheet2.xml').text;
const stylesXml = zip.get('xl/styles.xml').text;
const themeXml = zip.get('xl/theme/theme1.xml').text;
const ssXml = zip.get('xl/sharedStrings.xml').text;

/* ---------- sharedStrings → 真正文本 ---------- */
const sst = [];
for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  const inner = m[1];
  const parts = [];
  for (const t of inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) parts.push(t[1]);
  sst.push({
    inner,
    text: parts.join('')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#10;/g, '\n').replace(/&amp;/g, '&')
  });
}

/* ---------- 拆 sheet ---------- */
const sDataAt = sheetXml.indexOf('<sheetData>');
const sDataEnd = sheetXml.indexOf('</sheetData>') + '</sheetData>'.length;
const prefix = sheetXml.slice(0, sDataAt);
const body = sheetXml.slice(sDataAt + '<sheetData>'.length, sheetXml.indexOf('</sheetData>'));
const suffix = sheetXml.slice(sDataEnd);

const ROW_RE = /<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g;
const rows = [];
for (const m of body.matchAll(ROW_RE)) {
  const attrs = m[1];
  const rn = Number((attrs.match(/\br="(\d+)"/) || [])[1]);
  rows.push({ rn, attrs, inner: m[3] || '' });
}
rows.sort((a, b) => a.rn - b.rn);

const CELL_RE = /<c\s+r="([A-Z]+)(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
function cellsOf(inner) {
  const out = [];
  for (const m of inner.matchAll(CELL_RE)) {
    out.push({ col: m[1], ref: m[1] + m[2], attrs: m[3], inner: m[5] || '', self: m[4] === '/>' });
  }
  return out;
}

/* ---------- 判断哪些格子是「数据位」 ---------- */
const PERSON_FIRST = 7, PERSON_LAST = 101;
const DAY_COL_FIRST = 5, DAY_COL_COUNT = 35;   // E..AM
const FROZEN_STATS = [102, 106];               // 人数统计 6 行（102..107）

function colIdx(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;                                    // A=1
}
const DAY_COLS = [];
for (let i = 0; i < DAY_COL_COUNT; i++) DAY_COLS.push(colIdx('E') + i); // 5..39

/* 月份文案格：只在「导出月份 == 参考月份」时保留原文 */
const MONTH_TEXT = new Map();   // ref -> text
function addMonthText(rn, col, text) { if (text) MONTH_TEXT.set(col + rn, text); }

/* ---------- 逐行 / 逐格生成模板 ---------- */
const styleOf = {};             // CELL 整格替换用：ref -> attrs 里的 s
let personNames = [];

function emitCell(cell, rn) {
  const ci = colIdx(cell.col);
  const isPersonRow = rn >= PERSON_FIRST && rn <= PERSON_LAST;
  const isDayCol = DAY_COLS.includes(ci);
  const rest = cell.attrs.replace(/\s+t="[^"]*"/g, '');   // 去掉 t，我们要自己定

  /* --- A 列（序号）：整格替换，空行要写成 <c/> --- */
  if (isPersonRow && cell.col === 'A') {
    const s = (rest.match(/\bs="(\d+)"/) || [])[1] || '';
    styleOf[cell.ref] = rest.trim();
    return '{{CELL:' + cell.ref + '|' + s + '}}';
  }

  /* --- 人员行的 B..AM：文本位 --- */
  if (isPersonRow && ci >= 2 && ci <= 39) {
    if (ci === 4 && rn >= PERSON_FIRST) personNames.push(textOf(cell));
    return '<c r="' + cell.ref + '"' + rest + ' t="inlineStr"><is><t xml:space="preserve">{{T:' + cell.ref + '}}</t></is></c>';
  }

  /* --- 日期行（row 3 E..AM）：数字位 --- */
  if (rn === 3 && isDayCol) {
    return '<c r="' + cell.ref + '"' + rest + '><v>{{N:' + cell.ref + '}}</v></c>';
  }

  /* --- 人数统计（rows 102..107 E..AM）：数字位，由前端算好 --- */
  if (rn >= FROZEN_STATS[0] && rn <= FROZEN_STATS[1] && isDayCol) {
    return '<c r="' + cell.ref + '"' + rest + '><v>{{N:' + cell.ref + '}}</v></c>';
  }

  /* --- 标题 --- */
  if (cell.ref === 'B1') {
    return '<c r="B1"' + rest + ' t="inlineStr"><is><t xml:space="preserve">{{T:B1}}</t></is></c>';
  }

  /* --- 月份文案（B5 / row5 每天 / N6） --- */
  if (cell.ref === 'B5' || (rn === 5 && isDayCol) || cell.ref === 'N6') {
    const t = textOf(cell);
    if (t) MONTH_TEXT.set(cell.ref, t);
    return '<c r="' + cell.ref + '"' + rest + ' t="inlineStr"><is><t xml:space="preserve">{{M:' + cell.ref + '}}</t></is></c>';
  }

  /* --- 其余：rows >= 108 一律清空（参考表在这里是某月专属的备注/散数） --- */
  if (rn >= 108) return '<c r="' + cell.ref + '"' + rest + '/>';

  /* --- 静态格：文本搬进 inlineStr；公式保留但丢掉缓存值（workbook 里会 fullCalcOnLoad） --- */
  const hasF = /<f[\s>]/.test(cell.inner);
  if (hasF) {
    const f = /<f[\s\S]*?<\/f>|<f[^>]*\/>/.exec(cell.inner);
    return f ? '<c r="' + cell.ref + '"' + rest + '>' + f[0] + '</c>'
      : '<c r="' + cell.ref + '"' + rest + '/>';
  }
  const t = textOf(cell);
  if (t === null) {
    const v = /<v>([\s\S]*?)<\/v>/.exec(cell.inner);
    return v ? '<c r="' + cell.ref + '"' + rest + '><v>' + v[1] + '</v></c>'
      : '<c r="' + cell.ref + '"' + rest + '/>';
  }
  const si = sstTextInner(cell);
  return '<c r="' + cell.ref + '"' + rest + ' t="inlineStr"><is>' + si + '</is></c>';
}

function textOf(cell) {
  if (!/t="s"/.test(cell.attrs)) return null;
  const v = /<v>(\d+)<\/v>/.exec(cell.inner);
  return v && sst[Number(v[1])] ? sst[Number(v[1])].text : null;
}
function sstTextInner(cell) {
  const v = /<v>(\d+)<\/v>/.exec(cell.inner);
  const si = v && sst[Number(v[1])] ? sst[Number(v[1])].inner : '';
  return si || '<t></t>';
}

const outRows = [];
for (const row of rows) {
  const isPersonRow = row.rn >= PERSON_FIRST && row.rn <= PERSON_LAST;
  let inner = '';
  if (row.rn <= 164) {
    inner = cellsOf(row.inner).map((c) => emitCell(c, row.rn)).join('');
  }
  let tag = '<row' + row.attrs;
  if (isPersonRow) tag += '{{H:' + row.rn + '}}';
  outRows.push(tag + (inner ? '>' + inner + '</row>' : '/>'));
}

/* ---------- cols：日列拆成独立的 35 条，其余原样 ---------- */
const colsBlock = /<cols>([\s\S]*?)<\/cols>/.exec(prefix)[1];
const colDefs = [];
for (const m of colsBlock.matchAll(/<col\b([^>]*?)\/>/g)) {
  const a = m[1];
  const min = Number((a.match(/\bmin="(\d+)"/) || [])[1]);
  const max = Number((a.match(/\bmax="(\d+)"/) || [])[1]);
  const width = (a.match(/\bwidth="([^"]+)"/) || [])[1];
  const style = (a.match(/\bstyle="(\d+)"/) || [])[1];
  const hidden = /\bhidden="1"/.test(a);
  const custom = /\bcustomWidth="1"/.test(a);
  for (let c = min; c <= max; c++) colDefs.push({ c, width, style, hidden, custom });
}
colDefs.sort((a, b) => a.c - b.c);
const dayColDefs = colDefs.filter((d) => DAY_COLS.includes(d.c));
const otherCols = colDefs.filter((d) => !DAY_COLS.includes(d.c));

function colsXml(defs) {
  const out = [];
  for (let i = 0; i < defs.length; i++) {
    let j = i;
    while (j + 1 < defs.length
      && defs[j + 1].c === defs[j].c + 1
      && defs[j + 1].width === defs[j].width
      && defs[j + 1].style === defs[j].style
      && defs[j + 1].hidden === defs[j].hidden
      && defs[j + 1].custom === defs[j].custom) j++;
    const d0 = defs[i], d1 = defs[j];
    out.push('<col min="' + d0.c + '" max="' + d1.c + '" width="' + d0.width + '"' +
      (d0.style ? ' style="' + d0.style + '"' : '') + (d0.hidden ? ' hidden="1"' : '') +
      (d0.custom ? ' customWidth="1"' : '') + '/>');
    i = j;
  }
  return out.join('');
}

const leftCols = otherCols.filter((d) => d.c < DAY_COL_FIRST);
const rightCols = otherCols.filter((d) => d.c > DAY_COL_FIRST + DAY_COL_COUNT - 1);

/* ---------- 前缀：冻结点 / 选区改成「E7 起」，其余原样 ---------- */
let newPrefix = prefix
  .replace(/<pane[^>]*\/>/, '<pane xSplit="4" ySplit="6" topLeftCell="E7" activePane="bottomRight" state="frozen"/>')
  .replace(/<selection[\s\S]*?<\/sheetView>/, '<selection pane="bottomRight" activeCell="E7" sqref="E7"/></sheetView>')
  .replace(/<cols>[\s\S]*?<\/cols>/, '<cols>' + colsXml(leftCols) + '{{DAYCOLS}}' + colsXml(rightCols) + '</cols>');

/* ---------- 后缀：去掉引用了其它 sheet 的数据校验 ---------- */
let newSuffix = suffix.replace(
  /<dataValidation type="list"[^>]*sqref="U71[^"]*"[^>]*><formula1>Sheet2![^<]*<\/formula1><\/dataValidation>/,
  ''
).replace(/(<dataValidations count=")\d+(")/, '$14$2');

/* ---------- 写文件 ---------- */
fs.mkdirSync(OUT, { recursive: true });
const write = (name, text) => {
  fs.writeFileSync(path.join(OUT, name), text, 'utf8');
  console.log('  ' + name.padEnd(20) + (Buffer.byteLength(text) / 1024).toFixed(1) + ' KB');
};

write('sheet.xml', newPrefix + '<sheetData>' + outRows.join('') + '</sheetData>' + newSuffix);
write('styles.xml', stylesXml);
write('theme1.xml', themeXml);

write('workbook.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="9303"/>' +
  '<workbookPr codeName="ThisWorkbook"/>' +
  '<bookViews><workbookView windowWidth="27945" windowHeight="14055" activeTab="0"/></bookViews>' +
  '<sheets><sheet name="{{SHEET}}" sheetId="1" r:id="rId1"/></sheets>' +
  '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
  '</workbook>');

write('workbook-rels.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>' +
  '</Relationships>');

write('rels.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
  '</Relationships>');

write('content-types.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
  '</Types>');

write('app.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
  'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
  '<Application>Microsoft Excel</Application><DocSecurity>0</DocSecurity>' +
  '<ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate>' +
  '<SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged>' +
  '<AppVersion>16.0300</AppVersion></Properties>');

write('core.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
  'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
  '<dc:title>{{TITLE}}</dc:title><dc:creator>智能排班</dc:creator>' +
  '<cp:lastModifiedBy>智能排班</cp:lastModifiedBy></cp:coreProperties>');

/* ---------- meta ---------- */
const meta = {
  source: path.basename(REF),
  ym: '2026-10',
  sheetName: '10月班表',
  personFirst: PERSON_FIRST,
  personLast: PERSON_LAST,
  personCount: PERSON_LAST - PERSON_FIRST + 1,
  dayColFirst: DAY_COL_FIRST,
  dayColCount: DAY_COL_COUNT,
  dayCols: dayColDefs.map((d) => ({ col: d.c, width: d.width, style: d.style })),
  refNames: personNames,
  monthText: Object.fromEntries(MONTH_TEXT),
  stats: { frontFirst: 15, frontLast: 46, allFirst: 8, allLast: 92 },
  cellStyle: styleOf
};
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1), 'utf8');
console.log('  meta.json            ' + (fs.statSync(path.join(OUT, 'meta.json')).size / 1024).toFixed(1) + ' KB');
console.log('\n模板生成完成 -> ' + OUT);
console.log('人员行 ' + PERSON_FIRST + '..' + PERSON_LAST + '（' + personNames.length + ' 个姓名）');
console.log('日列 5..39 共 ' + dayColDefs.length + ' 列');
console.log('月份文案 ' + MONTH_TEXT.size + ' 格');
