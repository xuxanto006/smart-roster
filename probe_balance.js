/* 诊断：早班 + 晚班 分得均不均 —— 改评分前后对比用 */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const ROUNDS = +(process.argv[3] || 3);

const app = loadApp(FILE, 1);
const T = app.T, S = app.S;
resetConfig(S, T, []);

for(let r = 0; r < ROUNDS; r++){
  S.schedule = {};
  T.autoSchedule();
  const k = T.curKey();
  const week = S.schedule[k] || {};
  const eHist = {}, nHist = {};
  let totalE = 0, totalN = 0, spreadE = 0, spreadN = 0;
  S.staff.forEach(n=>{
    let e = 0, nt = 0;
    for(let d = 0; d < 7; d++){ const v = (week[n]||[])[d]; if(v === "early") e++; if(v === "night") nt++; }
    totalE += e; totalN += nt;
    eHist[e] = (eHist[e]||0)+1; nHist[nt] = (nHist[nt]||0)+1;
  });
  const avgE = totalE / S.staff.length, avgN = totalN / S.staff.length;
  // 重新算 spread
  S.staff.forEach(n=>{
    let e=0, nt=0; for(let d=0;d<7;d++){ const v=(week[n]||[])[d]; if(v==="early") e++; if(v==="night") nt++; }
    spreadE += Math.abs(e-avgE); spreadN += Math.abs(nt-avgN);
  });
  console.log(`第 ${r+1} 轮  早班 ${totalE}(均 ${avgE.toFixed(2)}) 极差 ${Math.min(...Object.keys(eHist))}~${Math.max(...Object.keys(eHist))} 偏离 ${spreadE.toFixed(1)} 分布 ${JSON.stringify(eHist)}`);
  console.log(`        晚班 ${totalN}(均 ${avgN.toFixed(2)}) 极差 ${Math.min(...Object.keys(nHist))}~${Math.max(...Object.keys(nHist))} 偏离 ${spreadN.toFixed(1)} 分布 ${JSON.stringify(nHist)}`);
}

const DN = ["一","二","三","四","五","六","日"];
S.schedule = {}; T.autoSchedule();
const k = T.curKey();
const week = S.schedule[k] || {};
console.log("\n早晚保障组早/晚班分布：");
T.groupMembers("earlyNight").forEach(n=>{
  const es = [], ns = [];
  for(let d=0;d<7;d++){ const v=(week[n]||[])[d]; if(v==="early") es.push(DN[d]); if(v==="night") ns.push(DN[d]); }
  console.log(`  ${n}: 早 ${es.length?es.join("/"):"—"} (${es.length}) ｜ 晚 ${ns.length?ns.join("/"):"—"} (${ns.length})`);
});