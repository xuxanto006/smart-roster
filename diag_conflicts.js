/**
 * 规则矛盾体检 —— 只检测、只报告，不修改任何规则 / 配置
 * 覆盖：配置层面的可行性 + 实际排班结果的每条硬约束
 */
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1] + `
;
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF,
  groupMembers, restTotalCap, isolatedRestCount, hasEarlyRun3, buildRules };
`;

function makeEl(){
  const handlers = {};
  return {
    _children:[], style:{}, dataset:{}, options:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){}, removeAttribute(){}, getAttribute(){return null},
    appendChild(){}, addEventListener(ev,fn){handlers[ev]=fn;},
    querySelectorAll(){return[]}, querySelector(){return null},
    get firstChild(){return null}, get lastChild(){return null},
    set innerHTML(v){this._html=v;}, get innerHTML(){return this._html||"";},
    set textContent(v){this._text=v;}, get textContent(){return this._text||"";},
    set value(v){this._value=v;}, get value(){return this._value||"";},
    get disabled(){return false}, set disabled(v){},
    get title(){return ""}, set title(v){},
    get className(){return ""}, set className(v){},
    focus(){}, select(){}, blur(){}, click(){},
    getBoundingClientRect(){return{width:0,height:0,left:0,top:0,bottom:0,right:0};},
    contains(){return false;},
  };
}
const elements = new Map();
const document = {
  getElementById(id){ if(!elements.has(id)) elements.set(id, makeEl()); return elements.get(id); },
  createElement(){ return makeEl(); }, querySelector(){ return makeEl(); },
  querySelectorAll(){ return []; }, body: makeEl(), addEventListener(){}, removeEventListener(){},
};
let store = {};
const localStorage = {
  getItem(k){ return store[k]||null; }, setItem(k,v){ store[k]=String(v); },
  removeItem(k){ delete store[k]; }, clear(){ store={}; },
};
const ctx = { Math, Date, JSON, Array, Object, Number, String, Boolean, Set, Map, console,
  localStorage, document, setTimeout:()=>{}, clearTimeout:()=>{},
  window:null, alert:()=>{}, prompt:()=>null, confirm:()=>true,
  performance:{now:()=>Date.now()} };
ctx.window = ctx; ctx.globalThis = ctx;
const sandbox = vm.createContext(ctx);
vm.runInContext(scriptSrc, sandbox, {filename:"app.js"});
const T = ctx.__T;

const DAY = ["周一","周二","周三","周四","周五","周六","周日"];
const SHN = {early:"早班", mid:"中班", night:"晚班"};
const S = ["early","mid","night"];

const issues = [];   // 配置层面
const viol   = {};   // 实际结果层面：key -> {count, sample}

function addIssue(level, title, detail, fix){ issues.push({level, title, detail, fix}); }
function addViol(key, msg){
  if(!viol[key]) viol[key] = {count:0, samples:[]};
  viol[key].count++;
  if(viol[key].samples.length < 3) viol[key].samples.push(msg);
}

