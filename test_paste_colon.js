/* 粘贴识别：「姓名：星期、星期休息；姓名：星期早班，星期、星期休息」这类分号连写的格式
   以及由此修掉的「多人同块 → 笛卡尔积」脏数据。 */
const fs=require("fs"),vm=require("vm");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function makeEl(){const b={value:"",options:[],textContent:"",innerHTML:"",style:{},disabled:false,width:0,height:0,offsetWidth:0,dataset:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},remove(){},focus(){},
 addEventListener(){},removeEventListener(){},scrollIntoView(){},querySelector(){return makeEl()},querySelectorAll(){return []},
 getContext(){return new Proxy({},{get(_,p){if(p==="measureText")return ()=>({width:22});return ()=>{};},set(){return true;}});},
 getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}};
 return new Proxy(b,{get(t,p){return (p in t)?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const code=(()=>{const _h=fs.readFileSync("app_merged.html","utf8");let b="",m,r=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=r.exec(_h))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
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
  "for(const n of ['parsePasteText','splitByNames']){try{o[n]=eval(n);}catch(e){}}\n"+
  "globalThis.__T=o;})();", sb, {filename:"app"});
const T=sb.__T;
let fails=0;
const D=["一","二","三","四","五","六","日"];
const sig=r=>`${r.name}周${D[r.day]}${r.type?":"+r.type:""}`;
const chk=(l,c,e)=>{console.log((c?"✅ ":"❌ ")+l+(e!==undefined?"  → "+JSON.stringify(e):""));if(!c)fails++;};

/* 1. 用户给的原格式 */
const T1="孙勇：周四、周五、周六休息；张淑慧：周四早班，周五、周六、周日休息；";
const r1=T.parsePasteText(T1).map(sig);
chk("孙勇 周四~周六 休息（3 条）",
    JSON.stringify(r1.filter(x=>x.startsWith("孙勇")))===JSON.stringify(["孙勇周四:off","孙勇周五:off","孙勇周六:off"]),
    r1.filter(x=>x.startsWith("孙勇")));
chk("张淑慧 周四早班 + 周五~周日休息（4 条）",
    JSON.stringify(r1.filter(x=>x.startsWith("张淑慧")))===JSON.stringify(["张淑慧周四:early","张淑慧周五:off","张淑慧周六:off","张淑慧周日:off"]),
    r1.filter(x=>x.startsWith("张淑慧")));
chk("总共 7 条", r1.length===7, r1.length);
chk("没有「孙勇周四早班」这种张冠李戴", !r1.includes("孙勇周四:early"));
chk("没有「张淑慧周四请假」这种张冠李戴", !r1.includes("张淑慧周四:off"));

/* 2. 半角冒号 */
const r2=T.parsePasteText("孙勇:周四、周五休息；张淑慧:周四早班").map(sig);
chk("半角冒号同样支持", JSON.stringify(r2)===JSON.stringify(["孙勇周四:off","孙勇周五:off","张淑慧周四:early"]), r2);

/* 3. 两人都是全天休息 */
const r3=T.parsePasteText("孙勇：周四、周五、周六休息；张淑慧：周四、周五、周六、周日休息").map(sig);
chk("两人全天休息 = 7 条", r3.length===7, r3);

/* 4. 多人同块不能交叉（Excel Tab 多列） */
const r4=T.parsePasteText("陈志浩\t周一\t请假\t何广友\t周三\t不上早班").map(sig);
chk("Excel 多列不再交叉（2 条）", JSON.stringify(r4)===JSON.stringify(["陈志浩周一:off","何广友周三:noearly"]), r4);

/* 5. 分号隔两条记录 */
const r5=T.parsePasteText("陈志浩周一请假；何广友周三外出").map(sig);
chk("分号隔两条 = 2 条", JSON.stringify(r5)===JSON.stringify(["陈志浩周一:off","何广友周三:out"]), r5);

/* 6. 多人共用一份安排（回归防护） */
const r6=T.parsePasteText("陈志浩 何广友 周一 请假").map(sig);
chk("多人共用一份安排仍各自成条", JSON.stringify(r6)===JSON.stringify(["陈志浩周一:off","何广友周一:off"]), r6);

/* 7. 换行写法不受影响 */
const r7=T.parsePasteText("陈志浩 周一 请假\n何广友 周三 不上早班").map(sig);
chk("换行写法不受影响", JSON.stringify(r7)===JSON.stringify(["陈志浩周一:off","何广友周三:noearly"]), r7);

/* 8. 「每周」是按记录块判定的 —— 分号隔开的记录互相独立，
      写在谁那段就只对谁生效（这是「；= 记录分隔符」的必然结果）。 */
const r8=T.parsePasteText("孙勇：周四休息；张淑慧：周五早班 每周");
chk("「每周」只作用于它所在的那一段",
    r8.length===2 && r8[0].scope==="once" && r8[1].scope==="always", r8.map(r=>r.name+":"+r.scope));
const r8b=T.parsePasteText("孙勇：周四休息 每周；张淑慧：周五早班 每周");
chk("两段都写「每周」则两段都长期",
    r8b.length===2 && r8b.every(r=>r.scope==="always"), r8b.map(r=>r.scope));

/* 9. 名字不在名册 → 保留该行、姓名留空让用户在预览里补（不是丢弃） */
const r9=T.parsePasteText("王鹏俊 周一 请假；王鹏 周二 请假");
chk("名册里只有「王鹏俊」：第二行保留但姓名为空",
    r9.length===2 && r9[0].name==="王鹏俊" && r9[1].name==="" && r9[1].day===1,
    r9.map(r=>r.name+"周"+D[r.day]));

console.log("\n汇总: "+(fails?fails+" 项失败":"全部通过"));
process.exit(fails?1:0);
