#!/usr/bin/env node
/**
 * 排班工作台「三种看法」的纯函数单测。
 * 从 _deploy/manager.html 抽出 MGRVIEW-BLOCK（不碰 DOM / 网络）塞进 vm 跑：
 *   · mgrDayIdx(weekYmd, now)  —— 这一周里「今天」是第几天；不在本周回周一
 *   · miniBtns(cur, disabled)  —— 班次快捷按钮，顺序/高亮/禁用
 * 用法：node tools/test_manager_views.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', '_deploy', 'manager.html'), 'utf8');

const START = '/* ===== MGRVIEW-BLOCK-START ===== */'.replace(' */', '*/');
const m = /\/\* ===== MGRVIEW-BLOCK-START =====[\s\S]*?\/\* ===== MGRVIEW-BLOCK-END ===== \*\//.exec(html);
if (!m) {
  console.error('[FAIL] manager.html 里找不到 MGRVIEW-BLOCK 标记');
  process.exit(1);
}

const ctx = vm.createContext({});
vm.runInContext(m[0] + '\n;this.mgrDayIdx = mgrDayIdx; this.miniBtns = miniBtns;' +
  'this.MINI_ORDER = MINI_ORDER;', ctx);

const { mgrDayIdx, miniBtns, MINI_ORDER } = ctx;

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (got === undefined ? '' : '   → ' + JSON.stringify(got))); }
}

console.log('mgrDayIdx · 本周内定位');
check('周一', mgrDayIdx('2026-10-26', new Date(2026, 9, 26)) === 0, mgrDayIdx('2026-10-26', new Date(2026, 9, 26)));
check('周三', mgrDayIdx('2026-10-26', new Date(2026, 9, 28)) === 2, mgrDayIdx('2026-10-26', new Date(2026, 9, 28)));
check('周日', mgrDayIdx('2026-10-26', new Date(2026, 10, 1)) === 6, mgrDayIdx('2026-10-26', new Date(2026, 10, 1)));
check('带时分秒也按「天」算', mgrDayIdx('2026-10-26', new Date(2026, 9, 29, 23, 59, 59)) === 3);

console.log('\nmgrDayIdx · 不在本周');
check('上周 → 回周一', mgrDayIdx('2026-10-26', new Date(2026, 9, 25)) === 0);
check('下周 → 回周一', mgrDayIdx('2026-10-26', new Date(2026, 10, 2)) === 0);
check('跨月：下周三也算不在本周', mgrDayIdx('2026-10-26', new Date(2026, 10, 4)) === 0);
check('空周（还没载入）→ 0', mgrDayIdx('', new Date()) === 0);
check('坏串 → 0', mgrDayIdx('abc', new Date()) === 0);
check('跨年周 12/28 的周四', mgrDayIdx('2026-12-28', new Date(2026, 11, 31)) === 3);

console.log('\nminiBtns · 顺序与标签');
const b0 = miniBtns('', false);
check('五个按钮：早/中/晚/休/清', MINI_ORDER.map((x) => x[1]).join('') === '早中晚休清', MINI_ORDER);
check('data-slot 依次 early/mid/night/rest/空', /data-slot="early"[\s\S]*data-slot="mid"[\s\S]*data-slot="night"[\s\S]*data-slot="rest"[\s\S]*data-slot=""/.test(b0));
check('空班次：高亮落在「清」上（表示这天还没排）', (b0.match(/ on"/g) || []).length === 1 && /class="s-none on"/.test(b0), b0);
check('未禁用时不出现 disabled', b0.indexOf('disabled') < 0, b0);

console.log('\nminiBtns · 高亮与禁用');
const bn = miniBtns('night', false);
check('晚班高亮，且只有它高亮', (bn.match(/ on"/g) || []).length === 1 && /class="s-night on"/.test(bn), bn);
check('高亮时带 s-night 色块类（能吃上班次配色）', /class="s-night on"/.test(bn));
const br = miniBtns('rest', true);
check('休息高亮', /class="s-rest on"/.test(br), br);
check('禁用时每个按钮都 disabled', (br.match(/disabled/g) || []).length === 5, (br.match(/disabled/g) || []).length);
check('清空按钮用 s-none 类', /data-slot="" class="s-none/.test(b0), b0);

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
