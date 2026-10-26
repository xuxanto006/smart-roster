/* 定案：「每天 1 开店 + 2 闭店」偶发填不满，到底是
      (a) assignRoles 的贪心不够聪明（实现问题，可修）
   还是 (b) 那天的班次组合本身就凑不出（输入冲突，该列举不该硬修）
   判据：把「每天 1 个开店名额（该组当天早班者）+ 2 个闭店名额（该组当天晚班者）、
        每人每周合计 ≤3 次」建成最大流，看最大流是否等于 21（7×1 + 7×2）。
        能流满却没填满 → assignRoles 的锅；流不满 → 本身就凑不出。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,groupMembers,assignRoles,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

/* ---------- 最大流（Dinic）---------- */
function maxFlow(n, edges, s, t){
  const g=Array.from({length:n},()=>[]);
  function add(u,v,c){ g[u].push({to:v,cap:c,rev:g[v].length}); g[v].push({to:u,cap:0,rev:g[u].length-1}); }
  edges.forEach(e=>add(e[0],e[1],e[2]));
  let flow=0;
  for(;;){
    const lv=Array(n).fill(-1); lv[s]=0;
    const q=[s];
    while(q.length){ const u=q.shift(); g[u].forEach(e=>{ if(e.cap>0&&lv[e.to]<0){ lv[e.to]=lv[u]+1; q.push(e.to);} }); }
    if(lv[t]<0) break;
    const it=Array(n).fill(0);
    const dfs=(u,f)=>{
      if(u===t) return f;
      for(; it[u]<g[u].length; it[u]++){
        const e=g[u][it[u]];
        if(e.cap>0 && lv[e.to]===lv[u]+1){
          const d=dfs(e.to, Math.min(f,e.cap));
          if(d>0){ e.cap-=d; g[e.to][e.rev].cap+=d; return d; }
        }
      }
      return 0;
    };
    for(;;){ const f=dfs(s,1e9); if(!f) break; flow+=f; }
  }
  return flow;
}
/* 该周「开店 1 + 闭店 2、每人 ≤3 次」最多能填多少个名额（满值 21） */
function feasibleSlots(w, oc, openN, closeN, maxPer){
  const need = 7*(openN+closeN);
  if(!need) return need;
  const SRC=0, SNK=1, base=2;
  const dayNode=[], perNode={};
  for(let d=0; d<7; d++){
    dayNode.push({open:base+d*2, close:base+d*2+1});
  }
  let idx = base+14;
  oc.forEach(n=>{ perNode[n]=idx++; });
  const edges=[];
  for(let d=0; d<7; d++){
    edges.push([SRC, dayNode[d].open, openN]);
    edges.push([SRC, dayNode[d].close, closeN]);
    oc.forEach(n=>{
      if(w[n][d]==="early") edges.push([dayNode[d].open,  perNode[n], 1]);
      if(w[n][d]==="night") edges.push([dayNode[d].close, perNode[n], 1]);
    });
  }
  oc.forEach(n=> edges.push([perNode[n], SNK, maxPer]));
  return maxFlow(idx, edges, SRC, SNK);
}

const ROUNDS=+(process.argv[2]||400);
const rnd=n=>Math.floor(Math.random()*n);
function reset(){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups = {
    earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"], open:1, close:2, maxPerWeek:3}
  };
}

let rounds=0, shortRounds=0, algoFault=0, impossible=0;
const samples=[];
for(let r=0;r<ROUNDS;r++){
  reset();
  const cnt=2+rnd(2), used={}; let id=1;
  while(S.requests.length<cnt){
    const n=S.staff[rnd(S.staff.length)], d=rnd(7), key=n+"|"+d;
    if(used[key]) continue; used[key]=1;
    S.requests.push({id:id++,name:n,day:d,type:"off",scope:"once",weekKey:T.curKey()});
  }
  T.autoSchedule();
  const k=T.curKey(), w=T.ensureWeek(k);
  const res=T.assignRoles(k);
  rounds++;
  if(!res.short) continue;
  shortRounds++;
  const oc=T.groupMembers("openClose");
  const cap = feasibleSlots(w, oc, 1, 2, 3);
  const filled = 21 - res.short;
  if(cap > filled){
    algoFault++;
    if(samples.length<8) samples.push(`【算法问题】第${r+1}轮：最多可填 ${cap}/21，实际只填了 ${filled}（少 ${cap-filled} 个）`);
  }else{
    impossible++;
    if(samples.length<8) samples.push(`【凑不出】第${r+1}轮：最多只能填 ${cap}/21（缺 ${21-cap} 个）`);
  }
}
console.log("══════ 开店闭店填不满 · 成因定案（"+ROUNDS+" 轮带请假）══════");
console.log("  出现填不满的轮次：" + shortRounds + " / " + rounds +
            "  (" + (shortRounds/rounds*100).toFixed(2) + "%)");
console.log("  其中 算法问题（本可填满却没填满）：" + algoFault + (algoFault? "  ❌" : "  ✅"));
console.log("  其中 本身就凑不出（输入冲突）：  " + impossible);
console.log("");
samples.forEach(s=>console.log("  " + s));
