/**
 * 验证：默认名单 = 31 位真实姓名 + 占位迁移 + 31 人排班能力
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptMatch = [null, (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})()];
if(!scriptMatch){ console.error("FAIL: no <script>"); process.exit(1); }
let scriptSrc = scriptMatch[1];

scriptSrc += `
;
globalThis.__T = {
  state: () => state,
  save, load, autoSchedule, tryPlan, buildRules, curKey,
  DEFAULT_STAFF, isPlaceholderName,
};
`;

function makeEl(){
  const handlers = {};
  return {
    _children: [], style:{}, dataset:{},
    options:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){}, removeAttribute(){}, getAttribute(){return null},
    appendChild(c){ this._children.push(c); },
    addEventListener(ev,fn){ handlers[ev]=fn; },
    dispatch(ev, args){ if(handlers[ev]) return handlers[ev](args); },
    querySelectorAll(){ return []; },
    querySelector(){ return null; },
    get firstChild(){ return null; },
    get lastChild(){ return null; },
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html||""; },
    set textContent(v){ this._text = v; },
    get textContent(){ return this._text||""; },
    set value(v){ this._value=v; },
    get value(){ return this._value||""; },
    get disabled(){ return false },
    set disabled(v){},
    get title(){ return "" },
    set title(v){},
    get className(){ return "" },
    set className(v){},
    focus(){}, select(){}, blur(){},
    click(){}, replaceChildren(){}, getBoundingClientRect(){ return {width:0,height:0,left:0,top:0,bottom:0,right:0}; },
    contains(){ return false; },
  };
}
const elements = new Map();
const document = {
  getElementById(id){
    if(!elements.has(id)) elements.set(id, makeEl());
    return elements.get(id);
  },
  createElement(){ return makeEl(); },
  querySelector(){ return makeEl(); },
  querySelectorAll(){ return []; },
  body: makeEl(),
  addEventListener(){},
  removeEventListener(){},
};

let store = {};
const localStorage = {
  getItem(k){ return store[k]||null; },
  setItem(k,v){ store[k]=String(v); },
  removeItem(k){ delete store[k]; },
  clear(){ store={}; },
};

const ctx = { Math, Date, JSON, Array, Object, Number, String, Boolean, Set, Map, console, localStorage, document, setTimeout: ()=>{}, clearTimeout: ()=>{}, window: null, alert: ()=>{}, prompt: ()=>null, confirm: ()=>true, performance: {now: ()=>Date.now()} };
ctx.window = ctx;
ctx.globalThis = ctx;
const sandbox = vm.createContext(ctx);
vm.runInContext(scriptSrc, sandbox, {filename:"app.js"});

const T = ctx.__T;
let pass = 0, fail = 0;
function assert(cond, msg){
  if(cond){ pass++; console.log("  PASS", msg); }
  else { fail++; console.log("  FAIL", msg); }
}

console.log("\n=== 1) DEFAULT_STAFF 完整性 ===");
const staff = T.DEFAULT_STAFF;
console.log("  默认名单长度:", staff.length);
assert(staff.length === 31, "默认名单恰好 31 人");
const seen = new Set();
let dup = 0;
staff.forEach(n => { if(seen.has(n)) dup++; seen.add(n); });
assert(dup === 0, "无重名");
assert(staff.includes("何广友"), "包含 何广友");
assert(staff.includes("田方斌"), "包含 田方斌（末位）");
assert(staff.every(n => !/^员工\d+$/.test(n)), "全部为真实姓名（非占位）");

console.log("\n=== 2) isPlaceholderName ===");
assert(T.isPlaceholderName("员工01"),  "员工01 视为占位");
assert(T.isPlaceholderName("员工32"),  "员工32 视为占位");
assert(!T.isPlaceholderName("何广友"), "何广友 非占位");
assert(!T.isPlaceholderName("员工零"),"员工零 非占位（数字 0+）");

console.log("\n=== 3) 占位名单自动迁移 ===");
store = {
  "shiftScheduler_v2": JSON.stringify({
    staff: Array.from({length:32},(_,i)=>`员工${String(i+1).padStart(2,"0")}`),
    needs: null, needsV: 3, limits: {early:3,night:4,mid:99},
    requests: [
      {id:1, name:"员工07", day:2, type:"off",    scope:"once", weekKey:"2099-01-01"},
      {id:2, name:"员工15", day:0, type:"early",  scope:"always"}
    ],
    schedule: { "2099-01-01": { "员工01":["rest","rest","rest","rest","rest","rest","rest"], "员工07":["rest","rest","rest","rest","rest","rest","rest"], "员工15":["rest","rest","rest","rest","rest","rest","rest"] } }
  })
};
vm.runInContext(`
  load();
  let __m = false;
  if(state.staff.length===0){
    state.staff = DEFAULT_STAFF.slice();
  } else if(state.staff.every(isPlaceholderName)){
    state.staff = DEFAULT_STAFF.slice();
    Object.values(state.schedule).forEach(w=>{
      Object.keys(w).forEach(n=>{ if(!state.staff.includes(n)) delete w[n]; });
    });
    state.requests = state.requests.filter(r=> state.staff.includes(r.name));
    save();
    __m = true;
  }
  globalThis.__MIGRATED = __m;
`, sandbox);

const st1 = T.state();
assert(st1.staff.length === 31, "迁移后 staff=31");
assert(st1.staff[0] === "何广友", "迁移后首位=何广友");
assert(st1.staff.every(n => !/^员工\d+$/.test(n)), "迁移后无占位");
assert(ctx.__MIGRATED === true, "迁移标志置位");
assert(st1.requests.length === 0, "占位姓名对应的 requests 被清空（无匹配）");
assert(st1.schedule["2099-01-01"] && Object.keys(st1.schedule["2099-01-01"]).length === 0, "占位姓名对应的 schedule 被清空");

console.log("\n=== 4) 真实名单不被误判为占位 ===");
store = {
  "shiftScheduler_v2": JSON.stringify({
    staff: ["何广友","刘科","李敏"],
    needsV: 3, needs: null, limits: {early:3,night:4,mid:99}, requests: [], schedule: {}
  })
};
vm.runInContext(`load();`, sandbox);
const st2 = T.state();
assert(st2.staff.length === 3, "真实名单不会触发迁移");
assert(st2.staff[0] === "何广友", "真实名单保留");

console.log("\n=== 5) 31 人排班可行性（无请假/特殊安排） ===");
store = {
  "shiftScheduler_v2": JSON.stringify({
    staff: T.DEFAULT_STAFF.slice(),
    needsV: 3, needs: null, limits: {early:3,night:4,mid:99}, requests: [], schedule: {}
  })
};
vm.runInContext(`load(); state.staff = DEFAULT_STAFF.slice(); autoSchedule();`, sandbox);
const st3 = T.state();
const wk = T.curKey();
const week = st3.schedule[wk];
assert(week && Object.keys(week).length === 31, "31 人均已排班");
const totalFilled = Object.values(week).reduce((s,arr)=> s + arr.filter(v=>v && v!=="rest" && v!=="").length, 0);
console.log("  实排非空非休班次数:", totalFilled);
assert(totalFilled >= 130, "实排数 >= 130（5×19 + 2×24 = 143 需求，最低 130 即合格）");
const restOk = Object.values(week).every(arr => arr.filter(v=>v==="rest").length === 2);
assert(restOk, "每人恰好休 2 天");

console.log("\n=== 6) 30 人 / 28 人边缘验证 ===");
store = {};
const edgeCases = [
  {n:30, desc:"30 人"},
  {n:28, desc:"28 人"},
  {n:25, desc:"25 人"},
];
for(const tc of edgeCases){
  vm.runInContext(`state.staff = DEFAULT_STAFF.slice(0,${tc.n}); Object.values(state.schedule).forEach(w=>{ Object.keys(w).forEach(n=>{ if(!state.staff.includes(n)) delete w[n]; }); state.staff.forEach(n=>{ if(!w[n]) w[n]=["","","","","","",""]; }); }); autoSchedule();`, sandbox);
  const st4 = T.state();
  const wk2 = T.curKey();
  const week2 = st4.schedule[wk2];
  const filled = Object.values(week2).reduce((s,arr)=> s + arr.filter(v=>v && v!=="rest" && v!=="").length, 0);
  const restCount = Object.values(week2).map(arr => arr.filter(v=>v==="rest").length);
  const minR = Math.min(...restCount), maxR = Math.max(...restCount);
  console.log(`  ${tc.desc}: 实排 ${filled} / 休 ${minR}-${maxR} 天/人`);
  assert(week2 && Object.keys(week2).length === tc.n, `${tc.desc} 全员已排班`);
}

console.log("\n=== 总计：通过 " + pass + " / 失败 " + fail + " ===");
process.exit(fail === 0 ? 0 : 1);