/* ============ 一、配置层面：这些矛盾在排班前就能算出来 ============ */
function checkConfig(){
  const st = T.state();
  const N = st.staff.length;
  const restPer  = st.restMax.per || 2;
  const restCap  = T.restTotalCap();
  const workPer  = 7 - restPer;
  const capacity = N * workPer;

  const needByShift = {early:0, mid:0, night:0};
  st.needs.forEach(d=>{ S.forEach(sh=>{ needByShift[sh] += (+d[sh]||0); }); });
  const demand = needByShift.early + needByShift.mid + needByShift.night;

  console.log("\n【当前配置快照】");
  console.log(`  人数 ${N} ｜ 每人每周最多休 ${restPer} 天（即上 ${workPer} 天）｜ 全队休息上限 ${restCap} 人日`);
  console.log(`  每周需求：早 ${needByShift.early} ｜ 中 ${needByShift.mid} ｜ 晚 ${needByShift.night} ｜ 合计 ${demand} 人次`);
  console.log(`  每周可供给：${N} × ${workPer} = ${capacity} 人次`);
  console.log(`  班次上限：早 ≤${st.limits.early}/人 ｜ 晚 ≤${st.limits.night}/人 ｜ 中班不设限`);
  console.log(`  人数固定班次：${(st.exactShifts||[]).map(s=>SHN[s]).join("、")||"（无）"}`);

  // 1. 人力不足
  if(demand > capacity){
    addIssue("错误","人力不足，班次必然排不满",
      `每周需求 ${demand} 人次，但 ${N} 人 × 上 ${workPer} 天 = ${capacity} 人次，缺口 ${demand-capacity} 人次。`,
      `增加人手 / 降低需求 / 把「每人最多休 ${restPer} 天」调小（让人多上班）。`);
  }
  // 2. 班次上限卡死
  S.forEach(sh=>{
    const lim = st.limits[sh] || 99;
    if(needByShift[sh] > N * lim){
      addIssue("错误", `${SHN[sh]}上限卡死`,
        `${SHN[sh]}需求 ${needByShift[sh]} 人次，但 ${N} 人 × 上限 ${lim} = ${N*lim} 人次，上限封死。`,
        `放宽${SHN[sh]}上限，或降低${SHN[sh]}需求。`);
    }
  });
  // 3. 两个休息配额互相打架
  if(restCap < restPer * N){
    addIssue("警告","两个休息配额互相冲突",
      `「全队每周最多休 ${restCap} 人日」<「每人最多休 ${restPer} 天 × ${N} 人 = ${restPer*N} 人日」，差 ${restPer*N-restCap} 人日。`,
      `结果：不是每个人都能休满 ${restPer} 天，会有人少休。若要人人休满，把全队上限调到 ${restPer*N} 或以上。`);
  }
  // 4. 富余人力 + 人数固定班次 → 无处安放
  if(capacity > demand){
    const surplus = capacity - demand;
    const exact = st.exactShifts || [];
    const flex  = ["early","night"].filter(sh=>!exact.includes(sh));
    const flexRoom = flex.reduce((s,sh)=> s + Math.max(0, N*(st.limits[sh]||99) - needByShift[sh]), 0);
    if(exact.length){
      if(surplus > flexRoom){
        addIssue("警告","富余人力无处安放，会出现空白格",
          `可供给 ${capacity} > 需求 ${demand}，富余 ${surplus} 人次；但「人数固定」的${exact.map(s=>SHN[s]).join("、")}不能多排，可吸收的班次余量只有 ${flexRoom} 人次，多出 ${surplus-flexRoom} 人次排不出去。`,
          `减少人手 / 提高需求 / 取消部分班次的「人数固定」/ 放宽晚班上限。`);
      }else{
        addIssue("提示","富余人力被摊到非固定班次",
          `富余 ${surplus} 人次会补到${flex.map(s=>SHN[s]).join("、")}，这些班次实际人数会多于最低需求；${exact.map(s=>SHN[s]).join("、")}保持恰好等于需求。`,
          ``);
      }
    }
  }
  // 5. 禁止连续 3 早班 的容量上限
  //    7 天里不出现连续 3 天早班 → 单人每周最多 5 天早班（如 早早晚早早晚早）
  const maxEarlyByRun = 5;
  const earlyCap = N * Math.min(st.limits.early||99, maxEarlyByRun);
  if(needByShift.early > earlyCap){
    addIssue("错误","早班需求与「不连续 3 个早班」冲突",
      `早班需求 ${needByShift.early} 人次；受「不连续 3 早班」限制每人每周最多 ${maxEarlyByRun} 天早班，且上限 ${st.limits.early}，合计天花板 ${earlyCap} 人次。`,
      `降低早班需求 / 增加人手 / 放宽该规则。`);
  }
  // 6. 早晚保障组
  const enM = T.groupMembers("earlyNight");
  const en = st.groups.earlyNight;
  if(enM.length){
    const perDay = (en.minEarly||0) + (en.minNight||0);
    if(perDay > enM.length){
      addIssue("错误","早晚保障组成员不够",
        `该组每天需至少 ${en.minEarly} 早 + ${en.minNight} 晚 = ${perDay} 人，但组内只有 ${enM.length} 人，且同一人不能同时上早班和晚班。`,
        `增加成员 / 调低保障人数。`);
    }
    // 组内若有人整周请假，某天可能凑不齐
    const offCnt = {};
    st.requests.forEach(r=>{ if(r.type==="off" && enM.includes(r.name)) offCnt[r.day]=(offCnt[r.day]||0)+1; });
    Object.keys(offCnt).forEach(d=>{
      if(enM.length - offCnt[d] < perDay){
        addIssue("错误",`早晚保障组在${DAY[d]}凑不齐人`,
          `${DAY[d]}组内有 ${offCnt[d]} 人请假，剩余 ${enM.length-offCnt[d]} 人 < 需要的 ${perDay} 人。`,
          `调整该组成员的请假日期。`);
      }
    });
  }
  // 7. 开店闭店组角色容量
  const ocM = T.groupMembers("openClose");
  const oc = st.groups.openClose;
  if(ocM.length){
    const needRoles = ((oc.open||0)+(oc.close||0)) * 7;
    const maxRoles  = ocM.length * (oc.maxPerWeek||3);
    if(needRoles > maxRoles){
      addIssue("错误","开店闭店组角色名额不够",
        `每天 ${oc.open} 开店 + ${oc.close} 闭店，一周需 ${needRoles} 人次；但 ${ocM.length} 人 × 每人每周最多 ${oc.maxPerWeek} 次 = ${maxRoles} 人次。`,
        `增加组成员 / 调大「每人每周最多 ${oc.maxPerWeek} 次」。`);
    }
    const perDayEarly = oc.open||0, perDayNight = oc.close||0;
    if(perDayEarly > ocM.length || perDayNight > ocM.length){
      addIssue("错误","开店闭店组每天要的人数超过组人数",
        `每天需 ${perDayEarly} 人早班(开店) + ${perDayNight} 人晚班(闭店)，组内共 ${ocM.length} 人。`,
        `增加成员 / 调低开店闭店人数。`);
    }
  }
  // 8. 上一休一 + 休息天数：N 天休息能否既不孤立又不（尽量）连续
  if(restPer >= 3){
    addIssue("警告",`「最多休 ${restPer} 天」与「不上一休一」空间很紧`,
      `一周 ${restPer} 个休息日，要求任意两个休息日不能只隔 1 个工作日、又尽量不连休，可行组合非常少，容易排不出或被迫违反其中一条。`,
      `确认是否真的需要休 ${restPer} 天；如需要，建议允许连休。`);
  }
  // 9. 周末连上早班 ≤1 人 与 开店闭店组的关系
  if(ocM.length && (oc.open||0) > 0){
    addIssue("提示","「周末连上早班 ≤1 人」与开店闭店组互相挤压",
      `开店闭店组每天需要 ${oc.open} 人早班，周六、周日若都是同一人，就占掉了全局唯一的「周末连上早班」名额，其他所有人都不能在周末连上早班。`,
      `如需严格保证 ≤1 人，建议开店闭店组在周末换人开店。`);
  }
}

