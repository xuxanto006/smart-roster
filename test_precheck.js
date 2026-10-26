/* 规则录入期「矛盾预检」测试
   重点：请假日不相邻 → 必然上一休一，必须在排班之前就报出来，而不是排完才说。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,renderAll,renderRequests,renderRequestConflict,renderHealth,hasRestPlan,isolatedRestCount,checkRuleViolations,DEFAULT_STAFF,DAY_NAMES};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,DAY=T.DAY_NAMES;

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }
const txt = id => { const e=els[id]; return e? (e.innerHTML||e.textContent||"") : ""; };

function reset(){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
}
/* 给某人加 n 天「必须休息」 */
function leave(name, days){
  days.forEach((d,i)=>{
    S.requests.push({id:1000+i, name, day:d, type:"off", scope:"once", weekKey:T.curKey()});
  });
}

console.log("══════ 规则录入期矛盾预检 ══════");

/* ---------- 一、hasRestPlan 穷举本身 ---------- */
console.log("\n— 一、休息组合可行性（P=2）—");
expect(T.hasRestPlan([1,2],2)===true,  "周二+周三（相邻）→ 可行");
expect(T.hasRestPlan([0,6],2)===true,  "周一+周日（跨周边相邻）→ 可行");
expect(T.hasRestPlan([1,4],2)===true,  "周二+周五（隔 3 天）→ 可行");
expect(T.hasRestPlan([1,3],2)===false, "周二+周四（隔 1 个工作日）→ 必然上一休一");
expect(T.hasRestPlan([1,6],2)===false, "周二+周日（跨周隔 1 天）→ 必然上一休一");
expect(T.hasRestPlan([0,2],2)===false, "周一+周三 → 必然上一休一");
console.log("\n— 一之二、P=3 —");
expect(T.hasRestPlan([0,1,2],3)===true,  "周一二三（连休 3 天）→ 可行");
expect(T.hasRestPlan([0,2,4],3)===false, "周一三五六式（各隔 1 天）→ 必然上一休一");
expect(T.hasRestPlan([0,1,3],3)===false, "周一二四 → 必然上一休一");
expect(T.hasRestPlan([1],3)===true,      "只钉 1 天、还剩 2 天可挑 → 可行");
expect(T.hasRestPlan([1,2,3,4],3)===false,"请 4 天假但只能休 3 天 → 不可行");

/* ---------- 二、面板：不误报 ---------- */
console.log("\n— 二、不该报的时候别报 —");
reset(); T.renderRequestConflict();
expect(txt("reqConflict")==="", "默认配置（仅固定上班日）→ 面板为空");
reset(); leave("李敏",[1,2]); T.renderRequestConflict();
expect(txt("reqConflict")==="", "请相邻两天假 → 不报", txt("reqConflict"));
reset(); leave("李敏",[1]); T.renderRequestConflict();
expect(txt("reqConflict")==="", "只请 1 天假 → 不报（算法还能挑另一天躲开）", txt("reqConflict"));
reset(); leave("李敏",[0,6]); T.renderRequestConflict();
expect(txt("reqConflict")==="", "周一+周日（跨周相邻）→ 不报", txt("reqConflict"));

/* ---------- 三、面板：该报的时候报 ---------- */
console.log("\n— 三、该报的时候要报 —");
reset(); leave("李敏",[1,3]); T.renderRequestConflict();
expect(/李敏/.test(txt("reqConflict")) && /上一休一/.test(txt("reqConflict")),
       "周二+周四 → 报「必然上一休一」", txt("reqConflict"));
reset(); leave("李敏",[1,6]); T.renderRequestConflict();
expect(/上一休一/.test(txt("reqConflict")), "周二+周日（跨周）→ 也报", txt("reqConflict"));
reset(); leave("李敏",[1]); leave("高超",[2,4]); T.renderRequestConflict();
expect((txt("reqConflict").match(/上一休一/g)||[]).length===1,
       "多人时只报真正冲突的那个（李敏不报、高超报）", txt("reqConflict"));

