/* 跑分基座（算法文档 §8 一期的验收工具）。
   目的：N1（预算用满）/ N2（爬山）到底有没有让班表变好？不靠感觉，靠同一批种子跑出来的数字。
   验收口径（文档原文）：**N1+N2 后违约率不升、评分方差下降**。

   判据（按可靠性排序）：
     ① 逐种子成绩单不退化 —— 同一颗种子下，quality 与 fast 用**同一套字典序**
        （缺口→请假违约→硬约束→少上班→评分）逐位比较，quality 必须不劣于 fast。
        这是「可证的性质」，比统计量硬得多，也是主判据。
     ② 违约率不升、平均违约条数不升。
     ③ 评分均值不降。
     ④ 评分标准差下降 —— 只在「虚拟时钟 + RUNS>=30」时才作为硬条件：
        真实时钟下同一份代码的标准差每次都不一样（实测 165.55 / 54.60 / 52.29），
        小样本下个别极端种子就能把方向翻掉。两个条件不满足就只打印、不判定。
   其余指标（缺口 / 上一休一 / 三连休 / 模块在岗 / 分组保障 / 少上班天数 / 班次均衡 / 耗时）
   一并打印，便于定位回归。
     · 评分离散 —— 同一份配置在多颗种子下的 planScore 标准差（越低说明输出越稳定；
                   这正是「一次排得好看、下次翻车」的根源，方差比均值更值得盯）
     · 跨周方差 —— 批量排 N 周时，每个人每周晚班/早班次数的方差再对人取平均
                   （越低说明轮转越公平，不会「这周你全是晚班、下周还是你」）

   时钟：默认**虚拟时钟**（每次 Date.now() +1ms），保证同一颗种子逐字节可复现；
   真实耗时另跑 3 颗种子单独报，不进判据。`--clock real` 可切回全真实时钟。

   用法：
     node tools/bench_scheduler.mjs                  # 30 颗种子 × 单周（默认，判据可靠）
     node tools/bench_scheduler.mjs --runs 40
     node tools/bench_scheduler.mjs --weeks 4        # 加跑 4 周跨周
     node tools/bench_scheduler.mjs --detail         # 逐种子打印成绩单
     node tools/bench_scheduler.mjs --clock real     # 真实时钟（标准差只作参照）
   退出码：0 = 满足验收；1 = 未达标。
*/
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { mulberry32 } = require(path.join(ROOT, "audit_core.js"));
const SCHED_SRC = fs.readFileSync(path.join(ROOT, "_deploy", "scheduler.js"), "utf8");

function arg(name, dflt) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const RUNS = Number(arg("runs", 30));
const WEEKS = Number(arg("weeks", 1));
const DOMAIN = arg("domain", "3c");
const WEEK0 = arg("week", "2026-01-05");   // 周一
/* --detail：逐种子打印成绩单。用来排查「某一颗种子把标准差抬起来」的情况：
   若两次 `--detail` 跑出来的同一颗种子行不一致，就是**真实时钟**导致的不可复现，
   此时标准差（以及任何平均量）都不该当判据用。 */
/* --clock virtual（默认）：把时钟换成「每次 Date.now() 前进 1ms」的虚拟时钟。
   为什么要这个：真实时钟下同一颗种子两次跑出来的 quality 成绩**不完全一样**
   （预算到点的时刻取决于机器快慢/负载），于是「评分标准差」这种统计量会随机器抖动
   —— 实测同一份代码 30 颗种子跑三次，标准差给出 165.55 / 54.60 / 52.29 三个结论。
   方差是**算法属性**，不是机器属性，所以判「方差下降」必须用可复现的虚拟时钟：
   虚拟时钟下两次跑完 30 颗种子，逐种子成绩单**逐字节一致**（只有耗时不同）。
   两档用同一颗虚拟时钟、同一套预算口径，比较才公平。
   真实时钟另外跑 3 颗种子，只用来报「真实耗时」（--clock real 可切回全真实时钟跑）。 */
