/* 排班领域隔离测试：3C顾问 与 鸿蒙智行 各排各的，互不混淆 */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const code=(()=>{const _h=fs.readFileSync("app_merged.html","utf8");let b="",m,r=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=r.exec(_h))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
const els={};let vc=1000;const RD=Date;
function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
const M=Object.create(Math);M.random=mulberry(5);
const sb={document:{getElementById(id){if(!els[id])els[id]=makeEl();return els[id];},querySelectorAll(){return[]},querySelector(){return makeEl()},
  createElement(){return makeEl()},body:{appendChild(){},removeChild(){}},addEventListener(){},removeEventListener(){}},
 localStorage:{_s:null,getItem(){return this._s;},setItem(k,v){this._s=v;},removeItem(){this._s=null;}},
 console:{log(){},warn(){},error(){}},confirm:()=>true,alert(){},prompt:()=>"",
 setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},setInterval:()=>0,clearInterval(){},
 Math:M,Date:FD,JSON,Array,Object,String,Number,Set,Map,Boolean,isNaN,parseInt,parseFloat,
 performance:{now:()=>FD.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){},
 location:{protocol:"https:",href:"https://x.invalid/a.html"},fetch:()=>Promise.reject(new Error("no")),
 window:{addEventListener(){},removeEventListener(){},scrollTo(){}}};
sb.globalThis=sb;vm.createContext(sb);
const EX=["autoSchedule","repatchWeek","curKey","ensureWeek","buildRules","renderTable","renderHealth","renderDomainTabs",
          "schedulableStaff","domainStaff","domainSchedulable","inDomain","isHongmeng","curDomain","domNeeds","domLimits",
          "domRestMax","getStaffProfile","isBlockedFromSchedule","schedRestStats","state","DEFAULT_STAFF",
          "EXCLUDE_MODULES","EXCLUDE_POSITIONS","EXCLUDE_SCHEDULE","setDayNeed",
            "DOMAINS","isKufang","isAdmin","domainStaff"];
vm.runInContext(code+"\n;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};\n"+
  "for(const n of "+JSON.stringify(EX)+"){try{const v=eval(n);if(typeof v==='function'||typeof v==='object')o[n]=v;}catch(e){}}\n"+
  "globalThis.__T=o;})();", sb, {filename:"app"});
const T=sb.__T, S=sb.__T.state;
let fails=0;
const chk=(l,c,e)=>{console.log((c?"✅ ":"❌ ")+l+(e!==undefined?"  → "+JSON.stringify(e):""));if(!c)fails++;};

const MG = S.staff.filter(n=>T.getStaffProfile(n).level==="经理");
const HM = S.staff.filter(n=>T.getStaffProfile(n).module==="鸿蒙智行" && T.getStaffProfile(n).level!=="经理");
const AS = S.staff.filter(n=>T.getStaffProfile(n).module==="售后" && T.getStaffProfile(n).level!=="经理");
/* C3 直接取 domainStaff("3c")，不要用「排除鸿蒙/售后」反推 ——
   那种写法每加一个部门就失效一次（加「库房 / 行政」时已踩过一次）。 */
const C3 = T.domainStaff("3c");
const KF = T.domainStaff("kufang"), AD = T.domainStaff("admin");

/* 1. 领域划分 */
chk("鸿蒙智行已不在 EXCLUDE_MODULES（改由领域隔离）", !T.EXCLUDE_MODULES.has("鸿蒙智行"), [...T.EXCLUDE_MODULES]);
/* 人数不写死：尊界从鸿蒙智行分出后变成 12 人。改为「鸿蒙域非经理人数 == 名册里鸿蒙非经理人数」 */
chk("鸿蒙智行域人数 = 名册中鸿蒙非经理人数", HM.length===S.staff.filter(n=>T.getStaffProfile(n).module==="鸿蒙智行" && T.getStaffProfile(n).level!=="经理").length, HM.length);
chk("售后域 12 人（贾桠雄是经理，留在经理域）", AS.length===12, AS.length);
// 名册 80 人：9 经理 + 16 鸿蒙 + 12 售后 + 5 库房 + 5 行政 + 33 3C
chk("3C 域 33 人（80 − 9 经理 − 16 鸿蒙 − 12 售后 − 5 库房 − 5 行政）", C3.length===33, C3.length);
chk("库房域 5 人", KF.length===5, KF.join(" "));
chk("行政域 5 人", AD.length===5, AD.join(" "));
chk("经理域 9 人（含售后经理贾桠雄）", MG.length===9, MG.length);
/* 合计校验改为遍历 DOMAINS，不写死领域列表 —— 以后加部门不必再改这里。
   同时校验两个性质：各领域互不相交、并起来恰好等于全部名册。 */
