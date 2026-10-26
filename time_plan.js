/** 量一下 tryPlan / autoSchedule 各自耗时，决定「分组保障没达标时加跑候选」能给多少预算 */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1] + `
;
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF, tryPlan, planScore,
  planGroupViol, planIsoRest, buildRules, renderAll, groupMembers };
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
const st=T.state();

// ---- 1. tryPlan 单次耗时 + 达标率 ----
const S=["early","mid","night"];
const slots=[];
st.needs.forEach((d,di)=>{S.forEach(sh=>{for(let i=0;i<(+d[sh]||0);i++)slots.push({day:di,shift:sh});});});
const N=st.staff.length;
let extra=N*5-slots.length;
while(extra>0){ slots.push({day:0,shift:"night"}); extra--; }   // 粗略补足，只为计时
const R=st.staff.map(n=>T.buildRules(T.curKey())[n]);

let t0=Date.now(), ok=0, n=200;
for(let i=0;i<n;i++){
  const p=T.tryPlan(slots,N,R);
  if(p && T.planGroupViol(p)===0 && T.planIsoRest(p)===0) ok++;
}
const per=(Date.now()-t0)/n;
console.log(`tryPlan 单次平均 ${per.toFixed(1)} ms ｜ ${n} 次里「分组保障+上一休一」全达标 ${ok} 次（${(ok/n*100).toFixed(1)}%）`);
console.log(`→ 单次不达标概率约 ${((1-ok/n)*100).toFixed(1)}%，300 次全失败的理论概率约 ${Math.pow(1-ok/n,300).toExponential(2)}`);

// ---- 2. autoSchedule 整体耗时 ----
t0=Date.now();
for(let i=0;i<10;i++) vm.runInContext("autoSchedule();",sandbox);
console.log(`autoSchedule 单次平均 ${((Date.now()-t0)/10).toFixed(0)} ms（含 renderAll）`);

// ---- 3. renderAll 单独耗时 ----
t0=Date.now();
for(let i=0;i<20;i++) vm.runInContext("renderAll();",sandbox);
console.log(`renderAll 单次平均 ${((Date.now()-t0)/20).toFixed(1)} ms`);
