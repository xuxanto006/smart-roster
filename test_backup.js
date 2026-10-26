/* 数据备份 / 分享：导出配置 JSON、恢复配置、导出带数据的网页、种子播种。
   锁死的性质：
   1. 备份 JSON 必须能完整还原（名册/规则/安排/班表），restore 是整体覆盖。
   2. 分享网页的种子必须插在主 <script> 之前、且 JSON 里不出现裸的 "</script>"。
   3. 种子只在本地没有存档时播种一次，之后用户的修改不被种子覆盖。 */
const fs = require("fs"), vm = require("vm");
const APP = "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html";
const html = fs.readFileSync(APP, "utf8");
const code = (()=>{let b="",m,re=/<script([^>]*)>([\s\S]*?)<\/script>/g;while((m=re.exec(html))){if(/\bsrc\s*=/.test(m[1]))continue;if(m[2].length>b.length)b=m[2];}return b;})();

function makeSandbox(store, opts = {}) {
  function fakeEl(id) {
    return { id, value: "", textContent: "", innerHTML: "", style: {}, options: [],
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      getAttribute() { return null; }, setAttribute() {}, click() {}, appendChild() {}, addEventListener() {}, remove() {} };
  }
  const els = {};
  const sb = {
    document: {
      getElementById(id) { if (!els[id]) els[id] = fakeEl(id); return els[id]; },
      querySelectorAll() { return []; },
      createElement() { const e = fakeEl("a"); e.click = () => { sb.__clicked++; }; return e; },
      documentElement: { outerHTML: "<html><head></head><body>快照</body></html>" },
      body: { appendChild() {} }
    },
    localStorage: {
      _d: store,
      getItem(k) { return k in this._d ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; }
    },
    console, confirm: () => true, alert() {}, prompt: () => "",
    setTimeout: (fn) => { if (typeof fn === "function") fn(); return 0; }, clearTimeout() {},
    Math, Date, JSON, Array, Object, String, Number, Set, Map, Boolean, RegExp, isNaN, parseInt, parseFloat,
    performance: { now: () => Date.now() },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Blob: function (parts) { sb.__downloaded = { content: parts.join(""), type: (opts.blobTypeOf && sb.__downloaded && sb.__downloaded.type) || "" , parts}; },
    location: { protocol: "file:", href: "file:///app/index.html", reload() { sb.__reloaded++; } },
    __clicked: 0, __reloaded: 0
  };
  sb.window = sb;                       // 应用里用 window.__SEED__ / window.print
  sb.globalThis = sb;
  vm.createContext(sb);
  return sb;
}

const KEY = "shiftScheduler_v2";
let pass = 0, fail = 0;
function expect(c, m, extra) { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m + (extra ? "  " + extra : "")); } }
function loadApp(sb, extra = "") {
  vm.runInContext(code + extra + "\nglobalThis.__T={get state(){return state},save,load,exportBackup,restoreBackup,exportSharedPage,snapshotState,seedOnce,buildRules,curKey,ensureWeek};", sb, { filename: "s" });
  return sb.__T;
}

/* ============ 一、导出配置 JSON ============ */
console.log("\n— 一、导出配置 JSON —");
let store1 = {};
let sb1 = makeSandbox(store1);
let T = loadApp(sb1);
const S = T.state;
S.autoSchedule && 0;
T.save();  // 先有一份存档
let downloaded = null;
sb1.Blob = function (parts) { downloaded = { content: parts.join("") }; };
sb1.document.createElement = function () { const e = { click() { sb1.__clicked++; }, remove() {} }; return e; };
T.exportBackup();
expect(sb1.__clicked === 1, "触发了一次下载");
expect(!!downloaded && !!downloaded.content, "生成了 JSON 内容");
let backup = null;
try { backup = JSON.parse(downloaded.content); } catch (e) {}
expect(!!backup, "内容是合法 JSON");
expect(Array.isArray(backup.staff) && backup.staff.length === 31, "含 31 人名册", backup && backup.staff && backup.staff.length);
expect(Array.isArray(backup.needs) && backup.needs.length === 7, "含 7 天需求");
expect(backup.groups && backup.groups.openClose && backup.groups.openClose.members.length === 9, "含 9 人开店闭店组");
expect(Array.isArray(backup.mustWork) && backup.mustWork.some(m => m.name === "陈悦娴" && m.day === 0), "含「周一陈悦娴必须上班」常驻规则");
expect(backup.schedule && Object.keys(backup.schedule).length > 0, "含已排班表");
expect(backup.requests !== undefined && backup.restMax !== undefined && backup.weekendEarlyMax !== undefined, "含请假安排 / 休息上限 / 周末早班上限字段");

