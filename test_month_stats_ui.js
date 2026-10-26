/* 月度统计页签验证 */
const { chromium } = require("/Users/xianyu/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
const exe = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
(async () => {
  const b = await chromium.launch({ executablePath: exe, headless: true });
  const p = await (await b.newContext({ viewport:{width:1440,height:1000},colorScheme:'light' })).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  p.on("console",m=>{ if(m.type()==="error") errs.push("console: "+m.text()); });
  await p.goto("http://127.0.0.1:8733/index.html");
  await p.waitForTimeout(700);
  await p.click('#nav button[data-view="stats"]');
  await p.waitForTimeout(400);

  const tabs = await p.$$eval(".stats-tabs button", els=>els.map(e=>({文字:e.textContent.trim(), view:e.dataset.statView, 高亮:e.classList.contains("active")})));

  // 切到月度统计
  await p.click('.stats-tabs button[data-stat-view="month"]');
  await p.waitForTimeout(600);
  const panelVisible = await p.$eval("#statsPanelMonth", el=>!el.hidden);
  const othersHidden = await p.$$eval(".stats-panel", els=>els.filter(e=>!e.hidden).map(e=>e.id));

  // 先排一周班，让当月有数据
  await p.click('#nav button[data-view="schedule"]'); await p.waitForTimeout(300);
  await p.click("#autoBtn"); await p.waitForTimeout(3000);
  await p.click('#nav button[data-view="stats"]'); await p.waitForTimeout(300);
  await p.click('.stats-tabs button[data-stat-view="month"]'); await p.waitForTimeout(700);

  const out = await p.evaluate(() => ({
    年份选项: [...document.getElementById("monthYear").options].map(o=>o.value),
    月份选项数: document.getElementById("monthSelect").options.length,
    当前月: document.getElementById("monthSelect").value,
    KPI: [...document.querySelectorAll("#monthKpis .trend-kpi")].map(e=>e.querySelector("small").textContent+"="+e.querySelector("b").textContent+e.querySelector("em").textContent),
    洞察: document.getElementById("monthInsights").textContent.replace(/\s+/g," ").trim().slice(0,140),
    表格行数: document.querySelectorAll("#monthPeopleTable tbody tr").length,
    表头: [...document.querySelectorAll("#monthPeopleTable thead th")].map(e=>e.textContent),
    首行: (()=>{const tr=document.querySelector("#monthPeopleTable tbody tr"); return tr?[...tr.children].map(td=>td.textContent.replace(/\s+/g," ").trim()):null;})(),
    图表svg: !!document.querySelector("#monthChart svg"),
    图表图例: (document.getElementById("monthChart").textContent||"").replace(/\s+/g," ").trim().slice(0,60),
    空态: (document.getElementById("monthKpis").textContent||"").includes("暂无已排班数据"),
  }));
  console.log(JSON.stringify({tabs, panelVisible, othersHidden, ...out, 报错: errs}, null, 1));
  const card = await p.$("#statsPanelMonth");
  await card.scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  await p.screenshot({ path:"/tmp/month_stats.png", fullPage:false });
  await b.close();
})().catch(e=>{console.error("ERR",e.message);process.exit(1);});