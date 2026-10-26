/** 「🩺 本周体检」面板测试：该报的报出来，不该报的闭嘴 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,renderHealth,renderAll,groupMembers,assignRoles,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }
const box = ()=> (els["healthBox"] ? (els["healthBox"].innerHTML||"") : "");
const cls = ()=> (els["healthBox"] ? (els["healthBox"].className||"") : "");

function reset(){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
}

console.log("══════ 本周体检面板测试 ══════");

/* 一、正常排班 → 全通过 */
console.log("\n— 一、正常排班 —");
reset();
T.autoSchedule();
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(/全部通过/.test(box()), "干净班表 → 显示「全部通过」", box().slice(0,70));
expect(/ok/.test(cls()), "样式为 ok（绿色）", cls());
expect(els["healthTag"].textContent==="正常", "标题徽章显示「正常」", els["healthTag"].textContent);

/* 二、挖个洞 → 报缺人 */
console.log("\n— 二、人为制造缺人 —");
reset(); T.autoSchedule();
let w=T.ensureWeek(T.curKey());
// 找一个早班的人改成休息（早班是人数固定班次，最容易稳定复现缺口）
let hit=null;
for(let i=0;i<S.staff.length && !hit;i++){ for(let d=0;d<7;d++){ if(w[S.staff[i]][d]==="early"){ hit={n:S.staff[i],d:d}; break; } } }
w[hit.n][hit.d]="rest";
T.renderHealth(w, T.buildRules(T.curKey()));
expect(/缺 1 人/.test(box()), `报告「早班缺 1 人」（挖掉 ${hit.n} 周${hit.d+1}）`, box().slice(0,90));
expect(/warn/.test(cls()), "样式转 warn（红色）", cls());
// 抽掉何广友（早晚保障组成员）的早班，会连带触发「早班缺人」「保障组早班缺人」等多条，
// 所以这里只断言「徽章报了冲突数」，不写死条数。
expect(/\d+ 处待处理/.test(els["healthTag"].textContent), "徽章显示冲突数", els["healthTag"].textContent);

/* 三、制造上一休一 */
console.log("\n— 三、人为制造「上一休一」—");
reset(); T.autoSchedule();
w=T.ensureWeek(T.curKey());
// 找一个人，把他的周一、周三设为休（周二上班）→ 经典的 休-上-休
const n3=S.staff.find(function(n){ return w[n][1]!=="rest" && w[n][1]!==""; });
w[n3][0]="rest"; w[n3][2]="rest";
T.renderHealth(w, T.buildRules(T.curKey()));
expect(new RegExp(n3+" 上一休一").test(box()), `报告「${n3} 上一休一」`, box().slice(0,110));

/* 四、休息天数与配额不符 */
console.log("\n— 四、休息天数不符 —");
reset(); T.autoSchedule();
w=T.ensureWeek(T.curKey());
const n4=S.staff[0];
let d4=-1; for(let d=0;d<7;d++) if(w[n4][d]!=="rest"){ d4=d; break; }
w[n4][d4]="rest";     // 让他多休一天
T.renderHealth(w, T.buildRules(T.curKey()));
expect(new RegExp(n4+" 休 3 天").test(box()), `报告「${n4} 休 3 天（配额 2 天）」`, box().slice(0,110));

/* 五、分组保障缺口 */
console.log("\n— 五、早晚保障组缺口 —");
reset(); T.autoSchedule();
w=T.ensureWeek(T.curKey());
const en=T.groupMembers("earlyNight");
// 让整个早晚保障组周一都不上早班
en.forEach(function(n){ if(w[n][0]==="early") w[n][0]="rest"; });
T.renderHealth(w, T.buildRules(T.curKey()));
expect(/早晚保障组早班缺/.test(box()), "报告「早晚保障组早班缺 N 人」", box().slice(0,110));

/* 六、配置层面：人力不够 */
console.log("\n— 六、配置层面：人力不够 —");
reset();
S.staff=T.DEFAULT_STAFF.slice(0,10);   // 只剩 10 人
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(/人力不够/.test(box()), "报告「人力不够」", box().slice(0,110));
expect(/warn/.test(cls()), "配置层面的冲突也是红色", cls());

/* 七、配置层面：全队休息上限矛盾 */
console.log("\n— 七、配置层面：休息上限矛盾 —");
reset();
S.restMax={per:2,total:20};   // 31 人 × 2 = 62 > 20
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(/互相矛盾/.test(box()), "报告「两条规则互相矛盾」", box().slice(0,110));

/* 八、配置层面：班次余量紧张 */
console.log("\n— 八、配置层面：早班余量紧张 —");
reset();
S.limits={early:2,night:4,mid:99};  // 31×2=62 vs 需求 58 → 94%
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(/余量不足/.test(box()), "报告「早班余量不足（94%）」", box().slice(0,110));

/* 九、固定上班日天数超过可上班天数 */
console.log("\n— 九、固定上班日排不下 —");
reset();
S.mustWork=[];
[0,1,2,3,4,5].forEach(function(d){ S.mustWork.push({name:"李敏",day:d}); });
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(/李敏.*最多只能上 5 天/.test(box()), "报告「李敏 要求 6 天固定上班，但最多只能上 5 天」", box().slice(0,110));

