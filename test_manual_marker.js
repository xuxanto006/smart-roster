/* 手动改动标记的可见化：被手动改过的格子要带蓝点（manual-dot）+ tooltip。
   锁死的性质：
   1. setCell（模拟用户点格子改班次）后，对应格子渲染出 manual-dot；
   2. 微调不清除标记（即使微调真的跑了）；
   3. 规则强制清掉手动格子时，标记随之消失；
   4. 整周重排（autoSchedule）后，所有 manual-dot 消失。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,setCell,buildRules,curKey,ensureWeek,DEFAULT_STAFF,openModal};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }
function dotCount(){ return (els["tableBody"].innerHTML.match(/manual-dot/g)||[]).length; }
function reset(reqs){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:8,mid:1,night:10})).concat([5,6].map(()=>({early:9,mid:3,night:12})));
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=reqs||[]; S.schedule={}; S.roles={}; S.roleSig={}; S.manual={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups={earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"],minEarly:1,minNight:1},
            openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"],open:1,close:2,maxPerWeek:3}};
}
function workDay(name){
  const w=T.ensureWeek(T.curKey());
  return [0,1,2,3,4,5,6].find(d=>w[name][d] && w[name][d]!=="rest");
}

console.log("══════ 手动改动标记 · 可见化测试 ══════");

/* 一、手动点格子 → 蓝点出现，且带 tooltip */
reset();
T.autoSchedule();
expect(dotCount()===0, "刚排完班没有任何蓝点", "实际="+dotCount());
const d1 = workDay("高超");
T.openModal("高超", d1);
T.setCell("mid");
expect(dotCount()===1, "手动改 1 格后出现 1 个蓝点", "实际="+dotCount());
expect(/不会覆盖/.test(els["tableBody"].innerHTML), "蓝点格子带「微调不会覆盖」的 tooltip");

/* 二、微调真的跑起来也不清除标记 */
T.repatchWeek(true);                     // 无请假时微调直接返回，再补一条别人的请假让它真跑
T.autoSchedule();                        // 重置一下，重新走完整流程
const d2 = workDay("高超");
T.openModal("高超", d2);
T.setCell("mid");
const others=[{id:1,name:"何广友",day:6,type:"off",scope:"once",weekKey:T.curKey()}];
S.requests=others;
T.repatchWeek(true);
expect(dotCount()===1, "微调真实执行后蓝点仍在（手动格子不被覆盖）", "实际="+dotCount());

/* 三、请假命中手动格子：规则强制清掉，标记随之消失 */
T.autoSchedule();
const d3 = workDay("高超");
T.openModal("高超", d3);
T.setCell("mid");                        // 手动改成中班
expect(dotCount()===1, "第三轮：手动改 1 格", "实际="+dotCount());
S.requests=[{id:1,name:"高超",day:d3,type:"off",scope:"once",weekKey:T.curKey()}];
T.repatchWeek(true);                     // 请假优先 → 强制休息 → 手动中班被规则清掉
expect(dotCount()===0, "请假命中手动格 → 规则强制清理，标记随之消失", "实际="+dotCount());

/* 四、整周重排后标记全部清除 */
T.openModal("高超", d3);
T.setCell("mid");
expect(dotCount()===1, "再手动改 1 格", "实际="+dotCount());
T.autoSchedule();
expect(dotCount()===0, "整周重排后蓝点全部消失", "实际="+dotCount());

console.log("\n══════════════════════════════");
console.log(`===== 手动标记可见化测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