const VCLOCK = arg("clock", "virtual") === "virtual";
/* --detail：逐种子打印成绩单。真实时钟下若两次 `--detail` 的同一颗种子行不一致，
   说明那颗种子被预算截断了（机器慢），此时任何统计量都不该当判据用。 */
const DETAIL = process.argv.includes("--detail");

/* ------------------------------------------------------------ 引擎实例 */
/* 随机数按种子接管，保证可复现；时钟按 useV 选真实 / 虚拟。 */
function newEngine(seed, useV) {
  const rng = mulberry32(seed);
  const M = Object.create(Math);
  M.random = rng;
  let vclock = 1000;
  const RealDate = Date;
  function FakeDate(...a) { return a.length ? new RealDate(...a) : new RealDate(1767225600000); }
  FakeDate.now = () => (vclock += 1);
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  const sandbox = {
    Math: M, Date: useV ? FakeDate : Date, JSON, Object, Array, String, Number, Boolean,
    Set, Map, WeakMap, WeakSet, Promise, RegExp, Error, TypeError, RangeError,
    isNaN, isFinite, parseInt, parseFloat,
    console: { log() {}, warn() {}, error() {} },
    performance: useV ? { now: () => FakeDate.now() } : performance
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SCHED_SRC, sandbox, { filename: "scheduler.js" });
  return sandbox.Scheduler;
}

/* ------------------------------------------------------------ 输入配置 */
/* 与差分测试同一套 3C 配置（31 人规模、早 9 / 中 1 / 晚 10，周末 9/3/12），
   另加两条规则，让「请假 / 固定上班日 / 固定班次」三条链路都参与跑分。 */
function buildInput(engine) {
  const names = Object.keys(engine.fn("ROSTER_PROFILES") || {});
  return {
    staff: names,
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
    domain: DOMAIN
  };
}

const clone = o => JSON.parse(JSON.stringify(o));
const MODES = [
  { key: "fast", opt: { fillBudget: false, climbMs: 0 } },
  { key: "quality", opt: { fillBudget: true } }
];

/* ------------------------------------------------------------ 指标计算 */
const SH = ["early", "mid", "night"];
function stat(a) {
  if (!a.length) return { mean: 0, sd: 0, range: 0 };
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length);
  return { mean: m, sd, range: Math.max(...a) - Math.min(...a) };
}
/* 只看「真的被排过班」的人，经理 / 免排人员整周空格不算进公平性 */
function fairness(grid) {
  const rows = Object.keys(grid).map(n => grid[n] || [])
    .filter(r => r.some(v => SH.indexOf(v) >= 0));
  const cnt = sh => rows.map(r => r.filter(v => v === sh).length);
  return { early: stat(cnt("early")), night: stat(cnt("night")), people: rows.length };
}
/* 跨周轮转方差：每人每周晚班次数在周与周之间的方差，再对所有取平均 */
function crossWeekVariance(grids) {
  const names = [...new Set(grids.flatMap(g => Object.keys(g)))]
    .filter(n => grids.some(g => (g[n] || []).some(v => SH.indexOf(v) >= 0)));
  const out = { night: 0, early: 0 };
  if (!names.length) return out;
  const perPerson = sh => names.map(n => stat(grids.map(g => ((g[n] || []).filter(v => v === sh).length))).sd);
  const nightSD = perPerson("night"), earlySD = perPerson("early");
  out.night = nightSD.reduce((s, x) => s + x, 0) / nightSD.length;
  out.early = earlySD.reduce((s, x) => s + x, 0) / earlySD.length;
  return out;
}

/* ------------------------------------------------------------ 成绩单（判据核心） */
/* 单周「成绩单」—— 与引擎选优**同一套字典序**（算法文档 §6 N2）：
     缺口 gaps → 请假/改班违约 ruleViol → 其余硬约束之和 → 少上班天数 shortWork → 评分(取负)
   越低越好。两个档位在同一颗种子下比这个元组：quality 必须**不劣于** fast。
   这比只看均值/方差硬得多 —— 均值会被个别种子拉高，而方差对样本量极敏感
   （同一份代码 40 种子达标、12 种子翻盘），逐种子比较才是「可证的性质」。 */
