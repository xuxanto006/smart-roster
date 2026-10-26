/* 分享链接（把配置 + 班表编码进 URL 的 # 片段）测试。
   锁死的性质：
     1. 生成的链接解回来与原始数据一致（往返无损，含中文人名）；
     2. 链接长度可控（不能大到浏览器/微信打不开）；
     3. 本地没有存档时，打开分享链接会播种；
     4. 本地已有存档时，分享链接**绝不覆盖**本地数据；
     5. 畸形 / 空的 # 片段不能让它崩，也不能乱播种；
     6. 复制动作在没有剪贴板 API、没有 execCommand 的环境里也不能抛异常。 */
const fs=require("fs"), vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();

function makeEl(){
  const cls=new Set();
  return {value:"", textContent:"", innerHTML:"", style:{}, options:[], disabled:false,
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), toggle(){}, contains:c=>cls.has(c)},
    getAttribute(){return null}, setAttribute(){}, click(){}, appendChild(){},
    addEventListener(){}, remove(){}, select(){}, focus(){}};
}
/* localStorage 桩：按「键」存取。
   以前这里只有一格 saved，任何 setItem 都会把它盖掉 —— 于是「每日快照」这类**写别的键**的功能
   会被误判成「分享链接覆盖了本地存档 / 畸形链接乱播种」。真实 localStorage 是键值表，
   桩必须跟它一致，否则测的就不是应用行为，而是桩的失真。 */
