/* 全规则合规审计：把用户在整个项目里提过的每一条规则逐条跑一遍。
   目的不是「再测一次我知道的东西」，而是找出**有没有哪条规则其实根本没在跑**。
   每条规则单独计数，违规率 > 0 的就是要修的。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync(process.env.APP_FILE||"/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,assignRoles,hasRestPlan,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const ROUNDS = +(process.env.ROUNDS||process.argv[2]||100);
const LEAVE  = (process.env.LEAVE||process.argv[3])==="leave";   // 加请假模式：每轮随机 2~3 条请假
const V = {};                       // 规则 -> 违规次数
const Sample = {};                  // 规则 -> 第一个样本
function hit(rule, msg){ V[rule]=(V[rule]||0)+1; if(!Sample[rule]) Sample[rule]=msg; }

function reset(){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups = {
    earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"], open:1, close:2, maxPerWeek:3}
  };
}

const SH=["early","mid","night"];
const SHCN={early:"早",mid:"中",night:"晚"};

let unavoidableISO=0, realISO=0;   // 上一休一的两种成因分开记
const rnd = n => Math.floor(Math.random()*n);

for(let r=0;r<ROUNDS;r++){
  reset();
  if(LEAVE){
    // 随机 2~3 条请假（同一人可能请到两天 —— 那正是「上一休一」雷区）
    const cnt = 2+rnd(2), used={}; let id=1;
    while(S.requests.length<cnt){
      const n=S.staff[rnd(S.staff.length)], d=rnd(7), key=n+"|"+d;
      if(used[key]) continue; used[key]=1;
      S.requests.push({id:id++, name:n, day:d, type:"off", scope:"once", weekKey:T.curKey()});
    }
  }
  T.autoSchedule();
  const k=T.curKey(), w=T.ensureWeek(k), R=T.buildRules(k);
  // 预检：哪些人本周的休息组合「数学上必然」出现上一休一
  const P = Math.min(7, Math.max(0,(S.restMax&&S.restMax.per)||2));
  const unav = {};
  S.staff.forEach(n=>{
    const row=R[n]; if(!row) return;
    const off=[], must=[];
    for(let d=0;d<7;d++){ if(row[d].off) off.push(d); else if(row[d].noOff) must.push(d); }
    if(off.length<=P && must.length<=7-P && !T.hasRestPlan(off,P,must)) unav[n]=1;
  });
  T.assignRoles(k);
  const roles=S.roles[k]||{};
  const ocMem=T.groupMembers("openClose"), enMem=T.groupMembers("earlyNight");
  const ocS=new Set(ocMem);

  /* 1. 每天各班次人数 ≥ 需求 */
  for(let d=0; d<7; d++){
    SH.forEach(sh=>{
      const c=S.staff.filter(n=>w[n][d]===sh).length;
      if(c < S.needs[d][sh]) hit("1.班次人数≥需求", `周${d+1}${SHCN[sh]}班 需${S.needs[d][sh]} 实${c}`);
    });
  }
  /* 2. 工作日早班人数「恰好」等于需求（用户：工作日早班=8 人，可调） */
  for(let d=0; d<5; d++){
    const c=S.staff.filter(n=>w[n][d]==="early").length;
    if(c !== S.needs[d].early) hit("2.工作日早班人数恰好", `周${d+1} 需${S.needs[d].early} 实${c}`);
  }
  /* 3~4. 每人每周各班次上限 */
  S.staff.forEach(n=>{
    const c={early:0,mid:0,night:0};
    for(let d=0;d<7;d++) if(c[w[n][d]]!==undefined) c[w[n][d]]++;
    if(c.early > S.limits.early) hit("3.每人早班≤3", `${n} 早${c.early}次`);
    if(c.night > S.limits.night) hit("4.每人晚班≤3", `${n} 晚${c.night}次`);
  });
  /* 5. 每人每周恰好休 2 天 */
  S.staff.forEach(n=>{
    const rest=[0,1,2,3,4,5,6].filter(d=>w[n][d]==="rest"||!w[n][d]).length;
    if(rest !== 2) hit("5.每人恰好休2天", `${n} 休${rest}天`);
  });
  /* 6. 全队休息总数 ≤ 上限（total=0 → 自动 = per×人数） */
  {
    const total=S.staff.reduce((s,n)=> s + [0,1,2,3,4,5,6].filter(d=>w[n][d]==="rest"||!w[n][d]).length, 0);
    const cap = (S.restMax.total>0) ? S.restMax.total : S.restMax.per*S.staff.length;
    if(total > cap) hit("6.全队休息总数≤上限", `休${total} 上限${cap}`);
  }
  /* 7. 不能上一休一（休-上-休）—— 分成「输入层不可避免」与「算法问题」两类 */
  S.staff.forEach(n=>{
    const s=new Set(); for(let d=0;d<7;d++) if(w[n][d]==="rest"||!w[n][d]) s.add(d);
    if(T.isolatedRestCount(s)>0){
      if(unav[n]) unavoidableISO++; else realISO++;
      hit("7.无上一休一", `${n} 休${[...s].sort().join(",")}`);
    }
  });
  /* 8. 不能三个早班连在一起 */
  S.staff.forEach(n=>{
    for(let d=0; d<5; d++){
      if(w[n][d]==="early"&&w[n][d+1]==="early"&&w[n][d+2]==="early")
        hit("8.无三连早", `${n} 周${d+1}~${d+3}`);
    }
  });
  /* 9. 晚班次日不接早班 */
  S.staff.forEach(n=>{
    for(let d=0; d<6; d++){
      if(w[n][d]==="night"&&w[n][d+1]==="early") hit("9.晚班次日不早班", `${n} 周${d+1}晚→周${d+2}早`);
    }
  });
  /* 10. 早晚保障组：每天 ≥1 早 + ≥1 晚 */
  for(let d=0; d<7; d++){
    const e=enMem.filter(n=>w[n][d]==="early").length;
    const g=enMem.filter(n=>w[n][d]==="night").length;
    if(e<1) hit("10.早晚保障组每天≥1早", `周${d+1} 仅${e}人`);
    if(g<1) hit("10.早晚保障组每天≥1晚", `周${d+1} 仅${g}人`);
  }
  /* 11. 开店闭店组：每天 1 开店 + 2 闭店（该角色确实发出去了） */
  for(let d=0; d<7; d++){
    const o=ocMem.filter(n=>(roles[n]||[])[d]==="open").length;
    const c=ocMem.filter(n=>(roles[n]||[])[d]==="close").length;
    if(o<1){
      // 失败样本要带足现场信息，否则复现不了
      const earlyMem=ocMem.filter(n=>w[n][d]==="early");
      const cntOf=n=>(roles[n]||[]).filter(x=>x==="open"||x==="close").length;
      const why = earlyMem.length===0
        ? "该组当天无人早班：" + ocMem.map(n=>n+":"+(w[n][d]==="rest"||!w[n][d]?"休":w[n][d])).join(" ")
        : "有早班但都被≤3次卡住：" + earlyMem.map(n=>`${n}(${cntOf(n)}次)`).join(" ");
      hit("11.每天1人开店", `第${r+1}轮 周${d+1} 仅${o}人 ｜ ${why}`);
    }
    if(c<2) hit("11.每天2人闭店", `第${r+1}轮 周${d+1} 仅${c}人`);
  }
  /* 12. 开店闭店组：每人每周角色次数 ≤ maxPerWeek(3) */
  ocMem.forEach(n=>{
    const c=(roles[n]||[]).filter(x=>x==="open"||x==="close").length;
    if(c > 3) hit("12.开店闭店每人≤3次", `${n} ${c}次`);
  });
  /* 13. 周末连上早班 ≤1 人，且开店闭店组不得连开两天 */
  {
    const both=S.staff.filter(n=>w[n][5]==="early"&&w[n][6]==="early");
    if(both.length > 1) hit("13.周末连上早班≤1人", `${both.join("、")}`);
    both.filter(n=>ocS.has(n)).forEach(n=>hit("13.开店闭店组周末换人", `${n}`));
  }
  /* 14. 请假 / 改班 / 固定上班日 */
  T.checkRuleViolations(w,R).forEach(x=>hit("14.请假与改班满足", x));
}

