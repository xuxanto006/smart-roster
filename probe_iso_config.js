/* 判断「非默认配置下的上一休一」到底是算法没找到更好的解，还是配置本身就排不出来。
   做法：把 planScore 里 isoRest 的权重临时拉到极大（不改逻辑，只改取舍），
   看违规能不能降到 0。
     · 能降到 0  → 解存在，是算法在权衡时把「上一休一」让给了别的软目标（可修）
     · 降不到 0  → 解不存在，是这个配置本身排不出来（属于规则撞车，只能列举）
   同时顺便跑一遍「把每个软目标单独拉满」，定位到底是谁在跟「上一休一」抢。 */
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
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,assignRoles,planScore,planIsoRest,planGroupViol,isolatedRestCount,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const OC=["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"];
const EN=["何广友","邓臻蓝","孙勇","王鹏俊"];
const BASE={per:2, total:0, earlyDemand:8, limEarly:3, limNight:4, wkMax:1, maxPer:3};

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

/* 权重注入：orig 是原函数，extra 会在原分上再扣一笔。
   只改「取舍」，不动排班逻辑本身，所以结论只反映「解存不存在」，不反映代码对错。 */
function withWeight(fn, label){
  const orig = T.planScore;
  sandbox.planScore = p => orig(p) - fn(p);
  return ()=>{ sandbox.planScore = orig; };   // 用完必须还原，否则污染后续用例
}

function countIso(w){
  let n=0;
  S.staff.forEach(x=>{
    const s=new Set();
    for(let d=0;d<7;d++){ const v=w[x][d]||""; if(v==="rest"||v==="") s.add(d); }
    if(T.isolatedRestCount(s)>0) n++;
  });
  return n;
}
function countGap(w){
  let g=0;
  for(let d=0;d<7;d++) ["early","mid","night"].forEach(sh=>{
    const have=S.staff.filter(x=>(w[x][d]||"")===sh).length;
    if(have<S.needs[d][sh]) g+=S.needs[d][sh]-have;
  });
  return g;
}

const ROUNDS=+(process.argv[2]||20);
const CFGS=[
  {name:"早班上限 = 2 次",  o:{limEarly:2}},
  {name:"晚班上限 = 3 次",  o:{limNight:3}},
  {name:"工作日早班 = 10",  o:{earlyDemand:10}},
  {name:"每人每周休 3 天",  o:{per:3}},
];

console.log("══════ 上一休一成因判别（每项 "+ROUNDS+" 轮）══════\n");
CFGS.forEach(cfg=>{
  const c=apply(cfg.o);
  // ① 原样
  let baseIso=0, baseGap=0, roundsWithIso=0;
  for(let r=0;r<ROUNDS;r++){
    apply(cfg.o); T.autoSchedule();
    const w=T.ensureWeek(T.curKey());
    const n=countIso(w); baseIso+=n; baseGap+=countGap(w); if(n>0) roundsWithIso++;
  }
  // ② 把「上一休一」权重拉到极大（10 万，压过所有其它软目标）
  const restore=withWeight(p=>T.planIsoRest(p)*100000);
  let hiIso=0, hiGap=0;
  for(let r=0;r<ROUNDS;r++){
    apply(cfg.o); T.autoSchedule();
    const w=T.ensureWeek(T.curKey());
    hiIso+=countIso(w); hiGap+=countGap(w);
  }
  restore();
  // ③ 对照组：把「每人要上满 N 天」权重拉到极大，看违规是不是被它挤出来的
  const restore2=withWeight(p=>{
    const wt=7-((S.restMax&&S.restMax.per)||2);
    return p.assign.reduce((s,a)=>s+Math.max(0,wt-a.length),0)*100000;
  });
  let swIso=0;
  for(let r=0;r<ROUNDS;r++){
    apply(cfg.o); T.autoSchedule();
    swIso+=countIso(T.ensureWeek(T.curKey()));
  }
  restore2();

  console.log("▸ " + cfg.name);
  console.log("    原样                上一休一 "+baseIso+" 人次 ／ 出现在 "+roundsWithIso+"/"+ROUNDS+" 轮 ／ 缺班 "+baseGap);
  console.log("    上一休一权重拉满    上一休一 "+hiIso+" 人次 ／ 缺班 "+hiGap);
  console.log("    「上满天数」拉满   上一休一 "+swIso+" 人次");
  const verdict = hiIso===0 ? "解存在 → 算法在权衡时把它让给了别的软目标（可修）"
                : (hiIso < baseIso*0.5 ? "大部分能消掉，剩下的确实是排不出来"
                                       : "拉满也消不掉 → 配置本身排不出来（规则撞车）");
  console.log("    判定：" + verdict + "\n");
});