const ALL_KEYS = T.DOMAINS.map(d=>d.key);
const seen = {}; const dupN = [];
ALL_KEYS.forEach(d=> T.domainStaff(d).forEach(n=>{ if(seen[n]) dupN.push(n); seen[n]=1; }));
chk("各领域互不相交", dupN.length===0, dupN.join(" "));
chk("各领域合计=名册", Object.keys(seen).length===S.staff.length,
    Object.fromEntries(ALL_KEYS.map(d=>[d, T.domainStaff(d).length])));
chk("售后域 12 人全部可排班", T.domainSchedulable("aftersales").length===12, T.domainSchedulable("aftersales").length);
chk("鸿蒙智行可排班 = 该域人数", T.domainSchedulable("hongmeng").length===HM.length, {域:HM.length, 可排班:T.domainSchedulable("hongmeng").length});
chk("isHongmeng 判定正确", S.staff.filter(n=>T.getStaffProfile(n).module==="鸿蒙智行").every(n=>T.isHongmeng(n)));
chk("经理域内 9 人全部可排班（含人事培训经理陈志浩）", T.domainSchedulable("manager").length===9, T.domainSchedulable("manager").length);

/* 2. 初始需求分离 */
const needs3c = JSON.stringify(S.needs);
const needsHM = T.domNeeds("hongmeng");
chk("鸿蒙智行有独立需求（7 天）", Array.isArray(needsHM) && needsHM.length===7, needsHM && needsHM[0]);
chk("鸿蒙智行需求 ≠ 3C 需求", JSON.stringify(needsHM)!==needs3c);
chk("domLimits 两套独立", T.domLimits("hongmeng")!==T.domLimits("3c"), {三C:T.domLimits("3c"),鸿蒙:T.domLimits("hongmeng")});

/* 3. 先排 3C */
T.autoSchedule("3c");
let w = T.ensureWeek(T.curKey());
const c3Shift = C3.filter(n=>!T.isBlockedFromSchedule(n) && (w[n]||[]).some(v=>v&&v!=="")).length;
const hmShiftAfter3c = HM.filter(n=>!T.isBlockedFromSchedule(n) && (w[n]||[]).some(v=>v&&v!=="")).length;
chk("3C 排班后 3C 有人上班", c3Shift>20, c3Shift);
chk("3C 排班后鸿蒙智行**没人**被排（还没排它）", hmShiftAfter3c===0, hmShiftAfter3c);
chk("3C 排班没污染 3C 需求", JSON.stringify(S.needs)===needs3c);
const snapshot3c = C3.map(n=>(w[n]||[]).join("")).join("|");

/* 4. 再排鸿蒙智行 —— 不能抹掉 3C 的班表 */
T.autoSchedule("hongmeng");
w = T.ensureWeek(T.curKey());
const c3After = C3.filter(n=>!T.isBlockedFromSchedule(n) && (w[n]||[]).some(v=>v&&v!=="")).length;
const hmShift = HM.filter(n=>!T.isBlockedFromSchedule(n) && (w[n]||[]).some(v=>v&&v!=="")).length;
chk("鸿蒙智行排上班了", hmShift>5, hmShift);
chk("**3C 班表未被抹掉**", c3After===c3Shift, {之前:c3Shift,之后:c3After});
chk("3C 班表内容逐格未变", C3.map(n=>(w[n]||[]).join("")).join("|")===snapshot3c);
chk("鸿蒙智行排班没污染 3C 需求", JSON.stringify(S.needs)===needs3c);
chk("state.needs 仍是 3C 的", T.domNeeds("3c")===S.needs);
chk("state.staff 已还原全量（人数 = 各域之和）", T.state.staff.length===T.DOMAINS.reduce((s2,d)=>s2+T.domainStaff(d.key).length,0), T.state.staff.length);

