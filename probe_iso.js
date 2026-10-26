/** 定位「上一休一」是在哪一步被引入的：tryPlan 选中 → fillGaps → absorbSurplus */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");

let src = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();

// 在 autoSchedule 里三个节点插桩：w 定型前（best 刚写入）、fillGaps 后、absorbSurplus 后
const anchor = [
  "  fillGaps(w, RByName, false);",
  "  // 补满勤：把没排掉的富余人力吸收进中班 / 晚班，保证每人恰好休 restPer 天",
].join("\n");
if(!src.includes(anchor)) throw new Error("锚点没找到，脚本结构可能变了");

src = src.replace(anchor, [
  "  { const s = isoTotal(w); globalThis.__ISO.push({step:'tryPlan(best)', iso:s}); }",
  "  fillGaps(w, RByName, false);",
  "  { const s = isoTotal(w); globalThis.__ISO.push({step:'after fillGaps', iso:s}); }",
  anchor.split("\n")[1],
  "  absorbSurplus(w, RByName);",
  "  { const s = isoTotal(w); globalThis.__ISO.push({step:'after absorb', iso:s}); }",
].join("\n"));

src += `
;
function isoTotal(w){
  let c = 0;
  state.staff.forEach(n=>{ c += isolatedRestCount(restSetOfWeek(w, n)); });
  return c;
}
globalThis.__ISO = [];
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF, isoTotal, planIsoRest };
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
vm.runInContext(src,sandbox,{filename:"app.js"});
const T=ctx.__T;
store={"shiftScheduler_v2":JSON.stringify({staff:T.DEFAULT_STAFF.slice(),needsV:3,needs:null,
  limits:{early:3,night:4,mid:99},requests:[],schedule:{},roles:{}})};
vm.runInContext("load(); state.staff = DEFAULT_STAFF.slice();",sandbox);

const RUNS = +(process.argv[2] || 40);
const tally = {};   // step -> 出现次数 / 引入次数 / 消除次数
let badRuns = [];
for(let t=0; t<RUNS; t++){
  ctx.__ISO.length = 0;
  T.autoSchedule();
  const seq = ctx.__ISO.slice();
  if(!seq.length) throw new Error("没有插桩数据");
  const finalIso = seq[seq.length-1].iso;
  let prev = 0, firstBadStep = null;
  seq.forEach(x=>{
    const d = x.iso - prev;
    const k = x.step;
    tally[k] = tally[k] || {up:0, down:0, same:0};
    if(d > 0){ tally[k].up += d; if(firstBadStep===null) firstBadStep = k; }
    else if(d < 0) tally[k].down += -d;
    else tally[k].same++;
    prev = x.iso;
  });
  if(finalIso > 0) badRuns.push({t:t+1, seq: seq.map(x=>`${x.step}=${x.iso}`).join(" → "), firstBadStep});
}

console.log(`\n跑 ${RUNS} 次排班，统计孤立休息日（上一休一）的增减来源：\n`);
Object.keys(tally).forEach(k=>{
  const v = tally[k];
  console.log(`  ${k.padEnd(18)} 新增合计 ${String(v.up).padStart(3)} ｜ 消除合计 ${String(v.down).padStart(3)} ｜ 无变化 ${v.same} 次`);
});
console.log(`\n最终仍有「上一休一」的排班：${badRuns.length} / ${RUNS}`);
badRuns.slice(0,8).forEach(b=>{
  console.log(`  第 ${b.t} 次：${b.seq}   ← 首次引入于 ${b.firstBadStep}`);
});
