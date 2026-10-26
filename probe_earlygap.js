/* 定位：微调后「工作日早班恰好 8」为什么补不回来。
   对每个失败轮次，把缺口那天的全景打出来：
   - 当天各班次实到 / 需求
   - 当天休息的人里，谁手上有早班（理论上可以挪过来）
   - 这些人的早班次数是否顶到上限 3 */
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
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,polishScore,polishWeek,assignRoles,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
const ROUNDS=+(process.argv[2]||20), NREQ=+(process.argv[3]||2);
const rnd=n=>Math.floor(Math.random()*n);
const TYPES=["off","off","off","work","early","mid","night","noearly","nomid","nonight"];
const SHCN={early:"早",mid:"中",night:"晚"};
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
let shown=0, bad=0;
for(let r=0;r<ROUNDS && shown<3;r++){
  const reqs=genReqs();
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  S.requests=reqs;
  T.repatchWeek(true);
  const k=T.curKey(), w=T.ensureWeek(k), R=T.buildRules(k);
  const gaps=[];
  for(let d=0;d<5;d++){
    const c=S.staff.filter(n=>w[n][d]==="early").length;
    if(c!==S.needs[d].early) gaps.push({d,have:c,need:S.needs[d].early});
  }
  if(!gaps.length) continue;
  bad++;
  if(shown>=3) continue;
  shown++;
  console.log(`\n━━━ 失败样本 #${shown}（第 ${r+1} 轮）请假：${S.requests.map(x=>x.name+"周"+(x.day+1)+x.type).join("、")}`);
  gaps.forEach(g=>{
    const d=g.d;
    const cnt={early:0,mid:0,night:0,rest:0,empty:0};
    S.staff.forEach(n=>{ const v=w[n][d]||""; if(v==="rest")cnt.rest++; else if(v==="")cnt.empty++; else cnt[v]++; });
    console.log(`  周${d+1}：早 ${cnt.early}/${S.needs[d].early}  中 ${cnt.mid}/${S.needs[d].mid}  晚 ${cnt.night}/${S.needs[d].night}  休 ${cnt.rest}  空 ${cnt.empty}  （差 ${g.need-g.have}）`);
    // 当天休息 / 空闲的人里，谁身上有早班（理论上可挪过来）
    const free=S.staff.filter(n=>{ const v=w[n][d]||""; return v==="rest"||v===""; });
    const info=free.map(n=>{
      const arr=w[n]||[];
      const earlys=[0,1,2,3,4,5,6].filter(x=>arr[x]==="early");
      const off = R[n][d].off, only=R[n][d].only, noOff=R[n][d].noOff;
      return {n, earlys:earlys.length, days:earlys.map(x=>x+1).join("/"), locked:(off?"off ":"")+(only?"only ":"")+(noOff?"noOff":"")};
    });
    const movable=info.filter(x=>x.earlys>0 && !x.locked.includes("off"));
    console.log(`     当天不干活 ${free.length} 人，其中手里有早班且当天没被锁：${movable.length} 人`);
    movable.slice(0,6).forEach(x=> console.log(`       · ${x.n}：早班 ${x.earlys} 次（周${x.days}）${x.locked?" 锁:"+x.locked:""}`));
    if(!movable.length) console.log("       ❗ 没有一个人能把早班挪过来（要么没早班，要么当天被规则锁死）");
  });
  console.log(`     polishScore 结果分 = ${T.polishScore(T.ensureWeek(k), R)}`);
  // 穷举所有「单格换班种」，看是否存在能降分的走法（存在却没走 = polish 漏了）
  const cur0 = T.polishScore(w, R);
  const cand=[];
  S.staff.forEach(n=>{
    for(let d=0;d<7;d++){
      const c=R[n][d]; if(c.off||c.only) continue;
      const old=w[n][d]||"";
      ["early","mid","night",""].forEach(sh=>{
        if(sh===old) return;
        if(sh && c.ban[sh]) return;
        w[n][d]=sh;
        const s=T.polishScore(w,R);
        if(s<cur0) cand.push({n,d,sh,old,gain:cur0-s});
        w[n][d]=old;
      });
    }
  });
  const bestTxt = cand.slice(0,3).map(function(x){
    return x.n + "周" + (x.d+1) + " " + (x.old||"空") + "→" + (x.sh||"空") + "(-" + x.gain + ")";
  }).join("、");
  console.log(`     单格穷举：能降分的走法 ${cand.length} 个` + (cand.length ? `　最佳 ${bestTxt}` : ""));
  // 穷举同一天两人互换
  const cand2=[];
  for(let d=0;d<7;d++) for(let i=0;i<S.staff.length;i++) for(let j=i+1;j<S.staff.length;j++){
    const n1=S.staff[i],n2=S.staff[j];
    const a=w[n1][d]||"",b=w[n2][d]||"";
    if(a===b||!a||!b||a==="rest"||b==="rest") continue;
    if(R[n1][d].off||R[n1][d].only||R[n2][d].off||R[n2][d].only) continue;
    w[n1][d]=b;w[n2][d]=a;
    const s=T.polishScore(w,R);
    if(s<cur0) cand2.push(`${n1}↔${n2}周${d+1}(-${cur0-s})`);
    w[n1][d]=a;w[n2][d]=b;
  }
  console.log(`     同日互换穷举：能降分的走法 ${cand2.length} 个` + (cand2.length ? `　如 ${cand2.slice(0,3).join("、")}` : ""));
  // 关键验证：再调一次 polishWeek，若立刻修好，说明第一次是被时间预算 / 动作顺序饿死的
  const before2 = T.polishScore(w, R);
  const t0 = Date.now();
  const steps2 = T.polishWeek(w, R, k);
  const after2 = T.polishScore(w, R);
  console.log(`     ★ 再跑一次 polishWeek：${before2} → ${after2}（${steps2} 步，耗时 ${Date.now()-t0}ms）`);
}
console.log(`\n═══ ${ROUNDS} 轮中 ${bad} 轮早班人数不恰好，打印了前 ${shown} 个样本 ═══`);
