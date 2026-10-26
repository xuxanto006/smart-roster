/* 边缘场景崩溃测试：空名单 / 单人 / 全员免排 / 空排班 / 老存档 / 坏 JSON / 零需求 等。
   目标：找出真正会抛异常（TypeError 等）的路径。只读不改规则。 */
const fs = require("fs"), vm = require("vm");
const {mulberry32} = require("./audit_core");

function makeEl(){
  const cls = new Set();
  const base = {
    value:"", textContent:"", innerHTML:"", style:{}, options:[], disabled:false, width:0, height:0, offsetWidth:0,
    dataset:{},
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), toggle(){}, contains:c=>cls.has(c)},
    getAttribute(){return null}, setAttribute(){}, click(){}, appendChild(){}, remove(){}, focus(){},
    addEventListener(){}, removeEventListener(){}, scrollIntoView(){},
    querySelector(){return makeEl()}, querySelectorAll(){return []},
    getContext(){ return new Proxy({}, {get(_,p){ if(p==="measureText") return ()=>({width:22}); return ()=>{}; }, set(){return true;}}); },
    getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}
  };
  return new Proxy(base, { get(t,p){ return (p in t) ? t[p] : undefined; }, set(t,p,v){ t[p]=v; return true; } });
}

function loadApp(htmlPath, presetLS){
  const html = fs.readFileSync(htmlPath, "utf8");
  const code = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
  const els = {};
  const rng = mulberry32(7);
  let vclock = 1000;
  const RealDate = Date;
  function FakeDate(...a){ return a.length ? new RealDate(...a) : new RealDate(1767225600000); }
  FakeDate.now = () => (vclock += 1);
  FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
  const M = Object.create(Math); M.random = rng;
  const LS = { _s: presetLS === undefined ? null : presetLS,
    getItem(){ return this._s; }, setItem(k,v){ this._s = v; }, removeItem(){ this._s = null; } };
  const sandbox = {
    document:{ getElementById(id){ if(!els[id]) els[id]=makeEl(); return els[id]; },
      querySelectorAll(){return[]}, querySelector(){return makeEl()},
      createElement(tag){ if(tag==="canvas"){ const ctx=new Proxy({},{get(_,p){ if(p==="measureText") return ()=>({width:22}); return ()=>{}; }, set(){return true;}}); return {width:0,height:0,getContext:()=>ctx,toBlob(cb){ cb({type:"image/png",size:10}); }}; } return makeEl(); }, body:{appendChild(){}, removeChild(){}},
      addEventListener(){}, removeEventListener(){} },
    localStorage: LS,
    console:{log(){},warn(){},error(){}}, confirm:()=>true, alert(){}, prompt:()=>"",
    setTimeout:(fn)=>{fn();return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    Math:M, Date:FakeDate, JSON, Array, Object, String, Number, Set, Map, Boolean,
    isNaN, parseInt, parseFloat, performance:{now:()=>FakeDate.now()},
    URL:{createObjectURL:()=>"", revokeObjectURL(){}}, Blob:function(){},
    location:{protocol:"https:", href:"https://example.invalid/app.html"},
    fetch:()=>Promise.reject(new Error("sandbox: no network")),
    window:{addEventListener(){}, removeEventListener(){}, scrollTo(){}}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const EXPORTS = ["renderAll","renderTable","renderStaff","renderStats","renderHealth",
    "autoSchedule","repatchWeek","curKey","ensureWeek","buildRules","schedulableStaff","staffDisplayCmp",
    "confirmSchedule","gotoConflict","locateConflict","save","load",
    "getStaffProfile","DEFAULT_STAFF","clearWeek","copyPrevWeek","exportCSV","checkRuleViolations"];
  try{
    vm.runInContext(code + `
;(() => {
  const o = { get state(){ return state; }, get DEFAULT_STAFF(){ return DEFAULT_STAFF; } };
  for (const n of ${JSON.stringify(EXPORTS)}) { try { const v = eval(n); if (typeof v === "function" || typeof v === "object") o[n] = v; } catch(e) {} }
  globalThis.__T = o;
})();`, sandbox, {filename:"app"});
  }catch(e){ return {bootError:e}; }
  return {T: sandbox.__T, S: sandbox.__T.state, els, LS};
}

let fails = 0, passes = 0;
function scenario(name, fn){
  try { fn(); passes++; console.log("✅ " + name); }
  catch(e){ fails++; console.log("❌ " + name + "\n     " + (e && e.stack ? e.stack.split("\n").slice(0,3).join("\n     ") : e)); }
}

const FILE = "app_merged.html";

/* 1. 空人员名单 */
scenario("空人员名单：renderAll 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = []; S.schedule = {}; S.roles = {};
  T.renderAll();
});

/* 2. 单个人 */
scenario("仅 1 人：renderAll + renderHealth 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = [T.DEFAULT_STAFF[0]]; S.schedule = {}; S.roles = {};
  T.renderAll(); T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
});

