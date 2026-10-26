/* 单行「请假 / 特殊班次安排」添加路径测试
   注：原先的批量添加区域（一次提交多条）已按用户要求移除，本文件取代 test_batch.js。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},addRequest,removeRequest,clearRequests,renderReqForm,renderAll,curKey,autoSchedule,ensureWeek,conflictTypes};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,pad=i=>String(i).padStart(2,"0");

// 用表单元素驱动 addRequest（它就是真实的用户输入路径）
function setForm(staff,day,type,scope){
  sandbox.document.getElementById("reqStaff").value = staff;
  sandbox.document.getElementById("reqDay").value   = String(day);
  sandbox.document.getElementById("reqType").value  = type;
  sandbox.document.getElementById("reqScope").value = scope;
}
function has(name,day,type,scope){
  return S.requests.some(r=>r.name===name && r.day===day && r.type===type && (scope===undefined || r.scope===scope));
}

S.staff=Array.from({length:5},(_,i)=>"员工"+pad(i+1));
S.requests=[];S.schedule={};S.limits={early:3,night:4,mid:99};

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

console.log("— 单行添加 —");
setForm("员工03",2,"off","once"); T.addRequest();
expect(S.requests.length===1, "添加 1 条", "实际="+S.requests.length);
expect(has("员工03",2,"off","once"), "员工03 周三休假（临时）");

console.log("\n— 全员（__ALL__）批量落库 —");
setForm("__ALL__",5,"noearly","always"); T.addRequest();
expect(S.requests.length===1+5, "全员后共 6 条", "实际="+S.requests.length);
expect(["员工01","员工02","员工03","员工04","员工05"].every(n=>has(n,5,"noearly","always")), "5 人周六不上早班（每周固定）");

console.log("\n— 重复行升级为每周固定 —");
const before = S.requests.length;
setForm("员工03",2,"off","always"); T.addRequest();
expect(S.requests.length===before, "重复添加不新增行", "实际="+S.requests.length);
expect(has("员工03",2,"off","always"), "原「临时」升级为「每周固定」");

console.log("\n— 互斥类型自动替换 —");
setForm("员工02",4,"off","once"); T.addRequest();
expect(has("员工02",4,"off"), "员工02 周五休假 添加成功");
setForm("员工02",4,"work","once"); T.addRequest();
expect(!has("员工02",4,"off"), "旧的「休假」已被移除");
expect(has("员工02",4,"work"), "新的「必须上班」生效");

console.log("\n— 空员工不写入 —");
const b2 = S.requests.length;
S.staff=[]; setForm("",3,"off","once"); T.addRequest();
expect(S.requests.length===b2, "无人员时不写入", "实际="+S.requests.length);
S.staff=Array.from({length:5},(_,i)=>"员工"+pad(i+1));

console.log("\n— 移除与清除 —");
const id0 = S.requests[0].id;
T.removeRequest(id0);
expect(!S.requests.some(r=>r.id===id0), "按 id 删除单条");
T.clearRequests("all");
expect(S.requests.length===0, "清除全部（含每周固定）", "实际="+S.requests.length);

console.log("\n— 表单重绘与整体渲染无残留 —");
let err=null;
try{ T.renderReqForm(); T.renderAll(); }catch(e){ err=e; }
expect(!err, "renderReqForm / renderAll 不报错", err && err.message);
expect(typeof T.addRequest==="function" && typeof T.renderReqForm==="function", "单行添加入口完整");
expect(!/batchRows|submitBatch|TYPE_OPTIONS/.test(code), "批量添加残留代码已清除");

console.log("\n— 排班仍正常 —");
S.staff=Array.from({length:32},(_,i)=>"员工"+pad(i+1));S.requests=[];
S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
const t0=Date.now(); T.autoSchedule(); const wk=T.ensureWeek(T.curKey());
const filled=Object.values(wk).flat().filter(v=>v && v!=="rest").length;
expect(filled>0, "排班结果非空（填满 "+filled+" 格 / "+(Date.now()-t0)+"ms）");
expect(S.requests.length===0, "排班不反向写入请假设置");

console.log(`\n===== 安排添加测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
