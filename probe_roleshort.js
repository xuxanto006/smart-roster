/* 定位：微调后「每天 1 人开店 / 2 人闭店」为什么兜不住。
   对失败轮次打出：开店闭店组 9 人各自的早班日 / 晚班日，以及角色分配次数。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,groupMembers,assignRoles,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
const ROUNDS=+(process.argv[2]||40), NREQ=+(process.argv[3]||3);
const rnd=n=>Math.floor(Math.random()*n);
const TYPES=["off","off","off","work","early","mid","night","noearly","nomid","nonight"];
function reset(){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:8,mid:1,night:10})).concat([5,6].map(()=>({early:9,mid:3,night:12})));
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={}; S.manual={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups={earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"],minEarly:1,minNight:1},
            openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"],open:1,close:2,maxPerWeek:3}};
}
function genReqs(){
  const used={},out=[];let id=1;
  while(out.length<NREQ){
    const n=S.staff[rnd(S.staff.length)],d=rnd(7),key=n+"|"+d;
    if(used[key])continue; used[key]=1;
    out.push({id:id++,name:n,day:d,type:TYPES[rnd(TYPES.length)],scope:"once",weekKey:T.curKey()});
  }
  return out;
}
let shown=0,bad=0;
for(let r=0;r<ROUNDS && shown<3;r++){
  const reqs=genReqs();
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  S.requests=reqs;
  T.repatchWeek(true);
  const k=T.curKey(), w=T.ensureWeek(k);
  const oc=T.groupMembers("openClose");
  const roles=S.roles[k]||{};
  const shortDays=[];
  for(let d=0;d<7;d++){
    const o=oc.filter(n=>(roles[n]||[])[d]==="open").length;
    const c=oc.filter(n=>(roles[n]||[])[d]==="close").length;
    if(o<1||c<2) shortDays.push({d,o,c});
  }
  if(!shortDays.length) continue;
  bad++; shown++;
  console.log(`\n━━━ 样本 #${shown}（第 ${r+1} 轮）`);
  shortDays.forEach(x=> console.log(`     周${x.d+1}：开店 ${x.o}/1　闭店 ${x.c}/2`));
  console.log("     开店闭店组 9 人的早班日 / 晚班日 / 角色次数：");
  oc.forEach(n=>{
    const e=[0,1,2,3,4,5,6].filter(d=>w[n][d]==="early").map(d=>d+1).join("")||"-";
    const g=[0,1,2,3,4,5,6].filter(d=>w[n][d]==="night").map(d=>d+1).join("")||"-";
    const c=(roles[n]||[]).filter(x=>x==="open"||x==="close").length;
    console.log(`       ${n.padEnd(4)} 早[${e}]  晚[${g}]  角色 ${c} 次`);
  });
  // 理论可行性：open 需 7 人次、close 需 14 人次，每人≤3
  const eDistinct=oc.filter(n=>[0,1,2,3,4,5,6].some(d=>w[n][d]==="early"));
  const gDistinct=oc.filter(n=>[0,1,2,3,4,5,6].some(d=>w[n][d]==="night"));
  const eCap=eDistinct.reduce((s,n)=>s+Math.min(3,[0,1,2,3,4,5,6].filter(d=>w[n][d]==="early").length),0);
  const gCap=gDistinct.reduce((s,n)=>s+Math.min(3,[0,1,2,3,4,5,6].filter(d=>w[n][d]==="night").length),0);
  console.log(`     有效人次上限：开店可用 ${eCap}（需 7）　闭店可用 ${gCap}（需 14）`);
  // 关键：角色标记是不是没跟着刷新？直接重跑一次 assignRoles 看看
  const sigBefore=S.roleSig[k];
  const info=T.assignRoles(k);
  const roles2=S.roles[k]||{};
  const short2=[];
  for(let d=0;d<7;d++){
    const o=oc.filter(n=>(roles2[n]||[])[d]==="open").length;
    const c=oc.filter(n=>(roles2[n]||[])[d]==="close").length;
    if(o<1||c<2) short2.push(`周${d+1}(开${o}/闭${c})`);
  }
  console.log(`     ★ 重跑 assignRoles：short=${info.short}，仍缺 ${short2.length?"的 "+short2.join("、"):"无"}`);
  console.log(`       roleSig 是否等于当前班表指纹：${sigBefore===S.roleSig[k]?"是（说明之前那次就是最新的，不是没刷新）":"否（说明之前是旧的！）"}`);
}
console.log(`\n═══ ${ROUNDS} 轮中 ${bad} 轮开店闭店兜不住，打印 ${shown} 个 ═══`);
