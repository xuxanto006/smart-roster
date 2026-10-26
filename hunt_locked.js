/* 锁定事项优先级猎手（确定性）
   规则：当算法与其他约束冲突时，「请假 / 固定班 / 禁排 / 必须出勤」必须优先满足。
   本脚本：同一进程内生成配置 → 排班 → 校验 → 命中即完整下钻，避免跨脚本 RNG 不一致。 */
const fs=require("fs"),vm=require("vm");
const FILE="app_merged.html";
const ROUNDS=+(process.argv[2]||300);
const TYPES=["off","off","off","off","work","early","mid","night","noearly","nomid","nonight"];
const NAME={early:"早",mid:"中",night:"晚",rest:"休","":"空"};

function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}

function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}

function boot(seed, seed2){
  const code=fs.readFileSync(FILE,"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
  const els={};let vc=1000;const RD=Date;
  function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
  FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
  const M=Object.create(Math);M.random=mulberry((seed2>>>0)^0x9e3779b9);   // 排班内部随机也可复现
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
  const EX=["autoSchedule","curKey","ensureWeek","buildRules","pushRequest","DEFAULT_STAFF","schedulableStaff",
            "isBlockedFromSchedule","getStaffProfile","isManager","restSetOfWeek","isolatedRestCount"];
  vm.runInContext(code+`
;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};
for(const n of ${JSON.stringify(EX)}){try{const v=eval(n);if(typeof v==="function"||typeof v==="object")o[n]=v;}catch(e){}}
globalThis.__T=o;})();`,sb,{filename:"app"});
  return sb.__T;
}
function genConfig(T,S,seed){
  const R=mulberry(seed*2654435761>>>0);
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
  for(let i=0;i<cnt;i++){const q={name:pick(S.staff),day:rnd(7),type:pick(TYPES)};reqs.push(q);}
  return reqs;
}

let checked=0; const viol=[];
for(let seed=1;seed<=ROUNDS;seed++){
  const T=boot(seed,seed),S=T.state;
  const reqs=genConfig(T,S,seed);
  reqs.forEach(q=>T.pushRequest(q.name,q.day,q.type,"once"));
  let crash=null;
  try{ T.autoSchedule(); }catch(e){ crash=e.message; }
  if(crash){ viol.push({seed,crash}); continue; }
  const k=T.curKey(),w=T.ensureWeek(k)||{},R=T.buildRules(k);
  const sched=new Set(T.schedulableStaff());
  for(const q of reqs){
    if(!sched.has(q.name)) continue;
    checked++;
    const n=q.name,d=q.day,v=(w[n]&&w[n][d])||"",c=R[n]&&R[n][d];
    if(!c) continue;
    let why=null;
    if(c.off&&v!=="rest") why=`应休息，实际「${NAME[v]}」`;
    else if(c.only&&v!==c.only) why=`应固定${NAME[c.only]}，实际「${NAME[v]}」`;
    else if(c.ban&&c.ban[v]&&v) why=`禁排${NAME[v]}`;
    else if(c.noOff&&!c.only&&v==="rest") why=`必须上班，实际休息`;
    if(why) viol.push({seed,n,d,type:q.type,why,sc:sched.size,
      rule:{off:!!c.off,only:c.only||null,noOff:!!c.noOff,ban:c.ban?Object.keys(c.ban):null},
      v, row:(w[n]||[]).slice(), allReqs:reqs, limits:S.limits, restMax:S.restMax, N:S.staff.length,
      schedCount:sched.size, mustWork:S.mustWork, en:S.groups.earlyNight, oc:S.groups.openClose,
      prof:T.getStaffProfile(n), needs:S.needs});
  }
}
console.log(`目标 ${FILE}｜${ROUNDS} 轮｜校验锁定事项 ${checked} 条｜违反 ${viol.length} 条`);
const byType={};
viol.filter(v=>!v.crash).forEach(v=>{const kk=v.why.replace(/「[^」]*」/g,"");byType[kk]=(byType[kk]||0)+1;});
console.log("\n=== 按类型 ===");
Object.entries(byType).forEach(([k,v])=>console.log(`  ${v}  ${k}`));
const first=viol.find(v=>!v.crash);
if(first){
  console.log(`\n=== 首个命中详情（seed ${first.seed}）===\n`);
  console.log(`  ${first.n}（${first.prof.module}/${first.prof.position}）周${first.d+1}  type=${first.type}`);
  console.log(`  规则: ${JSON.stringify(first.rule)}`);
  console.log(`  应得: ${first.why}`);
  console.log(`  实得: ${JSON.stringify(first.v)}`);
  console.log(`  整周: ${JSON.stringify(first.row)}`);
  console.log(`  名册 ${first.N} 人，可排班 ${first.schedCount} 人，limits=${JSON.stringify(first.limits)} restMax=${JSON.stringify(first.restMax)}`);
  console.log(`  earlyNight 组 ${first.en.members.length} 人 (min早${first.en.minEarly}/min晚${first.en.minNight})`);
  console.log(`  openClose 组 ${first.oc.members.length} 人 (开${first.oc.open}/闭${first.oc.close}/上限${first.oc.maxPerWeek})`);
  console.log(`  mustWork: ${JSON.stringify(first.mustWork)}`);
  console.log(`  全部安排: ${JSON.stringify(first.allReqs)}`);
  console.log(`  needs: ${JSON.stringify(first.needs)}`);
}
console.log(`\n可复现 seed: ${[...new Set(viol.filter(v=>!v.crash).map(v=>v.seed))].slice(0,25).join(", ")}`);
process.exit(viol.length?1:0);