/* ============ 二、恢复配置 ============ */
console.log("\n— 二、恢复配置 —");
// 2a. 合法文件 → 整体覆盖 + 重载
let store2 = {};
let sb2 = makeSandbox(store2);
T = loadApp(sb2);
const fakeInput = { files: [{ }], value: "x" };
let loadText = null;
sb2.FileReader = function () {};
sb2.FileReader.prototype.readAsText = function (f) { this.result = loadText; if (this.onload) this.onload(); };
loadText = downloaded.content;
T.restoreBackup(fakeInput);
expect(fakeInput.value === "", "选择文件后输入框被清空");
expect(!!store2[KEY], "恢复时把配置写进了本地存档");
expect(sb2.__reloaded === 1, "写入后触发页面重载");
let restored = JSON.parse(store2[KEY]);
expect(restored.staff.length === 31 && restored.staff[0] === backup.staff[0], "存档内容与备份一致");
// 2b. 换一份假数据再恢复一次，确认是「整体覆盖」不是合并
loadText = JSON.stringify(Object.assign({}, backup, { staff: ["张三", "李四"] }));
T.restoreBackup({ files: [{}], value: "" });
restored = JSON.parse(store2[KEY]);
expect(restored.staff.length === 2 && restored.staff[0] === "张三", "恢复是整体覆盖：换成 2 人存档就是 2 人", JSON.stringify(restored.staff));
// 2c. 非法文件：不写、不重载
sb2.__reloaded = 0;
const before = store2[KEY];
loadText = '{"foo":1}';
T.restoreBackup({ files: [{}], value: "" });
expect(sb2.__reloaded === 0, "非法文件不触发重载");
expect(store2[KEY] === before, "非法文件不覆盖现有存档");
// 2d. 用户取消：不写
sb2.confirm = () => false;
loadText = JSON.stringify({ staff: ["王五"] });
T.restoreBackup({ files: [{}], value: "" });
expect(!/王五/.test(store2[KEY] || ""), "用户点取消则什么都不做");
// 2e. 恢复后的存档能被全新页面读出来
let sb3 = makeSandbox({ [KEY]: store2[KEY] });
T = loadApp(sb3);
expect(sb3.__T.state.staff.length === 2 && sb3.__T.state.staff[0] === "张三", "恢复后的存档在全新页面 load() 后完整还原");