function gradeOf(st) {
  if (!st) return null;
  const bad = (st.isoRest || 0) + (st.groupViol || 0) + (st.run3Bad || 0)
    + (st.modViol || 0) + (st.floorBad || 0);
  return [st.gaps || 0, st.ruleViol || 0, bad, st.shortWork || 0, -(st.score || 0)];
}
/* a 严格优于 b？（逐位比较，越低越好） */
function gradeLt(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
/* 逐种子比较两档成绩单：better = quality 更优，worse = quality 更差，tie = 完全一致 */
function gradeRegress(fastRows, qualityRows) {
  let better = 0, worse = 0, tie = 0;
  for (let i = 0; i < fastRows.length && i < qualityRows.length; i++) {
    const a = fastRows[i].grade, b = qualityRows[i].grade;
    if (!a || !b) continue;
    if (gradeLt(b, a)) better++;
    else if (gradeLt(a, b)) worse++;
    else tie++;
  }
  return { better, worse, tie, n: better + worse + tie };
}

/* ------------------------------------------------------------ 单次跑分 */
/* 单周：跑一周并体检 */
function runOne(seed, mode) {
  const E = newEngine(seed, VCLOCK);
  const input = buildInput(E);
  const t0 = Date.now();
  const res = E.generateWeek({ effort: mode.opt.fillBudget ? "quality" : "fast", weekKey: WEEK0, domain: DOMAIN, input: { state: input } });
  const ms = Date.now() - t0;
  const st = res.stats || {};
  return {
    hard: st.hard || 0, gaps: st.gaps || 0, isoRest: st.isoRest || 0, groupViol: st.groupViol || 0,
    run3Bad: st.run3Bad || 0, modViol: st.modViol || 0, floorBad: st.floorBad || 0,
    shortWork: st.shortWork || 0, score: st.score || 0, ms,
    grade: gradeOf(st),
    fair: fairness(res.grid || {})
  };
}
/* 跨周：批量排 N 周，逐周体检 + 跨周轮转方差 */
function runBatch(seed, mode) {
  const E = newEngine(seed, VCLOCK);
  const input = buildInput(E);
  E.loadInput({ state: input });
  const t0 = Date.now();
  E.batchScheduleWeeks(WEEKS, DOMAIN, mode.opt);
  const ms = Date.now() - t0;
  const state = E.state;
  const keys = Object.keys(state.schedule).sort();
  const grids = keys.map(k => state.schedule[k]).filter(g => g && Object.keys(g).length);
  const stats = grids.map(g => E.checkWeek(g, DOMAIN));
  const hard = stats.reduce((s, x) => s + (x.hard || 0), 0);
  const bad = stats.reduce((s, x) => s + (x.gaps || 0) + (x.isoRest || 0) + (x.groupViol || 0)
    + (x.run3Bad || 0) + (x.modViol || 0) + (x.floorBad || 0), 0);
  const cw = crossWeekVariance(grids);
  const scores = stats.map(x => x.score || 0);
  /* 跨周成绩单 = 各周成绩单逐位求和（周与周同等重要），仍是同一套字典序 */
  const gs = stats.map(gradeOf).filter(Boolean);
  const grade = gs.length
    ? gs[0].map((_, i) => gs.reduce((s, g) => s + g[i], 0))
    : null;
  return {
    weeks: grids.length, hard, bad, grade,
    score: scores.reduce((s, x) => s + x, 0) / (scores.length || 1),
    scoreSD: stat(scores).sd,
    cwNight: cw.night, cwEarly: cw.early, ms
  };
}

const f = (x, n = 2) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n);
const f0 = x => f(x, 0);

/* 真实耗时探针：虚拟时钟下 `ms` 不反映机器真实开销，所以另跑 3 颗种子（真实时钟）
   只为拿到「一次生成本周要等多久」这个数。结果不进判据。 */
