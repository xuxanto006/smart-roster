/* 「早班上限=2」是唯一一个「配置本身可行、却被 2.5 秒截止时间砍掉预算」的：
   只跑了 146/300 个候选，残留上一休一 18/10 轮。
   那多给预算到底有没有用？直接改 deadline 要动业务代码，这里用「把时钟调慢」等效延长：
   时钟跑 0.4 倍速 → 2500ms 的预算等于实际 6250ms → 候选数翻倍。
     · 违规明显下降 → 是预算问题，提高预算即可（但要权衡用户等待时间）
     · 违规纹丝不动 → 是搜索质量问题，加预算没用，得改搜索本身 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};

/* 可调速时钟：speed=1 是真实时间，speed=0.4 表示沙箱里的时间只走 0.4 倍，
   于是 2500ms 的预算在真实世界里变成 6250ms。 */
const RealDate = Date;
let t0 = RealDate.now(), speed = 1;
const fakeNow = ()=> t0 + (RealDate.now()-t0)*speed;
class SlowDate extends RealDate {
  constructor(...a){ super(...(a.length?a:[fakeNow()])); }
  static now(){ return fakeNow(); }
}
sandbox.Date = SlowDate;
sandbox.globalThis=sandbox; vm.createContext(sandbox);
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
  let n=0;
  S.staff.forEach(x=>{
    const s=new Set();
    for(let d=0;d<7;d++){ const v=w[x][d]||""; if(v==="rest"||v==="") s.add(d); }
    if(T.isolatedRestCount(s)>0) n++;
  });
  return n;
}
function gapOf(w,c){
  let g=0;
  for(let d=0;d<7;d++) ["early","mid","night"].forEach(sh=>{
    const have=S.staff.filter(x=>(w[x][d]||"")===sh).length;
    if(have<S.needs[d][sh]) g+=S.needs[d][sh]-have;
  });
  return g;
}
const origTry = sandbox.tryPlan;
let tryCount=0;
sandbox.tryPlan = function(){ tryCount++; return origTry.apply(null, arguments); };

const ROUNDS=+(process.argv[2]||8);
const CASES=[
  {name:"早班上限 = 2 次（可行但紧）", o:{limEarly:2},  speeds:[1, 0.4]},
  {name:"晚班上限 = 3 次",             o:{limNight:3},  speeds:[1, 0.4]},
  {name:"默认配置（对照）",             o:{},            speeds:[1]},
];

console.log("══════ 预算 vs 质量诊断（每项 "+ROUNDS+" 轮）══════");
console.log("speed=0.4 → 沙箱时钟半速以下，等效把 2.5s 预算拉到约 6.2s\n");
CASES.forEach(cs=>{
  console.log("▸ " + cs.name);
  cs.speeds.forEach(sp=>{
    speed = sp;
    let iso=0, gap=0, cnt=0, worst=0, tReal=0;
    for(let r=0;r<ROUNDS;r++){
      apply(cs.o);
      tryCount=0;
      const t0r=RealDate.now();
      T.autoSchedule();
      tReal += RealDate.now()-t0r;
      cnt += tryCount;
      const w=T.ensureWeek(T.curKey());
      const i=isoOf(w); iso+=i; if(i>worst) worst=i;
      gap += gapOf(w, Object.assign({},BASE,cs.o));
    }
    console.log("    speed="+sp.toFixed(2)+
      "  候选 "+String(Math.round(cnt/ROUNDS)).padStart(3)+"/轮"+
      "  上一休一 "+String(iso).padStart(3)+" 人次（单轮最多 "+worst+"）"+
      "  缺班 "+String(gap).padStart(2)+
      "  真实耗时 "+(tReal/ROUNDS/1000).toFixed(2)+"s/轮");
  });
  console.log("");
});
speed=1; sandbox.tryPlan=origTry;
console.log("判定：speed 调小后「上一休一」明显下降 → 预算问题；纹丝不动 → 搜索质量问题。");
