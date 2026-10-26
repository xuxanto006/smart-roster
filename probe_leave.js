/** 带请假排班的失败样本取证：把违规那几轮的完整形态打出来 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,buildRules,curKey,ensureWeek,checkRuleViolations,isolatedRestCount,groupMembers,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
const DAY=["周一","周二","周三","周四","周五","周六","周日"];
const SH={early:"早",mid:"中",night:"晚",rest:"休","":"空"};

function reset(reqs){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.schedule={}; S.roles={}; S.roleSig={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.requests = reqs || [];
}
function audit(w){
  const R=T.buildRules(T.curKey());
  const out=[];
  T.checkRuleViolations(w,R).forEach(function(x){ out.push(x); });
  (S.mustWork||[]).forEach(function(m){
    const v=w[m.name]?w[m.name][m.day]:"";
    if(v==="rest"||!v) out.push(`固定上班日违反：${m.name} ${DAY[m.day]}`);
  });
  S.staff.forEach(function(n){
    var s=new Set();
    for(var d=0;d<7;d++) if(w[n][d]==="rest"||!w[n][d]) s.add(d);
    if(T.isolatedRestCount(s)>0) out.push(`${n}|ISO|${[...s].sort(function(a,b){return a-b;}).map(function(d){return DAY[d];}).join("")}`);
    const r=(w[n]||[]).filter(function(v){return v==="rest";}).length;
    if(r!==2) out.push(`${n}|REST${r}|${[...s].sort(function(a,b){return a-b;}).map(function(d){return DAY[d];}).join("")}`);
  });
  for(var d=0;d<7;d++){
    var en=T.groupMembers("earlyNight"), oc=T.groupMembers("openClose");
    if(en.filter(function(n){return w[n][d]==="early";}).length<1) out.push(`GRP|${DAY[d]} 保障组早班缺`);
    if(en.filter(function(n){return w[n][d]==="night";}).length<1) out.push(`GRP|${DAY[d]} 保障组晚班缺`);
    if(oc.filter(function(n){return w[n][d]==="early";}).length<1) out.push(`GRP|${DAY[d]} 开店缺`);
    if(oc.filter(function(n){return w[n][d]==="night";}).length<2) out.push(`GRP|${DAY[d]} 闭店缺`);
  }
  return out;
}

const WANT=+(process.argv[2]||6), MAXTRY=+(process.argv[3]||400);
let found=0, tried=0;
const kinds={};
while(found<WANT && tried<MAXTRY){
  tried++;
  const reqs=[]; let id=1; const used={};
  while(reqs.length<3){
    const n=S.staff[Math.floor(Math.random()*S.staff.length)];
    const d=Math.floor(Math.random()*7);
    if(used[n+"|"+d]) continue;
    if(S.mustWork.some(function(m){return m.name===n&&m.day===d;})) continue;
    used[n+"|"+d]=1;
    reqs.push({id:id++, name:n, day:d, type:"off", scope:"once", weekKey:T.curKey()});
  }
  reset(reqs);
  T.autoSchedule();
  const w=T.ensureWeek(T.curKey());
  const bad=audit(w);
  if(!bad.length) continue;
  found++;
  bad.forEach(function(x){ const k=x.split("|")[1]||x.split(" ")[0]; kinds[k]=(kinds[k]||0)+1; });
  console.log("\n──────── 失败样本 #" + found + "（第 " + tried + " 轮）────────");
  console.log("  请假：" + reqs.map(function(r){return r.name+" "+DAY[r.day];}).join("，"));
  bad.forEach(function(x){ console.log("  ❌ " + x); });
  // 把涉案人员的整周打出来
  const who = bad.map(function(x){ return x.split("|")[0]; }).filter(function(n){ return S.staff.indexOf(n)>=0; });
  [...new Set(who)].slice(0,3).forEach(function(n){
    const row = w[n].map(function(v,d){ return DAY[d].slice(1)+":"+SH[v||""]; }).join(" ");
    const R=T.buildRules(T.curKey());
    const rules=[];
    for(let d=0;d<7;d++){
      const c=R[n][d];
      if(c&&c.off) rules.push(DAY[d]+"请假");
      if(c&&c.noOff&&!c.only) rules.push(DAY[d]+"不排休");
      if(c&&c.only) rules.push(DAY[d]+"固定"+SH[c.only]);
    }
    console.log("    " + n + " → " + row + "   [" + (rules.join("，")||"无规则") + "]");
  });
}
console.log("\n══════════════════════════════");
console.log("尝试 " + tried + " 轮，抓到 " + found + " 个违规样本");
console.log("违规类型分布：");
Object.keys(kinds).sort(function(a,b){return kinds[b]-kinds[a];}).forEach(function(k){ console.log("  " + kinds[k] + " × " + k); });