/* ============ 三、导出带数据的网页 ============ */
console.log("\n— 三、导出带数据的网页 —");
let sb4 = makeSandbox({});
T = loadApp(sb4);
T.save();
let sharedHtml = null;
sb4.Blob = function (parts) { sharedHtml = parts.join(""); };
// http 部署路径：fetch 原始源文件
sb4.location = { protocol: "https:", href: "https://x.example/index.html", reload() {} };
sb4.fetch = () => Promise.resolve({ text: () => Promise.resolve(html) });
(async () => {
  T.exportSharedPage();
  await new Promise(r => setTimeout(r, 20));
  expect(!!sharedHtml, "生成了 HTML 内容");
  // 种子自己就是一个 <script> 标签，所以「在主脚本之前」= 种子在主脚本内容（STORE_KEY 所在）之前
  const mainIdx = sharedHtml.indexOf("shiftScheduler_v2");
  const seedIdx = sharedHtml.indexOf("window.__SEED__=");
  expect(mainIdx > 0 && seedIdx > 0 && seedIdx < mainIdx, "种子插在主脚本之前", `主=${mainIdx} 种子=${seedIdx}`);
  // 种子自己需要合法闭合；要防的是 JSON 数据内部出现裸 </script> 把主脚本提前截断
  const seedEnd = sharedHtml.indexOf("</script>", seedIdx);
  const payload = sharedHtml.slice(seedIdx + "window.__SEED__=".length, seedEnd);
  expect(seedEnd > 0 && seedEnd < mainIdx && !payload.includes("</script"), "种子闭合标签在主脚本之前，且 JSON 数据里没有裸的 </script>");
  const m = sharedHtml.match(/window\.__SEED__=([\s\S]*?);<\/script>/);
  expect(!!m, "能从导出页里抠出种子");
  let seed = null;
  try { seed = JSON.parse(m[1].replace(/\\u003c/g, "<")); } catch (e) {}
  expect(!!seed && seed.staff.length === 31, "种子 JSON 可解析且含 31 人名册");
  // 文件里的 "<" 都已转义，不会出现裸 </script>
   
  // file:// 兜底路径：用 DOM 序列化
  let fallback = null;
  sb5 = makeSandbox({});
  T5 = loadApp(sb5); T5.save();
  sb5.Blob = function (parts) { fallback = parts.join(""); };
  sb5.document.documentElement.outerHTML = "<html><head></head><body><script>alert(1)<\/script></body></html>";
  sb5.location = { protocol: "file:", href: "file:///app/index.html" };
  sb5.fetch = () => Promise.reject(new Error("no network"));
  T5.exportSharedPage();
  await new Promise(r => setTimeout(r, 20));
  expect(!!fallback && fallback.indexOf("window.__SEED__=") > 0 && fallback.indexOf("alert(1)") > fallback.indexOf("window.__SEED__="), "file:// 下用 DOM 序列化兜底也能导出，且种子在原脚本之前");
  expect(/^<!DOCTYPE html>/i.test(fallback), "兜底导出补了 DOCTYPE");

  /* ============ 四、种子播种 ============ */
  console.log("\n— 四、种子播种（seedOnce） —");
  // 4a. 本地无存档 → 播种
  let storeA = {};
  let sbA = makeSandbox(storeA);
  const SEED = { staff: ["甲", "乙"], schedule: { w1: { 甲: ["early","early","early","early","early","early","early"] } } };
  vm.runInContext(`window.__SEED__=${JSON.stringify(SEED)};`, sbA);
  T = loadApp(sbA);
  T.load();
  expect(!!storeA[KEY], "本地无存档时播种");
  let st = JSON.parse(storeA[KEY]);
  expect(st.staff[0] === "甲", "播种内容来自种子", storeA[KEY].slice(0, 80));
  expect(sbA.__T.state.staff[0] === "甲", "load() 之后 state 用的是种子数据");
  // 4b. 已有存档 → 不覆盖，用户的修改保留
  storeA[KEY] = JSON.stringify({ staff: ["丙"], needsV: 2 });
  vm.runInContext(`window.__SEED__=${JSON.stringify(SEED)};`, sbA);
  sbA.__T.load();
  st = JSON.parse(storeA[KEY]);
  expect(st.staff[0] === "丙", "本地已有存档则不再播种", storeA[KEY].slice(0, 80));
  // 4c. 用户在分享页里改数据并保存后，刷新也不会被种子打回
  sbA.__T.state.staff = ["丁"];
  sbA.__T.save();
  vm.runInContext(`window.__SEED__=${JSON.stringify(SEED)};`, sbA);
  sbA.__T.load();
  expect(sbA.__T.state.staff[0] === "丁", "用户在分享页里改过的数据刷新后保留");
  // 4d. 没有 window 的极端环境不炸（try/catch 兜底）
  let sbD = makeSandbox({});
  delete sbD.window;
  try {
    loadApp(sbD);
    sbD.__T.load();
    expect(true, "window 缺失时 seedOnce 静默跳过不报错");
  } catch (e) {
    expect(false, "window 缺失时 seedOnce 静默跳过不报错", e.message);
  }

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
