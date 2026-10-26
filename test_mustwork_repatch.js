/** 「固定上班日」在「按请假/改班微调」路径下是否也被遵守
    autoSchedule 和 repatchWeek 是两套完全不同的代码，必须分开验 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,renderHealth,hasRestPlan,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

function reset(extraReqs){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.schedule={}; S.roles={}; S.roleSig={}; S.manual={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.requests = extraReqs || [];
}
/* 模拟用户在表格里点格子改班次（setCell 会写 manual 标记） */
function markManual(name, day){
  const k=T.curKey();
  (S.manual[k] = S.manual[k] || {})[name+"|"+day] = 1;
}

/* 硬约束全量体检 */
function audit(tag){
  const w=T.ensureWeek(T.curKey());
  const R=T.buildRules(T.curKey());
  const out=[];
  // 固定上班日
  (S.mustWork||[]).forEach(function(m){
    const v=w[m.name] ? w[m.name][m.day] : "";
    if(v==="rest"||!v) out.push(`${tag} 固定上班日被违反：${m.name} 周${m.day+1}=${v||"空"}`);
  });
  // 请假/改班（含 mustWork 编译出来的 noOff）
  T.checkRuleViolations(w,R).forEach(function(x){ out.push(tag+" "+x); });
  // 上一休一
  S.staff.forEach(function(n){
    var s=new Set();
    for(var d=0;d<7;d++) if(w[n][d]==="rest"||!w[n][d]) s.add(d);
    if(T.isolatedRestCount(s)>0) out.push(`${tag} ${n} 出现上一休一`);
  });
  // 休息天数
  S.staff.forEach(function(n){
    const r=(w[n]||[]).filter(function(v){return v==="rest";}).length;
    if(r!==2) out.push(`${tag} ${n} 休 ${r} 天（应为 2）`);
  });
  return out;
}

console.log("══════ 固定上班日 · 微调（repatchWeek）路径测试 ══════");

/* 一、手动把某些格子改成「休」→ 微调。
   契约：手动修改必须被保留（不能悄悄改回去），但固定上班日 / 请假规则必须继续满足，
        被抽走的班次要补回来。至于「休 3 天」「上一休一」是用户自己改出来的后果，
        不该由微调擅自覆盖 —— 那是「本周体检」面板负责列出来给人看的。 */
console.log("\n— 一、手动改格子 → 微调 30 轮 —");
let bad=[], keptManual=0, totalManual=0, refilled=0;
for(let i=0;i<30;i++){
  reset();
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey());
  const picks=[];
  for(let t=0;t<2;t++){
    const n=S.staff[Math.floor(Math.random()*S.staff.length)];
    const d=Math.floor(Math.random()*7);
    if(S.mustWork.some(function(m){return m.name===n && m.day===d;})) continue; // 不动固定上班日
    const before=w[n][d];
    if(before==="rest") continue;
    w[n][d]="rest";
    markManual(n,d);          // 与 setCell 一致：手动改动要登记
    picks.push({n:n, d:d, before:before, after:"rest"});
  }
  if(!picks.length) continue;
  const snap = picks.map(function(p){ return p.n+"|"+p.d; });
  T.repatchWeek();
  const w2=T.ensureWeek(T.curKey());
  // ① 手动改的「休」被保留
  snap.forEach(function(s){
    totalManual++;
    const a=s.split("|");
    if(w2[a[0]][+a[1]]==="rest") keptManual++;
  });
  // ② 固定上班日 / 请假规则 / 上一休一 / 休息天数 —— 只查前两项，后两项是手动编辑的后果
  const R2=T.buildRules(T.curKey());
  T.checkRuleViolations(w2,R2).forEach(function(x){ bad.push("第"+(i+1)+"次 "+x); });
  (S.mustWork||[]).forEach(function(m){
    const v=w2[m.name] ? w2[m.name][m.day] : "";
    if(v==="rest"||!v) bad.push(`第${i+1}次 固定上班日被违反：${m.name} 周${m.day+1}=${v||"空"}`);
  });
  // ③ 缺口：微调是「轻触」策略，不动其他人的班，所以补不回来的缺口必须由体检面板列出来
  const gapOf = function(wk){
    const need={}, have={};
    S.needs.forEach(function(nd,di){ ["early","mid","night"].forEach(function(sh){ need[di+"|"+sh]=+nd[sh]||0; }); });
    S.staff.forEach(function(n){ for(let d=0;d<7;d++){ const v=wk[n][d]; if(v&&v!=="rest"){ const k=d+"|"+v; have[k]=(have[k]||0)+1; } } });
    let g=0; Object.keys(need).forEach(function(k){ g+=Math.max(0,need[k]-(have[k]||0)); });
    return g;
  };
  const g = gapOf(w2);
  if(g===0) refilled++;
  else {
    // 补不回来没关系，但必须被「本周体检」报出来 —— 否则用户根本不知道有洞
    T.renderHealth(w2, R2);
    const hb = els["healthBox"] ? (els["healthBox"].innerHTML||"") : "";
    if(!/缺 \d+ 人/.test(hb)) bad.push(`第${i+1}次 有 ${g} 个缺口却没被体检面板列出`);
  }
}
expect(bad.length===0, "30 轮「手动改格子 → 微调」后固定上班日与请假规则全部满足，且缺口都被体检列出", bad.slice(0,3).join(" ｜ "));
expect(keptManual===totalManual, `手动改的「休」全部被保留（${keptManual}/${totalManual}）`,
  "被微调悄悄覆盖：" + (totalManual-keptManual) + " 处");
