/* 界面动作模糊测试：随机挑动作、随机参数、随机顺序地猛点，验证「怎么点都不崩」。
   之前的模糊测试只覆盖了 autoSchedule / repatchWeek / renderAll；
   这里补上剩下二十多个没人测过的动作：复制上周、清空本周、粘贴导入、角色切换、
   导出 CSV / 备份 / 分享页、增删人员、改全局需求、切换星期……
   断言只有一条硬要求：任何动作（以及之后的重渲染）都不得抛异常。
   用 audit_core 的可播种内核，失败可复现。 */
const {loadApp, resetConfig} = require("./audit_core.js");
const ROUNDS = +(process.argv[2] || 40);      // 轮数（每轮 = 一次完整重置 + 若干动作）
const ACTS   = +(process.argv[3] || 25);      // 每轮动作数
const SEED0  = +(process.argv[4] || 1);
const FILE   = process.argv[5] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";

const NAMES = ["高超","陈悦娴","孙勇","不存在的人",""];
const DAYS  = [0,1,2,3,4,5,6,-1,7];
const SHIFTS= ["early","mid","night","rest","","乱码"];
const TYPES = ["off","work","early","mid","night","noearly","nomid","nonight"];
const ROLES = ["open","close",""];
const PASTE = [
  "张三 周一 请假",
  "李四 周三 早班\n王五 周五 不上晚班",
  "姓名\t星期\t安排\n赵六\t周二\t中班",
  "周七 全周 请假",
  "乱码一堆 @@@ ###",
  "",
  "孙八 周一到周五 必须上班\n陈悦娴 周末 休息"
];

/* 每个动作：先摆好所需的输入框，再调用 */
const ACTIONS = [
  {n:"addStaff",      f:(T,S,E,r)=>{ E.staffName.value = "测试"+r(99); T.addStaff(); }},
  {n:"removeStaff",   f:(T,S,E,r)=>{ T.removeStaff(S.staff[r(S.staff.length)] || "谁"); }},
  {n:"setLimits",     f:(T,S,E,r)=>{ E.limEarly.value=String(1+r(6)); E.limNight.value=String(1+r(6)); T.setLimits(); }},
  {n:"setRestMax",    f:(T,S,E,r)=>{ E.restPer.value=String(1+r(4)); E.restTotal.value=String(r(70)); T.setRestMax(); }},
  {n:"applyWeekendNeed",f:(T,S,E,r)=>{ E.wkNeedEarly.value=String(r(12)); E.wkNeedMid.value=String(r(5)); E.wkNeedNight.value=String(r(14)); T.applyWeekendNeed(); }},
  {n:"setDayNeed",    f:(T,S,E,r)=>{ T.setDayNeed(r(7), SHIFTS[r(3)], 1+r(12)); }},
  {n:"addRequest",    f:(T,S,E,r)=>{ E.reqStaff.value=["__ALL__",S.staff[r(S.staff.length)]||"谁"][r(2)]; E.reqDay.value=String(r(7)); E.reqType.value=TYPES[r(TYPES.length)]; E.reqScope.value=["once","always"][r(2)]; E.reqDate.value=""; T.addRequest(); }},
  {n:"addRequestByDate",f:(T,S,E,r)=>{ E.reqStaff.value=S.staff[r(S.staff.length)]||"谁"; E.reqDate.value=["9.15","9/16","9月17日","2026-09-18","乱写的日期"][r(5)]; E.reqType.value=TYPES[r(TYPES.length)]; T.addRequest(); E.reqDate.value=""; }},
  {n:"removeRequest", f:(T,S,E,r)=>{ const q=S.requests[r(S.requests.length)]; if(q) T.removeRequest(q.id); }},
  {n:"clearRequests", f:(T,S,E,r)=>{ T.clearRequests(["week","all"][r(2)]); }},
  {n:"addMustWork",   f:(T,S,E,r)=>{ E.mwStaff.value=S.staff[r(S.staff.length)]||"谁"; E.mwDay.value=String(r(7)); T.addMustWork(); }},
  {n:"removeMustWork",f:(T,S,E,r)=>{ T.removeMustWork(r((S.mustWork||[]).length+1)); }},
  {n:"parsePaste",    f:(T,S,E,r)=>{ E.pasteSrc.value=PASTE[r(PASTE.length)]; T.parsePaste(); }},
  {n:"applyPaste",    f:(T,S,E,r)=>{ E.pasteSrc.value=PASTE[r(PASTE.length)]; T.parsePaste(); T.applyPaste(); }},
  {n:"togglePaste",   f:(T,S,E,r)=>{ T.togglePaste(); }},
  {n:"clearPaste",    f:(T,S,E,r)=>{ T.clearPaste(); }},
  {n:"autoSchedule",  f:(T,S,E,r)=>{ T.autoSchedule(); }},
  {n:"repatchWeek",   f:(T,S,E,r)=>{ T.repatchWeek(true); }},
  {n:"changeWeek",    f:(T,S,E,r)=>{ T.changeWeek([-1,1,-2,2][r(4)]); }},
  {n:"clearWeek",     f:(T,S,E,r)=>{ T.clearWeek(); }},
  {n:"copyPrevWeek",  f:(T,S,E,r)=>{ T.copyPrevWeek(); }},
  {n:"setCell",       f:(T,S,E,r)=>{ const nm=S.staff[r(S.staff.length)]; if(!nm) return; T.openModal(nm, r(7)); T.setCell(SHIFTS[r(SHIFTS.length)]); }},
  {n:"toggleRole",    f:(T,S,E,r)=>{ T.toggleRole(S.staff[r(S.staff.length)]||"谁", r(7), ROLES[r(3)]); }},
  {n:"rerollRoles",   f:(T,S,E,r)=>{ T.rerollRoles(); }},
  {n:"exportCSV",     f:(T,S,E,r)=>{ T.exportCSV(); }},
  {n:"exportBackup",  f:(T,S,E,r)=>{ T.exportBackup(); }},
  {n:"exportShared", fname:"exportSharedPage", f:(T,S,E,r)=>{ T.exportSharedPage(); }},
  {n:"renderStats",   f:(T,S,E,r)=>{ T.renderStats(); }},
  {n:"renderHealth",  f:(T,S,E,r)=>{ T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey())); }}
];

