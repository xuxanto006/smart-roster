/** 周一 陈悦娴 / 张淑慧 实际被排到什么班？跑 N 次统计分布 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,roleOf,groupMembers,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
S.staff=T.DEFAULT_STAFF.slice();
S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];

const N=+(process.argv[2]||60);
const NAME={early:"早班",mid:"中班",night:"晚班",rest:"休息"};
const tally={}, role={}, sample=[];
["陈悦娴","张淑慧"].forEach(function(n){ tally[n]={}; role[n]={}; });

for(let i=0;i<N;i++){
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey());
  ["陈悦娴","张淑慧"].forEach(function(n){
    const v=w[n][0];
    tally[n][v]=(tally[n][v]||0)+1;
    const r=T.roleOf(T.curKey(),n,0)||"无标记";
    role[n][r]=(role[n][r]||0)+1;
  });
  if(i<5) sample.push("第"+(i+1)+"次：陈悦娴="+NAME[w["陈悦娴"][0]]+"，张淑慧="+NAME[w["张淑慧"][0]]);
}

console.log("══════ 周一班次分布（跑 " + N + " 次排班）══════");
["陈悦娴","张淑慧"].forEach(function(n){
  console.log("\n【" + n + "】" + (T.groupMembers("openClose").indexOf(n)>=0 ? "（开店闭店组成员）" : ""));
  Object.keys(tally[n]).sort(function(a,b){return tally[n][b]-tally[n][a];}).forEach(function(k){
    var pct=Math.round(tally[n][k]/N*100);
    console.log("  " + NAME[k] + "：" + tally[n][k] + " 次（" + pct + "%）");
  });
  console.log("  角色标记：" + Object.keys(role[n]).map(function(r){return r+" "+role[n][r]+"次";}).join("，"));
});
console.log("\n— 前 5 次实际结果 —");
sample.forEach(function(s){ console.log("  " + s); });
console.log("\n结论：周一两人必定上班，但具体班次由随机贪心决定，每次排班都可能不同。");
console.log("若要固定成某个班，用「请假 / 特殊班次安排」→ 类型选「固定早班 / 固定中班 / 固定晚班」+ 每周固定。");
