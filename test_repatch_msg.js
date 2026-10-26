/* 锁死一条性质：「🔄 按请假/改班微调」的提示文案，必须和实际班表对得上。
   改动前 repatchWeek 只按「请假满足 + 无缺班」判定成败，
   于是三连早 / 晚接早 / 上一休一 / 开店闭店缺人这类残留会被漏掉，
   提示却写着「✅ 全部安排已满足，其余人班次保持不变」—— 实测 35% 的轮次是这种假成功
   （加 4 条安排时 80%）。这里用独立审计交叉验证：
     有违规  ⇔  提示必须说「⚠️ 仍有 N 处冲突」
     无违规  ⇔  提示才可以说「✅ 全部安排已满足」
   同时保留「微调是轻触策略」的设计约束：不覆盖手动改过的格子、不擅自整体重排。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,assignRoles,hasRestPlan,patchViolations,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

let pass=0, fail=0;
function expect(cond, name, extra){
  if(cond){ pass++; console.log("  ✅ " + name); }
  else{ fail++; console.log("  ❌ " + name + (extra? "　→　" + extra : "")); }
}
const ROUNDS=+(process.argv[2]||40);
const rnd=n=>Math.floor(Math.random()*n);
const TYPES=["off","off","off","work","early","mid","night","noearly","nomid","nonight"];

function reset(){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:8,mid:1,night:10}))
        .concat([5,6].map(()=>({early:9,mid:3,night:12})));
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups={
    earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"], open:1, close:2, maxPerWeek:3}
  };
}
/* 独立审计：不复用被测代码的判定，才能交叉验证 */
function auditCount(w){
  const k=T.curKey(), R=T.buildRules(k), roles=S.roles[k]||{};
  const ocMem=T.groupMembers("openClose"), enMem=T.groupMembers("earlyNight");
  const P=Math.min(7,Math.max(0,(S.restMax&&S.restMax.per)||2));
  const unav={};
  S.staff.forEach(n=>{
    const row=R[n]; if(!row) return;
    const off=[], must=[];
    for(let d=0;d<7;d++){ if(row[d].off) off.push(d); else if(row[d].noOff) must.push(d); }
    if(off.length<=P && must.length<=7-P && !T.hasRestPlan(off,P,must)) unav[n]=1;
  });
  const out=[];
  // 缺班也要查：漏了它就会把「提示报缺人、审计说没事」误判成提示误报
  for(let d=0;d<7;d++) ["early","mid","night"].forEach(sh=>{
    const need=+S.needs[d][sh]||0;
    const have=S.staff.filter(n=>w[n][d]===sh).length;
    if(have<need) out.push(`周${d+1}${sh}缺${need-have}人`);
  });
  S.staff.forEach(n=>{
    const arr=w[n]||[], rest=new Set();
    for(let d=0;d<7;d++){ const v=arr[d]||""; if(v==="rest"||v==="") rest.add(d); }
    if(T.isolatedRestCount(rest)>0 && !unav[n]) out.push(`${n} 上一休一`);
    // 三连早是**跨周循环**判定的（周六、周日、周一 也算），和 hasEarlyRun3 口径一致；
    // 只查 d=0..4 会漏掉跨周那两组，导致把「提示报三连早」误判成误报
    for(let d=0;d<7;d++)
      if(arr[d]==="early"&&arr[(d+1)%7]==="early"&&arr[(d+2)%7]==="early"){ out.push(`${n} 三连早`); break; }
    for(let d=0;d<7;d++) if(arr[d]==="night"&&arr[(d+1)%7]==="early"){ out.push(`${n} 晚接早`); break; }
    // 班次次数上限：体检面板把「早/晚班 X 次 > 上限」当错误报（renderHealth ②），
    // 自审计漏了这条就会把提示的正确冲突误判成误报（实测出现过「早班 4 次超上限」）
    const cnt={early:0,night:0};
    for(let d=0;d<7;d++){ const v=arr[d]||""; if(v==="early")cnt.early++; if(v==="night")cnt.night++; }
    ["early","night"].forEach(sh=>{
      const lim=S.limits[sh]||99;
      if(lim<99 && cnt[sh]>lim) out.push(`${n} ${sh==="early"?"早":"晚"}班 ${cnt[sh]} 次 > 上限 ${lim}`);
    });
  });
  for(let d=0;d<7;d++){
    if(enMem.filter(n=>w[n][d]==="early").length<1) out.push(`周${d+1} 保障组缺早`);
    if(enMem.filter(n=>w[n][d]==="night").length<1) out.push(`周${d+1} 保障组缺晚`);
    if(ocMem.filter(n=>(roles[n]||[])[d]==="open").length<1)  out.push(`周${d+1} 开店缺`);
    if(ocMem.filter(n=>(roles[n]||[])[d]==="close").length<2) out.push(`周${d+1} 闭店缺`);
  }
  // 周末连上早班上限、全队休息总数 —— 体检面板当错误报，自审计也要覆盖
  const wkMax = (typeof S.weekendEarlyMax === "number") ? S.weekendEarlyMax : 1;
  const wkBoth = S.staff.filter(n=>w[n][5]==="early" && w[n][6]==="early").length;
  if(wkBoth > wkMax) out.push(`周末连上早班 ${wkBoth} 人`);
  const totalRest = S.staff.reduce((s,n)=>
    s + [0,1,2,3,4,5,6].filter(d=>{ const v=w[n][d]||""; return v==="rest"||v===""; }).length, 0);
  const cap = (S.restMax.total>0) ? S.restMax.total : S.restMax.per*S.staff.length;
  if(totalRest > cap) out.push(`全队休息 ${totalRest} > ${cap}`);
  T.checkRuleViolations(w,R).forEach(x=>out.push(x));
  return out;
}

