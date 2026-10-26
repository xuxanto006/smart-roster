/** 新增两条「配置矛盾预警」是否在该响的时候响、不该响的时候闭嘴 */
const fs=require("fs"), vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const src=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})()+`
;globalThis.__T={state:()=>state,autoSchedule,curKey,DEFAULT_STAFF,restTotalCap};`;
function makeEl(){const h={};return{_children:[],style:{},dataset:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},removeAttribute(){},getAttribute(){return null},appendChild(){},addEventListener(e,f){h[e]=f},querySelectorAll(){return[]},querySelector(){return null},get firstChild(){return null},get lastChild(){return null},set innerHTML(v){this._html=v},get innerHTML(){return this._html||""},set textContent(v){this._text=v},get textContent(){return this._text||""},set value(v){this._value=v},get value(){return this._value||""},get disabled(){return false},set disabled(v){},get title(){return ""},set title(v){},get className(){return ""},set className(v){},focus(){},select(){},blur(){},click(){},remove(){},insertAdjacentHTML(){},closest(){return null},get parentNode(){return null},scrollIntoView(){}};}
const doc={getElementById:()=>makeEl(),querySelector:()=>makeEl(),querySelectorAll:()=>[],createElement:()=>makeEl(),addEventListener(){},body:makeEl()};
const store={}; let warns=[];
const ctx={document:doc,window:{addEventListener(){}},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},performance:{now:()=>Date.now()},alert(){},prompt:()=>null,
  confirm:(m)=>{warns.push(String(m).split("\n")[0].slice(0,60)); return true;},
  console,navigator:{clipboard:{writeText:()=>Promise.resolve()}},Date,Math,JSON,setTimeout,clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{}, URL:{createObjectURL:()=>"blob:x",revokeObjectURL(){}},Blob:function(){},globalThis:null};
ctx.globalThis=ctx; ctx.window=ctx;
vm.createContext(ctx); vm.runInContext(src,ctx);
const T=ctx.__T, st=T.state();
function reset(){ st.staff=T.DEFAULT_STAFF.slice(); st.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  st.limits={early:3,night:4,mid:99}; st.restMax={per:2,total:0}; st.exactShifts=["early"]; st.weekendEarlyMax=1; st.requests=[]; st.schedule={}; st.roles={}; }

function run(name, cfg){
  reset(); cfg(); warns=[];
  try{ T.autoSchedule(); }catch(e){ console.log(`  ${name}: 抛错 ${e.message}`); return; }
  console.log(`\n【${name}】`);
  if(!warns.length) console.log("   ⚪ 无预警");
  else warns.forEach(w=> console.log("   🔔 " + w));
}
console.log("========== 配置矛盾预警检查 ==========");
run("① 默认配置（不该有任何预警）", ()=>{});
run("② 早班上限收紧到 2", ()=>{ st.limits={early:2,night:4,mid:99}; });
run("③ 全队休息上限 50（低于 31×2=62）", ()=>{ st.restMax={per:2,total:50}; });
run("④ 每人休 3 天（上班 4 天）", ()=>{ st.restMax={per:3,total:0}; });
run("⑤ 裁到 20 人", ()=>{ st.staff=T.DEFAULT_STAFF.slice(0,20); });
