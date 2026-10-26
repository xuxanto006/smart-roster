/* 「📌 固定上班日」常驻规则 测试
   覆盖：默认预置 → 规则编译 → 排班遵守 → 请假优先 → 矛盾列举 → 增删去重 → 存档往返 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,renderAll,renderMustWork,renderMustWorkConflict,addMustWork,removeMustWork,activeRequests,checkRuleViolations,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,DAY=["周一","周二","周三","周四","周五","周六","周日"];

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }
const el = id => { const e=els[id]; return e? (e.innerHTML||e.textContent||"") : ""; };

function reset(){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
}

console.log("══════ 固定上班日 · 常驻规则测试 ══════");

/* ---------- 一、默认预置 ---------- */
console.log("\n— 一、默认预置 —");
reset();
expect(S.mustWork.length===2, "默认预置 2 条", "实际="+S.mustWork.length);
expect(S.mustWork.some(m=>m.name==="陈悦娴"&&m.day===0), "含「陈悦娴 周一」");
expect(S.mustWork.some(m=>m.name==="张淑慧"&&m.day===0), "含「张淑慧 周一」");
expect(S.staff.indexOf("陈悦娴")>=0 && S.staff.indexOf("张淑慧")>=0, "两人都在 31 人名册内");

/* ---------- 二、规则编译 ---------- */
console.log("\n— 二、编译进规则表 —");
const R = T.buildRules(T.curKey());
expect(R["陈悦娴"][0].noOff===true, "陈悦娴 周一 → noOff（不排休息）");
expect(R["张淑慧"][0].noOff===true, "张淑慧 周一 → noOff");
expect(R["陈悦娴"][1].noOff===false, "陈悦娴 周二 未受影响");
expect(R["李敏"][0].noOff===false, "未设置的人不受影响");

/* ---------- 三、排班真的遵守 ---------- */
console.log("\n— 三、排班结果遵守（连排 30 次）—");
let bad=0, samples=[];
for(let i=0;i<30;i++){
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey());
  ["陈悦娴","张淑慧"].forEach(n=>{
    const v=w[n][0];
    if(v==="rest"||v===""){ bad++; if(samples.length<3) samples.push(`第${i+1}次 ${n}=${v||"空"}`); }
  });
}
expect(bad===0, "30 次排班中，周一两人都排到了班次（非休息/非空白）", samples.join("，"));

console.log("\n— 三之一、其它硬约束没被带坏 —");
const RV=T.buildRules(T.curKey());
const vio=T.checkRuleViolations(T.ensureWeek(T.curKey()), RV);
expect(vio.length===0, "排班后无请假/改班冲突记录", vio.slice(0,2).join("，"));
const w2=T.ensureWeek(T.curKey());
let restBad=[];
S.staff.forEach(n=>{
  const r=(w2[n]||[]).filter(v=>v==="rest").length;
  if(r!==2) restBad.push(`${n}=${r}天`);
});
expect(restBad.length===0, "每人仍恰好休 2 天", restBad.slice(0,4).join("，"));

/* ---------- 四、请假优先 ---------- */
console.log("\n— 四、与请假冲突时：请假优先 —");
reset();
S.requests=[{id:1,name:"陈悦娴",day:0,type:"off",scope:"once",weekKey:T.curKey()}];
const R2=T.buildRules(T.curKey());
expect(R2["陈悦娴"][0].off===true, "陈悦娴 周一 请假已登记");
expect(R2["陈悦娴"][0].noOff===false, "请假当天不再强制上班（noOff 让位）");
T.autoSchedule();
const w3=T.ensureWeek(T.curKey());
expect(w3["陈悦娴"][0]==="rest", "实际排班：陈悦娴 周一 休息（请假优先）", "实际="+w3["陈悦娴"][0]);
expect(w3["张淑慧"][0]!=="rest", "张淑慧 周一 仍上班", "实际="+w3["张淑慧"][0]);

/* ---------- 五、矛盾列举 ---------- */
console.log("\n— 五、矛盾列举（只报告，不改规则）—");
T.renderMustWorkConflict();
let cf = el("mustWorkConflict");
expect(/陈悦娴/.test(cf) && /请假/.test(cf), "列出「陈悦娴 周一 既上班又请假」", cf.slice(0,60));
expect((els["mustWorkConflict"].style||{}).display==="block", "冲突区可见");

