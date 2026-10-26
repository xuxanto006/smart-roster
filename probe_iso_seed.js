/* 可复现地找出「上一休一」：用 audit_core 的可播种随机源扫 seed，
   命中就把那个人的整周、当天的休息人数分布、以及涉及的那两天的班次情况打出来。
   用法：node probe_iso_seed.js [文件] [seed起] [seed止] [night上限] */
const {loadApp, resetConfig, auditOnce} = require("./audit_core.js");
const NO_DL = process.env.NODL === "1";        // NODL=1：把 2500ms 预算换成近乎无限，看是否只是「预算不够」
const FILE  = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const S0    = +(process.argv[3] || 1);
const S1    = +(process.argv[4] || 200);
const NIGHT = +(process.argv[5] || 3);
const EARLY = +(process.env.EARLY || 9);   // audit_env.js 用的是 8，默认配置是 9

const D  = ["一","二","三","四","五","六","日"];
const SH = {early:"早", mid:"中", night:"晚", rest:"休", "":"·"};

let bad = 0, shown = 0;
const hits = [];
for(let seed = S0; seed <= S1; seed++){
  const {T, S} = loadApp(FILE, seed);
  resetConfig(S, T);
  S.limits = {early:3, night:NIGHT, mid:99};
  [0,1,2,3,4].forEach(d=>S.needs[d].early = EARLY);
  T.autoSchedule();
  const k = T.curKey(), w = T.ensureWeek(k);
  T.assignRoles(k);
  const res = auditOnce(T, S);
  const n7 = (res.byRule["7a.上一休一(输入层不可避免)"]||0) + (res.byRule["7b.上一休一(可避免)"]||0);
  if(n7 === 0) continue;
  bad++;
  hits.push({seed, r:res, w, k, S, T});
  if(shown >= 4) continue;
  shown++;
  // 每天休息人数 / 每天早班人数
  const perDayRest = [0,1,2,3,4,5,6].map(d=>S.staff.filter(n=>w[n][d]==="rest"||!w[n][d]).length);
  const perDayE    = [0,1,2,3,4,5,6].map(d=>S.staff.filter(n=>w[n][d]==="early").length);
  const perDayN    = [0,1,2,3,4,5,6].map(d=>S.staff.filter(n=>w[n][d]==="night").length);
  console.log(`\n════════ seed ${seed} ｜ 7a=${res.byRule["7a.上一休一(输入层不可避免)"]||0} 7b=${res.byRule["7b.上一休一(可避免)"]||0} ｜ 总违规 ${res.n} ════════`);
  console.log("  日期     " + D.map(d=>"周"+d).join("   "));
  console.log("  休人数   " + perDayRest.map(v=>String(v).padStart(2," ")).join("   "));
  console.log("  早人数   " + perDayE.map(v=>String(v).padStart(2," ")).join("   ") + "   (需求 " + S.needs.map(x=>x.early).join("/") + ")");
  console.log("  晚人数   " + perDayN.map(v=>String(v).padStart(2," ")).join("   ") + "   (需求 " + S.needs.map(x=>x.night).join("/") + ")");
  S.staff.forEach(n=>{
    const s = new Set(); [0,1,2,3,4,5,6].forEach(d=>{ if(w[n][d]==="rest"||!w[n][d]) s.add(d); });
    if(T.isolatedRestCount(s) === 0) return;
    const cnt = {early:0,mid:0,night:0,rest:0};
    w[n].forEach(v=>cnt[v] = (cnt[v]||0)+1);
    console.log(`  ⚠ ${n}  休 ${[...s].sort().join(",")}（相距 2）  ${w[n].map(v=>SH[v]||"?").join("  ")}   早${cnt.early} 晚${cnt.night}`);
  });
  // 顺带把当天其他规则违规也列出来，判断是不是伴生
  Object.keys(res.byRule).filter(x=>!x.startsWith("7")).forEach(x=>{
    console.log(`    伴生违规 ${x}：${res.byRule[x]} 次`);
  });
}
console.log(`\nseed ${S0}~${S1}（${S1-S0+1} 个）共 ${bad} 个出现上一休一，命中率 ${(bad/(S1-S0+1)*100).toFixed(1)}%`);
