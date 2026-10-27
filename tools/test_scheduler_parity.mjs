/* 差分测试：抽出来的 _deploy/scheduler.js 与内嵌在 app_merged.html 里的引擎，
   在同一份输入 + 同一颗随机种子下必须产出**逐格完全一致**的班表。

   为什么必须做这个：抽取（N14）最大的风险是「抽错了但没人发现」——
   少搬一个函数、钩子替身行为不同，都可能让云端排出的班表与页面上不一样。
   光靠「能加载、能跑出结果」是查不出来的，只有逐格比对才算证据。

   做法（两侧对称，不修改 app_merged.html）：
     · 两侧都用 mulberry32(seed) 接管 Math.random      → 随机序列完全一致
     · 两侧都用「每次读表 +1ms」的虚拟时钟             → 时间预算判定完全一致
       （deadline 比较的是**差值**，所以起点不同不影响判定；
         虚拟时钟下 1600ms 预算等于 1600 次读表，300 次候选根本走不到，两侧都不会提前收工）
     · 两侧喂同一份 state（人员 / 需求 / 规则 / 分组 / 固定上班日），
       并且以页面实际加载后的 state 为准（页面初始化可能做过迁移）
   然后比对 state.schedule[周一] 与 state.roles[周一]。

   用法：
     node tools/test_scheduler_parity.mjs                  # 默认 3 颗种子
     node tools/test_scheduler_parity.mjs --seed 7         # 只跑一颗
     PARITY_MUTATE=1 node tools/test_scheduler_parity.mjs  # 变异测试：故意改坏引擎，断言必须变红
   退出码 0 = 完全一致；1 = 有差异（或变异测试没变红）。
*/
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadApp, mulberry32 } = require(path.join(ROOT, "audit_core.js"));

const HTML = path.join(ROOT, "app_merged.html");
const SCHED = path.join(ROOT, "_deploy", "scheduler.js");

const argv = process.argv.slice(2);
const iSeed = argv.indexOf("--seed");
const SEEDS = iSeed >= 0 ? [Number(argv[iSeed + 1])] : [1, 2, 7];
const MUTATE = process.env.PARITY_MUTATE === "1";

const clone = o => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------------- 公共输入 */
/* 与 audit_core.resetConfig 同一套 3C 三班配置，另加一条「每周三请假」，
   让「请假 / 改班违约」这条链路也参与比对（只比班表的话，规则链路坏了看不出来）。 */
function buildInput(DEFAULT_STAFF) {
  return {
    staff: DEFAULT_STAFF.slice(),
    staffProfiles: {},
    needs: [0, 1, 2, 3, 4].map(() => ({ early: 9, mid: 1, night: 10 }))
      .concat([5, 6].map(() => ({ early: 9, mid: 3, night: 12 }))),
    limits: { early: 3, night: 3, mid: 99 },
    restMax: { min: 2, per: 2, total: 0 },
    exactShifts: ["early"],
    weekendEarlyMax: 1,
    requests: [
      { id: 1, name: "何广友", day: 3, type: "off", scope: "always", weekKey: "" },
      { id: 2, name: "孙勇", day: 5, type: "night", scope: "always", weekKey: "" }
    ],
    schedule: {}, roles: {}, roleSig: {}, manual: {},
    mustWork: [{ name: "陈悦娴", day: 0 }, { name: "张淑慧", day: 0 }],
    groups: {
      earlyNight: { members: ["何广友", "邓臻蓝", "孙勇", "王鹏俊"], minEarly: 1, minNight: 1 },
      openClose: {
        members: ["陈悦娴", "高超", "吴心然", "刘舒晨", "刘思含", "吴洋洋", "李敏", "张子柔", "冯楷"],
        open: 1, close: 2, maxPerWeek: 3
      }
    },
    domain: "3c"
  };
}

/* ------------------------------------------------------- ① 内嵌版（legacy） */
function runLegacy(seed) {
  const { T, S, sandbox } = loadApp(HTML, seed);
  const input = buildInput(T.DEFAULT_STAFF);
  /* 以页面加载后的 state 为准补齐「引擎会读、但页面可能改过」的字段，
     免得两侧因为初始化迁移的差异出现假阳性。 */
  input.moduleMinOn = S.moduleMinOn;
  input.fixedRoster = clone(S.fixedRoster || {});
  Object.keys(input).forEach(k => { S[k] = clone(input[k]); });
  S.schedule = {}; S.roles = {}; S.roleSig = {}; S.manual = {};

  /* 关键：页面加载阶段自己消耗过随机数（比如渲染时的抖动），
     所以必须在**引擎开始之前**把随机序列重新对齐到 seed，
     否则两侧从第一条候选起就是两颗不同的骰子。 */
  sandbox.Math.random = mulberry32(seed);

  T.autoSchedule("3c");
  const k = T.curKey();
  return {
    weekKey: k,
    grid: clone(S.schedule[k] || {}),
    roles: clone(S.roles[k] || {}),
    input
  };
}

