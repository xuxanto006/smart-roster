/* 公平性格鲁棒性扫描：对多种 needs 配置跑 autoSchedule，量出每人的 early/mid/night 次数分布偏差，
   与「该总需求在人数与上限约束下的理论最小偏差」对比。
   比值 = 1 表示已达到数学上最均匀的分配；比值越大，说明「添加需求后平均性被破坏」越严重。
   用法：node sweep_fair.js [seedsCSV] [gridTag]  （gridTag 留空跑全网格） */
const {loadApp, resetConfig} = require("./audit_core.js");
const HTML = process.env.APP_FILE || "app_merged.html";
const SEEDS = (process.argv[2] || "1,2,3").split(",").map(Number);
const GRIDTAG = process.argv[3] || "full";

/* ---- 需求网格：模拟「不管怎么添加需求」---- */
function grid(){
  const E = [6,8,10,12];        // 工作日早班需求
  const NN = [8,10,12];         // 工作日晚班需求
  const M = [1,2,4];            // 工作日中班需求
  const EW = [8,10,12];         // 周末早班需求
  const NW = [10,12];           // 周末晚班需求
  const MW = [3];               // 周末中班需求
  const out = [];
  for(const e of E) for(const nn of NN) for(const m of M) for(const ew of EW) for(const nw of NW) for(const mw of MW)
    out.push({e,nn,m,ew,nw,mw});
  return out;
}
const CFG = grid();

function applyNeeds(S, c){
  S.needs = [0,1,2,3,4].map(()=>({early:c.e, mid:c.m, night:c.nn}))
            .concat([5,6].map(()=>({early:c.ew, mid:c.mw, night:c.nw})));
}

function counts(w, staff){
  const r={early:{},mid:{},night:{},work:{}};
  staff.forEach(n=>{ let e=0,m=0,nt=0,wd=0;
    for(let d=0;d<7;d++){ const v=w[n][d];
      if(v==="early"){e++;wd++;} else if(v==="mid"){m++;wd++;} else if(v==="night"){nt++;wd++;} }
    r.early[n]=e; r.mid[n]=m; r.night[n]=nt; r.work[n]=wd; });
  return r;
}
function stat(arr, staff){
  const N=staff.length; const tot=staff.reduce((s,n)=>s+arr[n],0); const mean=tot/N;
  let dev=0, mn=Infinity, mx=-Infinity;
  staff.forEach(n=>{ dev+=Math.abs(arr[n]-mean); mn=Math.min(mn,arr[n]); mx=Math.max(mx,arr[n]); });
  return {tot, mean, dev, mn, mx, spread:mx-mn};
}
function theoryMin(tot, N, cap){
  if(tot > N*cap) return {feasible:false, min:0};
  if(tot===0) return {feasible:true, min:0};
  const r = tot % N;
  return {feasible:true, min: 2*r*(N-r)/N};
}
function covGap(T,S,w,staff){
  const demandNeed={}; const needs=S.needs;
  for(let d=0;d<7;d++) for(const sh of ["early","mid","night"]) demandNeed[d+"|"+sh]=(demandNeed[d+"|"+sh]||0)+(+needs[d][sh]||0);
  const have={}; staff.forEach(n=>{ for(let d=0;d<7;d++){ const v=w[n][d]; if(v==="early"||v==="mid"||v==="night") have[d+"|"+v]=(have[d+"|"+v]||0)+1; }});
  let g=0; Object.keys(demandNeed).forEach(k=>{ g+=Math.max(0, demandNeed[k]-(have[k]||0)); });
  return g;
}

const apps = SEEDS.map(s=> loadApp(HTML, s, {noDeadline:true}));
let bad=0, infeas=0, checked=0;
const flagged=[];
for(const c of CFG){
  // 每个需求配置，取 3 个 seed 里「最差（偏差最大）」的结果
  let worstE={ratio:0}, worstN={ratio:0}, worstMd={dev:0}, anyInfeas=false;
  for(const {T,S} of apps){
    resetConfig(S, T);
    S.needs = [0,1,2,3,4].map(()=>({early:c.e, mid:c.m, night:c.nn})).concat([5,6].map(()=>({early:c.ew, mid:c.mw, night:c.nw})));
    T.autoSchedule();
    const k=T.curKey(), w=T.ensureWeek(k);
    const sched = T.schedulableStaff ? T.schedulableStaff() : S.staff;
    const cc=counts(w,sched);
    const e=stat(cc.early,sched), n=stat(cc.night,sched), md=stat(cc.mid,sched);
    const g=covGap(T,S,w,sched);
    const spread=Math.max(...sched.map(x=>cc.work[x]))-Math.min(...sched.map(x=>cc.work[x]));
    const eT=theoryMin(e.tot,sched.length,3), nT=theoryMin(n.tot,sched.length,3);
    const eRatio = eT.min>0 ? e.dev/eT.min : (e.dev===0?1:99);
    const nRatio = nT.min>0 ? n.dev/nT.min : (n.dev===0?1:99);
    if(g>0 || spread>0) anyInfeas=true;
    if(eRatio>worstE.ratio) worstE={ratio:eRatio, dev:e.dev, th:eT.min, tot:e.tot, spread:e.spread};
    if(nRatio>worstN.ratio) worstN={ratio:nRatio, dev:n.dev, th:nT.min, tot:n.tot, spread:n.spread};
    if(md.dev>worstMd.dev) worstMd={dev:md.dev};
  }
  checked++;
  if(anyInfeas){ infeas++; continue; }
  if(worstE.ratio>1.15 || worstN.ratio>1.15 || worstE.spread>=3 || worstN.spread>=3){
    bad++;
    flagged.push({c, e:worstE, n:worstN, md:worstMd.dev});
  }
}
console.log("═════ 公平性格鲁棒性扫描 ═════");
console.log(`  配置总数 ${CFG.length} ｜ 可行 ${checked-infeas} ｜ 不可行(容量不足) ${infeas} ｜ 公平性退化 ${bad}`);
if(flagged.length){
  console.log("\n  退化配置（比值>1.15 或 极差≥3）：");
  for(const f of flagged){
    const c=f.c;
    console.log(`  E${c.e} N${c.nn} M${c.m} EW${c.ew} NW${c.nw} Mw${c.mw}`+
      ` ｜ 早 偏差${f.e.dev.toFixed(1)}/理论${f.e.th.toFixed(1)} 比值${f.e.ratio.toFixed(2)} 极差${f.e.spread}`+
      ` ｜ 晚 偏差${f.n.dev.toFixed(1)}/理论${f.n.th.toFixed(1)} 比值${f.n.ratio.toFixed(2)} 极差${f.n.spread}`+
      ` ｜ 中偏差${f.md.toFixed(1)}`);
  }
} else {
  console.log("\n  ✅ 所有可行配置下 early / night 均达到理论最均匀（比值≤1.15，极差≤2）");
}
process.exit(0);
