/* 用可复现内核定位「班次人数≥需求」这类残留缺口：到底是真的没人能补，还是算法漏了。
   对每个缺班的日子，逐个检查：有没有人当天其实是空闲 / 休息可挪 / 可以换班过来。 */
const {loadApp, resetConfig, auditOnce} = require("./audit_core.js");
const ROUNDS = +(process.argv[2] || 60), NREQ = +(process.argv[3] || 4), SEED0 = +(process.argv[4] || 300);
const FILE = process.argv[5] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const TYPES = ["off","off","off","work","early","mid","night","noearly","nomid","nonight"];
const SH = ["early","mid","night"], SHCN = {early:"早", mid:"中", night:"晚"};

function genReqs(S, seed){
  let a = seed * 2654435761 % 2147483647;
  const rnd = n => { a = (a * 48271) % 2147483647; return a % n; };
  const used = {}, out = []; let id = 1;
  while(out.length < NREQ){
    const nm = S.staff[rnd(S.staff.length)], d = rnd(7), key = nm + "|" + d;
    if(used[key]) continue;
    used[key] = 1;
    out.push({id:id++, name:nm, day:d, type:TYPES[rnd(TYPES.length)], scope:"once", weekKey:S.__k});
  }
  return out;
}
let withGap = 0, fixable = 0, blocked = 0;
const kind = {free:0, rest:0, swap:0, neutral:0, trulyFree:0};
const why = {};
console.log("══════ 残留「缺班」可补性分析（"+ROUNDS+" 轮 × "+NREQ+" 条）══════\n");
for(let i=0;i<ROUNDS;i++){
  const seed = SEED0 + i;
  const probe = loadApp(FILE, seed, {noDeadline:true});
  resetConfig(probe.S, probe.T);
  const reqs = genReqs(probe.S, seed);
  const {T, S} = loadApp(FILE, seed, {noDeadline:true});
  resetConfig(S, T, []);
  const k = T.curKey();
  T.autoSchedule(); T.assignRoles(k);
  S.requests = reqs.map(r=>Object.assign({}, r, {weekKey:k}));
  T.repatchWeek(true);
  const w = T.ensureWeek(k), R = T.buildRules(k);
  let any = false;
  for(let d=0; d<7; d++) SH.forEach(sh=>{
    const need = +S.needs[d][sh]||0;
    const have = S.staff.filter(n=>w[n][d]===sh).length;
    if(have >= need) return;
    any = true;
    // 谁能补？逐个试，看是否「存在合法的单格填入」
    let cands = 0, freeC = 0, restC = 0, swapC = 0, reasons = new Set();
    for(const n of S.staff){
      const v = w[n][d]||"";
      if(v === sh) continue;
      const c = R[n][d] || {};
      if(c.off) { reasons.add("该人当天请假"); continue; }
      if(c.only && c.only !== sh) { reasons.add("该人当天固定别的班"); continue; }
      if(c.ban && c.ban[sh]) { reasons.add("该人禁排此班"); continue; }
      if(sh==="early" && w[n][(d+6)%7]==="night"){ reasons.add("前一天晚班不能接早"); continue; }
      if(sh==="night" && w[n][(d+1)%7]==="early"){ reasons.add("次日早班不能排晚"); continue; }
      // 班次周上限
      const cnt = [0,1,2,3,4,5,6].filter(x=>w[n][x]===sh).length;
      if((S.limits[sh]||99) < 99 && cnt >= S.limits[sh]) { reasons.add("该人本周此班次已满 "+S.limits[sh]+" 次"); continue; }
      cands++;
      if(v === "") freeC++;                 // 空格 → 动作③能直接填
      else if(v === "rest") restC++;      // 休息日 → 动作③**故意不碰**（保每人休 N 天）
      else swapC++;                        // 上着别的班 → 动作③可以换过来
    }
    // 「能补」还要看补了会不会拆东墙补西墙。评分口径（与体检面板一致）：
    //   · 空格 / 休息日都计入「休息天数」，动它就要付「偏离每人休 N 天」的代价；
    //   · 把上着别的班的人换过来，要看他让出来的那个班次当天有没有富余。
    const exact = (sh === "early" && d < 5 && (S.exactShifts||[]).includes("early"));
    let netFree = false;
    if(freeC > 0 || restC > 0){
      // 动休息日：补班的收益 10 分，破「每人恰好休 N 天」罚 30 分 → 净亏，算法刻意不动
      kind.rest++;
    }
    if(swapC > 0){
      // 换班：只有当他让出的班次当天有富余、且该班次不受「精确人数」约束时才算白赚
      let surplusSwap = 0;
      for(const n of S.staff){
        const v = w[n][d]||"";
        if(!v || v === "rest" || v === sh) continue;
        const c = R[n][d] || {};
        if(c.off || (c.only && c.only !== sh) || (c.ban && c.ban[sh])) continue;
        if(sh==="early" && w[n][(d+6)%7]==="night") continue;
        if(sh==="night" && w[n][(d+1)%7]==="early") continue;
        const cnt = [0,1,2,3,4,5,6].filter(x=>w[n][x]===sh).length;
        if((S.limits[sh]||99) < 99 && cnt >= S.limits[sh]) continue;
        const isExact = (v === "early" && d < 5 && (S.exactShifts||[]).includes("early"));
        const haveV = S.staff.filter(x=>w[x][d]===v).length;
        if(!isExact && haveV > (+S.needs[d][v]||0)) surplusSwap++;
      }
      if(surplusSwap > 0){ kind.swap++; netFree = true; }
      else kind.neutral++;
    }
    if(cands === 0){ blocked++; [...reasons].forEach(r=> why[r]=(why[r]||0)+1); }
    else { fixable++; if(netFree) kind.trulyFree++; }
  });
  if(any) withGap++;
}
console.log(`  出现缺班的轮次：${withGap} / ${ROUNDS}`);
console.log(`  其中「明明有人能补」：${fixable} 处　← 算法漏了，可改进`);
  console.log(`  其中「确实谁都补不了」：${blocked} 处　← 输入层就卡死，不是算法问题`);
  console.log("\n  缺口性质细分（决定值不值得为它改算法）：");
  console.log(`    · 只能动休息日/空格：${kind.rest} 处　→ 补了就破「每人恰好休 N 天」，罚 30 > 收益 10，**规则本身二选一**`);
  console.log(`    · 可以换班且让出的班次有富余：${kind.swap} 处　→ 白赚，属于真漏`);
  console.log(`    · 可以换班但会让出新的缺口：${kind.neutral} 处　→ 拆东墙补西墙，净收益为零，动它没意义`);
  console.log(`  ⇒ 真正「白赚却没拿到」的：${kind.trulyFree} 处 / ${ROUNDS} 轮`);
if(Object.keys(why).length){
  console.log("\n  补不了的原因分布：");
  Object.entries(why).sort((a,b)=>b[1]-a[1]).forEach(([r,c])=>console.log(`    · ${r}：${c} 次`));
}
