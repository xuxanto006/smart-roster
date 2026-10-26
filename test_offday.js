/* 「必须off」(offday) 与「必须请假」(off) 的行为区分验证
   期望：两者都强制休息；但 offday 不标记请假、不占请假额度、不显示为「假」。 */
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
  const M=Object.create(Math);M.random=mulberry(42);
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
  const EX=["autoSchedule","curKey","ensureWeek","buildRules","pushRequest","addRequest","renderTable",
            "TYPE_LABEL","conflictTypes","ruleText","DEFAULT_STAFF","activeRequests","ensureLeaveBalance",
            "LEAVE_TYPES","parseType","updateLeaveRow","schedulableStaff","isBlockedFromSchedule"];
  vm.runInContext(code+`
;(()=>{const o={get state(){return state;},get DEFAULT_STAFF(){return DEFAULT_STAFF;}};
for(const n of ${JSON.stringify(EX)}){try{const v=eval(n);if(typeof v==="function"||typeof v==="object")o[n]=v;}catch(e){}}
globalThis.__T=o;})();`,sb,{filename:"app"});
  return {T:sb.__T,S:sb.__T.state,els};
}
let fails=0;
const chk=(l,c,e)=>{console.log((c?"✅ ":"❌ ")+l+(e!==undefined?"  → "+JSON.stringify(e):""));if(!c)fails++;};

const {T,S,els}=boot();
// 默认 80 人名册里前排多数是经理/免排，可排班不足 2 人时 autoSchedule 会按设计直接返回，
// 所以这里显式取 20 名「可排班」人员做样本。
S.staff=T.DEFAULT_STAFF.filter(n=>!T.isBlockedFromSchedule(n)).slice(0,20);
if(S.staff.length<6) S.staff=T.DEFAULT_STAFF.slice(0,20);
S.needs=[0,1,2,3,4,5,6].map(()=>({early:3,mid:1,night:3}));
S.limits={early:3,night:3,mid:99};
S.restMax={per:2,total:0};
S.schedule={};S.roles={};S.requests=[];S.mustWork=[];

/* 1. 白名单与标签 */
chk("TYPE_LABEL 含 offday", T.TYPE_LABEL.offday==="off", T.TYPE_LABEL.offday);
chk("TYPE_LABEL.off = 请假（「必须」已去掉）", T.TYPE_LABEL.off==="请假", T.TYPE_LABEL.off);
chk("HTML 下拉含 offday 选项（文案「off」）", new RegExp('<option[^>]*value="offday"[^>]*>(?:<!--.*?-->)*off(?:<!--.*?-->)*<\/option>').test(fs.readFileSync("app_merged.html","utf8")));
chk("HTML 下拉 off 文案为「请假」", new RegExp('<option[^>]*value="off"[^>]*>(?:<!--.*?-->)*请假(?:<!--.*?-->)*<\/option>').test(fs.readFileSync("app_merged.html","utf8")));
chk("HTML 下拉三选项均无「必须」字样", !/<option value="(?:off|offday|work)">必须/.test(fs.readFileSync("app_merged.html","utf8")));

/* 2. pushRequest 白名单接受 offday（不会被存档过滤器丢弃） */
const n0=S.staff[0], n1=S.staff[1];
T.pushRequest(n0, 2, "offday", "once");
T.pushRequest(n1, 2, "off", "once");
const kept=S.requests.filter(r=>r.type==="offday").length;
chk("pushRequest 接受 offday", kept===1, kept);
chk("offday 不写 leaveType（不占请假额度）", !S.requests.find(r=>r.type==="offday").leaveType,
    S.requests.find(r=>r.type==="offday").leaveType);
chk("off 不再写 leaveType（假期类型已下线）", S.requests.find(r=>r.type==="off").leaveType===undefined,
    S.requests.find(r=>r.type==="off").leaveType);

