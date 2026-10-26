/* 诊断：带请假时「每天 1 人开店」偶发失败（实测 1/150）到底是什么成因。
   两种可能：
   A. 那天开店闭店组没人上早班 —— 排班阶段没给这组留早班名额（算法问题）
   B. 有人上早班，但都已被「每人每周 ≤3 次」卡住（容量/分配问题）
   两者修法完全不同，必须先分清。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,groupMembers,assignRoles,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const ROUNDS=+(process.argv[2]||400);
const rnd=n=>Math.floor(Math.random()*n);
function reset(){
  S.staff = T.DEFAULT_STAFF.slice();
  S.needs = [{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={};
  // 与 audit_all_rules 保持一致：陈悦娴、张淑慧 周一固定上班（两人都在开店闭店组）
  S.mustWork = process.argv[3]==="nomw" ? [] : [{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups = {
    earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"], open:1, close:2, maxPerWeek:3}
  };
}

let failA=0, failB=0, total=0, samples=[];
for(let r=0;r<ROUNDS;r++){
  reset();
  const cnt=2+rnd(2), used={}; let id=1;
  while(S.requests.length<cnt){
    const n=S.staff[rnd(S.staff.length)], d=rnd(7), key=n+"|"+d;
    if(used[key]) continue; used[key]=1;
    S.requests.push({id:id++,name:n,day:d,type:"off",scope:"once",weekKey:T.curKey()});
  }
  T.autoSchedule();
  const k=T.curKey(), w=T.ensureWeek(k);
  T.assignRoles(k);
  const roles=S.roles[k]||{};
  const oc=T.groupMembers("openClose");
  const leaveOf={};
  S.requests.forEach(x=>{ (leaveOf[x.name]=leaveOf[x.name]||new Set()).add(x.day); });

  for(let d=0; d<7; d++){
    const openCnt = oc.filter(n=>(roles[n]||[])[d]==="open").length;
    if(openCnt>=1) continue;
    total++;
    const earlyMem = oc.filter(n=>w[n][d]==="early");
    const cntOf = n => (roles[n]||[]).filter(x=>x==="open"||x==="close").length;
    const capped = earlyMem.filter(n=>cntOf(n)>=3);
    if(earlyMem.length===0){
      failA++;
      if(samples.length<6) samples.push(`【A 没人上早班】周${d+1}｜该组当天班次：` +
        oc.map(n=>n+":"+(w[n][d]==="rest"||!w[n][d]?"休":w[n][d])).join(" "));
    }else{
      failB++;
      if(samples.length<6) samples.push(`【B 有早班但都被卡】周${d+1}｜早班者：` +
        earlyMem.map(n=>`${n}(已${cntOf(n)}次)`).join(" "));
    }
  }
}
console.log("══════ 「每天 1 人开店」失败诊断（"+ROUNDS+" 轮带请假）══════");
console.log("  失败总次数：" + total);
console.log("  A 该组当天没人上早班（排班没留名额 → 算法问题）：" + failA);
console.log("  B 有人上早班但都被 ≤3 次卡住（分配问题）：      " + failB);
console.log("");
samples.forEach(s=>console.log("  " + s));
