/* 导出 CSV：开店 / 闭店列 + 分工明细 + 图例休息天数 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
let CSV=null, clicked=0;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},
  createElement(){ const e=fakeEl("a"); e.click=()=>{clicked++;}; return e; }},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},
URL:{createObjectURL:()=> "blob:x", revokeObjectURL(){}},
Blob:function(parts){ CSV = parts.join(""); }};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,exportCSV,roleOf,curKey,ensureWeek,groupMembers,renderNeedsInfo,setRestMax};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,DAY=["周一","周二","周三","周四","周五","周六","周日"];

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

T.autoSchedule();
T.exportCSV(false);
expect(clicked===1, "触发了一次下载");
expect(!!CSV, "生成了 CSV 内容");

const lines = CSV.split("\n");
const head = lines[0];
console.log("\n  表头: " + head.slice(0,120));

expect(/^\uFEFF姓名,周一\(/.test(head), "表头以 BOM + 姓名,周一(日期) 开头", "实际前 12 字符="+JSON.stringify(head.slice(0,12)));
expect(/,开店数,闭店数,/.test(head), "表头含「开店数」「闭店数」两列");

// 明细行
const k=T.curKey(), week=T.ensureWeek(k), mem=T.groupMembers("openClose");
const nameCol = n => lines.find(l=> l.startsWith(n+","));
expect(!!nameCol(mem[0]), "存在开店闭店组成员的行");

// 单元格内联标记
const openCells  = (CSV.match(/早班\(开店\)/g)||[]).length;
const closeCells = (CSV.match(/晚班\(闭店\)/g)||[]).length;
expect(openCells===7,  "CSV 里 7 格标了「早班(开店)」", "实际="+openCells);
expect(closeCells===14, "CSV 里 14 格标了「晚班(闭店)」", "实际="+closeCells);

// 每行的 开店数/闭店数 与角色表一致
let colOK=true, colDetail=[];
mem.forEach(n=>{
  const line = nameCol(n);
  if(!line){ colOK=false; colDetail.push(n+" 缺行"); return; }
  const parts = line.split(",");
  // 列序：姓名,7天, 早,中,晚,休, 开店数,闭店数, 备注
  const ro = +parts[12], rc = +parts[13];
  let eo=0, ec=0;
  for(let d=0;d<7;d++){
    const rl=T.roleOf(k,n,d);
    if(rl==="open"  && week[n][d]==="early") eo++;
    if(rl==="close" && week[n][d]==="night") ec++;
  }
  if(ro!==eo || rc!==ec){ colOK=false; colDetail.push(`${n} 表内${eo}/${ec} vs CSV ${ro}/${rc}`); }
});
expect(colOK, "每行的开店数/闭店数与角色表一致", colDetail.join("；"));

console.log("\n— 分工明细段落 —");
const secIdx = lines.findIndex(l=> l.includes("【本周开店 / 闭店分工】"));
expect(secIdx>=0, "CSV 末尾含「本周开店 / 闭店分工」段落");
if(secIdx>=0){
  expect(lines[secIdx+1]==="姓名,星期,角色,时间段", "分工段落表头正确", lines[secIdx+1]);
  const roleLines = lines.slice(secIdx+2).filter(l=> l.trim());
  expect(roleLines.length===21, "分工明细共 21 行（7 开店 + 14 闭店）", "实际="+roleLines.length);
  const opens  = roleLines.filter(l=> l.includes(",开店,")).length;
  const closes = roleLines.filter(l=> l.includes(",闭店,")).length;
  expect(opens===7 && closes===14, "分工明细里 7 开店 / 14 闭店", `开${opens} 闭${closes}`);
  expect(roleLines.every(l=> /09:00–18:00|14:00–23:30/.test(l)), "每行都带时间段");
  // 按星期排序
  const order = roleLines.map(l=> DAY.indexOf(l.split(",")[1]));
  const sorted = order.every((v,i)=> i===0 || order[i-1]<=v);
  expect(sorted, "分工明细按周一到周日排序", JSON.stringify(order));
  console.log("  前 4 行: " + roleLines.slice(0,4).join(" ｜ "));
}

console.log("\n— 导出不会反向改动数据 —");
const before = JSON.stringify(S.roles);
T.exportCSV(false);
expect(JSON.stringify(S.roles)===before, "连续导出两次，角色数据不变");

console.log("\n— 图例休息天数跟配置走 —");
T.renderNeedsInfo();
expect(sandbox.document.getElementById("legendRest").textContent===`恰好休 ${S.restMax.per} 天`, "图例显示当前休息天数",
        "实际="+sandbox.document.getElementById("legendRest").textContent);
sandbox.document.getElementById("restPer").value="3";
T.setRestMax();
T.renderNeedsInfo();
expect(sandbox.document.getElementById("legendRest").textContent==="恰好休 3 天", "改成 3 天后图例同步",
        "实际="+sandbox.document.getElementById("legendRest").textContent);
sandbox.document.getElementById("restPer").value="2";
T.setRestMax(); T.renderNeedsInfo();

console.log(`\n===== 导出测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
