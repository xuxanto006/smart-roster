/* 追问：残留的「上一休一」为什么配对修复没修掉 —— 把每一手候选被哪一道闸挡下来列出来。
   用法：node probe_iso_block.js [文件] [seed起] [seed止] [EARLY] [NIGHT]
   思路：先用 autoSchedule 得到班表，若仍有人「上一休一」，就在这张表上穷举
   「A 的休息日 a ↔ B 的休息日 b」的对调，逐条记录被哪一项拒绝，统计各类原因。 */
const {loadApp, resetConfig} = require("./audit_core.js");
const FILE  = process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const S0    = +(process.argv[3] || 1);
const S1    = +(process.argv[4] || 400);
const EARLY = +(process.argv[5] || 8);
const NIGHT = +(process.argv[6] || 3);
const D  = ["一","二","三","四","五","六","日"];
const SH = {early:"早", mid:"中", night:"晚", rest:"休", "":"·"};

const reasons = {};
const bump = r => reasons[r] = (reasons[r]||0)+1;
let found = 0;

for(let seed = S0; seed <= S1; seed++){
  const {T, S} = loadApp(FILE, seed);
  resetConfig(S, T);
  S.limits = {early:3, night:NIGHT, mid:99};
  [0,1,2,3,4].forEach(d=>S.needs[d].early = EARLY);
  T.autoSchedule();
  const k = T.curKey(), w = T.ensureWeek(k), R = T.buildRules(k);
  const staff = S.staff;
  const iso = n => T.isolatedRestCount(T.restSetOfWeek(w, n));
  const bad = staff.filter(n=> iso(n) > 0);
  if(!bad.length) continue;
  found++;
  if(found > 6) continue;

  console.log(`\n════ seed ${seed}：残留 ${bad.length} 人 ════`);
  bad.forEach(n=>{
    const s = [...T.restSetOfWeek(w, n)].sort();
    console.log(`  ${n} 休 ${s.join(",")}  ${w[n].map(v=>SH[v]||"?").join(" ")}`);
  });

  // 穷举配对，记录拒绝原因
  const at = (n,d)=> (w[n] && w[n][d]) || "";
  const isRest = (n,d)=>{ const v = at(n,d); return v === "" || v === "rest"; };
  const LIM = S.limits;
  for(const A of bad){
    let anyOK = false;
    for(let a=0; a<7; a++){
      if(!isRest(A,a)) continue;
      for(let b=0; b<7; b++){
        if(b===a || isRest(A,b)) continue;
        let hadB = false;
        for(const B of staff){
          if(B===A || !isRest(B,b) || !at(B,a)) continue;
          hadB = true;
          // 逐项复刻应用里的判定，看卡在哪
          const sA = at(A,b), sB = at(B,a);
          const cnt = (n, d1, sh1, d2, sh2)=>{
            const g = d => (d===d1)?sh1:(d===d2)?sh2:at(n,d);
            const c = {early:0,mid:0,night:0};
            for(let d=0; d<7; d++){ const v = g(d); if(c[v]!==undefined) c[v]++; }
            return {c, g};
          };
          const chk = (n, d1, sh1, d2, sh2)=>{
            const {c, g} = cnt(n, d1, sh1, d2, sh2);
            if(c.early > (LIM.early||99)) return "早班上超";
            if(c.night > (LIM.night||99)) return "晚班上超";
            for(let d=0; d<6; d++) if(g(d)==="night" && g(d+1)==="early") return "晚接早";
            for(let d=0; d<7; d++) if(g(d)==="early"&&g((d+1)%7)==="early"&&g((d+2)%7)==="early") return "三连早";
            if(g(5)==="early" && g(6)==="early") return "周末连早";
            return null;
          };
          const rA = chk(A, a, sB, b, at(B,b));
          const rB = chk(B, a, at(A,a), b, sA);
          if(rA || rB){ bump("个人规则：" + (rA||rB)); continue; }
          // 试做：对调两人第 a 天 / 第 b 天的格子
          const vAa=at(A,a), vAb=at(A,b), vBa=at(B,a), vBb=at(B,b);
          const nowISO = staff.reduce((s,n)=> s + iso(n), 0);
          w[A][a]=vBa; w[B][a]=vAa; w[A][b]=vBb; w[B][b]=vAb;
          const afterISO = staff.reduce((s,n)=> s + iso(n), 0);
          w[A][a]=vAa; w[B][a]=vBa; w[A][b]=vAb; w[B][b]=vBb;
          if(afterISO >= nowISO){ bump("孤立数没降"); continue; }
          const rs0 = T.weekRoleShort(w);
          w[A][a]=vBa; w[B][a]=vAa; w[A][b]=vBb; w[B][b]=vAb;
          const rs1 = T.weekRoleShort(w);
          w[A][a]=vAa; w[B][a]=vBa; w[A][b]=vAb; w[B][b]=vBb;
          if(rs1 > rs0){ bump("开闭名额变难分"); continue; }
          anyOK = true;
          console.log(`    ✅ 存在可行对调：A=${A} 第${a+1}天 ↔ B=${B} 第${b+1}天的休息日（修复却没做？）`);
        }
        if(!hadB) bump("没有可换的对象 B");
      }
    }
    if(!anyOK) console.log(`    ⚠ ${A}：没有任何可行对调`);
  }
}
console.log(`\nseed ${S0}~${S1}（EARLY=${EARLY}）残留样本 ${found} 个`);
console.log("拒绝原因统计：");
Object.entries(reasons).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=> console.log(`  ${String(v).padStart(5)}  ${k}`));
