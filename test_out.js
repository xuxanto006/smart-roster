/* 「外出」类型验证：等同休息日（占休息额度），但不标记请假、不占请假额度 */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const base={value:"",options:[],textContent:"",innerHTML:"",style:{},disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(base,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const code=(()=>{const _h=fs.readFileSync("app_merged.html","utf8");let b="",m,r=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=r.exec(_h))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
const els={};let vc=1000;const RD=Date;
function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
const M=Object.create(Math);M.random=mulberry(77);
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
const EX=["autoSchedule","curKey","ensureWeek","buildRules","pushRequest","renderTable","parseType","updateLeaveRow",
          "TYPE_LABEL","conflictTypes","ruleText","DEFAULT_STAFF","isBlockedFromSchedule","state",
          "schedulableStaff","curDomain","domainStaff"];
vm.runInContext(code+"\n;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};\n"+
  "for(const n of "+JSON.stringify(EX)+"){try{const v=eval(n);if(typeof v==='function'||typeof v==='object')o[n]=v;}catch(e){}}\n"+
  "globalThis.__T=o;})();", sb, {filename:"app"});
const T=sb.__T, S=sb.__T.state;
let fails=0;
const chk=(l,c,e)=>{console.log((c?"✅ ":"❌ ")+l+(e!==undefined?"  → "+JSON.stringify(e):""));if(!c)fails++;};

/* 1. 白名单与标签 */
chk("TYPE_LABEL.out = 外出", T.TYPE_LABEL.out==="外出", T.TYPE_LABEL.out);
/* 下拉已改为 optgroup 分组结构、且 option 上带 data-page-node-id、文本内夹带 <!--pnid--> 注释，
   断言改为容忍属性与注释：只看 value 与文案是否配对。 */
chk("下拉含 out 选项", new RegExp('<option[^>]*value="out"[^>]*>(?:<!--.*?-->)*外出(?:<!--.*?-->)*<\/option>').test(fs.readFileSync("app_merged.html","utf8")));

S.staff=T.DEFAULT_STAFF.filter(n=>!T.isBlockedFromSchedule(n)).slice(0,20);
if(S.staff.length<6) S.staff=T.DEFAULT_STAFF.slice(0,20);
S.needs=[0,1,2,3,4,5,6].map(()=>({early:9,mid:1,night:10}));
S.limits={early:3,night:3,mid:99}; S.restMax={per:2,total:0};
S.schedule={};S.roles={};S.requests=[];S.mustWork=[];

const nOut=S.staff[0], nLv=S.staff[1], nOff=S.staff[2];
T.pushRequest(nOut, 2, "out", "once");
T.pushRequest(nLv,  2, "off", "once");
T.pushRequest(nOff,2, "offday", "once");

/* 2. 不占请假额度 */
chk("pushRequest 接受 out", S.requests.filter(r=>r.type==="out").length===1);
chk("out 不写 leaveType（不占请假额度）", !S.requests.find(r=>r.type==="out").leaveType, S.requests.find(r=>r.type==="out").leaveType);
chk("off 也不写 leaveType（假期类型已下线）", S.requests.find(r=>r.type==="off").leaveType===undefined);

/* 3. 规则编译：等同休息日 */
const R=T.buildRules(T.curKey());
chk("out → c.off=true（强制休息）", R[nOut][2].off===true);
chk("out → c.offOut=true", R[nOut][2].offOut===true);
chk("out → c.offDay 为假（不标成 off）", R[nOff][2].offDay===true && R[nOut][2].offDay===false);
chk("ruleText(out) = 外出", T.ruleText(R[nOut][2])==="外出", T.ruleText(R[nOut][2]));

/* 4. 互斥 */
chk("out 与 上班 互斥", T.conflictTypes("out","work")===true);
chk("out 与 固定早班 互斥", T.conflictTypes("out","early")===true);
chk("out 与 请假 互斥", T.conflictTypes("out","off")===true);
chk("out 与 off 互斥", T.conflictTypes("out","offday")===true);
chk("out 与 不上早班 不互斥", T.conflictTypes("out","noearly")===false);

/* 5. 排班后强制休息 */
T.autoSchedule();
const w=T.ensureWeek(T.curKey());
chk("out 当天排成 rest", w[nOut][2]==="rest", w[nOut][2]);

/* 6. 格子渲染：显示「外」+ 虚线框，不是「假」 */
T.renderTable();
const html=String(els.tableBody?els.tableBody.innerHTML:"");
const re1=new RegExp('class="([^"]*shift-cell[^"]*)"[^>]*data-name="'+nOut+'"[^>]*data-day="2"[^>]*>([^<]*)');
const mOut=html.match(re1);
chk("out 格子 class 含 out、不含 leave", !!mOut && /\bout\b/.test(mOut[1]) && !/leave/.test(mOut[1]), mOut && [mOut[1],mOut[2]]);
chk("out 格子文字是「外」", !!mOut && mOut[2]==="外", mOut && mOut[2]);
const mLv=html.match(new RegExp('class="([^"]*shift-cell[^"]*)"[^>]*data-name="'+nLv+'"[^>]*data-day="2"[^>]*>([^<]*)'));
chk("请假格子仍是 leave + 「假」", !!mLv && /leave/.test(mLv[1]) && mLv[2]==="假", mLv && [mLv[1],mLv[2]]);
const mOff=html.match(new RegExp('class="([^"]*shift-cell[^"]*)"[^>]*data-name="'+nOff+'"[^>]*data-day="2"[^>]*>([^<]*)'));
chk("off 格子仍是「休」且无 out/leave", !!mOff && !/leave|\bout\b/.test(mOff[1]) && mOff[2]==="休", mOff && [mOff[1],mOff[2]]);
chk("悬停提示写「外出」", new RegExp('data-name="'+nOut+'"[^>]*data-day="2"[^>]*title="[^"]*外出').test(html));

/* 7. 粘贴识别 */
chk("粘贴识别「外出」→ out", T.parseType("外出")==="out", T.parseType("外出"));
chk("粘贴识别「外勤」→ out", T.parseType("外勤")==="out", T.parseType("外勤"));
chk("粘贴识别「出差」→ out", T.parseType("出差")==="out", T.parseType("出差"));
chk("粘贴识别「请假」仍是 off（未被抢走）", T.parseType("请假")==="off", T.parseType("请假"));

/* 8. 假期类型已下线：请假 / 外出 都不该再有假期类型行 */
const raw=fs.readFileSync("app_merged.html","utf8");
chk("页面里已无「假期类型」字样", !raw.includes("假期类型"));
chk("选请假时不再有假期类型行", !raw.includes("reqLeaveRow"));
chk("updateLeaveRow 已删除", typeof T.updateLeaveRow!=="function");

console.log("\n汇总: "+(fails?fails+" 项失败":"全部通过"));
process.exit(fails?1:0);
