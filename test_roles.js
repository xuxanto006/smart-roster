/* 开店 / 闭店角色标记 + 休息配额开关 测试 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync(process.env.APP_FILE||"/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){},querySelectorAll(){return[]},querySelector(){return fakeEl("q")},children:[],dataset:{}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,assignRoles,rerollRoles,toggleRole,roleOf,curKey,ensureWeek,groupMembers,setRestMax,restTotalCap,buildRules,renderTable,renderStats,renderAll};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,DAY=["周一","周二","周三","周四","周五","周六","周日"];

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

/* 统计本周有效标记：只算班次对得上的 */
function tally(k){
  const week=T.ensureWeek(k), mem=T.groupMembers("openClose");
  const per={}, day={};
  mem.forEach(n=> per[n]={o:0,c:0});
  for(let d=0;d<7;d++) day[d]={o:0,c:0,bad:0};
  mem.forEach(n=>{
    for(let d=0;d<7;d++){
      const rl=T.roleOf(k,n,d), sh=week[n]?week[n][d]:"";
      if(!rl) continue;
      if(rl==="open"  && sh==="early"){ per[n].o++; day[d].o++; }
      else if(rl==="close" && sh==="night"){ per[n].c++; day[d].c++; }
      else day[d].bad++;
    }
  });
  return {per, day, mem};
}

console.log("— 排班后自动分配角色 —");
T.autoSchedule();
const k=T.curKey();
const oc=S.groups.openClose;
const openN=oc.open, closeN=oc.close, maxPer=oc.maxPerWeek;
let t=tally(k);

expect(t.mem.length===9, "开店闭店组 9 人", "实际="+t.mem.length);

let dayOK=true, dayDetail=[];
for(let d=0;d<7;d++){
  if(t.day[d].o!==openN || t.day[d].c!==closeN){ dayOK=false; dayDetail.push(`${DAY[d]} 开${t.day[d].o}/${openN} 闭${t.day[d].c}/${closeN}`); }
}
expect(dayOK, `每天恰好 ${openN} 人开店 + ${closeN} 人闭店`, dayDetail.join("；"));

expect(Object.values(t.day).every(x=>x.bad===0), "没有「班次对不上」的无效标记");

const totals=t.mem.map(n=>t.per[n].o+t.per[n].c);
expect(Math.max(...totals)<=maxPer, `每人每周不超过 ${maxPer} 次`, "实际最多="+Math.max(...totals)+" 分布="+JSON.stringify(totals));
expect(Math.max(...totals)-Math.min(...totals)<=1, "分配平均（最多与最少相差 ≤1 次）", JSON.stringify(totals));

console.log("\n— 角色必须落在对应班次上 —");
const week=T.ensureWeek(k);
let mismatch=0;
t.mem.forEach(n=>{ for(let d=0;d<7;d++){
  const rl=T.roleOf(k,n,d);
  if(rl==="open"  && week[n][d]!=="early") mismatch++;
  if(rl==="close" && week[n][d]!=="night") mismatch++;
}});
expect(mismatch===0, "开店只标在早班、闭店只标在晚班", "错配="+mismatch);

console.log("\n— 重排分工 —");
const before=JSON.stringify(t.mem.map(n=>t.per[n]));
T.rerollRoles();
const t2=tally(k);
let dayOK2=true;
for(let d=0;d<7;d++){ if(t2.day[d].o!==openN || t2.day[d].c!==closeN) dayOK2=false; }
expect(dayOK2, "重排后每天人数仍达标");
const totals2=t2.mem.map(n=>t2.per[n].o+t2.per[n].c);
expect(Math.max(...totals2)<=maxPer, "重排后仍不超过上限", JSON.stringify(totals2));
expect(Math.max(...totals2)-Math.min(...totals2)<=1, "重排后仍平均", JSON.stringify(totals2));

console.log("\n— 手动标记不被自动重算覆盖 —");
// 开店名额只有 7 个、组员 9 人，有人本周分不到开店，所以要遍历全组找
let target=null;
t2.mem.forEach(n=>{ for(let d=0;d<7 && !target;d++){ if(T.roleOf(k,n,d)==="open") target={n,d}; }});
if(target){
  T.toggleRole(target.n, target.d, "open");
  expect(T.roleOf(k,target.n,target.d)==="", `${target.n} ${DAY[target.d]} 的「开店」已手动取消`);
  T.renderTable();   // 渲染会触发 syncRoles，但班次没变，不应重算
  expect(T.roleOf(k,target.n,target.d)==="", "渲染后手动取消仍然保留（未被自动重算覆盖）");
  T.toggleRole(target.n, target.d, "open");
  expect(T.roleOf(k,target.n,target.d)==="open", "再点一次可恢复");
}else{
  expect(false, "找不到可测试的开店标记");
}

