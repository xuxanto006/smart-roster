/** 定位：「微调」是否会破坏一张本来就合规的班表？
    做法：autoSchedule → 体检 → repatchWeek → 再体检，对比前后差集 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

function reset(reqs){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.requests = reqs || [];
}
/* 只查「微调有没有资格负责」的硬约束：上一休一、休息天数、请假/改班、固定上班日、分组 */
function audit(w){
  const R=T.buildRules(T.curKey());
  const out=[];
  T.checkRuleViolations(w,R).forEach(function(x){ out.push(x); });
  (S.mustWork||[]).forEach(function(m){
    const v=w[m.name]?w[m.name][m.day]:"";
    if(v==="rest"||!v) out.push(`固定上班日违反：${m.name} 周${m.day+1}`);
  });
  S.staff.forEach(function(n){
    var s=new Set();
    for(var d=0;d<7;d++) if(w[n][d]==="rest"||!w[n][d]) s.add(d);
    if(T.isolatedRestCount(s)>0) out.push(`${n} 上一休一（休 ${[...s].sort(function(a,b){return a-b;}).map(function(d){return "周"+(d+1);}).join("、")}）`);
    const r=(w[n]||[]).filter(function(v){return v==="rest";}).length;
    if(r!==2) out.push(`${n} 休 ${r} 天`);
  });
  for(var d=0;d<7;d++){
    var en=T.groupMembers("earlyNight"), oc=T.groupMembers("openClose");
    if(en.filter(function(n){return w[n][d]==="early";}).length<1) out.push(`周${d+1} 早晚保障组早班缺`);
    if(en.filter(function(n){return w[n][d]==="night";}).length<1) out.push(`周${d+1} 早晚保障组晚班缺`);
    if(oc.filter(function(n){return w[n][d]==="early";}).length<1) out.push(`周${d+1} 开店缺`);
    if(oc.filter(function(n){return w[n][d]==="night";}).length<2) out.push(`周${d+1} 闭店缺`);
  }
  return out;
}

const N=+(process.argv[2]||150);
let planDirty=0, patchDirty=0, introduced=[], fixed=[];
const kinds={};
for(let i=0;i<N;i++){
  // 随机 3 条请假
  const reqs=[]; let id=1; const used={};
  while(reqs.length<3){
    const n=S.staff[Math.floor(Math.random()*S.staff.length)];
    const d=Math.floor(Math.random()*7);
    if(used[n+"|"+d]) continue;
    if(S.mustWork.some(function(m){return m.name===n&&m.day===d;})) continue;
    used[n+"|"+d]=1;
    reqs.push({id:id++, name:n, day:d, type:"off", scope:"once", weekKey:T.curKey()});
  }
  reset(reqs);
  T.autoSchedule();
  const before=audit(T.ensureWeek(T.curKey()));
  if(before.length) planDirty++;
  T.repatchWeek();
  const after=audit(T.ensureWeek(T.curKey()));
  if(after.length) patchDirty++;
  // 差集
  before.forEach(function(x){ if(after.indexOf(x)<0) fixed.push(x); });
  after.forEach(function(x){
    if(before.indexOf(x)<0){
      introduced.push(x);
      const key=x.replace(/^周\d+ /,"").replace(/（.*/,"").replace(/ 休 \d+ 天/," 休N天").replace(/^[^ ]+ /,"<某人> ");
      kinds[key]=(kinds[key]||0)+1;
    }
  });
}
console.log("══════ 微调是否破坏合规班表（" + N + " 轮）══════");
console.log("  自动排班后就不合规：" + planDirty + " 轮   " + (planDirty?"❌ 排班本身有问题":"✅"));
console.log("  微调之后不合规：" + patchDirty + " 轮   " + (patchDirty>planDirty?"❌ 微调把好班表改坏了":"✅ 微调没引入新问题"));
console.log("\n  微调新增的问题：" + introduced.length + " 条");
console.log("  微调修好的问题：" + fixed.length + " 条");
console.log("\n— 新增问题的类型分布 —");
Object.keys(kinds).sort(function(a,b){return kinds[b]-kinds[a];}).forEach(function(k){
  console.log("  " + kinds[k] + " ×  " + k);
});
console.log("\n— 前 8 条新增样例 —");
introduced.slice(0,8).forEach(function(x){ console.log("  · " + x); });
