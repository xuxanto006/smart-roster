/**
 * 粘贴表格识别 —— 解析器测试
 * 覆盖：Tab 分隔(Excel)、逗号、多空格、多人一行、星期范围、工作日/周末/全周、
 *       「不上X班」优先于「X班」、每周固定、表头跳过、字段缺失留空、去重组、导入落库
 */
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html", "utf8");
const scriptSrc = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})() + `
;
globalThis.__T = { state:()=>state, parsePasteText, parseDays, parseType, splitNames, parsePasteLine,
  pushRequest, curKey, DEFAULT_STAFF, TYPE_LABEL, DAY_NAMES, activeRequests, conflictTypes,
  renderPastePreview, parsePaste, clearPaste, togglePaste, applyPaste, pvSet, pvToggleAll,
  addRequest, renderAll, save };
`;

function makeEl(){
  const h = {};
  return {
    _children:[], style:{}, dataset:{}, options:[], className:"", checked:false,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){}, removeAttribute(){}, getAttribute(){return null},
    appendChild(){}, remove(){}, addEventListener(e,f){h[e]=f;},
    querySelectorAll(){return []}, querySelector(){return null},
    get firstChild(){return null}, get lastChild(){return null},
    set innerHTML(v){this._html=v;}, get innerHTML(){return this._html||"";},
    set textContent(v){this._t=v;}, get textContent(){return this._t||"";},
    set value(v){this._v=v;}, get value(){return this._v||"";},
    get disabled(){return false}, set disabled(v){}, get title(){return ""}, set title(v){},
    focus(){}, select(){}, blur(){}, click(){},
    getBoundingClientRect(){return{width:0,height:0,left:0,top:0,bottom:0,right:0};}, contains(){return false;}
  };
}
const els = new Map();
const document = {
  getElementById(id){ if(!els.has(id)) els.set(id, makeEl()); return els.get(id); },
  createElement(){ return makeEl(); }, querySelector(){ return makeEl(); },
  querySelectorAll(){ return []; }, body: makeEl(), addEventListener(){}, removeEventListener(){}
};
let store = {};
const localStorage = {
  getItem(k){ return store[k]||null; }, setItem(k,v){ store[k]=String(v); },
  removeItem(k){ delete store[k]; }, clear(){ store={}; }
};
const ctx = { Math, Date, JSON, Array, Object, Number, String, Boolean, Set, Map, console,
  localStorage, document, setTimeout:(f)=>{ if(typeof f==="function") f(); return 0; }, clearTimeout:()=>{},
  window:null, alert:()=>{}, prompt:()=>null, confirm:()=>true, performance:{now:()=>Date.now()} };
ctx.window = ctx; ctx.globalThis = ctx;
const sandbox = vm.createContext(ctx);
vm.runInContext(scriptSrc, sandbox, {filename:"app.js"});
const T = ctx.__T;

store = { "shiftScheduler_v2": JSON.stringify({
  staff: T.DEFAULT_STAFF.slice(), needsV:3, needs:null,
  limits:{early:3,night:4,mid:99}, requests:[], schedule:{}, roles:{}
})};
vm.runInContext("load(); state.staff = DEFAULT_STAFF.slice();", sandbox);
const st = T.state();

let pass = 0, fail = 0;
function expect(cond, msg){
  if(cond){ pass++; }
  else { fail++; console.log("  ❌ " + msg); }
}
function eq(a, b, msg){ expect(a === b, `${msg}（期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}）`); }

const NAMES = st.staff;
const N = (i) => NAMES[i];
console.log("在册人数：", NAMES.length, "｜前 3 人：", NAMES.slice(0,3).join("、"));

/* ---------- 1. parseDays ---------- */
console.log("\n【一】星期识别");
eq(T.parseDays("周一").join(), "0", "周一 → 0");
eq(T.parseDays("星期三").join(), "2", "星期三 → 2");
eq(T.parseDays("礼拜五").join(), "4", "礼拜五 → 4");
eq(T.parseDays("周天").join(), "6", "周天 → 6");
eq(T.parseDays("周一至周五").join(), "0,1,2,3,4", "周一至周五");
eq(T.parseDays("周一到周五").join(), "0,1,2,3,4", "周一到周五");
eq(T.parseDays("周六~周日").join(), "5,6", "周六~周日");
eq(T.parseDays("周一-周三").join(), "0,1,2", "周一-周三");
eq(T.parseDays("1至5").join(), "0,1,2,3,4", "1至5");
eq(T.parseDays("工作日").join(), "0,1,2,3,4", "工作日");
eq(T.parseDays("周末").join(), "5,6", "周末");
eq(T.parseDays("全周").join(), "0,1,2,3,4,5,6", "全周");
eq(T.parseDays("每天").join(), "0,1,2,3,4,5,6", "每天");
eq(T.parseDays("周一、周三").join(), "0,2", "顿号分隔");
eq(T.parseDays("三").join(), "2", "单独一个「三」");
eq(T.parseDays("").join(), "", "空串");
eq(T.parseDays("请假").join(), "", "「请假」里不该有星期");

