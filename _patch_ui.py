# -*- coding: utf-8 -*-
"""按「门店智能排班系统-离线版」的布局重做界面：
左侧固定导航 + 分页面 + 顶部状态条 + 工作台概览 + 校验提示条 + 人员搜索。
只动 HTML/CSS 外壳与少量渲染函数，排班逻辑一行不改。"""
import io

P = "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html"
s = io.open(P, encoding="utf-8").read()
orig_len = len(s)

def sub(old, new, cnt=1):
    global s
    assert s.count(old) >= 1, "找不到锚点: " + old[:80]
    s = s.replace(old, new, cnt)

# ---------- 1. CSS ----------
CSS = """
/* ===== 侧边导航 + 分页面（布局参照门店离线版） ===== */
.app{display:grid;grid-template-columns:224px 1fr;min-height:100vh;}
.side{position:sticky;top:0;height:100vh;padding:22px 14px;background:#141d33;color:#dfe6f2;display:flex;flex-direction:column;}
.side .brand{display:flex;gap:10px;align-items:center;margin-bottom:24px;}
.side .brand .logo{width:36px;height:36px;border-radius:10px;flex:0 0 auto;background-color:#fff;background-image:var(--paiLogo);background-repeat:no-repeat;background-position:center;background-size:24px 24px;}
.side .brand b{display:block;font-size:14px;color:#fff;}
.side .brand small{display:block;color:#8b9ab8;font-size:9px;letter-spacing:.16em;}
.side .nav{display:grid;gap:5px;}
.side .nav button{display:flex;gap:9px;align-items:center;border:0;border-radius:9px;padding:10px 12px;background:transparent;color:#a9b6cf;text-align:left;font-size:13px;width:100%;}
.side .nav button:hover{background:#1e2a48;color:#fff;}
.side .nav button.active{background:var(--primary);color:#fff;}
.side .nav button .ic{font-size:14px;}
.side .local{margin-top:auto;color:#8493b3;font-size:11px;display:flex;align-items:center;gap:7px;padding:0 4px;}
.side .local i{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;}
.main{min-width:0;}
/* 顶部条：白底 + 页面标题 + 自动保存 */
header{position:sticky;top:0;z-index:20;background:#fff;color:var(--text);padding:13px 22px;border-bottom:1px solid var(--border);border-radius:0;box-shadow:0 1px 2px rgba(0,0,0,.03);}
header h1{font-size:18px;color:var(--text);}
header .sub{color:var(--text2);opacity:1;}
.petal-badge{border:1px solid var(--border);}
.saved{color:var(--green);font-size:12px;white-space:nowrap;}
.saved:before{content:"\\2713 ";}
.view{display:none;}
.hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:24px 28px;border-radius:16px;background:linear-gradient(135deg,#eef3ff,#e8edff);margin-bottom:14px;}
.eyebrow{color:var(--primary);font-size:10px;font-weight:800;letter-spacing:.12em;}
.hero h2{font-size:23px;line-height:1.35;margin:8px 0 6px;letter-spacing:-.01em;}
.hero p{color:var(--text2);font-size:12px;margin:0;}
.hstatus{min-width:180px;padding:14px 16px;border-radius:14px;background:#1f2b48;color:#fff;}
.hstatus small{color:#a9b6cf;font-size:11px;display:block;}
.hstatus b{display:block;font-size:17px;margin:4px 0 3px;}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:12px;}
.metric{background:var(--card);border-radius:12px;padding:13px 15px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
.metric small{color:var(--text2);font-size:11px;}
.metric b{display:block;font-size:23px;margin:3px 0 2px;}
.metric span{color:var(--text2);font-size:11px;}
.checks{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 12px;}
.check{padding:5px 11px;border-radius:999px;background:#fff1f0;color:var(--danger-solid);font-size:12px;line-height:1.5;}
.check.warn{background:#fff7e6;color:#a15c00;}
.check.ok{background:#eaf7ee;color:#1a7f37;}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}
.ecard{background:var(--card);border:0;border-radius:12px;padding:15px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer;text-align:left;font:inherit;color:inherit;}
.ecard:hover{box-shadow:0 4px 14px rgba(47,84,235,.16);}
.ecard .ico{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--primary-light);font-size:16px;}
.ecard h3{font-size:14px;margin:9px 0 4px;}
.ecard p{font-size:12px;color:var(--text2);margin:0 0 9px;line-height:1.6;}
.ecard .go{color:var(--primary);font-size:12px;}
@media(max-width:900px){
  .app{grid-template-columns:1fr;}
  .side{position:sticky;top:0;height:auto;padding:9px 10px;z-index:30;flex-direction:row;align-items:center;gap:10px;}
  .side .brand{margin:0;} .side .brand small,.side .local{display:none;}
  .side .nav{grid-template-columns:repeat(6,1fr);flex:1;gap:4px;}
  .side .nav button{justify-content:center;font-size:0;padding:8px 4px;}
  .side .nav button .ic{font-size:15px;}
  .hero{flex-direction:column;align-items:stretch;padding:20px;}
  .hstatus{width:100%;}
}
"""
sub("@media print{", CSS + "@media print{")

