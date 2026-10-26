const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},click(){},appendChild(){},_tm:null};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"globalThis.__T={get state(){return state},autoSchedule,buildRules,checkRuleViolations,ensureWeek,curKey,activeRequests,SHIFT_NAMES,DAY_NAMES,repatchWeek};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,k=T.curKey();
function pad(i){return String(i).padStart(2,"0");}
function reset(n){S.staff=Array.from({length:n},(_,i)=>"员工"+pad(i+1));S.requests=[];S.schedule={};S.limits={early:3,night:4,mid:99};
S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];}
function gaps(){const w=T.ensureWeek(k);const g=[];for(let d=0;d<7;d++)["early","mid","night"].forEach(sh=>{const need=S.needs[d][sh]||0,have=S.staff.filter(n=>w[n][d]===sh).length;if(have<need)g.push(T.DAY_NAMES[d]+T.SHIFT_NAMES[sh]+"缺"+(need-have))});return g;}
function mixReqs(){const mix=[];
for(let i=0;i<6;i++)mix.push(["员工"+pad(i*5+1),i%7,"off"]);
for(let i=0;i<6;i++)mix.push(["员工"+pad(i*5+2),(i+2)%7,["early","mid","night"][i%3]]);
for(let i=0;i<6;i++)mix.push(["员工"+pad(i*5+4),(i+4)%7,["noearly","nomid","nonight"][i%3],"always"]);
mix.push(["员工31",1,"work"]);mix.push(["员工32",5,"work"]);
S.requests=mix.map((r,i)=>({id:i+1,name:r[0],day:r[1],type:r[2],scope:r[3]||"once",weekKey:k}));}

const cases=[["无规则(基线)",false],["混合20条规则",true]];
for(const c of cases){
  let bad=0; const gapLog={};
  for(let t=0;t<20;t++){ reset(32); if(c[1]) mixReqs(); T.autoSchedule();
    const g=gaps(); if(g.length){bad++; g.forEach(x=>gapLog[x]=(gapLog[x]||0)+1);} }
  console.log("【"+c[0]+"】20 次中 "+bad+" 次有缺口  "+JSON.stringify(gapLog));
}
