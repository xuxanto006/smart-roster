/**
 * 真实场景识别测试：用 31 人真实名单 + 微信/Excel/备忘录里常见的脏格式，
 * 验证「粘贴表格识别」在真实输入上的命中率。
 * test_paste.js 用的是假名（员工01…），覆盖不到长名被短名吃掉、顿号、多余空格等情况。
 */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html", "utf8");
const scriptSrc = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})() + `
;
globalThis.__T = { state:()=>state, DEFAULT_STAFF, parsePasteText, parsePasteLine, splitNames,
  parseDays, parseType, curKey, pushRequest, load, save, renderAll };
`;
function makeEl(){
  const h={}; return { _children:[],style:{},dataset:{},options:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){},removeAttribute(){},getAttribute(){return null},
    appendChild(){},addEventListener(e,f){h[e]=f;},querySelectorAll(){return[]},querySelector(){return null},
    get firstChild(){return null},get lastChild(){return null},
    set innerHTML(v){this._html=v;},get innerHTML(){return this._html||"";},
    set textContent(v){this._t=v;},get textContent(){return this._t||"";},
    set value(v){this._v=v;},get value(){return this._v||"";},
    get disabled(){return false},set disabled(v){},get title(){return ""},set title(v){},
    get className(){return ""},set className(v){},focus(){},select(){},blur(){},click(){},
    getBoundingClientRect(){return{width:0,height:0,left:0,top:0,bottom:0,right:0};},contains(){return false;} };
}
const els=new Map();
const document={getElementById(id){if(!els.has(id))els.set(id,makeEl());return els.get(id);},
  createElement(){return makeEl();},querySelector(){return makeEl();},querySelectorAll(){return[];},
  body:makeEl(),addEventListener(){},removeEventListener(){}};
let store={};
const localStorage={getItem(k){return store[k]||null;},setItem(k,v){store[k]=String(v);},
  removeItem(k){delete store[k];},clear(){store={};}};
const ctx={Math,Date,JSON,Array,Object,Number,String,Boolean,Set,Map,console,localStorage,document,
  setTimeout:()=>{},clearTimeout:()=>{},window:null,alert:()=>{},prompt:()=>null,confirm:()=>true,
  performance:{now:()=>Date.now()}};
ctx.window=ctx; ctx.globalThis=ctx;
const sandbox=vm.createContext(ctx);
vm.runInContext(scriptSrc,sandbox,{filename:"app.js"});
const T=ctx.__T;
store={"shiftScheduler_v2":JSON.stringify({staff:T.DEFAULT_STAFF.slice(),needsV:3,needs:null,
  limits:{early:3,night:4,mid:99},requests:[],schedule:{},roles:{}})};
vm.runInContext("load(); state.staff = DEFAULT_STAFF.slice();",sandbox);

const DAY=["周一","周二","周三","周四","周五","周六","周日"];
const TYPE={off:"请假",work:"必须上班",early:"固定早班",mid:"固定中班",night:"固定晚班",
            noearly:"不上早班",nomid:"不上中班",nonight:"不上晚班"};
let pass=0, fail=0;
const fails=[];

/* 期望：[姓名, 星期索引(或数组), 类型] */
function check(label, text, expect){
  const rows = T.parsePasteText(text);
  const got = rows.map(r=> `${r.name}|${r.day}|${r.type}`).sort();
  const want = [];
  expect.forEach(([n, d, t])=>{
    (Array.isArray(d) ? d : [d]).forEach(x=> want.push(`${n}|${x}|${t}`));
  });
  want.sort();
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(ok) pass++;
  else { fail++; fails.push({label, want, got}); }
  return ok;
}

console.log("\n========== 真实名单 · 粘贴识别测试 ==========\n");

/* 1. 微信群里的请假接龙（一人一行，空格分隔，顺序随意） */
check("微信群接龙", [
  "何广友 周三 请假",
  "邓臻蓝 周六 请假",
  "孙勇 周日 休息",
  "王鹏俊 周一 有事",
].join("\n"), [["何广友",2,"off"],["邓臻蓝",5,"off"],["孙勇",6,"off"],["王鹏俊",0,"off"]]);

/* 2. 从 Excel 复制（Tab 分隔，带表头） */
check("Excel 带表头", [
  "姓名\t星期\t事项",
  "陈悦娴\t周二\t不上晚班",
  "高超\t周五\t固定早班",
  "吴心然\t周六至周日\t请假",
  "刘舒晨\t周四\t不休息",
].join("\n"), [["陈悦娴",1,"nonight"],["高超",4,"early"],["吴心然",[5,6],"off"],["刘舒晨",3,"work"]]);

/* 3. 顿号 / 逗号分隔的多人（长名优先：王鹏俊 不能被 王鹏 之类吃掉） */
check("一行多人（顿号）",
  "孙勇、王鹏俊、何广友  周二  不上早班",
  [["孙勇",1,"noearly"],["王鹏俊",1,"noearly"],["何广友",1,"noearly"]]);

/* 4. 逗号 + 多段星期 */
check("一行多人 + 多段日期",
  "李文轩，桑浩洋，黄雅情  周一、周三、周五  固定晚班",
  [["李文轩",[0,2,4],"night"],["桑浩洋",[0,2,4],"night"],["黄雅情",[0,2,4],"night"]]);

/* 5. 冒号 + 中文数字星期 + 长期 */
check("冒号 + 长期",
  "周林奥：每周三 不上中班 长期",
  [["周林奥",2,"nomid"]]);

/* 6. 顺序打乱：班次在人名前面 */
check("列顺序打乱",
  "晚班  郭嘉洪  周六",
  [["郭嘉洪",5,"night"]]);

