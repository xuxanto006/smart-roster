// E2E：真浏览器验证线上分享链接播种
// 1) 打开线上页 → 清空 localStorage（模拟新用户）
// 2) 带 #s= 分享链接打开 → 断言 localStorage 播种 + 页面渲染出分享的人名
const { chromium } = require("/Users/xianyu/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
const fs = require("fs");

(async () => {
  const exe = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const shareUrl = fs.readFileSync("/tmp/share_payload.txt", "utf8").trim();
  const base = "https://267d2497fa554854b724aede4b83caa5.app.workbuddy.link/";
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const fails = [];
  const ok = (name, cond) => { console.log((cond ? "✅ " : "❌ ") + name); if (!cond) fails.push(name); };

  // 1. 线上纯净打开（新用户视角）
  await page.goto(base, { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  const before = await page.evaluate(() => localStorage.getItem("shiftScheduler_v2"));
  ok("清空后 localStorage 为空", before === null);

  // 2. 带 #s= 打开 → 应播种且渲染
  // 注意：同源同路径仅 hash 不同属于同文档导航，不会重跑脚本，先去 about:blank 强制真加载
  await page.goto("about:blank");
  await page.goto(shareUrl, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(800);
  const seeded = await page.evaluate(() => {
    const raw = localStorage.getItem("shiftScheduler_v2");
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { names: d.staff, hasWeek: Object.keys(d.schedule || {}).length > 0 };
  });
  ok("分享链接把数据写入了 localStorage", !!seeded);
  ok("人名与分享负载一致（含「端到端测试员A」）", !!seeded && seeded.names.includes("端到端测试员A") && seeded.names.includes("何广友"));
  ok("班表周数据被播种", !!seeded && seeded.hasWeek);

  // 3. 页面上真的渲染出这个人
  const body = await page.evaluate(() => document.body.innerText);
  ok("页面渲染出「端到端测试员A」", body.includes("端到端测试员A"));
  ok("页面渲染出「何广友」", body.includes("何广友"));

  // 4. 本地已有存档时再次打开分享链接 → 不得覆盖
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("shiftScheduler_v2"));
    d.staff = ["本地保留者"];
    localStorage.setItem("shiftScheduler_v2", JSON.stringify(d));
  });
  await page.goto(shareUrl, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("shiftScheduler_v2")).staff);
  ok("本地已有存档 → 分享链接不覆盖（仍是「本地保留者」）", after.length === 1 && after[0] === "本地保留者");

  // 5. 截图存档
  await page.goto(shareUrl, { waitUntil: "load" }); // 注意：本地存档已在，重新打开仍显示本地数据
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/e2e_share.png", fullPage: false });

  await browser.close();
  console.log(fails.length ? `\n失败 ${fails.length} 项` : "\n===== E2E 全部通过 =====");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("E2E 异常:", e.message); process.exit(1); });
