/** 用真实 autoSchedule 路径，统计「多少次候选才出现第一个全达标方案」 */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})() + `
;
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF, planGroupViol, planIsoRest };
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

// 包一层 tryPlan：记录每次候选的「分组违约 / 上一休一 / 少上班天数 / 旧口径缺口」
const orig = ctx.tryPlan;
let log = [];
const st0 = T.state();
const workTarget = 7 - ((st0.restMax && st0.restMax.per) || 2);
ctx.tryPlan = function(slots, N, R){
  const p = orig(slots, N, R);
  if(p){
    const covered = p.assign.reduce((s,a)=> s + a.length, 0);
    const shortNow = p.assign.reduce((s,a)=> s + Math.max(0, workTarget - a.length), 0);
    log.push({g:T.planGroupViol(p), i:T.planIsoRest(p), short:shortNow,
              oldGap: Math.max(0, (p.slots?p.slots.length:0) - covered), covered});
  }
  return p;
};

const RUNS = +(process.argv[2] || 12);
const firstClean = [], cleanRate = [], shortRate = [], oldGapRate = [];
for(let t=0; t<RUNS; t++){
  log = [];
  const t0 = Date.now();
  vm.runInContext("autoSchedule();", sandbox);
  const dt = Date.now() - t0;
  const total = log.length;
  const clean = log.filter(x=> x.g===0 && x.i===0).length;
  const gOK   = log.filter(x=> x.g===0).length;
  const sOK   = log.filter(x=> x.short===0).length;
  const oOK   = log.filter(x=> x.oldGap===0).length;
  let first = log.findIndex(x=> x.g===0 && x.i===0);
  cleanRate.push(clean/total); shortRate.push(sOK/total); oldGapRate.push(oOK/total);
  firstClean.push(first < 0 ? -1 : first + 1);
  // shortNow 分布直方图
  const hist = {};
  log.forEach(x=>{ hist[x.short] = (hist[x.short]||0) + 1; });
  const histStr = Object.keys(hist).sort((a,b)=>a-b).map(k=>`${k}天:${hist[k]}`).join(" ");
  console.log(`          shortNow 分布 → ${histStr}`);
  console.log(`第 ${String(t+1).padStart(2)} 次：候选 ${String(total).padStart(3)} ｜ 分组达标 ${(gOK/total*100).toFixed(0)}% ｜ 全达标 ${(clean/total*100).toFixed(0)}% ｜ 全员上满 ${(sOK/total*100).toFixed(0)}% ｜ 旧口径缺口=0 占 ${(oOK/total*100).toFixed(0)}% ｜ ${dt}ms`);
}
const avg = a => a.reduce((s,x)=>s+x,0)/a.length;
console.log("");
console.log(`平均单次候选：全达标 ${(avg(cleanRate)*100).toFixed(1)}% ｜ 全员上满 ${workTarget} 天 ${(avg(shortRate)*100).toFixed(1)}% ｜ 旧口径(155槽位全填满) ${(avg(oldGapRate)*100).toFixed(1)}%`);
const neverClean = firstClean.filter(x=>x<0).length;
console.log(`            ${RUNS} 次排班里，有 ${neverClean} 次跑满候选都没找到全达标方案`);
