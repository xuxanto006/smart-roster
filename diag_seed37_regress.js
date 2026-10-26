/* 对照实验：seed 37 的「必须上班未生效」是既有边界，还是今天排除人员（库房管理/李敏）造成的？
   做法：同一 seed，分别在「含今日排除」与「还原为今日之前」两种配置下跑。 */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}

const RAW = fs.readFileSync("app_merged.html","utf8");

function run(src, seed){
  const code=src.match(/<script>([\s\S]*?)<\/script>/)[1];
  const els={};let vc=1000;const RD=Date;
  function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
  FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
  const M=Object.create(Math);M.random=mulberry((seed^0x9e3779b9)>>>0);
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
  const EX=["autoSchedule","curKey","ensureWeek","buildRules","pushRequest","schedulableStaff","DEFAULT_STAFF"];
  vm.runInContext(code+"\n;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};\n"+
    "for(const n of "+JSON.stringify(EX)+"){try{const v=eval(n);if(typeof v==='function'||typeof v==='object')o[n]=v;}catch(e){}}\n"+
    "globalThis.__T=o;})();", sb, {filename:"app"});
  const T=sb.__T, S=sb.__T.state;
  // 复刻 hunt_locked 的配置生成（同一 seed → 同一配置）
  const TYPES=["off","off","off","off","work","early","mid","night","noearly","nomid","nonight"];
  const R=mulberry((seed*2654435761)>>>0);
  const rnd=n=>Math.floor(R()*n), pick=x=>x[rnd(x.length)];
  const N=4+rnd(30);
  S.staff=T.DEFAULT_STAFF.slice(0,Math.min(N,T.DEFAULT_STAFF.length));
  while(S.staff.length<N) S.staff.push("临时"+S.staff.length);
  const per=1+rnd(3);
  S.limits={early:1+rnd(5),night:1+rnd(5),mid:99};
  S.restMax={per,total:rnd(3)===0?per*S.staff.length+rnd(5):0};
  S.needs=[0,1,2,3,4,5,6].map(d=>{const b=Math.max(0,Math.round(S.staff.length*(d<5?0.3:0.34))-rnd(4));return{early:b,mid:rnd(3),night:Math.max(0,b+rnd(4))};});
  S.exactShifts=rnd(4)?["early"]:[];
  S.weekendEarlyMax=1+rnd(3);
  S.mustWork=rnd(2)?[]:[{name:pick(S.staff),day:rnd(7)},{name:pick(S.staff),day:rnd(7)}];
  const g1=S.staff.slice(0,Math.max(1,Math.floor(N/8))),g2=S.staff.slice(0,Math.min(N,2+rnd(8)));
  S.groups={earlyNight:{members:rnd(4)?g1:[],minEarly:1,minNight:1},openClose:{members:rnd(4)?g2:[],open:1+rnd(2),close:1+rnd(3),maxPerWeek:1+rnd(5)}};
  S.schedule={};S.roles={};S.roleSig={};S.manual={};S.requests=[];
  const reqs=[];
  const cnt=1+rnd(4);
  for(let i=0;i<cnt;i++) reqs.push({name:pick(S.staff),day:rnd(7),type:pick(TYPES)});
  reqs.forEach(q=>T.pushRequest(q.name,q.day,q.type,"once"));
  const schedN=T.schedulableStaff().length;
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey())||{}, R2=T.buildRules(T.curKey());
  const bad=[];
  const sched=new Set(T.schedulableStaff());
  for(const q of reqs){
    if(!sched.has(q.name)) continue;
    const v=(w[q.name]&&w[q.name][q.day])||"", c=R2[q.name]&&R2[q.name][q.day];
    if(!c) continue;
    if(c.noOff && !c.only && v==="rest") bad.push(`${q.name} 周${q.day+1} ${q.type} 必须上班→休息`);
  }
  return {可排班:schedN, 违反:bad};
}

const SEEDS=[37];
console.log("=== A. 当前版本（含今日排除：库房管理 + 李敏）===");
const A = SEEDS.map(s=>({s, ...run(RAW, s)}));
A.forEach(r=>console.log(`  seed ${r.s}｜可排班 ${r.可排班}｜违反 ${r.违反.length} ${JSON.stringify(r.违反)}`));

console.log("\n=== B. 还原为今日之前（去掉库房管理岗位排除 + 去掉李敏）===");
const OLD = RAW
  .replace('const EXCLUDE_POSITIONS = new Set(["库房管理"]);','const EXCLUDE_POSITIONS = new Set([]);')
  .replace('const EXCLUDE_SCHEDULE = new Set(["黎瑶","莫甄姗","杨乐乐","李敏"]);','const EXCLUDE_SCHEDULE = new Set(["黎瑶","莫甄姗","杨乐乐"]);');
const B = SEEDS.map(s=>({s, ...run(OLD, s)}));
B.forEach(r=>console.log(`  seed ${r.s}｜可排班 ${r.可排班}｜违反 ${r.违反.length} ${JSON.stringify(r.违反)}`));

console.log("\n=== 结论 ===");
A.forEach((a,i)=>{
  const b=B[i];
  if(a.违反.length===0) console.log(`  seed ${a.s}：当前版本无违反（旧版${b.违反.length?"有":"也无"}）→ 非回归`);
  else if(b.违反.length===0) console.log(`  seed ${a.s}：⚠️ 旧版无违反、当前有 → 疑似今日改动引入`);
  else console.log(`  seed ${a.s}：旧版也有 ${b.违反.length} 条 → 既有问题，非回归`);
});
