/* 配置扫描：把用户可调的旋钮逐个拧到别的值，看 17 条规则里哪条会塌。
   之前所有审计都只在默认配置下跑过 —— 但那些数字是做成了可调的，
   用户真去改的时候会不会排不出来 / 报错，没人验过。
   这里用「一次只改一个参数」的敏感度分析法，定位每个旋钮的安全范围。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,hasRestPlan,groupMembers,assignRoles,renderHealth,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const SH=["early","mid","night"], SHCN={early:"早",mid:"中",night:"晚"};
const ROUNDS=+(process.argv[2]||25);
const WITH_LEAVE = process.argv[3]==="leave";
const rnd=n=>Math.floor(Math.random()*n);

const OC=["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"];
const EN=["何广友","邓臻蓝","孙勇","王鹏俊"];

const BASE={per:2, total:0, earlyDemand:8, limEarly:3, limNight:4, wkMax:1, maxPer:3};
const CONFIGS=[
  {name:"基准（当前线上配置）", o:{}},
  {name:"每人每周休 1 天",      o:{per:1}},
  {name:"每人每周休 3 天",      o:{per:3}},
  {name:"工作日早班 = 6 人",    o:{earlyDemand:6}},
  {name:"工作日早班 = 10 人",   o:{earlyDemand:10}},
  {name:"早班上限 = 2 次",      o:{limEarly:2}},
  {name:"早班上限 = 4 次",      o:{limEarly:4}},
  {name:"晚班上限 = 3 次",      o:{limNight:3}},
  {name:"周末连上早班上限 = 0", o:{wkMax:0}},
  {name:"周末连上早班上限 = 2", o:{wkMax:2}},
  {name:"开店闭店每人 ≤ 2 次",  o:{maxPer:2}},
  {name:"开店闭店每人 ≤ 4 次",  o:{maxPer:4}},
  {name:"全队休息上限 = 55 人日",o:{total:55}},
];

function apply(cfg){
  const c=Object.assign({},BASE,cfg.o);
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:c.earlyDemand, mid:1, night:10}))
        .concat([5,6].map(()=>({early:c.earlyDemand+1, mid:3, night:12})));
  S.limits={early:c.limEarly, night:c.limNight, mid:99};
  S.restMax={per:c.per, total:c.total};
  S.exactShifts=["early"];
  S.weekendEarlyMax=c.wkMax;
  S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={}; S.mustWork=[];
  S.groups={
    earlyNight:{members:EN.slice(), minEarly:1, minNight:1},
    openClose:{members:OC.slice(), open:1, close:2, maxPerWeek:c.maxPer}
  };
  return c;
}

function audit(c, w, roles, R){
  const bad={};
  const hit=(k,d)=>{ bad[k]=(bad[k]||0)+1; if(!bad[k+"_ex"]) bad[k+"_ex"]=d; };
  const at=(n,d)=>w[n][d]||"";
  // 1 班次人数
  for(let d=0;d<7;d++) SH.forEach(sh=>{
    const n=S.staff.filter(x=>at(x,d)===sh).length;
    if(n < S.needs[d][sh]) hit("班次人数不足", `周${d+1}${SHCN[sh]} 需${S.needs[d][sh]} 实${n}`);
  });
  // 2 早班人数恰好
  for(let d=0;d<5;d++){
    const n=S.staff.filter(x=>at(x,d)==="early").length;
    if(n !== S.needs[d].early) hit("早班人数≠需求", `周${d+1} 需${S.needs[d].early} 实${n}`);
  }
  // 3/4 班次上限
  S.staff.forEach(n=>{
    const cnt={early:0,mid:0,night:0};
    for(let d=0;d<7;d++) if(cnt[at(n,d)]!==undefined) cnt[at(n,d)]++;
    if(cnt.early>c.limEarly) hit("超早班上限", `${n} ${cnt.early}次`);
    if(cnt.night>c.limNight) hit("超晚班上限", `${n} ${cnt.night}次`);
  });
  // 5 每人休息天数
  S.staff.forEach(n=>{
    const r=[0,1,2,3,4,5,6].filter(d=>at(n,d)==="rest"||!at(n,d)).length;
    if(r!==c.per) hit("休息天数≠配额", `${n} 休${r}天 应${c.per}天`);
  });
  // 6 全队休息总数
  const tot=S.staff.reduce((s,n)=>s+[0,1,2,3,4,5,6].filter(d=>at(n,d)==="rest"||!at(n,d)).length,0);
  const cap=c.total>0?c.total:c.per*S.staff.length;
  if(tot>cap) hit("全队休息超上限", `${tot} > ${cap}`);
  // 7 上一休一（区分成因）
  let isoAvoidable=0;
  S.staff.forEach(n=>{
    const s=new Set(); for(let d=0;d<7;d++) if(at(n,d)==="rest"||!at(n,d)) s.add(d);
    if(T.isolatedRestCount(s)>0){
      hit("上一休一", `${n} 休${[...s].sort().join(",")}`);
      // 输入层是否注定躲不开
      const off=[], must=[];
      for(let d=0;d<7;d++){ const cc=R[n][d]; if(cc.off) off.push(d); else if(cc.noOff) must.push(d); }
      const doomed = off.length<=c.per && must.length<=7-c.per && !T.hasRestPlan(off,c.per,must);
      if(!doomed) isoAvoidable++;
    }
  });
  bad["上一休一_可避免"] = isoAvoidable;
  // 8 三连早  9 晚接早
  S.staff.forEach(n=>{
    for(let d=0;d<5;d++) if(at(n,d)==="early"&&at(n,d+1)==="early"&&at(n,d+2)==="early") hit("三连早",`${n} 周${d+1}`);
    for(let d=0;d<6;d++) if(at(n,d)==="night"&&at(n,d+1)==="early") hit("晚接早",`${n} 周${d+1}`);
  });
  // 10 早晚保障组
  for(let d=0;d<7;d++){
    if(EN.filter(n=>at(n,d)==="early").length<1) hit("保障组缺早班",`周${d+1}`);
    if(EN.filter(n=>at(n,d)==="night").length<1) hit("保障组缺晚班",`周${d+1}`);
  }
  // 11/12 开店闭店
  for(let d=0;d<7;d++){
    if(OC.filter(n=>((roles[n]||[])[d])==="open").length<1)  hit("缺开店",`周${d+1}`);
    if(OC.filter(n=>((roles[n]||[])[d])==="close").length<2) hit("缺闭店",`周${d+1}`);
  }
  OC.forEach(n=>{
    const cc=(roles[n]||[]).filter(x=>x==="open"||x==="close").length;
    if(cc>c.maxPer) hit("超开店闭店次数",`${n} ${cc}次`);
  });
  // 13 周末早班
  const both=S.staff.filter(n=>at(n,5)==="early"&&at(n,6)==="early");
  if(both.length>c.wkMax) hit("周末连上早班超限",`${both.length}人`);
  // 14 请假
  T.checkRuleViolations(w,R).forEach(x=>hit("请假未满足",x));
  return bad;
}

/* 改完配置、还没排班时，体检面板有没有把「这个配置排不出来」说出来。
   配置层检查与班表无关，所以拿空班表调用也能拿到。 */
