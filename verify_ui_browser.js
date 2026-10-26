/* 浏览器实测：确认关键配色没被 CSS 清理改动影响（防回归） */
const { chromium } = require("/Users/xianyu/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
(async () => {
  const exe = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const b = await chromium.launch({ executablePath: exe, headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  await p.goto("http://127.0.0.1:8733/index.html");
  await p.waitForTimeout(600);

  const out = {};
  out.peopleCards = await p.$$eval("#staffList .staff-card", e => e.length);

  // 切到排班表并生成班表
  await p.click('#nav button[data-view="schedule"]');
  await p.waitForTimeout(200);
  const btn = await p.$("#autoBtn");
  if (btn) { await btn.click(); await p.waitForTimeout(2500); }

  out.shiftEarly = await p.$$eval(".shift-cell.early", e => e.length);
  out.excludedOff = await p.$$eval(".shift-cell.excluded-off", e => e.length);
  // 免排格子实际背景色（应为黄 #fff4d6，不是灰 #f3f4f6）
  out.excludedBg = await p.$$eval(".shift-cell.excluded-off",
    e => e.length ? getComputedStyle(e[0]).backgroundColor : "n/a");
  out.managerOff = await p.$$eval(".shift-cell.manager-off", e => e.length);
  out.excludedText = await p.$$eval(".shift-cell.excluded-off",
    e => e.length ? e[0].textContent.trim() : "n/a");

  // 冲突定位链接是否存在
  out.conflictLinks = await p.$$eval("[onclick*='gotoConflict']", e => e.length);
  out.confirmBtn = await p.$$eval("#confirmBtn", e => e.length);

  // 姓名是否完整显示（取前 3 行）
  out.names = await p.$$eval(".schedule-name b", e => e.slice(0, 3).map(x => x.textContent));

  await p.screenshot({ path: "/tmp/verify_ui.png", fullPage: false });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
