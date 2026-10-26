/* 诊断：每天的开店 / 闭店名额排不出来，是贪心没排好，还是本来就不可能？
   判据：用「按天可用人数」和「按人可用天数」两个上界估一个可填上限，
   若上界 ≥ 需求而实际 short>0 → 贪心问题；若上界本身 < 需求 → 结构不可行。 */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const ROUNDS = +(process.argv[3] || 20);

const app = loadApp(FILE, 1);
const T = app.T, S = app.S;
resetConfig(S, T, []);

const oc = S.groups.openClose;
const members = oc.members;
const OPEN = oc.open, CLOSE = oc.close, MAXPER = oc.maxPerWeek;
const totalNeed = 7 * (OPEN + CLOSE);

let greedyFail = 0, reallyFail = 0, checked = 0;
const samples = [];

for(let r = 0; r < ROUNDS; r++){
  S.schedule = {};
  T.autoSchedule();
  const k = T.curKey();
  const w = S.schedule[k];
  const roles = S.roles[k] || {};
  let got = 0;
  members.forEach(n=>{ got += (roles[n]||[]).filter(x=>x==="open"||x==="close").length; });
  if(got >= totalNeed) continue;
  checked++;

  // 上界①：按天算 —— 每天最多能填 min(需求, 当天可用人数)
  let ubDay = 0;
  for(let d = 0; d < 7; d++){
    const e = members.filter(n=>w[n][d]==="early").length;
    const g = members.filter(n=>w[n][d]==="night").length;
    ubDay += Math.min(OPEN, e) + Math.min(CLOSE, g);
  }
  // 上界②：按人算 —— 每人最多 maxPer 个名额
  const ubMan = members.length * MAXPER;
  const ub = Math.min(ubDay, ubMan);

  if(ub >= totalNeed) greedyFail++; else reallyFail++;
  if(samples.length < 3) samples.push({r:r+1, got, totalNeed, ubDay, ubMan, ub});
}

console.log(`跑 ${ROUNDS} 轮：名额没排满 ${checked} 次`);
console.log(`  ├ 贪心没排好（上界够，实际没填满）：${greedyFail} 次`);
console.log(`  └ 结构不可行（上界本身就不够）：    ${reallyFail} 次`);
samples.forEach(s=>{
  console.log(`  样本 第${s.r}轮：实得 ${s.got}/${s.totalNeed} ｜ 按天上界 ${s.ubDay} ｜ 按人上界 ${s.ubMan} → 判定 ${s.ub>=s.totalNeed?"贪心不足":"不可行"}`);
});
