const {loadApp, resetConfig, auditOnce} = require("./audit_core.js");
const file = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const {T,S} = loadApp(file, 1, {noDeadline:true});
resetConfig(S,T);
T.autoSchedule();
const k = T.curKey(), w = T.ensureWeek(k);
console.log("[", file.split("/").pop(), "] 人数:", S.staff.length, " 班表键:", k);
const en = S.groups.earlyNight.members;
en.forEach(nm=>{
  const row = w[nm]||[];
  const isBlank = row.every(v=>!v||v==="");
  const e = row.filter(v=>v==="early").length, n = row.filter(v=>v==="night").length;
  console.log("  组["+nm+"] 早="+e+" 晚="+n+" 全空="+isBlank);
});
const {n,byRule} = auditOnce(T,S);
console.log("=== 17 规则体检 === 违规合计:", n);
console.log(n===0 ? "  ✅ 全部零违规 (17/17)" : Object.entries(byRule).map(([r,c])=>"  ❌ "+r+": "+c).join("\n"));
