/** 定位「有人休 3 天」是从哪一步冒出来的 */
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync(process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})() + `
;
globalThis.__T = { state:()=>state, autoSchedule, tryPlan, planScore, curKey, DEFAULT_STAFF,
  groupMembers, isolatedRestCount, buildRules, shuffle };
`;

function makeEl(){
  const handlers = {};
  return {
    _children:[], style:{}, dataset:{}, options:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){}, removeAttribute(){}, getAttribute(){return null},
    appendChild(){}, addEventListener(ev,fn){handlers[ev]=fn;},
    querySelectorAll(){return[]}, querySelector(){return null},
    get firstChild(){return null}, get lastChild(){return null},
    set innerHTML(v){this._html=v;}, get innerHTML(){return this._html||"";},
    set textContent(v){this._text=v;}, get textContent(){return this._text||"";},
    set value(v){this._value=v;}, get value(){return this._value||"";},
    get disabled(){return false}, set disabled(v){},
    get title(){return ""}, set title(v){},
    get className(){return ""}, set className(v){},
    focus(){}, select(){}, blur(){}, click(){},
    getBoundingClientRect(){return{width:0,height:0,left:0,top:0,bottom:0,right:0};},
    contains(){return false;},
  };
}
const elements = new Map();
const document = {
  getElementById(id){ if(!elements.has(id)) elements.set(id, makeEl()); return elements.get(id); },
  createElement(){ return makeEl(); }, querySelector(){ return makeEl(); },
  querySelectorAll(){ return []; }, body: makeEl(), addEventListener(){}, removeEventListener(){},
};
let store = {};
const localStorage = {
  getItem(k){ return store[k]||null; }, setItem(k,v){ store[k]=String(v); },
  removeItem(k){ delete store[k]; }, clear(){ store={}; },
};
const ctx = { Math, Date, JSON, Array, Object, Number, String, Boolean, Set, Map, console,
  localStorage, document, setTimeout:()=>{}, clearTimeout:()=>{},
  window:null, alert:()=>{}, prompt:()=>null, confirm:()=>true,
  performance:{now:()=>Date.now()} };
ctx.window = ctx; ctx.globalThis = ctx;
const sandbox = vm.createContext(ctx);
vm.runInContext(scriptSrc, sandbox, {filename:"app.js"});
const T = ctx.__T;

const st = T.state();
st.staff = T.DEFAULT_STAFF.slice();

// 复刻 autoSchedule 的 slots 构造
const S = ["early","mid","night"];
const N = st.staff.length;
const slots = [];
st.needs.forEach((d,di)=>{ S.forEach(sh=>{ for(let i=0;i<(+d[sh]||0);i++) slots.push({day:di, shift:sh}); }); });
{
  const exact = Array.isArray(st.exactShifts) ? st.exactShifts : [];
  const flex = ["early","night"].filter(sh => !exact.includes(sh));
  let extra = N*5 - slots.length;
  const cur = {early:0, mid:0, night:0};
  const dayCnt = new Array(7).fill(0);
  slots.forEach(s=>{ cur[s.shift]++; dayCnt[s.day]++; });
  let guard = 0;
  while(extra > 0 && guard < 500){
    guard++;
    let pickSh = null, bestRoom = -Infinity;
    flex.forEach(sh=>{
      const cap = N * (st.limits[sh]||99);
      if(cur[sh] >= cap) return;
      const room = (cap - cur[sh]) / cap;
      if(room > bestRoom){ bestRoom = room; pickSh = sh; }
    });
    if(!pickSh) break;
    const day = dayCnt.indexOf(Math.min(...dayCnt));
    slots.push({day, shift:pickSh});
    cur[pickSh]++; dayCnt[day]++; extra--;
  }
}
const RByName = T.buildRules(T.curKey());
const R = st.staff.map(n=>RByName[n]);

let badPlan = 0, totalAssigned = {}, restOver = 0;
const trials = 200;
for(let t=0; t<trials; t++){
  const plan = T.tryPlan(slots, N, R);
  if(!plan) continue;
  const lens = plan.assign.map(a=>a.length);
  const over = lens.filter(l=> l!==5).length;
  if(over) {
    badPlan++;
    const detail = lens.map((l,i)=> l!==5 ? `${st.staff[i]}:${l}` : null).filter(Boolean);
    if(badPlan <= 5) console.log(`  #${t} 上班天数不等于5的人：`, detail.join("，"));
  }
  const restSizes = plan.restDays.map(s=>s.size);
  const rOver = restSizes.filter(s=> s!==2).length;
  if(rOver){ restOver++; if(restOver<=5) console.log(`  #${t} 休天数≠2：`, restSizes.map((s,i)=> s!==2?`${st.staff[i]}:${s}`:"").filter(Boolean).join("，")); }
  lens.forEach(l=>{ totalAssigned[l]=(totalAssigned[l]||0)+1; });
}
console.log(`\n共 ${trials} 次 tryPlan：`);
console.log(`  上班天数分布：`, JSON.stringify(totalAssigned));
console.log(`  出现「上班天数≠5」的次数：${badPlan}`);
console.log(`  出现「休息天数≠2」的次数：${restOver}`);