console.log("\n— 三之二、超配额 / 必须上班天数 —");
reset(); leave("李敏",[1,3,5]); T.renderRequestConflict();
expect(/超过「每人每周休 2 天」/.test(txt("reqConflict")), "请 3 天假 > 休 2 天 → 报超配额", txt("reqConflict"));
reset();
[0,1,2].forEach((d,i)=>S.requests.push({id:2000+i,name:"李敏",day:d,type:"work",scope:"once",weekKey:T.curKey()}));
[3,4].forEach((d,i)=>S.requests.push({id:2100+i,name:"李敏",day:d,type:"night",scope:"once",weekKey:T.curKey()}));
T.renderRequestConflict();
// 恰好等于上限：整周被排满，没有余量但仍然排得出来 —— 不该报
expect(!/最多只能上/.test(txt("reqConflict")), "5 天必须上班 = 上限 5 天 → 恰好排满，不报", txt("reqConflict"));
S.requests.push({id:2200,name:"李敏",day:5,type:"work",scope:"once",weekKey:T.curKey()});
T.renderRequestConflict();
expect(/最多只能上 5 天/.test(txt("reqConflict")), "6 天必须上班 > 上限 5 天 → 报排不出来", txt("reqConflict"));

console.log("\n— 三之三、休息日被「必须上班」钉死 —");
reset();
[0,2,3,4,5].forEach((d,i)=>S.requests.push({id:3000+i,name:"李敏",day:d,type:"work",scope:"once",weekKey:T.curKey()}));
T.renderRequestConflict();
expect(/必然触发「上一休一」/.test(txt("reqConflict")),
       "5 天必须上班后，剩下两天（周二+周日）隔一个工作日 → 报钉死型冲突", txt("reqConflict"));
reset();
[0,2,3,4,6].forEach((d,i)=>S.requests.push({id:3100+i,name:"李敏",day:d,type:"work",scope:"once",weekKey:T.curKey()}));
T.renderRequestConflict();
expect(!/上一休一/.test(txt("reqConflict")),
       "换个组合剩下周二+周六（隔 3 天）→ 不报", txt("reqConflict"));
expect(T.hasRestPlan([],2,[0,2,3,4,5])===false, "hasRestPlan 带 mustDays：{周二,周日} → 不可行");
expect(T.hasRestPlan([],2,[0,2,3,4,6])===true,  "hasRestPlan 带 mustDays：{周二,周六} → 可行");

/* ---------- 四、预检与排班结果一致（不是误报） ---------- */
console.log("\n— 四、预检说得准：排完班真的会有上一休一 —");
let agree=0, tot=0, mismatch=[];
[[1,3],[1,6],[0,2],[3,5],[0,5],[1,2],[0,6],[1,4],[2,3]].forEach(pair=>{
  reset(); leave("李敏",pair);
  T.renderRequestConflict();
  const predicted = /李敏[\s\S]*?上一休一/.test(txt("reqConflict")) || /李敏[^⚠]*上一休一/.test(txt("reqConflict"));
  const predictedAny = /上一休一/.test(txt("reqConflict"));
  T.autoSchedule();
  T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
  const health = txt("healthBox");
  const actual = /李敏[\s\S]{0,40}上一休一/.test(health);
  tot++;
  if(predictedAny === actual) agree++;
  else mismatch.push(`${DAY[pair[0]]}+${DAY[pair[1]]} 预检=${predictedAny} 实际=${actual}`);
});
expect(agree===tot, `9 种请假组合：预检与排班结果一致（${agree}/${tot}）`, mismatch.join(" ｜ "));

/* ---------- 五、renderAll 会带上它 ---------- */
console.log("\n— 五、接入渲染主流程 —");
reset(); leave("李敏",[1,3]); T.renderAll();
expect(/上一休一/.test(txt("reqConflict")), "renderAll() 后预检面板就有内容");
reset(); T.renderAll();
expect(txt("reqConflict")==="", "清空请假后 renderAll() 面板同步清空");

console.log("\n══════════════════════════════");
console.log(`===== 矛盾预检测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
