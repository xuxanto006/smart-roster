/* 诊断：早班分得均不均、间隔匀不匀 —— 改评分前后对比用 */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const ROUNDS = +(process.argv[3] || 3);

const app = loadApp(FILE, 1);
const T = app.T, S = app.S;
resetConfig(S, T, []);
const DN = ["周一","周二","周三","周四","周五","周六","周日"];

let sumSpread = 0, sumGap = 0, sumMax = 0, sumMin = 7, rounds = 0;
for(let r = 0; r < ROUNDS; r++){
  S.schedule = {};
  T.autoSchedule();
  const k = T.curKey();
  const week = S.schedule[k] || {};
  const cnt = {};
  S.staff.forEach(n=>{
    const ds = [];
    for(let d = 0; d < 7; d++) if((week[n]||[])[d] === "early") ds.push(d);
    cnt[n] = ds;
  });
  const totalE = S.staff.reduce((s,n)=> s + cnt[n].length, 0);
  const avgE = totalE / S.staff.length;
  const spread = S.staff.reduce((s,n)=> s + Math.abs(cnt[n].length - avgE), 0);
  let gapBad = 0;
  S.staff.forEach(n=>{
    const ds = cnt[n];
    if(ds.length < 2) return;
    const ideal = 7 / ds.length;
    for(let i = 0; i < ds.length; i++){
      const nxt = ds[(i+1) % ds.length];
      const gap = i === ds.length-1 ? (7 - ds[i] + nxt) : (nxt - ds[i]);
      gapBad += Math.abs(gap - ideal);
    }
  });
  const counts = S.staff.map(n=> cnt[n].length);
  const mx = Math.max(...counts), mn = Math.min(...counts);
  sumSpread += spread; sumGap += gapBad; sumMax += mx; sumMin += mn; rounds++;
  console.log(`── 第 ${r+1} 轮 ── 早班总数 ${totalE}，人均 ${avgE.toFixed(2)}，极差 ${mn}~${mx}，次数偏离合计 ${spread.toFixed(1)}，间隔偏离合计 ${gapBad.toFixed(1)}`);
}

console.log(`\n平均：极差 ${(sumMin/rounds).toFixed(1)}~${(sumMax/rounds).toFixed(1)} ｜ 偏离合计 ${(sumSpread/rounds).toFixed(1)} ｜ 间隔偏离 ${(sumGap/rounds).toFixed(1)}`);

/* 早晚保障组那 4 个人的早班日 */
S.schedule = {};
T.autoSchedule();
const k = T.curKey();
const week = S.schedule[k] || {};
const mem = T.groupMembers("earlyNight");
console.log("\n早晚保障组早班分布：");
mem.forEach((n, i)=>{
  const ds = [];
  for(let d = 0; d < 7; d++) if((week[n]||[])[d] === "early") ds.push(DN[d]);
  console.log(`  ${n}：${ds.length ? ds.join("、") : "（本周无早班）"}   [相位建议 ${[0,2,4].map(x=>DN[(1+i+x)%7]).join("、")}]`);
});
/* 全班早班次数直方图 */
const hist = {};
S.staff.forEach(n=>{
  const c = [0,1,2,3,4,5,6].filter(d=> (week[n]||[])[d] === "early").length;
  hist[c] = (hist[c]||0) + 1;
});
console.log("\n全班早班次数分布（次: 人数）：", JSON.stringify(hist));
