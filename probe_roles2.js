/* 深挖：开闭组名额排不满的那一周，到底是哪种结构性缺口。
   打印出每天的可用人数、每人每周可用于名额的天数（早+晚），以及「按人上界」。 */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const ROUNDS = +(process.argv[3] || 60);

const app = loadApp(FILE, 1);
const T = app.T, S = app.S;
resetConfig(S, T, []);
const oc = S.groups.openClose, members = oc.members;
const OPEN = oc.open, CLOSE = oc.close, MAXPER = oc.maxPerWeek;
const NEED = 7 * (OPEN + CLOSE);

let shown = 0;
for(let r = 0; r < ROUNDS && shown < 2; r++){
  S.schedule = {};
  T.autoSchedule();
  const k = T.curKey(), w = S.schedule[k], roles = S.roles[k] || {};
  let got = 0;
  members.forEach(n=>{ got += (roles[n]||[]).filter(x=>x==="open"||x==="close").length; });
  if(got >= NEED) continue;
  shown++;
  console.log(`\n──────── 第 ${r+1} 轮：实得 ${got}/${NEED} ────────`);
  console.log("每天该组在早 / 晚班的人数（需要 early≥1 / night≥2）：");
  for(let d = 0; d < 7; d++){
    const e = members.filter(n=>w[n][d]==="early");
    const g = members.filter(n=>w[n][d]==="night");
    console.log(`  周${d+1}  早 ${e.length} [${e.join(",")||"-"}]   晚 ${g.length} [${g.join(",")||"-"}]`);
  }
  console.log("每人本周「可担名额的天数」= 早班天数 + 晚班天数：");
  let ubMan = 0;
  members.forEach(n=>{
    let e = 0, g = 0;
    for(let d = 0; d < 7; d++){ if(w[n][d]==="early") e++; if(w[n][d]==="night") g++; }
    const av = e + g;
    ubMan += Math.min(MAXPER, av);
    const used = (roles[n]||[]).filter(x=>x==="open"||x==="close").length;
    console.log(`  ${n.padEnd(4,"　")} 早${e} 晚${g} → 可用名额天 ${av}，实际用了 ${used}`);
  });
  console.log(`按人上界 Σmin(${MAXPER}, 可用天数) = ${ubMan}（需求 ${NEED}）→ ${ubMan>=NEED?"上界够，仍是分配问题":"上界不够，结构不可行"}`);
}
if(!shown) console.log("没有失败样本");
