/* 算法对照：用本地 31 人花名册，且把所有人设为「可排班」（中性化 .host 的经理/模块排除），
   验证合并文件的调度内核 + 注入的均衡器是否仍 17/17、且公平性达标。 */
const {loadApp, resetConfig, auditOnce} = require("./audit_core.js");
const LOCAL = "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const local = loadApp(LOCAL, 1, {noDeadline:true});
const LOCAL_STAFF = local.T.DEFAULT_STAFF.slice();
console.log("本地标准花名册人数:", LOCAL_STAFF.length);

const HTML = process.env.APP_FILE || "app_merged.html";
const {T,S} = loadApp(HTML, 1, {noDeadline:true});
resetConfig(S,T);
S.staff = LOCAL_STAFF.slice();
// 中性化经理/模块排除：把 31 人全部设为可排班的正式员工，模拟「本地基线」无排除状态
S.staffProfiles = {};
LOCAL_STAFF.forEach(n=>{ S.staffProfiles[n] = {module:"通用组", position:"门店员工", level:"正式员工", tags:[]}; });
// 但保留分组身份（组定义已在 resetConfig 中写入）
T.autoSchedule();
const k = T.curKey(), w = T.ensureWeek(k);
console.log("排班后人数:", S.staff.length, " 班表键:", k);

const en = S.groups.earlyNight.members;
en.forEach(nm=>{
  const row = w[nm]||[];
  const isBlank = row.every(v=>!v||v==="");
  const e = row.filter(v=>v==="early").length, n = row.filter(v=>v==="night").length;
  console.log("  组["+nm+"] 早="+e+" 晚="+n+" 全空="+isBlank);
});

const {n,byRule} = auditOnce(T,S);
console.log("\n=== 17 规则体检（31人标准配置，可排班中性化）=== 违规合计:", n);
console.log(n===0 ? "  ✅ 全部零违规 (17/17)" : Object.entries(byRule).map(([r,c])=>"  ❌ "+r+": "+c).join("\n"));

function stat(arr){const N=arr.length,tot=arr.reduce((a,b)=>a+b,0),mean=tot/N;let dev=0,mn=Infinity,mx=-Infinity;arr.forEach(v=>{dev+=Math.abs(v-mean);mn=Math.min(mn,v);mx=Math.max(mx,v);});return{tot,mean,dev,mn,mx,spread:mx-mn};}
function theoryMin(tot,N,cap){if(tot>N*cap)return{feasible:false,min:0};if(tot===0)return{feasible:true,min:0};const r=tot%N;return{feasible:true,min:2*r*(N-r)/N};}
const early=[],night=[];
S.staff.forEach(nm=>{let e=0,nt=0;for(let d=0;d<7;d++){const v=w[nm][d];if(v==="early")e++;else if(v==="night")nt++;}early.push(e);night.push(nt);});
const e=stat(early),nt=stat(night);
const eT=theoryMin(e.tot,S.staff.length,3),nT=theoryMin(nt.tot,S.staff.length,3);
const eR=eT.min>0?+(e.dev/eT.min).toFixed(2):(e.dev===0?1:99);
const nR=nT.min>0?+(nt.dev/nT.min).toFixed(2):(nt.dev===0?1:99);
console.log("\n=== 公平性 ===");
console.log("早班: 总"+e.tot+" 偏差"+e.dev.toFixed(1)+"/理论"+eT.min.toFixed(1)+" 比值"+eR+" 极差"+e.spread);
console.log("晚班: 总"+nt.tot+" 偏差"+nt.dev.toFixed(1)+"/理论"+nT.min.toFixed(1)+" 比值"+nR+" 极差"+nt.spread);
console.log("上班天数:", JSON.stringify(stat(S.staff.map(nm=>{let c=0;for(let d=0;d<7;d++){const v=w[nm][d];if(v==="early"||v==="mid"||v==="night")c++;}return c;}))));
process.exit(0);
