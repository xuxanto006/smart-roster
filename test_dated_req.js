/* 指定日期安排（9.15 = 9 月 15 日）：
   ① 日期识别   ② 星期 / 周次由日期反推   ③ 只在那一天生效，不顶掉每周规则
   ④ 粘贴识别（单个日期 + 连续日期）   ⑤ 排班真的遵守 */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html";

let pass = 0, fail = 0;
const ok  = (m, c, extra)=>{ c ? (pass++, console.log("  ✅ " + m)) : (fail++, console.log("  ❌ " + m + (extra ? "  " + extra : ""))); };

const app = loadApp(FILE, 1);
const T = app.T, S = app.S;
resetConfig(S, T, []);

console.log("══════ 指定日期安排测试 ══════\n");

/* ---------- ① 日期识别 ---------- */
console.log("— 日期识别 —");
// 沙盒时钟是固定的，年份只能按「当前查看那一周」独立推算：离这一周最近、同距离取未来
const monD = new Date(T.addDays(T.curKey(), 1) + "T00:00:00");
function expectYear(mo){
  let best = null, bestScore = Infinity;
  for(let k = -1; k <= 1; k++){
    const yy = monD.getFullYear() + k;
    const d  = new Date(yy, mo - 1, 15);
    const diff  = d.getTime() - monD.getTime();
    const score = Math.abs(diff) - (diff > 0 ? 43200000 : 0);
    if(score < bestScore){ bestScore = score; best = yy; }
  }
  return best;
}
const y = expectYear(9);
const cases = [
  ["9.15",      `${y}-09-15`],
  ["9/15",      `${y}-09-15`],
  ["9-15",      `${y}-09-15`],
  ["09.15",     `${y}-09-15`],
  ["9月15日",   `${y}-09-15`],
  ["9月15号",   `${y}-09-15`],
  [" 9.15 ",    `${y}-09-15`],
  ["2026-09-15","2026-09-15"],
  ["2026/9/15", "2026-09-15"],
  ["2026年9月15日","2026-09-15"]
];
cases.forEach(([inp, want])=> ok(`「${inp}」→ ${want}`, T.parseDateToken(inp) === want, "实得 " + T.parseDateToken(inp)));
ok("「13.45」不是日期 → null", T.parseDateToken("13.45") === null, "实得 " + T.parseDateToken("13.45"));
ok("「2.30」不存在 → null",    T.parseDateToken("2.30") === null,  "实得 " + T.parseDateToken("2.30"));
ok("「乱码」→ null",           T.parseDateToken("乱码") === null);
ok("空 → null",                T.parseDateToken("") === null);
// 跨年：不写年份时取离当前周最近的那一年（同距离取未来）
ok(`填「1.5」→ ${expectYear(1)}-01-05`, T.parseDateToken("1.5") === `${expectYear(1)}-01-05`, "实得 " + T.parseDateToken("1.5"));

/* ---------- ② 星期 / 周次反推 ---------- */
console.log("\n— 星期 / 周次反推 —");
const d1 = "2026-09-15";                    // 2026-09-15 是周二
ok(`${d1} 是周二（day=1）`, T.dayIndexOfDate(d1) === 1, "实得 " + T.dayIndexOfDate(d1));
ok("同一周的周一与周三落在同一个 weekKey",
   T.weekKeyOfDate(T.addDays(d1, -1)) === T.weekKeyOfDate(d1) &&
   T.weekKeyOfDate(T.addDays(d1,  1)) === T.weekKeyOfDate(d1));
ok("下一周（+7 天）是不同的 weekKey", T.weekKeyOfDate(T.addDays(d1, 7)) !== T.weekKeyOfDate(d1));
ok("日期标签 = 9月15日", T.dateLabel(d1) === "9月15日", "实得 " + T.dateLabel(d1));

/* ---------- ③ 只在那一天生效 ---------- */
console.log("\n— 生效范围 —");
S.staff = T.DEFAULT_STAFF.slice();
S.requests = [];
const who = "高超";
T.pushRequest(who, 0, "off", "once", undefined, d1);
const rec = S.requests[0];
ok("按日期添加后带上了 date 字段", rec && rec.date === d1);
ok("星期由日期反推为周二", rec && rec.day === 1);
ok("周次归属正确", rec && rec.weekKey === T.weekKeyOfDate(d1));
const R1 = T.buildRules(T.weekKeyOfDate(d1));
ok("那一周的周二被标记为必须休息", R1[who][1] && R1[who][1].off === true);
ok("那一周的周一不受影响", !R1[who][0].off);
const R2 = T.buildRules(T.weekKeyOfDate(T.addDays(d1, 7)));
ok("下一周不生效", !R2[who][1].off);
ok("activeRequests 里能查到", T.activeRequests(T.weekKeyOfDate(d1)).length === 1);
ok("别的周查不到", T.activeRequests(T.weekKeyOfDate(T.addDays(d1, 7))).length === 0);

