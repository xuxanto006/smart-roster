/** 压力验证：N 次排班，检查「周一 陈悦娴/张淑慧 必须上班」及其它硬约束 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
S.staff=T.DEFAULT_STAFF.slice();
S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
const N=+(process.argv[2]||200);
let mwBad=0, isoBad=0, restBad=0, grpBad=0, ruleBad=0;
const t0=Date.now();
for(let i=0;i<N;i++){
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey());
  const R=T.buildRules(T.curKey());
  // ① 固定上班日
  ["陈悦娴","张淑慧"].forEach(function(n){ if(w[n][0]==="rest"||!w[n][0]) mwBad++; });
  // ② 请假/改班规则
  ruleBad += T.checkRuleViolations(w,R).length;
  // ③ 上一休一
  S.staff.forEach(function(n){
    var s=new Set();
    for(var d=0;d<7;d++) if(w[n][d]==="rest"||!w[n][d]) s.add(d);
    isoBad+=T.isolatedRestCount(s);
  });
  // ④ 每人休 2 天
  S.staff.forEach(function(n){ if(w[n].filter(function(v){return v==="rest";}).length!==2) restBad++; });
  // ⑤ 分组保障
  for(var d=0;d<7;d++){
    var en=T.groupMembers("earlyNight"), oc=T.groupMembers("openClose");
    if(en.filter(function(n){return w[n][d]==="early";}).length<1) grpBad++;
    if(en.filter(function(n){return w[n][d]==="night";}).length<1) grpBad++;
    if(oc.filter(function(n){return w[n][d]==="early";}).length<1) grpBad++;
    if(oc.filter(function(n){return w[n][d]==="night";}).length<2) grpBad++;
  }
}
console.log("排班 " + N + " 次 ｜ 平均 " + Math.round((Date.now()-t0)/N) + "ms");
console.log("  固定上班日被违反：" + mwBad + " 次  " + (mwBad?"❌":"✅"));
console.log("  请假/改班违约格：" + ruleBad + " 个  " + (ruleBad?"❌":"✅"));
console.log("  上一休一：" + isoBad + " 处  " + (isoBad?"❌":"✅"));
console.log("  休息天数不对：" + restBad + " 人次  " + (restBad?"❌":"✅"));
console.log("  分组保障缺口：" + grpBad + " 处  " + (grpBad?"❌":"✅"));
