/* 预检准确率压测：随机请假组合下，
   「录入期预检说会冲突」与「排完班体检面板真的报上一休一」是否一致。
   一边漏报（排完才发现）一边误报（吓唬人）都要抓出来。 */
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
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,renderAll,renderRequestConflict,renderHealth,hasRestPlan,isolatedRestCount,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

function reset(){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[];
}
const txt = id => { const e=els[id]; return e? (e.innerHTML||e.textContent||"") : ""; };
const rnd = n => Math.floor(Math.random()*n);
const pick = (arr,k) => { const a=arr.slice(); const o=[]; while(o.length<k && a.length) o.push(a.splice(rnd(a.length),1)[0]); return o; };

const ROUNDS = +(process.argv[2]||150);
let agree=0, missed=[], falseAlarm=[], counted=0;

for(let r=0;r<ROUNDS;r++){
  reset();
  // 随机 1~3 个人，每人随机 1~2 天假（1~2 天是日常最常见的形态）
  const people = pick(S.staff, 1+rnd(3));
  const cfg = [];
  people.forEach(n=>{
    const days = pick([0,1,2,3,4,5,6], 1+rnd(2));
    days.forEach((d,i)=> S.requests.push({id:r*100+i, name:n, day:d, type:"off", scope:"once", weekKey:T.curKey()}));
    cfg.push(n+"("+days.sort((a,b)=>a-b).join(",")+")");
  });
  T.renderRequestConflict();
  const predicted = /上一休一/.test(txt("reqConflict"));

  T.autoSchedule();
  T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
  const health = txt("healthBox");
  const actual = /上一休一/.test(health);

  counted++;
  if(predicted === actual) agree++;
  else if(actual && !predicted) missed.push(cfg.join(" "));
  else falseAlarm.push(cfg.join(" "));
}

console.log("══════ 预检准确率（"+ROUNDS+" 轮随机请假）══════");
console.log("  预检与实际一致：" + agree + " / " + counted +
            "  (" + (agree/counted*100).toFixed(1) + "%)");
console.log("  漏报（预检没说、排完才炸）：" + missed.length + (missed.length? "  ❌" : "  ✅"));
missed.slice(0,8).forEach(m=>console.log("      - " + m));
console.log("  误报（预检说会炸、实际没炸）：" + falseAlarm.length + (falseAlarm.length? "  ❌" : "  ✅"));
falseAlarm.slice(0,8).forEach(m=>console.log("      - " + m));