reset();
S.mustWork=[{name:"陈悦娴",day:0},{name:"陈悦娴",day:1},{name:"陈悦娴",day:2},{name:"陈悦娴",day:3},{name:"陈悦娴",day:4},{name:"陈悦娴",day:5}];
T.renderMustWorkConflict();
cf = el("mustWorkConflict");
expect(/排不出来/.test(cf) && /最多只能上 5 天/.test(cf), "列出「要求 6 天上班 > 每周最多 5 天」", cf.slice(0,70));

reset();
S.mustWork=[{name:"查无此人",day:0}];
T.renderMustWorkConflict();
cf = el("mustWorkConflict");
expect(/不在人员名册/.test(cf), "列出「该人已不在名册」", cf.slice(0,50));

reset();
T.renderMustWorkConflict();
expect((els["mustWorkConflict"].style||{}).display==="none", "无矛盾时冲突区隐藏");

/* ---------- 六、增删去重 ---------- */
console.log("\n— 六、添加 / 删除 / 去重 —");
reset();
els["mwStaff"].value="李敏"; els["mwDay"].value="3";
T.addMustWork();
expect(S.mustWork.some(m=>m.name==="李敏"&&m.day===3), "添加成功：李敏 周四");
const before=S.mustWork.length;
T.addMustWork();
expect(S.mustWork.length===before, "重复添加被拦下（条数不变）", "实际="+S.mustWork.length);

T.removeMustWork("李敏",3);
expect(!S.mustWork.some(m=>m.name==="李敏"&&m.day===3), "删除成功");
expect(S.mustWork.length===2, "回到默认 2 条", "实际="+S.mustWork.length);

/* 删除后再加回 */
els["mwStaff"].value="李敏"; els["mwDay"].value="3";
T.addMustWork();
expect(S.mustWork.some(m=>m.name==="李敏"&&m.day===3), "删除后可再次添加");
reset();

/* ---------- 七、渲染 ---------- */
console.log("\n— 七、列表渲染 —");
reset();
T.renderMustWork();
const listhtml = el("mustWorkList");
expect(/陈悦娴/.test(listhtml) && /张淑慧/.test(listhtml), "列表显示两个人");
expect(/周一/.test(listhtml), "显示星期标签");
expect((listhtml.match(/mw-chip/g)||[]).length===2, "2 个星期小标签", "实际="+(listhtml.match(/mw-chip/g)||[]).length);
expect(el("mustWorkCount")==="2 条", "计数显示「2 条」", "实际="+el("mustWorkCount"));
reset();
S.mustWork=[]; T.renderMustWork();
expect(/暂无/.test(el("mustWorkList")), "空列表有占位提示");

/* ---------- 八、存档往返 ---------- */
console.log("\n— 八、存档持久化 —");
reset();
// 直接走真实 save()
vm.runInContext("save();", sandbox);
const raw = saved;
expect(typeof raw==="string" && raw.length>0, "save() 已写入 localStorage");
const obj = JSON.parse(raw);
expect(Array.isArray(obj.mustWork) && obj.mustWork.length===2, "存档里含 mustWork 2 条", JSON.stringify(obj.mustWork));

// 改数据 → 重新 load → 应还原
S.mustWork=[{name:"李敏",day:5}];
vm.runInContext("save();", sandbox);
S.mustWork=[{name:"陈悦娴",day:0}];           // 内存里先改脏
vm.runInContext("load();", sandbox);
expect(S.mustWork.length===1 && S.mustWork[0].name==="李敏" && S.mustWork[0].day===5,
  "load() 用存档覆盖内存值（含删空）", JSON.stringify(S.mustWork));

// 老存档（无 mustWork 字段）→ 保留内存里的默认预置，不被清空也不被篡改。
// 注：真实场景下页面刚加载时 state.mustWork 就是默认值，所以这里先把内存恢复成默认值再 load。
saved = JSON.stringify({staff:T.DEFAULT_STAFF, needs:S.needs, requests:[]});
S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
vm.runInContext("load();", sandbox);
expect(S.mustWork.length===2 && S.mustWork[0].name==="陈悦娴", "老存档缺少该字段时保留默认预置", JSON.stringify(S.mustWork));

console.log("\n══════════════════════════════");
console.log(`===== 固定上班日测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
