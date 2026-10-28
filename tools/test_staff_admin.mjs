#!/usr/bin/env node
/**
 * 账号中心「人员」页的纯函数单测。
 * 从 _deploy/view-account.html 抽出 STAFFADMIN-BLOCK（不碰 DOM / 网络 / 会话）塞进 vm 跑：
 *   · cleanStaffDraft  —— 表单值 → 入库值（去空格、部门白名单、坏日期置空、截长度）
 *   · staffDraftError  —— 新增前拦空名 / 重名
 *   · roleAfterUnbind  —— 员工解绑后必须降为只读（否则他看不到任何班表）
 *   · bindSteps        —— 换绑 = 先解绑旧的、再绑新的
 * 用法：node tools/test_staff_admin.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', '_deploy', 'view-account.html'), 'utf8');

const m = /\/\* ===== STAFFADMIN-BLOCK-START =====[\s\S]*?\/\* ===== STAFFADMIN-BLOCK-END ===== \*\//.exec(html);
if (!m) {
  console.error('[FAIL] view-account.html 里找不到 STAFFADMIN-BLOCK 标记');
  process.exit(1);
}

const ctx = vm.createContext({});
vm.runInContext(
  m[0] +
    '\n;this.DOMAINS = DOMAINS;' +
    'this.domainText = domainText;' +
    'this.cleanStaffDraft = cleanStaffDraft;' +
    'this.staffDraftError = staffDraftError;' +
    'this.roleAfterUnbind = roleAfterUnbind;' +
    'this.bindSteps = bindSteps;',
  ctx,
);
const { DOMAINS, domainText, cleanStaffDraft, staffDraftError, roleAfterUnbind, bindSteps } = ctx;

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (got === undefined ? '' : '   → ' + JSON.stringify(got))); }
}

console.log('DOMAINS · 部门白名单');
check('七个部门，和 001 的 check 约束一致', DOMAINS.map((x) => x[0]).join(',') === '3c,hongmeng,zunjie,aftersales,kufang,admin,manager', DOMAINS);
check('domainText 已知部门显示中文', domainText('hongmeng') === '鸿蒙', domainText('hongmeng'));
check('domainText 未知部门原样显示', domainText('xyz') === 'xyz');
check('domainText 空值有兜底', domainText('') === '未分部门' && domainText(null) === '未分部门');

console.log('\ncleanStaffDraft · 清洗');
const d1 = cleanStaffDraft({
  name: '  张三  ', module: ' 前台 ', position: ' 销售 ', level: ' ', domain: 'hongmeng',
  joined_at: '2026-10-01', note: ' 新人 '
});
check('姓名去空格', d1.name === '张三', d1.name);
check('模块 / 岗位去空格', d1.module === '前台' && d1.position === '销售', d1);
check('职级留空回落到「员工」', d1.level === '员工', d1.level);
check('合法部门保留', d1.domain === 'hongmeng', d1.domain);
check('合法入职日期保留', d1.joined_at === '2026-10-01', d1.joined_at);
check('备注去空格', d1.note === '新人', d1.note);

const d2 = cleanStaffDraft({ name: '李四', domain: 'bogus', joined_at: '2026/10/28' });
check('非法部门回落 3c', d2.domain === '3c', d2.domain);
check('斜杠日期置空（date 输入框只认 yyyy-mm-dd）', d2.joined_at === '', d2.joined_at);

const d3 = cleanStaffDraft(null);
check('空表单不炸，字段都有值', d3.name === '' && d3.level === '员工' && d3.domain === '3c', d3);
check('空表单备注是空串', d3.note === '', d3.note);

const d4 = cleanStaffDraft({ name: 'x'.repeat(60), note: 'y'.repeat(300) });
check('姓名截到 40', d4.name.length === 40, d4.name.length);
check('备注截到 200', d4.note.length === 200, d4.note.length);

console.log('\nstaffDraftError · 提交前拦截');
check('空姓名拦住', staffDraftError(cleanStaffDraft({}), { isNew: true, names: [] }) === '请填写姓名');
check('新增重名拦住', /已经有/.test(staffDraftError({ name: '张三' }, { isNew: true, names: ['张三'] })));
check('编辑自己同名不拦（isNew=false）', staffDraftError({ name: '张三' }, { isNew: false, names: ['张三'] }) === '');
check('新增不重名放行', staffDraftError({ name: '王五' }, { isNew: true, names: ['张三'] }) === '');

console.log('\nroleAfterUnbind · 解绑后的角色');
check('员工 → 只读', roleAfterUnbind('employee') === 'viewer', roleAfterUnbind('employee'));
check('只读 → 只读', roleAfterUnbind('viewer') === 'viewer');
check('经理 → 经理（不当场撤权）', roleAfterUnbind('manager') === 'manager');
check('缺角色时兜到员工（后端不再二次降级）', roleAfterUnbind('') === 'employee');

console.log('\nbindSteps · 绑定 / 换绑 / 解绑');
const s1 = bindSteps({ staff_name: '张三' }, 'acct-a', 'employee');
check('没绑过：一步绑上', s1.length === 1 && s1[0].op === 'bind' && s1[0].id === 'acct-a' && s1[0].staff_name === '张三', s1);
check('绑定时带角色', s1[0].role === 'employee', s1[0]);

const s2 = bindSteps({ id: 'acct-a', username: 'zhangsan', staff_name: '张三' }, 'acct-a', 'viewer');
check('同一个人只改角色：一步（不会先解绑自己）', s2.length === 1 && s2[0].op === 'bind' && s2[0].role === 'viewer', s2);

const s3 = bindSteps({ id: 'acct-a', username: 'zhangsan', staff_name: '张三' }, 'acct-b', 'employee');
check('换账号：先解绑旧的一步', s3.length === 2 && s3[0].op === 'unbind' && s3[0].id === 'acct-a', s3);
check('换账号：再绑新的（带员工名）', s3[1].op === 'bind' && s3[1].id === 'acct-b' && s3[1].staff_name === '张三', s3[1]);

const s4 = bindSteps({ id: 'acct-a', staff_name: '张三' }, '', 'employee');
check('选「先不绑定」：只解绑', s4.length === 1 && s4[0].op === 'unbind', s4);

const s5 = bindSteps({ staff_name: '张三' }, '', 'employee');
check('本来没绑也不想绑：什么都不做', s5.length === 0, s5);

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
