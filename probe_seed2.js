/* 诊断：打开页面（无存档 / 畸形 # 片段）时，到底是谁往 localStorage 里写了东西 */
const fs=require("fs"), vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function makeEl(){const s=new Set();return{value:"",textContent:"",innerHTML:"",style:{},options:[],disabled:false,
  classList:{add(){},remove(){},toggle(){},contains:()=>false},getAttribute(){return null},setAttribute(){},
  click(){},appendChild(){},addEventListener(){},remove(){},select(){},focus(){}};}
const HASH = process.argv[2] || "";
const data = {};
const ls = {getItem:k=> (k in data? data[k]:null), setItem(k,v){ data[k]=String(v); console.log("  ✍️ setItem:", k); console.log(new Error().stack.split("
").slice(1,6).join("
")); },
            removeItem(k){ delete data[k]; }, get length(){return Object.keys(data).length;}, key:i=>Object.keys(data)[i]||null};
const els={};
const sandbox={document:{getElementById(id){ if(!els[id])els[id]=makeEl(); return els[id]; },
  querySelectorAll(){return[]}, querySelector(){return makeEl()}, createElement(){return makeEl()},
  body:makeEl(), addEventListener(){}, removeEventListener(){}, execCommand:()=>true},
  localStorage:ls, console:{log(){},warn(){},error(){}}, confirm:()=>true, alert(){}, prompt:()=>"",
  setTimeout:fn=>{fn();return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
  Math, Date, JSON, Array, Object, String, Number, Set, Map, isNaN, parseInt, parseFloat,
  performance:{now:()=>Date.now()}, URL:{createObjectURL:()=>"",revokeObjectURL(){}}, Blob:function(){},
  location:{href:"https://example.invalid/app.html", hash:HASH, protocol:"https:"}, fetch:()=>Promise.reject(new Error("no net"))};
sandbox.globalThis=sandbox; vm.createContext(sandbox);
console.log(`── hash = ${JSON.stringify(HASH)} ──`);
vm.runInContext(code, sandbox, {filename:"app"});
console.log("  最终键：", JSON.stringify(Object.keys(data)));
