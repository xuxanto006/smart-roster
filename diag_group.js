const {loadApp} = require("./audit_core.js");
const HTML = process.env.APP_FILE || "app_merged.html";
const {T, S} = loadApp(HTML, 1, {noDeadline:true});
T.autoSchedule();
const k = T.curKey(), w = T.ensureWeek(k);
console.log("名义人数:", S.staff.length, " 早期夜组原始成员:", JSON.stringify(S.groups.earlyNight && S.groups.earlyNight.members));
const en = S.groups.earlyNight.members;
en.forEach(nm=>{
  const row = w[nm]||[];
  const cnt = {early:0,mid:0,night:0,rest:0,blank:0};
  row.forEach(v=>{ if(!v) cnt.blank++; else cnt[v]=(cnt[v]||0)+1; });
  const isBlankWeek = row.every(v=>!v||v==="");
  console.log(`  ${nm}: early=${cnt.early} mid=${cnt.mid} night=${cnt.night} rest=${cnt.rest} blank=${cnt.blank} 全空周=${isBlankWeek}`);
});
console.log("\n逐日覆盖:");
for(let d=0; d<7; d++){
  const e = en.filter(x=>(w[x]||[])[d]==="early").length;
  const n = en.filter(x=>(w[x]||[])[d]==="night").length;
  console.log(`  day${d}: 早=${e} 晚=${n}`);
}
