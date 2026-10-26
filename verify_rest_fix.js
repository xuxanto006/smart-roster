/* 验证「全队休息」假冲突已修复 */
const fs=require("fs"),vm=require("vm");
const {mulberry32}=require("./audit_core");
function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}

function boot(seed){
  const code=fs.readFileSync("app_merged.html","utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
  const els={};const rng=mulberry32(seed);let vc=1000;const RD=Date;
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
  const EX=["autoSchedule","curKey","ensureWeek","buildRules","renderHealth","schedRestStats","schedulableStaff","patchViolations"];
  vm.runInContext(code+`
;(()=>{const o={get state(){return state;}};
for(const n of ${JSON.stringify(EX)}){try{const v=eval(n);if(typeof v==="function"||typeof v==="object")o[n]=v;}catch(e){}}
try{Object.defineProperty(o,'LH',{get(){return eval('lastHealth');}});}catch(e){}
globalThis.__T=o;})();`,sb,{filename:"app"});
  return sb.__T;
}

let bad=0;
[1,2,3,7,42].forEach(seed=>{
  const T=boot(seed);
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey());
  const rs=T.schedRestStats(w);
  T.renderHealth(w, T.buildRules(T.curKey()));
  const errs=(T.LH&&T.LH.errs)||[];
  const restErr=errs.filter(e=>/全队休息/.test(e));
  const ok = restErr.length===0;
  if(!ok) bad++;
  console.log(`${ok?"✅":"❌"} seed ${String(seed).padStart(2)}｜可排班 ${rs.count} 人｜休息 ${rs.rest} 人日 / 上限 ${rs.cap}｜报冲突 ${errs.length} 条${restErr.length?"（含休息超限！）":""}`);
  if(errs.length) console.log("        " + errs.slice(0,3).join(" / "));
});
console.log(bad? `\n❌ ${bad} 个种子仍报假冲突` : "\n✅ 全部种子：刚排完班不再报「全队休息超上限」假冲突");
process.exit(bad?1:0);
