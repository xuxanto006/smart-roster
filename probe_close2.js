/* 细分「开店闭店填不满」的两种成因：
   (i) 某天该组上对应班次的人就不够（可用性不足）→ 体检面板现有检查能抓到
   (ii) 人够，但「每人每周 ≤3 次」的额度不够分（额度不足）→ 体检面板抓不到，因为
        它只数「当天该组有几个人上这个班次」，不看这些人的额度还剩多少
   判据：把 maxPer 设成 3 和设成 99 各算一次最大流。
        cap=99 也流不满 → 可用性问题；cap=99 能流满但 cap=3 不能 → 额度问题。
   同时直接调用 renderHealth，看面板到底报没报出来。 */
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
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,buildRules,groupMembers,assignRoles,renderHealth,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

function maxFlow(n, edges, s, t){
  const g=Array.from({length:n},()=>[]);
  function add(u,v,c){ g[u].push({to:v,cap:c,rev:g[v].length}); g[v].push({to:u,cap:0,rev:g[u].length-1}); }
  edges.forEach(e=>add(e[0],e[1],e[2]));
  let flow=0;
  for(;;){
    const lv=Array(n).fill(-1); lv[s]=0; const q=[s];
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
function feasibleSlots(w, oc, openN, closeN, maxPer){
  const need = 7*(openN+closeN);
  if(!need) return need;
  const SRC=0, SNK=1, base=2, dayNode=[];
  for(let d=0; d<7; d++) dayNode.push({open:base+d*2, close:base+d*2+1});
  let idx=base+14; const perNode={};
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

const ROUNDS=+(process.argv[2]||600);
const rnd=n=>Math.floor(Math.random()*n);
function reset(){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups = {
    earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    // maxPerWeek 可下调：额度一紧缺口就变成必然事件，用来确定性地验证体检面板报不报
    openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"], open:1, close:2, maxPerWeek:MAXPER}
  };
}
const MAXPER = +(process.argv[3]||3);

let availOnly=0, capOnly=0, missed=0, reported=0;
const samples=[];
for(let r=0;r<ROUNDS;r++){
  reset();
  // 定向施压：请假 80% 落在开店闭店组成员身上，否则缺口太罕见（~0.3%）根本抓不到
  const OC=["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"];
  const cnt=2+rnd(3), used={}; let id=1;
  while(S.requests.length<cnt){
    const n = Math.random()<0.8 ? OC[rnd(OC.length)] : S.staff[rnd(S.staff.length)];
    const d=rnd(7), key=n+"|"+d;
    if(used[key]) continue; used[key]=1;
    S.requests.push({id:id++,name:n,day:d,type:"off",scope:"once",weekKey:T.curKey()});
  }
  T.autoSchedule();
  const k=T.curKey(), w=T.ensureWeek(k);
  const res=T.assignRoles(k);
  if(!res.short) continue;

  const oc=T.groupMembers("openClose");
  const f3  = feasibleSlots(w, oc, 1, 2, MAXPER);   // 用真实额度，别写死 3
  const fInf= feasibleSlots(w, oc, 1, 2, 99);
  const kind = fInf < 21 ? "可用性不足" : "额度不足(≤3次)";
  if(fInf < 21) availOnly++; else capOnly++;

  // 体检面板到底报没报
  T.renderHealth(w, T.buildRules(k));
  const box=(els["healthBox"]||{}).innerHTML||"";
  const hitPanel = /开店缺|闭店缺/.test(box);
  if(hitPanel) reported++; else { missed++; if(samples.length<6) samples.push(`【面板漏报】第${r+1}轮 ${kind}｜面板摘要：${box.replace(/<[^>]+>/g," ").slice(0,120)}`); }
  if(samples.length<6) samples.push(`第${r+1}轮 ${kind}｜额度≤${MAXPER}可填${f3}/21，无上限可填${fInf}/21｜面板${hitPanel?"已报":"未报"}`);
}
console.log("══════ 开店闭店填不满 · 成因细分（"+ROUNDS+" 轮带请假）══════");
console.log("  可用性不足（某天该组上班次的人就不够）：" + availOnly);
console.log("  额度不足（人够，但每人 ≤3 次分不过来）：" + capOnly);
console.log("  体检面板已报出来：" + reported);
console.log("  体检面板漏报：    " + missed + (missed? "  ❌" : "  ✅"));
console.log("");
samples.forEach(s=>console.log("  " + s));
