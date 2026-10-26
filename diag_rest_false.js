/* 定位「全队休息 310 人日 > 上限 160 人日」这个假冲突的来源 */
const fs=require("fs"),vm=require("vm");
const {mulberry32}=require("./audit_core");
function makeEl(){const cls=new Set();const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add:c=>cls.add(c),remove:c=>cls.delete(c),toggle(){},contains:c=>cls.has(c)},
 getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},addEventListener(){},removeEventListener(){},scrollIntoView(){},
 querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const html=fs.readFileSync("app_merged.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const els={};const rng=mulberry32(3);let vc=1000;const RD=Date;
function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
const M=Object.create(Math);M.random=rng;
const sb={document:{getElementById(id){if(!els[id])els[id]=makeEl();return els[id];},querySelectorAll(){return[]},querySelector(){return makeEl()},
 createElement(){return makeEl()},body:{appendChild(){},removeChild(){}},addEventListener(){},removeEventListener(){}},
 localStorage:{_s:null,getItem(){return this._s;},setItem(k,v){this._s=v;},removeItem(){this._s=null;}},
 console:{log(){},warn(){},error(){}},confirm:()=>true,alert(){},prompt:()=>"",
 setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},setInterval:()=>0,clearInterval(){},
 Math:M,Date:FD,JSON,Array,Object,String,Number,Set,Map,Boolean,isNaN,parseInt,parseFloat,
 performance:{now:()=>FD.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){},
 location:{protocol:"https:",href:"https://x.invalid/a.html"},fetch:()=>Promise.reject(new Error("no")),
 window:{addEventListener(){},removeEventListener(){},scrollTo(){}}};
sb.globalThis=sb;vm.createContext(sb);
const EX=["autoSchedule","curKey","ensureWeek","buildRules","renderHealth","schedulableStaff","isBlockedFromSchedule",
          "restTotalCap","isolatedRestCount","schedRestStats","patchViolations","getStaffProfile","DEFAULT_STAFF","isManager"];
vm.runInContext(code+`
;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};
for(const n of ${JSON.stringify(EX)}){try{const v=eval(n);if(typeof v==="function"||typeof v==="object")o[n]=v;}catch(e){}}
try{Object.defineProperty(o,'lastHealth',{get(){return eval('lastHealth');}});}catch(e){}
globalThis.__T=o;})();`,sb,{filename:"app"});
const T=sb.__T,S=sb.__T.state;

T.autoSchedule();
console.log("schedRestStats(排班后) =",JSON.stringify(T.schedRestStats(T.ensureWeek(T.curKey()))));
const k=T.curKey(),w=T.ensureWeek(k),R=T.buildRules(k);
const sched=T.schedulableStaff();
console.log("总人数:",S.staff.length," 可排班:",sched.length," 经理/免排:",S.staff.length-sched.length);
console.log("restMax:",JSON.stringify(S.restMax)," restTotalCap():",T.restTotalCap());

// 复刻 renderHealth 的 totalRest 统计
let allStaffRest=0, schedOnlyRest=0, blockedRest=0;
S.staff.forEach(n=>{
  const r=(w[n]||[]).filter(v=>v==="rest"||v==="").length;
  allStaffRest+=r;
  if(sched.includes(n)) schedOnlyRest+=r; else blockedRest+=r;
});
console.log("\n=== 休息人日统计 ===");
console.log("  全员口径(含被排除者):",allStaffRest);
console.log("  仅可排班人员:",schedOnlyRest);
console.log("  被排除人员贡献:",blockedRest,"("+(S.staff.length-sched.length)+" 人 × 7 =",(S.staff.length-sched.length)*7,")");

// 被排除人员的 week 行实际长什么样
const blocked=S.staff.filter(n=>!sched.includes(n)).slice(0,3);
console.log("\n=== 被排除人员样本 ===");
blocked.forEach(n=>console.log("  ",n,"level="+T.getStaffProfile(n).level,"week行=",JSON.stringify(w[n])));

T.renderHealth(w,R);
console.log("\n=== renderHealth 输出的 errs ===");
(T.lastHealth? T.lastHealth.errs : []).forEach(e=>console.log("  ✗",e));
console.log("=== warns ===");
(T.lastHealth? T.lastHealth.warns : []).slice(0,6).forEach(e=>console.log("  ⚠",e));
console.log("\n结论：上限",T.restTotalCap(),"｜全员口径",allStaffRest,"→",allStaffRest>T.restTotalCap()?"假冲突成立":"不成立");
console.log("      若只算可排班人员:",schedOnlyRest,"→",schedOnlyRest>T.restTotalCap()?"仍超":"通过 ✓");
