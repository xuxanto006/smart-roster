/* 经理端「生成本周」端到端测试（算法文档 §8 一期交付物：经理端生成 → 写 shifts 草稿）。

   为什么值得写：这一步把「云端数据 → 引擎输入 → 引擎输出 → 云端草稿」串成一条线，
   任何一段的字段名对不上（staff.domain / requests.type / fixed_roster.pattern …），
   页面上只会表现为「排出来不对」或者「悄悄写空」，光看代码看不出来。
   这里用**假的 SR（内存版 Supabase）** 跑真实的 manager.html 脚本：
     ① 只打桩网络与 DOM，页面脚本本身一行不改；
     ② 断言写回 shifts 的行数、枚举值、请假/必上/固定班表是否真的落实；
     ③ 顺便验证 N16：领域归属以 staff.domain 为准，而不是靠模块名猜。

   用法：node tools/test_manager_generate.mjs
   退出码：0 = 全部通过；1 = 有断言失败（会打印明细）。
*/
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = fs.readFileSync(path.join(ROOT, "_deploy", "manager.html"), "utf8");
const SCHED_SRC = fs.readFileSync(path.join(ROOT, "_deploy", "scheduler.js"), "utf8");

/* 页面默认打开「本周」，所以测试也按今天的周一取周，别写死一个会过期的日期 */
function mondayOf(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = t.getDay();
  t.setDate(t.getDate() + (dow === 0 ? -6 : 1 - dow));
  const p = n => (n < 10 ? "0" : "") + n;
  return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate());
}
const WEEK = mondayOf(new Date());

/* ------------------------------------------------------------ 假 DOM */
function makeEl(sel) {
  const cls = new Set();
  const listeners = {};
  const base = {
    __sel: sel, value: "", textContent: "", innerHTML: "", hidden: false,
    disabled: false, title: "", options: [], dataset: {}, style: {},
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c),
      contains: c => cls.has(c), toggle: (c, on) => { if (on === undefined) { cls.has(c) ? cls.delete(c) : cls.add(c); } else if (on) cls.add(c); else cls.delete(c); }
    },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    fire: (t, ev) => (listeners[t] || []).forEach(fn => fn.call(base, ev || { target: base })),
    querySelector: s => makeEl(sel + " " + s),
    querySelectorAll: () => [],
    getAttribute: () => null,
    setAttribute: () => {},
    closest: () => null,
    click: () => base.fire("click"),
    focus: () => {},
    remove: () => {}
  };
  return new Proxy(base, {
    get(t, p) { return p in t ? t[p] : undefined; },
    set(t, p, v) { t[p] = v; return true; }
  });
}

/* ------------------------------------------------------------ 假 Supabase */
/* seed：一份最小的云端数据。刻意让两个人的 domain 与 module「不一致」，
   用来证明领域归属看的是 staff.domain（N16），不是模块名。 */