const LS_KEY = "shiftScheduler_v2";            // 必须与应用里的 STORE_KEY 一致
function makeStore(initial){
  const data = {};
  if(initial) data[LS_KEY] = String(initial);
  return {
    data,
    getItem(k){ return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v){ data[k] = String(v); },
    removeItem(k){ delete data[k]; },
    get length(){ return Object.keys(data).length; },
    key(i){ return Object.keys(data)[i] === undefined ? null : Object.keys(data)[i]; }
  };
}
function load(hash, store, opt){
  opt = opt || {};
  const ls = makeStore(store);
  const els = {};
  let copied = null;
  const sandbox = {
    document:{getElementById(id){ if(!els[id]) els[id]=makeEl(); return els[id]; },
      querySelectorAll(){return[]}, querySelector(){return makeEl()},
      createElement(){ return makeEl(); },
      body:makeEl(), addEventListener(){}, removeEventListener(){},
      execCommand: opt.execCommand === undefined ? ()=>true : ()=>opt.execCommand},
    localStorage:ls,
    console:{log(){},warn(){},error(){}}, confirm:()=>true, alert(){}, prompt:()=>"",
    setTimeout:(fn)=>{fn();return 0;}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    Math, Date, JSON, Array, Object, String, Number, Set, Map, isNaN, parseInt, parseFloat,
    performance:{now:()=>Date.now()},
    URL:{createObjectURL:()=>"", revokeObjectURL(){}}, Blob:function(){},
    location:{href:"https://example.invalid/app.html", hash:hash||"", protocol:"https:"},
    navigator: opt.clipboard ? {clipboard:{writeText:t=>{ copied = t; return Promise.resolve(); }}} : undefined,
    fetch:()=>Promise.reject(new Error("no net"))
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code + `
;globalThis.__T={get state(){return state},buildShareLink,copyShareLink,seedFromHash,snapshotState,
  autoSchedule,curKey,ensureWeek,assignRoles,resetConfig:null,DEFAULT_STAFF,renderAll};`,
    sandbox, {filename:"app"});
  return {T: sandbox.__T, S: sandbox.__T.state,
    get store(){ return ls.getItem(LS_KEY); }, set store(v){ ls.setItem(LS_KEY, v); },
    get keys(){ return Object.keys(ls.data); },
    get copied(){ return copied; }};
}
let pass=0, fail=0;
function expect(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

console.log("══════ 分享链接测试 ══════\n");

/* 准备一份真实数据：31 人排满一周 */
const a = load("", null);
a.S.staff = a.T.DEFAULT_STAFF.slice();
a.S.staff[0] = "欧阳慕雪";                       // 中文 + 生僻字，验证编码无损
// 用当前默认需求（早 9）：这里测的是分享链接，别让「老存档早班 8→9 一次性升级」混进来
a.S.needs = [0,1,2,3,4].map(()=>({early:9,mid:1,night:10})).concat([5,6].map(()=>({early:9,mid:3,night:12})));
a.S.limits={early:3,night:3,mid:99}; a.S.restMax={per:2,total:0}; a.S.exactShifts=["early"];
a.S.weekendEarlyMax=1;
a.S.mustWork=[{name:"陈悦娴",day:0}];
a.S.groups={earlyNight:{members:["何广友","邓臻蓝","孙勇","王鹏俊"],minEarly:1,minNight:1},
  openClose:{members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"],open:1,close:2,maxPerWeek:3}};
a.T.autoSchedule(); a.T.assignRoles(a.T.curKey());

/* 1~2：往返无损 + 长度可控 */
const link = a.T.buildShareLink();
const kb = (link.length/1024).toFixed(1);
expect(/^https:\/\/example\.invalid\/app\.html#s=/.test(link), "链接格式正确（数据放在 # 后面，不会发给服务器）");
const payload = JSON.parse(decodeURIComponent(link.split("#s=")[1]));
expect(payload.staff && payload.staff[0] === "欧阳慕雪", "中文 / 生僻字人名往返无损", "实际「"+(payload.staff&&payload.staff[0])+"」");
expect(JSON.stringify(payload.schedule) === JSON.stringify(a.T.snapshotState().schedule), "班表数据往返完全一致");
expect(link.length < 60000, `链接长度可控（${kb} KB，未触发超长提示）`);
console.log(`     实测长度：${kb} KB`);

/* 3：本地无存档 → 打开分享链接会播种 */
const hash = link.slice(link.indexOf("#"));
const b = load(hash, null);
expect(b.store !== null, "本地无存档时，分享链接会写入本地");
expect(b.S.staff && b.S.staff[0] === "欧阳慕雪", "播种后人名正确", "实际「"+(b.S.staff&&b.S.staff[0])+"」");
expect(b.S.schedule && Object.keys(b.S.schedule).length > 0, "播种后班表也在");

/* 4：本地已有存档 → 绝不被覆盖（最关键的一条）
   mine 必须是「当前版本」的存档（带上 limitsV 这类版本标记），否则会被一次性迁移重写，
   断言就会变成「不许应用做迁移」——那不是这条测试要测的东西。 */
const mine = JSON.stringify({staff:["我自己的人"], needs:a.S.needs, needsV:a.S.needsV,
  limits:a.S.limits, limitsV:1, restMax:a.S.restMax, weekendEarlyMax:1, groups:a.S.groups,
  requests:[], mustWork:[], schedule:{}, roles:{}, roleSig:{}, manual:{}});
const c = load(hash, mine);
expect(c.store === mine, "本地已有存档时，分享链接绝不覆盖本地数据");
expect(c.S.staff[0] === "我自己的人", "打开的仍是本地自己的数据", "实际「"+c.S.staff[0]+"」");

/* 4b：老存档（没有 limitsV 标记）→ 一次性迁移可以重写存档，但分享链接的数据仍然不许接管 */
const legacy = JSON.stringify({staff:["我自己的人"], needs:a.S.needs, needsV:a.S.needsV,
  limits:{early:3,night:4,mid:99}, restMax:a.S.restMax, weekendEarlyMax:1, groups:a.S.groups,
  requests:[], mustWork:[], schedule:{}, roles:{}, roleSig:{}, manual:{}});
const d0 = load(hash, legacy);
expect(JSON.parse(d0.store).staff[0] === "我自己的人", "老存档：分享链接的数据不接管名册");
expect(d0.S.limits.night === 3, "老存档：晚班上限 4 → 3 一次性迁移生效", "实际 "+d0.S.limits.night);
expect(JSON.parse(d0.store).limits.night === 3, "老存档：迁移结果落库");
/* 迁移只做一次：用户之后把晚班上限改回 4，再打开不许被改回 3 */
const after = JSON.parse(d0.store); after.limits.night = 4;
const d1 = load("", JSON.stringify(after));
expect(d1.S.limits.night === 4, "迁移只做一次：用户手改回 4 被尊重", "实际 "+d1.S.limits.night);
expect(d1.store === JSON.stringify(after), "已迁移过的存档：加载不写库（用户手改的值不被悄悄改掉）");

/* 5：畸形 / 空片段不能崩、不能乱播种 */
["", "#", "#s=", "#s=乱码", "#s=%7B%22broken%22%3A", "#other=1", "#s=" + encodeURIComponent('{"noStaff":1}')].forEach((h,i)=>{
  let ok = true, msg = "";
  try{
    const d = load(h, null);
    if(d.store !== null){ ok = false; msg = "竟然播种了"; }
  }catch(e){ ok = false; msg = "抛异常：" + e.message; }
  expect(ok, `畸形片段「${h||"(空)"}」不崩且不乱播种`, msg);
});

/* 6：复制动作在各种环境下都不能抛异常 */
[ {name:"有剪贴板 API", opt:{clipboard:true}},
  {name:"无剪贴板 API、有 execCommand", opt:{}},
  {name:"连 execCommand 都失败", opt:{execCommand:false}} ].forEach(cfg=>{
  let ok = true, msg = "";
  try{
    const e = load("", null, cfg.opt);
    e.S.staff = ["甲","乙"];
    e.T.copyShareLink();
  }catch(err){ ok = false; msg = err.message; }
  expect(ok, `复制分享链接：${cfg.name}时不抛异常`, msg);
});

console.log("\n══════════════════════════════");
console.log(`===== 分享链接测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
