/* 李敏不参与排班 —— 验证（含「不误伤同模块同岗位的李秀珊」） */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const base={value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}

const code=(()=>{const _h=fs.readFileSync("app_merged.html","utf8");let b="",m,r=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=r.exec(_h))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
const els={};let vc=1000;const RD=Date;
function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
const M=Object.create(Math);M.random=mulberry(11);
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
          "isBlockedFromSchedule","getStaffProfile","schedRestStats","exportCSV","EXCLUDE_SCHEDULE","DEFAULT_STAFF","domainSchedulable","curDomain","domainStaff","DOMAINS"];
vm.runInContext(code+"\n;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};\n"+
  "for(const n of "+JSON.stringify(EX)+"){try{const v=eval(n);if(typeof v==='function'||typeof v==='object')o[n]=v;}catch(e){}}\n"+
  "globalThis.__T=o;})();", sb, {filename:"app"});

const T=sb.__T, S=sb.__T.state;
let fails=0;
const chk=(l,c,e)=>{console.log((c?"✅ ":"❌ ")+l+(e!==undefined?"  → "+JSON.stringify(e):""));if(!c)fails++;};

const P=T.getStaffProfile("李敏");
chk("李敏 在 EXCLUDE_SCHEDULE 里", T.EXCLUDE_SCHEDULE.has("李敏"), [...T.EXCLUDE_SCHEDULE]);
chk("李敏 档案 = 服务体验 / 服务 / 员工", P.module==="服务体验"&&P.position==="服务"&&P.level==="员工", P);
chk("李敏 不参与排班", T.isBlockedFromSchedule("李敏")===true);
chk("李秀珊（同模块同岗位）仍参与排班", T.isBlockedFromSchedule("李秀珊")===false);
chk("李信服（服务体验·经理）仍因经理不排班", T.isBlockedFromSchedule("李信服")===true);

S.needs=[0,1,2,3,4,5,6].map(()=>({early:9,mid:1,night:10}));
S.limits={early:3,night:3,mid:99}; S.restMax={per:2,total:0};
S.schedule={};S.roles={};S.requests=[];S.mustWork=[];
T.autoSchedule();
const w=T.ensureWeek(T.curKey());
chk("李敏 整周无班次", (w["李敏"]||[]).every(v=>!v||v===""), w["李敏"]);
chk("李秀珊 正常拿到班次", (w["李秀珊"]||[]).some(v=>v&&v!==""), w["李秀珊"]);

T.renderTable();
const html=String(els.tableBody?els.tableBody.innerHTML:"");
const m=html.match(new RegExp('data-name="李敏"[^>]*data-day="0"[^>]*title="([^"]*)"[^>]*>([^<]*)'));
chk("李敏 格子显示「免」", !!m && m[2]==="免", m && [m[1],m[2]]);
chk("出现「免排」标签", html.includes("免排"));

const rs=T.schedRestStats(w);
chk("休息统计人数 = 可排班人数（不含李敏）", rs.count===T.domainSchedulable("3c").length, {统计:rs.count,当前领域可排班:T.domainSchedulable("3c").length});
T.renderHealth(w, T.buildRules(T.curKey()));
chk("无「全队休息超上限」假冲突", !((T.LH&&T.LH.errs)||[]).some(e=>/全队休息/.test(e)));

T.exportCSV();
chk("李敏已不参与排班", T.isBlockedFromSchedule("李敏")===true);
/* 人数断言改为动态计算 —— 原先写死「3C32 / 全量60」，
   名册一有增减（加唐心丽、划出尊界）就假失败。
   注意口径差：schedulableStaff() 把**经理**算作不可排班（isBlockedFromSchedule 返回 true），
   但经理域的 9 人按设计是参与排班的（blockedInDomain 只查 EXCLUDE_SCHEDULE），
   所以两者差恰好等于经理人数。 */
{
  const perDom = {};
  let sum = 0;
  T.DOMAINS.forEach(d=>{ const n=T.domainSchedulable(d.key).length; perDom[d.label]=n; sum+=n; });
  const total = T.schedulableStaff().length;
  const mgr = T.domainSchedulable("manager").length;
  chk("各域之和 = 全量可排班 + 经理数（经理在 isBlockedFromSchedule 里算不可排班，但经理域参与排班）",
      sum===total+mgr, {各域:perDom, 求和:sum, 全量:total, 经理:mgr});
  const covered={}, dup=[];
  T.DOMAINS.forEach(d=> T.domainStaff(d.key).forEach(n=>{ if(covered[n]) dup.push(n); covered[n]=1; }));
  chk("无人员被两个领域同时收录", dup.length===0, dup.join(" "));
  chk("各域人数之和 = 名册总人数", Object.keys(covered).length===T.state.staff.length,
      {各域合计:Object.keys(covered).length, 名册:T.state.staff.length});
  chk("3C 域已不含尊界人员", !T.domainSchedulable("3c").includes("张晓龙"),
      T.domainSchedulable("3c").filter(n=>["王秋千","张晓龙","廖梓宸","林家鸿","张荣","唐心丽"].includes(n)).join(" "));
  chk("尊界域独立可排班", T.domainSchedulable("zunjie").length===5,
      {尊界:T.domainSchedulable("zunjie").length});
}

console.log("\n汇总: "+(fails?fails+" 项失败":"全部通过"));
process.exit(fails?1:0);
