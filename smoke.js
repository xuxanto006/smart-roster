const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];

/* 1. 元素 ID 引用检查 */
const declared=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
const used=new Set([...code.matchAll(/getElementById\("([^"]+)"\)/g)].map(m=>m[1]));
const missing=[...used].filter(x=>!declared.has(x));
console.log("HTML 中声明的 id:",declared.size,"｜脚本引用:",used.size,"｜缺失:",missing.length?missing.join(","):"无");

/* 2. onclick 引用的全局函数是否都已定义 */
const fns=new Set([...code.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
const called=new Set([...html.matchAll(/on(?:click|change|keydown)="([A-Za-z_$][\w$]*)\(/g)].map(m=>m[1]).filter(x=>x!=="if")); // onkeydown="if(event.key…)" 是合法内联语句，不是未定义函数
const undef=[...called].filter(x=>!fns.has(x));
console.log("内联事件调用函数:",[...called].join(","),"｜未定义:",undef.length?undef.join(","):"无");

/* 3. 标签配对粗检 */
const openDiv=(html.match(/<div\b/g)||[]).length, closeDiv=(html.match(/<\/div>/g)||[]).length;
console.log("<div>:",openDiv,"</div>:",closeDiv,"｜平衡:",openDiv===closeDiv?"是":"否");

/* 4. 性能：32人 + 15条规则 排班耗时 */
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},click(){},appendChild(){},_tm:null};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"globalThis.__T={get state(){return state},autoSchedule,repatchWeek,ensureWeek,curKey,buildRules,checkRuleViolations};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state,k=T.curKey(),pad=i=>String(i).padStart(2,"0");
S.staff=Array.from({length:32},(_,i)=>"员工"+pad(i+1));S.schedule={};S.limits={early:3,night:3,mid:99};
S.needs=[{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:8,mid:1,night:10},{early:9,mid:3,night:12},{early:9,mid:3,night:12}];
const TYPES=["off","work","early","mid","night","noearly","nomid","nonight"];
S.requests=Array.from({length:15},(_,i)=>({id:i+1,name:"员工"+pad(1+i*2),day:i%7,type:TYPES[i%8],scope:"once",weekKey:k}));
let t0=Date.now();T.autoSchedule();const t1=Date.now();
S.requests.push({id:99,name:"员工04",day:3,type:"off",scope:"once",weekKey:k});
T.repatchWeek(true);const t2=Date.now();
console.log(`性能：32人一键排班 ${t1-t0}ms ｜ 微调 ${t2-t1}ms`);
const w=T.ensureWeek(k);
console.log("排班结果非空:",state_ok(w));
function state_ok(w){return S.staff.every(n=>w[n]&&w[n].length===7);}