function configWarnings(cfg){
  apply(cfg);
  T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
  const b=(els["healthBox"]||{}).innerHTML||"";
  return b.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function run(cfg){
  const c=apply(cfg);
  const agg={}; let isoAvoidable=0;
  agg.__cfgWarn = configWarnings(cfg);
  for(let r=0;r<ROUNDS;r++){
    apply(cfg);
    if(WITH_LEAVE){
      const cnt=2+rnd(2), used={}; let id=1;
      while(S.requests.length<cnt){
        const n=S.staff[rnd(S.staff.length)], d=rnd(7), key=n+"|"+d;
        if(used[key]) continue; used[key]=1;
        S.requests.push({id:id++,name:n,day:d,type:"off",scope:"once",weekKey:T.curKey()});
      }
    }
    T.autoSchedule();
    const k=T.curKey(), w=T.ensureWeek(k), R=T.buildRules(cfg.o?k:k);
    T.assignRoles(k);
    const res=audit(c, w, S.roles[k]||{}, T.buildRules(k));
    Object.keys(res).forEach(key=>{
      if(key.endsWith("_ex")) { if(!agg[key]) agg[key]=res[key]; return; }
      agg[key]=(agg[key]||0)+res[key];
    });
  }
  return agg;
}

console.log("══════ 配置敏感度扫描（每项 "+ROUNDS+" 轮"+(WITH_LEAVE?" · 带请假":" · 无请假")+"）══════\n");
CONFIGS.forEach(cfg=>{
  const a=run(cfg);
  const keys=Object.keys(a).filter(k=>!k.endsWith("_ex") && k!=="上一休一_可避免" && k!=="__cfgWarn");
  const avoid=a["上一休一_可避免"]||0;
  const cw=(a.__cfgWarn||"");
  const flagged = /人力不够|互相矛盾|余量|产能|必然排不出来|上限卡死/.test(cw);
  const tag = keys.length ? (flagged ? "已提示 ✅" : "静默 ❌") : (flagged ? "误报 ❌" : "无提示 ✅");
  console.log("  " + (keys.length? "⚠️ ":"✅ ") + cfg.name + "  ｜配置面板：" + tag);
  if(flagged) console.log("        " + cw.slice(0,200));
  if(!keys.length){
    // 全部通过
  }else{
    const parts=keys.map(k=>{
      let s=`${k} ${a[k]}`;
      if(k==="上一休一" && avoid>0) s+=`（其中 ${avoid} 次本可避免 ❌）`;
      else if(k==="上一休一") s+="（均为输入层不可避免）";
      return s;
    });
    parts.forEach(p=>console.log("        · " + p + "   例：" + (a[keys[0]+"_ex"]||"")));
  }
});
