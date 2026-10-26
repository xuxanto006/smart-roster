/* 可复现的排班审计内核。
   为什么要这个：原来的 audit_repatch.js 用 Math.random，同一份代码连跑两次结果能差 8 个百分点，
   于是「改一个惩罚项到底变好还是变坏」根本没法判断。
   这里做三件事：
     1. 可播种随机数（mulberry32）接管 Math.random —— 同一 seed 必得同一序列；
     2. 虚拟时钟（每次读 Date.now() 前进 1ms）—— 消除机器快慢带来的抖动；
     3. 可选「去掉时间预算」—— 把 polishWeek 的 700ms 上限换成近乎无限，
        让它跑到收敛为止，比较的就是「两个版本各自能收敛到的局部最优」，彻底排除计时噪声。
   用法：loadApp(htmlPath, seed, {noDeadline:true}) → 用 auditOnce() 打分。 */
const fs = require("fs"), vm = require("vm");

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeEl(){
  const cls = new Set();
  const base = {
    value:"", textContent:"", innerHTML:"", style:{}, options:[], disabled:false, width:0, height:0,
    dataset:{},
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), toggle(){}, contains:c=>cls.has(c)},
    getAttribute(){return null}, setAttribute(){}, click(){}, appendChild(){}, remove(){},
    addEventListener(){}, removeEventListener(){},
    querySelector(){return makeEl()}, querySelectorAll(){return []},
    getContext(){ return new Proxy({}, {get(){return ()=>{}}, set(){return true;}}); },
    getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}
  };
  return new Proxy(base, { get(t,p){ return (p in t) ? t[p] : undefined; }, set(t,p,v){ t[p]=v; return true; } });
}