console.log("\n— 班次被手动改动后自动重算 —");
const weekNow=T.ensureWeek(k);
// 找「某人当天被标开店，且当天组里还有别的早班可替补」的一天；
// 若某天组里只有 1 个早班，把他改掉后本来就没得排，属合理缺口，不该拿来测重算。
let probe=null, d0=-1;
t2.mem.forEach(n=>{
  for(let d=0; d<7 && d0<0; d++){
    if(T.roleOf(k,n,d)!=="open") continue;
    const others=t2.mem.filter(m=> m!==n && weekNow[m][d]==="early").length;
    if(others>=1){ probe=n; d0=d; }
  }
});
if(d0>=0){
  weekNow[probe][d0]="rest";       // 手动把这天改成休息，原「开店」标记随之失效
  T.renderTable();                 // 渲染时 syncRoles 检测到指纹变化 → 自动重算
  const t3=tally(k);
  expect(T.roleOf(k,probe,d0)!=="open" || weekNow[probe][d0]==="early", `${probe} ${DAY[d0]} 的失效标记已清理`);
  expect(t3.day[d0].o===openN, `${DAY[d0]} 的开店名额已由组内他人补上`, `实际=${t3.day[d0].o}/${openN}`);
  let ok3=true, det3=[];
  for(let d=0;d<7;d++){ if(t3.day[d].o!==openN || t3.day[d].c!==closeN){ ok3=false; det3.push(`${DAY[d]} 开${t3.day[d].o} 闭${t3.day[d].c}`); } }
  expect(ok3, "重算后每天人数恢复到标准", det3.join("；"));
}else{
  expect(true, "（本周没有可替补的开店日，跳过）");
}

console.log("\n— 不能给不匹配的班次标角色 —");
const week2=T.ensureWeek(k);
let restDay=-1;
for(let d=0;d<7;d++){ if(week2[t2.mem[1]][d]==="rest"){ restDay=d; break; } }
if(restDay>=0){
  T.toggleRole(t2.mem[1], restDay, "open");
  expect(T.roleOf(k,t2.mem[1],restDay)==="", "休息日不能标「开店」");
}else{
  expect(true, "（该成员本周无休息日，跳过）");
}

console.log("\n— 休息配额开关 —");
sandbox.document.getElementById("restPer").value = "3";
sandbox.document.getElementById("restTotal").value = "0";
T.setRestMax();
expect(S.restMax.per===3, "每人最多休 3 天已写入");
expect(T.restTotalCap()===3*S.staff.length, "total=0 时自动取 per×人数", "实际="+T.restTotalCap());
sandbox.document.getElementById("restTotal").value = "50";
T.setRestMax();
expect(S.restMax.total===50 && T.restTotalCap()===50, "手动设 total 生效");
sandbox.document.getElementById("restPer").value = "99";
T.setRestMax();
expect(S.restMax.per===7, "per 上限收敛到 7", "实际="+S.restMax.per);
sandbox.document.getElementById("restPer").value = "2";
sandbox.document.getElementById("restTotal").value = "0";
T.setRestMax();
expect(S.restMax.per===2 && S.restMax.total===0, "恢复默认 2 天 / 自动");

console.log("\n— 恢复默认后重排：约束仍全满足 —");
T.autoSchedule();
const t4=tally(T.curKey());
let ok4=true, det4=[];
for(let d=0;d<7;d++){ if(t4.day[d].o!==openN||t4.day[d].c!==closeN){ ok4=false; det4.push(DAY[d]); } }
const tt4=t4.mem.map(n=>t4.per[n].o+t4.per[n].c);
expect(ok4, "每天 1 开店 + 2 闭店", det4.join("、"));
expect(Math.max(...tt4)<=maxPer, "每人 ≤"+maxPer+" 次", JSON.stringify(tt4));
expect(Math.max(...tt4)-Math.min(...tt4)<=1, "平均分配", JSON.stringify(tt4));

console.log("\n— 渲染无异常 —");
let err=null;
try{ T.renderAll(); T.renderTable(); T.renderStats(); }catch(e){ err=e; }
expect(!err, "renderAll / renderTable / renderStats 不报错", err && err.message);
const rs = sandbox.document.getElementById("roleSummary").innerHTML;
expect(rs.length>0 && /重排分工/.test(rs), "统计区渲染出「开店 / 闭店分工」区块");
expect(/开 \d/.test(rs) && /闭 \d/.test(rs), "分工区块含每人的开店/闭店次数");

console.log(`\n===== 角色标记测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