const STAFF = [
  /* 3c 主力（模块就是 3C 顾问，行为与内嵌页面一致） */
  { name: "何广友", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "邓臻蓝", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "孙勇", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "王鹏俊", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "陈悦娴", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "高超", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "吴心然", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "刘舒晨", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "刘思含", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "吴洋洋", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "李敏", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "张子柔", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  { name: "冯楷", module: "3C顾问", position: "销售顾问", level: "员工", domain: "3c" },
  /* 磕 domain/module 不一致的两个人（N16 的关键用例） */
  { name: "张淑慧", module: "行政", position: "综合", level: "员工", domain: "3c" },     // 模块是行政，但归属 3c
  { name: "邢晓东", module: "3C顾问", position: "销售顾问", level: "员工", domain: "hongmeng" }, // 模块是 3c，但归属鸿蒙
  /* 鸿蒙 */
  { name: "晏潇艺", module: "鸿蒙智行", position: "杜勇", level: "经理", domain: "manager" },
  { name: "黄晰文", module: "鸿蒙智行", position: "杜勇", level: "员工", domain: "hongmeng" },
  { name: "赵一鸣", module: "鸿蒙智行", position: "销售顾问", level: "员工", domain: "hongmeng" },
  { name: "钱二壮", module: "鸿蒙智行", position: "销售顾问", level: "员工", domain: "hongmeng" }
];

function makeDb() {
  const log = { selects: [], upserts: [], deletes: [] };
  let waiters = [];
  const notify = () => { const w = waiters; waiters = []; w.forEach(f => f()); };
  const rows = {
    weeks: [{ week_key: WEEK, status: "draft" }],
    staff: STAFF.map(s => ({ ...s, active: true })),
    shifts: [],
    publish_versions: [],
    publish_deliveries: [],
    /* 规则阈值：这份测试名单比线上 31 人小，需求按比例缩小，否则必然填不满
       （填不满时引擎会牺牲休息天数，rest=2 的断言就测不出「映射写错」了） */
    rules: [
      { domain: "3c", config: {
        needs: [0, 1, 2, 3, 4].map(() => ({ early: 4, mid: 1, night: 4 }))
          .concat([5, 6].map(() => ({ early: 4, mid: 2, night: 5 }))),
        limits: { early: 3, night: 3, mid: 99 },
        restMax: { min: 2, per: 2, total: 0 }
      } },
      { domain: "hongmeng", config: {
        needs: [0, 1, 2, 3, 4].map(() => ({ early: 2, mid: 1, night: 1 }))
          .concat([5, 6].map(() => ({ early: 2, mid: 1, night: 2 })))
      } }
    ],
    /* must_work 的真实表结构带 week_key（001_init.sql），没有它会被
       `week_key=eq.<本周>` 过滤掉 —— 排班变成随机，断言就成了掷骰子 */
    must_work: [{ week_key: WEEK, staff_name: "陈悦娴", day: 0 }],
    requests: [
      { staff_name: "何广友", day: 3, type: "leave", week_key: WEEK },      /* 本周请假：周四 */
      { staff_name: "孙勇", day: 5, type: "swap", week_key: WEEK }          /* 调班：一期不支持，应被列为待人工确认 */
    ],
    fixed_roster: [{ domain: "admin", staff_name: null, pattern: ["early", "early", "early", "early", "early", "rest", "rest"] }]
  };
  const db = {
    log,
    select(table, query) {
      log.selects.push({ table, query });
      let data = (rows[table] || []).slice();
      /* 只实现本测试用到的两种过滤，够用来验证「只取本周」没写错 */
      const m = /week_key=eq\.([0-9-]+)/.exec(query || "");
      if (m) data = data.filter(r => r.week_key === m[1]);
      if (/week_key=is\.null/.test(query || "")) data = [];
      if (/status=eq\.approved/.test(query || "")) data = data.filter(r => r.status !== "rejected");
      return Promise.resolve({ ok: true, http: 200, data, code: "ok", error: "" });
    },
    insert(table, body) { (rows[table] = rows[table] || []).push(...(Array.isArray(body) ? body : [body])); return Promise.resolve({ ok: true, http: 201, data: body }); },
    upsert(table, body) {
      if (table === "shifts") {
        log.upserts.push({ table, rows: body.slice() });
        notify();
      }
      const key = r => r.staff_name + "|" + r.day;
      const map = new Map((rows[table] || []).map(r => [key(r), r]));
      body.forEach(r => map.set(key(r), r));
      rows[table] = [...map.values()];
      return Promise.resolve({ ok: true, http: 200, data: body });
    },
    patch() { return Promise.resolve({ ok: true, http: 200, data: [] }); },
    del(table, query) {
      log.deletes.push({ table, query });
      return Promise.resolve({ ok: true, http: 204, data: null });
    },
    __rows: rows,
    __waitUpsert() { return new Promise(res => waiters.push(res)); }
  };
  return db;
}

/* ------------------------------------------------------------ 跑页面 */
async function run() {
  const db = makeDb();
  const els = {};
  const $ = sel => (els[sel] = els[sel] || makeEl(sel));
  const toasts = [];
  const sleeps = [];
  const sandbox = {
    console, Promise, JSON, Math, Date,
    setTimeout: (fn, ms) => { sleeps.push(ms || 0); const t = setTimeout(fn, 0); return t; },
    clearTimeout: id => clearTimeout(id),
    confirm: () => true,
    alert: () => {},
    location: { replace() {}, href: "https://example.invalid/manager.html" },
    document: {
      getElementById: id => $("#" + id),
      querySelectorAll: () => [],
      querySelector: s => makeEl(s),
      createElement: () => makeEl("el"),
      body: makeEl("body"),
      addEventListener() {}
    }
  };
  sandbox.window = { addEventListener() {}, Scheduler: null };
  sandbox.globalThis = sandbox;
  sandbox.SR = {
    $,
    db,
    session: { get: () => ({ access_token: "test-token", username: "boss", display_name: "店长", role: "manager" }) },
    ui: { toast: (m, k) => toasts.push({ msg: m, kind: k }), setLoading() {} },
    api: { call: () => Promise.resolve({ ok: true, http: 200, data: { ok: true } }) }
  };
  vm.createContext(sandbox);
  vm.runInContext(SCHED_SRC, sandbox, { filename: "scheduler.js" });
  sandbox.window.Scheduler = sandbox.Scheduler;

  /* 取主脚本：跳过带 src 的 <script>，取最长那段 */
  let code = "";
  for (const m of HTML.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    if (m[2].length > code.length) code = m[2];
  }
  if (!code) throw new Error("manager.html 里没找到主脚本");
  /* 变异开关：把 N16 的关键一行删掉，断言必须变红 —— 否则这个测试等于没测。
     用法：MANAGER_MUTATE=1 node tools/test_manager_generate.mjs */
  if (process.env.MANAGER_MUTATE) {
    const before = code;
    code = code.replace("st.staffDomain[p.name] = p.domain;", "");
    if (code === before) throw new Error("变异未生效：没找到 staffDomain 赋值行");
    console.log("（变异模式：已删除 staffDomain 映射，断言应当变红）");
  }

  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  /* 页面初始化会 load(本周)：等它把 saveState 置成「草稿已同步」 */
  vm.runInContext(code, sandbox, { filename: "manager.html" });
  for (let i = 0; i < 200 && $("#saveState").textContent !== "草稿已同步"; i++) await new Promise(r => setTimeout(r, 5));
  ok($("#saveState").textContent === "草稿已同步", "载入后状态应为「草稿已同步」，实际：" + $("#saveState").textContent);

  /* 生成本周：用「快速」档，避免测试等太久 */
  $("#genEffort").value = "fast";
  const done = db.__waitUpsert();
  $("#genBtn").fire("click");
  await Promise.race([done, new Promise(r => setTimeout(r, 30000))]);
  /* 落库之后页面还要写「生成结果」提示条，等它出现再断言（否则读到的是空字符串） */
  for (let i = 0; i < 200 && !$("#genResult").innerHTML; i++) await new Promise(r => setTimeout(r, 5));

  const ups = db.log.upserts[0];
  ok(!!ups, "「生成本周」没有写出任何 shifts 草稿（可能报错了，toast：" +
    toasts.map(t => t.msg).join(" / ") + "）");
  const rows = ups ? ups.rows : [];

  /* ① 行本身合法：周次正确、day 0..6、slot 在老 enum 里 */
  const SLOT_OK = new Set(["early", "mid", "night", "rest"]);
  ok(rows.every(r => r.week_key === WEEK), "写回行的 week_key 应全部是 " + WEEK);
  ok(rows.every(r => r.day >= 0 && r.day <= 6), "写回行的 day 必须在 0..6");
  ok(rows.every(r => SLOT_OK.has(r.slot)), "写回行的 slot 必须是 early/mid/night/rest，实际出现：" +
    [...new Set(rows.map(r => r.slot))].join(","));
  ok(rows.every(r => r.role === null || r.role === "open" || r.role === "close"), "role 只能是 open/close/null");
  /* 「轻触」契约：算法生成的格子不是「手动」格，不能把上一版的 manual 标记继承下来 */
  ok(rows.every(r => r.manual === false), "引擎写回的格子 manual 必须是 false，实际出现：" +
    [...new Set(rows.map(r => r.manual))].join(","));

  /* ② 每人恰好休 2 天（引擎硬约束 5）—— 这条能一次抓住「输入映射写错」的大多数情况 */
  const byName = {};
  rows.forEach(r => { (byName[r.staff_name] = byName[r.staff_name] || []).push(r); });
  Object.keys(byName).forEach(n => {
    const rest = byName[n].filter(r => r.slot === "rest").length;
    ok(rest === 2, `${n} 应恰好休 2 天，实际 ${rest} 天`);
  });

  /* ③ 请假 / 必上真的落实了 */
  const cell = (n, d) => (byName[n] || []).find(r => r.day === d) || {};
  ok(cell("何广友", 3).slot === "rest", "何广友周四请假，班表里应为 rest，实际 " + cell("何广友", 3).slot);
  ok(cell("陈悦娴", 0).slot && cell("陈悦娴", 0).slot !== "rest", "陈悦娴周一是「固定上班日」，不该排休息");

  /* ④ 每人都是一整周的 7 行（引擎产出的是完整周表，不能缺天） */
  Object.keys(byName).forEach(n => {
    const days = new Set(byName[n].map(r => r.day));
    ok(days.size === 7, `${n} 应有 7 天记录，实际 ${days.size} 天`);
  });

  /* ⑤ N16：领域看 staff.domain —— 张淑慧（模块行政）必须出现在 3c，邢晓东出现在鸿蒙 */
  const has3c = rows.some(r => r.staff_name === "张淑慧");
  const hasHM = rows.some(r => r.staff_name === "邢晓东");
  ok(has3c, "张淑慧的 domain=3c，应该被排进 3c（不能因为模块是「行政」就被免排）");
  ok(hasHM, "邢晓东的 domain=hongmeng，应该被排进鸿蒙（不能因为模块是「3C顾问」就掉进 3c）");

  /* ⑥ 调班申请一期不支持：必须出现在结果提示里，而不是被安静吞掉 */
  const note = $("#genResult").innerHTML || "";
  ok(/调班申请暂不支持/.test(note), "调班（swap）申请应提示「暂不支持」，实际提示：" + note.slice(0, 200));

  /* ⑦ 两位经理（level=经理）不参与排班 */
  ok(!rows.some(r => r.staff_name === "晏潇艺"), "经理（level=经理）不该被排进班表");

  /* ⑧ 一天都没落下：3c 每个工作日都要有早班（说明需求/槽位映射没塌） */
  const earlyByDay = [0, 1, 2, 3, 4, 5, 6].map(d =>
    rows.filter(r => r.day === d && r.slot === "early" && (byName3c(r.staff_name))).length);
  ok(earlyByDay.every(n => n > 0), "3c 每天都要有人上早班，实际每天早班人数：" + earlyByDay.join(","));

  function byName3c(n) { return STAFF.some(s => s.name === n && s.domain === "3c"); }

  /* ------------------------------------------------------------ 输出 */
  console.log(`写回 ${rows.length} 行 · ${Object.keys(byName).length} 人 · upsert ${db.log.upserts.length} 次`);
  console.log(`涉及领域（按页面选「全部」逐领域生成）· 3c 早班/天：${earlyByDay.join(",")}`);
  console.log(`提示：${toasts.map(t => t.msg).join(" / ").slice(0, 300)}`);
  if (fails.length) {
    if (process.env.MANAGER_MUTATE) {
      console.log("\n✅ 变异如期变红（" + fails.length + " 项失败）：测试确实能抓到 N16 映射缺失");
      process.exit(0);
    }
    console.log("\n❌ 失败 " + fails.length + " 项：");
    fails.forEach(f => console.log("   × " + f));
    process.exit(1);
  }
  if (process.env.MANAGER_MUTATE) {
    console.log("\n❌ 变异没变红：这个测试抓不到 staffDomain 缺失，判据太弱");
    process.exit(1);
  }
  console.log("\n✅ 经理端「生成本周」端到端通过");
}

run().catch(e => {
  console.error("测试自身出错：", e && e.stack || e);
  process.exit(1);
});