/* 7. 中文数字区间 + 「到」 */
check("中文区间「到」",
  "王申澳 周一到周五 必须上班",
  [["王申澳",[0,1,2,3,4],"work"]]);

/* 8. 数字星期（Excel 里常见 1~5） */
check("数字星期区间",
  "高子健 1至5 固定早班",
  [["高子健",[0,1,2,3,4],"early"]]);

/* 9. 关键词：工作日 / 周末 / 全周 */
check("工作日 / 周末 / 全周", [
  "胡亚达 工作日 不上早班",
  "李秀珊 周末 不上晚班",
  "吴洋洋 全周 固定中班",
].join("\n"),
  [["胡亚达",[0,1,2,3,4],"noearly"],["李秀珊",[5,6],"nonight"],["吴洋洋",[0,1,2,3,4,5,6],"mid"]]);

/* 10. 开店 / 闭店 映射成早班 / 晚班 */
check("开店 / 闭店 术语",
  "冯楷 周六 开店\n张子柔 周日 闭店",
  [["冯楷",5,"early"],["张子柔",6,"night"]]);

/* 11. 单字星期「三」+ 多余空格 + 全角空格 */
check("单字星期 + 多余空格",
  "刘乔一　　三　　请假",
  [["刘乔一",2,"off"]]);

/* 12. 未登记的名字：仍产出一行（好在预览里手动改名），但字段不全 → 不可导入 */
check("陌生人保留为待补行",
  "张三丰 周一 请假\n程雨轩 周一 请假",
  [["",0,"off"],["程雨轩",0,"off"]]);

/* 13. 重复行去重（同一人同一天同一类型只留一条） */
check("重复行去重",
  "田方斌 周二 请假\n田方斌 周二 请假",
  [["田方斌",1,"off"]]);

/* 14. 一行里写了两个不同类型 → 各自配对 */
check("一行两种类型",
  "符名洋 周一 不上早班 周三 不上晚班",
  [["符名洋",0,"noearly"],["符名洋",2,"nonight"]]);

/* 15. 竖线分隔（从表格工具复制） */
check("竖线分隔",
  "谢佳委 | 周四 | 固定晚班",
  [["谢佳委",3,"night"]]);

/* 16. 只有人名：产出一行待补（姓名已填、星期/类型留空），不可导入 */
check("只有人名 → 待补行",
  "王娜娜",
  [["王娜娜",-1,""]]);

/* ---- 长名优先的关键回归：名单里同时存在会被前缀吃掉的组合 ---- */
/* 名单里有「刘科」「刘乔一」「刘舒晨」「刘思含」，以及「王鹏俊」「王申澳」「王娜娜」 */
check("长名优先：刘科 不吃掉 刘乔一",
  "刘科、刘乔一 周二 请假",
  [["刘科",1,"off"],["刘乔一",1,"off"]]);
check("长名优先：王申澳 / 王娜娜",
  "王申澳 周一 请假\n王娜娜 周一 请假",
  [["王申澳",0,"off"],["王娜娜",0,"off"]]);
check("长名优先：李敏 / 李文轩 / 李秀珊",
  "李敏、李文轩、李秀珊 周五 固定晚班",
  [["李敏",4,"night"],["李文轩",4,"night"],["李秀珊",4,"night"]]);

/* ---------- 输出 ---------- */
if(fail === 0){
  console.log(`  ✅ ${pass} 组真实输入全部正确识别\n`);
}else{
  console.log(`  ✅ ${pass} 组通过 ｜ ❌ ${fail} 组不符\n`);
  fails.forEach(f=>{
    console.log(`  【${f.label}】`);
    console.log(`      期望：${f.want.join("  ")}`);
    console.log(`      实际：${f.got.join("  ")}`);
  });
  console.log("");
}

/* ---------- 端到端：整段粘贴 → 只导入字段齐全的行 → 真的写进请假设置 ---------- */
vm.runInContext("state.requests = [];", sandbox);
const big = [
  "本周请假 / 特殊班次（复制自群）",
  "姓名\t星期\t事项",
  "何广友\t周三\t请假",
  "邓臻蓝\t周六\t不上晚班",
  "孙勇\t周日\t固定早班",
  "王鹏俊\t周一至周三\t不上早班",
  "陈悦娴、高超\t周五\t固定晚班",
  "吴心然\t周末\t必须上班",
  "刘舒晨\t全周\t不上中班 每周",
  "冯楷\t周六\t开店",
  "张子柔\t周日\t闭店",
  "门口保安老张\t周一\t请假",   // 未登记的人 → 应留在预览里，不导入
  "李敏",                      // 只有人名 → 应留在预览里，不导入
].join("\n");
const rows = T.parsePasteText(big);
// 与 applyPaste() 里完全一致的筛选条件
const importable = rows.filter(r=> r.on && r.name && r.day >= 0 && r.type);
const skipped = rows.length - importable.length;
const before = T.state().requests.length;
importable.forEach(r=> T.pushRequest(r.name, r.day, r.type, r.scope));
const after = T.state().requests.length;
console.log(`  端到端：识别 ${rows.length} 条 ｜ 可导入 ${importable.length} 条 ｜ 待人工补 ${skipped} 条`);
console.log(`  导入后请假设置 ${before} → ${after} 条`);
const e2eOK = (after === importable.length) && (skipped === 2);
console.log(e2eOK ? "  ✅ 条数一致，且两条不完整记录被正确拦下" : "  ❌ 端到端不符");
console.log("");
process.exit(fail === 0 && e2eOK ? 0 : 1);