/* ------------------------------------------------- ② 抽取版（scheduler.js） */
/* 把 scheduler.js 放进与 legacy 同样口径的沙箱：同一颗种子、同一个虚拟时钟。 */
function loadScheduler(seed, source) {
  const rng = mulberry32(seed);
  let vclock = 1000;
  const RealDate = Date;
  function FakeDate(...a) { return a.length ? new RealDate(...a) : new RealDate(1767225600000); }
  FakeDate.now = () => (vclock += 1);
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  const M = Object.create(Math);
  M.random = rng;
  const sandbox = {
    Math: M, Date: FakeDate, JSON, Object, Array, String, Number, Boolean,
    Set, Map, WeakMap, WeakSet, Promise, RegExp, Error, TypeError, RangeError,
    isNaN, isFinite, parseInt, parseFloat,
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => FakeDate.now() }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "scheduler.js" });
  if (!sandbox.Scheduler) throw new Error("scheduler.js 没有导出 Scheduler");
  return sandbox.Scheduler;
}

function runScheduler(seed, source, input, weekKey) {
  const S = loadScheduler(seed, source);
  const res = S.generateWeek({
    effort: "fast",                  // fast = 与旧版一致（攒够 MIN_POOL 且合格就收工）
    weekKey, domain: "3c",
    input: { state: clone(input) }
  });
  if (!res.grid) throw new Error("scheduler.generateWeek 没产出班表：" + JSON.stringify(res.warnings));
  return { weekKey: res.weekKey, grid: res.grid, roles: res.roles, ms: res.ms, stats: res.stats };
}

/* ------------------------------------------------------------------ 比对 */
/* 缺失的行按「整周空」处理：内嵌版排完班后 renderAll() → renderTable() 会调
   ensureWeek()，把所有没排到的人补成 7 个空串；抽取版运行在无 UI 的宿主里，
   renderAll 是空实现，所以这些「本来就没人排」的行不会出现。
   这是宿主渲染的差别，不是引擎的差别 —— 但为了让比对不放水，
   仍然逐行比 7 个格子：真正的排班差异（谁上了什么班）一个都跑不掉。 */
const EMPTY_ROW = "─ ─ ─ ─ ─ ─ ─";
function diffGrid(a, b) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const rows = [];
  const f = r => [0, 1, 2, 3, 4, 5, 6].map(d => (r[d] || "─")).join(" ");
  for (const n of names) {
    const va = a[n] ? f(a[n]) : EMPTY_ROW;
    const vb = b[n] ? f(b[n]) : EMPTY_ROW;
    if (va !== vb) rows.push({ name: n, legacy: va, extracted: vb });
  }
  return rows;
}

const source0 = fs.readFileSync(SCHED, "utf8");
/* 变异测试：故意改坏抽出来的引擎，断言「差分测试必须报错」。
   不变红的话，「跑绿」说明不了任何事 —— 万一是比对逻辑本身失效了呢。 */
let source = source0;
if (MUTATE) {
  /* 把「至少攒够 40 个候选才收工」抬到 250：候选池的规模直接改变最终选出的班表。
     为什么不用更小的 0：那样中途的收工条件仍会命中同一张最优表，改动测不出来
     （这一步是实测过的 —— 变了红才说明比对真的在比引擎输出）。 */
  source = source0.replace("const MIN_POOL = 40;", "const MIN_POOL = 250;");
  if (source === source0) { console.error("!! 变异注入失败：没找到 MIN_POOL 那一行"); process.exit(1); }
}

let failed = false;
for (const seed of SEEDS) {
  const t0 = Date.now();
  const legacy = runLegacy(seed);
  const t1 = Date.now();
  const ext = runScheduler(seed, source, legacy.input, legacy.weekKey);
  const t2 = Date.now();

  const rows = diffGrid(legacy.grid, ext.grid);
  const rolesDiff = JSON.stringify(legacy.roles) !== JSON.stringify(ext.roles);
  const head = `seed=${seed}  周=${legacy.weekKey}  行数 内嵌 ${Object.keys(legacy.grid).length} / 抽取 ${Object.keys(ext.grid).length}`;
  if (rows.length === 0 && !rolesDiff) {
    console.log(`OK  ${head}  —— 逐格一致（内嵌 ${t1 - t0}ms / 抽取 ${t2 - t1}ms）`);
  } else {
    failed = true;
    console.log(`BAD ${head}`);
    if (rows.length) {
      console.log(`   班表有 ${rows.length} 行不同：`);
      rows.slice(0, 8).forEach(r =>
        console.log(`     ${r.name}\n       内嵌: ${r.legacy}\n       抽取: ${r.extracted}`));
      if (rows.length > 8) console.log("     …（只显示前 8 行）");
    }
    if (rolesDiff) {
      console.log(`   开店闭店标记也不同：\n     内嵌: ${JSON.stringify(legacy.roles)}\n     抽取: ${JSON.stringify(ext.roles)}`);
    }
  }
}

if (MUTATE) {
  if (failed) {
    console.log("\n变异测试通过：故意改坏引擎后差分测试如期变红 → 这个断言是有效的");
    process.exit(0);
  }
  console.log("\n变异测试失败：引擎被改坏了，差分测试却还是绿的 → 断言无效，必须修");
  process.exit(1);
}
console.log(failed ? "\n结果：存在差异，抽取版与内嵌版不等价" : "\n结果：抽取版与内嵌版逐格一致");
process.exit(failed ? 1 : 0);