const order=["1.班次人数≥需求","2.工作日早班人数恰好","3.每人早班≤3","4.每人晚班≤3","5.每人恰好休2天",
"6.全队休息总数≤上限","7.无上一休一","8.无三连早","9.晚班次日不早班","10.早晚保障组每天≥1早",
"10.早晚保障组每天≥1晚","11.每天1人开店","11.每天2人闭店","12.开店闭店每人≤3次",
"13.周末连上早班≤1人","13.开店闭店组周末换人","14.请假与改班满足"];

console.log("══════ 全规则合规审计（"+ROUNDS+" 次排班）══════");
let clean=0;
order.forEach(rule=>{
  const v=V[rule]||0;
  const mark = v===0 ? "✅" : "❌";
  if(v===0) clean++;
  console.log(`  ${mark} ${rule.padEnd(22,"　")} 违规 ${v} 次` + (v? `   例：${Sample[rule]}` : ""));
});
console.log("\n  —— " + clean + " / " + order.length + " 条规则零违规 ——");
if(LEAVE){
  console.log("\n  上一休一成因拆分：");
  console.log("    输入层不可避免（预检已提前判定）：" + unavoidableISO + " 人次");
  console.log("    算法问题（可避免却没避开）：      " + realISO + " 人次" + (realISO? "  ❌" : "  ✅"));
}
process.exit(clean===order.length && (!LEAVE||realISO===0)?0:1);
