/**
 * 配置扫描：改「每人每周休几天 / 全队休息上限 / 班次上限 / 早班固定人数 / 人数」后，
 * 排班是否仍然满足全部硬约束。重点验证「可用人力跟随休息配额」这一改动没有写死。
 */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})() + `
;
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF, restTotalCap,
  isolatedRestCount, hasEarlyRun3, groupMembers, buildRules };
`;
function makeEl(){
  const h={}; return { _children:[],style:{},dataset:{},options:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){},removeAttribute(){},getAttribute(){return null},
    appendChild(){},addEventListener(e,f){h[e]=f;},querySelectorAll(){return[]},querySelector(){return null},
    get firstChild(){return null},get lastChild(){return null},
    set innerHTML(v){this._html=v;},get innerHTML(){return this._html||"";},
    set textContent(v){this._t=v;},get textContent(){return this._t||"";},
    set value(v){this._v=v;},get value(){return this._v||"";},
    get disabled(){return false},set disabled(v){},get title(){return ""},set title(v){},
    get className(){return ""},set className(v){},focus(){},select(){},blur(){},click(){},
    getBoundingClientRect(){return{width:0,height:0,left:0,top:0,bottom:0,right:0};},contains(){return false;} };
}
const els=new Map();
const document={getElementById(id){if(!els.has(id))els.set(id,makeEl());return els.get(id);},
  createElement(){return makeEl();},querySelector(){return makeEl();},querySelectorAll(){return[];},
  body:makeEl(),addEventListener(){},removeEventListener(){}};
let store={};
const localStorage={getItem(k){return store[k]||null;},setItem(k,v){store[k]=String(v);},
  removeItem(k){delete store[k];},clear(){store={};}};
const ctx={Math,Date,JSON,Array,Object,Number,String,Boolean,Set,Map,console,localStorage,document,
  setTimeout:()=>{},clearTimeout:()=>{},window:null,alert:()=>{},prompt:()=>null,confirm:()=>true,
  performance:{now:()=>Date.now()}};
ctx.window=ctx; ctx.globalThis=ctx;
const sandbox=vm.createContext(ctx);
vm.runInContext(scriptSrc,sandbox,{filename:"app.js"});
const T=ctx.__T;
const DAY=["周一","周二","周三","周四","周五","周六","周日"];

function reset(overrides){
  store={"shiftScheduler_v2":JSON.stringify({staff:T.DEFAULT_STAFF.slice(),needsV:3,needs:null,
    limits:{early:3,night:4,mid:99},requests:[],schedule:{},roles:{}})};
  vm.runInContext("load(); state.staff = DEFAULT_STAFF.slice();",sandbox);
  const st=T.state();
  // 关键：load() 是「合并」不是「重置」——存档里没写的字段会保留上一次用例的值。
  // 不显式复位的话，上一个用例设的 restMax.total=50 会泄漏到后面所有用例，
  // 让后面每个用例都掺进一个本身就不可行的配置（31人×2天=62 > 50），误报一片。
  st.staff = T.DEFAULT_STAFF.slice();
  st.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},
              {early:8,mid:1,night:10},{early:8,mid:1,night:10},
              {early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  st.limits = {early:3, night:4, mid:99};
  st.restMax = {per:2, total:0};
  st.exactShifts = ["early"];
  st.weekendEarlyMax = 1;
  st.requests = []; st.schedule = {}; st.roles = {};
  Object.assign(st, JSON.parse(JSON.stringify(overrides||{})));
}

