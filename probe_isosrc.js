/* 定位「上一休一」到底是候选搜索没找到，还是最后那两步后处理又改坏了。
   注意：iso 在选优里是字典序硬约束（badNow = planIsoRest + planGroupViol），
   排在 score 前面 —— 所以调 score 权重是无效杠杆，只能从「后处理」这条线查。
   实验：把最终班表级的 absorbSurplus / fillGaps 逐个关掉，看 iso 怎么变。
     · 关掉后 iso 归零  → 后处理二次破坏（可修，且默认配置下 iso 本就是 0，修复是空操作）
     · 关掉后 iso 不变  → 候选搜索本身就没找到干净解（搜索饱和，属配置太紧） */
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
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,isolatedRestCount,DEFAULT_STAFF};",sandbox,{filename:"s"});
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
  let n=0, who=[];
  S.staff.forEach(x=>{
    const s=new Set();
    for(let d=0;d<7;d++){ const v=w[x][d]||""; if(v==="rest"||v==="") s.add(d); }
    if(T.isolatedRestCount(s)>0){ n++; who.push(x+"["+[...s].sort().join(",")+"]"); }
  });
  return {n, who};
}
function restWrong(w,c){
  let n=0;
  S.staff.forEach(x=>{
    let r=0; for(let d=0;d<7;d++){ const v=w[x][d]||""; if(v==="rest"||v==="") r++; }
    if(r!==c.per) n++;
  });
  return n;
}

const ROUNDS=+(process.argv[2]||20);
const CFG={name:"早班上限 = 2 次", o:{limEarly:2}};

function arm(label, patch, restore){
  let iso=0, rw=0, rounds=0, sample="", t0=Date.now();
  for(let r=0;r<ROUNDS;r++){
    apply(CFG.o);
    patch && patch();
    T.autoSchedule();
    restore && restore();
    const w=T.ensureWeek(T.curKey()), c=Object.assign({},BASE,CFG.o);
    const a=isoOf(w); iso+=a.n; rw+=restWrong(w,c);
    if(a.n>0){ rounds++; if(!sample) sample=a.who.slice(0,3).join(" "); }
  }
  console.log("    "+label.padEnd(26)+" 上一休一 "+String(iso).padStart(3)+" 人次 / "+rounds+"/"+ROUNDS+" 轮" +
              " ｜ 休息天数≠配额 "+String(rw).padStart(3)+" ｜ "+((Date.now()-t0)/1000).toFixed(1)+"s");
  if(sample) console.log("        例：" + sample);
}

console.log("══════ 上一休一来源定位（"+CFG.name+" · "+ROUNDS+" 轮）══════\n");
console.log("  【基线】");
arm("原样（两步后处理都在）", null, null);

const origAbsorb = sandbox.absorbSurplus;
const origFill   = sandbox.fillGaps;
console.log("\n  【逐个关掉最终班表级的后处理】");
arm("关掉 absorbSurplus", ()=>{ sandbox.absorbSurplus=function(){}; }, ()=>{ sandbox.absorbSurplus=origAbsorb; });
arm("关掉 fillGaps",      ()=>{ sandbox.fillGaps=function(){}; },      ()=>{ sandbox.fillGaps=origFill; });
arm("两步都关",           ()=>{ sandbox.absorbSurplus=function(){}; sandbox.fillGaps=function(){}; },
                          ()=>{ sandbox.absorbSurplus=origAbsorb; sandbox.fillGaps=origFill; });

console.log("\n  【对照：默认配置（早班上限 3）走同一条路径】");
const CFG2={o:{}};
(function(){
  let iso=0, rounds=0;
  for(let r=0;r<ROUNDS;r++){
    apply(CFG2.o); T.autoSchedule();
    const a=isoOf(T.ensureWeek(T.curKey())); iso+=a.n; if(a.n>0) rounds++;
  }
  console.log("    默认配置                  上一休一 "+String(iso).padStart(3)+" 人次 / "+rounds+"/"+ROUNDS+" 轮");
})();
