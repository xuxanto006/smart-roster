/* 校验「实心底 + 白字」的 WCAG 对比度是否可读 */
const fs = require("fs");
const html = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");

const vars = {};
for (const m of html.matchAll(/--([\w-]+-solid):\s*(#[0-9a-fA-F]{6})/g)) vars["--" + m[1]] = m[2];
vars["--danger"] = (html.match(/--danger:\s*(#[0-9a-fA-F]{6})/) || [])[1];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = hex => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = hex => (1.0 + 0.05) / (lum(hex) + 0.05);

const labels = {
  "--early-solid": "早班", "--mid-solid": "中班", "--night-solid": "晚班",
  "--rest-solid": "休息", "--danger-solid": "请假", "--danger": "危险色(对照)",
};
console.log("白字对比度（WCAG：正文需 ≥4.5，大字/粗体 ≥3.0）\n");
let worst = 99;
for (const [k, v] of Object.entries(vars)) {
  if (!v) continue;
  const r = ratio(v);
  worst = Math.min(worst, r);
  const ok = r >= 4.5 ? "✅ 优" : r >= 3.0 ? "✅ 合格(粗体)" : "❌ 偏低";
  console.log(`  ${(labels[k] || k).padEnd(14)} ${v}  对比度 ${r.toFixed(2)}:1  ${ok}`);
}
console.log(`\n最低对比度 ${worst.toFixed(2)}:1 → ${worst >= 3.0 ? "全部合格" : "不合格，需调深"}`);

// 只校验「醒目」样式（hit-* 命中格 / leave 请假格）必须是白字；普通班次应保持浅底彩字
const emphasis = [...html.matchAll(/\.shift-cell\.((?:hit-early|hit-mid|hit-night|leave))\{[^}]*\}/g)].map(m => m[1]);
const bad = emphasis.filter(() => false);
emphasis.forEach(n => {
  const rule = html.match(new RegExp("\\.shift-cell\\." + n + "\\{[^}]*\\}"))[0];
  if (!/color:\s*#fff/.test(rule)) bad.push(n);
});
console.log("醒目样式（" + (emphasis.join("/") || "无") + "）白字检查:", bad.length ? "❌ " + bad.join(",") : "✅ 全部白字");
const plain = [...html.matchAll(/\.shift-cell\.(early|mid|night|rest)\{[^}]*\}/g)].map(m => m[1]);
console.log("普通班次保持浅底彩字:", plain.length ? "✅ " + plain.join("/") : "❌ 缺失");
