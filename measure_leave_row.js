/* 量一排工具栏与「假期类型」行的控件尺寸，找出不对齐的根源 */
const { chromium } = require("/Users/xianyu/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
const exe = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
(async () => {
  const b = await chromium.launch({ executablePath: exe, headless: true });
  const p = await (await b.newContext({ viewport:{width:1400,height:1000} })).newPage();
  await p.goto("http://127.0.0.1:8733/index.html");
  await p.waitForTimeout(700);
  await p.click('#nav button[data-view="rules"]');
  await p.waitForTimeout(300);
  await p.selectOption("#reqType", "off");
  await p.waitForTimeout(400);

  const info = await p.evaluate(() => {
    const B = el => { if(!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const CS = (el, props) => { if(!el) return null; const cs = getComputedStyle(el); const o = {}; props.forEach(k => o[k] = cs[k]); return o; };

    const row = document.getElementById("reqLeaveRow");
    const label = row ? row.querySelector("label") : null;
    const sel = document.getElementById("reqLeaveType");
    const typeSel = document.getElementById("reqType");
    const staffSel = document.getElementById("reqStaff");
    const scopeSel = document.getElementById("reqScope");
    const addBtn = document.querySelector('button[onclick="addRequest()"]');
    const typeRow = typeSel ? typeSel.closest(".row") : null;

    let textW = null, textH = null, cs = null;
    if(label){
      const rg = document.createRange(); rg.selectNodeContents(label);
      const r = rg.getBoundingClientRect();
      textW = Math.round(r.width); textH = Math.round(r.height);
      cs = CS(label, ["display","whiteSpace","flexShrink","minWidth","lineHeight","fontSize"]);
    }
    return {
      假期类型行: B(row),
      标签盒: B(label),
      标签文本: textW === null ? null : { w: textW, h: textH },
      标签是否换行: (textH && cs) ? (textH > parseFloat(cs.lineHeight) * 1.5) : null,
      假期类型下拉: B(sel),
      标签样式: cs,
      对照_类型下拉: B(typeSel),
      对照_人员下拉: B(staffSel),
      对照_仅本周: B(scopeSel),
      对照_添加按钮: B(addBtn),
      工具栏行: B(typeRow),
      工具栏样式: CS(typeRow, ["marginBottom","display"]),
      假期行样式: CS(row, ["marginTop","display"]),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  const box = await (await p.$("#reqType")).boundingBox();
  await p.screenshot({ path:"/tmp/leave_row.png", clip:{ x:0, y: Math.max(0, box.y - 20), width:1400, height:170 } });
  await b.close();
})().catch(e=>{console.error("ERR",e.message);process.exit(1);});