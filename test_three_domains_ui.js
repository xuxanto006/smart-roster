/* 三领域页签 + 导出范围弹窗 浏览器验证 */
const { chromium } = require("/Users/xianyu/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
const exe = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
(async () => {
  const b = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await b.newContext({ viewport:{width:1440,height:1000}, colorScheme:'light', acceptDownloads:true });
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  const downloads=[];
  p.on("download", d=>downloads.push(d.suggestedFilename()));

  await p.goto("http://127.0.0.1:8733/index.html");
  await p.waitForTimeout(700);
  await p.click('#nav button[data-view="schedule"]');
  await p.waitForTimeout(300);

  const tabs = await p.$$eval(".domain-tab", els=>els.map(e=>e.textContent.trim()));

  // 依次排三个领域
  const res = {};
  for(const dom of ["3c","hongmeng","aftersales","manager"]){
    await p.click(`.domain-tab[data-dom="${dom}"]`); await p.waitForTimeout(300);
    await p.click("#autoBtn"); await p.waitForTimeout(2600);
    res[dom] = await p.evaluate(()=>{
      const rows=[...document.querySelectorAll("#tableBody tr")];
      return { 行数: rows.length,
               有班次: rows.filter(r=>/shift-cell (early|mid|night)/.test(r.innerHTML)).length,
               管格: rows.filter(r=>/shift-cell manager-off/.test(r.innerHTML)).length,
               首个: rows[0] && rows[0].querySelector("b") && rows[0].querySelector("b").textContent };
    });
  }
  // 切回 3C 确认还在
  await p.click('.domain-tab[data-dom="3c"]'); await p.waitForTimeout(400);
  const back3c = await p.evaluate(()=>{
    const rows=[...document.querySelectorAll("#tableBody tr")];
    return { 行数: rows.length, 有班次: rows.filter(r=>/shift-cell (early|mid|night)/.test(r.innerHTML)).length };
  });
  await p.screenshot({ path:"/tmp/mgr_3c.png" });

  // 打开导出范围弹窗
  await p.click("#confirmBtn"); await p.waitForTimeout(500);
  const dlg = await p.evaluate(()=>({
    显示: document.getElementById("exportMask").classList.contains("show"),
    提示: (document.getElementById("exportScopeHint").textContent||"").replace(/\s+/g," ").trim(),
    选项: [...document.querySelectorAll("#exportScopeOpts .opt")].map(e=>e.textContent.replace(/\s+/g," ").trim()),
  }));
  await p.screenshot({ path:"/tmp/export_dlg.png" });

  // 选「全部领域合并」
  await p.click('#exportScopeOpts .opt:nth-child(2)'); await p.waitForTimeout(2500);
  const after = await p.evaluate(()=>({ 弹窗已关: !document.getElementById("exportMask").classList.contains("show") }));

  console.log(JSON.stringify({ tabs, 各领域排班: res, 切回3C: back3c, 导出弹窗: dlg, 合并导出后: after, 下载文件: downloads, 报错: errs }, null, 1));
  await b.close();
})().catch(e=>{console.error("ERR",e.message);process.exit(1);});