/* 4b. 经理域：经理本人要能排上班 */
T.autoSchedule("manager");
w = T.ensureWeek(T.curKey());
const mgrWorked = MG.filter(n=>(w[n]||[]).some(v=>v&&v!=="")).length;
chk("经理域排上班了", mgrWorked>=5, mgrWorked);
const c3AfterMgr = C3.filter(n=>!T.isBlockedFromSchedule(n) && (w[n]||[]).some(v=>v&&v!=="")).length;
chk("排经理不影响 3C 班表", c3AfterMgr===c3Shift, {之前:c3Shift,之后:c3AfterMgr});
chk("经理域排班没污染 3C 需求", JSON.stringify(S.needs)===needs3c);

/* 4c. 售后域 */
T.autoSchedule("aftersales");
w = T.ensureWeek(T.curKey());
chk("售后域排上班了", AS.filter(n=>(w[n]||[]).some(v=>v&&v!=="")).length>=8, AS.filter(n=>(w[n]||[]).some(v=>v&&v!=="")).length);
chk("排售后不影响 3C 班表", C3.filter(n=>!T.isBlockedFromSchedule(n) && (w[n]||[]).some(v=>v&&v!=="")).length===c3Shift);
chk("排售后没污染 3C 需求", JSON.stringify(S.needs)===needs3c);
const RAS = T.buildRules(T.curKey(), "aftersales");
chk("buildRules 售后域只含售后人", Object.keys(RAS).length===AS.length, Object.keys(RAS).length);

/* 5. 表格 / 体检 / 导出 只针对当前领域 */
T.state.domain = "hongmeng";
T.renderTable();
const hmHtml = String(els.tableBody?els.tableBody.innerHTML:"");
chk("鸿蒙智行视图只出现鸿蒙智行的人", HM.some(n=>hmHtml.includes(n)) && !C3.some(n=>hmHtml.includes(">"+n+"<")),
    {含鸿蒙:HM.filter(n=>hmHtml.includes(n)).length});
T.state.domain = "3c";
T.renderTable();
const c3Html = String(els.tableBody?els.tableBody.innerHTML:"");
chk("3C 视图不出现鸿蒙智行的人", !HM.some(n=>c3Html.includes(">"+n+"<")));

const R3 = T.buildRules(T.curKey(), "3c"), RH = T.buildRules(T.curKey(), "hongmeng");
chk("buildRules 3c 只含 3C 人", Object.keys(R3).every(n=>!T.isHongmeng(n)) && Object.keys(R3).length===C3.length, Object.keys(R3).length);
chk("buildRules 鸿蒙只含鸿蒙人", Object.keys(RH).every(n=>T.isHongmeng(n)) && Object.keys(RH).length===HM.length, Object.keys(RH).length);
const RM = T.buildRules(T.curKey(), "manager");
chk("buildRules 经理域只含经理", Object.keys(RM).length===MG.length, Object.keys(RM).length);

/* 6. 表头需求输入框写进当前领域 */
T.state.domain = "hongmeng";
const before3c = JSON.stringify(S.needs);
T.setDayNeed(0, "early", 99);
chk("鸿蒙视图改需求 → 3C 需求不动", JSON.stringify(S.needs)===before3c);
chk("鸿蒙视图改需求 → 写进 needsHM", T.domNeeds("hongmeng")[0].early===99, T.domNeeds("hongmeng")[0]);
T.state.domain = "3c";
T.setDayNeed(0, "early", 8);
chk("3C 视图改需求 → 写进 needs", S.needs[0].early===8);

/* 7. 页签渲染 */
T.renderDomainTabs();
const tabs = String(els.domainTabs?els.domainTabs.innerHTML:"");
chk("页签含 3C顾问 / 鸿蒙智行 / 售后 / 经理", tabs.includes("3C顾问") && tabs.includes("鸿蒙智行") && tabs.includes("售后") && tabs.includes("经理"));
chk("售后视图只出现售后的人", AS.length>0 && AS.every(n=>T.inDomain(n,"aftersales")) && !MG.some(n=>T.inDomain(n,"aftersales")));
chk("页签显示当前领域为高亮", /class="domain-tab on" data-dom="3c"/.test(tabs));

console.log("\n汇总: "+(fails?fails+" 项失败":"全部通过"));
process.exit(fails?1:0);
