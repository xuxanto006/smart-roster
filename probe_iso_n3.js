/* 诊断：晚班上限压到 3 之后出现的「上一休一」是怎么产生的
   —— 看那一周里所有人的休息日分布，以及 ISO 的人整行长什么样。 */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const N = +(process.argv[3] || 20);
const app = loadApp(FILE, 1);
const T = app.T, S = app.S;
resetConfig(S, T, []);
S.limits = {early:3, night:3, mid:99};        // 本次要验的配置

const D = ["一","二","三","四","五","六","日"];
const SH = {early:"早", mid:"中", night:"晚", rest:"休", "":"·"};
let isoTotal = 0, shown = 0;

for(let r = 0; r < N; r++){
  S.schedule = {};
  T.autoSchedule();
  const k = T.curKey(), w = S.schedule[k];
  const iso = [], restHist = {};
  S.staff.forEach(n=>{
    const rs = [0,1,2,3,4,5,6].filter(d=> w[n][d]==="rest" || !w[n][d]);
    rs.sort((a,b)=>a-b);
    restHist[rs.join("+")] = (restHist[rs.join("+")]||0)+1;
    if(rs.length===2){
      const gap = rs[1]-rs[0];
      if(gap === 2 || gap === 5) iso.push({n, rs, gap});      // 相隔一天 → 休-上-休（跨周同理）
    }
  });
  isoTotal += iso.length;
  if(iso.length && shown < 3){
    shown++;
    console.log(`\n──── 第 ${r+1} 轮：${iso.length} 人上一休一 ────`);
    console.log("休息日组合分布（前 8 种）： " + Object.entries(restHist).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k2,v])=>`${k2}×${v}`).join("  "));
    iso.slice(0,4).forEach(x=>{
      console.log(`  ${x.n.padEnd(4,"　")} 休 ${x.rs.map(d=>"周"+D[d]).join("/")}（相隔 ${x.gap} 天）  → ${w[x.n].map(v=>SH[v]||"?").join(" ")}`);
    });
  }
}
console.log(`\n${N} 轮共 ${isoTotal} 人次「上一休一」（平均 ${(isoTotal/N).toFixed(2)}/周）`);
