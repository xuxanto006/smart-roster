/* 「库房管理」岗位不参与排班 —— 验证
   关键风险：库房管理与销售分析同属「销售运营」模块，不能按模块排除，否则会误伤销售分析。 */
const fs=require("fs"),vm=require("vm");
const {mulberry32}=require("./audit_core");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
function boot(){
  const code=(()=>{const _h=fs.readFileSync("app_merged.html","utf8");let b="",m,r=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=r.exec(_h))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
  const els={};let vc=1000;const RD=Date;
  function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
  FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
  const M=Object.create(Math);M.random=mulberry(9);
  const sb={document:{getElementById(id){if(!els[id])els[id]=makeEl();return els[id];},querySelectorAll(){return[]},querySelector(){return makeEl()},
    createElement(){return makeEl()},body:{appendChild(){},removeChild(){}},addEventListener(){},removeEventListener(){}},
   localStorage:{_s:null,getItem(){return this._s;},setItem(k,v){this._s=v;},removeItem(){this._s=null;}},
   console:{log(){},warn(){},error(){}},confirm:()=>true,alert(){},prompt:()=>"",
   setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},setInterval:()=>0,clearInterval(){},
   Math:M,Date:FD,JSON,Array,Object,String,Number,Set,Map,Boolean,isNaN,parseInt,parseFloat,
   performance:{now:()=>FD.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){},
   location:{protocol:"https:",href:"https://x.invalid/a.html"},fetch:()=>Promise.reject(new Error("no")),
   window:{addEventListener(){},removeEventListener(){},scrollTo(){}}};
  sb.globalThis=sb;vm.createContext(sb);
  const EX=["autoSchedule","curKey","ensureWeek","buildRules","renderTable","renderHealth","schedulableStaff",
            "isBlockedFromSchedule","getStaffProfile","schedRestStats","exportCSV","DEFAULT_STAFF",
            "EXCLUDE_POSITIONS","EXCLUDE_MODULES","EXCLUDE_SCHEDULE","staffDisplayCmp",
            "domainSchedulable","curDomain","domainStaff"];
  vm.runInContext(code+`
;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};
for(const n of ${JSON.stringify(EX)}){try{const v=eval(n);if(typeof v==="function"||typeof v==="object")o[n]=v;}catch(e){}}
globalThis.__T=o;})();`,sb,{filename:"app"});
  return {T:sb.__T,S:sb.__T.state,els};
}
let fails=0;
const chk=(l,c,e)=>{console.log((c?"✅ ":"❌ ")+l+(e!==undefined?"  → "+JSON.stringify(e):""));if(!c)fails++;};

const {T,S,els}=boot();
const KF=["张泽鑫","李文捷","李世龙","林嘉彤","曾子杰"];        // 库房管理 5 人
const XS=["陈悦娴","张淑慧"];                                   // 同模块·销售分析 2 人
const KG="范晓萱";                                             // 售后·库管 1 人

/* 1. 名单核对：确认抓对了人 */
chk("库房管理 5 人岗位正确", KF.every(n=>T.getStaffProfile(n).position==="库房管理"),
    KF.map(n=>T.getStaffProfile(n).position));
chk("同模块销售分析 2 人仍属销售运营", XS.every(n=>T.getStaffProfile(n).module==="销售运营"),
    XS.map(n=>T.getStaffProfile(n).module));
chk("EXCLUDE_POSITIONS 含「库房管理」", T.EXCLUDE_POSITIONS.has("库房管理"), [...T.EXCLUDE_POSITIONS]);

/* 2. 排除判定 */
KF.forEach(n=>chk(`${n}（库房管理）不参与排班`, T.isBlockedFromSchedule(n)===true));
XS.forEach(n=>chk(`${n}（销售分析·同模块）仍参与排班`, T.isBlockedFromSchedule(n)===false));
chk(`${KG}（售后·库管）仍参与排班`, T.isBlockedFromSchedule(KG)===false);
chk("销售运营模块本身未被整体排除", !T.EXCLUDE_MODULES.has("销售运营"), [...T.EXCLUDE_MODULES]);

