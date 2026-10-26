/* 验证「冲突定位」：
   1) renderHealth 时 lastHealth.all 被填上（errs+warns）；
   2) locateConflict 能从冲突文案里解析出 姓名 / 星期；
   3) 注入一处冲突后，renderDash 的 HTML 里出现 gotoConflict(...) 与 conflict-link（说明状态卡/提示条已可点击）；
   4) gotoConflict(0) 不抛错。
   纯 node 沙箱，无浏览器。 */
const fs = require("fs"), vm = require("vm");
const {mulberry32, resetConfig} = require("./audit_core");

function makeEl(){
  const cls = new Set();
  const base = {
    value:"", textContent:"", innerHTML:"", style:{}, options:[], disabled:false, width:0, height:0, offsetWidth:0,
    dataset:{},
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), toggle(){}, contains:c=>cls.has(c)},
    getAttribute(){return null}, setAttribute(){}, click(){}, appendChild(){}, remove(){},
    addEventListener(){}, removeEventListener(){}, scrollIntoView(){},
    querySelector(){return makeEl()}, querySelectorAll(){return []},
    getContext(){ return new Proxy({}, {get(){return ()=>{}}, set(){return true;}}); },
    getBoundingClientRect(){return {width:0,height:0,top:0,left:0};}
  };
  return new Proxy(base, { get(t,p){ return (p in t) ? t[p] : undefined; }, set(t,p,v){ t[p]=v; return true; } });
}

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
    document:{ getElementById(id){ if(!els[id]) els[id]=makeEl(); return els[id]; },
      querySelectorAll(){return[]}, querySelector(){return makeEl()},
      createElement(){return makeEl()}, body:{appendChild(){}, removeChild(){}},
      addEventListener(){}, removeEventListener(){} },
    localStorage:{_s:null, getItem(){return this._s;}, setItem(k,v){this._s=v;}, removeItem(){this._s=null;}},
    console:{log(){},warn(){},error(){}}, confirm:()=>true, alert(){}, prompt:()=>"",
    setTimeout:(fn)=>{fn();return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    Math:M, Date:FakeDate, JSON, Array, Object, String, Number, Set, Map,
    isNaN, parseInt, parseFloat, performance:{now:()=>FakeDate.now()},
    URL:{createObjectURL:()=>"", revokeObjectURL(){}}, Blob:function(){},
    location:{protocol:"https:", href:"https://example.invalid/app.html"},
    fetch:()=>Promise.reject(new Error("sandbox: no network")),
    window:{addEventListener(){}, removeEventListener(){}, scrollTo(){}}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const EXPORTS = ["autoSchedule","curKey","ensureWeek","buildRules","renderHealth","renderDash","locateConflict","gotoConflict","DAY_NAMES","resetConfig","curDomain","domainStaff","isManager"];
  vm.runInContext(code + `
;(() => {
  const o = { get state(){ return state; }, get DEFAULT_STAFF(){ return DEFAULT_STAFF; } };
  for (const n of ${JSON.stringify(EXPORTS)}) { try { const v = eval(n); if (typeof v === "function" || typeof v === "object") o[n] = v; } catch(e) {} }
  try { Object.defineProperty(o, "lastHealth", { get(){ return eval("lastHealth"); } }); } catch(e) {}
  globalThis.__T = o;
})();`, sandbox, {filename:"app"});
  return {T: sandbox.__T, S: sandbox.__T.state, els};
}

const {T, S, els} = loadApp("app_merged.html", 1);
resetConfig(S, T);
T.autoSchedule();

let fails = 0;
const chk = (label, cond, extra)=>{ console.log((cond?"✅":"❌")+" "+label+(extra!==undefined?"  → "+JSON.stringify(extra):"")); if(!cond) fails++; };

// 1) 语法/加载 + renderHealth 填充 lastHealth.all
T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey()));
chk("renderHealth 后 lastHealth.all 是数组", Array.isArray(T.lastHealth.all), T.lastHealth.all.length);

// 2) locateConflict 解析
const DAY_NAMES = T.DAY_NAMES;
// S.staff[0] 是人事培训经理，已划入「经理」域；这里要用 3C 域内的人，否则注入的冲突不会被体检看到
const nm = T.domainStaff(T.curDomain())[0];
let r1 = T.locateConflict("周三早班缺 2 人（需 9，实排 7）");
chk("纯「星期」文案解析出 day=周三", r1.day === 2 && r1.name === null, r1);
let r2 = T.locateConflict(`${nm} 上一休一（休 周二、周四）`);
chk("「姓名+星期」文案解析正确", r2.name === nm && r2.day === 1, r2);
let r3 = T.locateConflict(`${nm} 周三晚班接周四早班`);
chk("「晚接早」取最早出现的星期", r3.name === nm && r3.day === 2, r3);
let r4 = T.locateConflict("人力不够：需求 200 人次…");
chk("纯配置类文案无定位点（name/day 皆空）", r4.name === null && r4.day === -1, r4);

// 3) 注入一处冲突 → renderHealth 记录 → renderDash 出现可点击链接
const k = T.curKey(), w = T.ensureWeek(k);
for(let d=0; d<4; d++) w[nm][d] = "early";      // 4 连早 > 上限 3 → 1 处冲突
T.renderHealth(w, T.buildRules(k));
chk("注入冲突后 errs 非空", T.lastHealth.errs.length >= 1, T.lastHealth.errs.slice(0,3));
chk("lastHealth.all 含该冲突", T.lastHealth.all.length === T.lastHealth.errs.length + T.lastHealth.warns.length, T.lastHealth.all.length);

T.renderDash();
const dashHtml = String(els.dashBody ? els.dashBody.innerHTML : "");
chk("工作台状态卡可点击（conflict-link）", /conflict-link/.test(dashHtml));
chk("工作台出现 gotoConflict( 链接", /gotoConflict\(/.test(dashHtml));
chk("冲突文案已渲染到卡片", /连|上限|冲突/.test(dashHtml));

// 4) gotoConflict 不抛错
let threw = null;
try { T.gotoConflict(0); } catch(e){ threw = e; }
chk("gotoConflict(0) 不抛错", !threw, threw && String(threw));

console.log(fails ? `\n❌ ${fails} 项未通过` : "\n✅ 冲突定位 全部通过");
process.exit(fails ? 1 : 0);
