/* 一个人请多天假：每个请假日都必须是「休」，不能变成「空」。
   曾经的 bug：repatchWeek 第①步为了让出休息名额，会去找「另一个休息日」清成待排，
   同人请两天假时，第二个假日会把第一个假日（刚被设成 rest）当成可让出的名额清掉。 */
const fs=require("fs"),vm=require("vm");
const FILE=process.argv[2] || "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const html=fs.readFileSync(FILE,"utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,assignRoles,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
function reset(){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:8,mid:1,night:10})).concat([5,6].map(()=>({early:9,mid:3,night:12})));
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=[]; S.schedule={}; S.roles={}; S.roleSig={}; S.manual={};
  S.mustWork=[];
  S.groups={earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"],minEarly:1,minNight:1},
            openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"],open:1,close:2,maxPerWeek:3}};
}
let pass=0,fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

console.log("══════ 同人多天请假测试 ══════\n");
const DAYS=[[0,3],[1,4],[2,5],[0,6],[1,3,5],[2,4,6],[0,2,4,6]];
let emptyHit=0, restHit=0, cases=0;
for(const days of DAYS){
  for(const who of ["高超","陈悦娴","孙勇"]){
    reset(); T.autoSchedule(); T.assignRoles(T.curKey());
    S.requests = days.map((d,i)=>({id:i+1, name:who, day:d, type:"off", scope:"once", weekKey:T.curKey()}));
    T.repatchWeek(true);
    const w=T.ensureWeek(T.curKey());
    cases++;
    const vals = days.map(d=>w[who][d]||"空");
    if(vals.some(v=>v!=="rest")){
      restHit++;
      if(emptyHit+restHit<=4) console.log(`     · ${who} 请 ${days.map(d=>"周"+(d+1)).join("、")} → ${vals.join("、")}`);
    }
    if(vals.some(v=>v==="空")) emptyHit++;
  }
}
expect(restHit===0, `请假日一律是「休」（${cases} 组：3 人 × 1~4 天假）`, `${restHit} 组出现非休`);
expect(emptyHit===0, `请假日绝不出现「空」（未安排）`, `${emptyHit} 组出现空格`);

/* 两天假时，这人整周应恰好休 2 天 —— 请假日顶掉原来的两个休息日 */
reset(); T.autoSchedule(); T.assignRoles(T.curKey());
S.requests=[{id:1,name:"高超",day:1,type:"off",scope:"once",weekKey:T.curKey()},
            {id:2,name:"高超",day:4,type:"off",scope:"once",weekKey:T.curKey()}];
T.repatchWeek(true);
const w=T.ensureWeek(T.curKey());
const restDays=[0,1,2,3,4,5,6].filter(d=>w["高超"][d]==="rest");
const empties=[0,1,2,3,4,5,6].filter(d=>!w["高超"][d]);
expect(restDays.join(",")==="1,4", `请周2+周5 假 → 这两天就是他的休息日`, `实际休息日 ${restDays.map(d=>"周"+(d+1)).join("、")}`);
expect(empties.length===0, `其余 5 天都排上班，没有空格`, `空格 ${empties.map(d=>"周"+(d+1)).join("、")}`);

console.log("\n══════════════════════════════");
console.log(`===== 多天请假测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
