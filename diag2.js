const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},click(){},appendChild(){},_tm:null};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"globalThis.__T={get state(){return state},autoSchedule,buildRules,checkRuleViolations,ensureWeek,curKey,activeRequests,SHIFT_NAMES,DAY_NAMES,tryPlan,planScore,shuffle};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,k=T.curKey();
function pad(i){return String(i).padStart(2,"0");}
function reset(){S.staff=Array.from({length:32},(_,i)=>"员工"+pad(i+1));S.requests=[];S.schedule={};S.limits={early:3,night:4,mid:99};
S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];}
function mixReqs(){const mix=[];
for(let i=0;i<6;i++)mix.push(["员工"+pad(i*5+1),i%7,"off"]);
for(let i=0;i<6;i++)mix.push(["员工"+pad(i*5+2),(i+2)%7,["early","mid","night"][i%3]]);
for(let i=0;i<6;i++)mix.push(["员工"+pad(i*5+4),(i+4)%7,["noearly","nomid","nonight"][i%3],"always"]);
mix.push(["员工31",1,"work"]);mix.push(["员工32",5,"work"]);
S.requests=mix.map((r,i)=>({id:i+1,name:r[0],day:r[1],type:r[2],scope:r[3]||"once",weekKey:k}));}

reset(); mixReqs(); T.autoSchedule();
const w=T.ensureWeek(k), R=T.buildRules(k);
console.log("day | 早(需/实) 中(需/实) 晚(需/实) | 休 空 | 晚班人数上限余量");
for(let d=0;d<7;d++){
  const c={early:0,mid:0,night:0,rest:0,empty:0};
  S.staff.forEach(n=>{ const v=w[n][d]||"empty"; if(c[v]!==undefined)c[v]++; });
  const lim={early:0,night:0};
  S.staff.forEach(n=>{ if(w[n].filter(x=>x==="night").length>=S.limits.night) lim.night++; if(w[n].filter(x=>x==="early").length>=S.limits.early) lim.early++; });
  console.log(T.DAY_NAMES[d]+" | 早 "+S.needs[d].early+"/"+c.early+"  中 "+S.needs[d].mid+"/"+c.mid+"  晚 "+S.needs[d].night+"/"+c.night+" | 休"+c.rest+" 空"+c.empty+" | 满晚班上限人数 "+lim.night+" 满早班上限 "+lim.early);
}
let tot=0; S.staff.forEach(n=>{tot+=w[n].filter(v=>v!==""&&v!=="rest").length;});
console.log("总排班次 =",tot,"(应为 32*5=160)");
// 谁在周末晚班被卡住：统计周五晚/周六晚/周日晚 与 次日早班的关系
const nightCnt = n => w[n].filter(v=>v==="night").length;
const atLimit = S.staff.filter(n=>nightCnt(n)>=4).length;
console.log("晚班已满4次的人数:",atLimit);
// 周日/周六 晚班缺1：看当天有多少人"可排晚"但被其它条件挡住
for(const d of [5,6]){
  let blocked={rest:0,other:0,limit:0,prevEarly:0,nextEarly:0,rule:0};
  S.staff.forEach(n=>{
    const v=w[n][d]||"";
    if(v==="night") return;
    const c=R[n][d];
    if(c.off) blocked.rule++;
    else if(c.only) blocked.rule++;
    else if(c.ban.night) blocked.rule++;
    else if(v==="rest") blocked.rest++;
    else if(v!==""&&v!=="rest") blocked.other++;
    else if(nightCnt(n)>=S.limits.night) blocked.limit++;
    else if(w[n][(d+1)%7]==="early") blocked.nextEarly++;
  });
  console.log(T.DAY_NAMES[d]+" 未被排晚班的人的原因分布:",JSON.stringify(blocked));
}
