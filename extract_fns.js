/* 从本地已验证的 index.html 精确提取若干函数源码（按括号配平），拼到待插入块。 */
const fs = require("fs");
const src = fs.readFileSync("/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html", "utf8");
const lines = src.split("\n");

function extractAt(startLine){ // 1-based
  let i = startLine - 1;
  // 找到函数声明行
  while(i < lines.length && !/^\s*function\s+\w+\s*\(/.test(lines[i])) i++;
  const decl = lines[i];
  // 找到第一个 '{'
  let rest = lines[i];
  let brace = 0, started = false, col = 0;
  // 逐字符扫描（跨行）
  let text = src.slice(src.indexOf(decl)); // 从声明行开头
  let idx = text.indexOf("{");
  brace = 0;
  let j = idx;
  for(; j < text.length; j++){
    const ch = text[j];
    if(ch === "{"){ brace++; started = true; }
    else if(ch === "}"){ brace--; if(started && brace === 0){ j++; break; } }
  }
  return text.slice(0, j);
}

const starts = {
  roleFlowAssign: 1651,
  weekRoleShort: 1712,
  shiftGapOf: 2885,
  balanceShifts: 2905,
  balanceNightShifts: 3050,
  fixIsolatedRest: 3372,
  planFixIsolated: 3493
};
let out = "";
for(const [name, ln] of Object.entries(starts)){
  out += "\n/* ===== 移植自本地已验证版本：" + name + " ===== */\n";
  out += extractAt(ln) + "\n";
}
// 一次性迁移（新建）
out += `
/* ===== 一次性迁移：晚班上限 4 → 3（只做一次，用户手改回 4 不被覆盖） ===== */
function upgradeNightCap(){
  if(state.limitsV) return false;      // 已迁移过（或全新存档，本就是 1）→ 不再动
  state.limitsV = 1;
  if(+state.limits.night === 4) state.limits.night = 3;
  return true;                          // 标记变了 → 需要写一次库
}
`;
fs.writeFileSync("/tmp/ported.js", out);
console.log("提取完成，字节数:", out.length);
