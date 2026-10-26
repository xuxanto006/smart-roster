const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},click(){},appendChild(){},_tm:null};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"globalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,checkRuleViolations,ensureWeek,curKey,activeRequests,SHIFT_NAMES,DAY_NAMES};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,k=T.curKey();
function pad(i){return String(i).padStart(2,"0");}
const TYPES=["off","work","early","mid","night","noearly","nomid","nonight"];
function reset(n,needs){
  S.staff=Array.from({length:n},(_,i)=>"员工"+pad(i+1));S.requests=[];S.schedule={};S.limits={early:3,night:4,mid:99};
  if(needs) S.needs=needs.map(x=>({early:x[0],mid:x[1],night:x[2]}));
  else S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
}
function gaps(){const w=T.ensureWeek(k);const g=[];for(let d=0;d<7;d++)["early","mid","night"].forEach(sh=>{const need=S.needs[d][sh]||0,have=S.staff.filter(n=>w[n][d]===sh).length;if(have<need)g.push(T.DAY_NAMES[d]+T.SHIFT_NAMES[sh]+"-"+(need-have))});return g;}

let totalGapRuns=0, totalRuleFail=0, runs=0, worstGap=0;
const gapCases=[];

function run(tag, n, nRules, needs, useRepatch){
  reset(n, needs);
  const used=new Set();
  for(let i=0;i<nRules;i++){
    const nm="员工"+pad(1+Math.floor(Math.random()*n));
    const day=Math.floor(Math.random()*7);
    const tp=TYPES[Math.floor(Math.random()*TYPES.length)];
    const key=nm+"|"+day;
    if(used.has(key)) continue;      // 同一人同一天只留一条（模拟 conflictTypes 替换）
    used.add(key);
    S.requests.push({id:S.requests.length+1,name:nm,day,type:tp,scope:Math.random()<0.3?"always":"once",weekKey:k});
  }
  if(useRepatch){ T.autoSchedule(); T.repatchWeek(true); } else T.autoSchedule();
  runs++;
  const w=T.ensureWeek(k), R=T.buildRules(k);
  const bad=T.checkRuleViolations(w,R);
  if(bad.length){ totalRuleFail++; gapCases.push(tag+" 规则未满足: "+bad.slice(0,2).join(",")); }
  const g=gaps();
  if(g.length){ totalGapRuns++; worstGap=Math.max(worstGap,g.length); gapCases.push(tag+" 缺口: "+g.join(",")); }
  return {bad:g.length===0&&bad.length===0};
}

console.log("— 随机压力测试（每组 25 次）—");
const groups=[
  ["32人/5条规则", 32, 5, null, false],
  ["32人/15条规则", 32, 15, null, false],
  ["32人/25条规则", 32, 25, null, false],
  ["32人/15条+微调", 32, 15, null, true],
  ["12人/8条规则", 12, 8, [[2,1,3],[2,1,3],[2,1,3],[2,1,3],[2,1,3],[3,2,4],[3,2,4]], false],
  ["9人/6条规则", 9, 6, [[2,1,2],[2,1,2],[2,1,2],[2,1,2],[2,1,2],[2,1,3],[2,1,3]], false],
  ["30人/20条(紧人力)", 30, 20, [[8,1,10],[8,1,10],[8,1,10],[8,1,10],[8,1,10],[9,2,11],[9,2,11]], false],
];
for(const g of groups){
  let ok=0;
  for(let i=0;i<25;i++) if(run(g[0],g[1],g[2],g[3],g[4]).bad) ok++;
  console.log(`  ${g[0]}: ${ok}/25 完全无缺口且规则全满足`);
}
console.log(`\n合计 ${runs} 次：规则违约 ${totalRuleFail} 次，有班次缺口 ${totalGapRuns} 次`);
if(gapCases.length) console.log("样本（最多10条）:\n  "+gapCases.slice(0,10).join("\n  "));

// 极端边界：同一个人 3 天请假（超过"每周恰好休2天"）
console.log("\n— 极端边界 —");
reset(32);
S.requests=[{id:1,name:"员工03",day:0,type:"off",scope:"once",weekKey:k},
            {id:2,name:"员工03",day:2,type:"off",scope:"once",weekKey:k},
            {id:3,name:"员工03",day:5,type:"off",scope:"once",weekKey:k}];
T.autoSchedule();
let w=T.ensureWeek(k),R=T.buildRules(k);
let bad=T.checkRuleViolations(w,R);
console.log("  员工03 连休3天：规则满足="+(bad.length===0)+"，缺口="+(gaps().join(",")||"无")+"，员工03休"+w["员工03"].filter(v=>v==="rest").length+"天");

reset(32);
S.requests=[{id:1,name:"员工07",day:3,type:"off",scope:"always",weekKey:k}];
T.autoSchedule();
w=T.ensureWeek(k);R=T.buildRules(k);
console.log("  每周固定周四请假：满足="+(T.checkRuleViolations(w,R).length===0)+"，周四休息="+(w["员工07"][3]==="rest")+"，缺口="+(gaps().join(",")||"无"));

reset(32);
S.requests=[];T.autoSchedule();
const before=JSON.parse(JSON.stringify(T.ensureWeek(k)));
S.requests=[{id:1,name:"员工01",day:0,type:"off",scope:"once",weekKey:k},
            {id:2,name:"员工02",day:1,type:"off",scope:"once",weekKey:k},
            {id:3,name:"员工03",day:2,type:"off",scope:"once",weekKey:k},
            {id:4,name:"员工04",day:3,type:"off",scope:"once",weekKey:k}];
T.repatchWeek(true);
w=T.ensureWeek(k);R=T.buildRules(k);
let kept=0,tot=0;S.staff.forEach(n=>{for(let d=0;d<7;d++){tot++;if(before[n][d]===w[n][d])kept++;}});
console.log("  4人请假后微调：规则满足="+(T.checkRuleViolations(w,R).length===0)+"，缺口="+(gaps().join(",")||"无")+"，原班表保留率="+(kept/tot*100).toFixed(1)+"%");
