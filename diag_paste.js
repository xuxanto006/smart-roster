/* 粘贴识别诊断：用真实场景跑 parsePasteText，定位不准的写法 */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const b={value:"",options:[],textContent:"",innerHTML:"",style:{},disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(b,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const code=fs.readFileSync("app_merged.html","utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const els={};let vc=1000;const RD=Date;
function FD(...a){return a.length?new RD(...a):new RD(1767225600000);}
FD.now=()=>(vc+=1);FD.parse=RD.parse;FD.UTC=RD.UTC;
const M=Object.create(Math);M.random=mulberry(3);
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
vm.runInContext(code+"\n;(()=>{const o={get state(){return state;}};\n"+
  "for(const n of ['parsePasteText','parseDays','parseType','splitCells','splitNames']){try{o[n]=eval(n);}catch(e){}}\n"+
  "globalThis.__T=o;})();", sb, {filename:"app"});
const T=sb.__T;
const D=["一","二","三","四","五","六","日"];
const fmt=r=>`${r.name||"(无姓名)"} 周${r.day>=0?D[r.day]:"?"}${r.type?" ["+r.type+"]":""}${r.date?" @"+r.date:""}${r.scope==="always"?" 长期":""}`;

const CASES=[
 ["★ 用户要支持的格式", "孙勇：周四、周五、周六休息；张淑慧：周四早班，周五、周六、周日休息；"],
 ["★ 同一格式（两人都是全天休息）", "孙勇：周四、周五、周六休息；张淑慧：周四、周五、周六、周日休息"],
 ["★ 姓名用半角冒号", "孙勇:周四、周五休息；张淑慧:周四早班"],
 ["O. Excel 复制（Tab 分隔，2人2列）", "陈志浩	周一	请假	何广友	周三	不上早班"],
 ["P. 两条记录用分号隔在同一行", "陈志浩周一请假；何广友周三外出"],
 ["Q. 两条记录用分号+空格", "陈志浩 周一 请假； 何广友 周三 外出"],
 ["R. 上午/下午 口语", "陈志浩 周一 上午请假\n何广友 周二 下午外出"],
 ["S. 周一到周五范围", "陈志浩 周一到周五 请假"],
 ["T. 只写「休」", "陈志浩 周一 休\n何广友 周二 假"],
 ["U. 名字重复出现在一行", "陈志浩 何广友 周一 请假"],
 ["A. 标准写法（应该没问题）", "陈志浩 周一 请假\n何广友 周三 不上早班"],
 ["B. 今天/明天/后天（常见口语）", "陈志浩 今天 请假\n何广友 明天 外出"],
 ["C. 只写日期不写星期", "陈志浩 9.15 请假\n何广友 9/16 外出"],
 ["D. 姓名写错一个字", "陈志浩 张一 请假\n何广友 王五 外出"],
 ["E. 一个人一天多种类型", "陈志浩 周一 不上早班 不上晚班"],
 ["F. 逗号分隔整行", "陈志浩，周一，请假；何广友，周三，固定早班"],
 ["G. 姓名与星期粘在一起（微信常见）", "陈志浩周一请假\n何广友周三外出"],
 ["H. 表格带表头", "姓名 星期 安排\n陈志浩 周一 请假"],
 ["I. 写「休息一下」「放个假」", "陈志浩 周一 休息一下\n何广友 周二 放个假"],
 ["J. 写「不排早班」（口语变体）", "陈志浩 周一 不排早班"],
 ["K. 写「周六日都上班」", "陈志浩 周六日 都上班"],
 ["L. 每周固定写法", "陈志浩 周一 请假 每周\n何广友 周三 请假 每周都"],
 ["M. 名字是别人名字的子串", "王鹏俊 周一 请假\n王鹏 周二 外出"],
 ["N. 类型词里带否定被误判", "陈志浩 周一 不休息\n何广友 周二 不能请假(应为上班)"],
];
for(const [title, text] of CASES){
  console.log("\n" + title);
  console.log("  输入: " + JSON.stringify(text));
  let rows=[];
  try{ rows = T.parsePasteText(text); }catch(e){ console.log("  ❌ 抛错: "+e.message); continue; }
  if(!rows.length) console.log("  ❌ 一条都没识别出来");
  else rows.forEach(r=>console.log("    → " + fmt(r)));
}