function loadApp(htmlPath, seed, opt){
  opt = opt || {};
  let html = fs.readFileSync(htmlPath, "utf8");
  if(opt.noDeadline){
    const before = html;
    html = html.replace("const deadline = Date.now() + 700;", "const deadline = Date.now() + 100000000;");
    if(html === before) throw new Error("没找到 polishWeek 的时间预算行，noDeadline 未生效");
  }
  /* 取主脚本：遍历所有 <script>、跳过 src，取**最长**的一段。
     原来的 `/<script>([\s\S]*?)<\/script>/` 只能匹配无属性的标签，
     页面新增了带属性的脚本段（src / id="ui-refresh-enhancements"）后，
     正则会从无属性的开标签跨到下一个 </script>，把中间那段的开标签也吞进来 → 语法错。
     取最长最稳：主脚本必然是最长的那段，不受新增脚本段影响。 */
  let code = "";
  {
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
    let m;
    while((m = re.exec(html))){
      if(/\bsrc\s*=/.test(m[1])) continue;
      if(/application\/json/.test(m[1])) continue;
      if(m[2].length > code.length) code = m[2];
    }
  }
  if(!code) throw new Error("loadApp: 未找到主脚本段");
  const els = {}; let saved = null;
  const rng = mulberry32(seed === undefined ? 1 : seed);
  let vclock = 1000;
  const RealDate = Date;
  function FakeDate(...a){ return a.length ? new RealDate(...a) : new RealDate(1767225600000); }
  FakeDate.now = () => (vclock += 1);
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  const M = Object.create(Math);
  M.random = rng;
  const sandbox = {
    document:{getElementById(id){ if(!els[id]) els[id] = makeEl(); return els[id]; },
      querySelectorAll(){return[]}, querySelector(){return makeEl()},
      createElement(){return makeEl()},
      body:makeEl(), addEventListener(){}, removeEventListener(){}},   // downloadFile 要用 document.body
    localStorage:{getItem:()=>saved, setItem(k,v){saved=v}, removeItem(){saved=null}},
    console:{log(){},warn(){},error(){}}, confirm:()=>true, alert(){}, prompt:()=>"",
    setTimeout:(fn)=>{fn();return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    Math:M, Date:FakeDate, JSON, Array, Object, String, Number, Set, Map,
    isNaN, parseInt, parseFloat, performance:{now:()=>FakeDate.now()},
    URL:{createObjectURL:()=>"", revokeObjectURL(){}}, Blob:function(){},
    // exportSharedPage 会判断 location.protocol 并在 http(s) 下 fetch 自身页面
    location:{protocol:"https:", href:"https://example.invalid/app.html"},
    fetch:()=>Promise.reject(new Error("sandbox: no network")),
    // 跨标签页同步要挂 window.addEventListener；沙箱里给它一个空实现即可
    window:{addEventListener(){}, removeEventListener(){}, scrollTo(){}}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // 尽量多导出：名字不存在就跳过（不同版本函数名可能有增删），避免整段注入报错
  const EXPORTS = ["autoSchedule","repatchWeek","buildRules","curKey","ensureWeek",
    "checkRuleViolations","isolatedRestCount","groupMembers","assignRoles","hasRestPlan","DEFAULT_STAFF",
    "addStaff","removeStaff","setLimits","setRestMax","applyWeekendNeed","setDayNeed","renderNeedsInfo","balanceShifts",
    "parseDateToken","parseDates","fmtLocal","dateObj","weekKeyOfDate","dayIndexOfDate","dateLabel","inferDateYear","addDays",
    "pushRequest","activeRequests","parsePasteText","parsePasteLine","pvSetDate","renderRequests",
    "addRequest","removeRequest","clearRequests","addMustWork","removeMustWork",
    "parsePaste","applyPaste","togglePaste","clearPaste",
    "changeWeek","clearWeek","copyPrevWeek","openModal","setCell","closeModal",
    "toggleRole","rerollRoles","exportCSV","exportBackup","exportSharedPage","restoreBackup",
    "renderAll","renderStats","renderHealth","renderTable",
    // 收尾修复 / 可行性判定相关（诊断脚本会直接调用）
    "fixIsolatedRest","weekRoleShort","roleFlowAssign","absorbSurplus","fillGaps","schedulableStaff",
    "planIsoRest","planGroupViol","planRoleShort","polishWeek","restSetOfWeek","wouldIsolate"];
  vm.runInContext(code + `
;(() => {
  const o = { get state(){ return state; }, get DEFAULT_STAFF(){ return DEFAULT_STAFF; } };
  for (const n of ${JSON.stringify(EXPORTS)}) {
    try { const v = eval(n); if (typeof v === "function" || typeof v === "object") o[n] = v; } catch(e) {}
  }
  globalThis.__T = o;
})();`, sandbox, {filename:"app"});
  return {T: sandbox.__T, S: sandbox.__T.state, sandbox, els, rng};
}

/* 标准 31 人配置（与线上默认一致） */
function resetConfig(S, T, reqs){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [0,1,2,3,4].map(()=>({early:9,mid:1,night:10}))   // 早班需求 8 → 9（2026-09-11）
    .concat([5,6].map(()=>({early:9,mid:3,night:12})));
  S.limits = {early:3, night:3, mid:99};
  S.restMax = {per:2, total:0};
  S.exactShifts = ["early"];
  S.weekendEarlyMax = 1;
  S.requests = reqs || [];
  S.schedule = {}; S.roles = {}; S.roleSig = {}; S.manual = {};
  S.mustWork = [{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups = {
    earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"],
      open:1, close:2, maxPerWeek:3}
  };
}

const SH = ["early","mid","night"], SHCN = {early:"早", mid:"中", night:"晚"};
const ORDER = ["1.班次人数≥需求","2.工作日早班人数恰好","3.每人早班≤3","4.每人晚班≤3",
  "5.每人恰好休2天","6.全队休息总数≤上限","7a.上一休一(输入层不可避免)","7b.上一休一(可避免)",
  "8.无三连早","9.晚班次日不早班","10.早晚保障组每天≥1早","10.早晚保障组每天≥1晚",
  "11.每天1人开店","11.每天2人闭店","12.开店闭店每人≤3次","13.周末连上早班≤1人",
  "13.开店闭店组周末换人","14.请假与改班满足","15.角色标记与班次一致"];

/* 硬约束全量体检，返回 {n, byRule} */
function auditOnce(T, S){
  const byRule = {};
  let n = 0;
  const hit = (rule)=>{ n++; byRule[rule] = (byRule[rule]||0) + 1; };
  const k = T.curKey(), w = T.ensureWeek(k), R = T.buildRules(k);
  // 分组保障只认「可排班成员」：经理 / 免排人员已在调度内核被排除，展示层与审计也用同一口径，
  // 否则「分组里全是经理」会每天假阳性报缺早/晚班。
  const schedSet = new Set(T.schedulableStaff ? T.schedulableStaff() : S.staff);
  const ocMem = T.groupMembers("openClose").filter(n=> schedSet.has(n));
  const enMem = T.groupMembers("earlyNight").filter(n=> schedSet.has(n));
  const roles = S.roles[k] || {};
  const ocS = new Set(ocMem);
  const P = Math.min(7, Math.max(0, (S.restMax && S.restMax.per) || 2));
  const unav = {};
  S.staff.forEach(nm=>{
    const row = R[nm]; if(!row) return;
    const off = [], must = [];
    for(let d=0; d<7; d++){ if(row[d].off) off.push(d); else if(row[d].noOff) must.push(d); }
    if(off.length <= P && must.length <= 7-P && !T.hasRestPlan(off, P, must)) unav[nm] = 1;
  });
  for(let d=0; d<7; d++) SH.forEach(sh=>{
    const c = S.staff.filter(x=>w[x][d]===sh).length;
    if(c < S.needs[d][sh]) hit("1.班次人数≥需求");
  });
  for(let d=0; d<5; d++){
    const c = S.staff.filter(x=>w[x][d]==="early").length;
    if(c !== S.needs[d].early) hit("2.工作日早班人数恰好");
  }
  S.staff.forEach(nm=>{
    const c = {early:0, mid:0, night:0};
    for(let d=0; d<7; d++) if(c[w[nm][d]] !== undefined) c[w[nm][d]]++;
    if(c.early > S.limits.early) hit("3.每人早班≤3");
    if(c.night > S.limits.night) hit("4.每人晚班≤3");
    const rest = [0,1,2,3,4,5,6].filter(d=>w[nm][d]==="rest"||!w[nm][d]).length;
    if(rest !== 2) hit("5.每人恰好休2天");
  });
  {
    const total = S.staff.reduce((s,x)=>s+[0,1,2,3,4,5,6].filter(d=>w[x][d]==="rest"||!w[x][d]).length, 0);
    const cap = (S.restMax.total>0) ? S.restMax.total : S.restMax.per*S.staff.length;
    if(total > cap) hit("6.全队休息总数≤上限");
  }
  S.staff.forEach(nm=>{
    const s = new Set();
    for(let d=0; d<7; d++) if(w[nm][d]==="rest"||!w[nm][d]) s.add(d);
    if(T.isolatedRestCount(s) > 0) hit(unav[nm] ? "7a.上一休一(输入层不可避免)" : "7b.上一休一(可避免)");
  });
  S.staff.forEach(nm=>{
    for(let d=0; d<5; d++) if(w[nm][d]==="early"&&w[nm][d+1]==="early"&&w[nm][d+2]==="early") hit("8.无三连早");
    for(let d=0; d<6; d++) if(w[nm][d]==="night"&&w[nm][d+1]==="early") hit("9.晚班次日不早班");
  });
  for(let d=0; d<7; d++){
    if(enMem.length){
      if(enMem.filter(x=>w[x][d]==="early").length < 1) hit("10.早晚保障组每天≥1早");
      if(enMem.filter(x=>w[x][d]==="night").length < 1) hit("10.早晚保障组每天≥1晚");
    }
    const o = ocMem.filter(x=>(roles[x]||[])[d]==="open").length;
    const c = ocMem.filter(x=>(roles[x]||[])[d]==="close").length;
    if(ocMem.length){
      if(o < 1) hit("11.每天1人开店");
      if(c < 2) hit("11.每天2人闭店");
    }
  }
  ocMem.forEach(nm=>{
    const c = (roles[nm]||[]).filter(x=>x==="open"||x==="close").length;
    if(c > 3) hit("12.开店闭店每人≤3次");
    for(let d=0; d<7; d++){
      const rr = (roles[nm]||[])[d], v = w[nm][d]||"";
      if(rr==="open" && v!=="early") hit("15.角色标记与班次一致");
      if(rr==="close" && v!=="night") hit("15.角色标记与班次一致");
    }
  });
  {
    const both = S.staff.filter(x=>w[x][5]==="early" && w[x][6]==="early");
    if(both.length > 1) hit("13.周末连上早班≤1人");
    both.filter(x=>ocS.has(x)).forEach(()=>hit("13.开店闭店组周末换人"));
  }
  T.checkRuleViolations(w, R).forEach(()=>hit("14.请假与改班满足"));
  return {n, byRule};
}

module.exports = {
  matchMainScript,mulberry32, loadApp, resetConfig, auditOnce, ORDER};
/* 从 HTML 里取出主脚本内容。
   早前各测试都用 `html.match(/<script>([\s\S]*?)<\/script>/)[1]` —— 那个正则只能匹配
   **无属性**的 <script>。页面后来新增了带属性的脚本段（如
   `<script src=...>` 与 `<script id="ui-refresh-enhancements">`），
   正则会从「无属性的 <script>」一路跨到「下一个 </script>」，
   把中间带属性那一段的起始标签也一起吞进来，取到的代码前面多出一截 HTML → 语法错。
   这里改成遍历所有 script 标签、跳过 src/json，取**最长**的那段（就是主脚本）。 */
function matchMainScript(html){
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let best = "";
  let m;
  while((m = re.exec(html))){
    const attrs = m[1] || "", body = m[2] || "";
    if(/\bsrc\s*=/i.test(attrs)) continue;
    if(/type\s*=\s*["']?application\/json/i.test(attrs)) continue;
    if(!body.trim()) continue;
    if(body.length > best.length) best = body;
  }
  if(!best) throw new Error("matchMainScript: 未找到主脚本段");
  return best;
}
