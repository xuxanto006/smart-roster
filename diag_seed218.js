/* 单 seed 深挖：为什么可排班的何广友整周为空？ */
const fs=require("fs"),vm=require("vm");
const {mulberry32}=require("./audit_core");
const SEED=+(process.argv[2]||218);
function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const code=fs.readFileSync("app_merged.html","utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const els={};let vc=1000;const RD=Date;
function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
const M=Object.create(Math);
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
          "isBlockedFromSchedule","getStaffProfile","isManager","toast","state"];
vm.runInContext(code+`
;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};
for(const n of ${JSON.stringify(EX)}){try{const v=eval(n);if(typeof v==="function"||typeof v==="object")o[n]=v;}catch(e){}}
globalThis.__T=o;})();`,sb,{filename:"app"});
const T=sb.__T,S=T.state;
const TYPES=["off","off","off","off","work","early","mid","night","noearly","nomid","nonight"];
let a=SEED*7919; const R2=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const rnd2=n=>Math.floor(R2()*n), pick=x=>x[rnd2(x.length)];

const N=4+rnd2(30);
S.staff=T.DEFAULT_STAFF.slice(0,Math.min(N,T.DEFAULT_STAFF.length));
while(S.staff.length<N) S.staff.push("临时"+S.staff.length);
const per=1+rnd2(3);
S.limits={early:1+rnd2(5),night:1+rnd2(5),mid:99};
S.restMax={per,total:rnd2(3)===0?per*S.staff.length+rnd2(5):0};
S.needs=[0,1,2,3,4,5,6].map(d=>{const b=Math.max(0,Math.round(S.staff.length*(d<5?0.3:0.34))-rnd2(4));return{early:b,mid:rnd2(3),night:Math.max(0,b+rnd2(4))};});
S.exactShifts=rnd2(4)?["early"]:[];
S.weekendEarlyMax=1+rnd2(3);
S.mustWork=rnd2(2)?[]:[{name:pick(S.staff),day:rnd2(7)},{name:pick(S.staff),day:rnd2(7)}];
const g1=S.staff.slice(0,Math.max(1,Math.floor(N/8))),g2=S.staff.slice(0,Math.min(N,2+rnd2(8)));
S.groups={earlyNight:{members:rnd2(4)?g1:[],minEarly:1,minNight:1},openClose:{members:rnd2(4)?g2:[],open:1+rnd2(2),close:1+rnd2(3),maxPerWeek:1+rnd2(5)}};
S.schedule={};S.roles={};S.roleSig={};S.manual={};S.requests=[];
const reqs=[];
for(let i=0;i<1+rnd2(4);i++){const q={name:pick(S.staff),day:rnd2(7),type:pick(TYPES)}; T.pushRequest(q.name,q.day,q.type,"once"); reqs.push(q);}

const target="何广友";
console.log("=== seed",SEED,"配置 ===");
console.log("N =",S.staff.length," limits =",JSON.stringify(S.limits)," restMax =",JSON.stringify(S.restMax));
console.log("needs[0] =",JSON.stringify(S.needs[0])," needs[5] =",JSON.stringify(S.needs[5]));
console.log("exactShifts =",JSON.stringify(S.exactShifts));
console.log("何广友 在名册:",S.staff.includes(target));
console.log("何广友 profile:",JSON.stringify(T.getStaffProfile(target)));
console.log("何广友 isManager:",T.isManager(target),"  isBlockedFromSchedule:",T.isBlockedFromSchedule(target));
console.log("可排班人数:",T.schedulableStaff().length,"/",S.staff.length);
console.log("关于何广友的安排:",JSON.stringify(reqs.filter(r=>r.name===target)));
console.log("mustWork:",JSON.stringify(S.mustWork));
console.log("earlyNight 组:",JSON.stringify(S.groups.earlyNight.members));
console.log("openClose 组:",JSON.stringify(S.groups.openClose.members));
console.log("\n=== 排班前 ===");
const k0=T.curKey();
console.log("week[何广友] =",JSON.stringify((S.schedule[k0]||{})[target]));

T.autoSchedule();
const k=T.curKey();
console.log("\n=== 排班后 ===");
console.log("week[何广友] =",JSON.stringify((S.schedule[k]||{})[target]));
console.log("他是否在 state.schedule 里:",!!S.schedule[k], " 该周 key:",k);
const filled=Object.entries(S.schedule[k]||{}).filter(([n,r])=>Array.isArray(r)&&r.some(v=>v&&v!==""));
console.log("该周被排上班的人数:",filled.length,"/",S.staff.length);
console.log("前 8 个有排班的人:",filled.slice(0,8).map(([n])=>n).join(","));
const R=T.buildRules(k);
console.log("\n何广友 规则(周1~周7):",JSON.stringify([0,1,2,3,4,5,6].map(d=>R[target]&&R[target][d]?{off:!!R[target][d].off,only:R[target][d].only||null,noOff:!!R[target][d].noOff}:null)));