/* ============ 二、实际结果层面：跑多次排班，逐条硬约束校验 ============ */
function checkResults(trials){
  const st = T.state();
  const N = st.staff.length;
  const restPer = st.restMax.per || 2;
  const restCap = T.restTotalCap();
  const enM = T.groupMembers("earlyNight");
  const en  = st.groups.earlyNight;
  const ocM = T.groupMembers("openClose");
  const oc  = st.groups.openClose;
  const exact = st.exactShifts || [];

  for(let t=0; t<trials; t++){
    vm.runInContext("autoSchedule();", sandbox);
    const week = st.schedule[T.curKey()];
    const names = st.staff;
    const get = (n,d)=> week[n][d];

    // 每人休息天数
    names.forEach(n=>{
      const r = [0,1,2,3,4,5,6].filter(d=>get(n,d)==="rest").length;
      if(r > restPer) addViol(`每人休息超过 ${restPer} 天`, `${n} 休 ${r} 天`);
    });
    // 全队休息总数
    const totalRest = names.reduce((s,n)=> s + [0,1,2,3,4,5,6].filter(d=>get(n,d)==="rest").length, 0);
    if(totalRest > restCap) addViol("全队休息总数超上限", `实际 ${totalRest} > 上限 ${restCap}`);
    // 上一休一（孤立休息日）
    names.forEach(n=>{
      const set = new Set([0,1,2,3,4,5,6].filter(d=>get(n,d)==="rest"));
      if(T.isolatedRestCount(set) > 0) addViol("违反「不能上一休一」", `${n} 休息日 ${[...set].map(d=>DAY[d]).join("、")}`);
    });
    // 连续 3 早班
    names.forEach(n=>{
      if(T.hasEarlyRun3(d=>get(n,d))) addViol("出现连续 3 个早班", `${n}：${[0,1,2,3,4,5,6].map(d=>get(n,d)==="early"?"早":"·").join("")}`);
    });
    // 晚班次日接早班
    names.forEach(n=>{
      for(let d=0; d<7; d++){
        if(get(n,d)==="night" && get(n,(d+1)%7)==="early") addViol("晚班次日接早班", `${n} ${DAY[d]}晚 → ${DAY[(d+1)%7]}早`);
      }
    });
    // 班次上限
    names.forEach(n=>{
      const c = {early:0, mid:0, night:0};
      for(let d=0; d<7; d++){ const v=get(n,d); if(c[v]!==undefined) c[v]++; }
      S.forEach(sh=>{ if(c[sh] > (st.limits[sh]||99)) addViol(`${SHN[sh]}超过每人上限`, `${n} ${c[sh]} 次 > 上限 ${st.limits[sh]}`); });
    });
    // 人数固定班次是否恰好
    exact.forEach(sh=>{
      for(let d=0; d<7; d++){
        const need = +st.needs[d][sh]||0;
        const have = names.filter(n=>get(n,d)===sh).length;
        if(have !== need) addViol(`${SHN[sh]}人数不固定`, `${DAY[d]} 需求 ${need} 实际 ${have}`);
      }
    });
    // 班次需求是否满足（≥）
    for(let d=0; d<7; d++){
      S.forEach(sh=>{
        const need = +st.needs[d][sh]||0;
        const have = names.filter(n=>get(n,d)===sh).length;
        if(have < need) addViol("班次未排满", `${DAY[d]}${SHN[sh]} 需 ${need} 实 ${have}`);
      });
    }
    // 早晚保障组
    if(enM.length){
      for(let d=0; d<7; d++){
        const e = enM.filter(n=>get(n,d)==="early").length;
        const g = enM.filter(n=>get(n,d)==="night").length;
        if(e < (en.minEarly||0)) addViol("早晚保障组早班不足", `${DAY[d]} 需 ${en.minEarly} 实 ${e}`);
        if(g < (en.minNight||0)) addViol("早晚保障组晚班不足", `${DAY[d]} 需 ${en.minNight} 实 ${g}`);
      }
    }
    // 开店闭店组：每天至少 open 早 + close 晚（否则挑不出人标角色）
    if(ocM.length){
      for(let d=0; d<7; d++){
        const e = ocM.filter(n=>get(n,d)==="early").length;
        const g = ocM.filter(n=>get(n,d)==="night").length;
        if(e < (oc.open||0))  addViol("开店闭店组早班不足（标不出开店）", `${DAY[d]} 需 ${oc.open} 实 ${e}`);
        if(g < (oc.close||0)) addViol("开店闭店组晚班不足（标不出闭店）", `${DAY[d]} 需 ${oc.close} 实 ${g}`);
      }
    }
    // 周末连上早班 ≤1 人
    const both = names.filter(n=>get(n,5)==="early" && get(n,6)==="early");
    if(both.length > 1) addViol("周末连上早班超过 1 人", `${both.join("、")}（共 ${both.length} 人）`);
  }
}