console.log(`     （其中 ${refilled}/30 轮微调后零缺口；补不回来的轮次是因为「每人恰好休 2 天」为零余量，需重排整周）`);

/* 二、先在名册里有人请假，微调也要保住固定上班日 */
console.log("\n— 二、带请假记录时微调 20 轮 —");
bad=[]; let excused=0;
for(let i=0;i<20;i++){
  // 随机挑 3 个「不是固定上班日」的组合当请假
  const reqs=[]; let id=1;
  const used={};
  while(reqs.length<3){
    const n=S.staff[Math.floor(Math.random()*S.staff.length)];
    const d=Math.floor(Math.random()*7);
    const key=n+"|"+d;
    if(used[key]) continue;
    if(S.mustWork.some(function(m){return m.name===n && m.day===d;})) continue;
    used[key]=1;
    reqs.push({id:id++, name:n, day:d, type:"off", scope:"once", weekKey:T.curKey()});
  }
  reset(reqs);
  // 随机请假可能让同一人请到「不相邻的两天」，那时休息日被请假钉死，
  // 「上一休一」在数学上躲不开 —— 属于规则撞车，不是排班或微调的锅。
  // 所以先算出本周哪些人是「不可避免」，审计时只豁免这些人，其余一律零违规。
  const P = Math.min(7, Math.max(0, (S.restMax && S.restMax.per) || 2));
  const R0 = T.buildRules(T.curKey());
  const unavoidable = {};
  S.staff.forEach(function(n){
    const row = R0[n]; if(!row) return;
    const off=[], must=[];
    for(let d=0; d<7; d++){ if(row[d].off) off.push(d); else if(row[d].noOff) must.push(d); }
    if(off.length<=P && must.length<=7-P && !T.hasRestPlan(off, P, must)) unavoidable[n]=1;
  });
  T.autoSchedule();
  T.repatchWeek();
  const v=audit("第"+(i+1)+"次").filter(function(x){
    if(!/出现上一休一$/.test(x)) return true;      // 其它类型的违规一律不豁免
    const who = x.split(" ")[1];
    if(unavoidable[who]){ excused++; return false; }
    return true;
  });
  if(v.length) bad=bad.concat(v.slice(0,3));
}
expect(bad.length===0, "20 轮「3 人请假 → 排班 → 微调」后无违规（不可避免的上一休一已豁免）", bad.slice(0,3).join(" ｜ "));
console.log("     （其中 " + excused + " 人次属于预检判定为「请假日不相邻、数学上躲不开」的上一休一，已豁免）");

/* 三、请假与固定上班日撞同一天：请假优先，且不该被判违规 */
console.log("\n— 三、撞车场景：陈悦娴 周一 请假 + 固定上班 —");
reset([{id:1,name:"陈悦娴",day:0,type:"off",scope:"once",weekKey:T.curKey()}]);
T.autoSchedule();
T.repatchWeek();
const w3=T.ensureWeek(T.curKey());
const R3=T.buildRules(T.curKey());
expect(w3["陈悦娴"][0]==="rest", "陈悦娴 周一 休息（请假优先）", "实际="+w3["陈悦娴"][0]);
expect(T.checkRuleViolations(w3,R3).length===0, "微调后不报错（noOff 已让位，不算违规）",
  T.checkRuleViolations(w3,R3).slice(0,2).join("，"));

