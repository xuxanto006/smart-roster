/**
 * 定位「早晚保障组 / 开店闭店组」偶发违规的来源：
 * 在 fillGaps 前后各测一次分组保障达标情况，判断是选优阶段就带病，还是补位后处理改坏的。
 */
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1] + `
;
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF, groupMembers, restTotalCap };
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
const st = T.state();

const DAY = ["周一","周二","周三","周四","周五","周六","周日"];
const S = ["early","mid","night"];

/* 分组保障违约（作用在 week: name -> [7] 上） */
function groupViol(week){
  const out = [];
  const enM = T.groupMembers("earlyNight"), en = st.groups.earlyNight;
  const ocM = T.groupMembers("openClose"), oc = st.groups.openClose;
  if(enM.length && en){
    for(let d=0; d<7; d++){
      const e = enM.filter(n=>week[n] && week[n][d]==="early").length;
      const g = enM.filter(n=>week[n] && week[n][d]==="night").length;
      if(e < (en.minEarly||0)) out.push(`早晚保障组早班 ${DAY[d]} 需${en.minEarly} 实${e}`);
      if(g < (en.minNight||0)) out.push(`早晚保障组晚班 ${DAY[d]} 需${en.minNight} 实${g}`);
    }
  }
  if(ocM.length && oc){
    for(let d=0; d<7; d++){
      const e = ocM.filter(n=>week[n] && week[n][d]==="early").length;
      const g = ocM.filter(n=>week[n] && week[n][d]==="night").length;
      if(e < (oc.open||0))  out.push(`开店组早班 ${DAY[d]} 需${oc.open} 实${e}`);
      if(g < (oc.close||0)) out.push(`闭店组晚班 ${DAY[d]} 需${oc.close} 实${g}`);
    }
  }
  return out;
}
/* 槽位缺口 */
function slotGaps(week){
  let g = 0;
  for(let d=0; d<7; d++) S.forEach(sh=>{
    const need = +st.needs[d][sh]||0;
    const have = st.staff.filter(n=> week[n] && week[n][d]===sh).length;
    if(have < need) g += need - have;
  });
  return g;
}

/* 包一层 fillGaps，记录前后差异 */
const stats = {trials:0, before:0, after:0, introduced:0, fixed:0, called:0, gapBefore:0};
const origFillGaps = ctx.fillGaps;
let snapBefore = null;
ctx.fillGaps = function(week, R, allowOverfill){
  snapBefore = {v: groupViol(week), gap: slotGaps(week)};
  const r = origFillGaps(week, R, allowOverfill);
  const vAfter = groupViol(week);
  stats.called++;
  stats.gapBefore += snapBefore.gap;
  if(snapBefore.v.length) stats.before++;
  if(vAfter.length) stats.after++;
  if(vAfter.length > snapBefore.v.length){
    stats.introduced++;
    console.log(`  ⚠️  fillGaps 引入违规（第 ${stats.called} 次调用，补位前缺口 ${snapBefore.gap}）`);
    console.log(`      补位前：${snapBefore.v.join("；") || "（无违规）"}`);
    console.log(`      补位后：${vAfter.join("；")}`);
  }else if(vAfter.length < snapBefore.v.length){
    stats.fixed++;
  }
  return r;
};

store = { "shiftScheduler_v2": JSON.stringify({
  staff: T.DEFAULT_STAFF.slice(), needsV:3, needs:null,
  limits:{early:3,night:4,mid:99}, requests:[], schedule:{}, roles:{}
})};
vm.runInContext("load(); state.staff = DEFAULT_STAFF.slice();", sandbox);

const TRIALS = +(process.argv[2] || 60);
console.log("=".repeat(72));
console.log(`fillGaps 归因诊断 —— 连续跑 ${TRIALS} 次排班`);
console.log("=".repeat(72));

let finalBad = 0;
for(let t=0; t<TRIALS; t++){
  vm.runInContext("autoSchedule();", sandbox);
  const week = st.schedule[T.curKey()];
  const v = groupViol(week);
  if(v.length){
    finalBad++;
    console.log(`\n[第 ${t+1} 次] 最终结果仍有违规：${v.join("；")}`);
  }
}

console.log("\n" + "-".repeat(72));
console.log("统计");
console.log("-".repeat(72));
console.log(`  排班次数                ${TRIALS}`);
console.log(`  fillGaps 调用次数       ${stats.called}`);
console.log(`  fillGaps 前平均缺口     ${(stats.gapBefore/(stats.called||1)).toFixed(2)} 个班次`);
console.log(`  fillGaps 执行前有违规   ${stats.before} 次  ← 选优阶段就带病`);
console.log(`  fillGaps 执行后有违规   ${stats.after} 次`);
console.log(`  fillGaps 引入新违规     ${stats.introduced} 次  ← 后处理改坏`);
console.log(`  fillGaps 修好了违规     ${stats.fixed} 次`);
console.log(`  最终结果仍有违规        ${finalBad} / ${TRIALS}`);
console.log("-".repeat(72));
