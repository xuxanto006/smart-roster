/* 基线诊断：三条新规则的现状违规量
   1) 每周休 3 天时的连休分布（应无 3 连）
   2) 专家老师组每天是否有 1 早 + 1 晚
   3) 各模块是否出现「全员休息」 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync(process.env.APP_FILE||"/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},dataset:{},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){},querySelectorAll(){return[]},querySelector(){return fakeEl("q")},remove(){},insertBefore(){},children:[]};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,groupMembers,getStaffProfile,domainStaff,curDomain,domNeeds,domLimits,domRestMax,restTotalCap,schedulableGroupMembers,isBlockedFromSchedule,exportCSV,renderAll,save,restRange,moduleMinOn,run3RestCount,isolatedRestCount};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,DAY=["周一","周二","周三","周四","周五","周六","周日"];
const DOMS=["3c","hongmeng","aftersales","manager"];

function run(restMin, restPer){
  T.state.restMax={min:restMin,per:restPer,total:0};
  ["restMaxHM","restMaxMgr","restMaxAS"].forEach(f=>{ if(S[f]) S[f]={min:restMin,per:restPer,total:0}; });
  const rep={rest3run:0, enBad:0, modBad:0, details:[], dist:{}};
  DOMS.forEach(dom=>{
    // 切领域并设置该领域的休息配额
    S.domain=dom;
    const rf = {"3c":"restMax","hongmeng":"restMaxHM","aftersales":"restMaxAS","manager":"restMaxMgr"}[dom];
    if(rf && S[rf]) S[rf]={min:restMin,per:restPer,total:0};
    els.restPer && (els.restPer.value=String(restPer));
    T.autoSchedule(dom);
    const k=T.curKey(), week=T.ensureWeek(k);
    const people=T.domainStaff(dom).filter(n=>!T.isBlockedFromSchedule(n));

    // 1) 3 连休
    people.forEach(n=>{
      const r=new Set();
      for(let d=0;d<7;d++) if(week[n][d]==="rest") r.add(d);
      for(let d=0;d<7;d++){
        if(r.has(d)&&r.has((d+1)%7)&&r.has((d+2)%7)){ rep.rest3run++; rep.details.push(`${dom} ${n} 3连休 ${d}`); }
      }
      rep.dist[r.size]=(rep.dist[r.size]||0)+1;
      rep.dist[r.size]=(rep.dist[r.size]||0)+1;
      if(r.size<restMin||r.size>restPer) rep.details.push(`${dom} ${n} 休${r.size}天 (期望${restMin}~${restPer})`);
    });

    // 2) 专家老师组 1早1晚（只在 3c 领域有意义，组员都在 3c）
    if(dom==="3c"){
      const mem=T.schedulableGroupMembers("earlyNight");
      for(let d=0;d<7;d++){
        const e=mem.filter(n=>week[n][d]==="early").length, ni=mem.filter(n=>week[n][d]==="night").length;
        if(e<1||ni<1){ rep.enBad++; rep.details.push(`专家 ${DAY[d]} 早${e} 晚${ni}`); }
      }
    }

    // 3) 模块不得全员休息
    const byMod={};
    people.forEach(n=>{ const m=T.getStaffProfile(n).module; (byMod[m]=byMod[m]||[]).push(n); });
    Object.keys(byMod).forEach(m=>{
      if(byMod[m].length<2) return;
      for(let d=0;d<7;d++){
        const on=byMod[m].filter(n=>week[n][d]==="early"||week[n][d]==="mid"||week[n][d]==="night").length;
        if(on===0){ rep.modBad++; rep.details.push(`${dom}/${m} ${DAY[d]} 全员休息 (${byMod[m].length}人)`); }
      }
    });
  });
  return rep;
}

[[2,2],[2,3],[1,2],[1,3]].forEach(([rmn,rp])=>{
  const t0=Date.now();
  const rep=run(rmn,rp);
  console.log(`\n===== 每人每周休 ${rmn===rp?rp:rmn+"~"+rp} 天（耗时 ${((Date.now()-t0)/1000).toFixed(1)}s）=====
  3 连休次数：${rep.rest3run}
  休息天数分布：${JSON.stringify(rep.dist)}
  专家组缺 早/晚 天数：${rep.enBad}
  模块全员休息 天数：${rep.modBad}
  样例：`);
  rep.details.slice(0,14).forEach(x=>console.log("    - "+x));
});