/* ============ 输出 ============ */
store = { "shiftScheduler_v2": JSON.stringify({
  staff: T.DEFAULT_STAFF.slice(), needsV:3, needs:null,
  limits:{early:3,night:4,mid:99}, requests:[], schedule:{}, roles:{}
})};
vm.runInContext("load(); state.staff = DEFAULT_STAFF.slice();", sandbox);

console.log("=".repeat(72));
console.log("规则矛盾体检报告（只检测，不修改任何规则）");
console.log("=".repeat(72));

checkConfig();

console.log("\n" + "-".repeat(72));
console.log("一、配置层面的矛盾");
console.log("-".repeat(72));
if(issues.length === 0){
  console.log("  ✅ 未发现配置层面的矛盾");
}else{
  const order = {错误:0, 警告:1, 提示:2};
  issues.sort((a,b)=> order[a.level]-order[b.level]);
  issues.forEach((x,i)=>{
    const icon = x.level==="错误" ? "❌" : (x.level==="警告" ? "⚠️ " : "ℹ️ ");
    console.log(`\n  ${icon} [${x.level}] ${i+1}. ${x.title}`);
    console.log(`     ${x.detail}`);
    if(x.fix) console.log(`     👉 建议：${x.fix}`);
  });
}

const TRIALS = +(process.argv[2]||20);
checkResults(TRIALS);

console.log("\n" + "-".repeat(72));
console.log(`二、实际排班结果校验（连续跑 ${TRIALS} 次）`);
console.log("-".repeat(72));
const keys = Object.keys(viol);
if(keys.length === 0){
  console.log("  ✅ 全部硬约束均满足，无违规");
}else{
  keys.sort((a,b)=> viol[b].count - viol[a].count);
  keys.forEach(k=>{
    const v = viol[k];
    console.log(`\n  ❌ ${k} —— 共 ${v.count} 次（${TRIALS} 次排班）`);
    v.samples.forEach(s=> console.log(`       · ${s}`));
  });
}

console.log("\n" + "=".repeat(72));
console.log(`汇总：配置层面 ${issues.filter(x=>x.level==="错误").length} 个错误、${issues.filter(x=>x.level==="警告").length} 个警告、${issues.filter(x=>x.level==="提示").length} 个提示`);
console.log(`      结果层面 ${keys.length} 类约束被违反`);
console.log("=".repeat(72));
