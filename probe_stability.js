/* 三条新规则的稳定性统计（长时间跑，用来看偶发违规率）
   用法：node probe_en3.js [轮数]
   每轮跑 9 种配额配置 × 4 个领域，统计四类违规的累计次数。
   判定标准与 test_new3rules.js 一致（组员配额豁免：硬规则优先于配额目标）。*/
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync(process.env.APP_FILE||"/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){},querySelectorAll(){return[]},querySelector(){return fakeEl("q")},children:[],dataset:{}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,getStaffProfile,domainStaff,isBlockedFromSchedule,schedulableGroupMembers,buildRules,run3RestCount,restRange};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
const DAY=["周一","周二","周三","周四","周五","周六","周日"];
const DOMS=["3c","hongmeng","aftersales","manager"];
const RFIELD={"3c":"restMax","hongmeng":"restMaxHM","aftersales":"restMaxAS","manager":"restMaxMgr"};

function setRest(min,per){ S.restMax={min,per,total:0}; ["restMaxHM","restMaxMgr","restMaxAS"].forEach(f=>{ if(S[f]) S[f]={min,per,total:0}; }); }
function runAll(){
  const out=[];
  DOMS.forEach(dom=>{
    S.domain=dom;
    const rf=RFIELD[dom]; if(rf&&S[rf]) S[rf]=S.restMax;
    T.autoSchedule(dom);
    const k=T.curKey(), week=T.ensureWeek(k);
    out.push({dom,week,people:T.domainStaff(dom).filter(n=>!T.isBlockedFromSchedule(n))});
  });
  return out;
}
function restSet(w,n){ const s=new Set(); for(let d=0;d<7;d++){ const v=(w[n]||[])[d]; if(v==="rest"||v==="") s.add(d); } return s; }

const ROUNDS=parseInt(process.argv[2]||"10",10);
let failEn=0, failR3=0, failMod=0, failRange=0, total=0;
const samples=[];
const CFGS=[[1,2],[2,3],[1,3],[2,2],[2,3],[1,2],[2,3],[1,3],[2,2]];

for(let r=0;r<ROUNDS;r++){
  S.moduleMinOn=1;
  for(const [mn,pr] of CFGS){
    setRest(mn,pr);
    const res=runAll();
    const enMem=T.schedulableGroupMembers("earlyNight");
    res.forEach(({dom,week,people})=>{
      total++;
      people.forEach(n=>{
        // ① 休息区间（组员豁免）
        const k=restSet(week,n).size;
        if((k<mn||k>pr) && !enMem.includes(n)) failRange++;
        // ①B 3连休（请假日钉死的除外）
        const s=restSet(week,n);
        if(s.size){
          const R=T.buildRules(T.curKey());
          let allForced=true; s.forEach(d=>{ const c=R&&R[n]&&R[n][d]; if(!(c&&c.off)) allForced=false; });
          if(!allForced && T.run3RestCount(s)>0){ failR3++; samples.push({t:"r3",dom,n,cfg:`${mn}~${pr}`}); }
        }
      });
      // ② 专家老师组：每天 1 早 + 1 晚
      if(dom==="3c"){
        for(let d=0;d<7;d++){
          const e=enMem.filter(n=>week[n][d]==="early").length;
          const ni=enMem.filter(n=>week[n][d]==="night").length;
          if(e<1||ni<1){ failEn++; samples.push({t:"en",dom,d,e,ni,cfg:`${mn}~${pr}`}); }
        }
      }
      // ③ 模块至少 1 人在岗
      const byMod={};
      people.forEach(x=>{ const m=T.getStaffProfile(x).module; (byMod[m]=byMod[m]||[]).push(x); });
      Object.keys(byMod).forEach(m=>{
        if(byMod[m].length<=1) return;
        for(let d=0;d<7;d++){
          const on=byMod[m].filter(x=>{ const v=(week[x]||[])[d]; return v==="early"||v==="mid"||v==="night"; }).length;
          if(on<1){ failMod++; samples.push({t:"mod",dom,m,d,cfg:`${mn}~${pr}`}); }
        }
      });
    });
  }
  process.stdout.write(`轮${r+1}/${ROUNDS}  en=${failEn} mod=${failMod} r3=${failR3} range=${failRange}\n`);
}

const rate = (n,total)=> (total? (100*n/total).toFixed(2)+"% (1 次 / "+(total/n).toFixed(0)+" 次)" : "0%");
console.log(`\n===== 共 ${total} 次排班（${ROUNDS} 轮 × ${CFGS.length} 配置 × ${DOMS.length} 领域）=====`);
console.log(`  专家老师组早晚保障 : ${failEn} 次违规  ${rate(failEn,total)}`);
console.log(`  模块全员休息       : ${failMod} 次违规  ${rate(failMod,total)}`);
console.log(`  3 天连休           : ${failR3} 次违规  ${rate(failR3,total)}`);
console.log(`  休息区间越界       : ${failRange} 次违规  ${rate(failRange,total)}`);
const uniq=k=>[...new Set(samples.filter(x=>x.t===k).map(x=>JSON.stringify(x)))].length;
if(samples.length){
  console.log(`\n失败样本形态：`);
  console.log(`  专家组 ${uniq("en")} 种: ${[...new Set(samples.filter(x=>x.t==="en").map(x=>`${DAY[x.d]} 早${x.e}晚${x.ni}(${x.cfg})`))].slice(0,6).join(" | ")}`);
  console.log(`  模块   ${uniq("mod")} 种: ${[...new Set(samples.filter(x=>x.t==="mod").map(x=>`${x.m} ${DAY[x.d]}(${x.cfg})`))].slice(0,6).join(" | ")}`);
}
process.exit(failEn+failMod+failR3+failRange ? 1 : 0);