# ---------- 2. HTML 骨架 ----------
sub('<header data-page-node-id="hQSOSmBPsTod3AUHkwX6JF">',
    '<div class="app">\n'
    '<aside class="side">\n'
    '  <div class="brand"><span class="logo"></span><div><b>团队智能排班</b><small>TEAM SCHEDULER</small></div></div>\n'
    '  <nav class="nav" id="nav" onclick="onNavClick(event)"></nav>\n'
    '  <div class="local"><i></i>数据保存在本机</div>\n'
    '</aside>\n'
    '<main class="main">\n'
    '<header data-page-node-id="hQSOSmBPsTod3AUHkwX6JF">')

sub('<h1 data-page-node-id="SN3G1rxLmeDuJDuxMIUGQL">',
    '<h1 id="pageTitle" data-page-node-id="SN3G1rxLmeDuJDuxMIUGQL">')
sub('<div class="sub" data-page-node-id="lVFeGmQYUCsnBzGZrfIDFm">',
    '<div class="sub" id="pageSub" data-page-node-id="lVFeGmQYUCsnBzGZrfIDFm">')

# 顶部右侧加「自动保存」
sub('    <button class="btn-ghost" onclick="window.print()" data-page-node-id="5lOotm92k5JAfpejHYH50m">🖨 打印</button>\n  </div>',
    '    <button class="btn-ghost" onclick="window.print()" data-page-node-id="5lOotm92k5JAfpejHYH50m">🖨 打印</button>\n'
    '    <span class="saved">所有修改自动保存</span>\n  </div>')

# 工作台视图
sub('<div class="container" data-page-node-id="Qta4IX2A1qWQ1XVgUBm6kb">',
    '<div class="container" data-page-node-id="Qta4IX2A1qWQ1XVgUBm6kb">\n'
    '  <section class="view" id="view-dash"><div id="dashBody"></div></section>')

# 其余卡片分组
sub('  <!-- 人员管理 -->', '  <section class="view" id="view-people">\n  <!-- 人员管理 -->')
sub('  <!-- 班次需求 -->', '  </section>\n\n  <section class="view" id="view-rules">\n  <!-- 班次需求 -->')
sub('  <!-- 排班表 -->',   '  </section>\n\n  <section class="view" id="view-schedule">\n  <!-- 排班表 -->')
sub('  <!-- 统计 -->',     '  </section>\n\n  <section class="view" id="view-stats">\n  <!-- 统计 -->')
sub('  <!-- 数据备份 / 分享 -->', '  </section>\n\n  <section class="view" id="view-backup">\n  <!-- 数据备份 / 分享 -->')
sub('  <div class="hint" style="text-align:center;margin-top:4px" data-page-node-id="obFtKAuuOUVsNcMYeAVfE4">',
    '  </section>\n\n  <div class="hint" style="text-align:center;margin-top:4px" data-page-node-id="obFtKAuuOUVsNcMYeAVfE4">')

# 主区收尾
sub('</div>\n\n<!-- 点击格子弹窗 -->', '</main>\n</div>\n\n<!-- 点击格子弹窗 -->')

# 人员管理：搜索框
sub('      <button class="btn-primary" onclick="addStaff()" data-page-node-id="UwLfKdOOSnnMFCDjIBNCDa">＋ 添加人员</button>',
    '      <button class="btn-primary" onclick="addStaff()" data-page-node-id="UwLfKdOOSnnMFCDjIBNCDa">＋ 添加人员</button>\n'
    '      <input type="text" id="staffSearch" placeholder="搜索姓名" style="width:140px" oninput="renderStaff()" data-page-node-id="staffSearch01">')