console.log("══════ 微调提示文案 · 与实际班表一致性测试（"+ROUNDS+" 轮）══════\n");

/* 一、文案判定与独立审计是否一致 */
console.log("— 一、提示的成败判定必须与实际班表一致 —");
let agree=0, lied=0, wrongClean=0, nViol=0, nClean=0, sampleLie="";
for(let r=0;r<ROUNDS;r++){
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  const used={}, reqs=[]; let id=1;
  const cnt=1+rnd(3);
  while(reqs.length<cnt){
    const n=S.staff[rnd(S.staff.length)], d=rnd(7), key=n+"|"+d;
    if(used[key]) continue; used[key]=1;
    reqs.push({id:id++, name:n, day:d, type:TYPES[rnd(TYPES.length)], scope:"once", weekKey:T.curKey()});
  }
  S.requests=reqs;
  const msg=T.repatchWeek(true) || "";
  const v=auditCount(T.ensureWeek(T.curKey()));
  const claimsOK   = /✅ 全部安排已满足/.test(msg);
  const claimsBad  = /⚠️ 仍有 \d+ 处冲突/.test(msg);
  if(v.length){
    nViol++;
    if(claimsBad && !claimsOK) agree++;
    else { lied++; if(!sampleLie) sampleLie=`第${r+1}轮 实际 ${v.length} 处（${v.slice(0,2).join("、")}）｜ 提示：${msg.slice(-70)}`; }
  }else{
    nClean++;
    if(claimsOK && !claimsBad) agree++;
    else { wrongClean++; if(!sampleLie) sampleLie=`第${r+1}轮 实际无违规 ｜ 提示：${msg.slice(-70)}`; }
  }
}
expect(lied===0, `有违规时提示必须说「⚠️ 仍有 N 处冲突」，不得出现「✅ 全部安排已满足」（假成功 ${lied} 轮）`, sampleLie);
expect(wrongClean===0, `无违规时才允许说「✅ 全部安排已满足」（误报 ${wrongClean} 轮）`, sampleLie);
expect(agree===ROUNDS, `文案与实际完全一致 ${agree}/${ROUNDS} 轮`);
console.log(`     （样本分布：有违规 ${nViol} 轮 ／ 无违规 ${nClean} 轮）`);

/* 二、补文案不能顺手把「轻触」设计改成整体重排。
   真正要锁的性质是「整张表基本没动」—— 保留率 100% 不合理
   （撞上请假条的格子本来就该被清掉），但若是整体重排，保留率会塌到很低。 */
console.log("\n— 二、仍应是「轻触」策略：整张表基本不动 —");
let minKeep=1, worstCase="";
for(let r=0;r<12;r++){
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  const kk=T.curKey();
  const before=JSON.parse(JSON.stringify(T.ensureWeek(kk)));
  S.requests=[{id:1,name:S.staff[rnd(S.staff.length)],day:rnd(7),type:"off",scope:"once",weekKey:kk}];
  T.repatchWeek(true);
  const after=T.ensureWeek(kk);
  let same=0, total=0;
  S.staff.forEach(n=>{ for(let d=0;d<7;d++){ total++; if(before[n][d]===after[n][d]) same++; } });
  const rate=same/total;
  if(rate<minKeep){ minKeep=rate; worstCase=`第${r+1}轮 保留率 ${(rate*100).toFixed(1)}%`; }
}
expect(minKeep>0.9, `12 轮微调整表保留率均 > 90%（最低 ${(minKeep*100).toFixed(1)}%），没有被偷偷换成整体重排`, worstCase);

/* 三、patchViolations 与独立审计口径一致（自检函数自身要可信） */
console.log("\n— 三、自检函数 patchViolations 自身可信 —");
let mismatch=0, sampleMM="";
for(let r=0;r<20;r++){
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  S.requests=[{id:1,name:S.staff[rnd(S.staff.length)],day:rnd(7),type:"off",scope:"once",weekKey:T.curKey()}];
  T.repatchWeek(true);
  const k=T.curKey(), w=T.ensureWeek(k), R=T.buildRules(k);
  const mine=auditCount(w).length;
  const self=T.patchViolations(w,R,k).length;
  // 口径不必逐字相同，但「有没有问题」这个结论必须一致
  if((mine>0)!==(self>0)){ mismatch++; if(!sampleMM) sampleMM=`独立审计 ${mine} 处 ／ 自检 ${self} 处`; }
}
expect(mismatch===0, `「有没有违规」的结论与独立审计一致（不一致 ${mismatch}/20 轮）`, sampleMM);

console.log("\n══════════════════════════════");
console.log(`===== 微调提示测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
