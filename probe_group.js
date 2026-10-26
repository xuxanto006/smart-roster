/** 找出「早晚保障组」仍然凑不齐的样例，把这 4 个人整周的班表打出来看形态 */
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const scriptSrc = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})() + `
;
globalThis.__T = { state:()=>state, curKey, DEFAULT_STAFF, tryPlan, planGroupViol, buildRules, groupMembers };
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

const DAY=["一","二","三","四","五","六","日"];
const MK={early:"早",mid:"中",night:"晚"};
const S=["early","mid","night"];
const N=st.staff.length;

// 复刻 autoSchedule 的槽位构造
const slots=[];
st.needs.forEach((d,di)=>{S.forEach(sh=>{for(let i=0;i<(+d[sh]||0);i++)slots.push({day:di,shift:sh});});});
let extra=N*5-slots.length;
const cur={early:0,mid:0,night:0}, dayCnt=new Array(7).fill(0);
slots.forEach(s=>{cur[s.shift]++;dayCnt[s.day]++;});
const exact=st.exactShifts||[];
const flex=["early","night"].filter(sh=>!exact.includes(sh));
let guard=0;
while(extra>0&&guard<500){
  guard++;
  let pickSh=null,bestRoom=-Infinity;
  flex.forEach(sh=>{const cap=N*(st.limits[sh]||99); if(cur[sh]>=cap)return;
    const room=(cap-cur[sh])/cap; if(room>bestRoom){bestRoom=room;pickSh=sh;}});
  if(!pickSh)break;
  const day=dayCnt.indexOf(Math.min(...dayCnt));
  slots.push({day,shift:pickSh}); cur[pickSh]++; dayCnt[day]++; extra--;
}
const R=st.staff.map(n=>T.buildRules(T.curKey())[n]);

const enNames=T.groupMembers("earlyNight");
const enIdx=enNames.map(n=>st.staff.indexOf(n));
const en=st.groups.earlyNight;
console.log("早晚保障组：",enNames.join("、"),`｜每天需 ${en.minEarly} 早 + ${en.minNight} 晚`);
console.log("班次上限：早 ≤"+st.limits.early+" / 晚 ≤"+st.limits.night+" / 中 ≤"+st.limits.mid);
console.log("");

const WANT=+(process.argv[2]||8);
let found=0, tried=0, restViol=0;
const t0=Date.now();
while(found<WANT && tried<4000 && Date.now()-t0<100000){
  tried++;
  const p=T.tryPlan(slots,N,R);
  if(!p) continue;
  const gv=T.planGroupViol(p);
  // 只看「纯分组违约」（上一休一不算）
  const at=(i,d)=>{const a=p.assign[i].find(x=>x.day===d);return a?a.shift:"";};
  let bad=false;
  for(let d=0;d<7;d++){
    if(enIdx.filter(i=>at(i,d)==="early").length < (en.minEarly||0)) bad=true;
    if(enIdx.filter(i=>at(i,d)==="night").length < (en.minNight||0)) bad=true;
  }
  // 统计：每天该组休息几人（检查休息日配额上限是否生效）
  for(let d=0;d<7;d++){
    const rest=enIdx.filter(i=>p.restDays[i].has(d)).length;
    if(rest>2) restViol++;
  }
  if(!bad) continue;
  found++;
  console.log(`—— 反例 ${found}（第 ${tried} 次尝试，planGroupViol=${gv}）——`);
  console.log("        " + DAY.map(d=>"周"+d).join(" "));
  enIdx.forEach(i=>{
    const cells=[];
    for(let d=0;d<7;d++){
      const v=at(i,d);
      cells.push(p.restDays[i].has(d) ? "休" : (MK[v]||"·"));
    }
    const c={early:0,mid:0,night:0};
    for(let d=0;d<7;d++){const v=at(i,d); if(c[v]!==undefined)c[v]++;}
    console.log(`  ${enNames[enIdx.indexOf(i)].padEnd(4,"　")} ` + cells.map(x=>" "+x+" ").join("") +
      `  早${c.early} 中${c.mid} 晚${c.night}  休${p.restDays[i].size}`);
  });
  // 每天该组的出勤构成
  const perDay=[];
  for(let d=0;d<7;d++){
    const e=enIdx.filter(i=>at(i,d)==="early").length;
    const m=enIdx.filter(i=>at(i,d)==="mid").length;
    const g=enIdx.filter(i=>at(i,d)==="night").length;
    const r=enIdx.filter(i=>p.restDays[i].has(d)).length;
    perDay.push(`周${DAY[d]}[早${e}中${m}晚${g}休${r}]`);
  }
  console.log("  每天构成：" + perDay.join(" "));
  console.log("");
}
console.log(`试了 ${tried} 次，找到 ${found} 个反例 ｜ 期间「某天该组休息 >2 人」出现 ${restViol} 次（应为 0，验证休息日上限是否生效）`);
