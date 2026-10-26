/** 验证：带请假时出现的「上一休一」，是不是全部由「请假日本身不相邻」造成（即输入层面不可避免）
    判据：违规者的休息日集合 ⊆ 他的请假日集合 → 休息日是被请假钉死的，算法无从选择 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
const DAY=["周一","周二","周三","周四","周五","周六","周日"];

function reset(reqs, mw){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork = mw || [{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.requests = reqs || [];
}

const N=+(process.argv[2]||200);
let rounds=0, isoRounds=0, unavoidable=0, avoidable=[], otherBad=[];
for(let i=0;i<N;i++){
  const reqs=[]; let id=1; const used={};
  while(reqs.length<3){
    const n=S.staff[Math.floor(Math.random()*S.staff.length)];
    const d=Math.floor(Math.random()*7);
    if(used[n+"|"+d]) continue;
    used[n+"|"+d]=1;
    reqs.push({id:id++, name:n, day:d, type:"off", scope:"once", weekKey:T.curKey()});
  }
  reset(reqs);
  T.autoSchedule();
  rounds++;
  const w=T.ensureWeek(T.curKey());
  const R=T.buildRules(T.curKey());
  const forced={};
  S.staff.forEach(function(n){
    forced[n]=new Set();
    for(let d=0;d<7;d++) if(R[n][d] && R[n][d].off) forced[n].add(d);
  });
  let roundHasIso=false;
  S.staff.forEach(function(n){
    const rest=new Set();
    for(let d=0;d<7;d++) if(w[n][d]==="rest"||!w[n][d]) rest.add(d);
    if(T.isolatedRestCount(rest)===0) return;
    roundHasIso=true;
    // 判据：休息日是否全部是被请假钉死的
    let allForced=true;
    rest.forEach(function(d){ if(!forced[n].has(d)) allForced=false; });
    if(allForced) unavoidable++;
    else avoidable.push(n + " 休{" + [...rest].sort(function(a,b){return a-b;}).map(function(d){return DAY[d];}).join("、") +
                        "} 其中请假日={" + [...forced[n]].sort(function(a,b){return a-b;}).map(function(d){return DAY[d];}).join("、") + "}");
  });
  if(roundHasIso) isoRounds++;
  // 其它违规（请假未满足 / 分组 / 休息天数）
  T.checkRuleViolations(w,R).forEach(function(x){ otherBad.push(x); });
  (S.mustWork||[]).forEach(function(m){
    const c=R[m.name]&&R[m.name][m.day];
    if(c && c.off) return;   // 当天请假 → 请假优先，按设计就该休息，不算违规
    const v=w[m.name]?w[m.name][m.day]:"";
    if(v==="rest"||!v) otherBad.push(`固定上班日违反：${m.name} ${DAY[m.day]}`);
  });
  for(let d=0;d<7;d++){
    var en=T.groupMembers("earlyNight"), oc=T.groupMembers("openClose");
    if(en.filter(function(n){return w[n][d]==="early";}).length<1) otherBad.push(`${DAY[d]} 保障组早班缺`);
    if(en.filter(function(n){return w[n][d]==="night";}).length<1) otherBad.push(`${DAY[d]} 保障组晚班缺`);
    if(oc.filter(function(n){return w[n][d]==="early";}).length<1) otherBad.push(`${DAY[d]} 开店缺`);
    if(oc.filter(function(n){return w[n][d]==="night";}).length<2) otherBad.push(`${DAY[d]} 闭店缺`);
  }
}
console.log("══════ 违规归因（" + rounds + " 轮，每轮随机 3 条请假）══════");
console.log("  出现「上一休一」的轮次：" + isoRounds + " / " + rounds);
console.log("  其中休息日全部由请假钉死（不可避免）：" + unavoidable + " 人次");
console.log("  休息日里含算法自己选的日子（算法问题）：" + avoidable.length + " 人次  " + (avoidable.length?"❌":"✅ 一个都没有"));
console.log("\n  其它违规（请假未满足 / 固定上班日 / 分组保障）：" + otherBad.length + " 条  " + (otherBad.length?"❌":"✅"));
if(avoidable.length){ console.log("\n— 需要修的样本 —"); avoidable.slice(0,8).forEach(function(x){ console.log("  · "+x); }); }
if(otherBad.length){ console.log("\n— 其它违规样例 —"); [...new Set(otherBad)].slice(0,8).forEach(function(x){ console.log("  · "+x); }); }
