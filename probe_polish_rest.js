/* 定位 polish 是否会把某人的休息天数改多（滑落「每人恰好休 N 天」）。
   做法：包住 polishWeek，前后各数一次每人的 v==="rest" 天数，报告增多的情形。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox; vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

// 包住 polishWeek：进入前后各数一次每人休息天数
const orig=sandbox.polishWeek;
let hits=0, examples=[];
sandbox.polishWeek=function(week,R,k){
  const before={};
  S.staff.forEach(n=> before[n]=(week[n]||[]).filter(v=>v==="rest"||v==="").length);
  const r=orig(week,R,k);
  S.staff.forEach(n=>{
    const after=(week[n]||[]).filter(v=>v==="rest"||v==="").length;
    if(after>before[n]){
      hits++;
      if(examples.length<6)
        examples.push(`${n}: 休${before[n]} → 休${after} ｜ 该周班表 ${JSON.stringify(week[n])}`);
    }
  });
  return r;
};

const ROUNDS=+(process.argv[2]||40), NREQ=+(process.argv[3]||2);
const rnd=n=>Math.floor(Math.random()*n);
const TYPES=["off","off","off","work","early","mid","night","noearly","nomid","nonight"];
function reset(reqs){
  S.staff=T.DEFAULT_STAFF.slice();
  S.needs=[0,1,2,3,4].map(()=>({early:8,mid:1,night:10})).concat([5,6].map(()=>({early:9,mid:3,night:12})));
  S.limits={early:3,night:4,mid:99}; S.restMax={per:2,total:0}; S.exactShifts=["early"];
  S.weekendEarlyMax=1; S.requests=reqs||[]; S.schedule={}; S.roles={}; S.roleSig={}; S.manual={};
  S.mustWork=[{name:"陈悦娴",day:0},{name:"张淑慧",day:0}];
  S.groups={earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"],minEarly:1,minNight:1},
            openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"],open:1,close:2,maxPerWeek:3}};
}
for(let i=0;i<ROUNDS;i++){
  const reqs=[];
  for(let j=0;j<NREQ;j++) reqs.push({id:j+1,name:S.staff[rnd(S.staff.length)],day:rnd(7),type:TYPES[rnd(TYPES.length)],scope:"once",weekKey:T.curKey()});
  reset();
  T.autoSchedule();
  S.requests=reqs;
  T.repatchWeek(true);
}
console.log(`polish 把某人休息天数改多的次数：${hits}（${ROUNDS} 轮）`);
examples.forEach(e=>console.log("  · "+e));
