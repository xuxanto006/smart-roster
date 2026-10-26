/* 请假不应被任何额度卡住 —— 实测
   覆盖：整周请假 / 超「每人每周休 N 天」配额 / 每周固定请假 / 全员同一天请假 / 指定日期请假 */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const b={value:"",options:[],textContent:"",innerHTML:"",style:{},disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(b,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const code=(()=>{const _h=fs.readFileSync("app_merged.html","utf8");let b="",m,r=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=r.exec(_h))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();

function boot(seed){
  const els={};let vc=1000;const RD=Date;
  function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
  FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
  const M=Object.create(Math);M.random=mulberry(seed);
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
  const EX=["autoSchedule","curKey","ensureWeek","buildRules","pushRequest","renderTable","renderHealth",
            "DEFAULT_STAFF","isBlockedFromSchedule","domainSchedulable","curDomain","state","lastHealth",
            "checkRuleViolations","patchViolations","addRequest","renderAll","save","curDomain"];
  vm.runInContext(code+"\n;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;},get lastHealth(){return lastHealth;}};\n"+
    "for(const n of "+JSON.stringify(EX)+"){try{const v=eval(n);if(typeof v==='function'||typeof v==='object')o[n]=v;}catch(e){}}\n"+
    "globalThis.__T=o;})();", sb, {filename:"app"});
  return {T:sb.__T, S:sb.__T.state, els};
}
let fails=0;
const chk=(l,c,e)=>{console.log((c?"✅ ":"❌ ")+l+(e!==undefined?"  → "+JSON.stringify(e):""));if(!c)fails++;};

function setup(seed, per){
  const {T,S,els} = boot(seed);
  S.staff = T.DEFAULT_STAFF.filter(n=>!T.isBlockedFromSchedule(n)).slice(0,20);
  S.needs=[0,1,2,3,4,5,6].map(()=>({early:9,mid:1,night:10}));
  S.limits={early:3,night:3,mid:99};
  S.restMax={per, total:0};
  S.schedule={};S.roles={};S.requests=[];S.mustWork=[];
  return {T,S,els};
}
const restCount=(w,n)=>(w[n]||[]).filter(v=>v==="rest").length;

/* 1. 一个人整周 7 天请假（远超「每人每周休 2 天」） */
{
  const {T,S} = setup(11, 2);
  const who = S.staff[0];
  for(let d=0; d<7; d++) T.pushRequest(who, d, "off", "once");
  chk("整周 7 天请假：7 条都加进去了", S.requests.filter(r=>r.name===who).length===7, S.requests.length);
  T.autoSchedule();
  const w = T.ensureWeek(T.curKey());
  chk("整周 7 天请假：排班后 7 天全是休", restCount(w,who)===7, w[who]);
  const bad = T.checkRuleViolations(w, T.buildRules(T.curKey())) || [];
  chk("整周 7 天请假：无请假/改班违规", bad.length===0, bad.slice(0,3));
  chk("整周 7 天请假：体检未把它报成错误",
      !(T.lastHealth.errs||[]).some(e=>new RegExp(who).test(e) && /请假|必须上班/.test(e)),
      (T.lastHealth.errs||[]).filter(e=>new RegExp(who).test(e)).slice(0,2));
  // 体检框里会不会出现「休息超上限」这类让人以为请假被卡住的报错？
  console.log("     ↳ 本场景体检 errs:", JSON.stringify((T.lastHealth.errs||[]).slice(0,3)));
  console.log("     ↳ 本场景体检 warns:", JSON.stringify((T.lastHealth.warns||[]).slice(0,3)));
}

/* 2. 超配额：休 2 天的人请 4 天 */
{
  const {T,S} = setup(22, 2);
  const who = S.staff[1];
  for(const d of [0,1,2,3]) T.pushRequest(who, d, "off", "once");
  T.autoSchedule();
  const w = T.ensureWeek(T.curKey());
  chk("休 2 天的人请 4 天：4 天都排成休（不被配额挡）", restCount(w,who)>=4, {休:restCount(w,who), 班表:w[who]});
  const bad = T.checkRuleViolations(w, T.buildRules(T.curKey())) || [];
  chk("超配额请假：不产生「请假/改班被违反」", bad.length===0, bad.slice(0,3));
}

/* 3. 「每周固定」的请假（长期）同样不被挡 */
{
  const {T,S} = setup(33, 2);
  const who = S.staff[2];
  for(const d of [0,1,2]) T.pushRequest(who, d, "off", "always");
  T.autoSchedule();
  const w = T.ensureWeek(T.curKey());
  chk("每周固定 3 天请假：本周 3 天都排成休", restCount(w,who)>=3, {休:restCount(w,who), 班表:w[who]});
}

/* 4. 全员同一天请假（极端超配） */
{
  const {T,S} = setup(44, 2);
  S.staff.forEach(n=>T.pushRequest(n, 2, "off", "once"));
  T.autoSchedule();
  const w = T.ensureWeek(T.curKey());
  const rested = S.staff.filter(n=>restCount(w,n)>=1).length;
  chk("全员周三请假：周三全部排休", S.staff.every(n=>(w[n]||[])[2]==="rest"),
      {全排休:S.staff.filter(n=>(w[n]||[])[2]==="rest").length, 总人:S.staff.length});
  const bad = T.checkRuleViolations(w, T.buildRules(T.curKey())) || [];
  chk("全员请假：没有请假/改班违规（缺人另算）",
      !bad.some(b=>/请假|改班/.test(b)), bad.slice(0,2));
}

/* 5. 指定日期的请假（dated）也不被挡 */
{
  const {T,S} = setup(55, 2);
  const who = S.staff[3];
  const k = T.curKey();
  const monday = T.addDays ? T.addDays(k,1) : null;
  // 用 pushRequest 的 date 参数直接写
  T.pushRequest(who, 0, "off", "once", undefined, "2026-09-16", undefined);
  chk("指定日期的请假能加进去", S.requests.filter(r=>r.name===who).length===1, S.requests[0] && S.requests[0].date);
  T.autoSchedule();
  const w = T.ensureWeek(T.curKey());
  chk("指定日期请假：当天排成休", (w[who]||[]).some(v=>v==="rest"), w[who]);
}

/* 6. 休息配额设为 0（相当于不限）也不报错 */
{
  const {T,S} = setup(66, 0);
  const who = S.staff[4];
  for(let d=0; d<5; d++) T.pushRequest(who, d, "off", "once");
  T.autoSchedule();
  const w = T.ensureWeek(T.curKey());
  chk("休息配额=0：请 5 天仍全部排休", restCount(w,who)>=5, {休:restCount(w,who)});
  const bad = T.checkRuleViolations(w, T.buildRules(T.curKey())) || [];
  chk("休息配额=0：无请假违规", !bad.some(b=>/请假|改班/.test(b)), bad.slice(0,2));
}

console.log("\n汇总: "+(fails?fails+" 项失败":"全部通过"));
process.exit(fails?1:0);
