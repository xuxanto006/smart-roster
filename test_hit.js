/* 验证「实心醒目样式只在被请假/改班设置决定的格子上出现」 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},_tm:null};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"globalThis.__T={get state(){return state},renderTable,ensureWeek,curKey,autoSchedule,repatchWeek,buildRules};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,k=T.curKey(),pad=i=>String(i).padStart(2,"0");

let pass=0,fail=0;
const expect=(c,m,x)=>{ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(x?"  → "+x:""));} };

function reset(){
  S.staff=Array.from({length:10},(_,i)=>"员工"+pad(i+1));S.requests=[];S.schedule={};S.limits={early:3,night:4,mid:99};
  S.needs=[{early:2,mid:1,night:3},{early:2,mid:1,night:3},{early:2,mid:1,night:3},{early:2,mid:1,night:3},{early:2,mid:1,night:3},{early:3,mid:1,night:4},{early:3,mid:1,night:4}];
}
function cellsFor(name){
  // 从渲染出的 HTML 里抽出某人 7 格的 class
  const body = els.tableBody.innerHTML;
  const row = body.split("<tr>").find(r => r.includes(">"+name+"</td>"));
  if(!row) return null;
  return [...row.matchAll(/class="shift-cell ([^"]*)"/g)].map(m=>m[1]);
}

console.log("【场景A】无任何安排 → 全部浅色，无 hit / leave");
reset(); T.autoSchedule(); T.renderTable();
let cs = cellsFor("员工01");
expect(cs && cs.length===7, "取到员工01 的 7 个格子");
expect(cs.every(c=>!/hit-/.test(c) && !/leave/.test(c)), "无安排时不应出现实心/请假样式", cs&&cs.join(" | "));

console.log("\n【场景B】员工03 周三「必须休息」→ 该格应为 leave");
reset();
S.requests=[{id:1,name:"员工03",day:2,type:"off",scope:"once",weekKey:k}];
T.autoSchedule(); T.renderTable();
cs = cellsFor("员工03");
expect(cs[2].includes("leave"), "周三格子带 leave（红底白字「假」）", cs[2]);
const others = cellsFor("员工01");
expect(others.every(c=>!/hit-/.test(c)), "其他人不受影响，仍是浅色", others.join(" | "));

console.log("\n【场景C】员工05 周四「固定晚班」→ 该格应为 hit-night");
reset();
S.requests=[{id:1,name:"员工05",day:3,type:"night",scope:"once",weekKey:k}];
T.autoSchedule(); T.renderTable();
cs = cellsFor("员工05");
expect(cs[3].includes("night"), "周四确实是晚班", cs[3]);
expect(cs[3].includes("hit-night"), "周四格子应为 hit-night 实心", cs[3]);
expect(cs.filter(c=>/hit-/.test(c)).length===1, "只有这一格是实心", cs.join(" | "));

console.log("\n【场景D】员工07 周五「必须上班」→ 该格应为 hit-<班次>");
reset();
S.requests=[{id:1,name:"员工07",day:4,type:"work",scope:"once",weekKey:k}];
T.autoSchedule(); T.renderTable();
cs = cellsFor("员工07");
expect(cs[4]!=="" && /hit-(early|mid|night)/.test(cs[4]), "周五格子为实心色块", cs[4]);
expect(cs[4].includes("rest")===false, "周五不是休息", cs[4]);

console.log("\n【场景E】员工02 周日「不上晚班」（避开类）→ 保持浅色 + 小圆点");
reset();
S.requests=[{id:1,name:"员工02",day:6,type:"nonight",scope:"always",weekKey:k}];
T.autoSchedule(); T.renderTable();
cs = cellsFor("员工02");
expect(!/hit-/.test(cs[6]), "避开类规则不触发实心（避免整行都高亮）", cs[6]);
const rowHtml = els.tableBody.innerHTML.split("<tr>").find(r=>r.includes(">员工02</td>"));
expect((rowHtml.match(/rule-dot/g)||[]).length===1, "周日格子带 1 个小圆点标识");

console.log("\n【场景F】混合：请假 + 固定 + 避开 同时存在");
reset();
S.requests=[
  {id:1,name:"员工01",day:1,type:"off",scope:"once",weekKey:k},
  {id:2,name:"员工02",day:3,type:"early",scope:"always",weekKey:k},
  {id:3,name:"员工03",day:5,type:"nomid",scope:"always",weekKey:k},
  {id:4,name:"员工04",day:0,type:"work",scope:"once",weekKey:k},
];
T.autoSchedule(); T.renderTable();
const c1=cellsFor("员工01"), c2=cellsFor("员工02"), c3=cellsFor("员工03"), c4=cellsFor("员工04");
expect(c1[1].includes("leave"), "员工01 周二 → 假（红底白字）", c1[1]);
expect(c2[3].includes("hit-early"), "员工02 周四 → 实心早班", c2[3]);
expect(c3.every(c=>!/hit-/.test(c)), "员工03 避开类中班 → 保持浅色");
expect(/hit-/.test(c4[0]), "员工04 周一必须上班 → 实心", c4[0]);
const allRows = els.tableBody.innerHTML;
const hitCount = (allRows.match(/hit-/g)||[]).length;
const leaveCount = (allRows.match(/leave/g)||[]).length;
console.log(`     → 实心格 ${hitCount} 个、请假格 ${leaveCount} 个（10 人 × 7 天 = 70 格）`);
expect(hitCount <= 3 && leaveCount <= 2, "实心高亮数量克制，未泛滥", `hit=${hitCount} leave=${leaveCount}`);

console.log(`\n===== 实心高亮测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
