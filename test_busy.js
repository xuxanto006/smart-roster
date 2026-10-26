/* 忙碌态包装 runBusy：排班 / 微调是同步重活，必须先切忙碌态再跑。
   硬性要求：
     1. 跑之前按钮已 disabled + 文案变成「正在…」+ 带上 is-busy；
     2. 真正的动作确实被执行；
     3. 跑完必须复原（启用 + 原文案 + 去掉 is-busy）—— 否则按钮会永久卡死；
     4. 动作抛异常时也必须复原（不能把按钮留在禁用态）；
     5. 忙碌期间重复点击不重复执行。
   注：本测试把 setTimeout 换成同步执行，这样能在测试里观察到「跑之前」的状态。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function makeEl(id){
  const cls=new Set();
  return {id, value:"", textContent:"", innerHTML:"", style:{}, options:[], disabled:false,
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), toggle(){}, contains:c=>cls.has(c)},
    _cls:cls, getAttribute(){return null}, setAttribute(){}, click(){}, appendChild(){}, addEventListener(){}, remove(){}};
}
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return makeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={runBusy,runAutoSchedule,runRepatch,get state(){return state}};",sandbox,{filename:"s"});
const T=sandbox.__T;

let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

console.log("══════ 忙碌态包装测试 ══════\n");
const btn = els["probeBtn"] = makeEl("probeBtn");
btn.innerHTML = "原始文案";

/* 1~3：正常流程 */
let ran=0, snap=null;
T.runBusy(btn, '<span class="spin"></span>正在排班…', function(){
  ran++;
  snap={disabled:btn.disabled, html:btn.innerHTML, busy:btn._cls.has("is-busy")};
});
expect(ran===1, "动作确实被执行了 1 次", "实际 "+ran);
expect(snap && snap.disabled===true, "跑之前按钮已禁用（防重复点击）");
expect(snap && /正在排班/.test(snap.html) && /spin/.test(snap.html), "跑之前文案换成「正在排班…」且带转圈");
expect(snap && snap.busy===true, "跑之前带上了 is-busy 样式");
expect(btn.disabled===false, "跑完之后恢复可点", "仍禁用");
expect(btn.innerHTML==="原始文案", "跑完之后文案恢复原文", "实际「"+btn.innerHTML+"」");
expect(btn._cls.has("is-busy")===false, "跑完之后去掉 is-busy");

/* 4：动作抛异常也必须复原 */
let threw=false;
try{
  T.runBusy(btn, "忙碌", function(){ throw new Error("boom"); });
}catch(e){ threw=true; }
expect(threw, "动作抛的异常继续往外抛（不吞掉）");
expect(btn.disabled===false && btn.innerHTML==="原始文案" && !btn._cls.has("is-busy"),
       "动作抛异常后按钮照样复原", `disabled=${btn.disabled} 文案=「${btn.innerHTML}」`);

/* 5：忙碌期间重复点击不重复执行（跑之前再点一次） */
ran=0;
T.runBusy(btn, "忙碌", function(){ ran++; T.runBusy(btn, "忙碌", function(){ ran+=100; }); });
expect(ran===1, "忙碌期间再次调用不会重复执行", "实际执行计数 "+ran);

/* 6：两个真实按钮的接线正确 —— 点下去要真的调用对应算法，且按钮复原 */
["autoSchedule","repatchWeek"].forEach((name,idx)=>{
  const id = idx===0 ? "autoBtn" : "repatchBtn";
  const el = sandbox.document.getElementById(id);   // 脚本初始化时没碰过这两个按钮，需先建出来
  const origin = el.innerHTML = idx===0 ? '<span class="petal-chip"></span>一键智能排班（本周）' : '🔄 按请假/改班微调';
  let called=0;
  vm.runInContext(`globalThis.__orig_${name}=${name}; ${name}=function(){ globalThis.__called_${name}=(globalThis.__called_${name}||0)+1; };`, sandbox);
  if(idx===0) T.runAutoSchedule(); else T.runRepatch();
  const n = sandbox[`__called_${name}`]||0;
  expect(n===1, `${id} 点一下确实调用了 ${name}()`, "调用次数 "+n);
  expect(el.disabled===false && el.innerHTML===origin, `${id} 跑完复原`, `disabled=${el.disabled}`);
  vm.runInContext(`${name}=globalThis.__orig_${name};`, sandbox);
});

console.log("\n══════════════════════════════");
console.log(`===== 忙碌态测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
