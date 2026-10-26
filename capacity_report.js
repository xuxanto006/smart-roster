/* 排除人员后的真实容量体检：默认配置下，需求 vs 可排班容量还剩多少余量 */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
function boot(src){
  const code=src.match(/<script>([\s\S]*?)<\/script>/)[1];
  const els={};let vc=1000;const RD=Date;
  function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
  FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
  const M=Object.create(Math);M.random=mulberry(2024);
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
  const EX=["autoSchedule","curKey","ensureWeek","buildRules","renderHealth","schedulableStaff","getStaffProfile",
            "DEFAULT_STAFF","state"];
  vm.runInContext(code+"\n;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};\n"+
    "for(const n of "+JSON.stringify(EX)+"){try{const v=eval(n);if(typeof v==='function'||typeof v==='object')o[n]=v;}catch(e){}}\n"+
    "globalThis.__T=o;})();", sb, {filename:"app"});
  return sb.__T;
}
const RAW=fs.readFileSync("app_merged.html","utf8");
const OLD =RAW.replace('const EXCLUDE_POSITIONS = new Set(["库房管理"]);','const EXCLUDE_POSITIONS = new Set([]);')
              .replace('"杨乐乐","李敏"]','"杨乐乐"]');

function report(tag, src){
  const T=boot(src), S=T.state;
  const sched=T.schedulableStaff();
  const per=Math.min(7,Math.max(0,(S.restMax&&S.restMax.per)||2));
  const maxWork=7-per;
  const capDay=sched.length;             // 每天可上班人数
  const capWeek=capDay*maxWork;         // 全周可排班人次
  let needWeek=0; const perDay=[];
  S.needs.forEach(d=>{ const t=(+d.early||0)+(+d.mid||0)+(+d.night||0); needWeek+=t; perDay.push(t); });
  S.schedule={};S.roles={};S.requests=[];S.mustWork=[];
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey())||{};
  T.renderHealth(w, T.buildRules(T.curKey()));
  const errs=(T.LH&&T.LH.errs)||[];
  const short=errs.filter(e=>/缺/.test(e));
  console.log(`\n【${tag}】`);
  console.log(`  名册 ${S.staff.length} 人 → 可排班 ${sched.length} 人（每人最多上 ${maxWork} 天）`);
  console.log(`  全周需求 ${needWeek} 人次 ／ 全周容量 ${capWeek} 人次 → 余量 ${(capWeek-needWeek>=0?"+":"")}${capWeek-needWeek} 人次（${Math.round((capWeek-needWeek)/Math.max(1,needWeek)*100)}%）`);
  console.log(`  每日需求：${perDay.join(" / ")}`);
  console.log(`  排完班后体检冲突 ${errs.length} 条，其中缺人 ${short.length} 条`);
  if(errs.length) errs.slice(0,4).forEach(e=>console.log(`     · ${e}`));
  return {schedN:sched.length, needWeek, capWeek, errs:errs.length};
}
const A=report("当前版本（已排除 库房管理5人 + 李敏）", RAW);
const B=report("今日之前（都不排除）", OLD);
console.log("\n=== 对比 ===");
console.log(`  可排班：${B.schedN} → ${A.schedN}（-${B.schedN-A.schedN} 人）`);
console.log(`  全周容量：${B.capWeek} → ${A.capWeek} 人次`);
console.log(`  余量：${B.capWeek-B.needWeek} → ${A.capWeek-A.needWeek} 人次`);
console.log(`  体检冲突：${B.errs} → ${A.errs} 条`);
