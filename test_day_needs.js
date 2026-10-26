/* 需求按天拆分：周一~周五各自独立，周末两行一起改；早班按设定人数排（不多不少） */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";

let pass = 0, fail = 0;
const ok = (m, c, extra)=>{ c ? (pass++, console.log("  ✅ " + m)) : (fail++, console.log("  ❌ " + m + (extra ? "  " + extra : ""))); };

const app = loadApp(FILE, 1);
const T = app.T, S = app.S, els = app.els || {};
resetConfig(S, T, []);
const el = id => app.sandbox.document.getElementById(id);

console.log("══════ 需求按天拆分测试 ══════\n");

/* ① 单独改某一天，其它天不动 */
T.setDayNeed(2, "early", 6);
T.setDayNeed(2, "mid", 4);
ok("改周三早班 → needs[2].early = 6", S.needs[2].early === 6, String(S.needs[2].early));
ok("改周三中班 → needs[2].mid = 4",   S.needs[2].mid === 4,   String(S.needs[2].mid));
ok("周一早班不受影响（仍是 9）",        S.needs[0].early === 9, String(S.needs[0].early));
ok("周二早班不受影响（仍是 9）",        S.needs[1].early === 9, String(S.needs[1].early));
ok("周四中班不受影响（仍是 1）",        S.needs[3].mid === 1,   String(S.needs[3].mid));

/* ② 周六 / 周日各自独立（周末不再「同时生效」） */
T.setDayNeed(5, "early", 7);
T.setDayNeed(5, "mid", 2);
T.setDayNeed(5, "night", 11);
ok("周六早班 → 7",  S.needs[5].early === 7,  String(S.needs[5].early));
ok("周六中班 → 2",  S.needs[5].mid === 2,    String(S.needs[5].mid));
ok("周六晚班 → 11", S.needs[5].night === 11, String(S.needs[5].night));
ok("周日没被周六牵连（早班仍 9）", S.needs[6].early === 9, String(S.needs[6].early));
ok("周日没被周六牵连（中班仍 3）", S.needs[6].mid === 3,   String(S.needs[6].mid));
T.setDayNeed(6, "early", 6);
ok("单独改周日早班 → 6", S.needs[6].early === 6, String(S.needs[6].early));
ok("周六不被周日牵连（早班仍 7）", String(S.needs[5].early) === "7", String(S.needs[5].early));
ok("工作日不被周末改动波及（周三早班还是 6）", S.needs[2].early === 6, String(S.needs[2].early));
ok("周一早班仍是 9",   S.needs[0].early === 9, String(S.needs[0].early));

/* ③ 输入框与实际配置同步（周一~周五 15 个框） */
T.renderNeedsInfo();
let syncOk = true, bad = "";
for(let d = 0; d < 5; d++){
  const e = +el("wdE"+d).value, m = +el("wdM"+d).value, n = +el("wdN"+d).value;
  if(e !== S.needs[d].early || m !== S.needs[d].mid || n !== S.needs[d].night){
    syncOk = false; bad = `周${d+1}: 框(${e},${m},${n}) vs 配置(${S.needs[d].early},${S.needs[d].mid},${S.needs[d].night})`;
  }
}
ok("周一~周五 15 个输入框与配置一致", syncOk, bad);

/* ④ 排班真的按每天的人数来 */
resetConfig(S, T, []);
S.needs[0] = {early:5, mid:2, night:9};   // 周一
S.needs[3] = {early:9, mid:0, night:8};   // 周四
T.autoSchedule();
const w = T.ensureWeek(T.curKey());
const cnt = (d, sh)=> S.staff.filter(n=> w[n][d] === sh).length;
ok("周一早班恰好 5 人", cnt(0, "early") === 5, "实得 " + cnt(0, "early"));
ok("周一中班至少 2 人", cnt(0, "mid") >= 2,   "实得 " + cnt(0, "mid"));
ok("周一晚班至少 9 人", cnt(0, "night") >= 9, "实得 " + cnt(0, "night"));
ok("周四早班恰好 9 人", cnt(3, "early") === 9, "实得 " + cnt(3, "early"));
ok("周四中班可以为 0",  cnt(3, "mid") >= 0);
ok("周四晚班至少 8 人", cnt(3, "night") >= 8, "实得 " + cnt(3, "night"));

/* ⑤ 表里表头改完，顶部输入框跟着变 */
T.setDayNeed(0, "early", 4);
T.renderNeedsInfo();
ok("表头改周一早班 → 顶部周一框变成 4", +el("wdE0").value === 4, el("wdE0").value);

console.log(`\n===== 需求按天拆分测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
