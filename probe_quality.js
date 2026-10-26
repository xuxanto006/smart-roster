/** 排班质量体检：提前退出越早越快，但没机会在多个合格方案里挑最均衡的。量化这个代价。 */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})() + `
;
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF, planScore,
  groupMembers, isolatedRestCount, hasEarlyRun3 };
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

const RUNS = +(process.argv[2] || 20);
const sd = arr=>{ const m=arr.reduce((a,b)=>a+b,0)/arr.length;
  return Math.sqrt(arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length); };

const acc = {earlySd:[], nightSd:[], midSd:[], restAdj:[], workSd:[], roleMax:[], roleSpread:[], ms:[]};
for(let t=0; t<RUNS; t++){
  const t0 = Date.now();
  T.autoSchedule();
  acc.ms.push(Date.now()-t0);
  const st = T.state();
  const week = st.schedule[T.curKey()];
  const names = st.staff;
  const cnt = n=>{ const c={early:0,mid:0,night:0}; week[n].forEach(v=>{ if(c[v]!==undefined) c[v]++; }); return c; };
  const work = n=> week[n].filter(v=> v!=="" && v!=="rest").length;
  acc.earlySd.push(sd(names.map(n=> cnt(n).early)));
  acc.nightSd.push(sd(names.map(n=> cnt(n).night)));
  acc.midSd.push(sd(names.map(n=> cnt(n).mid)));
  acc.workSd.push(sd(names.map(work)));
  // 连休（相邻休息日）对数：软偏好，越少越分散
  let adj = 0;
  names.forEach(n=>{ for(let d=0; d<7; d++) if(week[n][d]==="rest" && week[n][(d+1)%7]==="rest") adj++; });
  acc.restAdj.push(adj);
  // 开店闭店分工：最大值 / 极差
  const roles = st.roles[T.curKey()] || {};
  const ocM = T.groupMembers("openClose");
  const rc = ocM.map(n=> (roles[n]||[]).filter(v=>v).length);
  acc.roleMax.push(Math.max(...rc, 0));
  acc.roleSpread.push(Math.max(...rc,0) - Math.min(...rc, rc.length?0:0));
}
const avg = a=> a.reduce((x,y)=>x+y,0)/a.length;
const f = (v,n=2)=> v.toFixed(n);
console.log(`\n跑 ${RUNS} 次排班的均衡度（越小越均衡）：\n`);
console.log(`  早班次数标准差   ${f(avg(acc.earlySd))}`);
console.log(`  中班次数标准差   ${f(avg(acc.midSd))}`);
console.log(`  晚班次数标准差   ${f(avg(acc.nightSd))}`);
console.log(`  上班天数标准差   ${f(avg(acc.workSd))}`);
console.log(`  连休（相邻休息） ${f(avg(acc.restAdj),1)} 对 / 周`);
console.log(`  开店闭店 最多    ${f(avg(acc.roleMax),1)} 次/人（上限 3）`);
console.log(`  开店闭店 极差    ${f(avg(acc.roleSpread),1)} 次`);
console.log(`  单次排班耗时     ${f(avg(acc.ms),0)} ms（最大 ${Math.max(...acc.ms)} ms）\n`);
