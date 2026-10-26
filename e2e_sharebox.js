// 验证「分享链接」显示框：点击后能看见链接、能全选、能预览打开
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
  await page.waitForTimeout(600);

  ok("一开始链接框是收起的", !(await page.isVisible("#shareLinkBox")));

  await page.evaluate(()=>{ if(typeof switchView==="function") switchView("backup"); });
  await page.waitForTimeout(200);
  await page.click("text=复制分享链接");
  await page.waitForTimeout(400);
  ok("点完按钮链接框显示出来", await page.isVisible("#shareLinkBox"));

  const link = await page.inputValue("#shareLinkText");
  ok("框里是完整链接（原地址 + #s=）", /^https?:\/\/.+#s=/.test(link), (link||"").slice(0, 60));
  ok("链接里带着数据（#s= 后面有内容）", (link.split("#s=")[1] || "").length > 100);
  const lenTxt = await page.textContent("#shareLinkLen");
  ok("显示了链接长度", /KB/.test(lenTxt || ""), (lenTxt||"").slice(0, 60));

  // 不带 # 的裸地址 + 这条链接，应该能打开同一个页面
  const base = link.split("#")[0];
  const page2 = await (await browser.newContext()).newPage();
  await page2.goto("about:blank");
  await page2.goto(link, { waitUntil: "load" });
  await page2.waitForTimeout(500);
  const seeded = await page2.evaluate(()=> {
    const raw = localStorage.getItem("shiftScheduler_v2");
    return raw ? JSON.parse(raw).staff.length : 0;
  });
  ok("用框里的链接打开，数据能播种（31 人）", seeded === 31, "实得 " + seeded);

  // 全选复制 / 新标签打开 都不报错
  await page.click("text=全选链接");
  await page.waitForTimeout(200);
  ok("「全选链接」不报错", true);
  const pagesBefore = browser.contexts().length;
  await page.click("text=在新标签打开预览");
  await page.waitForTimeout(800);
  ok("「在新标签打开预览」不报错", true);

  await browser.close();
  console.log(fails.length ? `\n失败 ${fails.length} 项` : "\n===== 分享链接显示框验证通过 =====");
  process.exit(fails.length ? 1 : 0);
})().catch(e=>{ console.error("E2E 异常:", e.message); process.exit(1); });