/* 3. buildRules 编译 */
const R=T.buildRules(T.curKey());
chk("offday → c.off=true", R[n0][2].off===true);
chk("offday → c.offDay=true", R[n0][2].offDay===true);
chk("offday → c.noOff 不为真", !R[n0][2].noOff);
chk("off → c.off=true", R[n1][2].off===true);
chk("off → c.offDay 为假", R[n1][2].offDay===false);

/* 4. 规则文案区分 */
chk("ruleText(offday) = 必须off", T.ruleText(R[n0][2])==="必须off", T.ruleText(R[n0][2]));
chk("ruleText(off) = 必须休息（请假）", T.ruleText(R[n1][2])==="必须休息（请假）", T.ruleText(R[n1][2]));

/* 5. 互斥 */
chk("offday 与 work 互斥", T.conflictTypes("offday","work")===true);
chk("offday 与 early 互斥", T.conflictTypes("offday","early")===true);
chk("offday 与 off 互斥", T.conflictTypes("offday","off")===true);
chk("offday 与 noearly 不互斥", T.conflictTypes("offday","noearly")===false);

/* 6. 排班后：offday 强制休息（不标记假） */
T.autoSchedule();
const w=T.ensureWeek(T.curKey());
chk("offday 当天被排成 rest", w[n0][2]==="rest", w[n0][2]);
chk("off 当天被排成 rest", w[n1][2]==="rest", w[n1][2]);
T.renderTable();
const html=String(els.tableBody ? els.tableBody.innerHTML : "");
// 只看 offday 那个人（n0）周三那一格：应为 rest 且不带 leave
const cellRe = new RegExp('class="([^"]*shift-cell[^"]*)"[^>]*data-name="' + n0 + '"[^>]*data-day="2"[^>]*>([^<]*)');
const mOff = html.match(cellRe);
chk("offday 格子为 rest 且不带 leave", !!mOff && /\brest\b/.test(mOff[1]) && !/leave/.test(mOff[1]), mOff && [mOff[1], mOff[2]]);
chk("offday 格子文字是「休」", !!mOff && mOff[2] === "休", mOff && mOff[2]);
// 请假那一位（n1）必须仍是 leave + 「假」
const cellRe2 = new RegExp('class="([^"]*shift-cell[^"]*)"[^>]*data-name="' + n1 + '"[^>]*data-day="2"[^>]*>([^<]*)');
const mLv = html.match(cellRe2);
chk("请假格子仍带 leave 且是「假」", !!mLv && /leave/.test(mLv[1]) && mLv[2] === "假", mLv && [mLv[1], mLv[2]]);
chk("offday 提示文案写「必须off」", new RegExp('data-name="' + n0 + '"[^>]*data-day="2"[^>]*title="[^"]*必须off').test(html) || html.includes("必须off"), "见 ruleText");
chk("请假格子仍标记 leave（显示「假」）", /shift-cell rest leave[^"]*"[^>]*>假</.test(html), html.match(/shift-cell rest leave[^>]*>[^<]*/)?.[0]||"未找到");

/* 7. 粘贴识别「必须off」 */
chk("粘贴识别「必须off」→ offday", T.parseType("必须off")==="offday", T.parseType("必须off"));
chk("粘贴识别「强制off」→ offday", T.parseType("强制 off")==="offday", T.parseType("强制 off"));
chk("粘贴识别「off」→ offday", T.parseType("off")==="offday", T.parseType("off"));
chk("粘贴识别「请假」→ off（未被 offday 抢走）", T.parseType("请假")==="off", T.parseType("请假"));
chk("粘贴识别「休息」→ off（维持原行为）", T.parseType("休息")==="off", T.parseType("休息"));

/* 8. 假期类型行只在「必须请假」时出现 */
const rt=els.reqType; if(rt){ rt.value="off"; T.updateLeaveRow(); chk("选 off 时显示假期类型行", els.reqLeaveRow && !els.reqLeaveRow.hidden);
  rt.value="offday"; T.updateLeaveRow(); chk("选 offday 时不显示假期类型行", els.reqLeaveRow && !!els.reqLeaveRow.hidden); }

console.log(`\n汇总: ${fails?fails+" 项失败":"全部通过"}`);
process.exit(fails?1:0);
