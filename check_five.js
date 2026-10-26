/* 核实截图里 5 人当前是否参与排班 */
const fs=require("fs"),vm=require("vm");
const code=fs.readFileSync("app_merged.html","utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const els={};const M=Object.create(Math);M.random=()=>0.5;
const fakeEl=()=>({value:"",options:[],textContent:"",innerHTML:"",style:{},classList:{add(){},remove(){},toggle(){}},
  appendChild(){},querySelectorAll(){return[]},querySelector(){return null},addEventListener(){},
  setAttribute(){},getAttribute(){return null},dataset:{}});
const sb={document:{getElementById(id){if(!els[id])els[id]=fakeEl();return els[id];},querySelectorAll(){return[]},
    createElement(){return {style:{},click(){},setAttribute(){}}},body:{appendChild(){}},addEventListener(){}},
 localStorage:{_s:null,getItem(){return this._s;},setItem(k,v){this._s=v;},removeItem(){}},
 console:{log(){},warn(){},error(){}},confirm:()=>true,alert(){},prompt:()=>"",
 setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},setInterval:()=>0,clearInterval(){},
 Math:M,Date:Date,JSON,Array,Object,String,Number,Set,Map,Boolean,isNaN,parseInt,parseFloat,
 performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){},
 location:{protocol:"https:",href:"https://x/"},fetch:()=>Promise.reject(0),
 window:{addEventListener(){},removeEventListener(){},scrollTo(){}}};
sb.globalThis=sb;vm.createContext(sb);
const EX=["isBlockedFromSchedule","isManager","getStaffProfile","EXCLUDE_SCHEDULE","EXCLUDE_MODULES","EXCLUDE_POSITIONS","state"];
vm.runInContext(code+"\n;(()=>{const o={get state(){return state;}};for(const n of "+JSON.stringify(EX)+
  "){try{const v=eval(n);if(typeof v==='function'||typeof v==='object')o[n]=v;}catch(e){}}globalThis.__T=o;})();",sb,{filename:"a"});
const T=sb.__T;

const pad=(s,n)=>{ s=String(s); let w=0; for(const c of s) w += (c.charCodeAt(0)>255?2:1); return s+" ".repeat(Math.max(0,n-w)); };

console.log(pad("姓名",10)+pad("档案",30)+"当前是否排班");
console.log("-".repeat(60));
for(const n of ["何昊敏","黎瑶","黄弼姗","杨乐乐","刘可佳"]){
  let prof="(不在名册)";
  try{ const p=T.getStaffProfile(n); if(p&&p.module) prof=p.module+" / "+p.position+" / "+p.level; }catch(e){}
  const blocked=T.isBlockedFromSchedule(n);
  const why = blocked ? "不排班" : "排班 ← 需排除";
  console.log(pad(n,10)+pad(prof,30)+why);
}
