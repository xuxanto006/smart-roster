/* 一键排班路径模糊测试：配置随机（含极端人数 / 上限 / 需求 / 分组），验证
     1. 不抛异常（autoSchedule + renderAll + renderHealth 全链路）
     2. 格子值合法、每人 7 格
     3. 请假 / 固定班 / 禁排 / 必须上班 全部生效
   与 test_repatch_fuzz.js 的区别：那条只覆盖「微调」，这条覆盖「从零排班 + 渲染」。
   请假条同样走 pushRequest，只造界面上真能录进来的状态。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function makeEl(id){
  const cls=new Set();
  return {id, value:"", textContent:"", innerHTML:"", style:{}, options:[], disabled:false,
    classList:{add:c=>cls.add(c), remove:c=>cls.delete(c), toggle(){}, contains:c=>cls.has(c)},
    getAttribute(){return null}, setAttribute(){}, click(){}, appendChild(){}, addEventListener(){}, remove(){}};
}
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return makeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},
console:{log(){},warn(){},error(){}},confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:(fn)=>{fn();return 0;},clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,renderAll,renderHealth,buildRules,curKey,ensureWeek,activeRequests,groupMembers,assignRoles,pushRequest,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const ROUNDS=+(process.argv[2]||60);
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const TYPES=["off","off","off","off","work","early","mid","night","noearly","nomid","nonight"];
const OK=new Set(["early","mid","night","rest",""]);
const NAME={early:"早",mid:"中",night:"晚",rest:"休","":"空"};

let pass=0,fail=0; const bad=[];
function hit(m){ fail++; if(bad.length<10) bad.push(m); }

console.log("══════ 一键排班路径模糊测试（"+ROUNDS+" 组随机配置）══════\n");
let nCrash=0,nBadVal=0,nBadRow=0,nReq=0,reqChecked=0,nRender=0;
for(let r=0;r<ROUNDS;r++){
  const N = 4 + rnd(30);                                   // 4~33 人（含极端小团队）
  S.staff = T.DEFAULT_STAFF.slice(0, Math.min(N, T.DEFAULT_STAFF.length));
  while(S.staff.length < N) S.staff.push("临时"+S.staff.length);
  const per = 1 + rnd(3);
  S.limits = {early:1+rnd(5), night:1+rnd(5), mid:99};
  S.restMax = {per, total: rnd(3)===0 ? per*S.staff.length + rnd(5) : 0};
  S.needs = [0,1,2,3,4,5,6].map(d=>{
    // 故意让需求有时超过人手上限，制造「排不满」的极端场景
    const base = Math.max(0, Math.round(S.staff.length*(d<5?0.3:0.34)) - rnd(4));
    return {early: base, mid: rnd(3), night: Math.max(0, base + rnd(4))};
  });
  S.exactShifts = rnd(4) ? ["early"] : [];
  S.weekendEarlyMax = 1 + rnd(3);
  S.mustWork = rnd(2) ? [] : [{name:pick(S.staff), day:rnd(7)}, {name:pick(S.staff), day:rnd(7)}];
  const g1 = S.staff.slice(0, Math.max(1, Math.floor(N/8)));
  const g2 = S.staff.slice(0, Math.min(N, 2+rnd(8)));
  S.groups = {
    earlyNight:{members: rnd(4)?g1:[], minEarly:1, minNight:1},
    openClose:{members: rnd(4)?g2:[], open:1+rnd(2), close:1+rnd(3), maxPerWeek:1+rnd(5)}
  };
  S.schedule={}; S.roles={}; S.roleSig={}; S.manual={}; S.requests=[];

  for(let i=0;i<1+rnd(4);i++) T.pushRequest(pick(S.staff), rnd(7), pick(TYPES), "once");

  // 1. 排班 + 全链路渲染：都不许抛异常
  try{ T.autoSchedule(); T.renderAll(); T.renderHealth(T.ensureWeek(T.curKey()), T.buildRules(T.curKey())); }
  catch(e){ nCrash++; hit(`第${r+1}轮 排班/渲染抛异常：${e.message}`); continue; }

  const k=T.curKey(), w=T.ensureWeek(k)||{}, R=T.buildRules(k);
  // 2. 值合法 + 每人 7 格
  for(const n of S.staff){
    const row=w[n];
    if(!Array.isArray(row) || row.length!==7){ nBadRow++; hit(`第${r+1}轮 ${n} 行不是 7 格`); continue; }
    for(let d=0;d<7;d++){
      const v=row[d]===undefined?"":row[d];
      if(!OK.has(v)){ nBadVal++; hit(`第${r+1}轮 ${n} 周${d+1} 非法值「${v}」`); }
    }
  }
  // 3. 安排必须生效
  for(const q of (S.requests||[])){
    reqChecked++;
    const n=q.name, d=q.day, v=(w[n]&&w[n][d])||"", c=R[n]&&R[n][d];
    if(!c) continue;
    let ok=true, why="";
    if(c.off && v!=="rest"){ ok=false; why=`应休息，实际「${NAME[v]}」`; }
    else if(c.only && v!==c.only){ ok=false; why=`应固定${NAME[c.only]}，实际「${NAME[v]}」`; }
    else if(c.ban && c.ban[v] && v){ ok=false; why=`禁排${NAME[v]}`; }
    else if(c.noOff && !c.only && v==="rest"){ ok=false; why=`必须上班，实际休息`; }
    if(!ok){ nReq++; hit(`第${r+1}轮 安排未生效：${n} 周${d+1} ${q.type} —— ${why}`); }
  }
  // 4. 体检面板渲染出来的 HTML 不能含 undefined / NaN
  const hh = (els["healthBody"] && els["healthBody"].innerHTML) || "";
  if(/undefined|NaN/.test(hh)){ nRender++; hit(`第${r+1}轮 体检面板输出含 undefined/NaN`); }
}
function line(c,m,e){ if(c){pass++;console.log("  ✅ "+m);} else console.log("  ❌ "+m+(e?"  "+e:"")); }
line(nCrash===0,  `${ROUNDS} 组随机配置下「排班 + 全量渲染」不抛异常`, `崩 ${nCrash} 次`);
line(nBadVal===0, `格子值合法（只允许 早/中/晚/休/空）`, `${nBadVal} 处非法`);
line(nBadRow===0, `每人都是完整 7 格`, `${nBadRow} 处`);
line(nReq===0,    `请假 / 特殊班次 100% 生效（共校验 ${reqChecked} 条）`, `${nReq} 条未生效`);
line(nRender===0, `体检面板不输出 undefined / NaN`, `${nRender} 轮`);
if(fail) console.log("\n  失败样例：\n" + bad.map(x=>"   · "+x).join("\n"));
console.log("\n══════════════════════════════");
console.log(`===== 排班模糊测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