/* 一次排班的硬约束体检，返回问题列表 */
function audit(st){
  const week = st.schedule[T.curKey()];
  const names = st.staff;
  const restPer = st.restMax.per || 2;
  const restCap = T.restTotalCap();
  const bad = [];
  const get = (n,d)=> week[n][d];
  const LIM = st.limits;
  const exact = st.exactShifts || [];
  names.forEach(n=>{
    const w = week[n];
    const r = w.filter(v=> v==="rest").length;
    if(r > restPer) bad.push(`${n} 休 ${r} 天 > ${restPer}`);
    const work = w.filter(v=> v!=="" && v!=="rest").length;
    if(work + r !== 7) bad.push(`${n} 有空格未排（上班${work}+休息${r}≠7）`);
    const set = new Set([0,1,2,3,4,5,6].filter(d=> get(n,d)==="rest"));
    if(T.isolatedRestCount(set) > 0) bad.push(`${n} 上一休一（休 ${[...set].map(d=>DAY[d]).join("、")}）`);
    if(T.hasEarlyRun3(d=> get(n,d))) bad.push(`${n} 连续 3 个早班`);
    for(let d=0; d<7; d++) if(get(n,d)==="night" && get(n,(d+1)%7)==="early") bad.push(`${n} ${DAY[d]}晚→${DAY[(d+1)%7]}早`);
    const c={early:0,mid:0,night:0}; w.forEach(v=>{ if(c[v]!==undefined) c[v]++; });
    ["early","mid","night"].forEach(sh=>{ if(c[sh] > (LIM[sh]||99)) bad.push(`${n} ${sh} ${c[sh]} 次超上限 ${LIM[sh]}`); });
  });
  const totalRest = names.reduce((s,n)=> s + week[n].filter(v=> v==="rest").length, 0);
  if(totalRest > restCap) bad.push(`全队休息 ${totalRest} > 上限 ${restCap}`);
  // 需求覆盖 + 人数固定班次
  for(let d=0; d<7; d++) ["early","mid","night"].forEach(sh=>{
    const need = +st.needs[d][sh]||0;
    const have = names.filter(n=> get(n,d)===sh).length;
    if(have < need) bad.push(`${DAY[d]}${sh} 缺 ${need-have} 人`);
    if(exact.includes(sh) && have !== need) bad.push(`${DAY[d]}${sh} 人数固定但实排 ${have}≠${need}`);
  });
  // 分组保障
  const en = st.groups.earlyNight, oc = st.groups.openClose;
  const at = (n,d)=> get(n,d);
  const cnt = (mem,d,sh)=> mem.filter(n=> at(n,d)===sh).length;
  const enM = T.groupMembers("earlyNight"), ocM = T.groupMembers("openClose");
  for(let d=0; d<7; d++){
    if(enM.length && cnt(enM,d,"early") < (en.minEarly||0)) bad.push(`${DAY[d]} 早晚保障组早班缺人`);
    if(enM.length && cnt(enM,d,"night") < (en.minNight||0)) bad.push(`${DAY[d]} 早晚保障组晚班缺人`);
    if(ocM.length && cnt(ocM,d,"early") < (oc.open||0))     bad.push(`${DAY[d]} 开店缺人`);
    if(ocM.length && cnt(ocM,d,"night") < (oc.close||0))    bad.push(`${DAY[d]} 闭店缺人`);
  }
  const wkMax = (typeof st.weekendEarlyMax === "number") ? st.weekendEarlyMax : 1;
  const wkBoth = names.filter(n=> get(n,5)==="early" && get(n,6)==="early").length;
  if(wkBoth > wkMax) bad.push(`周末连上早班 ${wkBoth} 人 > ${wkMax}`);
  return bad;
}

/* ============ 场景 ============ */
const CASES = [
  {name:"基准：31人 / 休2天 / 早班固定8人", cfg:{}, runs:12},
  {name:"每人休 1 天（上班 6 天）",        cfg:{restMax:{per:1,total:0}}, runs:10},
  {name:"每人休 3 天（上班 4 天）",        cfg:{restMax:{per:3,total:0}}, runs:10},
  {name:"全队休息上限收紧 50 人日",        cfg:{restMax:{per:2,total:50}}, runs:10},
  {name:"晚班上限放宽到 5",                cfg:{limits:{early:3,night:5,mid:99}}, runs:10},
  {name:"早班上限收紧到 2",                cfg:{limits:{early:2,night:4,mid:99}}, runs:10},
  {name:"早班改为不固定人数",              cfg:{exactShifts:[]}, runs:10},
  {name:"周末早班上限放宽到 3",            cfg:{weekendEarlyMax:3}, runs:10},
  {name:"裁到 20 人（人力紧张）",          cfg:{staff:T.DEFAULT_STAFF.slice(0,20),
                                                needs:[{early:5,mid:1,night:6},{early:5,mid:1,night:6},
                                                       {early:5,mid:1,night:6},{early:5,mid:1,night:6},
                                                       {early:5,mid:1,night:6},{early:6,mid:2,night:8},
                                                       {early:6,mid:2,night:8}]}, runs:10},
  {name:"扩到 40 人（人力富余很多）",      cfg:{staff:T.DEFAULT_STAFF.concat(
                                                  ["新人甲","新人乙","新人丙","新人丁","新人戊","新人己",
                                                   "新人庚","新人辛","新人壬"])}, runs:10},
];

let totalBad = 0;
console.log("\n================ 配置扫描 ================\n");
for(const c of CASES){
  const all = [];
  let ms = [];
  for(let t=0; t<c.runs; t++){
    reset(c.cfg);
    const st = T.state();
    const t0 = Date.now();
    T.autoSchedule();
    ms.push(Date.now()-t0);
    const bad = audit(st);
    if(bad.length) all.push(...bad);
  }
  const avgMs = Math.round(ms.reduce((a,b)=>a+b,0)/ms.length);
  const uniq = [...new Set(all)];
  totalBad += all.length;
  const ok = uniq.length === 0;
  console.log(`${ok ? "✅" : "❌"} ${c.name}`);
  console.log(`     ${c.runs} 次排班 ｜ 平均 ${avgMs}ms ｜ 问题 ${all.length} 个`);
  uniq.slice(0,4).forEach(b=> console.log(`       · ${b}`));
  if(uniq.length > 4) console.log(`       · …… 另有 ${uniq.length-4} 类`);
}
console.log(`\n合计问题：${totalBad} 个\n`);
