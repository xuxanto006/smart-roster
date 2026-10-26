/* 用带埋点的副本，看 polishWeek 四类动作各自试了多少次、有没有出现过 s<base 的走法。
   重点：单格换班种（3cell）到底有没有被执行到。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/tmp/instr.html","utf8");
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
let shown=0, bad=0;
for(let r=0;r<ROUNDS && shown<2;r++){
  const reqs=genReqs();
  reset(); T.autoSchedule(); T.assignRoles(T.curKey());
  S.requests=reqs;
  sandbox.__TR=[];
  T.repatchWeek(true);
  const TR=sandbox.__TR||[];
  const k=T.curKey(), w=T.ensureWeek(k);
  let gap=null;
  for(let d=0;d<5;d++){
    const c=S.staff.filter(n=>w[n][d]==="early").length;
    if(c!==S.needs[d].early){ gap={d,have:c,need:S.needs[d].early}; break; }
  }
  if(!gap) continue;
  bad++;
  shown++;
  const byType={};
  TR.forEach(t=>{ const m=t[0]; byType[m]=(byType[m]||0)+1; });
  console.log(`\n━━━ 样本 #${shown}：周${gap.d+1} 早 ${gap.have}/${gap.need} ｜ polishScore=${T.polishScore(w,R0())}`);
  // 埋点里最后一次被接受的走法，事后还在不在班表里？
  const acc=TR.filter(t=>t[4]<t[5]);
  if(acc.length){
    const last=acc[acc.length-1];
    const nm=last[1], dd=(last[0]==="3cell")?last[2]:null;
    if(dd!==null) console.log(`     最后接受：${nm} 周${dd+1} → ${last[3] || "空"}（s=${last[4]}）；现在班表里是「${w[nm][dd]||"空"}」`);
    console.log(`     被接受走法共 ${acc.length} 条，末条 = ${JSON.stringify(last.slice(1))}`);
  } else console.log("     ❗ 全程没有任何一条走法能降分");
  console.log(`     埋点总尝试 ${TR.length} 次：`, JSON.stringify(byType));
  ["1swap","2self","3cell","4rest"].forEach(m=>{
    const arr=TR.filter(t=>t[0]===m);
    const good=arr.filter(t=>t[4]<t[5]);
    console.log(`     ${m}: 尝试 ${arr.length}，其中能降分 ${good.length}` + (good.length?`　例 ${good.slice(0,2).map(t=>JSON.stringify(t.slice(1))).join(" ")}`:""));
  });
}
function R0(){ return T.buildRules(T.curKey()); }
console.log(`\n═══ ${ROUNDS} 轮中 ${bad} 轮早班不恰好，打印 ${shown} 个 ═══`);
