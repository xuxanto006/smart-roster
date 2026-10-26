/** 探针：把 autoSchedule 选优结束时的 bestBad / bestGap / planGroupViol(best) 抓出来，和最终班表对比 */
const fs = require("fs");
const vm = require("vm");
let html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
let src = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();

// 注入 1：记录本次实际跑了多少次候选
const a1 = "    const plan = tryPlan(slots, N, R);";
if(!src.includes(a1)){ console.error("注入锚点 1 没找到"); process.exit(1); }
src = src.replace(a1, a1 + "\n    globalThis.__ATT = attempt + 1;");
// 注入 2：写入 state.schedule 之前把 best 的状态记下来（限定在 autoSchedule 内的那处）
const anchor = "  fillGaps(w, RByName, false);\n  state.schedule[k] = w;";
if(!src.includes(anchor)){ console.error("注入锚点 2 没找到"); process.exit(1); }
src = src.replace(anchor, anchor.replace("  state.schedule[k] = w;",
  `  globalThis.__LAST = {attempt: globalThis.__ATT, bad: bestBad, gap: bestGap,
    gv: planGroupViol(best), ir: planIsoRest(best), scores: planScore(best)};\n  state.schedule[k] = w;`));

const scriptSrc = src + `
;
globalThis.__T = { state:()=>state, autoSchedule, curKey, DEFAULT_STAFF, planGroupViol, groupMembers };
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

const DAY=["周一","周二","周三","周四","周五","周六","周日"];
function finalGV(week){
  const out=[];
  const enM=T.groupMembers("earlyNight"), en=st.groups.earlyNight;
  if(enM.length&&en) for(let d=0;d<7;d++){
    const e=enM.filter(n=>week[n]&&week[n][d]==="early").length;
    const g=enM.filter(n=>week[n]&&week[n][d]==="night").length;
    if(e<(en.minEarly||0)) out.push(`早${DAY[d]} 需${en.minEarly}实${e}`);
    if(g<(en.minNight||0)) out.push(`晚${DAY[d]} 需${en.minNight}实${g}`);
  }
  return out;
}
function dupCheck(){
  const seen={},dup=[];
  st.staff.forEach(n=>{ if(seen[n]) dup.push(n); seen[n]=1; });
  return dup;
}
console.log("重名检查：", dupCheck().length ? dupCheck().join("、") : "无");
console.log("早晚保障组：", T.groupMembers("earlyNight").join("、"));
console.log("");

const TRIALS = +(process.argv[2]||30);
let bad=0;
for(let t=0;t<TRIALS;t++){
  vm.runInContext("autoSchedule();",sandbox);
  const last = ctx.__LAST;
  const week = st.schedule[T.curKey()];
  const fv = finalGV(week);
  if(fv.length){
    bad++;
    console.log(`[第 ${t+1} 次] 最终违规：${fv.join("；")}`);
    console.log(`   best: attempt=${last.attempt} bestGap=${last.gap} bestBad=${last.bad} planGroupViol(best)=${last.gv} planIsoRest(best)=${last.ir}`);
    const gvNow = T.planGroupViol({assign: st.staff.map(n=>{
      const a=[]; for(let d=0;d<7;d++){ const v=week[n][d]; if(v!=="rest"&&v!=="") a.push({day:d,shift:v}); }
      return a;
    })});
    console.log(`   用最终班表重算 planGroupViol = ${gvNow}（应与上面 best 的 gv 一致）`);
  }
}
console.log(`\n${TRIALS} 次里 ${bad} 次最终带病`);