const TIMING_SEEDS = 3;
function probeTiming() {
  const out = { fast: 0, quality: 0 };
  for (let seed = 1; seed <= TIMING_SEEDS; seed++) {
    for (const mode of MODES) {
      const E = newEngine(seed, false);
      const input = buildInput(E);
      const t0 = Date.now();
      E.generateWeek({ effort: mode.opt.fillBudget ? "quality" : "fast",
        weekKey: WEEK0, domain: DOMAIN, input: { state: input } });
      out[mode.key] += Date.now() - t0;
    }
  }
  out.fast /= TIMING_SEEDS;
  out.quality /= TIMING_SEEDS;
  return out;
}

/* ------------------------------------------------------------ 主流程 */
const single = {}, batch = {};
for (const mode of MODES) {
  single[mode.key] = [];
  batch[mode.key] = [];
}
for (let seed = 1; seed <= RUNS; seed++) {
  for (const mode of MODES) {
    single[mode.key].push(runOne(seed, mode));
    if (WEEKS >= 2) batch[mode.key].push(runBatch(seed, mode));
  }
  if (DETAIL) {
    const a = single.fast[seed - 1], b = single.quality[seed - 1];
    process.stdout.write(`\nseed ${String(seed).padStart(3)}  ` +
      `fast: hard=${a.hard} score=${f0(a.score)} [${a.grade.join(",")}]  ` +
      `quality: hard=${b.hard} score=${f0(b.score)} [${b.grade.join(",")}]  ` +
      `ms ${a.ms}/${b.ms}`);
  } else {
    process.stdout.write(`\r跑分中 ${seed}/${RUNS}（每颗种子 ${MODES.length} 档${WEEKS >= 2 ? " × 单周+跨周" : ""}）…`);
  }
}
if (DETAIL) process.stdout.write("\n\n");
process.stdout.write("\r" + " ".repeat(60) + "\r");

function summarize(rows) {
  const out = {};
  out.violRate = rows.filter(r => r.hard > 0).length / rows.length;
  out.hardMean = stat(rows.map(r => r.hard)).mean;
  out.scoreMean = stat(rows.map(r => r.score)).mean;
  out.scoreSD = stat(rows.map(r => r.score)).sd;
  out.gaps = stat(rows.map(r => r.gaps)).mean;
  out.iso = stat(rows.map(r => r.isoRest)).mean;
  out.run3 = stat(rows.map(r => r.run3Bad)).mean;
  out.mod = stat(rows.map(r => r.modViol)).mean;
  out.grp = stat(rows.map(r => r.groupViol)).mean;
  out.short = stat(rows.map(r => r.shortWork)).mean;
  out.earlyRange = stat(rows.map(r => r.fair.early.range)).mean;
  out.earlySD = stat(rows.map(r => r.fair.early.sd)).mean;
  out.nightRange = stat(rows.map(r => r.fair.night.range)).mean;
  out.nightSD = stat(rows.map(r => r.fair.night.sd)).mean;
  out.ms = stat(rows.map(r => r.ms)).mean;
  return out;
}
function summarizeBatch(rows) {
  const out = {};
  out.hardMean = stat(rows.map(r => r.hard)).mean;
  out.violRate = rows.filter(r => r.hard > 0).length / rows.length;
  out.scoreMean = stat(rows.map(r => r.score)).mean;
  out.scoreSD = stat(rows.map(r => r.scoreSD)).mean;   // 同一次批量里各周之间的离散
  out.cwNight = stat(rows.map(r => r.cwNight)).mean;
  out.cwEarly = stat(rows.map(r => r.cwEarly)).mean;
  out.ms = stat(rows.map(r => r.ms)).mean;
  return out;
}

const S = { fast: summarize(single.fast), quality: summarize(single.quality) };
/* 标准差要当判据，需要两个条件同时成立：
   ① 时钟可复现（虚拟时钟）—— 否则同一份代码每次跑出来的标准差都不一样；
   ② 样本量够（RUNS >= 30）—— 否则个别极端种子就能把标准差翻个方向。 */
