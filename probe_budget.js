/* 紧配置下排不好，到底是「搜索预算被砍」还是「搜索质量不行」？
   两者的修法完全不同：
     · 预算被砍 → 候选数远小于 300，deadline 提前掐断 → 该调预算策略
     · 质量不行 → 候选跑满 300 个仍然找不到 → 该改搜索本身
   办法：hook tryPlan 数它被调用了几次（autoSchedule 里每轮候选调一次）。
   同时算出单次候选耗时，估算跑满 300 个需要多久。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,assignRoles,isolatedRestCount,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const OC=["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"];
const EN=["何广友","邓臻蓝","孙勇","王鹏俊"];
const BASE={per:2,total:0,earlyDemand:8,limEarly:3,limNight:4,wkMax:1,maxPer:3};

function apply(o){
  const c=Object.assign({},BASE,o||{});
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:c.earlyDemand,mid:1,night:10}))
        .concat([5,6].map(()=>({early:c.earlyDemand+1,mid:3,night:12})));
  S.limits={early:c.limEarly,night:c.limNight,mid:99};
  S.restMax={per:c.per,total:c.total};
  S.exactShifts=["early"]; S.weekendEarlyMax=c.wkMax;
  S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={}; S.mustWork=[];
  S.groups={earlyNight:{members:EN.slice(),minEarly:1,minNight:1},
            openClose:{members:OC.slice(),open:1,close:2,maxPerWeek:c.maxPer}};
  return c;
}
function isoOf(w){
  let n=0;
  S.staff.forEach(x=>{
    const s=new Set();
    for(let d=0;d<7;d++){ const v=w[x][d]||""; if(v==="rest"||v==="") s.add(d); }
    if(T.isolatedRestCount(s)>0) n++;
  });
  return n;
}
function groupGap(w){
  let n=0;
  for(let d=0;d<7;d++){
    if(EN.filter(x=>(w[x][d]||"")==="early").length<1) n++;
    if(EN.filter(x=>(w[x][d]||"")==="night").length<1) n++;
  }
  return n;
}

// hook：数 tryPlan 被调用几次
const origTry = sandbox.tryPlan;
let tryCount = 0;
sandbox.tryPlan = function(){ tryCount++; return origTry.apply(null, arguments); };

const ROUNDS=+(process.argv[2]||10);
const CFGS=[
  {name:"默认配置",          o:{}},
  {name:"早班上限 = 2 次",   o:{limEarly:2}},
  {name:"晚班上限 = 3 次",   o:{limNight:3}},
  {name:"工作日早班 = 10",   o:{earlyDemand:10}},
  {name:"每人每周休 3 天",   o:{per:3}},
];

console.log("══════ 搜索预算诊断（每项 "+ROUNDS+" 轮）══════");
console.log("（autoSchedule 上限 300 个候选，但 deadline=2.5 秒可能提前掐断）\n");
console.log("配置".padEnd(18)+"候选数(中位/最大)  单次耗时   上一休一  保障组缺口  跑满300要");
console.log("─".repeat(84));
CFGS.forEach(cfg=>{
  const cnts=[], isos=[], ggs=[]; let tTotal=0, tRuns=0;
  for(let r=0;r<ROUNDS;r++){
    apply(cfg.o);
    tryCount=0;
    const t0=Date.now();
    T.autoSchedule();
    const dt=Date.now()-t0;
    tTotal+=dt; tRuns+=tryCount;
    cnts.push(tryCount);
    const w=T.ensureWeek(T.curKey());
    isos.push(isoOf(w)); ggs.push(groupGap(w));
  }
  cnts.sort((a,b)=>a-b);
  const med=cnts[Math.floor(cnts.length/2)];
  const max=cnts[cnts.length-1];
  const perTry=tRuns?(tTotal/tRuns):0;
  const full300=(perTry*300/1000).toFixed(1);
  const iso=isos.reduce((s,x)=>s+x,0), gg=ggs.reduce((s,x)=>s+x,0);
  const budgetCapped = med < 250;
  console.log(cfg.name.padEnd(18)+
    String(med).padStart(6)+" / "+String(max).padEnd(8)+
    (perTry.toFixed(1)+"ms").padStart(10)+
    String(iso).padStart(9)+String(gg).padStart(11)+
    (full300+"s").padStart(11)+
    (budgetCapped?"   ← 预算被砍":""));
});
console.log("\n判定：候选数中位数 < 250 即说明 deadline 提前掐断，属于「预算被砍」而非「搜索质量不行」。");
sandbox.tryPlan = origTry;