// 每周固定规则不会被按日期的规则顶掉
S.requests = [];
T.pushRequest(who, 1, "off", "always");                       // 每周二请假
T.pushRequest(who, 0, "off", "once", undefined, d1);          // 9.15（也是周二）请假
ok("「每周二请假」不会被「9.15 请假」顶掉", S.requests.length === 2, "实得 " + S.requests.length);
ok("两条规则都在（一条每周、一条指定日期）",
   S.requests.filter(r=> r.date).length === 1 && S.requests.filter(r=> !r.date && r.scope === "always").length === 1);
// 反过来：同一日期同一类型重复添加 → 判重而不是堆两条
const before = S.requests.length;
T.pushRequest(who, 0, "off", "once", undefined, d1);
ok("同一日期重复添加判重", S.requests.length === before);

/* ---------- ④ 粘贴识别 ---------- */
console.log("\n— 粘贴识别 —");
S.staff = T.DEFAULT_STAFF.slice();
let rows = T.parsePasteText("孙勇 9.15 请假");
ok("「孙勇 9.15 请假」识别出 1 条", rows.length === 1, "实得 " + rows.length);
ok("识别到姓名", rows[0] && rows[0].name === "孙勇", rows[0] && rows[0].name);
ok("识别到请假", rows[0] && rows[0].type === "off", rows[0] && rows[0].type);
ok("日期 = 9 月 15 日", rows[0] && (rows[0].date || "").slice(5) === "09-15", rows[0] && rows[0].date);
ok("星期由日期反推（与该日期本身的星期一致）",
   rows[0] && rows[0].day === T.dayIndexOfDate(rows[0].date),
   rows[0] && `${rows[0].date} → day ${rows[0].day}`);

rows = T.parsePasteText("王鹏俊 9.15-9.17 请假");
ok("连续日期 9.15-9.17 → 3 条", rows.length === 3, "实得 " + rows.length);
ok("三天分别是 15 / 16 / 17 日",
   rows.length === 3 && rows.map(r=> (r.date||"").slice(8)).join(",") === "15,16,17",
   rows.map(r=> r.date).join(","));

rows = T.parsePasteText("邓臻蓝 9月16日 固定早班");
ok("「9月16日」也能识别", rows.length === 1 && (rows[0].date || "").slice(5) === "09-16", rows[0] && rows[0].date);
ok("类型识别为固定早班", rows[0] && rows[0].type === "early", rows[0] && rows[0].type);

rows = T.parsePasteText("何广友 周一 请假");
ok("没写日期时仍按星期（date 为空）", rows.length === 1 && !rows[0].date && rows[0].day === 0);

/* ---------- ⑤ 排班真的遵守 ---------- */
console.log("\n— 排班遵守 —");
resetConfig(S, T, []);
T.autoSchedule();
const key = T.curKey();
const monday = T.addDays(key, 1);          // weekKey 用的是周一前一天，+1 才是周一
const wed = T.addDays(monday, 2);          // 本周周三
// 不要硬编码人名：名单里「李敏」等已被加入不排班名单，硬编码会让测试前提失效
const victim = (T.schedulableStaff ? T.schedulableStaff() : S.staff).filter(n=>!/李敏|黎瑶|杨乐乐|莫甄姗|黄弼姗/.test(n))[0] || S.staff[0];
S.requests = [{id:1, name:victim, day:2, type:"off", scope:"once", weekKey:key, date:wed}];
T.autoSchedule();
const w = T.ensureWeek(key);
ok(`${victim} ${T.dateLabel(wed)}（周三）排到了休息`, w[victim][2] === "rest", "实得 " + w[victim][2]);
ok("规则校验无违规", (T.checkRuleViolations(w, T.buildRules(key)) || []).length === 0);
// 微调也不能把它改掉
T.repatchWeek(true);
ok("微调后仍是休息", T.ensureWeek(key)[victim][2] === "rest", "实得 " + T.ensureWeek(key)[victim][2]);

/* ---------- ⑥ 界面渲染不崩 ---------- */
console.log("\n— 渲染 —");
let crashed = "";
try{ T.renderRequests(); T.renderNeedsInfo(); T.renderAll(); }catch(e){ crashed = e.message; }
ok("带日期的安排渲染不报错", !crashed, crashed);

console.log(`\n===== 指定日期安排测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
