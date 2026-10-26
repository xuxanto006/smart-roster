/** 早班上限收紧到 2：先算清楚「数学上到底可不可行」，再决定是不是算法问题 */
const fs=require("fs"), vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const src=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})()+`
;globalThis.__T={state:()=>state, DEFAULT_STAFF, groupMembers, buildSlots: (typeof buildSlots!=="undefined"?buildSlots:null)};`;
function makeEl(){const h={};return{_children:[],style:{},dataset:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},removeAttribute(){},getAttribute(){return null},appendChild(){},addEventListener(e,f){h[e]=f},querySelectorAll(){return[]},querySelector(){return null},get firstChild(){return null},get lastChild(){return null},set innerHTML(v){this._html=v},get innerHTML(){return this._html||""},set textContent(v){this._text=v},get textContent(){return this._text||""},set value(v){this._value=v},get value(){return this._value||""},get disabled(){return false},set disabled(v){},get title(){return ""},set title(v){},get className(){return ""},set className(v){},focus(){},select(){},blur(){},click(){},remove(){},insertAdjacentHTML(){},closest(){return null},get parentNode(){return null},scrollIntoView(){}};}
const doc={getElementById:()=>makeEl(),querySelector:()=>makeEl(),querySelectorAll:()=>[],createElement:()=>makeEl(),addEventListener(){},body:makeEl()};
const store={};
const ctx={document:doc,window:{addEventListener(){}},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},performance:{now:()=>Date.now()},alert(){},prompt:()=>null,confirm:()=>true,console,navigator:{clipboard:{writeText:()=>Promise.resolve()}},Date,Math,JSON,setTimeout,URL:{createObjectURL:()=>"blob:x",revokeObjectURL(){}},Blob:function(){},globalThis:null};
ctx.globalThis=ctx; ctx.window=ctx;
vm.createContext(ctx); vm.runInContext(src,ctx);
const T=ctx.__T, st=T.state();

// 复原默认需求配置
function reset(){
  st.staff=T.DEFAULT_STAFF.slice();
  st.requests=[]; st.schedule={}; st.roles={};
  st.restMax={per:2,total:0}; st.exactShifts=["early"]; st.weekendEarlyMax=1;
}
reset();

// 读取默认 needs
console.log("needs =", JSON.stringify(st.needs));
console.log("limits =", JSON.stringify(st.limits));
console.log("groups =", JSON.stringify(st.groups));

// 计算早班总需求
const need = st.needs;
let earlyDemand=0, perDay=[];
for(let d=0; d<7; d++){
  const e = (need.early && need.early[d]) || 0;
  perDay.push(e); earlyDemand += e;
}
console.log("\n每天早班需求：", perDay.join(" / "), "→ 合计", earlyDemand);
const N=st.staff.length;
for(const cap of [3,2]){
  console.log(`\n早班每人每周上限 ${cap} → 全队早班产能 ${N}×${cap} = ${N*cap}`);
  console.log(`  需求 ${earlyDemand} ｜ 余量 ${N*cap-earlyDemand}`);
}

// 开店闭店组 & 早晚保障组 的刚性占用
const gm = T.groupMembers;
console.log("\n分组：", JSON.stringify(st.groups, null, 1));
const oc = (st.groups&&st.groups.openClose)||{};
const en = (st.groups&&st.groups.earlyNight)||{};
console.log("开店闭店组人数 =", (oc.members||[]).length, "｜每天开店", oc.open, "闭店", oc.close);
console.log("早晚保障组人数 =", (en.members||[]).length, "｜每天至少早", en.minEarly, "晚", en.minNight);
