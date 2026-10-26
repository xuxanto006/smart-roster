/* 确定性猎手：锁定事项（请假 / 固定班 / 禁排 / 必须出勤）被违反时，完整 dump 出该轮配置。
   用 mulberry32 播种 → 同一个 seed 必得同一结果，可精确复现。
   目标文件：app_merged.html（当前程序，不是旧本地基线）。 */
const fs=require("fs"),vm=require("vm");
const {mulberry32}=require("./audit_core");
const FILE = process.argv[3] || "app_merged.html";
const ROUNDS = +(process.argv[2] || 400);

function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}

function boot(seed){
  const code=fs.readFileSync(FILE,"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
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
  const EX=["autoSchedule","renderAll","renderHealth","buildRules","curKey","ensureWeek","pushRequest",
            "DEFAULT_STAFF","schedulableStaff","isBlockedFromSchedule","getStaffProfile"];
  vm.runInContext(code+`
;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};
for(const n of ${JSON.stringify(EX)}){try{const v=eval(n);if(typeof v==="function"||typeof v==="object")o[n]=v;}catch(e){}}
globalThis.__T=o;})();`,sb,{filename:"app"});
  return sb.__T;
}

const TYPES=["off","off","off","off","work","early","mid","night","noearly","nomid","nonight"];
const NAME={early:"早",mid:"中",night:"晚",rest:"休","":"空"};
let checked=0; const viol=[];

for(let seed=1; seed<=ROUNDS; seed++){
  const T=boot(seed), S=T.state;
  const rnd=n=>Math.floor(rngLocal(seed,r)()*n);
  // 用独立 rng 便于复现
  function rngLocal(s,ctr){ let a=s+ctr*7919; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const R2=rngLocal(seed,0);
  const rnd2=n=>Math.floor(R2()*n);
  const pick=a=>a[rnd2(a.length)];

  const N=4+rnd2(30);
  S.staff=T.DEFAULT_STAFF.slice(0,Math.min(N,T.DEFAULT_STAFF.length));
  while(S.staff.length<N) S.staff.push("临时"+S.staff.length);
  const per=1+rnd2(3);
  S.limits={early:1+rnd2(5), night:1+rnd2(5), mid:99};
  S.restMax={per, total: rnd2(3)===0?per*S.staff.length+rnd2(5):0};
  S.needs=[0,1,2,3,4,5,6].map(d=>{ const b=Math.max(0,Math.round(S.staff.length*(d<5?0.3:0.34))-rnd2(4)); return {early:b,mid:rnd2(3),night:Math.max(0,b+rnd2(4))}; });
  S.exactShifts=rnd2(4)?["early"]:[];
  S.weekendEarlyMax=1+rnd2(3);
  S.mustWork=rnd2(2)?[]:[{name:pick(S.staff),day:rnd2(7)},{name:pick(S.staff),day:rnd2(7)}];
  const g1=S.staff.slice(0,Math.max(1,Math.floor(N/8))), g2=S.staff.slice(0,Math.min(N,2+rnd2(8)));
  S.groups={ earlyNight:{members:rnd2(4)?g1:[],minEarly:1,minNight:1},
             openClose:{members:rnd2(4)?g2:[],open:1+rnd2(2),close:1+rnd2(3),maxPerWeek:1+rnd2(5)} };
  S.schedule={};S.roles={};S.roleSig={};S.manual={};S.requests=[];
  for(let i=0;i<1+rnd2(4);i++) T.pushRequest(pick(S.staff),rnd2(7),pick(TYPES),"once");

  try{ T.autoSchedule(); }catch(e){ viol.push({seed,crash:e.message}); continue; }

  const k=T.curKey(), w=T.ensureWeek(k)||{}, R=T.buildRules(k);
  const schedSet=new Set(T.schedulableStaff());
  for(const q of (S.requests||[])){
    if(!schedSet.has(q.name)) continue;   // 不参与排班的人不适用
    checked++;
    const n=q.name,d=q.day,v=(w[n]&&w[n][d])||"",c=R[n]&&R[n][d];
    if(!c) continue;
    let why=null;
    if(c.off && v!=="rest") why=`应休息，实际「${NAME[v]}」`;
    else if(c.only && v!==c.only) why=`应固定${NAME[c.only]}，实际「${NAME[v]}」`;
    else if(c.ban && c.ban[v] && v) why=`禁排${NAME[v]}`;
    else if(c.noOff && !c.only && v==="rest") why=`必须上班，实际休息`;
    if(why) viol.push({seed,n,d,type:q.type,why,c:{off:!!c.off,only:c.only||null,noOff:!!c.noOff,ban:!!c.ban},v,
      row:(w[n]||[]).slice(), limits:{...S.limits}, restMax:{...S.restMax}, N,
      mustWork:S.mustWork, groups:{en:S.groups.earlyNight.members.length,oc:S.groups.openClose.members.length}});
  }
}
function rngLocal(){}

console.log(`目标: ${FILE}｜轮次 ${ROUNDS}｜校验锁定事项 ${checked} 条`);
console.log(`违反 ${viol.length} 条\n`);
const seen={};
viol.slice(0,12).forEach(v=>{
  if(v.crash){ console.log(`  seed ${v.seed} 崩溃: ${v.crash}`); return; }
  const key=v.why.replace(/「.*?」/,"");
  seen[key]=(seen[key]||0)+1;
  console.log(`  seed ${String(v.seed).padStart(3)}  ${v.n} 周${v.d+1}  type=${v.type}  ${v.why}`);
  console.log(`        规则={off:${v.c.off}, only:${v.c.only}, noOff:${v.c.noOff}, ban:${v.c.ban}}  实际格值=${JSON.stringify(v.v)}`);
  console.log(`        该人整周=${JSON.stringify(v.row)}`);
});
console.log("\n=== 按类型汇总 ===");
Object.entries(seen).forEach(([k,v])=>console.log(`  ${v}  ${k}`));
const seeds=[...new Set(viol.filter(v=>!v.crash).map(v=>v.seed))];
console.log(`\n可复现 seed: ${seeds.slice(0,20).join(", ")}${seeds.length>20?" …":""}`);