/* 3. 排班后：库房管理的人没有任何班次 */
S.needs=[0,1,2,3,4,5,6].map(()=>({early:9,mid:1,night:10}));
S.limits={early:3,night:3,mid:99};
S.restMax={per:2,total:0};
S.schedule={};S.roles={};S.requests=[];S.mustWork=[];
T.autoSchedule();
const w=T.ensureWeek(T.curKey());
KF.forEach(n=>{
  const row=w[n]||[];
  const anyShift=row.some(v=>v&&v!=="");
  chk(`${n} 整周无班次`, anyShift===false, row);
});
XS.forEach(n=>{
  const row=w[n]||[];
  chk(`${n}（销售分析）正常拿到班次`, row.some(v=>v&&v!==""), row);
});

/* 4. 渲染：标记为「暂免」+ 格子显示「暂」
   库房已独立成部门页签（domain="kufang"），渲染前必须切过去 ——
   停在默认的 3c 视图里根本看不到这 5 个人，断言会拿到 null。 */
S.domain="kufang";
T.renderTable();
const html=String(els.tableBody?els.tableBody.innerHTML:"");
KF.forEach(n=>{
  const m=html.match(new RegExp('data-name="'+n+'"[^>]*data-day="0"[^>]*title="([^"]*)"[^>]*>([^<]*)'));
  chk(`${n} 格子显示「暂」`, !!m && m[2]==="暂", m && [m[1],m[2]]);
});
chk("提示文案说明是岗位不参与排班", html.includes("该岗位暂时不参与排班"));
chk("暂免标签出现", html.includes("暂免"));
/* 切回 3c 视图后，库房这 5 人不应再出现（他们已独立成部门） */
S.domain="3c"; T.renderTable();
const html3c=String(els.tableBody?els.tableBody.innerHTML:"");
chk("3C 视图里已无库房人员", !KF.some(n=>html3c.includes('data-name="'+n+'"')), KF.filter(n=>html3c.includes('data-name="'+n+'"')).join(" "));
S.domain="kufang";

/* 5. 休息人日口径：被排除的人空格子不算休息（不能因此误报假冲突） */
const rs=T.schedRestStats(w);
chk("休息统计只覆盖可排班人员", rs.count===T.domainSchedulable(S.domain).length,
    {统计人数:rs.count, 当前领域: T.curDomain(), 可排班:T.domainSchedulable(S.domain).length});
T.renderHealth(w, T.buildRules(T.curKey()));
const errs=(T.LH&&T.LH.errs)||[];
chk("未出现「全队休息超上限」假冲突", !errs.some(e=>/全队休息/.test(e)), errs.slice(0,3));

/* 6. 导出：库房管理 5 人**要在表里**（主管才看得到他们被排除了），但班次必须全为 0 */
const csv=T.exportCSV();
const lines=csv.replace(/^\uFEFF/,"").split("\n").filter(Boolean);
const head=lines[0].split(",");
const iName=head.indexOf("姓名"), iE=head.indexOf("早班数"), iM=head.indexOf("中班数"),
      iN=head.indexOf("晚班数"), iR=head.indexOf("休息数"), iDom=head.indexOf("领域");
chk("CSV 表头含 领域/姓名/早班数/中班数/晚班数/休息数",
    [iName,iE,iM,iN,iR,iDom].every(x=>x>=0), {iName,iE,iM,iN,iR,iDom});
["张泽鑫","李文捷","李世龙","林嘉彤","曾子杰"].forEach(n=>{
  const row=lines.map(l=>l.split(",")).find(c=>c[iName]===n);
  chk(`${n} 在 CSV 里但班次全为 0`, !!row && +row[iE]===0 && +row[iM]===0 && +row[iN]===0 && +row[iR]===0,
      row && {领域:row[iDom], 早:row[iE], 中:row[iM], 晚:row[iN], 休:row[iR]});
});
chk("CSV 覆盖四个板块", ["3C顾问","鸿蒙智行","售后","经理"].every(d=>lines.some(l=>l.split(",")[iDom]===d)),
    ["3C顾问","鸿蒙智行","售后","经理"].filter(d=>!lines.some(l=>l.split(",")[iDom]===d)));

console.log(`\n汇总: ${fails?fails+" 项失败":"全部通过"}`);
process.exit(fails?1:0);