/* 四、固定班次（only）与固定上班日同天 */
console.log("\n— 四、固定早班 + 固定上班日 同天 —");
reset([{id:1,name:"张淑慧",day:0,type:"early",scope:"always",weekKey:T.curKey()}]);
T.autoSchedule();
const w4=T.ensureWeek(T.curKey());
expect(w4["张淑慧"][0]==="early", "张淑慧 周一 固定为早班", "实际="+w4["张淑慧"][0]);
T.repatchWeek();
const w4b=T.ensureWeek(T.curKey());
expect(w4b["张淑慧"][0]==="early", "微调后仍是早班（不被冲掉）", "实际="+w4b["张淑慧"][0]);

/* 五、删掉固定上班日规则后，该人周一可以休息了 */
console.log("\n— 五、规则可撤销 —");
reset();
S.mustWork=[];
let restSeen=0;
for(let i=0;i<20;i++){
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey());
  if(w["陈悦娴"][0]==="rest"||w["张淑慧"][0]==="rest") restSeen++;
}
expect(restSeen>0, `删掉规则后，周一出现休息（20 次里 ${restSeen} 次）`, "一次都没有 → 规则可能没真删掉");

/* 六、给用户的操作建议是否成立：临时加请假 →「重排整周」能补上，「微调」补不上 */
console.log("\n— 六、临时加请假：重排整周 vs 只微调 —");
let fullOK=0, patchOK=0;
const ROUNDS=20;
for(let i=0;i<ROUNDS;i++){
  // 先排一周
  reset();
  T.autoSchedule();
  // 再临时加 1 条请假（选一个原本在上班的人 + 那天）
  const w0=T.ensureWeek(T.curKey());
  let target=null;
  for(let t=0;t<200 && !target;t++){
    const n=S.staff[Math.floor(Math.random()*S.staff.length)];
    const d=Math.floor(Math.random()*7);
    if(S.mustWork.some(function(m){return m.name===n && m.day===d;})) continue;
    if(w0[n][d] && w0[n][d]!=="rest") target={n:n,d:d};
  }
  if(!target) continue;
  const reqs=[{id:1, name:target.n, day:target.d, type:"off", scope:"once", weekKey:T.curKey()}];

  // A：排完班之后才请假 → 只点「微调」
  //    注意顺序：必须先用「没有这条请假」的排班，再补登记，才叫「事后请假」。
  //    反过来（先登记再排班）等于算法早就知道，测不出微调的真实能力。
  reset();
  T.autoSchedule();
  S.requests=reqs;                               // 排完班才收到请假条
  T.repatchWeek();
  const wA2=T.ensureWeek(T.curKey());
  // B：点「一键智能排班」（请假已登记，重排整周）
  reset(reqs);
  T.autoSchedule();
  const wB=T.ensureWeek(T.curKey());

  const gapOf=function(wk){
    const need={}, have={};
    S.needs.forEach(function(nd,di){ ["early","mid","night"].forEach(function(sh){ need[di+"|"+sh]=+nd[sh]||0; }); });
    S.staff.forEach(function(n){ for(let d=0;d<7;d++){ const v=wk[n][d]; if(v&&v!=="rest"){ const k=d+"|"+v; have[k]=(have[k]||0)+1; } } });
    let g=0; Object.keys(need).forEach(function(k){ g+=Math.max(0,need[k]-(have[k]||0)); });
    return g;
  };
  if(gapOf(wA2)===0) patchOK++;
  if(gapOf(wB)===0 && wB[target.n][target.d]==="rest") fullOK++;
}
expect(fullOK===ROUNDS, `「请假登记后重排整周」${fullOK}/${ROUNDS} 轮零缺口且请假生效`, "有轮次补不上");
console.log(`     （对照：只点「微调」只有 ${patchOK}/${ROUNDS} 轮能补上 —— 因为「每人恰好休 2 天」没有余量）`);

console.log("\n══════════════════════════════");
console.log(`===== 微调路径测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