const sampleOK = RUNS >= 30;
const sdJudgeable = VCLOCK && sampleOK;
const timing = VCLOCK ? probeTiming() : { fast: S.fast.ms, quality: S.quality.ms };
console.log(`\n=== 单周跑分（${DOMAIN} · ${RUNS} 颗种子 · ${WEEK0} 起 · ${VCLOCK ? "虚拟时钟（可复现）" : "真实时钟"}）===`);
console.log("指标".padEnd(24) + "fast".padStart(14) + "quality".padStart(14) + "  quality 更好？");
const rows1 = [
  ["硬约束违约周数占比", f(S.fast.violRate * 100) + "%", f(S.quality.violRate * 100) + "%", S.quality.violRate <= S.fast.violRate],
  ["平均违约条数", f(S.fast.hardMean), f(S.quality.hardMean), S.quality.hardMean <= S.fast.hardMean],
  ["评分均值（越高越好）", f(S.fast.scoreMean), f(S.quality.scoreMean), S.quality.scoreMean >= S.fast.scoreMean],
  ["评分标准差（越低越好）", f(S.fast.scoreSD), f(S.quality.scoreSD),
    sdJudgeable ? S.quality.scoreSD <= S.fast.scoreSD : null],   // 不可复现/小样本时只展示、不判定
  ["  缺口", f(S.fast.gaps), f(S.quality.gaps), S.quality.gaps <= S.fast.gaps],
  ["  上一休一", f(S.fast.iso), f(S.quality.iso), S.quality.iso <= S.fast.iso],
  ["  三连休", f(S.fast.run3), f(S.quality.run3), S.quality.run3 <= S.fast.run3],
  ["  模块无人在岗", f(S.fast.mod), f(S.quality.mod), S.quality.mod <= S.fast.mod],
  ["  分组保障", f(S.fast.grp), f(S.quality.grp), S.quality.grp <= S.fast.grp],
  ["  少上班天数", f(S.fast.short), f(S.quality.short), S.quality.short <= S.fast.short],
  ["早班极差（越低越匀）", f(S.fast.earlyRange), f(S.quality.earlyRange), S.quality.earlyRange <= S.fast.earlyRange],
  ["早班标准差", f(S.fast.earlySD), f(S.quality.earlySD), S.quality.earlySD <= S.fast.earlySD],
  ["晚班极差", f(S.fast.nightRange), f(S.quality.nightRange), S.quality.nightRange <= S.fast.nightRange],
  ["晚班标准差", f(S.fast.nightSD), f(S.quality.nightSD), S.quality.nightSD <= S.fast.nightSD],
  [VCLOCK ? `真实耗时 ms（${TIMING_SEEDS} 颗种子）` : "单周耗时 ms",
    f(timing.fast, 0), f(timing.quality, 0), null]
];
for (const r of rows1) {
  console.log(String(r[0]).padEnd(24) + String(r[1]).padStart(14) + String(r[2]).padStart(14)
    + (r[3] === null ? "" : r[3] ? "   OK" : "   ×"));
}
/* 主判据：逐种子成绩单（同一字典序）不得退化 */
const gSingle = gradeRegress(single.fast, single.quality);
console.log("\n=== 逐种子成绩单（同一颗种子 · 同一字典序：缺口→请假违约→硬约束→少上班→评分）===");
console.log(`quality 更优 ${gSingle.better} / 完全一致 ${gSingle.tie} / 更差 ${gSingle.worse}    （共 ${gSingle.n} 颗种子）` +
  (gSingle.worse === 0 ? "   OK" : "   ×"));