/* ---------- 2. parseType ---------- */
console.log("【二】类型识别");
eq(T.parseType("请假"), "off", "请假 → off");
eq(T.parseType("休假"), "off", "休假 → off");
eq(T.parseType("调休"), "off", "调休 → off");
eq(T.parseType("休息"), "off", "休息 → off");
eq(T.parseType("有事"), "off", "有事 → off");
eq(T.parseType("必须上班"), "work", "必须上班 → work");
eq(T.parseType("不休息"), "work", "不休息 → work（不能误判成请假）");
eq(T.parseType("不排休"), "work", "不排休 → work");
eq(T.parseType("不上早班"), "noearly", "不上早班 → noearly");
eq(T.parseType("不排晚班"), "nonight", "不排晚班 → nonight");
eq(T.parseType("避开中班"), "nomid", "避开中班 → nomid");
eq(T.parseType("早班"), "early", "早班 → early");
eq(T.parseType("固定中班"), "mid", "固定中班 → mid");
eq(T.parseType("晚班"), "night", "晚班 → night");
eq(T.parseType("开店"), "early", "开店 → early");
eq(T.parseType("闭店"), "night", "闭店 → night");
eq(T.parseType("张三"), null, "人名不该被当成类型");
eq(T.parseType("周一"), null, "星期不该被当成类型");

/* ---------- 3. splitNames ---------- */
console.log("【三】人名识别");
const s1 = T.splitNames(N(0) + " 周一 请假");
eq(s1.names.join(), N(0), "名字被认出");
eq(s1.rest.replace(/\s|　/g,""), "周一请假", "剩余文本保留");
const s2 = T.splitNames(N(0) + "、" + N(1) + " 周三");
eq(s2.names.join(), [N(0), N(1)].join(), "一行多人");
const s3 = T.splitNames("不认识的人 周一 请假");
eq(s3.names.length, 0, "陌生人认不出");

/* ---------- 4. 整行 / 整段 ---------- */
console.log("【四】整行解析");
const L1 = T.parsePasteLine(N(0) + "\t周一\t请假");
eq(L1.names.join(), N(0), "Tab 分隔：名字");
eq(L1.pairs.length, 1, "Tab 分隔：1 组");
eq(L1.pairs[0].type, "off", "Tab 分隔：类型");
eq(L1.pairs[0].days.join(), "0", "Tab 分隔：星期");

const L2 = T.parsePasteLine(N(0) + "，" + N(1) + " 周三 不上晚班");
eq(L2.names.join(), [N(0), N(1)].join(), "逗号分隔 + 多人");
eq(L2.pairs[0].type, "nonight", "不上晚班");
eq(L2.pairs[0].days.join(), "2", "周三");

const L3 = T.parsePasteLine(N(2) + "：周一请假，周三不上晚班");
eq(L3.names.join(), N(2), "冒号 + 顿号分隔的多段：名字");
eq(L3.pairs.length, 2, "一行两种类型 → 2 组");
eq(L3.pairs[0].type, "off", "第一段：请假");
eq(L3.pairs[0].days.join(), "0", "第一段：周一");
eq(L3.pairs[1].type, "nonight", "第二段：不上晚班");
eq(L3.pairs[1].days.join(), "2", "第二段：周三");

const L4 = T.parsePasteLine(N(3) + "  周六至周日  固定早班 每周");
eq(L4.pairs[0].days.join(), "5,6", "多空格分隔 + 周六至周日");
eq(L4.pairs[0].type, "early", "固定早班");

const L5 = T.parsePasteLine("周一 早班");
eq(L5.names.length, 0, "没有名字 → 留空待补");
eq(L5.pairs[0].days.join(), "0", "仍能认出星期");

/* ---------- 5. parsePasteText ---------- */
console.log("【五】整段解析");
const txt = [
  "姓名\t星期\t类型",
  N(0)+"\t周一\t请假",
  N(1)+"、"+N(2)+"\t周三\t不上晚班",
  N(3)+"\t周六至周日\t固定早班 每周",
  N(4)+"\t全周\t不上早班",
  "",
  "  "
].join("\n");
const rows = T.parsePasteText(txt);
eq(rows.length, 1+2+2+7, `表头被跳过、空行被忽略，共 12 条（实际 ${rows.length}）`);
eq(rows.filter(r=>r.raw.indexOf("姓名")>=0).length, 0, "表头行没进结果");
eq(rows.filter(r=>r.scope==="always").length, 2, "「每周」→ 每周固定（2 条）");
eq(rows.filter(r=>r.day===5||r.day===6).length, 4, "周六周日 2 条 + 全周展开里落到周六/周日的 2 条");
eq(rows.filter(r=>!r.name).length, 0, "全部认出了名字");
eq(rows.filter(r=>r.day<0).length, 0, "全部认出了星期");
eq(rows.filter(r=>!r.type).length, 0, "全部认出了类型");