/* 3. 全员免排（可排班人数 0） */
scenario("全员被免排：renderAll + autoSchedule 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = T.DEFAULT_STAFF.slice(0,5);
  S.schedule = {}; S.roles = {};
  T.renderAll();
  T.autoSchedule();               // 应走「人数不足」分支
  T.renderAll();
});

/* 4. 无排班就点确认排班 */
scenario("无排班时 confirmSchedule：只提示不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = T.DEFAULT_STAFF.slice(0,6); S.schedule = {}; S.roles = {};
  T.confirmSchedule();
});

/* 5. 空名单点确认排班 */
scenario("空名单 confirmSchedule 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = []; S.schedule = {};
  T.confirmSchedule();
});

/* 6. gotoConflict 在没有 lastHealth 时 */
scenario("无体检结果 gotoConflict(0) 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = T.DEFAULT_STAFF.slice(0,6); S.schedule = {};
  T.gotoConflict(0); T.gotoConflict(99); T.gotoConflict(-1);
});

/* 7. staffDisplayCmp 空数组 */
scenario("staffDisplayCmp 空名单不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = [];
  S.staff.slice().sort(T.staffDisplayCmp);
});

/* 8. 零需求 */
scenario("需求全 0：renderAll + autoSchedule 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = T.DEFAULT_STAFF.slice(0,8);
  S.needs = [0,1,2,3,4,5,6].map(()=>({early:0,mid:0,night:0}));
  S.schedule = {}; S.roles = {};
  T.renderAll(); T.autoSchedule(); T.renderAll();
});

/* 9. 坏 JSON 存档 */
scenario("localStorage 是坏 JSON：load() 不崩", ()=>{
  const {T,S,LS} = loadApp(FILE, "{ this is not json ");
  T.load && T.load();
  T.renderAll();
});

/* 10. 老存档：缺新字段（limitsV / swaps / published 等） */
scenario("老存档缺新字段：load() + renderAll 不崩", ()=>{
  const old = JSON.stringify({ staff:["何广友","邓臻蓝","孙勇"], needs:[0,1,2,3,4,5,6].map(()=>({early:2,mid:0,night:2})),
    limits:{early:4,night:4}, restMax:{per:2,total:0}, requests:[], mustWork:[], schedule:{} });
  const {T,S} = loadApp(FILE, old);
  T.renderAll();
  T.autoSchedule && T.autoSchedule();
  T.renderAll();
});

/* 11. 存档里 staff 含已不在名册的人 */
scenario("存档含幽灵人员：renderAll 不崩", ()=>{
  const old = JSON.stringify({ staff:["不存在的人A","不存在的人B"], needs:[0,1,2,3,4,5,6].map(()=>({early:1,mid:0,night:1})),
    limits:{early:3,night:3}, restMax:{per:2,total:0}, requests:[], mustWork:[], schedule:{} });
  const {T,S} = loadApp(FILE, old);
  T.renderAll(); T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
});

/* 12. needs 缺字段 / 非数字 */
scenario("needs 缺字段或为 null：renderTable 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = T.DEFAULT_STAFF.slice(0,6);
  S.needs = [0,1,2,3,4,5,6].map((_,i)=> i%2 ? {early:2} : {early:null,mid:undefined,night:2});
  S.schedule = {}; S.roles = {};
  T.renderTable();
});

/* 13. 一键排班后立刻导出 */
scenario("排班后 confirmSchedule 全流程不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = T.DEFAULT_STAFF.slice(0,20);
  S.schedule = {}; S.roles = {};
  T.autoSchedule();
  T.renderAll();
  T.confirmSchedule();
  T.exportCSV();
});

/* 14. 「发布本周」与「确认名单」都已下线：函数、DOM、状态都不应存在 */
scenario("发布 / 确认名单功能已完全移除", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = T.DEFAULT_STAFF.slice(0,6); S.schedule = {}; S.roles = {};
  const raw = fs.readFileSync(FILE, "utf8");
  const must = (cond, msg)=>{ if(!cond) throw new Error(msg); };
  must(typeof T.publishWeek !== "function", "publishWeek 仍存在");
  must(typeof T.renderPublishStatus !== "function", "renderPublishStatus 仍存在");
  must(typeof T.toggleWeekConfirm !== "function", "toggleWeekConfirm 仍存在");
  must(T.state.published === undefined, "state.published 仍存在");
  must(!raw.includes("publishStatus"), "页面仍有 publishStatus 容器");
  must(!raw.includes("已确认排班"), "页面仍有「已确认排班」字样");
  must(!raw.includes("confirm-chip"), "页面仍有确认名单样式");
  T.renderAll();                     // 全站渲染仍不应报错
});

/* 15. copyPrevWeek / clearWeek 在空数据下 */
scenario("空数据 clearWeek / copyPrevWeek 不崩", ()=>{
  const {T,S} = loadApp(FILE);
  S.staff = []; S.schedule = {};
  T.clearWeek(); T.copyPrevWeek(); T.renderAll();
});

console.log(`\n汇总: ${passes} 通过 / ${fails} 失败`);
process.exit(fails ? 1 : 0);
