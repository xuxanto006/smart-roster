/* 定位 3 连休为何修不掉：把违规者的班表和约束全列出来 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){},querySelectorAll(){return[]},querySelector(){return fakeEl("q")},children:[],dataset:{}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,getStaffProfile,buildRules,run3RestCount,isolatedRestCount,restRange,moduleMinOn,domainStaff,isBlockedFromSchedule,fixRun3Rest,fixRestRange,fixIsolatedRest};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
const DAY=["周一","周二","周三","周四","周五","周六","周日"];
const LIM=S.limits;

function rs(week,n){ const s=new Set(); for(let d=0;d<7;d++){ const v=(week[n]||[])[d]; if(v==="rest"||v==="") s.add(d); } return s; }

let found=0;
for(let trial=0; trial<14 && found<3; trial++){
  S.restMax={min:2,per:3,total:0};
  ["restMaxHM","restMaxMgr","restMaxAS"].forEach(f=>{ if(S[f]) S[f]={min:2,per:3,total:0}; });
  S.moduleMinOn=1;
  S.domain="3c";
  T.autoSchedule("3c");
  const k=T.curKey(), week=T.ensureWeek(k), R=T.buildRules(k);
  const bad=T.domainStaff("3c").filter(n=>!T.isBlockedFromSchedule(n) && T.run3RestCount(rs(week,n))>0);
  if(!bad.length) continue;
  found++;
  console.log(`\n########## 试${trial}：${bad.length} 人 3 连休 ##########`);
  bad.forEach(n=>{
    const arr=week[n];
    const set=rs(week,n);
    const trips=[];
    for(let d=0;d<7;d++) if(set.has(d)&&set.has((d+1)%7)&&set.has((d+2)%7)) trips.push(d);
    const cnt={early:0,mid:0,night:0};
    arr.forEach(v=>{ if(cnt[v]!==undefined) cnt[v]++; });
    const disp=arr.map(v=>v==="rest"||v===""?"r":(v==="early"?"E":v==="mid"?"M":"N")).join(" ");
    console.log(`\n ${n}（模块 ${T.getStaffProfile(n).module}）`);
    console.log(`   班表: ${disp}`);
    console.log(`   休息日: ${[...set].sort().map(d=>DAY[d]).join("、")}  共${set.size}天`);
    console.log(`   3连休起点: ${trips.map(d=>DAY[d]).join("、")}`);
    console.log(`   班次计数: 早${cnt.early}/中${cnt.mid}/晚${cnt.night}  上限 早${LIM.early}/晚${LIM.night}`);
    console.log(`   孤立休息数: ${T.isolatedRestCount(set)}`);
    // 对每个休息日，能否改成某个班次
    console.log(`   可改性分析（休息日 → 能否改上班）:`);
    for(let d=0;d<7;d++){
      if(!set.has(d)) continue;
      const c=R[n]&&R[n][d];
      const why=[];
      if(c&&c.off) why.push("请假");
      if(c&&c.only) why.push("固定"+c.only);
      if(c&&c.noOff) why.push("必须上班");
      const options=[];
      for(const sh of ["early","mid","night"]){
        if(c&&c.ban&&c.ban[sh]) { continue; }
        if(cnt[sh]>=(LIM[sh]||99)) continue;
        const get=x=>(x===d)?sh:(arr[x]||"");
        let bad2=[];
        for(let x=0;x<7;x++) if(get(x)==="night"&&get((x+1)%7)==="early") bad2.push("晚接早");
        for(let x=0;x<7;x++) if(get(x)==="early"&&get((x+1)%7)==="early"&&get((x+2)%7)==="early") bad2.push("连三早");
        if(get(5)==="early"&&get(6)==="early") bad2.push("周末连早");
        // 改后孤立/3连休
        const test=arr.slice(); test[d]=sh;
        const s2=new Set(); test.forEach((v,x)=>{ if(v==="rest"||v==="") s2.add(x); });
        const iso=T.isolatedRestCount(s2), r3=T.run3RestCount(s2);
        if(iso>0) bad2.push("造孤立"+iso);
        if(r3>0) bad2.push("造3连"+r3);
        if(bad2.length===0) options.push(sh); else why.push(`${sh}:${[...new Set(bad2)].join("/")}`);
      }
      const inTrip = trips.some(t=>d===t||d===(t+1)%7||d===(t+2)%7);
      console.log(`      ${DAY[d]}${inTrip?" ★3连中":""}  可改: [${options.join(",")||"无"}]  ${why.join(" | ")}`);
    }
  });
}
console.log("\n找到 "+found+" 轮有违规");