// 去重
const dupTxt = (N(0)+"\t周一\t请假\n").repeat(3);
eq(T.parsePasteText(dupTxt).length, 1, "重复行自动去重");

// 字段缺失 → 留空
const missTxt = "周一 请假\n" + N(5) + " 周三\n" + N(6) + " 中班";
const mr = T.parsePasteText(missTxt);
eq(mr.length, 3, "3 行各 1 条");
eq(mr.filter(r=>!r.name).length, 1, "第 1 行缺名字");
eq(mr.filter(r=>r.day<0).length, 1, "第 2 行缺星期");
eq(mr.filter(r=>!r.type).length, 1, "第 3 行缺类型（名字里的字被误判？见下）");

/* ---------- 6. 导入落库 ---------- */
console.log("【六】导入");
st.requests = [];
const imp = T.parsePasteText(N(0)+"\t周一\t请假\n"+N(1)+"\t周三\t不上晚班");
imp.forEach(r=> T.pushRequest(r.name, r.day, r.type, r.scope));
eq(st.requests.length, 2, "导入 2 条");
eq(st.requests[0].name, N(0), "第 1 条姓名");
eq(st.requests[0].day, 0, "第 1 条星期");
eq(st.requests[0].type, "off", "第 1 条类型");
eq(st.requests[0].scope, "once", "第 1 条范围");
eq(T.activeRequests(T.curKey()).length, 2, "本周生效 2 条");

// 重复 → 升级为每周固定
const r2 = T.pushRequest(N(0), 0, "off", "always");
eq(r2.status, "dup", "重复 → dup");
eq(st.requests.find(x=>x.name===N(0)&&x.day===0).scope, "always", "重复时升级为每周固定");
eq(st.requests.length, 2, "重复不新增记录");

// 互斥替换
st.requests = [];
T.pushRequest(N(0), 0, "early", "once");
const r3 = T.pushRequest(N(0), 0, "night", "once");   // 固定早班 vs 固定晚班 互斥
eq(r3.status, "added", "互斥类型：新增成功");
expect(r3.replaced >= 1, `互斥类型：替换了 ${r3.replaced} 条`);
eq(st.requests.length, 1, "互斥后只剩 1 条");

// 「不上早班」和「固定早班」互斥
st.requests = [];
T.pushRequest(N(1), 2, "noearly", "once");
const r4 = T.pushRequest(N(1), 2, "early", "once");
expect(r4.replaced >= 1, `不上早班 与 固定早班 互斥（替换 ${r4.replaced} 条）`);

/* ---------- 7. UI 流程不抛错 ---------- */
console.log("【七】UI 流程");
st.requests = [];
const el = document.getElementById("pasteInput");
el.value = N(0)+"\t周一\t请假\n"+N(1)+"、"+N(2)+"\t周三\t不上晚班\n不认识的人\t周五\t请假";
try{
  T.parsePaste();
  T.renderPastePreview();
  T.pvToggleAll(true);
  T.pvSet(0, "name", N(4));
  T.pvSet(0, "day", "4");
  T.pvSet(0, "type", "off");
  T.applyPaste();
  pass++;
}catch(e){ fail++; console.log("  ❌ UI 流程抛异常：" + e.message); }
eq(st.requests.length, 3, "导入后落库 3 条（含手动补好的那 1 条）");
eq(el.value, "", "导入后输入框已清空");
try{ T.clearPaste(); T.togglePaste(); T.togglePaste(); T.renderAll(); pass++; }
catch(e){ fail++; console.log("  ❌ 收尾流程抛异常：" + e.message); }

/* ---------- 8. 原有 addRequest 行为未变 ---------- */
console.log("【八】原有「添加安排」未被改坏");
st.requests = [];
const rs = document.getElementById("reqStaff"), rd = document.getElementById("reqDay"),
      rt = document.getElementById("reqType"), rc = document.getElementById("reqScope");
rs.value = N(7); rd.value = "3"; rt.value = "off"; rc.value = "once";
T.addRequest();
eq(st.requests.length, 1, "单条添加成功");
eq(st.requests[0].name + "|" + st.requests[0].day + "|" + st.requests[0].type, N(7)+"|3|off", "字段正确");
rs.value = "__ALL__"; rd.value = "5"; rt.value = "nonight"; rc.value = "always";
T.addRequest();
eq(st.requests.length, 1 + NAMES.length, "（全员）扇形展开");
eq(st.requests.filter(r=>r.scope==="always").length, NAMES.length, "全员都是每周固定");

console.log("\n" + "-".repeat(60));
console.log(`粘贴识别测试：${pass} 通过 / ${fail} 失败`);
console.log("-".repeat(60));
process.exit(fail ? 1 : 0);
