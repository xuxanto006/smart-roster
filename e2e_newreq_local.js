// 真浏览器验证：工作日按天设置 + 指定日期安排（走真实 DOM 事件，不是假元素）
const { chromium } = require("/Users/xianyu/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
const exe = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const URL = process.argv[2] || "http://127.0.0.1:8733/index.html";

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await (await browser.newContext()).newPage();
  const fails = [];
  const ok = (n, c, extra)=>{ console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  " + (extra||""))); if(!c) fails.push(n); };
  page.on("pageerror", e => { fails.push("页面报错: " + e.message); console.log("❌ 页面报错: " + e.message); });

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(600);

  await page.evaluate(()=>{ if(typeof switchView==="function") switchView("rules"); });
  await page.waitForTimeout(200);

  /* ① 工作日按天设置 */
  await page.fill("#wdE0", "5");
  await page.dispatchEvent("#wdE0", "change");
  await page.fill("#wdN2", "13");
  await page.dispatchEvent("#wdN2", "change");
  await page.waitForTimeout(200);
  let needs = await page.evaluate(()=> JSON.parse(localStorage.getItem("shiftScheduler_v2")).needs);
  ok("周一早班改成 5", needs[0].early === 5, JSON.stringify(needs[0]));
  ok("周三晚班改成 13", needs[2].night === 13, JSON.stringify(needs[2]));
  ok("周二没被牵连（早班仍 8）", needs[1].early === 8, JSON.stringify(needs[1]));
  ok("周末没被牵连（周六早班仍 9）", needs[5].early === 9, JSON.stringify(needs[5]));

  /* ② 刷新后仍在（存到本地了） */
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(400);
  // 刷新后回到工作台，请假表单在「需求与请假」页里，必须切回去才可见
  await page.evaluate(()=>{ if(typeof switchView==="function") switchView("rules"); });
  await page.waitForTimeout(200);
  const v0 = await page.inputValue("#wdE0"), v2 = await page.inputValue("#wdN2");
  ok("刷新后周一早班框还是 5", v0 === "5", v0);
  ok("刷新后周三晚班框还是 13", v2 === "13", v2);

  /* ③ 指定日期安排 */
  const name = await page.evaluate(()=> JSON.parse(localStorage.getItem("shiftScheduler_v2")).staff[0]);
  await page.selectOption("#reqStaff", name);
  await page.selectOption("#reqType", "off");
  await page.fill("#reqDate", "9.15");
  await page.click("text=＋ 添加安排");
  await page.waitForTimeout(300);
  let reqs = await page.evaluate(()=> JSON.parse(localStorage.getItem("shiftScheduler_v2")).requests);
  const dated = reqs.filter(r=> r.date);
  ok("按日期添加成功（1 条带 date）", dated.length === 1, JSON.stringify(reqs));
  ok("日期是 9 月 15 日", dated[0] && /-09-15$/.test(dated[0].date), dated[0] && dated[0].date);
  const wantDay = dated[0] ? (new Date(dated[0].date + "T00:00:00").getDay() + 6) % 7 : -1;
  ok("星期由日期推算出来（0=周一）", dated[0] && dated[0].day === wantDay, `实得 ${dated[0] && dated[0].day}，应为 ${wantDay}`);
  ok("日期框已自动清空", (await page.inputValue("#reqDate")) === "");
  const listTxt = await page.textContent("#reqList");
  ok("安排列表里显示「9月15日」", /9月15日/.test(listTxt), listTxt.slice(0, 120));

  /* ④ 写错日期 → 拒绝并提示 */
  const before = reqs.length;
  await page.fill("#reqDate", "99.99");
  await page.click("text=＋ 添加安排");
  await page.waitForTimeout(300);
  reqs = await page.evaluate(()=> JSON.parse(localStorage.getItem("shiftScheduler_v2")).requests);
  ok("乱写的日期不会被加进去", reqs.length === before, String(reqs.length));
  const toastTxt = await page.textContent("#toast");
  ok("给出了「没认成日期」的提示", /没认成日期/.test(toastTxt || ""), (toastTxt||"").slice(0,60));
  await page.fill("#reqDate", "");

  /* ⑤ 早班保障组提示可见 */
  const enTxt = await page.textContent("#enGroupHint");
  ok("班次需求区能看到早晚保障组规则", /何广友/.test(enTxt || "") && /早班/.test(enTxt || ""), (enTxt||"").slice(0,80));

  await browser.close();
  console.log(fails.length ? `\n失败 ${fails.length} 项` : "\n===== 浏览器端验证全部通过 =====");
  process.exit(fails.length ? 1 : 0);
})().catch(e=>{ console.error("E2E 异常:", e.message); process.exit(1); });
