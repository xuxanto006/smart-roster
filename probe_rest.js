/* 探针：直接看 tryPlan 分配出多少休息日、dayTarget 用掉多少 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){},querySelectorAll(){return[]},querySelector(){return fakeEl("q")},remove(){},children:[],dataset:{}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,getStaffProfile,domainStaff,isBlockedFromSchedule,restRange,tryPlan,buildRules,domNeeds,domLimits};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const dom="3c";
S.domain=dom;
S.restMax={min:2,per:3,total:0};
const N=T.domainStaff(dom).filter(n=>!T.isBlockedFromSchedule(n)).length;
console.log("3C 可排班人数:", N, "  restRange:", JSON.stringify(T.restRange()));

// 手工构造 slots 模拟 autoSchedule
T.state.staff = T.domainStaff(dom).filter(n=>!T.isBlockedFromSchedule(n));
S.needs = T.domNeeds(dom); S.limits = T.domLimits(dom);
const slots=[];
S.needs.forEach((d,di)=>["early","mid","night"].forEach(sh=>{ for(let i=0;i<(+d[sh]||0);i++) slots.push({day:di,shift:sh}); }));
console.log("最小需求槽位:", slots.length);

const plan = T.tryPlan(slots, S.staff.length, null);
const dist={};
plan.restDays.forEach(s=>{ dist[s.size]=(dist[s.size]||0)+1; });
console.log("tryPlan 直接产出休息天数分布:", JSON.stringify(dist));
console.log("总休息人日:", plan.restDays.reduce((a,s)=>a+s.size,0));
