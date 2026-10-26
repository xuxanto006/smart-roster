// 新界面（侧边导航 + 分页面 + 工作台）端到端验证
const { chromium } = require("/Users/xianyu/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
const exe = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const URL = process.argv[2] || "http://127.0.0.1:8733/index.html";

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await (await browser.newContext()).newPage();
  const fails = [];
  const ok = (n, c, extra)=>{ console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  " + (extra||""))); if(!c) fails.push(n); };
  page.on("pageerror", e=>{ fails.push("页面报错: " + e.message); console.log("❌ 页面报错: " + e.message); });

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(700);

  /* ① 工作台 */
  ok("左侧导航渲染出 6 项", (await page.$$("#nav button")).length === 6, String((await page.$$("#nav button")).length));
  ok("默认停在工作台", await page.isVisible("#view-dash"));
  ok("工作台有指标卡", (await page.$$("#dashBody .metric")).length === 4);
  ok("工作台有入口卡", (await page.$$("#dashBody .ecard")).length === 4);
  ok("工作台有状态卡", await page.isVisible("#dashBody .hstatus"));
  ok("顶部有「所有修改自动保存」", /自动保存/.test(await page.textContent("header")));
  ok("侧边栏提示数据存本机", /数据保存在本机/.test(await page.textContent(".side")));

  /* ② 切页面 */
  const go = async (label, view)=>{
    await page.click(`#nav button[data-view="${view}"]`);
    await page.waitForTimeout(250);
    ok(`切到「${label}」只显示该页`, await page.isVisible("#view-" + view) && !(await page.isVisible("#view-dash")));
    ok(`顶部标题变成「${label}」`, (await page.textContent("#pageTitle")).trim() === label, await page.textContent("#pageTitle"));
  };
  await go("人员管理", "people");
  await go("需求与请假", "rules");
  await go("排班表", "schedule");
  await go("统计", "stats");
  await go("导出 / 分享", "backup");
  ok("「发布本周」按钮已删除", (await page.$$("#publishBtn")).length === 0);
  ok("「导出配置（JSON）」「恢复配置」已删除",
     (await page.$$('button[onclick*="exportBackup"]')).length === 0 &&
     (await page.$$("#restoreFile")).length === 0);
  ok("分享功能仍在（导出带数据的网页 / 复制分享链接）",
     (await page.$$('button[onclick*="exportSharedPage"]')).length === 1 &&
     (await page.$$('button[onclick*="copyShareLink"]')).length === 1);

  /* ③ 各页功能仍在 */
  await page.click('#nav button[data-view="people"]');
  await page.waitForTimeout(200);
  const nCards = (await page.$$("#staffList .staff-card")).length;
  ok("人员卡片全部渲染", nCards > 0, `${nCards} 张`);
  ok("筛选板块已删除（无「全部模块」下拉）", (await page.$$("#staffModuleFilter")).length === 0);
  ok("筛选板块已删除（无「搜索姓名、岗位或标签」）", (await page.$$("#staffSearch")).length === 0);
  ok("筛选板块已删除（无「导出名册」按钮）", (await page.$$('button[onclick*="exportRosterExcel"]')).length === 0);

  await page.click('#nav button[data-view="schedule"]');
  await page.waitForTimeout(200);
  ok("排班表上方有校验提示条", await page.isVisible("#schedChecks"));
  await page.click("text=一键智能排班");
  await page.waitForTimeout(2500);
  const cells = (await page.$$("#tableBody .shift-cell")).length;
  ok("一键排班跑出班表", cells > 100, String(cells));

  /* ④ 打印时全部展开（分页面后别打成空白） */
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(200);
  const dashPrint = await page.isVisible("#view-dash");
  const schedPrint = await page.isVisible("#view-schedule");
  ok("打印时各页都展开", dashPrint && schedPrint, `dash=${dashPrint} schedule=${schedPrint}`);
  await page.emulateMedia({ media: "screen" });

  /* ⑤ 窄屏：导航收成一行 */
  await page.setViewportSize({ width: 420, height: 780 });
  await page.waitForTimeout(300);
  const navBox = await page.locator("#nav").boundingBox();
  const sideBox = await page.locator(".side").boundingBox();
  ok("窄屏下导航仍在且是横向条", !!navBox && sideBox.height < 120, JSON.stringify(sideBox && {h: Math.round(sideBox.height)}));
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.screenshot({ path: "/tmp/ui_dash.png", fullPage: false });
  await page.click('#nav button[data-view="schedule"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/ui_sched.png", fullPage: false });

  await browser.close();
  console.log(fails.length ? `\n失败 ${fails.length} 项` : "\n===== 新界面验证全部通过 =====");
  process.exit(fails.length ? 1 : 0);
})().catch(e=>{ console.error("E2E 异常:", e.message); process.exit(1); });