/* 十、还没排班 */
console.log("\n— 十、空班表 —");
reset();
S.schedule={};
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(/还没排班/.test(box()), "提示「本周还没排班」", box().slice(0,80));

/* 十一、开店/闭店：人够但「每人 ≤3 次」额度不够 → 必须报出来
   这是体检面板曾经漏掉的一种假绿灯：旧检查只数「当天该组有几个人上这个班次」，
   这里每天都凑得出 2 个晚班候选人，但 7 天 × 2 = 14 个闭店名额
   只有 4 个人能分、每人上限 3 次 = 12 个名额，必然差 2 个。 */
console.log("\n— 十一、开店闭店：额度不足（人够但分不过来）—");
reset();
T.autoSchedule();
(function(){
  const w = T.ensureWeek(T.curKey());
  // 晚班候选人：4 人轮转，每天都正好 2 人（旧检查会放行），但总容量 4×3=12 < 14
  const nightByDay = [
    ["陈悦娴","高超"], ["陈悦娴","吴心然"], ["高超","吴心然"], ["陈悦娴","刘舒晨"],
    ["高超","刘舒晨"], ["吴心然","刘舒晨"], ["陈悦娴","高超"]
  ];
  // 早班候选人：3 人轮转，每天 1 人，总容量 3×3=9 ≥ 7 → 开店应当排得满
  const earlyByDay = ["刘思含","吴洋洋","李敏","刘思含","吴洋洋","李敏","刘思含"];
  for(let d=0; d<7; d++){
    w["陈悦娴"][d] = nightByDay[d][0]==="陈悦娴" ? "night" : "mid";
    w["高超"][d]   = nightByDay[d].indexOf("高超")>=0   ? "night" : "mid";
    w["吴心然"][d] = nightByDay[d].indexOf("吴心然")>=0 ? "night" : "mid";
    w["刘舒晨"][d] = nightByDay[d].indexOf("刘舒晨")>=0 ? "night" : "mid";
    w["刘思含"][d] = earlyByDay[d]==="刘思含" ? "early" : "mid";
    w["吴洋洋"][d] = earlyByDay[d]==="吴洋洋" ? "early" : "mid";
    w["李敏"][d]   = earlyByDay[d]==="李敏"   ? "early" : "mid";
    // 组内剩下两人必须清成中班：否则他们自动排班留下的晚班会额外增加闭店容量，
    // 这个用例就失去意义了（要的就是「只有 4 个人能闭店」）
    w["张子柔"][d] = "mid";
    w["冯楷"][d]   = "mid";
  }
  T.assignRoles(T.curKey());
  T.renderHealth(w, T.buildRules(T.curKey()));
  expect(/闭店缺/.test(box()), "额度不足时报告「闭店缺」，不再显示「全部通过」", box().slice(0,120));
  expect(/额度已用完/.test(box()), "并说明原因是「每人每周≤3次」额度用完，而不是说没人上班次", box().slice(0,160));
  expect(!/开店缺/.test(box()), "同时不误报「开店缺」（开店名额 7 个 ≤ 容量 9，排得满）", box().slice(0,160));
})();

/* 十二、不误报：正常配置不应出现「余量不足」「人力不够」 */
console.log("\n— 十二、默认配置不误报 —");
reset();
T.autoSchedule();
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(!/余量不足/.test(box()), "默认配置不报「余量不足」");
expect(!/人力不够/.test(box()), "默认配置不报「人力不够」");
expect(!/互相矛盾/.test(box()), "默认配置不报「互相矛盾」");

/* 十二之二、分组产能检查也不能在默认配置上误报。
   这两条的文案和上面的旧检查不一样（「余量很紧」/「必然排不出来」），
   原来的断言里的正则匹配不到，必须单独守一层 —— 否则哪天把阈值调紧了，
   默认配置一进页面就飘红，而测试还是全绿。 */
console.log("\n— 十二之二、默认配置不误报「分组产能」 —");
expect(!/必然排不出来/.test(box()), "默认配置不报「必然排不出来」", box().slice(0,200));
expect(!/余量很紧/.test(box()),     "默认配置不报「余量很紧」",     box().slice(0,200));
expect(!/开店闭店组/.test(box()),   "默认配置不提「开店闭店组」产能", box().slice(0,200));
expect(!/早晚保障组/.test(box()),   "默认配置不提「早晚保障组」产能", box().slice(0,200));

/* 十三、分组产能：改配置时（还没排班）就要说出来，不能等排完才发现。
   9 人 × 每人 ≤2 次 = 18 个名额，但 7 天 ×(1 开店 + 2 闭店)= 21 个，
   数学上必然差 3 个 —— 这是配置层面的死局，不是排班运气问题。 */
console.log("\n— 十三、分组产能不足：配置阶段就要提示 —");
reset();
S.groups.openClose.maxPerWeek = 2;
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
expect(/必然排不出来/.test(box()), "开店闭店每人 ≤2 次 → 报「必然排不出来」", box().slice(0,240));
expect(/开店闭店组角色名额/.test(box()), "并点名是「开店闭店组角色名额」", box().slice(0,240));
expect(/需要 21 人次/.test(box()) && /产能只有 18 人次/.test(box()),
       "并把「需要 21 / 产能 18」这组数字讲清楚", box().slice(0,240));

console.log("\n══════════════════════════════");
console.log(`===== 体检面板测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
