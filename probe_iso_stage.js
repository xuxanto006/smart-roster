/* 分阶段定位「上一休一」：把 index.html 打补丁，在自动排班的每个流水线阶段后记一次
   孤立休息日总数，再喂给 audit_core 的可播种随机源跑 seed。
   这样能直接看出是「方案本身就带」「absorbSurplus 补班带出来的」还是「收尾修复带出来的」。
   用法：node probe_iso_stage.js [engine文件] [seed起] [seed止] [EARLY] [NIGHT]
   默认 engine = /tmp/iso_stage_engine.html（由本脚本生成） */
const fs = require("fs");
const SRC = "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const ENG = process.argv[2] || "/tmp/iso_stage_engine.html";

let html = fs.readFileSync(SRC, "utf8");
const HOOK = `globalThis.__isoTrace = [];
globalThis.__isoLog = function(tag, w){
  let n = 0;
  state.staff.forEach(function(x){
    const s = new Set();
    for(let d=0; d<7; d++){ const v = (w[x] && w[x][d]) || ""; if(v === "rest" || v === "") s.add(d); }
    n += isolatedRestCount(s);
  });
  globalThis.__isoTrace.push(tag + "=" + n);
};
`;
html = html.replace("<script>", "<script>\n" + HOOK);

const marks = [
  ["  // 早班再均衡：把上了 3 天早班的人匀一天给只上了 1 天的人", "  globalThis.__isoLog('①方案写表', w);\n"],
  ["  // 保险：对贪心残留的缺口再做一次局部补位", "  globalThis.__isoLog('②balance1', w);\n"],
  ["  // 补满勤：把没排掉的富余人力吸收进中班 / 晚班", "  globalThis.__isoLog('③fillGaps', w);\n"],
  ["  // 富余人力填好后，班次总数才是最终状态", "  globalThis.__isoLog('④absorbSurplus', w);\n"],
  ["  // 收尾：富余人力吸收之后仍残留的「上一休一」", "  globalThis.__isoLog('⑤balance2', w);\n"],
  ["  state.schedule[k] = w;", "  globalThis.__isoLog('⑥fixIso', w);\n"]
];
marks.forEach(([anchor, ins])=>{
  if(!html.includes(anchor)) throw new Error("锚点没找到：" + anchor);
  html = html.replace(anchor, ins + anchor);
});
fs.writeFileSync(ENG, html);
console.log("补丁引擎已生成：" + ENG + "\n");

const {loadApp, resetConfig, auditOnce} = require("./audit_core.js");
const S0    = +(process.argv[3] || 1);
const S1    = +(process.argv[4] || 40);
const EARLY = +(process.argv[5] || 8);
const NIGHT = +(process.argv[6] || 3);
const D  = ["一","二","三","四","五","六","日"];
const SH = {early:"早", mid:"中", night:"晚", rest:"休", "":"·"};

let bad = 0;
for(let seed = S0; seed <= S1; seed++){
  const app = loadApp(ENG, seed);
  const {T, S} = app;
  resetConfig(S, T);
  S.limits = {early:3, night:NIGHT, mid:99};
  T.autoSchedule();
  const k = T.curKey(), w = T.ensureWeek(k);
  const trace = app.sandbox.__isoTrace || [];
  const final = trace.length ? +trace[trace.length-1].split("=")[1] : -1;
  if(final <= 0) continue;
  bad++;
  console.log(`\n════ seed ${seed}：最终孤立休息日 ${final} ════`);
  console.log("  流水线：" + trace.join("  →  "));
  S.staff.forEach(n=>{
    const s = new Set(); [0,1,2,3,4,5,6].forEach(d=>{ if(w[n][d]==="rest"||!w[n][d]) s.add(d); });
    if(T.isolatedRestCount(s) === 0) return;
    console.log(`  ⚠ ${n} 休 ${[...s].sort().join(",")}  ${w[n].map(v=>SH[v]||"?").join(" ")}`);
  });
}
console.log(`\nseed ${S0}~${S1}（EARLY=${EARLY} NIGHT=${NIGHT}）共 ${bad} 个残留`);
