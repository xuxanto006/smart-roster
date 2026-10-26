/* 微调路径模糊测试：配置与请假条都随机，验证「不崩、不排非法值、请假一定生效」。
   已有的测试都跑在默认 31 人配置上；真实使用里用户会改人数 / 上限 / 需求 / 休息天数，
   这条测试专门覆盖「配置被改花之后」的微调路径。
   断言（全是硬性质，不允许例外）：
     1. 不抛异常；
     2. 每个格子的值只能是 早/中/晚/休/空 五种之一；
     3. 每个人都是 7 格、没有多出来的行；
     4. 请假一定生效（休息 / 固定班 / 禁排 / 必须上班）；
     5. 徽标与统计区渲染不抛异常（repatchWeek 内部会 renderAll）。 */
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){}}};
const els={}; let saved=null;
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>saved,setItem(k,v){saved=v},removeItem(){saved=null}},console,confirm:()=>true,alert(){},prompt:()=>"",
setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,repatchWeek,buildRules,curKey,ensureWeek,activeRequests,groupMembers,assignRoles,pushRequest,DEFAULT_STAFF};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;

const ROUNDS=+(process.argv[2]||120);
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const TYPES=["off","off","off","off","work","early","mid","night","noearly","nomid","nonight","nomid","nonight"];
const OK=new Set(["early","mid","night","rest",""]);
const NAME={early:"早",mid:"中",night:"晚",rest:"休",'':"空"};

let pass=0,fail=0; const bad=[];
function hit(msg){ fail++; if(bad.length<8) bad.push(msg); }

console.log("══════ 微调路径模糊测试（"+ROUNDS+" 组随机配置）══════\n");
let nCrash=0,nBadVal=0,nBadRow=0,nReq=0, reqChecked=0;
for(let r=0;r<ROUNDS;r++){
  // —— 随机配置 ——
  const N = 6 + rnd(28);                                  // 6~33 人
  S.staff = T.DEFAULT_STAFF.slice(0, Math.min(N, T.DEFAULT_STAFF.length));
  while(S.staff.length < N) S.staff.push("临时"+S.staff.length);
  const per = 1 + rnd(3);                                 // 每人每周休 1~3 天
  const eLim = 1 + rnd(5), nLim = 1 + rnd(5);
  S.limits = {early:eLim, night:nLim, mid:99};
  S.restMax = {per, total: rnd(3)===0 ? per*S.staff.length + rnd(5) : 0};
  S.needs = [0,1,2,3,4,5,6].map(d=>{
    const base = Math.max(0, Math.floor(S.staff.length*(d<5?0.28:0.32)) - rnd(3));
    return {early: Math.max(0, base), mid: rnd(3), night: Math.max(0, base + rnd(3))};
  });
  S.exactShifts = rnd(4) ? ["early"] : [];
  S.weekendEarlyMax = 1 + rnd(3);
  S.mustWork = rnd(3) ? [] : [{name:pick(S.staff), day:rnd(7)}];
  const useGroups = rnd(2)===0;
  S.groups = useGroups ? {
    earlyNight:{members:S.staff.slice(0,Math.max(1,Math.floor(N/8))), minEarly:1, minNight:1},
    openClose:{members:S.staff.slice(0,Math.min(N,3+rnd(7))), open:1+rnd(2), close:1+rnd(3), maxPerWeek:1+rnd(5)}
  } : {earlyNight:{members:[],minEarly:0,minNight:0}, openClose:{members:[],open:0,close:0,maxPerWeek:3}};
  S.schedule={}; S.roles={}; S.roleSig={}; S.manual={}; S.requests=[];

  // 先排一张干净的
  try{ T.autoSchedule(); T.assignRoles(T.curKey()); }
  catch(e){ hit(`第${r+1}轮 autoSchedule 抛异常：${e.message}`); continue; }

  // —— 随机请假条：走 pushRequest（与界面 / 粘贴导入同一入口），
  //     因此只会产生用户在界面上真能录进来的状态（互斥类型会被自动替换）——
  const nReqNow = 1 + rnd(4);
  S.requests = [];
  for(let i=0;i<nReqNow;i++) T.pushRequest(pick(S.staff), rnd(7), pick(TYPES), "once");
  const reqs = S.requests.slice();

  // —— 跑微调 ——
  try{ T.repatchWeek(true); }
  catch(e){ nCrash++; hit(`第${r+1}轮 repatchWeek 抛异常：${e.message}`); continue; }

  // 断言 2/3：格子值合法、每人 7 格
  const k=T.curKey(), w=T.ensureWeek(k)||{};
  for(const n of S.staff){
    const row=w[n];
    if(!Array.isArray(row) || row.length!==7){ nBadRow++; hit(`第${r+1}轮 ${n} 的行不是 7 格（${row?row.length:"缺行"}）`); continue; }
    for(let d=0;d<7;d++){
      const v=row[d]===undefined?"":row[d];
      if(!OK.has(v)){ nBadVal++; hit(`第${r+1}轮 ${n} 周${d+1} 出现非法值「${v}」`); }
    }
  }
  // 断言 4：请假一定生效
  const R=T.buildRules(k);
  for(const q of reqs){
    reqChecked++;
    const n=q.name, d=q.day, v=w[n]?w[n][d]||"":"";
    const c=R[n]&&R[n][d];
    if(!c) continue;
    let ok=true, why="";
    if(c.off && v!=="rest"){ ok=false; why=`应休息，实际「${NAME[v]}」`; }
    else if(c.only && v!==c.only){ ok=false; why=`应固定${NAME[c.only]}，实际「${NAME[v]}」`; }
    else if(c.ban && c.ban[v] && v){ ok=false; why=`禁排${NAME[v]}，实际还是${NAME[v]}`; }
    else if(c.noOff && !c.only && v==="rest"){ ok=false; why=`必须上班，实际休息`; }
    if(!ok){
      nReq++;
      const same=reqs.filter(x=>x.name===n && x.day===d).map(x=>x.type).join("+");
      const dup = same.includes("+") ? ` ⚠️同人同天 ${same}` : "";
      hit(`第${r+1}轮 请假未生效：${n} 周${d+1} ${q.type} —— ${why}${dup}`);
    }
  }
}

function line(cond,msg){ if(cond){pass++;console.log("  ✅ "+msg);} else {console.log("  ❌ "+msg);} }
line(nCrash===0,  `${ROUNDS} 组随机配置下 repatchWeek 全程不抛异常`, nCrash?`崩了 ${nCrash} 次`:"");
line(nBadVal===0, `班表里不出现非法值（只允许 早/中/晚/休/空）`, nBadVal?`${nBadVal} 处`:"");
line(nBadRow===0, `每个人的行都是完整的 7 格`, nBadRow?`${nBadRow} 处`:"");
line(nReq===0,    `请假 / 特殊班次 100% 生效（共校验 ${reqChecked} 条）`, nReq?`${nReq} 条未生效`:"");
if(fail) console.log("\n  失败样例：\n" + bad.map(x=>"   · "+x).join("\n"));
console.log("\n══════════════════════════════");
console.log(`===== 微调模糊测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);
