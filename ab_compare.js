/* 配对 A/B 对照：同一 seed、同一组请假条，分别喂给两个版本的 index.html，
   比较微调后的违规数。因为是配对比较，信噪比比「各跑 60 轮再比」高一个量级。
   用法：node ab_compare.js <轮数> <请假条数> <起始seed> <A版本> <B版本>
   自检：A 和 B 传同一个文件，结果必须完全一致（否则说明随机源没接管干净）。 */
const {loadApp, resetConfig, auditOnce, ORDER} = require("./audit_core.js");
const ROUNDS = +(process.argv[2] || 40);
const NREQ   = +(process.argv[3] || 3);
const SEED0  = +(process.argv[4] || 1);
const FILE_A = process.argv[5];
const FILE_B = process.argv[6];
if(!FILE_A || !FILE_B){
  console.log("用法：node ab_compare.js <轮数> <请假条数> <起始seed> <A版本> <B版本>");
  process.exit(1);
}
const TYPES = ["off","off","off","work","early","mid","night","noearly","nomid","nonight"];

/* 用「与被测版本无关」的独立随机源生成请假条，保证 A/B 拿到一模一样的输入 */
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

const NO_DEADLINE = process.argv.includes("--nd");   // 加 --nd：把 700ms 预算换成无限，比较「收敛质量」
function runOne(file, seed, reqs){
  const {T, S} = loadApp(file, seed, {noDeadline:NO_DEADLINE});
  resetConfig(S, T);
  const k = T.curKey();
  S.__k = k;
  const rs = reqs.map(r => Object.assign({}, r, {weekKey:k}));
  // 先排一张干净的，再加请假条走微调 —— 与 audit_repatch 的 A 路径一致
  resetConfig(S, T, []);
  T.autoSchedule(); T.assignRoles(k);
  S.requests = rs;
  T.repatchWeek(true);
  return auditOnce(T, S);
}

console.log("══════ 配对 A/B（"+ROUNDS+" 轮 × "+NREQ+" 条，seed "+SEED0+"起）══════");
console.log("  A = " + FILE_A);
console.log("  B = " + FILE_B + "\n");

const totals = {}; ORDER.forEach(r => totals[r] = {A:0, B:0});
let winA=0, winB=0, tie=0, sumA=0, sumB=0;
for(let i=0; i<ROUNDS; i++){
  const seed = SEED0 + i;
  // 请假条只依赖 seed 与「标准 31 人」，两个版本完全相同
  const probe = loadApp(FILE_A, seed, {noDeadline:NO_DEADLINE});
  resetConfig(probe.S, probe.T);
  const reqs = genReqs(probe.S, seed);
  const a = runOne(FILE_A, seed, reqs);
  const b = runOne(FILE_B, seed, reqs);
  sumA += a.n; sumB += b.n;
  if(a.n < b.n) winA++; else if(b.n < a.n) winB++; else tie++;
  ORDER.forEach(r => { totals[r].A += (a.byRule[r]||0); totals[r].B += (b.byRule[r]||0); });
  if(i < 3) console.log(`  seed ${seed}: A=${a.n}  B=${b.n}${a.n===b.n?"（同）":""}`);
}
console.log("\n规则".padEnd(28) + "A".padStart(7) + "B".padStart(7) + "   差");
console.log("─".repeat(52));
ORDER.forEach(r=>{
  const A = totals[r].A, B = totals[r].B;
  if(!A && !B) return;
  const mark = A<B ? "A好" : (B<A ? "B好" : "持平");
  console.log(`  ${r.padEnd(26)}` + String(A).padStart(6) + String(B).padStart(7) + "   " + mark);
});
console.log("─".repeat(52));
console.log("  合计违规".padEnd(28) + String(sumA).padStart(6) + String(sumB).padStart(7));
console.log(`\n  逐轮胜负：A 更好的轮次 ${winA} ｜ B 更好 ${winB} ｜ 打平 ${tie}`);
const verdict = winA>winB ? "A 更好" : (winB>winA ? "B 更好" : "无差异");
console.log(`  结论（配对符号检验）：${verdict}`);
if(FILE_A === FILE_B && (winA || winB)){
  console.log("\n  ⚠️ A 与 B 是同一份文件却有差异 —— 说明随机源 / 时钟还没接管干净，本工具不可信！");
}