let batchOK = true;
let B = null;   // 跨周汇总（WEEKS < 2 时为 null）
if (WEEKS >= 2) {
  B = { fast: summarizeBatch(batch.fast), quality: summarizeBatch(batch.quality) };
  console.log(`\n=== 跨周跑分（每周批量排 ${WEEKS} 周 · ${RUNS} 颗种子）===`);
  console.log("指标".padEnd(24) + "fast".padStart(14) + "quality".padStart(14) + "  quality 更好？");
  const rows2 = [
    ["平均违约条数（逐周累计）", f(B.fast.hardMean), f(B.quality.hardMean), B.quality.hardMean <= B.fast.hardMean],
    ["违约周占比", f(B.fast.violRate * 100) + "%", f(B.quality.violRate * 100) + "%", B.quality.violRate <= B.fast.violRate],
    ["周均评分", f(B.fast.scoreMean), f(B.quality.scoreMean), B.quality.scoreMean >= B.fast.scoreMean],
    ["周间评分标准差", f(B.fast.scoreSD), f(B.quality.scoreSD), B.quality.scoreSD <= B.fast.scoreSD],
    ["跨周晚班方差（越低越公平）", f(B.fast.cwNight), f(B.quality.cwNight), B.quality.cwNight <= B.fast.cwNight],
    ["跨周早班方差", f(B.fast.cwEarly), f(B.quality.cwEarly), B.quality.cwEarly <= B.fast.cwEarly],
    ["总耗时 ms", f(B.fast.ms, 0), f(B.quality.ms, 0), null]
  ];
  for (const r of rows2) {
    console.log(String(r[0]).padEnd(24) + String(r[1]).padStart(14) + String(r[2]).padStart(14)
      + (r[3] === null ? "" : r[3] ? "   OK" : "   ×"));
  }
  batchOK = B.quality.hardMean <= B.fast.hardMean;
}

/* 逐种子成绩单对比已在上面主表后打印（gSingle） */
const gBatch = WEEKS >= 2 ? gradeRegress(batch.fast, batch.quality) : null;
const condViol = S.quality.violRate <= S.fast.violRate;
const condHard = S.quality.hardMean <= S.fast.hardMean;
const condGrade = gSingle.worse === 0;
const condMean = S.quality.scoreMean >= S.fast.scoreMean;
const condSD = S.quality.scoreSD <= S.fast.scoreSD;
/* 跨周只在**汇总**上判（违约条数、违约周占比不升）。
   逐种子成绩单这里不能当判据：第一周之后两档消耗的随机数不同、轨迹分叉，
   第 N 周的输入本来就不一样，逐位比较没有「同一问题两个答案」的前提。
   （单周可以逐位比，因为两档从同一颗种子、同一份输入出发。） */
const condBatch = !B || (B.quality.hardMean <= B.fast.hardMean && B.quality.violRate <= B.fast.violRate);
const pass = condViol && condHard && condGrade && condMean && (!sdJudgeable || condSD) && condBatch;

console.log("\n验收（算法文档 §8 一期）：违约率不升 + 评分标准差下降");
console.log(`   违约率 ${f(S.fast.violRate * 100)}% → ${f(S.quality.violRate * 100)}% (${condViol ? "OK" : "×"})   ` +
  `平均违约 ${f(S.fast.hardMean)} → ${f(S.quality.hardMean)} (${condHard ? "OK" : "×"})`);
console.log(`   逐种子成绩单更差 ${gSingle.worse} 颗 (${condGrade ? "OK" : "×"})   ` +
  `评分均值 ${f(S.fast.scoreMean)} → ${f(S.quality.scoreMean)} (${condMean ? "OK" : "×"})`);
console.log(`   评分标准差 ${f(S.fast.scoreSD)} → ${f(S.quality.scoreSD)} → ` +
  (sdJudgeable
    ? (condSD ? "OK（硬条件）" : "×（硬条件）")
    : (!VCLOCK ? "仅供参照（真实时钟不可复现，判它请加 --clock virtual）"
               : `仅供参照（RUNS=${RUNS} < 30，样本不足、不作判定）`)));
if (gBatch) {
  console.log(`   跨周：违约 ${f(B.fast.hardMean)} → ${f(B.quality.hardMean)} 条、` +
    `违约周 ${f(B.fast.violRate * 100)}% → ${f(B.quality.violRate * 100)}% (${condBatch ? "OK" : "×"})` +
    `   ［逐种子更优 ${gBatch.better}/更差 ${gBatch.worse}，仅参照：第 2 周起轨迹分叉］`);
}
console.log(pass ? "✅ 达标" : "❌ 未达标（看上面标 × 的行）");
process.exit(pass ? 0 : 1);
