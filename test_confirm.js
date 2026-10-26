/* 运行时验证 confirmSchedule()：点击「确认排班」后是否真的产出 表格(html) + 图片(png) 两次下载，
   且 exportCSV 能真的产出 CSV 文件。
   这是纯 node 沙箱测试，不需要浏览器。 */
const fs = require("fs"), vm = require("vm");
const {mulberry32, resetConfig} = require("./audit_core");

function makeEl(){
  const cls = new Set();
  const base = {
    value:"", textContent:"", innerHTML:"", style:{}, options:[], disabled:false, width:0, height:0,
    dataset:{},
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), toggle(){}, contains:c=>cls.has(c)},
    getAttribute(){return null}, setAttribute(){}, click(){}, appendChild(){}, remove(){},
    addEventListener(){}, removeEventListener(){},
    querySelector(){return makeEl()}, querySelectorAll(){return []},
    getContext(){ return new Proxy({}, {get(){return ()=>{}}, set(){return true;}}); },
    getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}
  };
  return new Proxy(base, { get(t,p){ return (p in t) ? t[p] : undefined; }, set(t,p,v){ t[p]=v; return true; } });
}

const downloads = [];   // 捕获 a.click() 的下载文件名
const blobs = [];       // 捕获 Blob 实例（表格）
const pngBlobs = [];    // 捕获 canvas.toBlob 产出的图片对象
let blobN = 0;

function makeCanvas(){
  const ctx = new Proxy({}, { get(_,p){ if(p==="measureText") return ()=>({width:20}); return ()=>{}; }, set(){return true;} });
  return { width:0, height:0, getContext:()=>ctx, toBlob(cb){ const b={type:"image/png", size:10}; pngBlobs.push(b); cb(b); } };
}
function makeAnchor(){ return { href:"", download:"", style:{}, click(){ downloads.push(this.download); } }; }

function loadApp(htmlPath, seed){
  const html = fs.readFileSync(htmlPath, "utf8");
  const code = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
  const els = {};
  const rng = mulberry32(seed === undefined ? 1 : seed);
  let vclock = 1000;
  const RealDate = Date;
  function FakeDate(...a){ return a.length ? new RealDate(...a) : new RealDate(1767225600000); }
  FakeDate.now = () => (vclock += 1);
  FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
  const M = Object.create(Math); M.random = rng;
  const sandbox = {
    document:{
      getElementById(id){ if(!els[id]) els[id]=makeEl(); return els[id]; },
      querySelectorAll(){return[]}, querySelector(){return makeEl()},
      createElement(tag){ if(tag==="canvas") return makeCanvas(); if(tag==="a") return makeAnchor(); return makeEl(); },
      body:{appendChild(){}, removeChild(){}}, addEventListener(){}, removeEventListener(){}
    },
    localStorage:{_s:null, getItem(){return this._s;}, setItem(k,v){this._s=v;}, removeItem(){this._s=null;}},
    console:{log(){},warn(){},error(){}}, confirm:()=>true, alert(){}, prompt:()=>"",
    setTimeout:(fn)=>{fn();return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    Math:M, Date:FakeDate, JSON, Array, Object, String, Number, Set, Map,
    isNaN, parseInt, parseFloat, performance:{now:()=>FakeDate.now()},
    URL:{createObjectURL:()=>"blob:"+(++blobN), revokeObjectURL(){}},
    Blob:function(parts, opts){ this.parts=parts; this.type=(opts&&opts.type)||""; this.size = parts&&parts[0]?String(parts[0]).length:0; blobs.push(this); },
    location:{protocol:"https:", href:"https://example.invalid/app.html"},
    fetch:()=>Promise.reject(new Error("sandbox: no network")),
    window:{addEventListener(){}, removeEventListener(){}, scrollTo(){}}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const EXPORTS = ["autoSchedule","curKey","ensureWeek","DEFAULT_STAFF","getStaffProfile","renderStats","save","toast","staffDisplayCmp","confirmSchedule","curDomain","domainStaff","exportCSV"];
  vm.runInContext(code + `
;(() => {
  const o = { get state(){ return state; }, get DEFAULT_STAFF(){ return DEFAULT_STAFF; } };
  for (const n of ${JSON.stringify(EXPORTS)}) { try { const v = eval(n); if (typeof v === "function" || typeof v === "object") o[n] = v; } catch(e) {} }
  globalThis.__T = o;
})();`, sandbox, {filename:"app"});
  return {T: sandbox.__T, S: sandbox.__T.state, sandbox};
}

const {T, S} = loadApp("app_merged.html", 1);
resetConfig(S, T);          // 31 人标准配置
T.autoSchedule();           // 生成一份排班，确保 state.schedule 有数据

const before = downloads.length;
let err = null;
// 确认排班 = 一键下载 Excel(CSV)，不应抛错
try { T.confirmSchedule(); } catch(e){ err = e; }
if(err){ console.error("❌ confirmSchedule 抛错：", err && err.stack || err); process.exit(1); }

const csvBlob = blobs.find(b=>/csv/.test(b.type));
const csv = csvBlob ? String(csvBlob.parts[0]) : "";
console.log("下载文件名：", downloads);
console.log("Blob 类型：", blobs.map(b=>b.type));
console.log("CSV 含 BOM（Excel 可直接打开）：", csv.charCodeAt(0) === 0xFEFF);
console.log("CSV 表头含『领域/姓名/周一』：", /领域,姓名,模块/.test(csv) && /周一/.test(csv));
console.log("CSV 含班次列：", /早班数,中班数,晚班数,休息数/.test(csv));
console.log("CSV 覆盖四个板块：", ["3C顾问","鸿蒙智行","售后","经理"].every(d=>csv.includes(d+",")));
console.log("CSV 行数：", csv.split("\n").filter(Boolean).length);

const ok = downloads.length === before + 1
  && downloads.some(n=>/\.csv$/.test(n))
  && downloads.length === before + 1
  && csvBlob && csv.charCodeAt(0) === 0xFEFF
  && /领域,姓名,模块/.test(csv) && /早班数,中班数,晚班数/.test(csv)
  && ["3C顾问","鸿蒙智行","售后","经理"].every(d=>csv.includes(d+","));
console.log(ok ? "\n✅ 确认排班运行时验证通过（一次点击直接下载 Excel 表格）" : "\n❌ 验证未通过");
process.exit(ok ? 0 : 1);
