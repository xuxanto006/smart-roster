/* 盲区补齐：全 17 条规则此前只在「一键排班」路径上审过，
   但用户日常最常用的是「排完班 → 临时加请假 → 点微调」这条**局部修复**路径。
   这里做同输入对照：
     A 微调   = 先排一张干净的班表，再加请假条，repatchWeek()
     B 重排   = 直接带着请假条 autoSchedule()（全局搜索）
   两者用同一组请假条、同一套 17 条检查。若 A 明显差于 B，
   说明「微调」按钮在给用户次优结果 —— 要么修，要么明确告诉用户该改用一键排班。
   另加第 15 条：角色标记与班次是否一致（开店必须早班、闭店必须晚班），
   专查微调改了班次之后角色标记有没有跟着失效。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync(process.argv[4]||"/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,assignRoles,hasRestPlan,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const ROUNDS=+(process.argv[2]||30);
const NREQ =+(process.argv[3]||2);          // 每轮随机几条安排
const rnd=n=>Math.floor(Math.random()*n);
const SH=["early","mid","night"], SHCN={early:"早",mid:"中",night:"晚"};
const TYPES=["off","off","off","work","early","mid","night","noearly","nomid","nonight"];

function reset(){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:9,mid:1,night:10}))
        .concat([5,6].map(()=>({early:9,mid:3,night:12})));
  S.limits={early:3,night:3,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups={
    earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"], open:1, close:2, maxPerWeek:3}
  };
}
function genReqs(){
  const used={}, out=[]; let id=1;
  while(out.length<NREQ){
    const n=S.staff[rnd(S.staff.length)], d=rnd(7), key=n+"|"+d;
    if(used[key]) continue; used[key]=1;
    out.push({id:id++, name:n, day:d, type:TYPES[rnd(TYPES.length)], scope:"once", weekKey:T.curKey()});
  }
  return out;
}

function audit(tag, V, Sample){
  let _n=0;   // 本轮违规数（用于统计「有多少比例的轮次出了问题」）
  const hit=(rule,msg)=>{ _n++; V[rule]=(V[rule]||0)+1; if(!Sample[rule]) Sample[rule]=tag+"｜"+msg; };
  const k=T.curKey(), w=T.ensureWeek(k), R=T.buildRules(k);
  const ocMem=T.groupMembers("openClose"), enMem=T.groupMembers("earlyNight");
  const roles=S.roles[k]||{};
  const ocS=new Set(ocMem);
  const P=Math.min(7,Math.max(0,(S.restMax&&S.restMax.per)||2));
  const unav={};
  S.staff.forEach(n=>{
    const row=R[n]; if(!row) return;
    const off=[], must=[];
    for(let d=0;d<7;d++){ if(row[d].off) off.push(d); else if(row[d].noOff) must.push(d); }
    if(off.length<=P && must.length<=7-P && !T.hasRestPlan(off,P,must)) unav[n]=1;
  });

  for(let d=0;d<7;d++) SH.forEach(sh=>{
    const c=S.staff.filter(n=>w[n][d]===sh).length;
    if(c<S.needs[d][sh]) hit("1.班次人数≥需求", `周${d+1}${SHCN[sh]}班 需${S.needs[d][sh]} 实${c}`);
  });
  for(let d=0;d<5;d++){
    const c=S.staff.filter(n=>w[n][d]==="early").length;
    if(c!==S.needs[d].early) hit("2.工作日早班人数恰好", `周${d+1} 需${S.needs[d].early} 实${c}`);
  }
  S.staff.forEach(n=>{
    const c={early:0,mid:0,night:0};
    for(let d=0;d<7;d++) if(c[w[n][d]]!==undefined) c[w[n][d]]++;
    if(c.early>S.limits.early) hit("3.每人早班≤3", `${n} 早${c.early}次`);
    if(c.night>S.limits.night) hit("4.每人晚班≤3", `${n} 晚${c.night}次`);
    const rest=[0,1,2,3,4,5,6].filter(d=>w[n][d]==="rest"||!w[n][d]).length;
    if(rest!==2) hit("5.每人恰好休2天", `${n} 休${rest}天`);
  });
  {
    const total=S.staff.reduce((s,n)=>s+[0,1,2,3,4,5,6].filter(d=>w[n][d]==="rest"||!w[n][d]).length,0);
    const cap=(S.restMax.total>0)?S.restMax.total:S.restMax.per*S.staff.length;
    if(total>cap) hit("6.全队休息总数≤上限", `休${total} 上限${cap}`);
  }
  S.staff.forEach(n=>{
    const s=new Set(); for(let d=0;d<7;d++) if(w[n][d]==="rest"||!w[n][d]) s.add(d);
    if(T.isolatedRestCount(s)>0){
      // 输入层注定躲不开的（预检已提前判定）单独记，不算算法账
      hit(unav[n] ? "7a.上一休一(输入层不可避免)" : "7b.上一休一(可避免)", `${n} 休${[...s].sort().join(",")}`);
    }
  });
  S.staff.forEach(n=>{
    for(let d=0;d<5;d++) if(w[n][d]==="early"&&w[n][d+1]==="early"&&w[n][d+2]==="early")
      hit("8.无三连早", `${n} 周${d+1}~${d+3}`);
    for(let d=0;d<6;d++) if(w[n][d]==="night"&&w[n][d+1]==="early")
      hit("9.晚班次日不早班", `${n} 周${d+1}晚→周${d+2}早`);
  });
  for(let d=0;d<7;d++){
    if(enMem.filter(n=>w[n][d]==="early").length<1) hit("10.早晚保障组每天≥1早", `周${d+1}`);
    if(enMem.filter(n=>w[n][d]==="night").length<1) hit("10.早晚保障组每天≥1晚", `周${d+1}`);
    const o=ocMem.filter(n=>(roles[n]||[])[d]==="open").length;
    const c=ocMem.filter(n=>(roles[n]||[])[d]==="close").length;
    if(o<1) hit("11.每天1人开店", `周${d+1} 仅${o}人`);
    if(c<2) hit("11.每天2人闭店", `周${d+1} 仅${c}人`);
  }
  ocMem.forEach(n=>{
    const c=(roles[n]||[]).filter(x=>x==="open"||x==="close").length;
    if(c>3) hit("12.开店闭店每人≤3次", `${n} ${c}次`);
    // 15. 角色标记与班次必须一致：标了开店那天本人必须是早班，标了闭店必须晚班
    for(let d=0;d<7;d++){
      const rr=(roles[n]||[])[d], v=w[n][d]||"";
      if(rr==="open"  && v!=="early") hit("15.角色标记与班次一致", `${n} 周${d+1} 标开店但班次是「${v||"空"}」`);
      if(rr==="close" && v!=="night") hit("15.角色标记与班次一致", `${n} 周${d+1} 标闭店但班次是「${v||"空"}」`);
    }
  });
  {
    const both=S.staff.filter(n=>w[n][5]==="early"&&w[n][6]==="early");
    if(both.length>1) hit("13.周末连上早班≤1人", both.join("、"));
    both.filter(n=>ocS.has(n)).forEach(n=>hit("13.开店闭店组周末换人", n));
  }
  T.checkRuleViolations(w,R).forEach(x=>hit("14.请假与改班满足", x));
  return _n;
}

const ORDER=["1.班次人数≥需求","2.工作日早班人数恰好","3.每人早班≤3","4.每人晚班≤3","5.每人恰好休2天",
"6.全队休息总数≤上限","7a.上一休一(输入层不可避免)","7b.上一休一(可避免)","8.无三连早","9.晚班次日不早班",
"10.早晚保障组每天≥1早","10.早晚保障组每天≥1晚","11.每天1人开店","11.每天2人闭店",
"12.开店闭店每人≤3次","13.周末连上早班≤1人","13.开店闭店组周末换人","14.请假与改班满足",
"15.角色标记与班次一致"];

const VA={}, SA={}, VB={}, SB={};
let rA=0, rB=0, onlyA=0, nA_all=0, nB_all=0;
for(let r=0;r<ROUNDS;r++){
  const reqs=genReqs();
  // A 微调：先排干净的，再加请假条，走 repatchWeek（内部会 renderAll → renderTable → syncRoles）
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  S.requests=reqs.map(x=>Object.assign({},x));
  T.repatchWeek(true);
  const nA=audit("微调", VA, SA);
  // B 重排：带着同一组请假条从零排
  reset();
  S.requests=reqs.map(x=>Object.assign({},x));
  T.autoSchedule(); T.assignRoles(T.curKey());
  const nB=audit("重排", VB, SB);
  nA_all+=nA; nB_all+=nB;
  if(nA>0) rA++;
  if(nB>0) rB++;
  if(nA>0 && nB===0) onlyA++;   // 微调坏了、但整体重排能救回来 = 微调的净缺陷
}
function score(V){ return ORDER.reduce((s,k)=>s+(V[k]||0),0); }

console.log("══════ 微调 vs 重排 · 同输入对照（"+ROUNDS+" 轮 × "+NREQ+" 条安排）══════\n");
console.log("规则".padEnd(30)+"微调".padStart(8)+"重排".padStart(8)+"   差异");
console.log("─".repeat(64));
ORDER.forEach(k=>{
  const a=VA[k]||0, b=VB[k]||0;
  const mark = a===0 && b===0 ? "✅" : (a>b ? "⚠️" : (b>a ? "·" : "❌"));
  const diff = a>b ? `微调多 ${a-b}` : (b>a ? `重排多 ${b-a}` : "持平");
  console.log(`  ${mark} ${k.padEnd(26)}`+String(a).padStart(7)+String(b).padStart(8)+"   "+diff);
  if(a||b){
    if(SA[k]) console.log("        微调例：" + SA[k]);
    if(SB[k]) console.log("        重排例：" + SB[k]);
  }
});
console.log("─".repeat(64));
console.log("  合计".padEnd(30)+String(score(VA)).padStart(7)+String(score(VB)).padStart(8));
console.log("\n  轮次统计（比总次数更能说明问题）：");
console.log("    微调后出现违规的轮次：" + rA + " / " + ROUNDS +
            "（" + Math.round(rA/ROUNDS*100) + "%）");
console.log("    重排后出现违规的轮次：" + rB + " / " + ROUNDS +
            "（" + Math.round(rB/ROUNDS*100) + "%）");
console.log("    微调坏了、但整体重排能救回来的轮次：" + onlyA + " / " + ROUNDS +
            "（" + Math.round(onlyA/ROUNDS*100) + "%）← 微调的净缺陷");
console.log("\n  说明：7a 是请假日本身不相邻导致的、数学上躲不开的上一休一（录入期已预检提示），不计入算法账。");
