/**
 * 诊断：自动排班后，每天各班次的「实际需求 vs 实际排班」
 * 重点看工作日早班是不是恰好 8 人（还是 ≥8 被多排了）
 */
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1] + `
;
globalThis.__T = { state: () => state, autoSchedule, curKey, DEFAULT_STAFF };
`;

function makeEl(){
  const handlers = {};
  return {
    _children: [], style:{}, dataset:{}, options:[],
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
    getBoundingClientRect(){return {width:0,height:0,left:0,top:0,bottom:0,right:0};},
    contains(){return false;},
  };
}
const elements = new Map();
const document = {
  getElementById(id){ if(!elements.has(id)) elements.set(id, makeEl()); return elements.get(id); },
  createElement(){ return makeEl(); },
  querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
  body: makeEl(), addEventListener(){}, removeEventListener(){},
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
const SH  = {early:"早", mid:"中", night:"晚"};

function report(label){
  const st = T.state();
  const wk = T.curKey();
  const week = st.schedule[wk];
  const names = st.staff;
  console.log(`\n${"=".repeat(64)}\n${label}\n${"=".repeat(64)}`);
  console.log("日期   班次   需求   实际   差值   备注");
  console.log("-".repeat(64));
  let totalNeed = 0, totalHave = 0;
  const earlyRow = [];
  for(let d=0; d<7; d++){
    for(const sh of ["early","mid","night"]){
      const need = +st.needs[d][sh] || 0;
      const have = names.filter(n => week[n][d] === sh).length;
      totalNeed += need; totalHave += have;
      const diff = have - need;
      const flag = diff === 0 ? "✓" : (diff > 0 ? `多${diff}` : `缺${-diff}`);
      console.log(`${DAY[d]}   ${SH[sh]}班    ${String(need).padStart(3)}   ${String(have).padStart(4)}   ${String(diff).padStart(4)}   ${flag}`);
      if(sh === "early") earlyRow.push({d, need, have});
    }
  }
  console.log("-".repeat(64));
  console.log(`合计：需求 ${totalNeed} 人次，实排 ${totalHave} 人次，差 ${totalHave-totalNeed}`);

  // 聚焦：工作日早班
  const wd = earlyRow.slice(0,5), we = earlyRow.slice(5);
  console.log(`\n【工作日早班】需求 ${wd[0].need} 人/天 → 实际 ${wd.map(x=>x.have).join(",")}`);
  console.log(`【周末早班】  需求 ${we[0].need} 人/天 → 实际 ${we.map(x=>x.have).join(",")}`);
  const wdOver = wd.filter(x=>x.have !== x.need);
  console.log(wdOver.length
    ? `⚠️  工作日有 ${wdOver.length} 天早班不等于 ${wd[0].need}：${wdOver.map(x=>DAY[x.d]+"="+x.have).join("、")}`
    : `✅  工作日早班每天恰好 ${wd[0].need} 人`);

  // 休息天数分布
  const restDist = {};
  names.forEach(n=>{
    const r = [0,1,2,3,4,5,6].filter(d=>week[n][d]==="rest").length;
    restDist[r] = (restDist[r]||0)+1;
  });
  console.log(`\n【休息天数分布】${Object.keys(restDist).sort().map(k=>`休${k}天:${restDist[k]}人`).join("  ")}`);

  // 周日+周六连上早班的人数
  const bothEarly = names.filter(n => week[n][5]==="early" && week[n][6]==="early");
  console.log(`【周末连上早班】（周六早+周日早）共 ${bothEarly.length} 人：${bothEarly.join("、")||"无"}`);
  return {week, names};
}

// 场景1：默认 31 人，无任何请假安排
store = { "shiftScheduler_v2": JSON.stringify({
  staff: T.DEFAULT_STAFF.slice(), needsV:3, needs:null,
  limits:{early:3,night:4,mid:99}, requests:[], schedule:{}, roles:{}
})};
vm.runInContext(`load(); state.staff = DEFAULT_STAFF.slice(); autoSchedule();`, sandbox);
report("场景1：31 人默认需求（工作日 早≥8 中1 晚≥10；周末 早9 中3 晚≥12）");

// 跑 5 次看稳定性
console.log(`\n\n${"#".repeat(64)}\n稳定性：重复排班 5 次，只看「工作日早班每天实际人数」\n${"#".repeat(64)}`);
for(let t=1; t<=5; t++){
  vm.runInContext(`autoSchedule();`, sandbox);
  const st = T.state(), week = st.schedule[T.curKey()];
  const row = [0,1,2,3,4,5,6].map(d=> st.staff.filter(n=>week[n][d]==="early").length);
  const wd = row.slice(0,5);
  console.log(`  第${t}次：工作日早班 = [${wd.join(",")}]  ${wd.every(x=>x===8)?"✅ 全为8":"⚠️ 有偏离"}   （周末 [${row.slice(5).join(",")}]）`);
}