let pass = 0, fail = 0;
const crashes = [];
// 先确认被测版本里这些函数都在；缺失的（不同版本可能有增删）只提示、不算崩溃
{
  const {T} = loadApp(FILE, SEED0);
  const missing = ACTIONS.filter(a => typeof T[a.fname || a.n] !== "function").map(a => a.fname || a.n);
  if(missing.length){
    console.log("  ⚠️ 以下动作在当前版本里不存在，已跳过：" + missing.join("、") + "\n");
    missing.forEach(m => { const i = ACTIONS.findIndex(a => a.n === m); if(i >= 0) ACTIONS.splice(i, 1); });
  }
}
console.log("══════ 界面动作模糊测试（"+ROUNDS+" 轮 × "+ACTS+" 个动作）══════\n");
let calls = 0;
for(let i=0;i<ROUNDS;i++){
  const seed = SEED0 + i;
  const {T, S, sandbox} = loadApp(FILE, seed);
  resetConfig(S, T);
  // 元素要通过 getElementById 取（元素缓存挂在 loadApp 的闭包里）
  const els = new Proxy({}, {get:(_,id)=> sandbox.document.getElementById(id)});
  let a = seed * 48271 % 2147483647;
  const r = n => { a = (a * 48271) % 2147483647; return a % n; };
  T.autoSchedule();
  for(let j=0;j<ACTS;j++){
    const act = ACTIONS[r(ACTIONS.length)];
    try{
      act.f(T, S, els, r);
      calls++;
    }catch(e){
      fail++;
      if(crashes.length < 12) crashes.push(`seed ${seed} 第${j+1}个动作「${act.n}」：${e.message}`);
      continue;
    }
    // 每个动作之后重渲染一遍：状态被玩坏了也不能让渲染崩
    try{ T.renderAll(); T.renderStats(); }
    catch(e){
      fail++;
      if(crashes.length < 12) crashes.push(`seed ${seed} 第${j+1}个动作「${act.n}」之后渲染：${e.message}`);
    }
  }
}
console.log(`  共执行动作 ${calls} 次`);
if(fail === 0){ pass++; console.log("  ✅ 全部动作（含之后的重渲染）均未抛异常"); }
else console.log("  ❌ 出现 " + fail + " 次异常");
if(crashes.length){
  console.log("\n  崩溃样例：");
  crashes.forEach(c=>console.log("   · " + c));
  console.log("\n  复现方式：node test_action_fuzz.js <轮数> <每轮动作数> <起始seed>");
}
console.log("\n══════════════════════════════");
console.log(`===== 界面动作模糊测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