# 排班表：校验提示条
sub('    <div id="weekReqTip" style="text-align:center;font-size:12px;color:#d46b08;margin-bottom:10px" data-page-node-id="57A8mNCS1gf0NRBZhudOWc"></div>',
    '    <div id="weekReqTip" style="text-align:center;font-size:12px;color:#d46b08;margin-bottom:10px" data-page-node-id="57A8mNCS1gf0NRBZhudOWc"></div>\n'
    '    <div class="checks" id="schedChecks" data-page-node-id="schedChecks01"></div>')

# ---------- 3. JS ----------
NAV_JS = '''/* ================= 分页面导航（左侧固定导航 + 顶部标题 + 工作台） =================
   参考门店离线版：一屏一个页面，左侧常驻导航，顶部显示当前页面与保存状态。
   所有渲染函数照旧执行（隐藏的页面也在更新），因此不影响任何排班逻辑。 */
const VIEWS = [
  ["dash","🏠","工作台","排班总览与快捷入口"],
  ["people","👥","人员管理","名册维护，支持搜索"],
  ["rules","⚙️","需求与请假","每天班次人数 / 请假安排 / 固定上班日"],
  ["schedule","📅","排班表","一键智能排班与微调"],
  ["stats","📊","统计","本周体检与每人班次统计"],
  ["backup","💾","备份 / 分享","导出、恢复与分享链接"]
];
let curView = "dash";
let lastHealth = {errs:[], warns:[]};
function onNavClick(e){
  const b = e.target && e.target.closest ? e.target.closest("button") : null;
  if(b && b.dataset && b.dataset.view) switchView(b.dataset.view);
}
function switchView(v){
  curView = VIEWS.some(x=> x[0] === v) ? v : "dash";
  const nav = document.getElementById("nav");
  if(nav) nav.innerHTML = VIEWS.map(x=>
    `<button data-view="${x[0]}" class="${x[0]===curView?"active":""}"><span class="ic">${x[1]}</span>${x[2]}</button>`).join("");
  VIEWS.forEach(x=>{
    const sec = document.getElementById("view-" + x[0]);
    if(sec) sec.style.display = (x[0] === curView) ? "" : "none";
  });
  const info = VIEWS.find(x=> x[0] === curView) || VIEWS[0];
  const t = document.getElementById("pageTitle"), sb = document.getElementById("pageSub");
  if(t) t.textContent = info[2];
  if(sb) sb.textContent = info[3] + " ｜ 共 " + state.staff.length + " 人 ｜ 数据保存在本机浏览器";
  if(curView === "dash") renderDash();
  try{ if(window && window.scrollTo) window.scrollTo(0,0); }catch(e){}
}
function renderDash(){
  const box = document.getElementById("dashBody");
  if(!box) return;
  const k = curKey(), week = getWeek(k) || {};
  let filled = 0, total = 0;
  state.staff.forEach(n=>{ for(let d=0; d<7; d++){ total++; if((week[n]||[])[d]) filled++; } });
  const reqN = activeRequests(k).length;
  const errs = (lastHealth && lastHealth.errs) || [], warns = (lastHealth && lastHealth.warns) || [];
  const pct = total ? Math.round(filled/total*100) : 0;
  const mon = new Date(currentMonday);
  const cards = [
    ["people","👥","人员管理","添加 / 删除成员，支持搜索"],
    ["rules","⚙️","需求与请假","每天班次人数、请假与固定上班日"],
    ["schedule","📅","排班表","一键排班、手动微调、导出 Excel"],
    ["stats","📊","统计","本周体检与每人班次统计"]
  ].map(x=>`<button class="ecard" data-go="${x[0]}"><div class="ico">${x[1]}</div><h3>${x[2]}</h3><p>${x[3]}</p><span class="go">打开 →</span></button>`).join("");
  const checks = (errs.length || warns.length)
    ? errs.slice(0,4).map(x=>`<span class="check">⚠ ${escapeHtml(x)}</span>`).join("")
      + warns.slice(0,2).map(x=>`<span class="check warn">⚠ ${escapeHtml(x)}</span>`).join("")
    : '<span class="check ok">✓ 当前关键规则已通过</span>';
  box.innerHTML = `
    <section class="hero">
      <div>
        <span class="eyebrow">TEAM SCHEDULER · 本周 ${mon.getMonth()+1} 月 ${mon.getDate()} 日起</span>
        <h2>把名册、规则和班表<br>都留在这台电脑上</h2>
        <p>无需联网即可使用；改完点「一键智能排班」或「按请假 / 改班微调」即可重新排班。</p>
      </div>
      <div class="hstatus">
        <small>本周状态</small>
        <b>${errs.length ? errs.length + " 处冲突" : (warns.length ? warns.length + " 处提示" : "全部通过")}</b>
        <small>${total ? "班表已填 " + pct + "%" : "本周还没有班表"}</small>
      </div>
    </section>
    <section class="metrics">
      <div class="metric"><small>在职人员</small><b>${state.staff.length}</b><span>人</span></div>
      <div class="metric"><small>本周安排</small><b>${reqN}</b><span>条请假 / 特殊班次</span></div>
      <div class="metric"><small>班表完成度</small><b>${pct}%</b><span>${filled} / ${total} 格</span></div>
      <div class="metric"><small>规则冲突</small><b>${errs.length}</b><span>提示 ${warns.length} 处</span></div>
    </section>
    <div class="checks">${checks}</div>
    <div class="cards">${cards}</div>`;
  if(box.querySelectorAll) box.querySelectorAll("[data-go]").forEach(b=>{ b.onclick = ()=> switchView(b.dataset.go); });
}
/* 体检结果同步到「工作台」与排班表上方的提示条（内容来自 renderHealth 算出的 errs / warns） */
function renderDashChecks(){
  const errs = (lastHealth && lastHealth.errs) || [], warns = (lastHealth && lastHealth.warns) || [];
  const strip = document.getElementById("schedChecks");
  if(strip) strip.innerHTML = (errs.length || warns.length)
    ? errs.slice(0,4).map(x=>`<span class="check">⚠ ${escapeHtml(x)}</span>`).join("")
      + warns.slice(0,3).map(x=>`<span class="check warn">⚠ ${escapeHtml(x)}</span>`).join("")
    : '<span class="check ok">✓ 本周体检：关键规则已通过</span>';
  if(curView === "dash") renderDash();
}
'''
sub("function renderStaff(){", NAV_JS + "function renderStaff(){")

