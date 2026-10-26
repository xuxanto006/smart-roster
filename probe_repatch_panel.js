/* 微调留下的违规，「本周体检」面板有没有如实报出来？
   设计意图（test_mustwork_repatch.js 里有断言守着）：微调是「轻触」策略，
   不动其他人的班、不覆盖手动改过的格子，补不回来的问题交给体检面板列出来给人看。
   那前提就是面板**必须报得出来**。这里验：审计发现的违规，面板有没有一次不落地全报。
     · 面板也报了 → 用户没被蒙在鼓里，剩下的只是「提示文案不准」的文案问题
     · 面板没报   → 用户拿到的提示是「✅ 全部安排已满足」，属于假绿灯，必须修面板 */
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
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,assignRoles,hasRestPlan,renderHealth,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const ROUNDS=+(process.argv[2]||40);
const NREQ=+(process.argv[3]||2);
const rnd=n=>Math.floor(Math.random()*n);
const SH=["early","mid","night"], SHCN={early:"早",mid:"中",night:"晚"};
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
function genReqs(){
  const used={}, out=[]; let id=1;
  while(out.length<NREQ){
    const n=S.staff[rnd(S.staff.length)], d=rnd(7), key=n+"|"+d;
    if(used[key]) continue; used[key]=1;
    out.push({id:id++, name:n, day:d, type:TYPES[rnd(TYPES.length)], scope:"once", weekKey:T.curKey()});
  }
  return out;
}
/* 与 audit_repatch.js 同一套判定，但只数「微调有没有留下违规」 */
function auditCount(){
  const k=T.curKey(), w=T.ensureWeek(k), R=T.buildRules(k);
  const roles=S.roles[k]||{};
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
  for(let d=0;d<7;d++) SH.forEach(sh=>{
    const c=S.staff.filter(n=>w[n][d]===sh).length;
    if(c<S.needs[d][sh]) out.push(`周${d+1}${SHCN[sh]}班缺人`);
  });
  S.staff.forEach(n=>{
    const arr=w[n]||[], rest=new Set(), cnt={early:0,mid:0,night:0};
    for(let d=0;d<7;d++){ const v=arr[d]||""; if(v==="rest"||v==="") rest.add(d); else if(cnt[v]!==undefined) cnt[v]++; }
    if(T.isolatedRestCount(rest)>0 && !unav[n]) out.push(`${n} 上一休一`);
    for(let d=0;d<5;d++) if(arr[d]==="early"&&arr[d+1]==="early"&&arr[d+2]==="early") out.push(`${n} 三连早`);
    for(let d=0;d<7;d++) if(arr[d]==="night"&&arr[(d+1)%7]==="early"){ out.push(`${n} 晚接早`); break; }
  });
  for(let d=0;d<7;d++){
    if(enMem.filter(n=>w[n][d]==="early").length<1) out.push(`周${d+1} 保障组缺早`);
    if(enMem.filter(n=>w[n][d]==="night").length<1) out.push(`周${d+1} 保障组缺晚`);
    if(ocMem.filter(n=>(roles[n]||[])[d]==="open").length<1)  out.push(`周${d+1} 开店缺`);
    if(ocMem.filter(n=>(roles[n]||[])[d]==="close").length<2) out.push(`周${d+1} 闭店缺`);
  }
  T.checkRuleViolations(w,R).forEach(x=>out.push(x));
  return out;
}
function panelText(){
  const b=(els["healthBox"]||{}).innerHTML||"";
  return b.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

let violRounds=0, panelFlagged=0, missed=[], falseAlarm=0, cleanRounds=0;
for(let r=0;r<ROUNDS;r++){
  const reqs=genReqs();
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  S.requests=reqs.map(x=>Object.assign({},x));
  T.repatchWeek(true);                       // silent：不弹提示，只看结果
  const v=auditCount();
  // 面板：走和用户看到的一样的入口
  T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
  const txt=panelText();
  const flagged = /❌/.test(txt) || /缺/.test(txt) || /上一休一/.test(txt) || /连续 3 天早班/.test(txt) || /晚班接/.test(txt);
  if(v.length){ violRounds++; if(flagged) panelFlagged++; else missed.push("第"+(r+1)+"轮："+v.slice(0,3).join("、")); }
  else { cleanRounds++; if(flagged) falseAlarm++; }
}
console.log("══════ 微调残留违规 · 体检面板覆盖率（"+ROUNDS+" 轮 × "+NREQ+" 条安排）══════\n");
console.log("  微调后留下违规的轮次：      " + violRounds + " / " + ROUNDS +
            "（" + Math.round(violRounds/ROUNDS*100) + "%）");
console.log("  其中体检面板**报出来了**的：  " + panelFlagged + " / " + violRounds +
            (violRounds? "（" + Math.round(panelFlagged/violRounds*100) + "%）" : ""));
console.log("  面板漏报（假绿灯）：        " + (violRounds-panelFlagged));
console.log("  微调本来就没问题的轮次：    " + cleanRounds + " ／ 其中面板误报：" + falseAlarm);
if(missed.length){
  console.log("\n  【面板漏报样本】");
  missed.slice(0,6).forEach(m=>console.log("    · " + m));
}
console.log("\n  结论：" + (violRounds-panelFlagged === 0
  ? "面板全覆盖 ✅ —— 用户不会拿到「✅ 全部安排已满足」却藏着违规的假绿灯"
  : "面板有漏 ❌ —— 属于假绿灯，必须修面板"));
