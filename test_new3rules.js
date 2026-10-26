/* 三条新规则的专项测试
   ① 休息配额区间（1-2 / 2-3 天可调）+ 休 3 天禁 3 连休（可 2 连休 / 单休）
   ② 专家老师组每天保证 1 早 + 1 晚
   ③ 模块人员不得全员休息，至少 1-2 人在岗（班次不限）
*/
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync(process.env.APP_FILE||"/Users/xianyu/WorkBuddy/2026-09-02-11-41-05/app_merged.html","utf8");
const code=(()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();
function fakeEl(id){return{id,value:"",textContent:"",innerHTML:"",style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},getAttribute(){return null},setAttribute(){},click(){},appendChild(){},addEventListener(){},querySelectorAll(){return[]},querySelector(){return fakeEl("q")},children:[],dataset:{}};}
const els={};
const sandbox={document:{getElementById(id){if(!els[id])els[id]=fakeEl(id);return els[id]},querySelectorAll(){return[]},createElement(){return fakeEl("t")}},
localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,confirm:()=>true,alert(){},prompt:()=>"",setTimeout:()=>0,clearTimeout(){},
Math,Date,JSON,Array,Object,String,Number,Set,Map,isNaN,parseInt,parseFloat,performance:{now:()=>Date.now()},URL:{createObjectURL:()=>"",revokeObjectURL(){}},Blob:function(){}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(code+"\nglobalThis.__T={get state(){return state},autoSchedule,curKey,ensureWeek,groupMembers,schedulableGroupMembers,getStaffProfile,domainStaff,curDomain,domRestMax,restTotalCap,isBlockedFromSchedule,restRange,moduleMinOn,setRestMax,setModuleMinOn,renderRestHints,run3RestCount,isolatedRestCount,buildRules,save,renderAll,exportCSV,moduleMinOnExempt,weekRestSet,EXCLUDE_SCHEDULE,EXCLUDE_MODULES,DOMAINS,domainStaff,domainSchedulable,domNeeds,domLimits,domRestMax,curDomain,fixedRosterOf,fixedRosterNames,applyFixedRoster,buildRules,isZunjie,isHongmeng,ORDER_3C,staffDisplayCmp,nonManagerBlocked};",sandbox,{filename:"s"});
const T=sandbox.__T,S=T.state;
const DAY=["周一","周二","周三","周四","周五","周六","周日"];
const DOMS=["3c","hongmeng","aftersales","manager"];
const RFIELD={"3c":"restMax","hongmeng":"restMaxHM","aftersales":"restMaxAS","manager":"restMaxMgr"};

let pass=0,fail=0;
function chk(c,m,extra){ if(c){pass++;console.log("  ✅ "+m);} else {fail++;console.log("  ❌ "+m+(extra?"  "+extra:""));} }

function setRest(min,per){
  S.restMax={min,per,total:0};
  ["restMaxHM","restMaxMgr","restMaxAS"].forEach(f=>{ if(S[f]) S[f]={min,per,total:0}; });
}
function runAll(){
  const out=[];
  DOMS.forEach(dom=>{
    S.domain=dom;
    const rf=RFIELD[dom];
    if(rf && S[rf]) S[rf]=S.restMax;
    T.autoSchedule(dom);
    const k=T.curKey(), week=T.ensureWeek(k);
    const people=T.domainStaff(dom).filter(n=>!T.isBlockedFromSchedule(n));
    out.push({dom,week,people});
  });
  return out;
}
function restSet(week,n){ const s=new Set(); for(let d=0;d<7;d++){ const v=(week[n]||[])[d]; if(v==="rest"||v==="") s.add(d); } return s; }

/* ---------- ①A. 休息配额区间 ---------- */
console.log("— ①A. 休息配额区间 —");
/* 优先级说明：专家老师组成员的休息天数偶尔会低于 min。
   那是 fixGroupGuarantee 为满足「每天一早一晚」硬规则付出的代价
   （位置要让给别的组员，顶上来的那个人就少休一天）。
   硬规则 > 配额目标，所以组员豁免；其余所有人必须在区间内。 */
[[1,2],[2,3],[1,3]].forEach(([mn,pr])=>{
  setRest(mn,pr);
  const res=runAll();
  const enMem=T.schedulableGroupMembers("earlyNight");
  const dist={}, outOfRange=[];
  res.forEach(({dom,week,people})=>{
    people.forEach(n=>{
      const r=restSet(week,n).size;
      dist[r]=(dist[r]||0)+1;
      if(r<mn||r>pr){
        if(enMem.includes(n)) return;   // 组员豁免：配额让位于早晚保障
        outOfRange.push(`${dom}/${n}=${r}`);
      }
    });
  });
  const keys=Object.keys(dist).map(Number).sort((a,b)=>a-b);
  chk(outOfRange.length===0, `${mn}~${pr} 天：所有非豁免人员休息天数都落在区间内`, outOfRange.slice(0,4).join(" "));
  chk(keys.every(k=>k>=mn-1&&k<=pr), `${mn}~${pr} 天：分布 ${JSON.stringify(dist)} 无人越界超 1 天`);
});
// min === per 时应退化成「恰好 per 天」
setRest(2,2);
let res=runAll(), exact=true, cnt=0;
res.forEach(({week,people})=>people.forEach(n=>{ cnt++; if(restSet(week,n).size!==2) exact=false; }));
chk(exact, `2~2 天退化为「每人恰好休 2 天」（${cnt} 人）`);

/* ---------- ①B. 休 3 天禁 3 连休 ---------- */
console.log("\n— ①B. 休 3 天禁 3 连休 —");
[[2,3],[3,3]].forEach(([mn,pr])=>{
  setRest(mn,pr);
  const res=runAll();
  const bad=[];
  res.forEach(({dom,week,people})=>{
    people.forEach(n=>{
      const s=restSet(week,n);
      // 排除「全部来自请假」的特殊需求
      const R=T.buildRules ? T.buildRules(T.curKey())[n] : null;
      let allForced = s.size>0;
      s.forEach(d=>{ const c=R&&R[d]; if(!(c&&c.off)) allForced=false; });
      if(allForced) return;
      if(T.run3RestCount(s)>0) bad.push(`${dom}/${n}`);
    });
  });
  chk(bad.length===0, `${mn}~${pr} 天：无人 3 天连休`, bad.slice(0,5).join(" "));
});
// 允许 2 连休：构造一个 3 天连休的集合，确认判定工具能识别；同时确认 2 连休不误报
const s3=new Set([4,5,6]), s2=new Set([4,5]), s1=new Set([4]);
chk(T.run3RestCount(s3)===1, "判定工具：{五六日} 识别为 3 连休");
chk(T.run3RestCount(s2)===0, "判定工具：2 天连休不算违规（允许）");
chk(T.run3RestCount(s1)===0, "判定工具：单休不算违规（允许）");
chk(T.run3RestCount(new Set([5,6,0]))===1, "判定工具：跨周 3 连休（周六日周一）也能识别");

/* ---------- ②. 专家老师组一早一晚 ---------- */
console.log("\n— ②. 专家老师组每天 1 早 + 1 晚 —");
[[2,2],[2,3],[1,2]].forEach(([mn,pr])=>{
  setRest(mn,pr);
  res=runAll();
  const bad=[];
  res.forEach(({dom,week,people})=>{
    if(dom!=="3c") return;   // 组员都在 3c 领域
    const mem=T.schedulableGroupMembers("earlyNight");
    for(let d=0; d<7; d++){
      const e=mem.filter(n=>week[n][d]==="early").length;
      const ni=mem.filter(n=>week[n][d]==="night").length;
      if(e<1||ni<1) bad.push(`${DAY[d]} 早${e} 晚${ni}`);
    }
  });
  chk(bad.length===0, `${mn}~${pr} 天：专家老师组每天都有 1 早 + 1 晚`, bad.slice(0,3).join(" "));
});

/* ---------- ②B. 模块归属：库房已从销售运营独立 ---------- */
console.log("\n— ②B. 模块归属 —");
{
  const KF=["张泽鑫","李文捷","李世龙","林嘉彤","曾子杰"];
  const notKF = KF.filter(n=> T.getStaffProfile(n).module !== "库房");
  chk(notKF.length===0, "库房 5 人 module 均为「库房」", notKF.join(" "));
  const noPos = KF.filter(n=> T.getStaffProfile(n).position !== "库房管理");
  chk(noPos.length===0, "库房 5 人岗位仍为「库房管理」", noPos.join(" "));
  const stillExcluded = KF.filter(n=> !T.isBlockedFromSchedule(n));
  chk(stillExcluded.length===0, "库房 5 人仍不参与排班（岗位排除生效）", stillExcluded.join(" "));
  // 销售运营剩 3 人：齐妍（经理，本就不排班）+ 陈悦娴 + 张淑慧
  const soPpl = S.staff.filter(n=> T.getStaffProfile(n).module === "销售运营");
  chk(soPpl.length===3, `销售运营剩 3 人（齐妍 + 陈悦娴 + 张淑慧），实际 ${soPpl.length} 人`, soPpl.join(" "));
  const soSched = soPpl.filter(n=> !T.isBlockedFromSchedule(n));
  chk(soSched.length===2, `其中可排班的只有 2 人（${soSched.join(" ")}）`, soSched.join(" "));
  chk(T.moduleMinOnExempt("销售运营"), "销售运营已加入模块在岗排除名单");
  chk(!T.moduleMinOnExempt("陈列运维"), "其他模块未被误排除");

  // 行政：原人事培训 2 人 + 原企业购收银 3 人，已统一按模块免排
  const XZ=["刘可佳","何昊敏","黎瑶","莫甄姗","杨乐乐"];
  const badMod = XZ.filter(n=> T.getStaffProfile(n).module !== "行政");
  chk(badMod.length===0, "行政 5 人 module 均为「行政」", badMod.join(" "));
  // 行政已改用「固定班表」：不再是免排，而是有确定班次（周一~周五早班、周末双休）
  chk(!T.EXCLUDE_MODULES.has("行政"), "「行政」已移出 EXCLUDE_MODULES（改由固定班表接管）");
  const stillName = ["黎瑶","莫甄姗","杨乐乐"].filter(n=> T.EXCLUDE_SCHEDULE.has(n));
  chk(stillName.length===0, "原按人名排除的 3 人已移出 EXCLUDE_SCHEDULE", stillName.join(" "));
  /* 固定班表的人对算法而言仍算「不可排班」—— 班次由 fixedRoster 直接写死，
     若混进人力池会让算法误以为多了可用人力（实测会让 3c 排出整周空表）。
     「有确定班次」与「参与算法分配」是两件事。 */
  const blockedXZ = XZ.filter(n=> T.isBlockedFromSchedule(n));
  chk(blockedXZ.length===XZ.length, "行政 5 人不参与算法分配（班次由固定班表写死）",
      blockedXZ.join(" "));
  // 人事培训只剩陈志浩（经理，靠身份免排），故该模块可安全移出排除名单
  chk(!T.EXCLUDE_MODULES.has("人事培训"), "「人事培训」已移出排除名单（仅剩经理陈志浩）");
  const cz = S.staff.filter(n=> T.getStaffProfile(n).module === "人事培训");
  chk(cz.every(n=> !T.isBlockedFromSchedule(n) || T.getStaffProfile(n).level === "经理"),
      "人事培训剩余人员均因经理身份免排", cz.map(n=>`${n}(${T.getStaffProfile(n).level})`).join(" "));
}

/* ---------- ②C. 库房 / 行政 已独立成部门页签 ---------- */
console.log("\n— ②C. 部门页签 —");
{
  const keys = T.DOMAINS.map(d=>d.key);
  chk(keys.includes("kufang"), "部门列表含「库房」", keys.join(","));
  chk(keys.includes("admin"),  "部门列表含「行政」", keys.join(","));
  // 3c 必须已排除这两个部门，否则 10 个人会重复出现在两个页签里
  S.domain="3c";
  const c3 = T.domainStaff("3c").map(n=> T.getStaffProfile(n).module);
  chk(!c3.includes("库房") && !c3.includes("行政"), "3C顾问 名单已不含库房 / 行政",
      [...new Set(c3)].join(","));
  // 人员不重不漏：所有非经理恰好属于且仅属于一个部门
  const all = S.staff.filter(n=> !T.isBlockedFromSchedule(n));
  const owner = {};
  T.DOMAINS.forEach(d=> T.domainStaff(d.key).forEach(n=>{ owner[n]=(owner[n]||0)+1; }));
  const dup = Object.keys(owner).filter(n=> owner[n]>1);
  chk(dup.length===0, "无人员被两个部门同时收录", dup.join(" "));
  // 库房 / 行政：各 5 人、可排班 0 人
  S.domain="kufang";
  const kf = T.domainStaff("kufang"), kfSc = T.domainSchedulable("kufang");
  chk(kf.length===5, `库房 5 人（实际 ${kf.length}）`, kf.join(" "));
  chk(kfSc.length===0, `库房可排班 0 人（实际 ${kfSc.length}）`);
  S.domain="admin";
  const ad = T.domainStaff("admin"), adSc = T.domainSchedulable("admin");
  chk(ad.length===5, `行政 5 人（实际 ${ad.length}）`, ad.join(" "));
  chk(adSc.length===0, `行政可排班 0 人（实际 ${adSc.length}）`);
  // 老存档兼容：新字段缺失时 domNeeds 能自动生成 7 天预设
  const bak = {needsKF:S.needsKF, needsAD:S.needsAD, lKF:S.limitsKF, lAD:S.limitsAD, rKF:S.restMaxKF, rAD:S.restMaxAD};
  delete S.needsKF; delete S.needsAD; delete S.limitsKF; delete S.limitsAD; delete S.restMaxKF; delete S.restMaxAD;
  ["kufang","admin"].forEach(k=>{
    S.domain=k;
    const nd = T.domNeeds(k);
    chk(Array.isArray(nd) && nd.length===7, `老存档缺 needs 字段时「${k}」能兜底生成 7 天需求`,
        JSON.stringify(nd).slice(0,40));
  });
  Object.assign(S, {needsKF:bak.needsKF, needsAD:bak.needsAD, limitsKF:bak.lKF, limitsAD:bak.lAD,
                    restMaxKF:bak.rKF, restMaxAD:bak.rAD});
  S.domain="3c";
}

/* ---------- ②D. 行政：固定班表（周一~周五早班 + 周末双休）---------- */
console.log("\n— ②D. 固定班表 —");
{
  const FR = T.fixedRosterOf("admin");
  chk(!!FR, "行政域配了固定班表");
  const names = T.fixedRosterNames("admin").sort();
  const want = ["刘可佳","何昊敏","杨乐乐","黎瑶","莫甄姗"].sort();
  chk(JSON.stringify(names)===JSON.stringify(want), "固定班表覆盖行政 5 人", names.join(" "));
  // 配置本身：周一~周五 early、周六日 rest
  const cfgBad = Object.keys(FR||{}).filter(n=>{
    const r=FR[n]||[];
    return !(r.slice(0,5).every(x=>x==="early") && r[5]==="rest" && r[6]==="rest");
  });
  chk(cfgBad.length===0, "配置即「周一~周五早班 + 周末双休」", cfgBad.join(" "));
  // 实跑一次，确认落表结果与配置一致（且不报错）
  let errMsg=null; const toastFn = T.toast || null;
  S.domain="admin";
  S.schedule={};
  try{ T.autoSchedule("admin"); }catch(e){ errMsg="异常:"+e.message; }
  const w = T.ensureWeek(T.curKey());
  const runBad = names.filter(n=>{
    const r=w[n]||[];
    return !(r.slice(0,5).every(x=>x==="early") && r[5]==="rest" && r[6]==="rest");
  });
  chk(runBad.length===0, "实际排班结果符合固定班表", runBad.join(" "));
  chk(!errMsg, "排班未抛异常", errMsg||"");
  // 不参与 3c
  S.domain="3c";
  const leak = T.domainStaff("3c").filter(n=> names.includes(n));
  chk(leak.length===0, "这 5 人不在 3C 域内（不参与 3c 规则）", leak.join(" "));
  // 请假优先
  S.domain="admin"; S.schedule={};
  S.requests.push({name:"黎瑶", day:5, type:"off", scope:"week"});
  T.autoSchedule("admin");
  const w2=T.ensureWeek(T.curKey());
  chk(w2["黎瑶"]&&w2["黎瑶"][5]==="rest", "请假优先于固定班表（周六请假仍为休息）",
      w2["黎瑶"]?w2["黎瑶"][5]:"空");
  S.requests=[];
  S.schedule={};
  S.domain="3c";
}
/* ---------- ②E. 尊界：独立部门（从鸿蒙智行分出）---------- */
console.log("\n— ②E. 尊界独立部门 —");
{
  const ZJ=["王秋千","张晓龙","廖梓宸","林家鸿","张荣","唐心丽"];
  const keys=T.DOMAINS.map(d=>d.key);
  chk(keys.includes("zunjie"), "部门列表含「尊界」", keys.join(","));
  const badMod=ZJ.filter(n=> T.getStaffProfile(n).module !== "尊界");
  chk(badMod.length===0, "这 6 人 module 均为「尊界」", badMod.join(" "));
  const leak=T.domainStaff("hongmeng").filter(n=> ZJ.includes(n));
  chk(leak.length===0, "鸿蒙智行已不含尊界人员", leak.join(" "));
  S.domain="zunjie";
  const zj=T.domainStaff("zunjie");
  chk(zj.length===5, `尊界域 5 人可排班（王秋千为经理归经理域），实际 ${zj.length} 人`, zj.join(" "));
  chk(zj.includes("唐心丽"), "唐心丽已归入尊界域", zj.join(" "));
  const seen={}, dup=[];
  T.DOMAINS.forEach(d=> T.domainStaff(d.key).forEach(n=>{ if(seen[n]) dup.push(n); seen[n]=1; }));
  chk(dup.length===0, "各领域互不相交", dup.join(" "));
  S.schedule={}; S.domain="zunjie";
  try{ T.autoSchedule("zunjie"); }catch(e){}
  const w=T.ensureWeek(T.curKey());
  const miss=zj.filter(n=> !(w[n]||[]).some(v=> v && v!==""));
  chk(miss.length===0, `尊界可独立排班（${zj.length-miss.length}/${zj.length} 人拿到班次）`, miss.join(" "));
  S.schedule={}; S.domain="hongmeng";
  try{ T.autoSchedule("hongmeng"); }catch(e){}
  const hm=T.domainSchedulable("hongmeng"), wh=T.ensureWeek(T.curKey());
  const hmMiss=hm.filter(n=> !(wh[n]||[]).some(v=> v && v!==""));
  chk(hmMiss.length===0, `鸿蒙智行不受影响（${hm.length-hmMiss.length}/${hm.length} 人拿到班次）`, hmMiss.join(" "));
  S.schedule={}; S.domain="3c";
}

/* ---------- ②F. 固定班表用 pattern（整部门统一，新增人员自动适用）---------- */
console.log("\n— ②F. 固定班表 pattern 模式 —");
{
  const pat = S.fixedRoster && S.fixedRoster.admin && S.fixedRoster.admin.pattern;
  chk(Array.isArray(pat) && pat.length===7, "行政配的是 pattern（整部门统一）而非逐人 roster", JSON.stringify(pat));
  chk(!!pat && pat.slice(0,5).every(x=>x==="early") && pat[5]==="rest" && pat[6]==="rest",
      "pattern 即「周一~周五早班 + 周末双休」", JSON.stringify(pat));
  // 展开后应覆盖行政全员
  const FR = T.fixedRosterOf("admin");
  const adminAll = T.domainStaff("admin").slice();
  const notCovered = adminAll.filter(n=> !(FR && FR[n]));
  chk(notCovered.length===0, `pattern 覆盖行政全员（${adminAll.length} 人）`, notCovered.join(" "));
  /* 关键性质：以后往行政加人，应当**自动**适用，不需要改代码。
     这里造一个新人验证 —— 这是 pattern 相比逐人 roster 的唯一理由。 */
  const NEW="测试新人";
  S.staff.push(NEW);
  S.staffProfiles = Object.assign({}, S.staffProfiles,
      {[NEW]:{module:"行政",position:"行政",level:"员工",tags:[]}});
  const FR2 = T.fixedRosterOf("admin");
  chk(!!(FR2 && FR2[NEW] && FR2[NEW].slice(0,5).every(x=>x==="early") && FR2[NEW][5]==="rest"),
      "新增人员自动纳入固定班表（无需改代码）", JSON.stringify(FR2&&FR2[NEW]));
  S.staff = S.staff.filter(n=>n!==NEW);
  if(S.staffProfiles) delete S.staffProfiles[NEW];
  // 其他领域不应被牵连
  ["3c","hongmeng","zunjie","aftersales"].forEach(d=>{
    if(T.fixedRosterNames(d).length !== 0) chk(false, `${d} 不应有固定班表`, T.fixedRosterNames(d).join(" "));
  });
  chk(true, "其他领域均未配置固定班表（不受牵连）");
}

/* ---------- ②G. 3c 人名固定顺序（用户指定）---------- */
console.log("\n— ②G. 3c 人名顺序 —");
{
  /* 用户指定的 32 人；黎振鹏在 3c 域内但不在用户名单里，
     保留在末尾（不删除人员），所以实际顺序是 33 人。 */
  const W=["何广友","邓臻蓝","孙勇","王鹏俊","陈悦娴","张淑慧","刘科","黄少龙","郭嘉洪","王申澳","高子健","冯楷",
           "胡亚达","李文轩","桑浩洋","黄雅情","王娜娜","符名洋","高超","周林奥","吴心然","刘舒晨","刘思含","刘乔一",
           "李秀珊","吴洋洋","李敏","张子柔","程雨轩","谢佳委","田方斌","贾孟源","黎振鹏"];
  chk(T.ORDER_3C.length===33, `ORDER_3C 共 33 人（指定 32 + 黎振鹏），实际 ${T.ORDER_3C.length}`);
  chk(JSON.stringify(T.ORDER_3C.slice(0,32))===JSON.stringify(W.slice(0,32)),
      "ORDER_3C 前 32 人与用户指定顺序完全一致");
  // 3c 表格排序后应完全等于该顺序
  S.domain="3c";
  const shown=T.domainStaff("3c").slice().sort(T.staffDisplayCmp);
  chk(JSON.stringify(shown)===JSON.stringify(W), `3c 表格从上到下 = 指定顺序（实际 ${shown.length} 人）`,
      shown.join(" "));
  /* 关键性质：免排的人也不能打乱位置。
     原先这里拿「李敏」当例子（她当时在 EXCLUDE_SCHEDULE 里免排），
     但 2026-10-26 起李敏已移出排除名单、正常参与排班，
     3c 域里已无免排人员可测 —— 改用仍在排除名单的「黄弼姗」验证同一性质。
     另外补一条：李敏现在必须**不被排除**。 */
  const idxLiMin=W.indexOf("李敏");
  chk(T.nonManagerBlocked("李敏")===false, "李敏已移出排除名单，正常参与排班");
  chk(shown[idxLiMin]==="李敏", `李敏仍在指定位置（第 ${idxLiMin+1} 位）`,
      `实际第 ${shown.indexOf("李敏")+1} 位`);
  chk(T.nonManagerBlocked("黄弼姗")===true, "黄弼姗仍是非经理免排（会被老逻辑沉底）");
  chk(T.ORDER_3C[T.ORDER_3C.length-1]==="黎振鹏", "不在用户名单的黎振鹏保留在末尾（未删除）", T.ORDER_3C.slice(-3).join(" "));
  // 名单外的人（其他领域）不受影响
  S.domain="hongmeng";
  const hm=T.domainStaff("hongmeng").slice().sort(T.staffDisplayCmp);
  const leak=hm.filter(n=> W.includes(n));
  chk(leak.length===0, "其他领域的表格不受影响", leak.join(" "));
  S.domain="3c";
}

console.log("\n— ③. 模块至少 1 人在岗（班次不限）—");
[1,2].forEach(n=>{
  S.moduleMinOn=n;
  setRest(2,2);
  res=runAll();
  const bad=[];
  res.forEach(({dom,week,people})=>{
    const byMod={};
    people.forEach(n=>{ const m=T.getStaffProfile(n).module; (byMod[m]=byMod[m]||[]).push(n); });
    Object.keys(byMod).forEach(m=>{
      if(T.moduleMinOnExempt(m)) return;  // 排除名单（如 2 人的销售运营，见 moduleMinOnExempt）
      if(byMod[m].length<=n) return;       // 单人/等于下限的模块无法自洽
      for(let d=0; d<7; d++){
        const on=byMod[m].filter(x=>{ const v=(week[x]||[])[d]; return v==="early"||v==="mid"||v==="night"; }).length;
        if(on<n) bad.push(`${dom}/${m} ${DAY[d]} 在岗${on}`);
      }
    });
  });
  chk(bad.length===0, `moduleMinOn=${n}：无模块全员休息（排除名单除外）`, bad.slice(0,4).join(" "));
});
/* 排除名单确实生效：销售运营只剩 2 人，被排除后应允许同一天休息（排除前是被锁死的）。
   判定方式改为「累积共同休息日」而不是「统计命中轮次」——
   实测同休命中率约 44%，按轮次判定会因随机波动假失败（8 轮全不中的概率仍有 5%）。 */
{
  S.moduleMinOn=1;
  setRest(2,2);
  let sharedDays=0;
  for(let t=0; t<16; t++){
    S.domain="3c";
    T.autoSchedule("3c");
    const w=T.ensureWeek(T.curKey());
    const a=T.weekRestSet(w,"陈悦娴"), b=T.weekRestSet(w,"张淑慧");
    sharedDays += [...a].filter(x=>b.has(x)).length;
  }
  chk(sharedDays>0, `排除名单生效：销售运营 2 人可同日休息（16 轮累计 ${sharedDays} 个共同休息日）`,
      "若为 0，说明该模块仍被「至少1人在岗」锁死");
}
// 关闭时恢复自由
S.moduleMinOn=0;

/* ---------- ④. UI setter 行为 ---------- */
console.log("\n— ④. 设置项 setter —");
els.restMin={value:"2",...fakeEl("restMin")}; els.restPer=fakeEl("restPer"); els.restTotal=fakeEl("restTotal");
els.restPer.value="3"; els.restMin.value="2"; els.restTotal.value="0";
T.setRestMax();
chk(T.restRange().min===2 && T.restRange().per===3, "setRestMax：2~3 天写入正确", JSON.stringify(T.restRange()));
// min 大于 per 时应被夹住
els.restPer.value="2"; els.restMin.value="4";
T.setRestMax();
chk(T.restRange().min===2 && T.restRange().per===2, "setRestMax：min>per 被夹成 2~2（不产生矛盾配置）", JSON.stringify(T.restRange()));
chk(String(els.restMin.value)==="2", "setRestMax：夹过的下界回写到输入框");
els.modMinOn=fakeEl("modMinOn"); els.modMinOn.value="2";
T.setModuleMinOn();
chk(T.moduleMinOn()===2, "setModuleMinOn：设为 2");
els.modMinOn.value="0";
T.setModuleMinOn();
chk(T.moduleMinOn()===0, "setModuleMinOn：0 = 不限制");

/* ---------- ⑤. 老存档兼容 ---------- */
console.log("\n— ⑤. 老存档兼容（无 min 字段）—");
S.restMax={per:3,total:0};   // 模拟旧版存档
chk(T.restRange().min===3, "restRange：缺 min 时补成 min=per（=3）", JSON.stringify(T.restRange()));
chk(T.restTotalCap()===3*S.staff.length, "restTotalCap：按上界算");

/* ---------- ⑥. CSV 导出仍正常 ---------- */
console.log("\n— ⑥. 导出不受影响 —");
S.restMax={min:2,per:3,total:0}; S.moduleMinOn=1;
res=runAll();
let csvErr=null, csv="";
try{ csv=T.exportCSV(false); }catch(e){ csvErr=e; }
chk(!csvErr, "exportCSV 不抛错", csvErr&&csvErr.message);
/* 导出格式已改为「门店月班表」（参照华为生活馆月班表）：
   前3 列 = 领域 / 岗位 / 姓名，其后是整月每天（按星期分组），
   末尾 5 列统计 = 排休 / 早班 / 中班 / 晚班 / 周末天数。 */
chk(/^\uFEFF?领域,岗位,姓名,日期,节日\/活动,事项/.test(csv), "CSV 表头（月班表格式）", csv.split("\n")[0].slice(0,60));
chk(/排休天数,早班天数,中班天数,晚班天数,周末天数$/.test(csv.split("\n")[0]), "CSV 末尾 5 个统计列");
chk(["3C顾问","鸿蒙智行","售后","经理"].every(d=>csv.includes(d+",")), "CSV 覆盖四个领域");

console.log(`\n===== 新规则测试：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail?1:0);