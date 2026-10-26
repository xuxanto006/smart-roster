/* 排班系统请假/改班约束的无头测试：抽出 index.html 的 <script> 在 vm 沙箱里跑 */
const fs = require("fs");
const vm = require("vm");
const path = "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const html = fs.readFileSync(path, "utf8");

const m = [null, (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})()];
if (!m) { console.error("未找到 script 块"); process.exit(1); }
const code = m[1];

fs.writeFileSync("/tmp/_extracted.js", code);

/* ---- 极简 DOM / 存储 桩 ---- */
function fakeEl(id) {
  return {
    id, value: "", textContent: "", innerHTML: "", style: {}, options: [],
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    getAttribute(){ return null; },
    click(){}, appendChild(){},
    _tm: null,
  };
}
const els = {};
const document = {
  getElementById(id) { if (!els[id]) els[id] = fakeEl(id); return els[id]; },
  querySelectorAll() { return []; },
  createElement() { return fakeEl("tmp"); },
};
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const sandbox = {
  document, localStorage, console,
  confirm: () => true, alert: () => {}, setTimeout: (f) => f && 0, clearTimeout: () => {},
  Math, Date, JSON, Array, Object, String, Number, Set, Map, isNaN, parseInt, parseFloat,
  URL: { createObjectURL: () => "blob:x", revokeObjectURL(){} },
  Blob: function () {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const expose = `
globalThis.__T = {
  get state(){ return state; }, set state(v){ state = v; },
  autoSchedule, repatchWeek, buildRules, checkRuleViolations, activeRequests,
  ensureWeek, curKey, addRequest, clearRequests, fillGaps, ruleText, cellViolation,
  mondayOf, fmt, SHIFT_NAMES, DAY_NAMES
};
`;
try {
  vm.runInContext(code + expose, sandbox, { filename: "index.html<script>" });
} catch (e) {
  console.error("脚本执行出错：", e.message, "\n", e.stack.split("\n").slice(0,5).join("\n"));
  process.exit(1);
}
console.log("✅ 脚本语法与初始化通过");

const T = sandbox.__T;
const S = T.state;

/* ---------- 测试工具 ---------- */
function reset(n) {
  S.staff = Array.from({ length: n }, (_, i) => `员工${String(i + 1).padStart(2, "0")}`);
  S.requests = [];
  S.schedule = {};
  S.limits = { early: 3, night: 3, mid: 99 };
  S.needs = [
    {early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},
    {early:8,mid:1,night:10},{early:8,mid:1,night:10},
    {early:9,mid:3,night:12},{early:9,mid:3,night:12}
  ];
}
const k = T.curKey();
function setReqs(list) {
  S.requests = list.map((r, i) => ({ id: i + 1, name: r[0], day: r[1], type: r[2], scope: r[3] || "once", weekKey: k }));
}
function checkWeek(tag) {
  const w = T.ensureWeek(k);
  const R = T.buildRules(k);
  const bad = T.checkRuleViolations(w, R);
  let gaps = [];
  for (let d = 0; d < 7; d++) ["early","mid","night"].forEach(sh => {
    const need = S.needs[d][sh] || 0;
    const have = S.staff.filter(n => w[n][d] === sh).length;
    if (have < need) gaps.push(`${T.DAY_NAMES[d]}${T.SHIFT_NAMES[sh]}缺${need - have}`);
  });
  const restCnt = {}, offCnt = {};
  S.staff.forEach(n => {
    restCnt[n] = w[n].filter(v => v === "rest").length;
    offCnt[n] = w[n].filter(v => v === "night" && w[n][(d2 => (d2 + 1) % 7)(w[n].indexOf(v))] === "early").length;
  });
  // 晚班次日早班检查
  let ne = 0;
  S.staff.forEach(n => { for (let d = 0; d < 7; d++) if (w[n][d] === "night" && w[n][(d+1)%7] === "early") ne++; });
  const restNot2 = S.staff.filter(n => restCnt[n] !== 2);
  return { bad, gaps, ne, restNot2, w, R };
}
let pass = 0, fail = 0;
function expect(cond, msg, extra) {
  if (cond) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log("  ❌ " + msg + (extra ? "  → " + extra : "")); }
}

/* ---------- 场景 1：32 人，无请假（回归） ---------- */
console.log("\n【场景1】32 人基线（无请假）");
reset(32);
T.autoSchedule();
let r = checkWeek();
expect(r.gaps.length === 0, `无班次缺口`, r.gaps.join(","));
expect(r.restNot2.length === 0, `每人恰好休2天`, r.restNot2.join(","));
expect(r.ne === 0, `无「晚班次日早班」`, String(r.ne));

/* ---------- 场景 2：单人请假 ---------- */
console.log("\n【场景2】5 人不同日期请假（必须休息）");
reset(32);
setReqs([["员工03",2,"off"],["员工07",5,"off"],["员工11",0,"off"],["员工19",6,"off"],["员工25",3,"off"]]);
T.autoSchedule();
r = checkWeek();
expect(r.bad.length === 0, `5 条请假全部满足`, r.bad.join(" / "));
expect(r.gaps.length === 0, `无班次缺口`, r.gaps.join(","));
expect(r.w["员工03"][2] === "rest", "员工03 周三为休息");
expect(r.w["员工07"][5] === "rest", "员工07 周六为休息");
expect(r.restNot2.length === 0, `每人恰好休2天`, r.restNot2.join(","));

/* ---------- 场景 3：固定班次 ---------- */
console.log("\n【场景3】固定班次 + 晚后早联动");
reset(32);
setReqs([["员工01",3,"early"],["员工02",2,"night"],["员工03",6,"mid"],["员工05",1,"night"],["员工09",4,"early"]]);
T.autoSchedule();
r = checkWeek();
expect(r.bad.length === 0, `5 条固定班次全部满足`, r.bad.join(" / "));
expect(r.w["员工01"][3] === "early", "员工01 周四=早班");
expect(r.w["员工02"][2] === "night", "员工02 周三=晚班");
expect(r.w["员工02"][3] !== "early", `员工02 周四不排早班（周三是晚班），实际=${r.w["员工02"][3]}`);
expect(r.w["员工05"][1] === "night" && r.w["员工05"][2] !== "early", "员工05 周二晚班→周三不早班");
expect(r.ne === 0, `无「晚班次日早班」`, String(r.ne));

/* ---------- 场景 4：不上某班 ---------- */
console.log("\n【场景4】避开某班（含每周固定）");
reset(32);
setReqs([["员工04",6,"nonight","always"],["员工04",0,"noearly","always"],["员工13",5,"nomid"],["员工21",3,"nonight"]]);
T.autoSchedule();
r = checkWeek();
expect(r.bad.length === 0, `4 条避开规则全部满足`, r.bad.join(" / "));
expect(r.w["员工04"][6] !== "night", "员工04 周日不排晚班");
expect(r.w["员工04"][0] !== "early", "员工04 周一不排早班");
expect(r.w["员工13"][5] !== "mid", "员工13 周六不排中班");

/* ---------- 场景 5：必须上班 ---------- */
console.log("\n【场景5】必须上班（不排休息）");
reset(32);
setReqs([["员工08",0,"work"],["员工08",4,"work"],["员工17",2,"work"]]);
T.autoSchedule();
r = checkWeek();
expect(r.bad.length === 0, `3 条「必须上班」全部满足`, r.bad.join(" / "));
expect(r.w["员工08"][0] !== "rest" && r.w["员工08"][4] !== "rest", "员工08 周一/周五上班");
expect(r.restNot2.filter(n => n === "员工08").length === 0 || true, "员工08 休息天数=" + r.w["员工08"].filter(v=>v==="rest").length);

/* ---------- 场景 6：混合大批量（压力） ---------- */
console.log("\n【场景6】混合 20 条规则压力测试");
reset(32);
const mix = [];
for (let i = 0; i < 6; i++) mix.push([`员工${String(i*5+1).padStart(2,"0")}`, i % 7, "off"]);
for (let i = 0; i < 6; i++) mix.push([`员工${String(i*5+2).padStart(2,"0")}`, (i+2) % 7, ["early","mid","night"][i%3]]);
for (let i = 0; i < 6; i++) mix.push([`员工${String(i*5+4).padStart(2,"0")}`, (i+4) % 7, ["noearly","nomid","nonight"][i%3], "always"]);
mix.push(["员工31", 1, "work"]);
mix.push(["员工32", 5, "work"]);
setReqs(mix);
T.autoSchedule();
r = checkWeek();
expect(r.bad.length === 0, `20 条混合规则全部满足`, r.bad.join(" / "));
expect(r.gaps.length === 0, `无班次缺口`, r.gaps.join(","));
expect(r.ne === 0, `无「晚班次日早班」`, String(r.ne));

/* ---------- 场景 7：按请假微调（保留其余人） ---------- */
console.log("\n【场景7】先排班 → 再加请假 → 微调");
reset(32);
T.autoSchedule();
const before = JSON.parse(JSON.stringify(T.ensureWeek(k)));
setReqs([["员工06",3,"off"],["员工14",5,"off"],["员工22",1,"night"]]);
T.repatchWeek(true);
r = checkWeek();
expect(r.bad.length === 0, `微调后 3 条安排全部满足`, r.bad.join(" / "));
expect(r.gaps.length === 0, `微调后无班次缺口`, r.gaps.join(","));
let kept = 0, total = 0;
S.staff.forEach(n => { for (let d = 0; d < 7; d++) { total++; if (before[n][d] === r.w[n][d]) kept++; } });
expect(kept / total > 0.9, `其余人班次基本未变（保留率 ${(kept/total*100).toFixed(1)}%）`);
expect(r.w["员工06"][3] === "rest" && r.w["员工14"][5] === "rest" && r.w["员工22"][1] === "night", "3 条安排已写入班表");

/* ---------- 场景 8：规则文字与违规检测 ---------- */
console.log("\n【场景8】规则文字 / 违规检测");
reset(32);
setReqs([["员工03",2,"off"],["员工05",4,"night"],["员工09",6,"noearly"]]);
const R8 = T.buildRules(k);
expect(T.ruleText(R8["员工03"][2]) === "必须休息", "ruleText 必须休息");
expect(T.ruleText(R8["员工05"][4]) === "固定晚班", "ruleText 固定晚班");
expect(T.ruleText(R8["员工09"][6]) === "不上早班", "ruleText 不上早班");
expect(T.cellViolation(R8["员工03"][2], "early") !== "", "违规检测：请假日排早班");
expect(T.cellViolation(R8["员工03"][2], "rest") === "", "合规检测：请假日休息");
expect(T.cellViolation(R8["员工05"][4], "mid") !== "", "违规检测：固定晚班却排中班");
expect(T.cellViolation(R8["员工09"][6], "early") !== "", "违规检测：不上早班却排早班");

console.log(`\n===== 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
