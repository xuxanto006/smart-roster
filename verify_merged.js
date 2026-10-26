/* 合并文件验证（经理感知版）：排除经理(全空行)后做 17 规则体检 + 公平性量测 */
const {loadApp, auditOnce} = require("./audit_core.js");
const HTML = process.env.APP_FILE || "app_merged.html";
const {T, S} = loadApp(HTML, 1, {noDeadline:true});
console.log("✅ 加载成功，函数数:", Object.keys(T).length);
T.autoSchedule();
const k = T.curKey(), w = T.ensureWeek(k);
console.log("✅ autoSchedule 完成，班表键:", k, "名义人数:", S.staff.length);

// 标记经理 = 整周全空行
const isManager = nm => { for(let d=0;d<7;d++){ const v=w[nm][d]; if(v && v!=="") return false; } return true; };
const sched = S.staff.filter(nm=> !isManager(nm));
console.log("可排班人数:", sched.length, " 经理(全空)行数:", S.staff.length - sched.length);

// 临时把 state 收缩为可排班集合，并修剪分组成员，交给 auditOnce（避免把经理当违规）
const saveStaff = S.staff, saveGroups = S.groups;
S.staff = sched.slice();
S.groups = JSON.parse(JSON.stringify(saveGroups));
["earlyNight","openClose"].forEach(g=>{ if(S.groups[g]) S.groups[g].members = S.groups[g].members.filter(m=> sched.includes(m)); });

const {n, byRule} = auditOnce(T, S);
console.log("\n=== 17 规则体检（排除经理后）=== 违规合计:", n);
if(n===0) console.log("  ✅ 全部零违规");
else Object.entries(byRule).forEach(([r,c])=> console.log("  ❌", r, c));

// 还原 + 公平性
S.staff = saveStaff; S.groups = saveGroups;
function stat(arr){
  const N=arr.length, tot=arr.reduce((a,b)=>a+b,0), mean=tot/N;
  let dev=0,mn=Infinity,mx=-Infinity; arr.forEach(v=>{dev+=Math.abs(v-mean); mn=Math.min(mn,v); mx=Math.max(mx,v);});
  return {tot,mean,dev,mn,mx,spread:mx-mn};
}
function theoryMin(tot,N,cap){ if(tot>N*cap) return {feasible:false,min:0}; if(tot===0) return {feasible:true,min:0}; const r=tot%N; return {feasible:true,min:2*r*(N-r)/N}; }
const early=[], night=[];
sched.forEach(nm=>{ let e=0,nt=0; for(let d=0;d<7;d++){ const v=w[nm][d]; if(v==="early")e++; else if(v==="night")nt++; } early.push(e); night.push(nt); });
const e=stat(early), nt=stat(night);
const eT=theoryMin(e.tot,sched.length,3), nT=theoryMin(nt.tot,sched.length,3);
const eRatio=eT.min>0?+(e.dev/eT.min).toFixed(2):(e.dev===0?1:99);
const nRatio=nT.min>0?+(nt.dev/nT.min).toFixed(2):(nt.dev===0?1:99);
console.log("\n=== 公平性（排除经理）===");
console.log(`早班: 总${e.tot} 偏差${e.dev.toFixed(1)}/理论${eT.min.toFixed(1)} 比值${eRatio} 极差${e.spread}`);
console.log(`晚班: 总${nt.tot} 偏差${nt.dev.toFixed(1)}/理论${nT.min.toFixed(1)} 比值${nRatio} 极差${nt.spread}`);
console.log("每人上班天数分布:", JSON.stringify(stat(sched.map(nm=>{let c=0;for(let d=0;d<7;d++){const v=w[nm][d];if(v==="early"||v==="mid"||v==="night")c++;}return c;}))));
process.exit(0);