# 人员搜索过滤
sub('''  el.innerHTML = state.staff.map(n=>{
    const first = n.slice(0,1);
    return `<span class="staff-chip"><span class="avatar">${first}</span>${escapeHtml(n)}<button title="删除" onclick="removeStaff('${escapeAttr(n)}')">×</button></span>`;
  }).join("");''',
    '''  const qEl = document.getElementById("staffSearch");
  const q = qEl ? String(qEl.value || "").trim() : "";
  const list = q ? state.staff.filter(n=> n.indexOf(q) >= 0) : state.staff;
  if(q && !list.length){
    el.innerHTML = `<div class="empty-tip" style="padding:14px">没有姓名包含「${escapeHtml(q)}」的人</div>`;
    return;
  }
  el.innerHTML = list.map(n=>{
    const first = n.slice(0,1);
    return `<span class="staff-chip"><span class="avatar">${first}</span>${escapeHtml(n)}<button title="删除" onclick="removeStaff('${escapeAttr(n)}')">×</button></span>`;
  }).join("");''')

# 体检结果留一份给工作台
sub('  if(!state.staff.length){ box.className="health-box"; box.innerHTML=""; if(tag) tag.textContent=""; return; }',
    '  if(!state.staff.length){ lastHealth = {errs:[], warns:[]}; box.className="health-box"; box.innerHTML=""; if(tag) tag.textContent=""; renderDashChecks(); return; }')
sub('    box.className = "health-box ok";',
    '    lastHealth = {errs: [], warns: []};\n    box.className = "health-box ok";')
sub('  box.className = "health-box " + (errs.length ? "warn" : "ok");',
    '  lastHealth = {errs: errs.slice(), warns: warns.slice()};\n  box.className = "health-box " + (errs.length ? "warn" : "ok");')
sub('  renderHealth(week, buildRules(curKey()));',
    '  renderHealth(week, buildRules(curKey()));\n  renderDashChecks();')

# 初始化后进入工作台
sub('renderAll();\nif(__migratedFromPlaceholders){',
    'renderAll();\nswitchView("dash");\nif(__migratedFromPlaceholders){')

io.open(P, "w", encoding="utf-8").write(s)
print("完成：%d → %d 字节（+%d）" % (orig_len, len(s), len(s) - orig_len))
