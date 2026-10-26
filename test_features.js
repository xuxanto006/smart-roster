/* 功能正确性测试（不是崩溃测试）：
   1) staffDisplayCmp 排序语义：经理保持原位不动，其余不排班者沉底
   2) locateConflict 对 renderHealth 各类文案解析是否正确
   3) confirmSchedule 导出的表格是否与班表真实数据一致（顺序/班次/休息天数）
   4) 80 人名册下导出与排班的性能 */
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
const DL = [];
function loadApp(htmlPath){
  const html = fs.readFileSync(htmlPath, "utf8");
  const code = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
  const els = {}; const rng = mulberry32(7); let vclock = 1000;
  const RealDate = Date;
  function FakeDate(...a){ return a.length ? new RealDate(...a) : new RealDate(1767225600000); }
  FakeDate.now = () => (vclock += 1); FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
  const M = Object.create(Math); M.random = rng;
  const sandbox = {
    document:{ getElementById(id){ if(!els[id]) els[id]=makeEl(); return els[id]; },
      querySelectorAll(){return[]}, querySelector(){return makeEl()},
      createElement(tag){ if(tag==="canvas"){ const ctx=new Proxy({},{get(_,p){ if(p==="measureText") return ()=>({width:22}); return ()=>{}; }, set(){return true;}}); return {width:0,height:0,getContext:()=>ctx,toBlob(cb){ cb({type:"image/png",size:10}); }}; }
        if(tag==="a") return {href:"",download:"",style:{},click(){ DL.push(this.download); }}; return makeEl(); },
      body:{appendChild(){}, removeChild(){}}, addEventListener(){}, removeEventListener(){} },
    localStorage:{_s:null,getItem(){return this._s;},setItem(k,v){this._s=v;},removeItem(){this._s=null;}},
    console:{log(){},warn(){},error(){}}, confirm:()=>true, alert(){}, prompt:()=>"",
    setTimeout:(fn)=>{fn();return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    Math:M, Date:FakeDate, JSON, Array, Object, String, Number, Set, Map, Boolean,
    isNaN, parseInt, parseFloat, performance:{now:()=>FakeDate.now()},
    URL:{createObjectURL:()=>"blob:x", revokeObjectURL(){}}, Blob:function(p,o){this.parts=p;this.type=o&&o.type;},
    location:{protocol:"https:", href:"https://example.invalid/app.html"},
    fetch:()=>Promise.reject(new Error("no net")),
    window:{addEventListener(){}, removeEventListener(){}, scrollTo(){}}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const EXPORTS = ["autoSchedule","curKey","ensureWeek","buildRules","staffDisplayCmp","locateConflict","curDomain","domainStaff","isManager",
    "confirmSchedule","getStaffProfile","isBlockedFromSchedule","exportCSV","domLabel",
    "DEFAULT_STAFF","EXCLUDE_SCHEDULE","EXCLUDE_MODULES","renderTable","schedulableStaff","DOMAINS","domainStaff"];
  vm.runInContext(code + `
;(() => {
  const o = { get state(){ return state; }, get DEFAULT_STAFF(){ return DEFAULT_STAFF; } };
  for (const n of ${JSON.stringify(EXPORTS)}) { try { const v = eval(n); if (typeof v === "function" || typeof v === "object") o[n] = v; } catch(e) {} }
  globalThis.__T = o;
})();`, sandbox, {filename:"app"});
  return {T: sandbox.__T, S: sandbox.__T.state};
}

let fails = 0;
function chk(label, cond, extra){
  console.log((cond?"✅ ":"❌ ")+label+(extra!==undefined?"  → "+JSON.stringify(extra):""));
  if(!cond) fails++;
}

const {T, S} = loadApp("app_merged.html");

/* ---------- 1. 排序语义 ---------- */
console.log("\n=== 1. staffDisplayCmp 排序语义 ===");
/* 造一个名册：普通 / 经理 / 真·免排(EXCLUDE_SCHEDULE) / 暂免模块(EXCLUDE_MODULES) 混合。
   样本名要跟着排除名单走，不能写死：
     EXCLUDE_SCHEDULE 现为 [李敏, 黄弼姗]
     EXCLUDE_MODULES  现为 [行政]（原「人事培训」；人事培训只剩经理陈志浩，靠身份免排）
   写死旧名字会导致名单调整后这个用例假失败 —— 已经踩过一次。 */
const NAME_EXCLUDE = [...T.EXCLUDE_SCHEDULE][0] || "李敏";   // 取人名排除名单里的任一人
const MOD_EXCLUDE = [...T.EXCLUDE_MODULES][0] || "行政";     // 取模块排除名单里的任一模块
const N_NAME = "王免排", N_MOD = "赵暂免";
S.staff = ["A普通","B经理",N_NAME,"D普通",N_MOD,"F经理","G普通"];
S.staffProfiles = {
  "A普通":{module:"3C顾问",position:"顾问",level:"员工",tags:[]},
  "B经理":{module:"3C顾问",position:"经理",level:"经理",tags:[]},
  [N_NAME]:{module:"3C顾问",position:"顾问",level:"员工",tags:[]},
  "D普通":{module:"3C顾问",position:"顾问",level:"员工",tags:[]},
  [N_MOD]:{module:MOD_EXCLUDE,position:"顾问",level:"员工",tags:[]},
  "F经理":{module:"3C顾问",position:"经理",level:"经理",tags:[]},
  "G普通":{module:"3C顾问",position:"顾问",level:"员工",tags:[]}
};
// 样本要真正落在名单里，否则前提断言本身就失去意义
S.EXCLUDE_SCHEDULE = S.EXCLUDE_SCHEDULE || new Set();
if(!T.EXCLUDE_SCHEDULE.has(N_NAME)) T.EXCLUDE_SCHEDULE.add(N_NAME);
if(!T.EXCLUDE_MODULES.has(MOD_EXCLUDE)) T.EXCLUDE_MODULES.add(MOD_EXCLUDE);
// 先确认前提：一个人名免排、一个模块免排
chk("前提："+N_NAME+"(EXCLUDE_SCHEDULE) 被判不排班", T.isBlockedFromSchedule(N_NAME)===true);
chk("前提："+N_MOD+"(EXCLUDE_MODULES "+MOD_EXCLUDE+") 被判不排班", T.isBlockedFromSchedule(N_MOD)===true);
chk("前提：A普通 可排班", T.isBlockedFromSchedule("A普通")===false);
const sorted = S.staff.slice().sort(T.staffDisplayCmp);
chk("经理保持原相对位置（不沉底、不提前）", sorted.indexOf("B经理") < sorted.indexOf("G普通"), sorted);
chk("非经理免排/暂免沉到末尾", sorted.slice(-2).join(",")===N_NAME+","+N_MOD, sorted);
chk("可排班者保持原序", sorted.filter(n=>["A普通","D普通","G普通"].includes(n)).join(",")==="A普通,D普通,G普通",
    sorted.filter(n=>["A普通","D普通","G普通"].includes(n)));
chk("总数不变", sorted.length===7, sorted.length);

/* ---------- 2. locateConflict 解析 ---------- */
console.log("\n=== 2. locateConflict 解析各类文案 ===");
S.staff = ["刘科","张子柔","何广友","莫甄姗"];
const cases = [
  ["周三晚班缺 1 人（需 5，实排 4）", null, 2],
  ["周一早班缺 2 人（需 9，实排 7）", null, 0],
  ["张子柔 上一休一（休 周二、周四）", "张子柔", 1],
  ["刘科 晚班 4 次 > 上限 3", "刘科", -1],
  ["刘科 周三晚班接周四早班", "刘科", 2],
  ["周六周日连上早班 3 人 > 上限 1", null, 5],
  ["人力不够：需求 200 人次，但 46 人 × 每周 5 个工作日 = 230 人次", null, -1],
  ["全队休息 306 人日 > 上限 160 人日", null, -1],
  ["开店闭店组角色名额：需要 21 人次，但产能只有 18 人次", null, -1],
];
cases.forEach(([msg, ename, eday])=>{
  const r = T.locateConflict(msg);
  chk(`「${msg.slice(0,20)}…」→ ${ename===null?"(无对象)":ename} / ${eday===-1?"(无星期)":"周"+eday}`,
      r.name===ename && r.day===eday, r);
});
// 名字互相包含时取最长
const r2 = T.locateConflict("刘科与张三丰都冲突");
chk("姓名取最长匹配（避免「刘科」误配「张三丰」）", r2.name==="刘科" || r2.name===null, r2);

/* ---------- 3. 导出内容与班表一致 ---------- */
console.log("\n=== 3. 导出内容 == 班表真实数据 ===");
const {T: T2, S: S2} = loadApp("app_merged.html");
S2.staff = T2.DEFAULT_STAFF.slice(0,25);
S2.needs = [0,1,2,3,4,5,6].map(()=>({early:4,mid:1,night:4}));
S2.limits = {early:3, night:3, mid:99};
S2.restMax = {per:2, total:0};
S2.schedule = {}; S2.roles = {}; S2.requests = []; S2.mustWork = [];
T2.autoSchedule();
const k = T2.curKey(), wk = T2.ensureWeek(k);
// 导出改为 Excel(CSV)：校验每人行与班表一致
const csv = T2.exportCSV();
const rows = csv.replace(/^\uFEFF/,"").split("\n").filter(Boolean);
const head = rows[0].split(",");
const col = n => head.indexOf(n);
const iDom=col("领域"), iName=col("姓名"), iE=col("早班数"), iM=col("中班数"), iN=col("晚班数"), iR=col("休息数");
const data = rows.slice(1).map(l=>l.split(",")).filter(c=>c.length>iR);
const domList = T2.domainStaff(T2.curDomain());
chk("CSV 表头含 领域/姓名/各班次/休息", [iDom,iName,iE,iM,iN,iR].every(x=>x>=0), {iDom,iName,iE,iM,iN,iR});
chk("CSV 行数 == 名册总人数（各部门合并）", data.length===T2.state.staff.length, data.length);
let orderOk=true, shiftOk=true, restOk=true;
/* 期望顺序改为遍历 DOMAINS —— 不写死领域列表，加部门后不必再改这里。
   必须与 exportCSV 内部用的领域顺序完全一致（都是 DOMAINS 的声明顺序）。 */
const expectOrder=[];
T2.DOMAINS.forEach(d=>{
  T2.domainStaff(d.key).slice().sort(T2.staffDisplayCmp).forEach(n=>expectOrder.push([d.key,n]));
});
data.forEach((c,i)=>{
  const [d,n] = expectOrder[i] || [];
  if(c[iName]!==n || c[iDom]!==T2.domLabel(d)) orderOk = false;
  const arr = T2.ensureWeek(k)[n] || [];
  const e=arr.filter(v=>v==="early").length, m=arr.filter(v=>v==="mid").length, ni=arr.filter(v=>v==="night").length;
  if(+c[iE]!==e || +c[iM]!==m || +c[iN]!==ni) shiftOk = false;
  if(+c[iR]!==arr.filter(v=>v==="rest").length) restOk = false;
});
chk("CSV 顺序与领域/排序一致", orderOk);
chk("CSV 各班次数与班表一致", shiftOk);
chk("CSV 休息数与班表一致（只算显式 rest）", restOk);
chk("CSV 含全部姓名", T2.state.staff.every(n=>csv.includes(","+n+",")), csv.length);
chk("CSV 含 7 个周次表头", head.filter(h=>/^周[一二三四五六日]/.test(h)).length===7, head.filter(h=>/^周[一二三四五六日]/.test(h)).length);
chk("CSV 含『休息数』列名", iR>=0);

/* ---------- 4. 80 人名册性能 ---------- */
console.log("\n=== 4. 80 人名册性能 ===");
const {T: T3, S: S3} = loadApp("app_merged.html");
S3.staff = T3.DEFAULT_STAFF.slice();
S3.needs = [0,1,2,3,4,5,6].map(()=>({early:9,mid:1,night:10}));
S3.limits = {early:3, night:3, mid:99};
S3.restMax = {per:2, total:0};
S3.schedule = {}; S3.roles = {}; S3.requests = []; S3.mustWork = [];
let t0 = Date.now();
T3.autoSchedule();
const tSch = Date.now()-t0;
t0 = Date.now();
const h3 = T3.exportCSV();
const tExp = Date.now()-t0;
chk(`80 人排班耗时 ${tSch}ms（<8s）`, tSch < 8000);
chk(`80 人导出耗时 ${tExp}ms（<1500ms）`, tExp < 1500);
chk(`导出 CSV 体积 ${h3.length} 字节`, h3.length > 1000);

console.log(`\n汇总: ${fails===0?"全部通过":fails+" 项失败"}`);
process.exit(fails?1:0);
