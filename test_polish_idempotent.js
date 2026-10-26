/* 不变量：polishWeek 必须收敛到局部最优 —— 再调一次必须是「0 步」。
   这条专防一类极隐蔽的 bug：动作被「接受」时记了分（base 降了），
   但紧接着又被回滚分支用过期旧值擦掉，于是「分数说修好了、班表其实没动」。
   这种情况下第二次调用还能继续降分，就会跑出 >0 步。
   顺带断言：微调后若确实存在能降分的单格走法，说明 polish 漏了。 */
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
const ROUNDS=+(process.argv[2]||25), NREQ=+(process.argv[3]||2);
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
let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

console.log("══════ polishWeek 收敛性测试（"+ROUNDS+" 轮 × "+NREQ+" 条安排）══════\n");
let notConverged=0, leftover=0, worst=null;
for(let r=0;r<ROUNDS;r++){
  const reqs=genReqs();
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  S.requests=reqs;
  T.repatchWeek(true);
  const k=T.curKey(), w=T.ensureWeek(k), R=T.buildRules(k);
  const before=T.polishScore(w,R);
  // ① 第二次调用必须 0 步（已到局部最优）
  const steps2=T.polishWeek(w,R,k);
  const after=T.polishScore(w,R);
  if(steps2>0){
    notConverged++;
    if(!worst) worst=`第${r+1}轮：二次调用又走了 ${steps2} 步（${before}→${after}）`;
  }
  // ② 若还有能降分的单格走法，说明第一次没修干净
  if(before>0){
    let miss=0;
    S.staff.forEach(n=>{
      for(let d=0;d<7;d++){
        const c=R[n][d]; if(c.off||c.only) continue;
        const old=w[n][d]||"";
        ["early","mid","night",""].forEach(sh=>{
          if(sh===old) return;
          if(sh && c.ban[sh]) return;
          w[n][d]=sh;
          if(T.polishScore(w,R) < after) miss++;
          w[n][d]=old;
        });
      }
    });
    if(miss>0){ leftover++; if(!worst) worst=`第${r+1}轮：仍有 ${miss} 个能降分的单格走法没走`; }
  }
}
expect(notConverged===0, `第二次调用 polishWeek 必须 0 步（已收敛）`, `未收敛 ${notConverged} 轮，例：${worst}`);
expect(leftover===0, `收敛后不存在能继续降分的单格走法`, `漏了 ${leftover} 轮，例：${worst}`);
console.log("\n══════════════════════════════");
console.log(`===== polishWeek 收敛性测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
