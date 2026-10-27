/* eslint-disable */
/* ============================================================================
   scheduler.js —— 排班引擎（工具自动抽取生成，请勿手改）

   生成器：tools/build_scheduler.py（从 app_merged.html 逐字节切片）
   源文件 sha256 : 866858ba62c8e6be6e850e2f6058a1e6540c43d9991a8f75e6d26f3fcc657396
   核心函数      : 114 个 / 3706 行
   宿主钩子      : 36 个（默认空实现，由宿主注入）
   注入常量      : 37 个

   改算法请改 app_merged.html，然后：
     python tools/build_scheduler.py          # 重新生成
     python tools/build_scheduler.py --check  # 校验是否漂移
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Scheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

/* ===== ① 宿主钩子 ==========================================================
   触碰 DOM / localStorage / 提示框的函数不搬进来，换成可注入的空实现：
   浏览器注入真实的渲染函数，Edge Function 注入记录器，测试注入断言用的替身。
   ========================================================================== */
var HOST = {};
function bindHost(hooks){
  if(!hooks) return;
  for(var k in hooks) if(Object.prototype.hasOwnProperty.call(hooks,k)) HOST[k] = hooks[k];
}
var openStaffProfile = function(){ return HOST.openStaffProfile ? HOST.openStaffProfile.apply(null, arguments) : undefined; };
var personEfficiencyRows = function(){ return HOST.personEfficiencyRows ? HOST.personEfficiencyRows.apply(null, arguments) : undefined; };
var removeStaff = function(){ return HOST.removeStaff ? HOST.removeStaff.apply(null, arguments) : undefined; };
var renderAll = function(){ return HOST.renderAll ? HOST.renderAll.apply(null, arguments) : undefined; };
var renderAnalytics = function(){ return HOST.renderAnalytics ? HOST.renderAnalytics.apply(null, arguments) : undefined; };
var renderArchivePanel = function(){ return HOST.renderArchivePanel ? HOST.renderArchivePanel.apply(null, arguments) : undefined; };
var renderCompliance = function(){ return HOST.renderCompliance ? HOST.renderCompliance.apply(null, arguments) : undefined; };
var renderDash = function(){ return HOST.renderDash ? HOST.renderDash.apply(null, arguments) : undefined; };
var renderDashChecks = function(){ return HOST.renderDashChecks ? HOST.renderDashChecks.apply(null, arguments) : undefined; };
var renderDomainTabs = function(){ return HOST.renderDomainTabs ? HOST.renderDomainTabs.apply(null, arguments) : undefined; };
var renderHealth = function(){ return HOST.renderHealth ? HOST.renderHealth.apply(null, arguments) : undefined; };
var renderMonthStats = function(){ return HOST.renderMonthStats ? HOST.renderMonthStats.apply(null, arguments) : undefined; };
var renderMustWork = function(){ return HOST.renderMustWork ? HOST.renderMustWork.apply(null, arguments) : undefined; };
var renderMustWorkConflict = function(){ return HOST.renderMustWorkConflict ? HOST.renderMustWorkConflict.apply(null, arguments) : undefined; };
var renderNeedsInfo = function(){ return HOST.renderNeedsInfo ? HOST.renderNeedsInfo.apply(null, arguments) : undefined; };
var renderPeopleEfficiency = function(){ return HOST.renderPeopleEfficiency ? HOST.renderPeopleEfficiency.apply(null, arguments) : undefined; };
var renderQuarterTrend = function(){ return HOST.renderQuarterTrend ? HOST.renderQuarterTrend.apply(null, arguments) : undefined; };
var renderReqForm = function(){ return HOST.renderReqForm ? HOST.renderReqForm.apply(null, arguments) : undefined; };
var renderRequestConflict = function(){ return HOST.renderRequestConflict ? HOST.renderRequestConflict.apply(null, arguments) : undefined; };
var renderRequests = function(){ return HOST.renderRequests ? HOST.renderRequests.apply(null, arguments) : undefined; };
var renderRestHints = function(){ return HOST.renderRestHints ? HOST.renderRestHints.apply(null, arguments) : undefined; };
var renderRoles = function(){ return HOST.renderRoles ? HOST.renderRoles.apply(null, arguments) : undefined; };
var renderSchedNeeds = function(){ return HOST.renderSchedNeeds ? HOST.renderSchedNeeds.apply(null, arguments) : undefined; };
var renderShiftTimes = function(){ return HOST.renderShiftTimes ? HOST.renderShiftTimes.apply(null, arguments) : undefined; };
var renderStaff = function(){ return HOST.renderStaff ? HOST.renderStaff.apply(null, arguments) : undefined; };
var renderStaffFilters = function(){ return HOST.renderStaffFilters ? HOST.renderStaffFilters.apply(null, arguments) : undefined; };
var renderStats = function(){ return HOST.renderStats ? HOST.renderStats.apply(null, arguments) : undefined; };
var renderTable = function(){ return HOST.renderTable ? HOST.renderTable.apply(null, arguments) : undefined; };
var renderYearTrend = function(){ return HOST.renderYearTrend ? HOST.renderYearTrend.apply(null, arguments) : undefined; };
var save = function(){ return HOST.save ? HOST.save.apply(null, arguments) : undefined; };
var setSelectOptions = function(){ return HOST.setSelectOptions ? HOST.setSelectOptions.apply(null, arguments) : undefined; };
var switchDomain = function(){ return HOST.switchDomain ? HOST.switchDomain.apply(null, arguments) : undefined; };
var switchView = function(){ return HOST.switchView ? HOST.switchView.apply(null, arguments) : undefined; };
var toast = function(){ return HOST.toast ? HOST.toast.apply(null, arguments) : undefined; };
var updateClearBtns = function(){ return HOST.updateClearBtns ? HOST.updateClearBtns.apply(null, arguments) : undefined; };
var updateSaveSnapshotBtn = function(){ return HOST.updateSaveSnapshotBtn ? HOST.updateSaveSnapshotBtn.apply(null, arguments) : undefined; };

/* 引擎直接使用的宿主全局 */
var confirm = function(){ return HOST.confirm ? HOST.confirm.apply(null, arguments) : true; };

/* ===== ② 注入常量（原样切片）=============================================== */
const SHIFT_NAMES = {early:"早", mid:"中", night:"晚", rest:"休", "":"－"};
const DAY_NAMES = ["周一","周二","周三","周四","周五","周六","周日"];
const TYPE_LABEL = {
  off:"请假", offday:"off", work:"上班", out:"外出",
  early:"固定早班", mid:"固定中班", night:"固定晚班",
  noearly:"不上早班", nomid:"不上中班", nonight:"不上晚班"
};
const SHIFT_TIME_ROWS = [
  {label:"开店",  time:"09:00–18:00", belong:"early", note:"开店闭店组 · 早班提前"},
  {label:"早班",  time:"09:30–18:30", belong:"early", note:"早班"},
  {label:"中班",  time:"12:00–21:00", belong:"mid",   note:"中班"},
  {label:"晚班1", time:"13:00–22:00", belong:"night", note:"晚班"},
  {label:"晚班2", time:"13:30–22:30", belong:"night", note:"晚班"},
  {label:"闭店",  time:"14:00–23:30", belong:"night", note:"开店闭店组 · 晚班延后"}
];
const BELONG_LABEL = {early:"早班", mid:"中班", night:"晚班"};
const STORE_KEY = "shiftScheduler_v2";
let state = {
  staff: [],
  // 姓名 -> { module, position, level, tags }。缺失时按现有分组自动推断。
  staffProfiles: {},
  // 调班记录：[{id, weekKey, day, from, to, at}]
  swaps: [],
  // weekKey -> {publishedAt, confirmations:{name:true}}
  // 工作日（周一~五）：早≥8 中1 晚≥10；周末（周六/日）：早9 中3 晚≥12
  needs: [
    {early:8, mid:1, night:10}, {early:8, mid:1, night:10}, {early:8, mid:1, night:10},
    {early:8, mid:1, night:10}, {early:8, mid:1, night:10},
    {early:9, mid:3, night:12}, {early:9, mid:3, night:12}
  ],
  needsV: 3, // 需求配置版本，规则变更时升级以刷新老数据
  // ---- 排班领域：3C顾问 / 鸿蒙智行 各排各的（鸿蒙智行初始值见 domNeeds，按 16 人 ×5 天反推）----
  domain: "3c",
  needsHM: null,   // 鸿蒙智行每日需求 [{early,mid,night} ×7]，null 时由 domNeeds 自动生成
  limitsHM: {early:3, night:3, mid:99}, // 鸿蒙智行每人每周各班次上限
  restMaxHM: {min:2, per:2, total:0},    // 鸿蒙智行休息配额（0=自动）
  needsMgr: null,   // 经理每日需求，null 时由 domNeeds 自动生成
  limitsMgr: {early:3, night:3, mid:99},
  restMaxMgr: {min:2, per:2, total:0},
  needsAS: null,    // 售后每日需求，null 时由 domNeeds 自动生成
  limitsAS: {early:3, night:3, mid:99},
  restMaxAS: {min:2, per:2, total:0},
  // 库房 / 行政：两个独立部门，但全员免排（见 EXCLUDE_POSITIONS / EXCLUDE_MODULES），
  // 需求表只用于让界面与「需求配置」等面板保持完整，实际排班会因人数不足被拦下
  needsKF: null,
  limitsKF: {early:3, night:3, mid:99},
  restMaxKF: {min:2, per:2, total:0},
  needsAD: null,
  limitsAD: {early:3, night:3, mid:99},
  restMaxAD: {min:2, per:2, total:0},
  // 尊界：原鸿蒙智行分出，独立排班。5 人 × 5 天 = 25 容量，需求取 22（平日3 / 周末4）
  needsZJ: null,
  limitsZJ: {early:3, night:3, mid:99},
  restMaxZJ: {min:2, per:2, total:0},
  limits: {early:3, night:3, mid:99}, // 每人每周各班次上限
  limitsV: 1, // 班次上限配置版本：1=晚班≤3 已生效；老存档没有此字段→0，由 upgradeNightCap 做一次迁移
  // 休息配额（区间）：min=每人每周至少休 N 天；per=最多休 N 天；total=全队每周休息总数上限（0=自动，取 per×人数）
  // min === per 时退化成原来的「每人恰好休 per 天」。允许 min < per（如 2~3 天），
  // 此时算法在区间内轮换，让一部分人休 2 天、一部分人休 3 天，而不是全队统一休 3 天。
  restMax: {min:2, per:2, total:0},
  // 模块在岗下限：每个模块每天至少要有这么多人上班（班次不限），避免整模块集体休息。0 = 不限制
  moduleMinOn: 1,
  // 「人数固定」的班次：这些班次排出来的人数恰好等于需求，富余人力不摊进来（默认只有早班）
  exactShifts: ["early"],
  // 周末（周六+周日）两天都上早班的人数上限。开店闭店组强制周末换人，不吃这个名额
  weekendEarlyMax: 1,
  // 分组约束
  groups: {
    // 早晚保障组：这组成员里，每天至少 minEarly 人早班 + minNight 人晚班
    earlyNight: {members:["何广友","邓臻蓝","孙勇","王鹏俊"], minEarly:1, minNight:1},
    // 界面上这个组显示为「专家老师组」（成员与该模块完全一致），内部 key 仍叫 earlyNight。
    label: "专家老师组",
    // 开店闭店组：每天从这组的早班者里挑 open 人标「开店」、晚班者里挑 close 人标「闭店」；
    // 为保证有得挑，每天该组至少 open 人早班 + close 人晚班；每人每周角色总数 ≤ maxPerWeek
    openClose: {
      members:["陈悦娴","高超","吴心然","刘舒晨","刘思含","吴洋洋","李敏","张子柔","冯楷"],
      open:1, close:2, maxPerWeek:3
    }
  },
  requests: [],                       // 请假 / 特殊班次安排
  // 「固定上班日」常驻规则：这些人这些天一定排上班，不排休息，每周都生效。
  // 和请假区里的「必须上班（不排休息）」是同一条约束（内部都编译成 noOff），
  // 区别是这里的规则不会随周次切换而失效，也不占用请假列表的位置。
  mustWork: [{name:"陈悦娴", day:0}, {name:"张淑慧", day:0}],   // 周一
  /* 固定班表：某些部门的人排班不参与算法，周表完全写死。
     与 mustWork 的区别：mustWork 只说「这天一定上班」（班次由算法定），
     fixedRoster 连班次一起钉死，并可强制休息。

     两种写法：
     ① pattern（推荐）：整部门统一一张班表。以后往该部门加人**自动适用**，不用改代码。
            admin: { pattern: ["early",...7天] }
     ② roster：逐人指定，适合「同部门内部分工不同」的情况。
            admin: { roster:{ "张三":[...], "李四":[...] } }
     两者可共存；同一部门优先用 pattern（覆盖全部门），roster 只写例外的人。
     落地方式：排完整个班表后直接覆盖这些格子 —— 算法怎么排都不影响他们。 */
  fixedRoster: {
    // 行政：全员周一至周五早班、周六日双休（用 pattern，以后新增人员自动适用）
    admin: { pattern: ["early","early","early","early","early","rest","rest"] },
    // 另一个格式示例（当前未启用，需要时改成 { admin:{ roster:{ 姓名:[...] } } } 即可）
  },
  schedule: {}, // weekKey -> {name: [7]}
  roles: {},    // weekKey -> {name: [7]}，取值 "open"(开店) / "close"(闭店) / ""
  roleSig: {},   // weekKey -> 排班表指纹；指纹变了说明班次被手动改过，需重算开店闭店标记
  // 用户手动改过的格子：weekKey -> {"姓名|星期": 1}。
  // 微调 / 局部修复一律不得覆盖这些格子 —— 「轻触」契约的正式载体
  manual: {}
};
let profileTarget = null;
const ROSTER_PROFILES = {
  "何广友": {
    "module": "专家老师组",
    "position": "专家老师",
    "level": "员工"
  },
  "邓臻蓝": {
    "module": "专家老师组",
    "position": "专家老师",
    "level": "员工"
  },
  "孙勇": {
    "module": "专家老师组",
    "position": "专家老师",
    "level": "员工"
  },
  "王鹏俊": {
    "module": "专家老师组",
    "position": "专家老师",
    "level": "员工"
  },
  "陈悦娴": {
    "module": "销售运营",
    "position": "销售分析",
    "level": "员工"
  },
  "张淑慧": {
    "module": "销售运营",
    "position": "销售分析",
    "level": "员工"
  },
  "刘科": {
    "module": "陈列运维",
    "position": "综合",
    "level": "员工"
  },
  "黄少龙": {
    "module": "陈列运维",
    "position": "综合",
    "level": "员工"
  },
  "郭嘉洪": {
    "module": "陈列运维",
    "position": "综合",
    "level": "员工"
  },
  "王申澳": {
    "module": "陈列运维",
    "position": "综合",
    "level": "员工"
  },
  "高子健": {
    "module": "陈列运维",
    "position": "综合",
    "level": "员工"
  },
  "冯楷": {
    "module": "陈列运维",
    "position": "综合",
    "level": "员工"
  },
  "胡亚达": {
    "module": "市场活动",
    "position": "MKT",
    "level": "员工"
  },
  "李文轩": {
    "module": "市场活动",
    "position": "MKT",
    "level": "员工"
  },
  "桑浩洋": {
    "module": "市场活动",
    "position": "MKT",
    "level": "员工"
  },
  "黄雅情": {
    "module": "市场活动",
    "position": "MKT",
    "level": "员工"
  },
  "王娜娜": {
    "module": "市场活动",
    "position": "MKT",
    "level": "员工"
  },
  "符名洋": {
    "module": "市场活动",
    "position": "MKT",
    "level": "员工"
  },
  "高超": {
    "module": "企业购收银",
    "position": "企业购",
    "level": "员工"
  },
  "周林奥": {
    "module": "企业购收银",
    "position": "企业购",
    "level": "员工"
  },
  "吴心然": {
    "module": "企业购收银",
    "position": "收银/财务",
    "level": "员工"
  },
  "刘舒晨": {
    "module": "企业购收银",
    "position": "收银/财务",
    "level": "员工"
  },
  "刘思含": {
    "module": "企业购收银",
    "position": "收银/财务",
    "level": "员工"
  },
  "刘乔一": {
    "module": "企业购收银",
    "position": "收银/财务",
    "level": "员工"
  },
  "李秀珊": {
    "module": "服务体验",
    "position": "服务",
    "level": "员工"
  },
  "吴洋洋": {
    "module": "服务体验",
    "position": "服务",
    "level": "员工"
  },
  "李敏": {
    "module": "服务体验",
    "position": "服务",
    "level": "员工"
  },
  "张子柔": {
    "module": "服务体验",
    "position": "咖啡吧",
    "level": "员工"
  },
  "程雨轩": {
    "module": "服务体验",
    "position": "服务",
    "level": "员工"
  },
  "谢佳委": {
    "module": "新员工",
    "position": "新员工",
    "level": "员工"
  },
  "田方斌": {
    "module": "新员工",
    "position": "新员工",
    "level": "员工"
  },
  "贾孟源": {
    "module": "新员工",
    "position": "新员工",
    "level": "员工"
  },
  "黎振鹏": {
    "module": "服务体验",
    "position": "咖啡吧",
    "level": "员工"
  },
  "陈志浩": {
    "module": "人事培训",
    "position": "人事",
    "level": "经理"
  },
  "刘可佳": {
    "module": "行政",
    "position": "人事",
    "level": "员工"
  },
  "何昊敏": {
    "module": "行政",
    "position": "人事",
    "level": "员工"
  },
  "齐妍": {
    "module": "销售运营",
    "position": "销售分析",
    "level": "经理"
  },
  "张泽鑫": {
    "module": "库房",
    "position": "库房管理",
    "level": "员工"
  },
  "李文捷": {
    "module": "库房",
    "position": "库房管理",
    "level": "员工"
  },
  "李世龙": {
    "module": "库房",
    "position": "库房管理",
    "level": "员工"
  },
  "林嘉彤": {
    "module": "库房",
    "position": "库房管理",
    "level": "员工"
  },
  "曾子杰": {
    "module": "库房",
    "position": "库房管理",
    "level": "员工"
  },
  "李信服": {
    "module": "服务体验",
    "position": "服务",
    "level": "经理"
  },
  "符致秀": {
    "module": "陈列运维",
    "position": "综合",
    "level": "经理"
  },
  "马俊杰": {
    "module": "企业购收银",
    "position": "企业购",
    "level": "经理"
  },
  "黎瑶": {
    "module": "行政",
    "position": "收银/财务",
    "level": "员工"
  },
  "莫甄姗": {
    "module": "行政",
    "position": "收银/财务",
    "level": "员工"
  },
  "杨乐乐": {
    "module": "行政",
    "position": "收银/财务",
    "level": "员工"
  },
  "贾桠雄": {
    "module": "售后",
    "position": "受理员",
    "level": "经理"
  },
  "刘兰": {
    "module": "售后",
    "position": "受理员",
    "level": "员工"
  },
  "李逸帆": {
    "module": "售后",
    "position": "受理员",
    "level": "员工"
  },
  "陈婷": {
    "module": "售后",
    "position": "受理员",
    "level": "员工"
  },
  "陈嘉敏": {
    "module": "售后",
    "position": "受理员",
    "level": "员工"
  },
  "李冰冰": {
    "module": "售后",
    "position": "受理员",
    "level": "员工"
  },
  "胡振邦": {
    "module": "售后",
    "position": "受理员",
    "level": "员工"
  },
  "李倩": {
    "module": "售后",
    "position": "受理员",
    "level": "员工"
  },
  "胡文志": {
    "module": "售后",
    "position": "工程师",
    "level": "员工"
  },
  "王强": {
    "module": "售后",
    "position": "工程师",
    "level": "员工"
  },
  "卢鹏宇": {
    "module": "售后",
    "position": "工程师",
    "level": "员工"
  },
  "陈明泽": {
    "module": "售后",
    "position": "工程师",
    "level": "员工"
  },
  "范晓萱": {
    "module": "售后",
    "position": "库管",
    "level": "员工"
  },
  "晏潇艺": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "经理"
  },
  "周道成": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "唐小晖": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "朱家禄": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "李其烁": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "张正": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "苏庆生": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "黄晰文": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "经理"
  },
  "张煜乾": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "王健俐": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "姜久文": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "黄煜帆": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "何泽鹏": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "赖炳康": {
    "module": "鸿蒙智行",
    "position": "杜勇",
    "level": "员工"
  },
  "王秋千": {
    "module": "尊界",
    "position": "杜勇",
    "level": "经理"
  },
  "张荣": {
    "module": "尊界",
    "position": "杜勇",
    "level": "员工"
  },
  "唐心丽": {
    "module": "尊界",
    "position": "杜勇",
    "level": "员工"
  },
  "林家鸿": {
    "module": "尊界",
    "position": "杜勇",
    "level": "员工"
  },
  "张晓龙": {
    "module": "尊界",
    "position": "杜勇",
    "level": "员工"
  },
  "廖梓宸": {
    "module": "尊界",
    "position": "杜勇",
    "level": "员工"
  },
};
const ORDER_3C = ["何广友","邓臻蓝","孙勇","王鹏俊","陈悦娴","张淑慧","刘科","黄少龙","郭嘉洪","王申澳","高子健","冯楷",
"胡亚达","李文轩","桑浩洋","黄雅情","王娜娜","符名洋","高超","周林奥","吴心然","刘舒晨","刘思含","刘乔一",
"李秀珊","吴洋洋","李敏","张子柔","程雨轩","谢佳委","田方斌","贾孟源","黎振鹏"];
let currentMonday = mondayOf(new Date());
const BATCH = { on:false, quiet:false };
const ONLY_TYPES = ["early","mid","night"];
const ROLE_LABEL = {open:"开店", close:"闭店"};
const ROLE_DOMAINS = ["3c", "aftersales"];
const EXCLUDE_SCHEDULE = new Set(["黄弼姗"]);
const EXCLUDE_MODULES = new Set([]);
const EXCLUDE_POSITIONS = new Set(["库房管理"]);
const HM_MODULE = "鸿蒙智行";
const AS_MODULE = "售后";
const KF_MODULE = "库房";     // 原销售运营里的库房管理组，已单独成部门
const AD_MODULE = "行政";     // 原人事培训 2 人 + 原企业购收银 3 人，已统一按模块免排
const ZJ_MODULE = "尊界";     // 原鸿蒙智行分出，独立排班（王秋千组 4 人 + 唐心丽）
const DOMAINS = [
  /* 3C 是「兜底」域：凡是没被其他域认领的人都在这里。
     所以每加一个独立域，都必须在这里同步加一条 !isXxx(n)，
     否则该域的人会**同时**出现在 3C 里（排班时两处都算他，域人数也会虚高）。 */
  {key:"3c",         label:"3C顾问",   match: n=> !isManager(n) && !isHongmeng(n) && !isAftersales(n) && !isKufang(n) && !isAdmin(n) && !isZunjie(n)},
  {key:"hongmeng",   label:"鸿蒙智行", match: n=> !isManager(n) && isHongmeng(n) && !isZunjie(n)},
  {key:"zunjie",     label:"尊界",     match: n=> !isManager(n) && isZunjie(n)},
  {key:"aftersales", label:"售后",     match: n=> !isManager(n) && isAftersales(n)},
  {key:"kufang",     label:"库房",     match: n=> !isManager(n) && isKufang(n)},
  {key:"admin",      label:"行政",     match: n=> !isManager(n) && isAdmin(n)},
  {key:"manager",    label:"经理",     match: n=>  isManager(n)}
];
const DOM_KEYS = DOMAINS.map(d=>d.key);
const DOM_NEEDS_FIELD  = {hongmeng:"needsHM",  manager:"needsMgr",  aftersales:"needsAS",
                          kufang:"needsKF",    admin:"needsAD",     zunjie:"needsZJ"};
const DOM_LIMITS_FIELD = {hongmeng:"limitsHM", manager:"limitsMgr", aftersales:"limitsAS",
                          kufang:"limitsKF",   admin:"limitsAD",    zunjie:"limitsZJ"};
const DOM_REST_FIELD   = {hongmeng:"restMaxHM",manager:"restMaxMgr",aftersales:"restMaxAS",
                          kufang:"restMaxKF",  admin:"restMaxAD",   zunjie:"restMaxZJ"};
const CLIMB_MOVES = [
  (week, R, k)=> balanceShifts(week, R, k),
  (week, R, k)=> balanceNightShifts(week, R, k),
  (week, R)=> fixIsolatedRest(week, R)
];
const UI_ICONS = {
  home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.6 12 3l9 7.6"/><path d="M5.4 9.4V21h13.2V9.4"/><path d="M9.2 21v-6.5h5.6V21"/></svg>',
  users:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 19.2V21"/><circle cx="9.5" cy="7" r="3.6"/><path d="M21 21v-1.8a4.2 4.2 0 0 0-3.2-4.1"/><path d="M15.4 3.5a3.6 3.6 0 0 1 0 7"/></svg>',
  settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>',
  chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  backup:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19.5h16"/></svg>'
};
const VIEWS = [
  ["dash","home","工作台","排班总览与快捷入口"],
  ["people","users","人员管理","模块、岗位与人员标签"],
  ["rules","settings","需求与请假","每日需求、限制与请假安排"],
  ["schedule","calendar","排班表","一键智能排班与微调"],
  ["stats","chart","统计","排班人效与周期趋势"],
  ["backup","backup","导出 / 分享","导出带数据的网页与分享链接"]
];
let curView = "dash";
let lastHealth = {errs:[], warns:[], all:[]};
const STAFF_MODULE_PALETTE = [
  {color:"#315efb", bg:"#edf2ff", border:"#dce5ff"},
  {color:"#0f8f86", bg:"#e8f8f5", border:"#c9eee8"},
  {color:"#b3610b", bg:"#fff5e8", border:"#f3d7ad"},
  {color:"#6b3fc4", bg:"#f4efff", border:"#e2d5fb"},
  {color:"#c13c55", bg:"#fff0f3", border:"#f5ced7"},
  {color:"#237a45", bg:"#edf9f1", border:"#ccebd7"},
  {color:"#246b9e", bg:"#edf7ff", border:"#cce6f6"}
];
const BELONG_COLOR = {early:"var(--early)", mid:"var(--mid)", night:"var(--night)"};
let statsArchive = [];
const HOUR_OF = {early:9, mid:9, night:9.5};

/* ===== ③ 引擎核心（原样切片，逐字节一致）=================================== */
function groupMembers(key){
  const g = state.groups && state.groups[key];
  if(!g || !Array.isArray(g.members)) return [];
  return g.members.filter(n => state.staff.includes(n));
}
function schedulableGroupMembers(key){
  return groupMembers(key).filter(n => !isBlockedFromSchedule(n));
}
function mondayOf(d){
  const x = new Date(d);
  const day = (x.getDay()+6)%7; // 0=周一
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
function fmt(d){ return fmtLocal(d); }
function fmtCN(d){ return `${d.getMonth()+1}月${d.getDate()}日`; }
function fmtLocal(d){ const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function dateObj(s){ const a = String(s).split("-").map(Number); return new Date(a[0], (a[1]||1)-1, a[2]||1); }
function dateLabel(s){ if(!s) return ""; const d = dateObj(s); return `${d.getMonth()+1}月${d.getDate()}日`; }
function inferDateYear(mo){
  const cm = currentMonday;
  let best = cm.getFullYear(), bestScore = Infinity;
  for(let k = -1; k <= 1; k++){
    const y = cm.getFullYear() + k;
    const d = new Date(y, mo - 1, 15);            // 用月中估算，避开 2 月 30 日之类的边界
    const diff = d.getTime() - cm.getTime();      // > 0 = 未来
    const score = Math.abs(diff) - (diff > 0 ? 43200000 : 0);
    if(score < bestScore){ bestScore = score; best = y; }
  }
  return best;
}
function parseDateToken(s){
  if(!s) return null;
  const t = String(s).replace(/\s+/g, "");
  let m = /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/.exec(t), y, mo, da;
  if(m){ y = +m[1]; mo = +m[2]; da = +m[3]; }
  else{
    m = /(\d{1,2})[./\-月](\d{1,2})/.exec(t);
    if(!m) return null;
    mo = +m[1]; da = +m[2]; y = inferDateYear(mo);
  }
  if(!(mo>=1 && mo<=12) || !(da>=1 && da<=31)) return null;
  const d = new Date(y, mo-1, da);
  if(d.getMonth() !== mo-1 || d.getDate() !== da) return null;   // 2 月 30 日之类
  return fmtLocal(d);
}
function restTotalCap(){
  const {per} = restRange();
  return state.restMax.total > 0 ? state.restMax.total : per * state.staff.length;
}
function wouldIsolate(set, day){
  const has = x => set.has((x+7)%7);
  if(has(day-2) && !has(day-1)) return true;   // (day-2)休、(day-1)上、day 休
  if(has(day+2) && !has(day+1)) return true;   // day 休、(day+1)上、(day+2) 休
  return false;
}
function wouldRun3Rest(set, day){
  const has = x => set.has((x+7)%7);
  if(has(day) === false && has(day-1) && has(day-2)) return true;   // (day-2)(day-1) 已休，加 day 就是 3 连
  if(has(day-1) && has(day+1)) return true;                          // (day-1) 与 (day+1) 都休 → 3 连
  if(has(day+1) && has(day+2)) return true;                          // 加 day 后 day+1 day+2 连休 → 3 连
  return false;
}
function run3RestCount(set){
  if(!set || set.size < 3) return 0;
  let c = 0;
  for(let d=0; d<7; d++) if(set.has(d) && set.has((d+1)%7) && set.has((d+2)%7)) c++;
  return c;
}
function restRange(){
  const r = state.restMax || {};
  const per = Math.min(7, Math.max(0, +r.per || 0));
  const min = Math.min(per, Math.max(0, (r.min === undefined || r.min === null || r.min === "") ? per : (+r.min || 0)));
  return {min, per};
}
function isolatedRestCount(set){
  if(!set || set.size < 2) return 0;
  let c = 0;
  for(let d=0; d<7; d++){
    if(set.has(d) && !set.has((d+1)%7) && set.has((d+2)%7)) c++;
  }
  return c;
}
function restSetOfWeek(week, n){
  const s = new Set();
  for(let d=0; d<7; d++){ if((week[n][d]||"") === "rest") s.add(d); }
  return s;
}
function wouldIsolateWeek(week, n, targetD, dropD){
  const s = restSetOfWeek(week, n);
  if(dropD !== undefined && dropD !== null) s.delete(dropD);
  if(s.has(targetD)) return false;
  return wouldIsolate(s, targetD);
}
function wouldEarlyRun3(getShift, day){
  for(let s=-2; s<=0; s++){                    // 覆盖包含 day 的全部 3 天窗口
    const a=(day+s+7)%7, b=(day+s+1+7)%7, c=(day+s+2+7)%7;
    const va = (a===day) ? "early" : getShift(a);
    const vb = (b===day) ? "early" : getShift(b);
    const vc = (c===day) ? "early" : getShift(c);
    if(va==="early" && vb==="early" && vc==="early") return true;
  }
  return false;
}
function hasEarlyRun3(getShift){
  for(let d=0; d<7; d++){
    if(getShift(d)==="early" && getShift((d+1)%7)==="early" && getShift((d+2)%7)==="early") return true;
  }
  return false;
}
function weekKeyOf(mon){ return fmt(mon); }
function curKey(){ return weekKeyOf(currentMonday); }
function getWeek(k){ return state.schedule[k] || null; }
function ensureWeek(k){
  if(!state.schedule[k]){
    const w = {};
    state.staff.forEach(n=>{ w[n] = ["","","","","","",""]; });
    state.schedule[k] = w;
  }
  // 补新增员工 / 删多余
  const w = state.schedule[k];
  state.staff.forEach(n=>{ if(!w[n]) w[n]=["","","","","","",""]; });
  Object.keys(w).forEach(n=>{ if(!state.staff.includes(n)) delete w[n]; });
  return w;
}
function activeRequests(weekK){
  return state.requests.filter(r =>
    state.staff.includes(r.name) && (r.scope === "always" || r.weekKey === weekK)
  );
}
function buildRules(weekK, dom){
  dom = dom || curDomain();
  const R = {};
  state.staff.filter(n=> inDomain(n, dom)).forEach(n=>{
    R[n] = Array.from({length:7}, ()=>({off:false, offDay:false, offOut:false, noOff:false, only:null, ban:{early:false,mid:false,night:false}}));
  });
  activeRequests(weekK).forEach(r=>{
    const row = R[r.name];
    if(!row) return;
    const c = row[r.day];
    if(r.type === "off"){ c.off = true; }
    else if(r.type === "offday"){ c.off = true; c.offDay = true; }   // off：强制休息，但不标记请假、不占请假额度
    else if(r.type === "out"){ c.off = true; c.offOut = true; }      // 外出：等同休息日（占休息额度），但不占请假额度
    else if(r.type === "work"){ c.noOff = true; }
    else if(ONLY_TYPES.indexOf(r.type) >= 0){ c.only = r.type; c.noOff = true; }
    else if(r.type === "noearly"){ c.ban.early = true; }
    else if(r.type === "nomid"){ c.ban.mid = true; }
    else if(r.type === "nonight"){ c.ban.night = true; }
  });
  // 「固定上班日」常驻规则 → 不排休息。
  // 优先级：请假（off）高于一切，当天请了假就不强制上班 —— 与界面上写的一致。
  (state.mustWork || []).forEach(mw=>{
    const row = R[mw.name];
    if(!row) return;
    const c = row[mw.day];
    if(!c || c.off) return;
    c.noOff = true;
  });
  return R;
}
function hasRule(c){ return !!(c && (c.off || c.noOff || c.only || c.ban.early || c.ban.mid || c.ban.night)); }
function ruleText(c){
  if(!c) return "";
  const p = [];
  if(c.offOut) p.push("外出");
  else if(c.offDay) p.push("必须off");
  else if(c.off) p.push("必须休息（请假）");
  if(c.only)  p.push("固定" + SHIFT_NAMES[c.only] + "班");
  if(c.noOff && !c.only) p.push("不排休息");
  ONLY_TYPES.forEach(sh=>{ if(c.ban[sh]) p.push("不上" + SHIFT_NAMES[sh] + "班"); });
  return p.join("、");
}
function checkRuleViolations(week, R){
  const bad = [];
  state.staff.forEach(n=>{
    if(!week[n]) return;
    for(let d=0; d<7; d++){
      const c = R[n] && R[n][d];
      if(!hasRule(c)) continue;
      const v = week[n][d] || "";
      if(c.off && v !== "rest")                     bad.push(`${n} ${DAY_NAMES[d]} 应休息`);
      else if(c.only && v !== c.only)               bad.push(`${n} ${DAY_NAMES[d]} 应为${SHIFT_NAMES[c.only]}班`);
      else if(v && c.ban[v])                        bad.push(`${n} ${DAY_NAMES[d]} 不应排${SHIFT_NAMES[v]}班`);
      else if(c.noOff && !c.only && v === "rest")   bad.push(`${n} ${DAY_NAMES[d]} 不应休息`);
    }
  });
  return bad;
}
function cellViolation(c, v){
  if(!hasRule(c)) return "";
  if(c.off && v !== "rest")                   return "本日已设为「必须休息」";
  if(c.only && v !== c.only)                  return `本日已固定为「${SHIFT_NAMES[c.only]}班」`;
  if(v && c.ban[v])                           return `本日已设为「不上${SHIFT_NAMES[v]}班」`;
  if(c.noOff && !c.only && v === "rest")      return "本日已设为「不排休息」";
  return "";
}
function roleOf(k, name, day){
  const w = state.roles[k];
  if(!w || !w[name]) return "";
  return w[name][day] || "";
}
function scheduleSig(week){
  return state.staff.map(n => (week[n] || []).join("")).join("|");
}
function roleCands(week, members, day, shift){
  return members.filter(n => week[n] && week[n][day] === shift);
}
function tryRoles(week, members, openN, closeN, maxPer){
  const cnt = {}, out = {};
  members.forEach(n=>{ cnt[n] = 0; out[n] = ["","","","","","",""]; });
  let short = 0;
  for(const d of shuffle([0,1,2,3,4,5,6])){
    for(const spec of [{n:openN, sh:"early", role:"open"}, {n:closeN, sh:"night", role:"close"}]){
      // 只有当天确实在上对应班次的人才有资格；已满 maxPer 次的人直接跳过
      const pool = shuffle(roleCands(week, members, d, spec.sh)).filter(x => cnt[x] < maxPer);
      pool.sort((a,b)=> cnt[a] - cnt[b]);   // 次数少的优先（同次数保持随机次序 → 平均分配）
      for(let i=0; i<spec.n; i++){
        if(i < pool.length){ out[pool[i]][d] = spec.role; cnt[pool[i]]++; }
        else short++;
      }
    }
  }
  const vals = members.map(n=>cnt[n]);
  const mean = vals.reduce((s,x)=>s+x,0) / (members.length||1);
  const variance = vals.reduce((s,x)=>s+(x-mean)*(x-mean),0);
  return {roles:out, cnt, short, variance};
}
function assignRoles(k){
  if(ROLE_DOMAINS.indexOf(curDomain()) < 0){ return {short:0, members:0, maxPer:3, cnt:{}}; }
  const week = state.schedule[k];
  const members = groupMembers("openClose");
  const oc = (state.groups && state.groups.openClose) || {};
  const openN  = Math.max(0, +oc.open  || 0);
  const closeN = Math.max(0, +oc.close || 0);
  const maxPer = Math.min(7, Math.max(1, +oc.maxPerWeek || 3));
  if(!week || members.length === 0 || (openN + closeN) === 0){
    state.roles[k] = {};
    state.roleSig[k] = week ? scheduleSig(week) : "";
    return {short:0, members:members.length, maxPer, cnt:{}, variance:0};
  }
  let best = null;
  for(let t=0; t<300; t++){
    const r = tryRoles(week, members, openN, closeN, maxPer);
    const key = r.short * 1000 + r.variance;   // 先保证不缺人，再追求平均
    if(!best || key < best.key) best = {key, ...r};
    if(best.short === 0 && best.variance === 0) break;
  }
  // 只保留本次仍有效的标记：组外人员 / 非对应班次的残留一律清掉
  const clean = {};
  members.forEach(n=>{ clean[n] = best.roles[n]; });
  state.roles[k] = clean;
  state.roleSig[k] = scheduleSig(week);
  return {short:best.short, members:members.length, maxPer, cnt:best.cnt, variance:best.variance};
}
function syncRoles(k, week){
  if(state.roleSig[k] === scheduleSig(week)) return false;
  assignRoles(k);
  return true;
}
function moduleMinOn(){
  const v = state.moduleMinOn;
  return Math.min(3, Math.max(0, v === undefined || v === null ? 1 : (+v || 0)));
}
function moduleMinOnExempt(m){
  return m === "销售运营";
}
function isManager(name){ return getStaffProfile(name).level === "经理"; }
function isBlockedFromSchedule(name){
  if(isManager(name)) return true;
  if(EXCLUDE_SCHEDULE.has(name)) return true;
  const p = getStaffProfile(name);
  if(EXCLUDE_MODULES.has(p.module)) return true;
  /* 固定班表的人：班次由 fixedRoster 直接写死（见 applyFixedRoster），
     **不参与**算法分配。这里必须判为「不可排班」——
     否则他们会被算进各领域的人力池，算法以为多了几个可用人力，
     结果排出「排不满」的班表（实测会让 3c 整周空表）。 */
  if(fixedRosterNames("admin").indexOf(name) >= 0) return true;
  return EXCLUDE_POSITIONS.has(p.position);
}
function curDomain(){ return DOM_KEYS.indexOf(state.domain) >= 0 ? state.domain : "3c"; }
function domLabel(dom){ const d = DOMAINS.find(x=>x.key===dom); return d ? d.label : "3C顾问"; }
function groupLabel(key){
  const g = state.groups && state.groups[key];
  if(g && typeof g.label === "string" && g.label.trim()) return g.label.trim();
  if(key === "earlyNight") return "专家老师组";
  if(key === "openClose") return "开店闭店组";
  return key;
}
function isHongmeng(name){ return getStaffProfile(name).module === HM_MODULE; }
function isAftersales(name){ return getStaffProfile(name).module === AS_MODULE; }
function isKufang(name){ return getStaffProfile(name).module === KF_MODULE; }
function isAdmin(name){ return getStaffProfile(name).module === AD_MODULE; }
function isZunjie(name){ return getStaffProfile(name).module === ZJ_MODULE; }
function inDomain(name, dom){
  /* 名单迁库（算法文档 N16）：宿主给了 state.staffDomain（{姓名:领域}）就按它判，
     不再靠模块名猜；没给（内嵌页面 / 旧存档 / 跑分基座）时回落到模块谓词，
     行为与改造前完全一致。map 里查不到的人继续走谓词，避免「新加的人哪儿都不在」。 */
  const map = state.staffDomain;
  if(map && map[name]) return map[name] === dom;
  const d = DOMAINS.find(x=>x.key===dom);
  return d ? d.match(name) : false;
}
function domainStaff(dom){ return state.staff.filter(n=> inDomain(n, dom)); }
function fixedRosterOf(dom){
  const fr = state.fixedRoster && state.fixedRoster[dom];
  if(!fr) return null;
  const out = {};
  // ① pattern 先铺满整个领域
  if(Array.isArray(fr.pattern) && fr.pattern.length === 7){
    /* 这里必须用 inDomain 直接筛，**不能调 domainStaff** ——
       domainStaff 会走到 inDomain → isBlockedFromSchedule → fixedRosterNames
       → fixedRosterOf，再回到这里，形成无限递归。
       用最底层的 state.staff + inDomain 就够了（pattern 是「全员」，
       本来就不该受免排规则影响）。 */
    state.staff.forEach(n=>{ if(inDomain(n, dom)) out[n] = fr.pattern.slice(); });
  }
  // ② roster 覆盖（含例外情况）
  if(fr.roster && typeof fr.roster === "object"){
    Object.keys(fr.roster).forEach(n=>{ out[n] = (fr.roster[n]||[]).slice(); });
  }
  return Object.keys(out).length ? out : null;
}
function fixedRosterNames(dom){
  const r = fixedRosterOf(dom);
  return r ? Object.keys(r) : [];
}
function allFixedRosterNames(){
  const fr = state.fixedRoster || {};
  const out = [];
  Object.keys(fr).forEach(dom=>{
    const r = fixedRosterOf(dom);
    if(r) Object.keys(r).forEach(n=>{ if(out.indexOf(n)<0) out.push(n); });
  });
  return out;
}
function applyFixedRoster(week, R, dom){
  dom = dom || curDomain();
  const roster = fixedRosterOf(dom);
  if(!roster) return 0;
  let n = 0;
  Object.keys(roster).forEach(name=>{
    if(!week[name]){ week[name] = new Array(7).fill("rest"); }
    const row = roster[name] || [];
    for(let d=0; d<7; d++){
      const c = R && R[name] && R[name][d];
      if(c && c.off) continue;                 // 请假优先，不覆盖
      const v = (d < row.length) ? row[d] : "rest";
      if(week[name][d] !== v){ week[name][d] = v; n++; }
    }
  });
  return n;
}
function blockedInDomain(name, dom){
  if(dom !== "manager") return isBlockedFromSchedule(name);
  return EXCLUDE_SCHEDULE.has(name);
}
function domainSchedulable(dom){ return domainStaff(dom).filter(n=> !blockedInDomain(n, dom)); }
function domNeeds(dom){
  const f = DOM_NEEDS_FIELD[dom];
  if(!f) return state.needs;
  if(!Array.isArray(state[f]) || state[f].length !== 7){
    // 经理 9 人×5=45 容量取 37；售后 12 人×5=60 容量取 52（平日7 / 周末8）
    // 库房/行政各 5 人且全员免排，这里只为了让需求面板有值可显示
    const preset = dom === "manager"  ? [5,5,5,5,5,6,6]
                 : dom === "aftersales"? [7,7,7,7,7,8,8]
                 : (dom === "kufang" || dom === "admin") ? [3,3,3,3,3,4,4]
                 : dom === "zunjie" ? [3,3,3,3,3,4,4]
                 : [10,10,10,10,10,11,11];
    state[f] = preset
      .map(v=>({early:Math.round(v*0.55), mid:1, night:v-Math.round(v*0.55)-1}));
  }
  return state[f];
}
function domLimits(dom){
  const f = DOM_LIMITS_FIELD[dom];
  const d = f ? state[f] : state.limits;
  return (d && typeof d === "object") ? d : {early:3, night:3, mid:99};
}
function domRestMax(dom){
  const f = DOM_REST_FIELD[dom];
  const r = f ? state[f] : state.restMax;
  if(!r || typeof r !== "object") return {min:2, per:2, total:0};
  // 老存档 / 手改存档可能缺 min：补成 min=per，行为与旧版一致
  if(r.min === undefined || r.min === null || r.min === "") r.min = r.per || 2;
  return r;
}
function schedRestStats(week, dom){
  dom = dom || curDomain();
  const rm = domRestMax(dom);
  const per = Math.min(7, Math.max(0, rm.per || 2));
  const list = domainSchedulable(dom);
  let rest = 0;
  list.forEach(n=>{
    const arr = week[n] || [];
    rest += [0,1,2,3,4,5,6].filter(d=>{ const v = arr[d] || ""; return v==="rest" || v===""; }).length;
  });
  const cap = (rm.total > 0) ? rm.total : per * list.length;
  return {rest, cap, count:list.length};
}
function nonManagerBlocked(name){ return isBlockedFromSchedule(name) && !isManager(name); }
function staffDisplayCmp(a,b){
  const ia = ORDER_3C.indexOf(a), ib = ORDER_3C.indexOf(b);
  if(ia >= 0 && ib >= 0) return ia - ib;                 // 都在名单里 → 按名单顺序
  if(ia >= 0) return -1;                                  // a 在名单、b 不在 → a 在前
  if(ib >= 0) return 1;                                   // 反之
  return (nonManagerBlocked(a)?1:0) - (nonManagerBlocked(b)?1:0) || state.staff.indexOf(a) - state.staff.indexOf(b);
}
function batchScheduleWeeks(weeks, dom, opts){
  weeks = Math.max(2, Math.min(12, weeks|0 || 4));
  dom = dom || curDomain();
  if(BATCH.on){ toast("批量排班正在进行中"); return; }

  const hasFixed = !!fixedRosterOf(dom);
  if(!hasFixed && domainSchedulable(dom).length < 2){
    const all = domainStaff(dom).length, sc = domainSchedulable(dom).length;
    toast(all > 0
      ? "「" + domLabel(dom) + "」共 " + all + " 人，但全部免排（" + sc + " 人可排班），本部门不参与排班"
      : "「" + domLabel(dom) + "」至少需要 2 名非经理人员才能排班");
    return;
  }

  const keys = [];
  for(let i = 0; i < weeks; i++){
    const d = new Date(currentMonday); d.setDate(d.getDate() + i * 7);
    keys.push(weekKeyOf(d));
  }
  /* 快照：任何一周出问题就整体还原 */
  const bak = JSON.stringify({
    schedule: state.schedule, roles: state.roles,
    roleSig: state.roleSig, manual: state.manual
  });

  BATCH.on = true; BATCH.quiet = true;
  const origin = new Date(currentMonday);
  let lastPrev = null;
  const done = [];

  try{
    for(let i = 0; i < keys.length; i++){
      currentMonday = new Date(origin);
      currentMonday.setDate(currentMonday.getDate() + i * 7);

      if(i > 0 && lastPrev){
        /* 把上周班表错开一天铺成「初稿」，算法只补缺口、不动已有格子，
           休息日因此自然错开，比每周从零开始更公平。 */
        const wk = ensureWeek(keys[i]);
        state.staff.forEach(n=>{
          const src = lastPrev[n];
          if(src) wk[n] = [src[6], src[0], src[1], src[2], src[3], src[4], src[5]];
        });
      }
      /* 暂时摘掉「固定上班日」，避免重新播种覆盖刚铺好的初稿 */
      const must = state.mustWork;
      state.mustWork = [];

      autoSchedule(dom, opts);

      state.mustWork = must;
      const w = state.schedule[keys[i]];
      if(w) lastPrev = JSON.parse(JSON.stringify(w));
      done.push(keys[i]);
    }
  } catch(err){
    const b = JSON.parse(bak);
    state.schedule = b.schedule; state.roles = b.roles;
    state.roleSig = b.roleSig;   state.manual = b.manual;
    currentMonday = origin;
    BATCH.on = false; BATCH.quiet = false;
    save(); renderAll();
    toast("批量排班出错，已全部还原：" + (err && err.message ? err.message : err));
    return;
  }

  currentMonday = origin;
  BATCH.on = false; BATCH.quiet = false;
  save(); renderAll();

  let filled = 0;
  done.forEach(k=>{
    const w = state.schedule[k]; if(!w) return;
    state.staff.forEach(n=>{
      (w[n]||[]).forEach(v=>{ if(v && v !== "rest") filled++; });
    });
  });
  toast("已排好 " + done.length + " 周（" + fmtCN(origin) + " 起），共 " +
        filled + " 个" + (hasFixed ? "固定班" : "班次") + "。切到下一周即可查看");
}
function autoSchedule(dom, opts){
  dom = dom || curDomain();
  /* ---- 质量档位（算法文档 N1 / N2）----
     页面上的「一键智能排班」走默认档（fast）：攒够 MIN_POOL 且遇到合格解就收工，
     保证点一下就有响应。云端 / 批量生成走 quality 档：
       · N1 预算用满 —— 不再「合格就早退」，让候选池一直涨到时间预算用尽，
         最后取 planScore 最优的那个（把「合格」与「选优」彻底解耦）；
       · N2 局部搜索 —— 对选中的班表再跑一轮「评分不降」的爬山，
         用现成的邻域动作（早班均衡 / 晚班均衡 / 上一休一对调）把均衡度再压一压。
     不传 opts 时行为与改造前**逐字节一致**（fast + 1600ms + 不爬山），
     这是「页面按钮不受影响」的保证，也是差分测试的基线。 */
  opts = opts || {};
  const fillBudget = !!opts.fillBudget;
  const budgetMs = (opts.budgetMs === undefined || opts.budgetMs === null)
    ? (fillBudget ? 2000 : 1600) : Math.max(0, +opts.budgetMs || 0);
  const climbMs = (opts.climbMs === undefined || opts.climbMs === null)
    ? (fillBudget ? 1000 : 0) : Math.max(0, +opts.climbMs || 0);
  /* 「行政」有固定班表（fixedRoster）—— 周表写死即可，不需要算法参与，
     所以即使可排班人数不足 2 也要放行，否则固定班表永远落不了地。
     「库房」没有固定班表且全员免排，仍按人数不足拦住。 */
  const hasFixed = !!fixedRosterOf(dom);
  if(domainSchedulable(dom).length < 2 && !hasFixed){
    /* 这里要说清楚「为什么排不了」，否则用户看到「至少需要 2 人」会以为是 bug。 */
    const all = domainStaff(dom).length;
    const sc  = domainSchedulable(dom).length;
    toast(all > 0
      ? `「${domLabel(dom)}」共 ${all} 人，但全部免排（${sc} 人可排班），本部门不参与排班`
      : `「${domLabel(dom)}」至少需要 2 名非经理人员才能排班`);
    return;
  }
  const allStaff = state.staff.slice();

  /* ---- 纯固定班表部门：直接写盘，跳过算法 ----
     行政这类部门的人的周表是写死的，跑贪心毫无意义，还会弹出
     「覆盖 10/23 个班次」「开店闭店还缺 21 人次」这类**必然发生**的警告 ——
     需求表是按「算法排班」的口径设的，而这些人根本不走算法。
     所以：先把固定班表写进 state.schedule，再正常退出。
     请假仍然优先（applyFixedRoster 内部会跳过 off 的格子）。 */
  if(hasFixed){
    const kFix = curKey();
    const weekFix = ensureWeek(kFix);
    const RFix = buildRules(kFix, dom);
    const nFix = applyFixedRoster(weekFix, RFix, dom);
    save();
    renderAll();
    toast(nFix ? `「${domLabel(dom)}」已按固定班表排好${nFix ? "（含请假优先处理）" : ""}`
               : `「${domLabel(dom)}」已是固定班表，无变化`);
    return;
  }

  // 换到本领域的需求 / 规则。**必须在 save() 之前还原**，否则会把鸿蒙智行的数字写进 3C 存档。
  const bakNeeds = state.needs, bakLimits = state.limits, bakRest = state.restMax, bakDom = state.domain;
  state.domain = dom;            // 内部 helper 走 curDomain()，必须先切到目标领域，否则拿到另一个领域的规则表
  state.needs = domNeeds(dom);
  state.limits = domLimits(dom);
  state.restMax = domRestMax(dom);
  const restoreDomain = ()=>{ state.staff = allStaff; state.needs = bakNeeds; state.limits = bakLimits; state.restMax = bakRest; state.domain = bakDom; };
  try{
  /* 固定班表的人**不能进算法的人力池**：他们的班次是写死的，不参与分配。
     混进去会让算法以为多了几个可用人力，算出「排不满」的班表。 */
  const fixedAll = allFixedRosterNames();
  state.staff = allStaff.filter(n=> inDomain(n, dom) && !blockedInDomain(n, dom) && fixedAll.indexOf(n)<0);
  const k = curKey();
  const S = ["early","mid","night"];
  const N = state.staff.length;
  const totalDemand = state.needs.reduce((s,d)=>s + (+d.early||0)+(+d.mid||0)+(+d.night||0), 0);
  // 可用人力 = 人数 × 每人每周上班天数（跟随「休息配额」设置，改了休几天这里要跟着变）
  // 休息配额现在是区间 [min, per]：产能按**下界 min** 算（休得最多的人也能上几天），
  // 上界 per 只用来约束「不能休超」，两者不能混用，否则区间配额下会算错产能。
  const rrCfg = restRange();
  const restPerCfg = rrCfg.per, restMinCfg = rrCfg.min;
  const workDaysPerPerson = Math.max(0, 7 - restMinCfg);   // 每人最多能上几天班
  const capacity = N * workDaysPerPerson;

  // 需求量：[{day, shift, need}] 展开为槽位
  const slots = [];
  state.needs.forEach((d,di)=>{
    S.forEach(sh=>{
      for(let i=0;i<(+d[sh]||0);i++) slots.push({day:di, shift:sh});
    });
  });

  if(totalDemand > capacity){
    if(!confirm(`当前需求共 ${totalDemand} 人次，但 ${N} 人 × 每周 ${workDaysPerPerson} 个工作日 = ${capacity} 人次。\n若继续，将无法同时满足「每人恰好休 ${restPerCfg} 天」和「班次全覆盖」。\n点击“确定”仍要排班（部分班次会缺人），或取消后增加人数/降低需求。`)) return;
  }
  // 检查班次上限是否导致最低需求都排不下：某班需求 > N × 该班上限
  const baseCnt = {early:0, mid:0, night:0};
  slots.forEach(s=>baseCnt[s.shift]++);
  const badShift = S.filter(sh=> baseCnt[sh] > N * (state.limits[sh]||99));
  if(badShift.length){
    const names = {early:"早班", mid:"中班", night:"晚班"};
    const detail = badShift.map(sh=>`${names[sh]}最低需求 ${baseCnt[sh]} 人次，但 ${N} 人 × 上限 ${state.limits[sh]} = ${N*state.limits[sh]} 人次，上限卡死无法覆盖`).join("\n");
    if(!confirm(detail + "\n\n点击“确定”仍要排班（该班次会缺人），或取消后放宽上限/增加人数。")) return;
  }

  /* ---- 下面两条是「列问题」而不是「改规则」：配置你说了算，我只负责把后果讲清楚 ---- */

  // 全队休息上限低于物理下限：就算每个人都休满 restPer 天，总数也超。
  // 实测这一项会让每次排班都报「全队休息 62 > 上限 50」，属于配置自相矛盾，不是算法问题。
  const restCap = restTotalCap();
  const restFloor = N * restPerCfg;
  if(restCap < restFloor){
    if(!confirm(`全队休息上限 ${restCap} 人日，但 ${N} 人 × 每人休 ${restPerCfg} 天 = ${restFloor} 人日。\n即使每个人都休满，总数也会超上限 —— 这两条规则互相矛盾。\n点击“确定”仍要排班（必然超限），或取消后调高上限 / 降低每人休息天数。`)) return;
  }

  // 班次上限「卡得住但余量很小」：数学上可行，但排法几乎没有回旋余地，
  // 随机贪心很难命中，实测「31 人 + 早班上限 2」（62 产能 vs 58 需求，余量 6%）
  // 会出现早班缺人 / 上一休一。不算错误，但得提前告诉你别当成算法坏了。
  const tightShift = S.filter(sh=>{
    const cap = N * (state.limits[sh] || 99);
    return baseCnt[sh] <= cap && cap > 0 && baseCnt[sh] > cap * 0.9;
  });
  if(tightShift.length){
    const names2 = {early:"早班", mid:"中班", night:"晚班"};
    const detail = tightShift.map(sh=>{
      const cap = N * state.limits[sh];
      const pct = Math.round(baseCnt[sh] / cap * 100);
      return `${names2[sh]}需求 ${baseCnt[sh]} 人次，全队产能 ${N} × ${state.limits[sh]} = ${cap} 人次（已用 ${pct}%）`;
    }).join("\n");
    if(!confirm(detail + "\n\n余量不足 10%，排班几乎无法回旋，很可能出现缺人或“上一休一”。\n建议放宽该班次上限。点击“确定”仍要排班。")) return;
  }

  // 每人恰好休 2 天（上满 5 天）：人力若有富余，多出的人次补到「至少」类班次
  // 补位策略：优先补上限容量富余比例大的班次；每天补到当天班次最少的日子，保持均衡
  // 标注为「人数固定」的班次（exactShifts，默认早班）不参与分摊，以保证其人数恰好等于需求
  const minDemand = slots.length;
  // 真实需求（不含下面补进去的富余人力槽位）。「班次是否排满」只认这些：
  // 富余人力排不排得掉是弹性目标，若把它算进缺口，就会因为「缺口优先」压过分组保障这类硬规则。
  const demandNeed = {};
  slots.forEach(s=>{ const kk = s.day+"|"+s.shift; demandNeed[kk] = (demandNeed[kk]||0) + 1; });
  const demandKeys = Object.keys(demandNeed);
  let extra = capacity - minDemand;
  if(extra > 0){
    const cur = {early:0, mid:0, night:0};
    const dayCnt = new Array(7).fill(0);
    slots.forEach(s=>{ cur[s.shift]++; dayCnt[s.day]++; });
    const exact = Array.isArray(state.exactShifts) ? state.exactShifts : [];
    const flex = ["early","night"].filter(sh => !exact.includes(sh));
    let guard = 0;
    while(extra > 0 && guard < 500){
      guard++;
      let pickSh = null, bestRoom = -Infinity;
      flex.forEach(sh=>{
        const cap = N * (state.limits[sh]||99);
        if(cur[sh] >= cap) return;
        const room = (cap - cur[sh]) / cap;
        if(room > bestRoom){ bestRoom = room; pickSh = sh; }
      });
      if(!pickSh) break; // 各班上限已满，富余人力无处可补（会出现空班）
      const day = dayCnt.indexOf(Math.min(...dayCnt));
      slots.push({day, shift:pickSh});
      cur[pickSh]++; dayCnt[day]++; extra--;
    }
  }

  // 本周生效的请假 / 改班规则（按 staff 顺序转成数组，便于算法使用）
  const RByName = buildRules(k);
  const R = state.staff.map(n=>RByName[n]);
  const actReqs = activeRequests(k);

  // 尝试多次随机贪心，取最优。
  // MIN_POOL：提前退出前至少要评估的候选数。
  // 实测（31 人）：早/晚班次数标准差在 20 / 40 / 80 个候选下分别约 0.71 / 0.75 / 0.73、0.88 / 0.86 / 0.86
  //   —— 说明班次均衡度是贪心本身的结构性上限，多跑也压不下去；
  //   真正随池子收敛的是「连休对数」：1.2 → 0.4 → 0.3 对/周（设计上要求休息日尽量不连续）。
  // 取 40：连休基本收敛到 0.4 对（改这批修复前单次排班约 0.45 秒）。
  // 但加入三条新规则（区间配额 / 禁3连休 / 模块在岗）后，tryPlan 每次要多跑一遍
  // 休息日的两阶段分配 + 4 条硬约束判定，单次从约 1ms 涨到约 5ms，
  // 40 个候选就把单次排班推到 2 秒以上、整轮四个领域 4.5 秒 —— 点一次要干等，不能接受。
  // 取 40 与 deadline 1600ms 是三档实测的折中：
  //   40 / 2500ms / 重试12次600ms → 2580ms，违规 0/0/0/0
  //   40 / 1600ms / 重试10次450ms → 2189ms，违规 en 3 / mod 0（提速 15%，模块保持 0）
  //   24 /  900ms / 重试 6次250ms → 1928ms，违规 en 3 / mod 3（再快也没多修好，反而多坏了模块）
  // 剩下那 0.8% 的专家组缺口的形态（周三/周五/周一 缺早班）与池子大小无关 ——
  // 路径5 的单级严格守恒对调覆盖不到「让位点与阻碍点不重合」的情形（见函数内注释），
  // 再加候选也换不出来，所以这里按性能优先取折中值。
  const MIN_POOL = 40;

  let best = null, bestScore = -Infinity;
  // 候选方案留档：最优方案若在「后处理 + 收尾修复」后仍违反硬规则（修复器互相顶死），
  // 就换次优候选重试 —— 见下方 materialize / hardOK。
  const allPlans = [];
  let bestBad = Infinity, bestGap = Infinity;   // 当前最优方案的「硬约束违约数 / 缺班数」
  let bestShort = Infinity;                     // 当前最优方案「少上了几天班」的总数（应趋近 0）
  let bestRuleBad = Infinity;                   // 当前最优方案「请假 / 改班被违反」的格子数（必须 0）
  // 耗时上限：正常配置几十次候选就收敛（约 0.4 秒），但「人力根本不够」这类不可行配置
  // 永远找不到合格解，会把 300 次候选跑满 —— 实测「31 人 + 每人休 3 天」要 9.7 秒，用户会以为卡死。
  // 所以给一个硬上限：过了下限候选数之后，一旦超时就带着当前最优解收工。
  /* 贪心池的死线。2500ms 是「没有新规则时」定的（那时 tryPlan 一次约 1ms，40 个候选也跑不满）。
     加入三条新规则后 tryPlan 一次要 5ms，40 个候选 ≈ 200ms 纯贪心 + 收尾修复与重试叠加，
     实测单领域排班会到 4.5 秒 —— 点一次按钮干等十几秒，不可接受。
     收到 900ms：单领域最坏 0.9 秒、四个领域最坏约 3.6 秒，且 MIN_POOL=24 之下
     绝大多数配置会在 300~500ms 就跑满池子提前退出，实际上很少触到这条线。 */
  const deadline = Date.now() + budgetMs;
  /* 收工口径分两档（算法文档 N1「时间预算用满」）：
     · fast（页面「一键智能排班」）—— 攒够 MIN_POOL 后遇到合格解就走，点了马上有反应；
     · quality（云端生成 / 批量）—— 不早退，一直跑到预算用尽，再从全部候选里挑最优。
       这样做是把「合格」与「选优」解耦：合格只代表不违规，质量还得靠在更多候选里比。
     候选上限跟着档位走：fast 300 次（历史值，够用且不会卡）；quality 放宽到 1200，
     真正约束它的是时间预算，次数上限只作为「预算极大时也不会失控」的保险。 */
  const MAX_ATTEMPTS = fillBudget ? 1200 : 300;
  for(let attempt=0; attempt<MAX_ATTEMPTS; attempt++){
    const plan = tryPlan(slots, N, R);
    if(plan){
      // 先把富余人力吸收掉再评分：少上一天班的人界面上那天就是休息日，
      // 多出来的休息日既破坏「每人恰好休 N 天」，又常常自带「上一休一」。
      // 补完再评，选优看到的班表才等于最终写进界面的班表。
      absorbPlan(plan, R);
      const score = planScore(plan);
      // 缺口 = 真实需求里没排上的班次数（富余人力槽位不算缺口）
      const haveNow = {};
      plan.assign.forEach(a=> a.forEach(x=>{ const kk = x.day+"|"+x.shift; haveNow[kk] = (haveNow[kk]||0) + 1; }));
      let gapNow = 0;
      demandKeys.forEach(kk=>{ gapNow += Math.max(0, demandNeed[kk] - (haveNow[kk]||0)); });
      // 硬约束层（字典序第三位）：孤立休息日 + 分组保障 + 3 连休 + 模块在岗 + 休息下界
      const badNow = planIsoRest(plan) + planGroupViol(plan)
                    + planRun3Rest(plan, R) + planModuleViol(plan)
                    + planRestFloorViol(plan, R);
      // 富余人力没排出去 → 有人上不满 workDaysPerPerson 天（会多休）。
      // 这是强偏好而不是硬约束：宁可有人多休一天，也不能让分组保障这种硬规则被牺牲掉。
      const shortNow = plan.assign.reduce((s,a)=> s + Math.max(0, workDaysPerPerson - a.length), 0);   // 上界口径：低于 7-min 的算少上了
      // 请假 / 改班违约数（含「固定上班日」）。必须进排名，不能只当退出开关，
      // 否则一个「该上班的人被排了休」的方案只要评分更高就会被选成最优。
      const ruleBadNow = planRuleViol(plan, R);
      // 选优是字典序的：缺班 → 请假/改班违约 → 硬约束违约 → 少上班天数 → 均衡度。
      // 顺序不能乱：早期版本把「富余人力也要塞满」排在硬约束前面，
      // 结果「班次全填满但有 1 条分组违约」的方案会挤掉「分组全对、富余人力空 1 格」的方案。
      const better = !best
        || gapNow < bestGap
        || (gapNow === bestGap && ruleBadNow < bestRuleBad)
        || (gapNow === bestGap && ruleBadNow === bestRuleBad && badNow < bestBad)
        || (gapNow === bestGap && ruleBadNow === bestRuleBad && badNow === bestBad && shortNow < bestShort)
        || (gapNow === bestGap && ruleBadNow === bestRuleBad && badNow === bestBad && shortNow === bestShort && score > bestScore);
      if(better){ bestScore = score; best = plan; bestGap = gapNow; bestBad = badNow; bestShort = shortNow; bestRuleBad = ruleBadNow; }
      // 只留「缺班 / 请假违约 / 硬约束都干净」的候选，避免拿一个满身违规的方案去试。
      // 留 24 个而不是 8：贪心通常在 40 次就早退，候选不够多样时重试也换不出花样。
      // 留 24 个（不是 40）：实测把池子扩到 40 会让 tryPlan 慢近一倍，
      // 而重试机制前 8~12 次里就能换到合规表，收益递减。性能优先。
      if(gapNow === 0 && ruleBadNow === 0 && badNow === 0 && allPlans.length < 40) allPlans.push(plan);
      // 每人上班天数落在 [7-per, 7-min] 区间内即可（区间配额下不再要求人人一样多）
      const wdLo = Math.max(0, 7 - restPerCfg), wdHi = Math.max(0, 7 - restMinCfg);
      const wd5 = plan.assign.every(a=> a.length>=wdLo && a.length<=wdHi);
      const noNE = !plan.assign.some(a=>{
        const ds={}; a.forEach(x=>ds[x.day]=x.shift);
        for(let d=0;d<7;d++) if(ds[d]==="night" && ds[(d+1)%7]==="early") return true;
        return false;
      });
      // 请假 / 改班规则是否全部满足
      const rulesOK = ruleBadNow === 0;
      // 完美解提前退出：班次填满 + 每人 5 天 + 无晚接早 + 规则全满足
      // + 孤立休息日（上一休一）为 0 + 分组保障（早晚保障组 / 开店闭店组 / 周末早班上限）全部达标
      // 但必须先攒够 MIN_POOL 个候选：合格只代表「不违规」，均衡度还要靠在多个合格方案里比评分。
      // 少了这一句，第一个合格方案（常常是第 1 个）就收工，早/晚班分配会明显忽多忽少。
      // quality 档（fillBudget）不认这两条早退：合格就退等于把候选池锁死在「第一个合格解」，
      // 而 N1 要的正是「继续跑到预算用尽再比评分」。
      if(!fillBudget && attempt >= MIN_POOL && gapNow === 0 && wd5 && noNE && rulesOK && badNow === 0) break;
      // 已选出的最优方案已经「不缺班 + 分组保障全达标 + 无上一休一 + 全员上满天数」就收工，不必跑满 300 次
      if(!fillBudget && attempt >= MIN_POOL + 25 && bestGap === 0 && bestBad === 0 && bestShort === 0) break;
      /* 兜底收工：不可行配置（人力不够等）永远等不到上面那两行，用耗时上限收工，别让用户干等。
         fast 档要攒够 MIN_POOL 才认这条（否则开局几个候选就超时退出，池子太浅）；
         quality 档按预算收工 —— 这就是它唯一的出口。 */
      if(Date.now() > deadline && (fillBudget || attempt >= MIN_POOL)) break;
    }
  }
  if(!best){
    toast("未能生成可行方案，请检查人数与需求是否匹配");
    return;
  }

  /* 把选出的方案落成最终班表，并跑完所有后处理与收尾修复。
     独立成函数是为了让外层能「重选优再试一次」—— 见下方重试循环。 */
  const materialize = (plan)=>{
    const w = {};
    state.staff.forEach(n=>{ w[n] = ["rest","rest","rest","rest","rest","rest","rest"]; });
    state.staff.forEach((n,si)=>{
      plan.assign[si].forEach(a=>{ w[n][a.day] = a.shift; });
    });
    // 经理 / 免排人员保持空白（不安排早/中/晚班）
    allStaff.forEach(n=>{ if(isBlockedFromSchedule(n)) w[n] = ["","","","","","",""]; });
    // 早班次数均衡（注入）：把排得多的匀给排得少的，只做两人同天互换，人数/配额/覆盖不变
    balanceShifts(w, RByName, k);
    // 保险：对贪心残留的缺口做局部补位（严格遵守请假/改班规则，且不动用休息日）
    fillGaps(w, RByName, false);
    // 补满勤：把没排掉的富余人力吸收进中班 / 晚班
    absorbSurplus(w, RByName);
    balanceShifts(w, RByName, k);
    balanceNightShifts(w, RByName, k);
    // 富余人力吸收之后残留的「上一休一」，用「两人互换休息日」修掉
    fixIsolatedRest(w, RByName);
    /* 统一收尾循环：反复跑各修复器，直到「一整轮下来一个格子都没改动」为止。
       为什么必须是循环而不是一次性顺序调用（踩过的坑）：
       这些修复器会互相破坏对方的成果 —— fixRestRange 把休息日改成上班，会给
       别人造出新的孤立休息或 3 连休；fixIsolatedRest 对调休息日，又可能造出新的 3 连休。
       固定顺序调用时仍有约 1/5 的排班残留违规。MAX_REPAIR 是防死循环的保险：
       每轮必须至少有一个格子真的改动，否则退出。 */
    const MAX_REPAIR = 12;
    for(let pass=0; pass<MAX_REPAIR; pass++){
      const before = JSON.stringify(w);
      fixRun3Rest(w, RByName);        // 3 天连休
      fixModuleAllOff(w, RByName);     // 模块全员休息
      fixGroupGuarantee(w, RByName);   // 专家老师组：每天 1 早 + 1 晚
      fixIsolatedRest(w, RByName);     // 上一休一
      fixRestRange(w, RByName);        // 休息天数回到 [min, per] 区间
      if(JSON.stringify(w) === before) break;   // 本轮无改动 → 已收敛
    }
    return w;
  };
  /* 这张班表是否满足全部硬规则？优先级从高到低：
       ① 专家老师组每天 1 早 + 1 晚    ← 用户明确要求，最高
       ② 模块每天至少 N 人在岗          ← 用户明确要求
       ③ 禁 3 天连休（可 2 连休/单休）  ← 用户明确要求
       ④ 每人休息天数在 [min, per]      ← 配额目标，冲突时让位给 ①②③
     修复器是启发式的，少数情况下修不动（互相顶死）。那就换一个候选方案重试 ——
     比死磕同一张表可靠得多。
     早前这里只查 ①②③，把 ④ 交给 fixRestRange 不再重复查 ——
     但这样「换候选」的重试机制会选进一张区间越界的表（区间根本没进判定标准）。
     纳入判定后，重试自然优先挑四条都达标的候选；④ 的权重最低，
     即使某候选只在 ④ 上差一点，也不会挤掉 ①②③ 全对的表（因为是「全部满足」才 ok）。 */
  const hardOK = (w)=>{
    let ok = true;
    // 3 连休（请假日钉死的除外）
    state.staff.forEach(n=>{
      if(run3RestCount(weekRestSet(w, n)) > 0){
        const rs = weekRestSet(w, n);
        let allForced = rs.size > 0;
        rs.forEach(d=>{ const c = RByName[n] && RByName[n][d]; if(!(c && c.off)) allForced = false; });
        if(!allForced) ok = false;
      }
    });
    // 模块在岗下限
    const mn = moduleMinOn();
    if(mn > 0){
      const byMod = {};
      state.staff.forEach(n=>{ const m = getStaffProfile(n).module; (byMod[m]=byMod[m]||[]).push(n); });
      Object.keys(byMod).forEach(m=>{
        if(moduleMinOnExempt(m)) return;      // 排除名单（见 moduleMinOnExempt）
        if(byMod[m].length <= mn) return;
        for(let d=0; d<7; d++){
          const on = byMod[m].filter(x=>{ const v=w[x][d]; return v==="early"||v==="mid"||v==="night"; }).length;
          if(on < mn) ok = false;
        }
      });
    }
    // 专家老师组：每天 1 早 + 1 晚
    const enMem = schedulableGroupMembers("earlyNight");
    const gEn = state.groups && state.groups.earlyNight;
    if(enMem.length && gEn && (gEn.minEarly > 0 || gEn.minNight > 0)){
      for(let d=0; d<7; d++){
        if(gEn.minEarly > 0 && enMem.filter(n=> w[n][d]==="early").length < gEn.minEarly) ok = false;
        if(gEn.minNight > 0 && enMem.filter(n=> w[n][d]==="night").length < gEn.minNight) ok = false;
      }
    }
    // 每人休息天数落在 [min, per]（完全由请假日造成时不算违规：请假优先于配额）
    const rrHard = restRange();
    state.staff.forEach(n=>{
      const c = weekRestSet(w, n).size;
      if(c >= rrHard.min && c <= rrHard.per) return;
      let allOff = c > 0;
      weekRestSet(w, n).forEach(d=>{ const rc = RByName[n] && RByName[n][d]; if(!(rc && rc.off)) allOff = false; });
      if(!allOff) ok = false;
    });
    return ok;
  };

  // 先按最优方案落表；不满足硬规则就换一个次优候选重试（最多 4 次）。
  // 每次重试用的是「已生成但未被选为最优」的候选，不重新跑贪心，成本很低。
  // best 排在最前（本来就是最优），其余候选按生成顺序作为备选
  const cands = [best].concat(allPlans.filter(x=> x !== best));
  let w = materialize(best);
  if(fillBudget){
    /* quality 档：不只落一张表，而是把候选池里最靠前的若干张都落成班表，再按
       **最终班表**的选优口径挑最好的那张。为什么必须这么做：
       贪心用的 planScore 是在「plan」上算的近似分 —— 落表还要过
       fillGaps / absorbSurplus / 一串修复器，plan 上的第一名未必是最终班表的第一名
       （实测有种子会翻盘）。用近似分选优 = 用有噪声的尺子量身高，
       种子一换结果就飘；换成最终口径选，输出才对同一份配置稳定。
       代价：materialize 单次约 50ms，所以只验最靠前的 8 张（够用且可控）。 */
    const VERIFY_K = 8;
    const tVerify = Date.now();
    let bw = null, bg = null, bh = false;
    for(let i = 0; i < cands.length && i < VERIFY_K; i++){
      const w2 = materialize(cands[i]);
      const okHard = hardOK(w2);
      const g = weekGrade(w2, RByName, demandNeed, demandKeys, workDaysPerPerson);
      const better2 = !bw || (okHard && !bh) || (okHard === bh && gradeCmp(g, bg) < 0);
      if(better2){ bw = w2; bg = g; bh = okHard; }
      if(Date.now() - tVerify > climbMs) break;   // 落表验证与爬山共用同一笔收尾预算
    }
    w = bw;
  } else if(!hardOK(w)){
    /* 最优方案不达标就换次优候选重试。两个约束缺一不可：
         · 次数上限 12 —— 实测绝大多数情况下第一次就过，重试是罕见路径
         · 时间预算 600ms —— materialize 单次约 15~25ms，无脑试完 40 个候选
           会让「点一次自动排班」等上好几秒（实测四个领域合计 4.5s），交互不可接受
       两者任一触顶就用手上的结果（已尽力，比硬等好）。
       预算实测校准：一次 materialize ≈ 50ms（主要是 balanceShifts 跑两遍）。
       收到 450ms / 10 次：把「换候选」的开销压在半秒内，且实测违规率与
       600ms / 12 次完全一致（那 0.8% 不是候选不够，是路径5 覆盖不到，见上方说明）。 */
    const RETRY_MAX = 10, RETRY_BUDGET_MS = 450;
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    for(let i=1; i<cands.length && i<=RETRY_MAX; i++){
      const w2 = materialize(cands[i]);
      if(hardOK(w2)){ w = w2; break; }
      const el = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0;
      if(el > RETRY_BUDGET_MS) break;
    }
  }
  /* ---- N2 局部搜索（爬山）----
     贪心 + 收尾修复给的是一个「随机路径上的可行解」，路径本身没被优化过。
     这里在它周围做一次爬山：邻域动作用现成的三个修复器（它们本来就是
     「只在更均衡时才真的改格子」的确定性操作，见各自函数注释）：
       · balanceShifts       —— 早班次数在两人之间对调（连带看间隔节奏）
       · balanceNightShifts  —— 晚班一侧同样对调（只平早班会让晚班越来越散）
       · fixIsolatedRest     —— 对调休息日，消掉「上一休一」
     接受准则：用**同一个选优口径**（缺班 → 请假违约 → 硬约束 → 少上班天数 → 评分）
     比大小，必须严格变好才接受 —— 于是「评分不降」天然成立（末位就是评分），
     而且严格变好保证了爬山一定会停，不会在等价解之间来回打转。
     只在 quality 档跑：fast 档的目标是「点一下马上有反应」，多这几百毫秒不值。 */
  if(fillBudget && climbMs > 0){
    const tClimb = Date.now();
    let curKeyGrade = weekGrade(w, RByName, demandNeed, demandKeys, workDaysPerPerson);
    for(let round=0; round<8; round++){
      if(Date.now() - tClimb > climbMs) break;
      let improved = false;
      for(const move of CLIMB_MOVES){
        if(Date.now() - tClimb > climbMs) break;
        const cand = cloneWeek(w);
        move(cand, RByName, k);
        if(sameWeek(cand, w)) continue;                       // 这一手没改动任何格子，跳过
        const g = weekGrade(cand, RByName, demandNeed, demandKeys, workDaysPerPerson);
        if(gradeCmp(g, curKeyGrade) < 0){                     // 严格更优才接受
          w = cand; curKeyGrade = g; improved = true;
        }
      }
      if(!improved) break;                                    // 一整轮都没有改善 → 已到局部最优
    }
  }
  /* 固定班表在最后落地：算法排完、收尾修复也跑完了，此刻写死才算真的「不被算法影响」。
     必须放在 restoreDomain() 之前 —— 之后 state.domain 已还原，RByName 也不再对应本领域。 */
  /* 固定班表在最后落地：算法排完、收尾修复也跑完了，此刻写死才算真的「不被算法影响」。
     必须放在 restoreDomain() 之前 —— 之后 state.domain 已还原，RByName 也不再对应本领域。 */
  applyFixedRoster(w, RByName, dom);
  restoreDomain();
  // 合并而非整周覆盖：另一个领域（3C / 鸿蒙智行）的班表必须原样保留
  state.schedule[k] = Object.assign({}, state.schedule[k], w);
  // 整周重排后，旧的手工改动标记全部失效 —— 但只清「本领域」的，另一个领域的不能连坐
  if(state.manual && state.manual[k]){
    const keep = {};
    Object.keys(state.manual[k]).forEach(key=>{
      const who = String(key).split("|")[0];
      if(!inDomain(who, dom)) keep[key] = state.manual[k][key];
    });
    if(Object.keys(keep).length) state.manual[k] = keep; else delete state.manual[k];
  }
  /* 开店 / 闭店角色只对「3C顾问」「售后」有意义，守卫已内置在 assignRoles 里，
     这里不必再判一次（重复判断容易和函数里的白名单走偏）。 */
  const roleInfo = assignRoles(k);
  save(); renderAll();
  // 统计最终覆盖情况（含补位后的结果）——只统计真实需求，富余人力没排满不算缺口
  const haveC = {};
  domainStaff(dom).forEach(n=>{
    const row = w[n]; if(!row) return;
    for(let d=0; d<7; d++){
      const v = row[d];
      if(v==="early"||v==="mid"||v==="night"){ const kk = d+"|"+v; haveC[kk] = (haveC[kk]||0)+1; }
    }
  });
  let remain = 0;
  demandKeys.forEach(kk=>{ remain += Math.max(0, demandNeed[kk] - (haveC[kk]||0)); });
  const filled = minDemand - remain;
  const domRR = (function(){ const r = domRestMax(dom); const per = Math.min(7,Math.max(0,+r.per||0));
    const mn = Math.min(per, Math.max(0, r.min===undefined||r.min===null||r.min==="" ? per : (+r.min||0)));
    return {min:mn, per}; })();
  const restRangeTxt = (domRR.min === domRR.per) ? `恰好休 ${domRR.per} 天` : `休 ${domRR.min}~${domRR.per} 天`;
  let msg = remain === 0
    ? `✅ 排班完成：${filled} 个班次全覆盖，每人${restRangeTxt}，晚班后不接早班，休息日错开不扎堆`
    : `⚠️ 排班完成：覆盖 ${filled}/${minDemand} 个班次（人数不足，无法保证每人${restRangeTxt}）`;
  if(roleInfo.members){
    const rc = Object.values(roleInfo.cnt);
    const rMax = rc.length ? Math.max(...rc) : 0, rMin = rc.length ? Math.min(...rc) : 0;
    msg += roleInfo.short
      ? ` ｜ ⚠️ 开店闭店还缺 ${roleInfo.short} 人次（当天该组没人上对应班次）`
      : ` ｜ 🏪 开店闭店 ${rMin}~${rMax} 次/人（上限 ${roleInfo.maxPer}）`;
  }
  if(actReqs.length){
    const bad = checkRuleViolations(w, RByName);
    msg = bad.length
      ? `${msg} ｜ ⚠️ 有 ${bad.length} 条请假/改班未能满足（如 ${bad[0]}）`
      : `${msg} ｜ ✅ ${actReqs.length} 条请假/改班安排全部满足`;
  }
  toast(msg + "，可点击格子微调");
  } finally { restoreDomain(); }
}
function tryPlan(slots, N, R){
  // R: 每位员工按天的规则表（请假 / 固定班 / 禁排班），R[i][day] = {off,noOff,only,ban}
  const hasR = !!R;
  const ruleOK = (i, day, sh)=>{
    if(!hasR) return true;
    const c = R[i][day];
    if(c.off) return false;                       // 请假：该天不排任何班
    if(c.only && c.only !== sh) return false;     // 固定班：只能排该班
    if(c.ban[sh]) return false;                   // 禁排：不能排该班
    return true;
  };
  // assign[staffIdx] = [{day,shift}]
  const assign = Array.from({length:N},()=>[]);
  const workDays = new Array(N).fill(0);

  // ===== 第一步：分配休息日 =====
  // 规则：每人恰好休 restPer 天；同一人 restPer 个休息日不连续；
  //      每天休息人数 = 总人数 - 当天班次需求（精确配额，保证每人恰好休 restPer 天时班次能全部排满）
  // 休息配额提前取出：每人最多 restPer 天，全队总人日不超过 restCap。
  // 注意这里的「目标休息总数」必须是 restPer×N 而不是写死的 2×N，
  // 否则把「每人每周休几天」调成 3 之后，配额仍按休 2 天分配，休息日会分布不均。
  // 休息配额区间 [restMin, restPer]：每人至少休 restMin 天、最多休 restPer 天。
  // restMin === restPer 时退化成原来的「恰好休 restPer 天」；min < per 时，
  // 总量目标取区间中点（N×(min+per)/2），让一部分人休 min 天、一部分人休 per 天。
  const rrP = restRange();
  const restPer = rrP.per, restMin = rrP.min;
  const restCap = restTotalCap();
  const restLo = restMin * N, restHi = restPer * N;
  // 总量目标取**上界** restHi：先让 dayTarget 排满，阶段一保底发 min 天，阶段二再逐轮加到 per。
  // 若这里取区间中点，dayTarget 会提前用完，阶段二就没余量，结果全队被压在下界 min 上。
  const restGoal = Math.max(restLo, Math.min(restHi, restHi));
  const slotsPerDay = new Array(7).fill(0);
  slots.forEach(s=>slotsPerDay[s.day]++);
  let dayTarget = slotsPerDay.map(c=>N-c); // 每天期望休息人数
  let tsum = dayTarget.reduce((a,b)=>a+b,0);
  while(tsum > restGoal){ // 需求太少：总休息配额超过目标，压缩（多余槽位由上层补足）
    const i = dayTarget.indexOf(Math.max(...dayTarget));
    if(dayTarget[i] <= 0) break;
    dayTarget[i]--; tsum--;
  }
  while(tsum < restGoal){ // 需求太多：仍保证每人至少休 restMin 天，部分班次将缺人
    const i = dayTarget.indexOf(Math.min(...dayTarget));
    dayTarget[i]++; tsum++;
  }
  dayTarget = dayTarget.map(x=>Math.max(0,x));

  const restDays = Array.from({length:N},()=>new Set());
  const dayRest = new Array(7).fill(0);
  // 每周最多上班天数 = 7 − 休息天数。下面所有「≥5 天」「>2 天」的判断都必须跟着这个值走，
  // 否则把「每人每周休几天」改成 3 之后，算法里仍按「上满 5 天 / 只许休 2 天」处理，直接自相矛盾。
  const maxWork = Math.max(0, 7 - restMin);   // 每人最多上几天班（跟区间下界走）
  let totalRest = 0;

  // 强制休息日（请假）：先占位，消耗当天的休息名额，也计入全队总配额
  const forcedOff = Array.from({length:N},()=>new Set());
  if(hasR){
    for(let i=0;i<N;i++){
      for(let d=0; d<7; d++){
        if(R[i][d].off){
          forcedOff[i].add(d);
          restDays[i].add(d);
          dayRest[d]++;
          totalRest++;
        }
      }
    }
  }

  // ===== 分组保障：把成员姓名映射成下标（仅当本次排班覆盖全部在册人员时生效） =====
  // 放在「分配休息日」之前，是因为某组当天休息几个人，直接决定了该组当天还能不能凑出保障班次
  const useGroups = (N === state.staff.length) && !!state.groups;
  const gReq = [];   // 每天每班次的分组最低保障：{d, sh, set, min}
  const en = state.groups.earlyNight, oc = state.groups.openClose;
  const mkIdxSet = names => {
    const s = new Set();
    (names||[]).forEach(n=>{ const i = state.staff.indexOf(n); if(i>=0 && i<N) s.add(i); });
    return s;
  };
  const enSet = useGroups ? mkIdxSet(groupMembers("earlyNight")) : new Set();
  const ocSet = useGroups ? mkIdxSet(groupMembers("openClose"))  : new Set();
  if(useGroups){
    for(let d=0; d<7; d++){
      if(enSet.size && en.minEarly>0) gReq.push({d, sh:"early", set:enSet, min:en.minEarly});
      if(enSet.size && en.minNight>0) gReq.push({d, sh:"night", set:enSet, min:en.minNight});
      if(ocSet.size && oc.open >0)    gReq.push({d, sh:"early", set:ocSet, min:oc.open});
      if(ocSet.size && oc.close>0)    gReq.push({d, sh:"night", set:ocSet, min:oc.close});
    }
  }
  // 分组每天至少要出勤的人数 = 该组当天所有保障班次人数之和（早晚保障组 1 早 + 1 晚 = 2 人）。
  // 推论：当天该组休息的人数不能超过「组人数 − 需出勤人数」，否则剩下的人物理上凑不齐保障班次。
  const grpPerDay = [];
  if(useGroups){
    if(enSet.size) grpPerDay.push({set:enSet, perDay:(en.minEarly||0)+(en.minNight||0)});
    if(ocSet.size) grpPerDay.push({set:ocSet, perDay:(oc.open||0)+(oc.close||0)});
  }
  // 该组当天还能再安排几个人休息（≤0 表示不能；负数表示已被请假占超，当天一个都不许再休）
  const grpRestLeft = (set, d)=>{
    let perDay = 0;
    for(const g of grpPerDay){ if(g.set === set){ perDay = g.perDay; break; } }
    let off = 0; set.forEach(i=>{ if(restDays[i].has(d)) off++; });
    return (set.size - perDay) - off;
  };
  // 某人某天能不能排休：他所在分组当天休息的人不能太多
  const groupRestOK = (p, d)=>{
    for(const g of grpPerDay){
      if(!g.set.has(p)) continue;
      if(grpRestLeft(g.set, d) <= 0) return false;
    }
    return true;
  };

  /* ===== 模块在岗下限：每个模块每天至少 N 人上班（班次不限），避免整模块集体休息 =====
     口径：只统计本次排班覆盖的人员（state.staff = 本领域可排班的人），
     「在岗」= 该模块当天既不在 restDays 里、也不是请假强制休息。
     单人模块（人数 ≤ 下限）无法自洽 —— 他一休息模块就空了 —— 故直接跳过，
     否则会把这个人永久钉死成每天上班，等于取消了他的休息。 */
  const modMin = moduleMinOn();
  const modGroups = [];
  if(modMin > 0){
    const byMod = new Map();
    for(let i=0; i<N; i++){
      const m = getStaffProfile(state.staff[i]).module;
      if(!byMod.has(m)) byMod.set(m, []);
      byMod.get(m).push(i);
    }
    byMod.forEach((idxs, m)=>{
      if(moduleMinOnExempt(m)) return;         // 排除名单（见 moduleMinOnExempt）
      if(idxs.length > modMin) modGroups.push({module:m, idxs, set:new Set(idxs)});
    });
  }
  // 该模块当天还能再安排几个人休息（≤0 表示当天已经不能再休，否则会低于在岗下限）
  const modRestLeft = (g, d)=>{
    let off = 0; g.set.forEach(i=>{ if(restDays[i].has(d)) off++; });
    return (g.set.size - modMin) - off;
  };
  const moduleRestOK = (p, d)=>{
    for(const g of modGroups){ if(g.set.has(p) && modRestLeft(g, d) <= 0) return false; }
    return true;
  };

  /* 区间配额的两阶段分配。
     阶段一「保底」：每人先拿到 restMin 天。这一步不看 restCap —— 下界是承诺，必须给。
     阶段二「加休」：全队还有余量（dayTarget 没分配完）时，再一轮轮地给**当前休息最少**的人加一天，
                    加到 restPer 为止。于是结果是「一部分人休 min 天、一部分人休 per 天」，
                    而不是全队被压在下界、或全队统一休满 per 天。
     两阶段共用同一套硬约束判定（孤立休息 / 3 连休 / 分组保障 / 模块在岗 / 当天名额）。 */
  const restOrder = shuffle([...Array(N).keys()]);
  // 算出「某人第 d 天能不能排休」：isFloor=true 表示这是保底阶段，忽略 restCap
  const canRest = (p, d, isFloor)=>{
    if(restDays[p].has(d)) return false;
    if(hasR && (R[p][d].noOff || R[p][d].only)) return false;   // 该天必须上班
    const remain = dayTarget[d] - dayRest[d];
    if(!isFloor && remain <= 0) return false;                    // 当天名额已满（非保底阶段才管）
    if(!groupRestOK(p, d)) return false;                          // 分组保障
    if(!moduleRestOK(p, d)) return false;                         // 模块在岗下限
    if(wouldIsolate(restDays[p], d)) return false;                // 硬约束：禁「上一休一」
    if(wouldRun3Rest(restDays[p], d)) return false;               // 硬约束：禁 3 连休
    return true;
  };
  // 从候选里挑一天（优先补当天缺口最大的日子，随机打散平手）；无候选时放宽「不连续」再试
  const pickRestDay = (p, isFloor)=>{
    const remain = dayTarget.map((t,d)=>t - dayRest[d]);
    let cands = [];
    for(let d=0; d<7; d++){
      if(!canRest(p, d, isFloor)) continue;
      if(restDays[p].has((d+6)%7) || restDays[p].has((d+1)%7)) continue;  // 尽量不连续（软）
      cands.push(d);
    }
    if(cands.length === 0){
      // 放宽「不连续」；孤立 / 3 连休 / 分组 / 模块这四条硬约束任何时候都不放宽
      for(let d=0; d<7; d++){
        if(!canRest(p, d, isFloor)) continue;
        if(isFloor ? true : (dayTarget[d]-dayRest[d]) > -1) cands.push(d);
      }
    }
    if(cands.length === 0) return -1;
    cands.sort((a,b)=> (remain[b]-remain[a]) + (Math.random()-0.5));
    return cands[0];
  };
  // 阶段一：保底 restMin 天
  for(const p of restOrder){
    let guard = 0;
    while(restDays[p].size < restMin && guard < 100){
      guard++;
      const d = pickRestDay(p, true);
      if(d < 0) break;   // 这个人连保底都给不了（规则互相矛盾），交由评分惩罚
      restDays[p].add(d); dayRest[d]++; totalRest++;
    }
  }
  // 阶段二：有余量就继续往上加，每轮给「当前休息最少且还没到 restPer」的人加一天
  const roundsLeft = restPer - restMin;
  for(let round=0; round<roundsLeft; round++){
    if(totalRest >= restCap) break;
    // 休息天数升序 → 谁最少谁优先加，最终自然收敛到均分
    const order = restOrder.slice().sort((a,b)=> restDays[a].size - restDays[b].size);
    let moved = false;
    for(const p of order){
      if(restDays[p].size >= restPer) continue;
      if(totalRest >= restCap) break;
      const d = pickRestDay(p, false);
      if(d < 0) continue;
      restDays[p].add(d); dayRest[d]++; totalRest++;
      moved = true;
    }
    if(!moved) break;   // 没人能再加（dayTarget 用完或被硬约束卡死）
  }

  // 某人某天已排的班次（"" 表示未排或休息）
  const shiftAt = (i,d)=>{ const a = assign[i].find(x=>x.day===d); return a ? a.shift : ""; };
  // 某分组当天某班次已排人数
  const groupHave = (set, day, sh)=>{
    let c = 0;
    set.forEach(i=>{ if(shiftAt(i,day)===sh) c++; });
    return c;
  };
  // ===== 硬约束：周末（周六 d=5 + 周日 d=6）两天都上早班的人数 ≤ weekendEarlyMax =====
  // 开店闭店组因为每天都要有人上早班开店，若周末两天都是同一个人，就会独占这个名额，
  // 所以该组成员额外强制「周末换人」——不得同一人连开两天周末早班。
  const wkMax  = (typeof state.weekendEarlyMax === "number") ? state.weekendEarlyMax : 1;
  const isWk   = d => d===5 || d===6;
  const wkBoth = ()=>{
    let c = 0;
    for(let i=0;i<N;i++){ if(shiftAt(i,5)==="early" && shiftAt(i,6)==="early") c++; }
    return c;
  };
  const wouldBreakWkEarly = (i, day)=>{
    if(!isWk(day)) return false;
    const other = day===5 ? 6 : 5;
    if(shiftAt(i, other) !== "early") return false;        // 另一天不是早班 → 不会形成「周末连上」
    if(ocSet.has(i)) return true;                          // 开店闭店组：周末两天必须换人开店
    return wkBoth() >= wkMax;                              // 全局名额已被占满
  };

  // ===== 第二步：填班次（只给非休息日排班，且遵守每人各班次周上限） =====
  const LIM = (typeof state !== "undefined" && state.limits) ? state.limits : {early:99, mid:99, night:99};
  const shiftCnt = Array.from({length:N},()=>({early:0, mid:0, night:0}));
  const byDay = [[],[],[],[],[],[],[]];
  slots.forEach(s=>byDay[s.day].push(s));
  // 分层填班：先早班、再中班、最后晚班。
  // 原因：「晚班次日不接早班」使早班候选受前一天晚班挤压，早班先填不受此限，
  //      晚班最后填且候选容量最大（每人≤4），能主动避开次日已排早班的人。
  const shiftOrder = ["early","mid","night"];
  // 先把「固定某班」的安排预排掉：这样后续早/晚班的互斥检查能自动避开它
  // （例如周四固定早班 → 周三不会被排晚班；周三固定晚班 → 周四不会被排早班）
  if(hasR){
    for(let i=0;i<N;i++){
      for(let d=0; d<7; d++){
        const only = R[i][d].only;
        if(!only) continue;
        if(restDays[i].has(d)) continue;
        if(assign[i].some(a=>a.day===d)) continue;
        if(workDays[i] >= maxWork) continue;
        assign[i].push({day:d, shift:only});
        workDays[i]++; shiftCnt[i][only]++;
      }
    }
  }
  for(const sh of shiftOrder){
    // 需求大的日子先填（如周末晚班 12 > 工作日 10）。
    // 原因：晚班候选会被「次日早班」挤占，若先填满工作日晚班，周末晚班容易达不到最低需求。
    const dayOrder = [...Array(7).keys()]
      .map(d=>({d, n:(+state.needs[d][sh]||0), r:Math.random()}))
      .sort((a,b)=> (b.n - a.n) || (a.r - b.r))
      .map(x=>x.d);
    for(const day of dayOrder){
      const daySlots = byDay[day].filter(s=>s.shift===sh);
      for(const slot of daySlots){
        // 分组保障优先：该天该班次还有未满足的分组名额时，这个槽位先在「缺口组」成员里挑，
        // 避免名额被组外人占光。早班人数固定（恰好 8 人）时尤其关键——事后很难再换人进来。
        const lacking = gReq.filter(g=> g.d===day && g.sh===sh && groupHave(g.set, day, sh) < g.min);
        let pool = null;
        if(lacking.length){
          pool = new Set();
          lacking.forEach(g=> g.set.forEach(i=> pool.add(i)));
        }
        const collect = ()=>{
          const out = [];
          for(let i=0;i<N;i++){
            if(pool && !pool.has(i)) continue;           // 预留槽位只给缺口组成员
            if(restDays[i].has(day)) continue;            // 休息日不排班
            if(assign[i].some(a=>a.day===day)) continue;  // 当天已有班
            if(workDays[i] >= maxWork) continue;          // 每周最多上 maxWork 天（跟随休息配额）
            if(!ruleOK(i, day, sh)) continue;             // 请假 / 固定班 / 禁排规则
            if(shiftCnt[i][sh] >= (LIM[sh]||99)) continue; // 该班次周上限
            // 硬约束：不能连续 3 个早班（含周日→周一的跨周边界）
            if(sh==="early" && wouldEarlyRun3(d2=>shiftAt(i,d2), day)) continue;
            // 硬约束：周末两天都上早班的人数不超过上限（开店闭店组周末强制换人）
            if(sh==="early" && wouldBreakWkEarly(i, day)) continue;
            // 晚班后一天不接早班（含周日晚班→下周一早班的跨周边界）
            // 双向检查：早班看前一天是否有晚班，晚班看后一天是否已有早班
            if(sh==="early" && assign[i].some(a=>a.day===(day+6)%7 && a.shift==="night")) continue;
            if(sh==="night"  && assign[i].some(a=>a.day===(day+1)%7  && a.shift==="early")) continue;
            out.push(i);
          }
          return out;
        };
        let cands = collect();
        if(cands.length===0 && pool){ pool = null; cands = collect(); } // 组内无人可排则放开给所有人
        if(cands.length===0) continue;
        // 该天该班次是否还有「分组保障」缺口（如早晚保障组每天至少 1 早 1 晚）
        let gNeed = null;
        for(const g of gReq){
          if(g.d===day && g.sh===sh && groupHave(g.set, day, sh) < g.min){ gNeed = g; break; }
        }
        // 优先选：总工作量少 + 该班次已排少 的人（带随机扰动）；
        // 存在分组缺口时该组成员额外加权，尽量让保障名额先落到位
        const w = i => {
          const balancePenalty = sh === "night"
            ? Math.max(0, shiftCnt[i].night - shiftCnt[i].early) * 3
            : (sh === "early" ? Math.max(0, shiftCnt[i].early - shiftCnt[i].night) * 3 : 0);
          const patternPenalty = (sh === "night" && shiftCnt[i].night >= 2 && shiftCnt[i].early <= 1) ? 6 : 0;
          return workDays[i]*0.5 + shiftCnt[i][sh]*2 + balancePenalty + patternPenalty
                 + (gNeed && gNeed.set.has(i) ? -8 : 0) + Math.random()*1.5;
        };
        cands.sort((a,b)=> w(a) - w(b));
        const pickIdx = cands[0];
        assign[pickIdx].push({day, shift:sh});
        workDays[pickIdx]++;
        shiftCnt[pickIdx][sh]++;
      }
    }
  }
  // ===== 第三步：修复未排满的槽位（换班腾挪） =====
  const canTake = (i, day, sh)=>{
    if(restDays[i].has(day)) return false;
    if(assign[i].some(a=>a.day===day)) return false;
    if(workDays[i] >= maxWork) return false;
    if(!ruleOK(i, day, sh)) return false;
    if(shiftCnt[i][sh] >= (LIM[sh]||99)) return false;
    if(sh==="early" && wouldEarlyRun3(d2=>shiftAt(i,d2), day)) return false; // 不连续 3 个早班
    if(sh==="early" && wouldBreakWkEarly(i, day)) return false;              // 周末连上早班不超上限
    if(sh==="early" && assign[i].some(a=>a.day===(day+6)%7 && a.shift==="night")) return false;
    if(sh==="night"  && assign[i].some(a=>a.day===(day+1)%7  && a.shift==="early")) return false;
    return true;
  };
  const canTakeLoose = (i, day, sh)=>{ // 仅放宽「每周上班天数」上限，其余硬约束照旧
    if(restDays[i].has(day)) return false;
    if(assign[i].some(a=>a.day===day)) return false;
    if(!ruleOK(i, day, sh)) return false;
    if(sh==="early" && wouldEarlyRun3(d2=>shiftAt(i,d2), day)) return false;
    if(sh==="early" && wouldBreakWkEarly(i, day)) return false;
    if(sh==="early" && assign[i].some(a=>a.day===(day+6)%7 && a.shift==="night")) return false;
    if(sh==="night"  && assign[i].some(a=>a.day===(day+1)%7  && a.shift==="early")) return false;
    return true;
  };
  // 忽略「当天在休息」这一条的接管判断：用于休息日互换时，评估某人改成上班后能否胜任该班次
  const couldTakeIfWorked = (i, day, sh)=>{
    if(assign[i].some(a=>a.day===day)) return false;
    if(!ruleOK(i, day, sh)) return false;
    if(shiftCnt[i][sh] >= (LIM[sh]||99)) return false;
    if(sh==="early" && wouldEarlyRun3(d2=>shiftAt(i,d2), day)) return false;
    if(sh==="early" && wouldBreakWkEarly(i, day)) return false;
    if(sh==="early" && assign[i].some(a=>a.day===(day+6)%7 && a.shift==="night")) return false;
    if(sh==="night"  && assign[i].some(a=>a.day===(day+1)%7  && a.shift==="early")) return false;
    return true;
  };
  // 休息日是否可挪动（请假 / 必须上班的日子不能挪）
  const restMovable = (i, day)=>{
    if(forcedOff[i].has(day)) return false;
    if(hasR && (R[i][day].off || R[i][day].noOff || R[i][day].only)) return false;
    return true;
  };
  // 分组保障缺口：某天某班次该组人数不足时，尝试把组内成员从别的班次腾过来
  const fixGroupShortage = ()=>{
    if(!gReq.length) return false;
    let moved = false;
    // 把组员 i 从 fromSh 挪走的后果：同一天同一组可能还有别的保障班次压在他身上
    // （例：他是当天组内唯一的晚班，把他调去补早班 → 早班补上了，晚班又塌了，来回震荡永远修不好）
    const wouldBreakOtherGroup = (i, day, fromSh)=>{
      for(const g2 of gReq){
        if(g2.d !== day || g2.sh !== fromSh) continue;
        if(!g2.set.has(i)) continue;
        if(groupHave(g2.set, day, fromSh) - 1 < g2.min) return true;
      }
      return false;
    };
    // 人数固定的班次（如早班）已达需求时不能再加人，只能「换人」，否则会突破固定人数
    const atCap = (d, sh)=> exactArr.includes(sh) && (haveCnt[d+"|"+sh]||0) >= (needCnt[d+"|"+sh]||0);
    for(const g of shuffle(gReq.slice())){
      let guard = 0;
      while(groupHave(g.set, g.d, g.sh) < g.min && guard < 40){
        guard++;
        let done = false;
        const capped = atCap(g.d, g.sh);
        // ① 组内当天空闲（未排班）的人直接顶上
        if(!capped){
          for(const i of shuffle([...g.set])){
            if(canTake(i, g.d, g.sh)){ doAssign(i, g.d, g.sh); haveCnt[g.d+"|"+g.sh]++; done = true; moved = true; break; }
          }
        }
        if(done) continue;
        // ② 组内当天排了别的班的人 → 把他的班交给组外接盘，自己改上保障班次
        if(!capped){
          for(const i of shuffle([...g.set])){
            const cur = assign[i].find(a=>a.day===g.d);
            if(!cur || cur.shift===g.sh) continue;
            if(!movable(i, g.d, cur.shift)) continue;
            if(wouldBreakOtherGroup(i, g.d, cur.shift)) continue;   // 挪走会拆掉同组的另一个保障班次
            const j = shuffle([...Array(N).keys()]).find(x=> x!==i && !g.set.has(x) && canTake(x, g.d, cur.shift));
            if(j===undefined) continue;
            const oldSh = cur.shift;
            doRemove(i, g.d); doAssign(j, g.d, oldSh);
            if(canTake(i, g.d, g.sh)){
              doAssign(i, g.d, g.sh);
              haveCnt[g.d+"|"+g.sh]++;
              done = true; moved = true; break;
            }
            doRemove(j, g.d); doAssign(i, g.d, oldSh); // 回滚
          }
        }
        if(done) continue;
        // ③ 换人（班次人数已满时只能这样）：组内成员进来、组外成员出去，且必须有人接手他原来的班
        //    严格「一进一出」，保证双方上班天数不变，不会有人因此多休一天
        for(const i of shuffle([...g.set])){
          const cur = assign[i].find(a=>a.day===g.d);
          if(!cur || cur.shift===g.sh) continue;            // 当天没上班或已在该班次，走别的策略
          if(!movable(i, g.d, cur.shift)) continue;         // 固定班 / 请假不可挪
          if(wouldBreakOtherGroup(i, g.d, cur.shift)) continue; // 挪走会拆掉同组的另一个保障班次
          const oldSh = cur.shift;
          doRemove(i, g.d);
          if(!canTake(i, g.d, g.sh)){ doAssign(i, g.d, oldSh); continue; }
          const j = shuffle([...Array(N).keys()]).find(x=>
            !g.set.has(x) && movable(x, g.d, g.sh) && assign[x].some(a=>a.day===g.d && a.shift===g.sh)
            && (()=>{ doRemove(x, g.d); const ok = canTake(x, g.d, oldSh); doAssign(x, g.d, g.sh); return ok; })()
          );
          if(j === undefined){ doAssign(i, g.d, oldSh); continue; }
          doRemove(j, g.d);
          doAssign(i, g.d, g.sh);      // 组员顶上保障班次（一进一出，该班次人数不变）
          doAssign(j, g.d, oldSh);     // 组外人接手他原来的班次
          done = true; moved = true; break;
        }
        if(done) continue;
        // ④ 换休息日：组内成员当天在休息 → 与组外某人「互换休息日」。
        //    i 由「休 g.d、上 b」变成「上 g.d、休 b」，j 反过来，双方休的天数都不变。
        for(const i of shuffle([...g.set])){
          if(!restDays[i].has(g.d)) continue;
          if(!restMovable(i, g.d)) continue;                 // 请假 / 必须上班的日子不能挪
          if(!couldTakeIfWorked(i, g.d, g.sh)) continue;
          let done4 = false;
          for(const j of shuffle([...Array(N).keys()])){
            if(g.set.has(j)) continue;
            if(!movable(j, g.d, g.sh)) continue;
            if(!assign[j].some(a=>a.day===g.d && a.shift===g.sh)) continue; // j 当天正在上保障班次
            for(const b of shuffle([...Array(7).keys()])){
              if(b===g.d || !restDays[j].has(b)) continue;
              if(!restMovable(j, b)) continue;
              const sb = assign[i].find(a=>a.day===b);
              if(!sb) continue;                              // i 那天本来就休息，换了会多休
              if(!movable(i, b, sb.shift)) continue;
              if(!couldTakeIfWorked(j, b, sb.shift)) continue;
              // 互换后不能制造「上一休一」的孤立休息日
              restDays[i].delete(g.d); const isoI = wouldIsolate(restDays[i], b); restDays[i].add(g.d);
              if(isoI) continue;
              restDays[j].delete(b);   const isoJ = wouldIsolate(restDays[j], g.d); restDays[j].add(b);
              if(isoJ) continue;
              const s_b = sb.shift;
              doRemove(j, g.d); doAssign(i, g.d, g.sh);      // i 顶上保障班次
              doRemove(i, b);   doAssign(j, b, s_b);         // j 接手 i 在 b 那天的班
              restDays[i].delete(g.d); restDays[i].add(b);   // i 的休息日 g.d → b
              restDays[j].delete(b);   restDays[j].add(g.d); // j 的休息日 b → g.d
              done4 = true; moved = true; break;
            }
            if(done4) break;
          }
          if(done4){ done = true; break; }
        }
        if(!done) break;
      }
    }
    return moved;
  };
  // 固定班 / 请假 造成的"不可挪动"判断
  const movable = (i, day, sh)=>{
    if(!hasR) return true;
    return !(R[i][day].only === sh || R[i][day].off);
  };
  const doAssign = (i, day, sh)=>{
    assign[i].push({day, shift:sh});
    workDays[i]++; shiftCnt[i][sh]++;
  };
  const doRemove = (i, day)=>{
    const idx = assign[i].findIndex(a=>a.day===day);
    if(idx>=0){ const sh = assign[i][idx].shift; assign[i].splice(idx,1); workDays[i]--; shiftCnt[i][sh]--; }
  };
  const needCnt = {}; // "day|shift" -> 需求槽位数
  slots.forEach(s=>{ const k = s.day+"|"+s.shift; needCnt[k]=(needCnt[k]||0)+1; });
  const haveCnt = {}; // "day|shift" -> 已排数
  assign.forEach(a=>a.forEach(x=>{ const k=x.day+"|"+x.shift; haveCnt[k]=(haveCnt[k]||0)+1; }));
  // 「人数固定」的班次（如早班）不能超编，富余人力只摊到其余班次
  const exactArr = Array.isArray(state.exactShifts) ? state.exactShifts : [];

  // 先补一次分组保障，让「每天至少 1 早 1 晚 / 开店闭店名额」尽快落位
  if(useGroups && gReq.length) fixGroupShortage();

  let repairing = true;
  let guard = 0;
  while(repairing && guard < 200){
    guard++; repairing = false;
    for(const key of shuffle(Object.keys(needCnt))){
      const [d, sh] = key.split("|").map((v,i)=> i===0 ? +v : v);
      while(haveCnt[key] < needCnt[key]){
        let fixed = false;
        // 策略1：直接找可排的空闲人选
        for(const i of shuffle([...Array(N).keys()])){
          if(canTake(i, d, sh)){ doAssign(i, d, sh); haveCnt[key]++; fixed = true; break; }
        }
        if(fixed){ repairing = true; continue; }
        // 策略1b：当天某个班次有富余（超过需求）→ 直接把那个人改到缺口班次，无需找人补位
        for(const sh2 of shuffle(["early","mid","night"].filter(x=>x!==sh))){
          if(fixed) break;
          const key2 = d + "|" + sh2;
          if((haveCnt[key2]||0) <= (needCnt[key2]||0)) continue; // 该班次没有富余
          for(const i of shuffle([...Array(N).keys()])){
            const cur = assign[i].find(a=>a.day===d && a.shift===sh2);
            if(!cur) continue;
            if(!movable(i, d, sh2)) continue;      // 固定班 / 请假不动
            doRemove(i, d); haveCnt[key2]--;
            if(canTake(i, d, sh)){
              doAssign(i, d, sh); haveCnt[key]++; fixed = true; break;
            }
            doAssign(i, d, sh2); haveCnt[key2]++;  // 回滚
          }
        }
        if(fixed){ repairing = true; continue; }
        // 策略2：当天被其他班占用的人 → 把他那天的班换给别人接，再让他上这个班
        for(const i of shuffle([...Array(N).keys()])){
          const cur = assign[i].find(a=>a.day===d);
          if(!cur || cur.shift===sh) continue;
          if(!movable(i, d, cur.shift)) continue; // 固定班 / 请假不可挪
          const j = shuffle([...Array(N).keys()]).find(j=> j!==i && canTake(j, d, cur.shift));
          if(j===undefined) continue;
          const oldSh = cur.shift;
          doRemove(i, d); doAssign(j, d, oldSh);
          if(canTake(i, d, sh)){ doAssign(i, d, sh); haveCnt[key]++; fixed = true; break; }
          // 换失败则回滚
          doRemove(j, d); doAssign(i, d, oldSh);
        }
        if(fixed){ repairing = true; continue; }
        // 策略3（早班缺人）：被前一天晚班挡住的人 → 把他的晚班挪给别人
        if(sh==="early"){
          for(const i of shuffle([...Array(N).keys()])){
            const prevNight = assign[i].find(a=>a.day===(d+6)%7 && a.shift==="night");
            if(!prevNight) continue;
            const pd = (d+6)%7;
            if(!movable(i, pd, "night")) continue; // 固定的晚班不可挪
            const j = shuffle([...Array(N).keys()]).find(j=> j!==i && canTake(j, pd, "night"));
            if(j===undefined) continue;
            doRemove(i, pd); doAssign(j, pd, "night");
            if(canTake(i, d, "early")){ doAssign(i, d, "early"); haveCnt[key]++; fixed = true; break; }
            doRemove(j, pd); doAssign(i, pd, "night");
          }
          if(fixed){ repairing = true; continue; }
        }
        // 策略4（晚班缺人）：被次日早班挡住的人 → 把他的早班挪给别人
        if(sh==="night"){
          for(const i of shuffle([...Array(N).keys()])){
            const nextEarly = assign[i].find(a=>a.day===(d+1)%7 && a.shift==="early");
            if(!nextEarly) continue;
            const nd = (d+1)%7;
            if(!movable(i, nd, "early")) continue; // 固定的早班不可挪
            const j = shuffle([...Array(N).keys()]).find(j=> j!==i && canTake(j, nd, "early"));
            if(j===undefined) continue;
            doRemove(i, nd); doAssign(j, nd, "early");
            if(canTake(i, d, "night")){ doAssign(i, d, "night"); haveCnt[key]++; fixed = true; break; }
            doRemove(j, nd); doAssign(i, nd, "early");
          }
          if(fixed){ repairing = true; continue; }
        }
        // 策略5：缺口日休息人数超额 → 把某人的休息日挪到休息名额未满的日子，腾人来上班
        if(dayRest[d] > (dayTarget[d]||0)){
          for(const i of shuffle([...Array(N).keys()])){
            if(!restDays[i].has(d)) continue;
            if(forcedOff[i].has(d)) continue;   // 请假休息日不可挪走
            for(const d2 of shuffle([...Array(7).keys()])){
              if(d2===d || restDays[i].has(d2)) continue;
              if(hasR && (R[i][d2].noOff || R[i][d2].only)) continue; // 该天必须上班
              if(dayRest[d2] >= (dayTarget[d2]||0)) continue;
              if(restDays[i].has((d2+6)%7) || restDays[i].has((d2+1)%7)) continue; // 保持休息日不连续
              // 禁止「上一休一」：先摘掉 d，再看 d2 放进去会不会形成 休-上-休
              restDays[i].delete(d);
              const isoBad = wouldIsolate(restDays[i], d2);
              restDays[i].add(d);
              if(isoBad) continue;
              restDays[i].delete(d); dayRest[d]--;
              restDays[i].add(d2); dayRest[d2]++;
              if(canTake(i, d, sh)){ doAssign(i, d, sh); haveCnt[key]++; fixed = true; break; }
              restDays[i].delete(d2); dayRest[d2]--; // 回滚
              restDays[i].add(d); dayRest[d]++;
            }
            if(fixed) break;
          }
          if(fixed){ repairing = true; continue; }
        }
        break; // 该槽位无解，处理下一个缺口
      }
    }
    // 补齐槽位后，再补一次分组保障（两者会互相影响，需反复收敛）
    if(useGroups && gReq.length && fixGroupShortage()) repairing = true;
  }
  // 最后一轮：优先保分组保障，再确认槽位无缺口
  if(useGroups && gReq.length) fixGroupShortage();
  return {assign, slots, restDays, dayRest, R: hasR ? R : null};
}
function planGroupViol(plan){
  let v = 0;
  if(!state.groups || !plan.assign || plan.assign.length !== state.staff.length) return 0;
  const mkSet = names=>{
    const s = new Set();
    (names||[]).forEach(n=>{ const i = state.staff.indexOf(n); if(i>=0) s.add(i); });
    return s;
  };
  const gEn = state.groups.earlyNight, gOc = state.groups.openClose;
  const enS = mkSet(groupMembers("earlyNight"));
  const ocS = mkSet(groupMembers("openClose"));
  const at  = (i,d)=>{ const a = plan.assign[i].find(x=>x.day===d); return a ? a.shift : ""; };
  const cntOf = (set,d,sh)=>{ let c=0; set.forEach(i=>{ if(at(i,d)===sh) c++; }); return c; };
  for(let d=0; d<7; d++){
    if(enS.size && gEn){
      if(gEn.minEarly>0) v += Math.max(0, gEn.minEarly - cntOf(enS,d,"early"));
      if(gEn.minNight>0) v += Math.max(0, gEn.minNight - cntOf(enS,d,"night"));
    }
    if(ocS.size && gOc){
      if(gOc.open >0) v += Math.max(0, gOc.open  - cntOf(ocS,d,"early"));
      if(gOc.close>0) v += Math.max(0, gOc.close - cntOf(ocS,d,"night"));
    }
  }
  const wkMax = (typeof state.weekendEarlyMax === "number") ? state.weekendEarlyMax : 1;
  let wkBoth = 0;
  plan.assign.forEach(a=>{
    if(a.some(x=>x.day===5 && x.shift==="early") && a.some(x=>x.day===6 && x.shift==="early")) wkBoth++;
  });
  return v + Math.max(0, wkBoth - wkMax) * 2;
}
function planModuleViol(plan){
  const n = moduleMinOn();
  if(!n || !plan || !plan.assign || !plan.restDays) return 0;
  if(plan.assign.length !== state.staff.length) return 0;
  const byMod = new Map();
  plan.assign.forEach((a, i)=>{
    const m = getStaffProfile(state.staff[i]).module;
    if(!byMod.has(m)) byMod.set(m, []);
    byMod.get(m).push(i);
  });
  let v = 0;
  byMod.forEach((idxs, m)=>{
    if(moduleMinOnExempt(m)) return;           // 排除名单（见 moduleMinOnExempt）
    if(idxs.length <= n) return;
    for(let d=0; d<7; d++){
      const on = idxs.filter(i=> !plan.restDays[i].has(d)).length;
      if(on < n) v += (n - on);
    }
  });
  return v;
}
function planRestFloorViol(plan, R){
  if(!plan || !plan.restDays) return 0;
  const {min} = restRange();
  let v = 0;
  plan.restDays.forEach((set, i)=>{
    if(set.size >= min) return;
    // 该人的整天都请了假 → 无法满足下界，跳过
    let allOff = set.size > 0;
    for(let d=0; d<7; d++){
      const c = R && R[i] && R[i][d];
      const worked = plan.assign[i].some(x=> x.day===d);
      if(!worked && !(c && c.off)) allOff = false;
    }
    if(allOff) return;
    v += (min - set.size);
  });
  return v;
}
function planRun3Rest(plan, R){
  if(!plan || !plan.restDays) return 0;
  let v = 0;
  plan.restDays.forEach((set, i)=>{
    // 该人的休息日若全部来自请假，则属「特殊需求除外」，跳过
    let allForced = set.size > 0;
    set.forEach(d=>{ if(!(R && R[i] && R[i][d] && R[i][d].off)) allForced = false; });
    if(allForced) return;
    v += run3RestCount(set);
  });
  return v;
}
function planRuleViol(plan, R){
  let v = 0;
  if(!plan.assign || !R) return 0;
  plan.assign.forEach((a,i)=>{
    if(!R[i]) return;
    const map = {};
    a.forEach(x=>{ map[x.day] = x.shift; });
    for(let d=0; d<7; d++){
      const c = R[i][d];
      if(!hasRule(c)) continue;
      const val = map[d] || "rest";
      if(c.off && val !== "rest")                     v++;
      else if(c.only && val !== c.only)               v++;
      else if(val !== "rest" && c.ban[val])           v++;
      else if(c.noOff && !c.only && val === "rest")   v++;
    }
  });
  return v;
}
function planIsoRest(plan){
  let n = 0;
  if(!plan.assign) return 0;
  plan.assign.forEach(a=>{
    const busy = new Set();
    a.forEach(x=> busy.add(x.day));
    const rest = new Set();
    for(let d=0; d<7; d++) if(!busy.has(d)) rest.add(d);
    n += isolatedRestCount(rest);
  });
  return n;
}
function absorbPlan(plan, R){
  const N = plan.assign.length;
  const rrA = restRange();
  // 补满勤的目标天数 = 7 - 休息**上界** per。
  // 这是「最低要求」：每个人至少要上够这么多天，多休的人要被拉回来上班。
  // 若误用下界 min（目标天数更大），会把本该休 per 天的人也拉去上班，
  // 区间配额被压平成 min —— 实测 2~3 配置下 32 人全部变成休 2 天。
  const workTarget = Math.max(0, 7 - rrA.per);
  const LIM = (typeof state !== "undefined" && state.limits) ? state.limits : {early:3, night:3, mid:99};
  const exact = Array.isArray(state.exactShifts) ? state.exactShifts : [];
  const flex = ["mid","night"].filter(sh => !exact.includes(sh));
  if(!flex.length) return 0;
  const at    = (i,d)=>{ const a = plan.assign[i].find(x=>x.day===d); return a ? a.shift : ""; };
  const cntOf = (i,sh)=> plan.assign[i].filter(x=> x.shift===sh).length;
  const restSet = i=>{ const s = new Set([0,1,2,3,4,5,6]); plan.assign[i].forEach(x=> s.delete(x.day)); return s; };
  const dayHave = (d,sh)=>{ let c=0; for(let i=0;i<N;i++) if(at(i,d)===sh) c++; return c; };
  let fixed = 0;
  for(let pass=0; pass<3; pass++){
    let moved = false;
    for(let i=0; i<N; i++){
      let guard = 0;
      while(plan.assign[i].length < workTarget && guard < 8){
        guard++;
        const isoBefore = isolatedRestCount(restSet(i));
        let best = null;
        for(let d=0; d<7; d++){
          if(at(i,d)) continue;
          const c = (R && R[i] && R[i][d]) || null;
          if(c && c.off) continue;                                        // 请假：保持休息
          for(const sh of flex){
            if(c){
              if(c.only && c.only !== sh) continue;                       // 固定班必须匹配
              if(c.ban && c.ban[sh]) continue;                            // 禁排班次
            }
            if(cntOf(i, sh) >= (LIM[sh]||99)) continue;                   // 该班次每周上限
            if(sh==="night" && at(i,(d+1)%7) === "early") continue;       // 晚班次日不接早班
            if(sh==="early" && at(i,(d+6)%7) === "night") continue;       // 兜底（flex 一般不含早班）
            if(sh==="early" && wouldEarlyRun3(dd=> at(i,dd), d)) continue;
            // 保守：不制造「周末两天都上早班」（即便名额没占满）
            if(sh==="early" && (d===5||d===6) && at(i, d===5?6:5) === "early") continue;
            // 试排再撤回：拿掉一个休息日也可能「夹出」孤立的休息日（休-上-休）或 3 连休。
            // 两者都是硬约束，补满勤时绝不能造出来 —— 否则要等收尾修复去擦屁股，
            // 而修复器之间会互相顶死，最后留下残缺班表。
            plan.assign[i].push({day:d, shift:sh});
            const iso = isolatedRestCount(restSet(i));
            const r3  = run3RestCount(restSet(i));
            plan.assign[i].pop();
            if(iso > isoBefore) continue;                                  // 绝不允许新增「上一休一」
            if(r3 > 0) continue;                                           // 绝不允许 3 天连休
            // 优先晚班；其次能顺手消掉孤立的；再次本人该班次少的、当天该班次人少的
            const sc = (sh==="night" ? 0 : 100) + iso*40 + cntOf(i,sh)*3 + dayHave(d,sh) + Math.random();
            if(!best || sc < best.sc) best = {d, sh, sc};
          }
        }
        if(!best) break; // 这个人这周补不动了
        plan.assign[i].push({day:best.d, shift:best.sh});
        fixed++; moved = true;
      }
    }
    if(!moved) break;
  }
  // restDays 是评分里「休息日连续性 / 每天休息人数」的依据，补班后必须同步，否则评分算的是旧班表
  if(plan.restDays) plan.restDays = plan.assign.map(a=>{
    const s = new Set([0,1,2,3,4,5,6]);
    a.forEach(x=> s.delete(x.day));
    return s;
  });
  return fixed;
}
function planScore(plan){
  let filled = 0;
  plan.assign.forEach(a=>{ filled += a.length; });
  // 每人班次均衡度
  const counts = plan.assign.map(a=>a.length);
  const avg = counts.reduce((s,c)=>s+c,0)/counts.length;
  const variance = counts.reduce((s,c)=>s+(c-avg)*(c-avg),0)/counts.length;
  // 公平性：人与人之间早班/晚班分配的差异（不惩罚全局总量——上限约束下总量天然不等）
  const eC = plan.assign.map(a=>a.filter(x=>x.shift==="early").length);
  const nC = plan.assign.map(a=>a.filter(x=>x.shift==="night").length);
  const fairVar = arr=>{const m=arr.reduce((s,c)=>s+c,0)/arr.length;return arr.reduce((s,c)=>s+(c-m)*(c-m),0)/arr.length;};
  const shiftFair = fairVar(eC) + fairVar(nC);
  // 每个人自己的早/晚班数量也要尽量接近，避免「3 晚 1 早」这类明显失衡组合
  let personalMixPenalty = 0, threeNightOneEarly = 0;
  plan.assign.forEach((a, idx)=>{
    const e = eC[idx], n = nC[idx];
    personalMixPenalty += (e-n)*(e-n);
    if(n >= 3 && e <= 1) threeNightOneEarly++;
  });
  // 休息日分布：每人休息日不连续 + 每天休息人数均衡
  let adjPenalty = 0;
  const dr = new Array(7).fill(0);
  plan.restDays.forEach(set=>{
    set.forEach(d=>dr[d]++);
    const arr=[...set];
    arr.forEach(d=>{ if(set.has((d+1)%7)) adjPenalty++; });
  });
  adjPenalty = adjPenalty/2;
  const rAvg = dr.reduce((s,c)=>s+c,0)/7;
  const rVar = dr.reduce((s,c)=>s+(c-rAvg)*(c-rAvg),0)/7;
  // 班次上限违约惩罚（每人早班/晚班超上限）
  const LIM = (typeof state !== "undefined" && state.limits) ? state.limits : {early:99, mid:99, night:99};
  let overLimit = 0;
  plan.assign.forEach(a=>{
    const c = {early:0, mid:0, night:0};
    a.forEach(x=>c[x.shift]++);
    ["early","mid","night"].forEach(sh=>{
      const lim = LIM[sh]||99;
      if(c[sh] > lim) overLimit += c[sh]-lim;
    });
  });
  // 晚班次日接早班惩罚（硬约束兜底：贪心个别排不下时仍应尽量避免）
  let nightEarly = 0;
  plan.assign.forEach(a=>{
    a.forEach(x=>{
      if(x.shift==="night" && a.some(y=>y.day===(x.day+1)%7 && y.shift==="early")) nightEarly++;
    });
  });
  // 请假 / 改班规则违约惩罚（硬约束：任何一条未满足都重罚）
  let ruleViol = 0;
  if(plan.R){
    plan.assign.forEach((a, i)=>{
      const row = plan.R[i];
      if(!row) return;
      const map = {};
      a.forEach(x=>{ map[x.day] = x.shift; });
      for(let d=0; d<7; d++){
        const c = row[d];
        if(!hasRule(c)) continue;
        const v = map[d] || "rest";
        if(c.off && v !== "rest") ruleViol++;
        else if(c.only && v !== c.only) ruleViol++;
        else if(v !== "rest" && c.ban[v]) ruleViol++;
        else if(c.noOff && !c.only && v === "rest") ruleViol++;
      }
    });
  }
  const isoRest = planIsoRest(plan);
  // 分组保障违约惩罚：加进评分后，300 次候选里会优先挑满足分组保障的方案，而不是只看通用均衡度
  const groupViol = planGroupViol(plan);
  // 新增两条硬规则的违约惩罚：3 连休、模块无人上岗。
  // 权重给得比 groupViol 还高（50 / 60），确保 300 次候选里一定会收敛到零违约。
  const run3Bad = planRun3Rest(plan, plan.R);
  const modViol = planModuleViol(plan);
  const floorBad = planRestFloorViol(plan, plan.R);
  const fillRatio = plan.slots.length ? filled/plan.slots.length : 1;
  const gaps = plan.slots.length - filled; // 未覆盖槽位数（硬性优先解决）
  // 富余人力没排出去 → 就有人上不满「7-休息下界」天、多休一天，破坏休息配额。
  // 这是软目标（进评分，不进字典序的硬约束层）：不能为了把富余人力塞满而牺牲分组保障。
  // 区间配额下，工作天数不是定值：低于 7-min 说明休多了（超配额），高于 7-per 说明休少了。
  const rrSc = (typeof restRange === "function") ? restRange() : {min:2, per:2};
  const workHi = 7 - rrSc.min, workLo = 7 - rrSc.per;
  const shortWork = plan.assign.reduce((s,a)=> s + Math.max(0, workHi - a.length) + Math.max(0, a.length - workLo), 0);
  // 缺班惩罚设为绝对量级（远大于任何均衡/分组项）：先保证班次全覆盖，再在同等覆盖的方案里挑分组保障好的
  return fillRatio*100 - gaps*1000 - variance*2 - shiftFair*3 - personalMixPenalty*8 - threeNightOneEarly*50
         - rVar*4 - adjPenalty*8 - overLimit*25
         - shortWork*30
         - nightEarly*30 - ruleViol*60 - isoRest*20 - groupViol*45
         - run3Bad*50 - modViol*60 - floorBad*55;
}
function planOfWeek(week, R){
  const assign = [], restDays = [], RArr = [];
  state.staff.forEach(n=>{
    const row = week[n] || [];
    const list = [];
    const rest = new Set([0,1,2,3,4,5,6]);
    for(let d=0; d<7; d++){
      const v = row[d] || "";
      if(v === "early" || v === "mid" || v === "night"){ list.push({day:d, shift:v}); rest.delete(d); }
    }
    assign.push(list);
    restDays.push(rest);
    RArr.push(R ? R[n] : null);
  });
  const slots = [];
  state.needs.forEach((d, di)=>{
    ["early","mid","night"].forEach(sh=>{
      for(let i=0; i<(+d[sh]||0); i++) slots.push({day:di, shift:sh});
    });
  });
  return {assign, restDays, slots, R:RArr};
}
function weekGrade(week, R, demandNeed, demandKeys, workDaysPerPerson){
  const plan = planOfWeek(week, R);
  const have = {};
  plan.assign.forEach(a=> a.forEach(x=>{ const kk = x.day+"|"+x.shift; have[kk] = (have[kk]||0)+1; }));
  let gap = 0;
  demandKeys.forEach(kk=>{ gap += Math.max(0, demandNeed[kk] - (have[kk]||0)); });
  const ruleBad = planRuleViol(plan, plan.R);
  const bad = planIsoRest(plan) + planGroupViol(plan) + planRun3Rest(plan, plan.R)
            + planModuleViol(plan) + planRestFloorViol(plan, plan.R);
  const shortWork = plan.assign.reduce((s,a)=> s + Math.max(0, workDaysPerPerson - a.length), 0);
  return [gap, ruleBad, bad, shortWork, -planScore(plan)];
}
function gradeCmp(a, b){
  for(let i=0; i<a.length; i++) if(a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}
function cloneWeek(week){
  const out = {};
  Object.keys(week).forEach(n=>{ out[n] = week[n].slice(); });
  return out;
}
function sameWeek(a, b){
  const ka = Object.keys(a);
  if(ka.length !== Object.keys(b).length) return false;
  for(let i=0; i<ka.length; i++){
    const ra = a[ka[i]], rb = b[ka[i]];
    if(!rb || rb.length !== ra.length) return false;
    for(let d=0; d<ra.length; d++) if(ra[d] !== rb[d]) return false;
  }
  return true;
}
function fillGaps(week, R, allowOverfill){
  // 在已有班表基础上补空缺：优先安排空闲的人，其次动用休息超额的人，最后做换班腾挪
  // allowOverfill=false 时禁用「④ 兜底动用休息日」，保证每人仍然恰好休 restPer 天
  const S = ["early","mid","night"];
  const LIM = state.limits || {early:3,night:3,mid:99};
  // 「每周上几天 / 只许休几天」必须跟随休息配额：写死 5 / 2 的话，
  // 用户把「每人每周休几天」改成 3 之后，这里会反过来把人拉回「上满 5 天」，与配置直接冲突。
  const rrG = restRange();
  const restPerCfg = rrG.per;
  const maxWork = Math.max(0, 7 - rrG.min);   // 每人最多上几天班（跟休息下界走）
  const cntOf = (n,sh)=> week[n].filter(v=>v===sh).length;
  const workDays = n => week[n].filter(v=>v!=="" && v!=="rest").length;
  const restDays = n => week[n].filter(v=>v==="rest").length;
  const canTake = (n,d,sh,allowOver)=>{
    const c = R[n][d], v = week[n][d]||"";
    if(v===sh) return false;
    if(c.off) return false;
    if(c.only && c.only!==sh) return false;
    if(c.ban[sh]) return false;
    if(v!=="" && v!=="rest") return false;          // 当天已有别的班
    if(!allowOver && workDays(n) >= maxWork) return false; // 每周最多上 maxWork 天（跟随休息配额）
    if(cntOf(n,sh) >= (LIM[sh]||99)) return false;  // 班次周上限
    if(sh==="early" && week[n][(d+6)%7]==="night") return false; // 晚后不接早
    if(sh==="night" && week[n][(d+1)%7]==="early") return false;
    return true;
  };
  let added = 0, usedRest = 0, restMoved = 0;
  for(let iter=0; iter<6; iter++){
    let moved = false;
    const gaps = [];
    for(let d=0; d<7; d++) S.forEach(sh=>{
      const need = +state.needs[d][sh]||0;
      const have = state.staff.filter(n=>week[n][d]===sh).length;
      if(have < need) gaps.push({d, sh, gap: need-have});
    });
    if(!gaps.length) break;
    gaps.sort((a,b)=> b.gap - a.gap);
    for(const g of gaps){
      const d = g.d, sh = g.sh;
      const need = +state.needs[d][sh]||0;
      let have = state.staff.filter(n=>week[n][d]===sh).length;
      // ① 当天完全空闲的人
      let cands = state.staff.filter(n=> canTake(n,d,sh) && !(week[n][d]||""));
      cands.sort((a,b)=> (workDays(a)-workDays(b)) + (cntOf(a,sh)-cntOf(b,sh))*2 + (Math.random()-0.5));
      for(const n of cands){
        if(have >= need) break;
        week[n][d] = sh; have++; added++; moved = true;
      }
      // ② 当天休息、但本周休息超过 restPer 天的人（把多余休息让出来）
      if(have < need){
        cands = state.staff.filter(n=>
          canTake(n,d,sh) && week[n][d]==="rest" && restDays(n) > restPerCfg
          // 拿掉一个休息日也可能「夹出」孤立休息日（休{五六日}→周六上班→五和日被隔开），必须挡掉
          && isolatedRestCount(restSetOfWeek(week, n)) >= isolatedRestCount((()=>{
               const s = restSetOfWeek(week, n); s.delete(d); return s;
             })())
        );
        cands.sort((a,b)=> (restDays(b)-restDays(a)) + (Math.random()-0.5));
        for(const n of cands){
          if(have >= need) break;
          week[n][d] = sh; have++; added++; usedRest++; moved = true;
        }
      }
      // ②b 挪休息日：当天在休息的人改为上班，把他另一个「有富余」的工作日变成休息日（仍休 restPer 天）
      if(have < need){
        for(const n of shuffle(state.staff.slice())){
          if(have >= need) break;
          if((week[n][d]||"") !== "rest" || R[n][d].off) continue;
          let done = false;
          for(const d2 of shuffle([...Array(7).keys()])){
            if(d2 === d) continue;
            const v2 = week[n][d2] || "";
            if(v2 === "" || v2 === "rest") continue;
            if(R[n][d2].only || R[n][d2].noOff) continue;
            const need2 = +state.needs[d2][v2] || 0;
            const have2 = state.staff.filter(x=> week[x][d2] === v2).length;
            if(have2 <= need2) continue;            // 撤掉会缺人，不动
            if(wouldIsolateWeek(week, n, d2, d)) continue; // 不能挪出「上一休一」的孤立休息日
            const old = week[n][d2];
            week[n][d2] = "rest";                   // 先腾出容量再判断能否接本班
            const ok = canTake(n, d, sh);
            if(!ok){ week[n][d2] = old; continue; }
            week[n][d] = sh; have++; added++; restMoved++; moved = true; done = true;
            break;
          }
          if(done) break;
        }
      }
      // ③ 换班：当天上别的班的人改上本班，他原来的班找人接
      if(have < need){
        for(const n of shuffle(state.staff.slice())){
          if(have >= need) break;
          const cur = week[n][d]||"";
          if(cur===""||cur==="rest"||cur===sh) continue;
          if(R[n][d].only) continue;               // 固定班不动
          const old = cur;
          week[n][d] = "";
          const okSelf = canTake(n, d, sh);
          week[n][d] = old;
          if(!okSelf) continue;
          const sub = shuffle(state.staff.slice()).find(m=> m!==n && canTake(m, d, old));
          if(sub){ week[sub][d] = old; week[n][d] = sh; have++; added++; moved = true; }
        }
      }
      // ④ 兜底：动用刚好休 2 天的人的休息日（会使其本周只休 1 天，结果里明确提示）
      if(have < need && allowOverfill !== false){
        cands = state.staff.filter(n=> canTake(n,d,sh,true) && week[n][d]==="rest");
        cands.sort((a,b)=> (restDays(b)-restDays(a)) + (Math.random()-0.5));
        for(const n of cands){
          if(have >= need) break;
          week[n][d] = sh; have++; added++; usedRest++; moved = true;
        }
      }
    }
    if(!moved) break;
  }
  return {added, usedRest, restMoved};
}
function absorbSurplus(week, R){
  const rrS = restRange();
  // 补满勤目标 = 7 - 休息**上界** per（每个人至少上够这么多天）。
  // 用下界 min 会把该休 per 天的人拉回来上班，区间被压平成 min。
  const workTarget = Math.max(0, 7 - rrS.per);
  const LIM = state.limits || {early:3, night:3, mid:99};
  const exact = Array.isArray(state.exactShifts) ? state.exactShifts : [];
  // 只往「不限人数」的班次加人；早班是人数固定班次，绝不动
  const flex = ["mid","night"].filter(sh => !exact.includes(sh));
  if(!flex.length) return 0;
  const cntOf    = (n,sh)=> week[n].filter(v=>v===sh).length;
  const workDays = n => week[n].filter(v=> v!=="" && v!=="rest").length;
  const dayHave  = (d,sh)=> state.staff.filter(x=> week[x][d]===sh).length;
  let fixed = 0;
  for(let pass=0; pass<4; pass++){
    const under = shuffle(state.staff.filter(n=> week[n] && workDays(n) < workTarget));
    if(!under.length) break;
    let moved = false;
    for(const n of under){
      let guard = 0;
      while(workDays(n) < workTarget && guard < 8){
        guard++;
        const isoBefore = isolatedRestCount(restSetOfWeek(week, n));
        const opts = [];
        for(let d=0; d<7; d++){
          const v = week[n][d] || "";
          if(v !== "" && v !== "rest") continue;
          const c = (R && R[n] && R[n][d]) || {};
          if(c.off) continue;                                              // 请假：保持休息
          for(const sh of flex){
            if(c.only && c.only !== sh) continue;                          // 固定班必须匹配
            if(c.ban && c.ban[sh]) continue;                               // 禁排班次
            if(cntOf(n, sh) >= (LIM[sh]||99)) continue;                    // 该班次每周上限
            if(sh==="night" && week[n][(d+1)%7] === "early") continue;     // 晚班次日不接早班
            if(sh==="early" && week[n][(d+6)%7] === "night") continue;     // 兜底（flex 一般不含早班）
            if(sh==="early" && wouldEarlyRun3(dd=> week[n][dd] || "", d)) continue;
            // 试排一次再撤回：拿掉一个休息日也可能「夹出」孤立休息日或 3 连休
            //（例：休{五六日} → 把周六改成上班 → 周五和周日被周六隔开，成了「休-上-休」）
            week[n][d] = sh;
            const isoAfter = isolatedRestCount(restSetOfWeek(week, n));
            const r3After  = run3RestCount(restSetOfWeek(week, n));
            week[n][d] = v;
            if(isoAfter > isoBefore) continue;                             // 绝不允许新增「上一休一」
            if(r3After > 0) continue;                                      // 绝不允许 3 天连休
            opts.push({d, sh, iso: isoAfter});
          }
        }
        if(!opts.length) break; // 这个人这周补不动了，换下一个
        // 优先晚班（富余人次本来就是补在晚班）；其次能顺手消掉孤立的；再次本人该班次少的、当天该班次人少的
        const mixPenalty = sh => sh === "night"
          ? Math.max(0, cntOf(n,"night") - cntOf(n,"early")) * 4
          : 0;
        opts.sort((a,b)=>
          ((a.sh==="night"?0:1) - (b.sh==="night"?0:1)) * 60
          + (mixPenalty(a.sh) - mixPenalty(b.sh))
          + (a.iso - b.iso) * 40
          + (cntOf(n,a.sh) - cntOf(n,b.sh)) * 3
          + (dayHave(a.d,a.sh) - dayHave(b.d,b.sh))
          + (Math.random() - 0.5));
        week[n][opts[0].d] = opts[0].sh;
        fixed++; moved = true;
      }
    }
    if(!moved) break;
  }
  return fixed;
}
function patchViolations(week, R, k){
  const out = [];
  const P = restRange().min;   // 「最多能上几天班」按休息**下界**算
  const at = (n,d)=> (week[n] ? (week[n][d]||"") : "");
  // ① 各班次缺人
  for(let d=0; d<7; d++) ["early","mid","night"].forEach(sh=>{
    const need = +state.needs[d][sh]||0;
    const have = state.staff.filter(n=> at(n,d)===sh).length;
    if(have < need) out.push(`${DAY_NAMES[d]}${SHIFT_NAMES[sh]}班缺 ${need-have} 人`);
  });
  // ② 请假 / 改班 / 固定上班日
  checkRuleViolations(week, R).forEach(x=> out.push(x));
  // ③ 每人层面：上一休一 / 三连早 / 晚接早 / 班次超上限
  state.staff.forEach(n=>{
    const arr = week[n]||[];
    const rest = new Set();
    const cnt = {early:0, mid:0, night:0};
    for(let d=0; d<7; d++){
      const v = arr[d]||"";
      if(v === "rest" || v === "") rest.add(d);
      else if(cnt[v] !== undefined) cnt[v]++;
    }
    if(isolatedRestCount(rest) > 0){
      const off=[], must=[];
      for(let d=0; d<7; d++){ if(R[n][d].off) off.push(d); else if(R[n][d].noOff) must.push(d); }
      const doomed = off.length<=P && must.length<=7-P && !hasRestPlan(off, P, must);
      if(!doomed) out.push(`${n} 上一休一`);   // 注定躲不开的不算，重排也救不回来
    }
    if(hasEarlyRun3(d=> arr[d] || "rest")) out.push(`${n} 连续 3 天早班`);
    for(let d=0; d<7; d++) if(arr[d]==="night" && arr[(d+1)%7]==="early"){ out.push(`${n} 晚班接早班`); break; }
    ["early","night"].forEach(sh=>{
      const lim = state.limits[sh]||99;
      if(lim < 99 && cnt[sh] > lim) out.push(`${n} ${SHIFT_NAMES[sh]}班 ${cnt[sh]} 次超上限`);
    });
  });
  // ④ 分组保障 + 开店闭店（班次改过了，角色要按新班表重算才数得准）
  const en = groupMembers("earlyNight"), oc = groupMembers("openClose");
  const gEn = state.groups.earlyNight, gOc = state.groups.openClose;
  for(let d=0; d<7; d++){
    if(en.length && gEn){
      if(gEn.minEarly>0 && en.filter(n=> at(n,d)==="early").length < gEn.minEarly) out.push(`${DAY_NAMES[d]} ${groupLabel("earlyNight")}缺早班`);
      if(gEn.minNight>0 && en.filter(n=> at(n,d)==="night").length < gEn.minNight) out.push(`${DAY_NAMES[d]} ${groupLabel("earlyNight")}缺晚班`);
    }
  }
  if(oc.length && gOc){
    assignRoles(k);
    const roles = state.roles[k]||{};
    for(let d=0; d<7; d++){
      if(gOc.open >0 && oc.filter(n=>(roles[n]||[])[d]==="open").length  < gOc.open)  out.push(`${DAY_NAMES[d]} 开店缺人`);
      if(gOc.close>0 && oc.filter(n=>(roles[n]||[])[d]==="close").length < gOc.close) out.push(`${DAY_NAMES[d]} 闭店缺人`);
    }
  }
  // ⑤ 周末连上早班上限、⑥ 全队休息总数 —— 这两项「本周体检」是当错误报的，
  //    自检的口径必须跟面板一致，否则又会变成「面板报冲突、提示却说全部满足」
  const wkMax = (typeof state.weekendEarlyMax === "number") ? state.weekendEarlyMax : 1;
  const wkBoth = state.staff.filter(n=> at(n,5)==="early" && at(n,6)==="early").length;
  if(wkBoth > wkMax) out.push(`周六周日连上早班 ${wkBoth} 人 > 上限 ${wkMax}`);
  const rs = schedRestStats(week);
  if(rs.rest > rs.cap) out.push(`全队休息 ${rs.rest} 人日 > 上限 ${rs.cap} 人日`);
  return out;
}
function polishScore(week, R, skipIso){
  let score = 0;
  const at = (n,d)=> (week[n] ? (week[n][d]||"") : "");
  const cnt = {};
  state.staff.forEach(n=> cnt[n] = {early:0, mid:0, night:0});
  // 缺班 / 工作日早班精确人数
  for(let d=0; d<7; d++) ["early","mid","night"].forEach(sh=>{
    const need = +state.needs[d][sh]||0;
    let have = 0;
    state.staff.forEach(n=>{ if(at(n,d)===sh) have++; });
    if(have < need) score += (need-have)*10;
    else if(sh==="early" && d<5 && state.exactShifts && state.exactShifts.includes("early") && have>need)
      score += (have-need)*10;
  });
  // 每人层面：规则兜底 + 三连早 + 晚接早 + 班次上限
  const LIM = state.limits || {};
  state.staff.forEach(n=>{
    const arr = week[n]||[];
    for(let d=0; d<7; d++){
      const v = arr[d]||"";
      if(v && v!=="rest") cnt[n][v] = (cnt[n][v]||0)+1;
      const c = R[n][d];
      if(c.off){ if(v && v!=="rest") score += 50; }
      else if(c.only){ if(v !== c.only) score += 50; }
      else if(v && c.ban && c.ban[v]) score += 50;
      else if(c.noOff && v==="rest") score += 50;
      if(at(n,d)==="early" && at(n,(d+1)%7)==="early" && at(n,(d+2)%7)==="early") score += 30;
      if(at(n,d)==="night" && at(n,(d+1)%7)==="early") score += 30;
    }
    ["early","night"].forEach(sh=>{
      const lim = LIM[sh]||99;
      if(lim<99 && cnt[n][sh]>lim) score += (cnt[n][sh]-lim)*25;
    });
    // 休息天数（「未安排」的空格同样算休息）与上一休一：
    // 与「本周体检」口径一致；「输入层注定躲不开」的上一休一不计（skipIso）
    const restSet = new Set();
    for(let d=0; d<7; d++){ const v=arr[d]||""; if(v==="rest"||v==="") restSet.add(d); }
    if(!skipIso || !skipIso[n]){
      if(isolatedRestCount(restSet) > 0) score += 40;
    }
    const rrPo = restRange();
    // 区间配额：休息天数落在 [min, per] 内都不算错，超出才罚（越界越重）
    if(restSet.size < rrPo.min) score += (rrPo.min - restSet.size) * 30;
    else if(restSet.size > rrPo.per) score += (restSet.size - rrPo.per) * 30;
  });
  // 分组保障
  const gEn = state.groups && state.groups.earlyNight, gOc = state.groups && state.groups.openClose;
  const en = gEn ? groupMembers("earlyNight") : [];
  const oc = gOc ? groupMembers("openClose") : [];
  for(let d=0; d<7; d++){
    if(en.length && gEn){
      if(gEn.minEarly>0 && en.filter(n=>at(n,d)==="early").length < gEn.minEarly) score += 20;
      if(gEn.minNight>0 && en.filter(n=>at(n,d)==="night").length < gEn.minNight) score += 20;
    }
    if(oc.length && gOc){
      const o = Math.max(0, +gOc.open||0), cl = Math.max(0, +gOc.close||0);
      const eo = oc.filter(n=>at(n,d)==="early").length;
      const ec = oc.filter(n=>at(n,d)==="night").length;
      if(eo < o) score += (o-eo)*20;
      if(ec < cl) score += (cl-ec)*20;
    }
  }
  // 周末连上早班
  const wkMax = (typeof state.weekendEarlyMax === "number") ? state.weekendEarlyMax : 1;
  const ocSetWk = new Set(oc);
  let wkBoth = 0;
  state.staff.forEach(n=>{
    if(at(n,5)==="early" && at(n,6)==="early"){
      wkBoth++;
      // 开店闭店组：周末两天必须换人开店，不能同一个人连开两天早班。
      // 这条在 tryPlan（整周排班）里是硬约束，所以微调也必须遵守，否则「重排 0 违规、微调却破」。
      if(ocSetWk.has(n)) score += 25;
    }
  });
  if(wkBoth > wkMax) score += (wkBoth-wkMax)*20;
  return score;
}
function polishWeek(week, R, k){
  const base0 = polishScore(week, R);
  if(base0 === 0) return 0;                     // 本来就干净，一分钱不花
  const deadline = Date.now() + 700;
  const restPer = restRange().per;   // polish 只在区间内做「挪一天」的微调，上界用于判断是否还超配额
  const restCnt = n => week[n].filter(v=>v==="rest"||v==="").length;
  // 「输入层注定躲不开」的上一休一：请假把休息日钉死后怎么排都躲不开，不进目标函数
  const skipIso = {};
  {
  const P = restRange().per;
    state.staff.forEach(n=>{
      const row = R[n]; if(!row) return;
      const off=[], must=[];
      for(let d=0; d<7; d++){ if(row[d].off) off.push(d); else if(row[d].noOff) must.push(d); }
      if(off.length<=P && must.length<=7-P && !hasRestPlan(off, P, must)) skipIso[n] = 1;
    });
  }
  // 用户手动改过的格子：任何移动都不得覆盖（「轻触」契约的正式载体）
  const manK = (state.manual && state.manual[k]) || {};
  const isMan = (n,d)=> !!manK[n+"|"+d];
  const freeCell = (n,d)=>{ const c = R[n][d]; return !c.off && !c.only && !isMan(n,d); };
  const workable = (n,d)=>{                     // 可参与交换的格子：非休息、非锁定、非手动
    if(!freeCell(n,d)) return false;
    const v = week[n][d]||"";
    return v !== "" && v !== "rest";
  };
  let base = base0, steps = 0, progressed = true;
  while(progressed && Date.now() < deadline){
    progressed = false;
    // ① 同一天两人互换班次
    for(let d=0; d<7 && Date.now()<deadline; d++)
      for(let i=0; i<state.staff.length; i++){
        const n1 = state.staff[i];
        if(!workable(n1,d)) continue;
        for(let j=i+1; j<state.staff.length; j++){
          const n2 = state.staff[j];
          if(!workable(n2,d)) continue;
          const a = week[n1][d], b = week[n2][d];
          if(a===b) continue;
          if(b && R[n1][d].ban[b]) continue;
          if(a && R[n2][d].ban[a]) continue;
          week[n1][d]=b; week[n2][d]=a;
          const s = polishScore(week, R, skipIso);
          if(s < base){ base = s; steps++; progressed = true; }
          else { week[n1][d]=a; week[n2][d]=b; }
        }
      }
    // ② 同一人跨两天互换（修三连早 / 晚接早 / 周内分布）
    for(const n of state.staff){
      if(Date.now() >= deadline) break;
      for(let d1=0; d1<7; d1++){
        if(!workable(n,d1)) continue;
        for(let d2=d1+1; d2<7; d2++){
          if(!workable(n,d2)) continue;
          const a = week[n][d1], b = week[n][d2];
          if(a===b) continue;
          if(b && R[n][d1].ban[b]) continue;
          if(a && R[n][d2].ban[a]) continue;
          week[n][d1]=b; week[n][d2]=a;
          const s = polishScore(week, R, skipIso);
          if(s < base){ base = s; steps++; progressed = true; }
          else { week[n][d1]=a; week[n][d2]=b; }
        }
      }
    }
    // ③ 单格换班种：补空格（缺班）或把富余班次卸成空格（精确早班 / 超上限）
    for(const n of state.staff){
      if(Date.now() >= deadline) break;
      for(let d=0; d<7; d++){
        if(!freeCell(n,d)) continue;
        const cur = week[n][d]||"";
        if(cur === "rest") continue;            // 休息日一概不碰
        for(const sh of ["early","mid","night",""]){
          if(sh === cur) continue;
          if(sh && R[n][d].ban[sh]) continue;
          if(sh==="early" && week[n][(d+6)%7]==="night") continue;  // 晚后不接早
          if(sh==="night" && week[n][(d+1)%7]==="early") continue;
          if(sh==="") {                          // 卸成空格 = 此人多休半天，须未到休息配额
            if(cur === "" || restCnt(n) >= restPer) continue;
          }
          week[n][d] = sh;
          const s = polishScore(week, R, skipIso);
          // 接受后必须立刻跳出：cur 是进入本格时读的旧值，
          // 继续试后面的班种一旦不降分就会执行「回滚成 cur」，把刚接受的修复擦掉，
          // 而 base 已经降下去了 —— 结果就是「分数显示修好了、班表其实没动」。
          if(s < base){ base = s; steps++; progressed = true; break; }
          else { week[n][d] = cur; }
        }
      }
    }
    // ④ 同一人「休息日 ↔ 工作日」对调：消上一休一。
    //    只动算法排出来的休息日 —— 请假钉死的休息日（off）和用户手动改过的格子都不碰；
    //    目标格不能是请假日 / 固定班 / 必须上班。对调保证每人休息总数不变。
    for(const n of state.staff){
      if(Date.now() >= deadline) break;
      for(let d1=0; d1<7; d1++){
        const c1 = R[n][d1];
        if((week[n][d1]||"") !== "rest") continue;  // 只挪「休息」格子
        if(c1.off) continue;                        // 请假钉死的休息日不动
        if(isMan(n,d1)) continue;                   // 手动改过的休息日不动
        for(let d2=0; d2<7; d2++){
          if(d2===d1) continue;
          const c2 = R[n][d2];
          if(c2.off || c2.only || c2.noOff) continue;
          const v1 = week[n][d1]||"";               // 内层重读：前一次换班被接受后 d1 已不是休息日
          if(v1 !== "rest") break;
          const v2 = week[n][d2]||"";
          if(v2==="" || v2==="rest") continue;      // 对调对象是「班次」，保证休息总数不变
          if(isMan(n,d2)) continue;                 // 手动班次也不覆盖
          week[n][d1] = v2; week[n][d2] = "rest";
          const s = polishScore(week, R, skipIso);
          if(s < base){ base = s; steps++; progressed = true; break; }
          else { week[n][d1] = v1; week[n][d2] = v2; }
        }
      }
    }
  }
  return steps;
}
function repatchWeek(silent, dom){
  dom = dom || curDomain();
  if(domainSchedulable(dom).length < 2 && !fixedRosterOf(dom)){
    toast(`「${domLabel(dom)}」至少需要 2 名非经理人员`); return;
  }
  const allStaff = state.staff.slice();
  const k = curKey();
  const week = ensureWeek(k);
  const reqs = activeRequests(k).filter(r=> inDomain(r.name, dom));
  // 同 autoSchedule：临时切到本领域的需求 / 规则，save() 之前一定还原
  const bakNeeds = state.needs, bakLimits = state.limits, bakRest = state.restMax, bakDom = state.domain;
  state.domain = dom;            // 内部 helper 走 curDomain()，必须先切到目标领域，否则拿到另一个领域的规则表
  state.needs = domNeeds(dom);
  state.limits = domLimits(dom);
  state.restMax = domRestMax(dom);
  const restoreDomain = ()=>{ state.staff = allStaff; state.needs = bakNeeds; state.limits = bakLimits; state.restMax = bakRest; state.domain = bakDom; };
  try{
  /* 固定班表的人**不能进算法的人力池**：他们的班次是写死的，不参与分配。
     混进去会让算法以为多了几个可用人力，算出「排不满」的班表。 */
  const fixedAll = allFixedRosterNames();
  state.staff = allStaff.filter(n=> inDomain(n, dom) && !blockedInDomain(n, dom) && fixedAll.indexOf(n)<0);
  const R = buildRules(k);
  if(!reqs.length && !silent){ toast("当前周没有请假 / 特殊班次安排"); return; }
  if(!reqs.length) return;

  // ① 清理违反规则的格子
  let cleared = 0;
  const manK = state.manual[k] = state.manual[k] || {};
  state.staff.forEach(n=>{
    for(let d=0; d<7; d++){
      const c = R[n][d], v = week[n][d]||"";
      let force = false;
      if(c.off && v !== "rest"){
        // 请假 → 强制休息；同时把他原本的休息日改为「待排」，避免团队总人力凭空少一天
        week[n][d] = "rest"; cleared++; force = true;
        // 让出来的休息名额只能落在「本来就是休息日、且不是请假日 / 必须上班日」的那天上。
        // 若不加这两个条件，同一个人请两天假时，第二个假日会把第一个假日（刚被设成 rest）
        // 当成「可让出的名额」清成空格 —— 请假日变成「未安排」。
        const d0 = [...Array(7).keys()].find(x =>
          x !== d && (week[n][x]||"") === "rest" && !R[n][x].off && !R[n][x].noOff);
        if(d0 !== undefined) week[n][d0] = "";
      }
      else if(c.only && v !== c.only && v !== ""){ week[n][d] = ""; cleared++; force = true; } // 改班 → 清空重排
      else if(c.ban[v] && v){ week[n][d] = ""; cleared++; force = true; }               // 禁排 → 清空重排
      else if(c.noOff && !c.only && v === "rest"){ week[n][d] = ""; cleared++; force = true; } // 必须上班
      if(force) delete manK[n+"|"+d];   // 规则优先：被强制清掉的格子不再算「手动」
    }
  });
  // ② 固定班次：直接落位（用户明确指定的班次优先级最高）
  let forced = 0;
  state.staff.forEach(n=>{
    for(let d=0; d<7; d++){
      const c = R[n][d];
      if(c.only && !(week[n][d]||"")){ week[n][d] = c.only; forced++; }
    }
  });
  // ③ 固定班落位后若某人休息不足**下界** → 把他某天的「富余班次」改为休息，再由 fillGaps 补回
  const restPerCfg3 = restRange().min;
  state.staff.forEach(n=>{
    let g2 = 0;
    while(week[n].filter(v=>v==="rest").length < restPerCfg3 && g2 < 7){
      g2++;
      const d2 = [...Array(7).keys()].find(d=>{
        const v = week[n][d] || "";
        if(v === "" || v === "rest") return false;
        if(R[n][d].only || R[n][d].noOff) return false;
        if(wouldIsolateWeek(week, n, d)) return false; // 不能造出「上一休一」
        const need = +state.needs[d][v] || 0;
        const have = state.staff.filter(x=> week[x][d] === v).length;
        return have > need; // 只撤富余的班次，避免制造新缺口
      });
      if(d2 === undefined) break;
      week[n][d2] = "rest";
    }
  });
  // ④ 补齐因此产生的空缺
  const res = fillGaps(week, R);
  // ⑤ 补满勤：请假日的休息名额被让出来后若还有空格，用中班 / 晚班补齐（不动人数固定的早班）
  const surplusAdded = absorbSurplus(week, R);
  // ⑤b 局部交换修复：不碰休息日与规则锁定格子，把 fillGaps 补不出的
  //     残留冲突（三连早 / 晚接早 / 超上限 / 缺班 / 分组缺人）能换掉的尽量换掉
  const polished = polishWeek(week, R, k);
  restoreDomain();
  save(); renderAll();

  // 成败判定改用完整自检（patchViolations 里已含请假与缺班），
  // 否则会出现「提示说全部满足、班表却带着三连早」的自相矛盾
  const viol = patchViolations(week, R, k);
  let msg = `🔄 已按 ${reqs.length} 条安排微调：调整 ${cleared} 处、补班 ${res.added} 人次`;
  if(forced) msg += `、落位固定班 ${forced} 处`;
  if(res.restMoved) msg += `、轮换休息日 ${res.restMoved} 处`;
  if(polished) msg += `、换班修复 ${polished} 步`;
  if(res.usedRest) msg += `（另有 ${res.usedRest} 人次临时动用休息日，相关同事本周只休 1 天）`;
  if(viol.length)
    msg += ` ｜ ⚠️ 仍有 ${viol.length} 处冲突：${viol.slice(0,2).join("、")}${viol.length>2?" 等":""}，可点「✨ 一键智能排班」重排整周`;
  else
    msg += " ｜ ✅ 全部安排已满足，其余人班次保持不变";
  if(!silent) toast(msg);
  return msg;
  } finally { restoreDomain(); }
}
function uiIcon(name){return UI_ICONS[name] || "";}
function getStaffProfile(name){
  const raw = (state.staffProfiles && state.staffProfiles[name]) || {};
  const roster = ROSTER_PROFILES[name];
  const inEarly = groupMembers("earlyNight").includes(name);
  const inOpenClose = groupMembers("openClose").includes(name);
  let base = roster
    ? {module:roster.module, position:roster.position, level:roster.level, tags:[roster.position]}
    : {module:"通用组", position:"门店员工", level:"正式员工", tags:[]};
  if(!roster && inEarly) base = {module:groupLabel("earlyNight"), position:"保障岗", level:"正式员工", tags:["早晚保障"]};
  else if(!roster && inOpenClose) base = {module:"开店闭店组", position:"运营岗", level:"正式员工", tags:["开店闭店"]};
  return {
    module: String(raw.module || base.module).trim() || base.module,
    position: String(raw.position || base.position).trim() || base.position,
    level: String(raw.level || base.level).trim() || base.level,
    tags: Array.isArray(raw.tags) ? raw.tags.map(x=>String(x).trim()).filter(Boolean) : base.tags
  };
}
function collectStaffProfiles(){
  const profiles = {};
  state.staff.forEach(name=>{ profiles[name] = getStaffProfile(name); });
  return profiles;
}
function moduleColorMap(){
  const modules = [...new Set(state.staff.map(name=>getStaffProfile(name).module))];
  const map = {};
  modules.forEach((name,i)=>{ map[name] = STAFF_MODULE_PALETTE[i % STAFF_MODULE_PALETTE.length]; });
  return map;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escapeAttr(s){ return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,"&quot;"); }
function hasRestPlan(offDays, P, mustDays){
  const forced = new Set(offDays || []);
  const banned = new Set(mustDays || []);
  const free = [];
  for(let d=0; d<7; d++) if(!forced.has(d) && !banned.has(d)) free.push(d);
  const need = P - forced.size;
  if(need < 0 || need > free.length) return false;
  const pick = [];
  let found = false;
  (function dfs(i){
    if(found) return;
    if(pick.length === need){
      if(isolatedRestCount(new Set([...forced, ...pick])) === 0) found = true;
      return;
    }
    for(let k=i; k<free.length && !found; k++){ pick.push(free[k]); dfs(k+1); pick.pop(); }
  })(0);
  return found;
}
function effectiveScheduleData(){
  const map = {};
  statsArchive.forEach(a=>{ if(a.weekKey && a.schedule && typeof a.schedule === "object") map[a.weekKey] = a.schedule; });
  Object.keys(state.schedule || {}).forEach(k=>{ map[k] = state.schedule[k]; });
  return map;
}
function currentWeekHasData(){
  const week = state.schedule[curKey()] || {};
  return Object.values(week).some(arr=>Array.isArray(arr) && arr.some(v=>v==="early" || v==="mid" || v==="night" || v==="rest"));
}
function analyticsKeyDate(key){
  try{
    const t = parseDateToken(key);
    return t ? dateObj(t) : null;
  }catch(e){ return null; }
}
function hasWeekData(key){
  const week = effectiveScheduleData()[key];
  if(!week || typeof week !== "object") return false;
  return Object.values(week).some(arr=>Array.isArray(arr) && arr.some(v=>v==="early" || v==="mid" || v==="night" || v==="rest"));
}
function analyticsWeeks(start, end){
  return Object.keys(effectiveScheduleData()).filter(k=>{
    const d = analyticsKeyDate(k);
    return d && fmt(d) >= start && fmt(d) <= end && hasWeekData(k);
  }).sort();
}
function weekAnalytics(key){
  if(!hasWeekData(key) || !state.staff.length) return null;
  const week = effectiveScheduleData()[key] || {};
  let shifts = 0, hours = 0, early = 0, mid = 0, night = 0, weekend = 0, rest = 0, planned = 0;
  state.staff.forEach(name=>{
    const arr = week[name] || [];
    for(let d=0; d<7; d++){
      const v = arr[d] || "";
      if(v) planned++;
      if(v === "rest") rest++;
      if(v === "early" || v === "mid" || v === "night"){
        shifts++;
        if(d >= 5) weekend++;
        if(v === "early"){ early++; hours += 9; }
        else if(v === "mid"){ mid++; hours += 9; }
        else { night++; hours += 9.5; }
      }
    }
  });
  const demand = state.needs.reduce((sum,d)=>sum+(+d.early||0)+(+d.mid||0)+(+d.night||0),0);
  const staffCount = state.staff.length || 1;
  return {key, shifts, hours, early, mid, night, weekend, rest, planned, staffCount,
    avgShifts:shifts/staffCount, avgHours:hours/staffCount,
    coverage:demand ? Math.min(100, shifts/demand*100) : 0,
    weekendShare:shifts ? weekend/shifts*100 : 0,
    heavyShare:shifts ? (early+night)/shifts*100 : 0};
}
function analyticsYears(){
  const years = [...new Set(Object.keys(effectiveScheduleData()).map(k=>analyticsKeyDate(k)).filter(Boolean).map(d=>d.getFullYear()))];
  const y = currentMonday.getFullYear();
  if(!years.includes(y)) years.push(y);
  return years.sort((a,b)=>b-a);
}
function analyticsRange(period){
  const d = new Date(currentMonday);
  const y = d.getFullYear();
  if(period === "week"){
    const start = fmt(mondayOf(d));
    const endDate = new Date(mondayOf(d)); endDate.setDate(endDate.getDate()+6);
    return [start, fmt(endDate)];
  }
  if(period === "quarter"){
    const q = Math.floor(d.getMonth()/3);
    return [fmt(new Date(y,q*3,1)), fmt(new Date(y,q*3+3,0))];
  }
  if(period === "year") return [`${y}-01-01`, `${y}-12-31`];
  const keys = Object.keys(effectiveScheduleData()).filter(hasWeekData).sort();
  return keys.length ? [keys[0], keys[keys.length-1]] : [fmt(d), fmt(d)];
}
function svgChartFrame(inner, labels, leftMax, rightLabel){
  const W=900,H=270,l=46,r=48,t=18,b=34;
  const rows = 4, grid=[];
  for(let i=0;i<=rows;i++){
    const y=t+i*(H-t-b)/rows;
    grid.push(`<line x1="${l}" y1="${y}" x2="${W-r}" y2="${y}" class="chart-grid"/>`);
    grid.push(`<text x="${l-8}" y="${y+4}" text-anchor="end" class="chart-axis">${Math.round(leftMax-(leftMax*i/rows))}</text>`);
    grid.push(`<text x="${W-r+8}" y="${y+4}" class="chart-axis">${Math.round(100-(100*i/rows))}%</text>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="trend-svg" role="img" aria-label="${rightLabel}">
    ${grid.join("")}
    ${labels.map(v=>`<text x="${v.x}" y="${H-10}" text-anchor="middle" class="chart-axis">${v.label}</text>`).join("")}
    ${inner}
  </svg>`;
}
function monthBounds(y, m){ return [fmt(new Date(y, m-1, 1)), fmt(new Date(y, m, 0))]; }
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function roleFlowAssign(week, members, openN, closeN, maxPer){
  const M = members.length;
  const out = {}, cnt = {};
  members.forEach(n=>{ out[n] = ["","","","","","",""]; cnt[n] = 0; });
  const specs = [];
  if(openN  > 0) specs.push({sh:"early", role:"open",  need:openN});
  if(closeN > 0) specs.push({sh:"night", role:"close", need:closeN});
  const R = specs.length;
  const totalNeed = specs.reduce((a,s)=> a + s.need, 0) * 7;
  if(R === 0 || M === 0) return {roles:out, cnt, short:totalNeed, total:0, need:totalNeed};

  // 节点：S=0 ｜ 天×类 ｜ 天×人 ｜ 人 ｜ T
  const S = 0;
  const nDR = (ri,d)=> 1 + ri*7 + d;
  const nDM = (d,i)=> 1 + 7*R + d*M + i;
  const nM  = i    => 1 + 7*R + 7*M + i;
  const T  = 1 + 7*R + 7*M + M;
  const g = Array.from({length:T+1}, ()=> []);
  const addEdge = (u,v,c)=>{
    g[u].push({to:v, cap:c, rev:g[v].length});
    g[v].push({to:u, cap:0, rev:g[u].length - 1});
  };
  const order = shuffle(members.map((_,i)=> i));      // 打乱 → 每轮挑到不同的人，多轮取优
  specs.forEach((s, ri)=>{
    for(let d=0; d<7; d++){
      addEdge(S, nDR(ri,d), s.need);
      order.forEach(i=>{ const n = members[i]; if(week[n] && week[n][d] === s.sh) addEdge(nDR(ri,d), nDM(d,i), 1); });
    }
  });
  for(let d=0; d<7; d++) for(let i=0; i<M; i++) addEdge(nDM(d,i), nM(i), 1);   // 一人一天只担一个名额
  for(let i=0; i<M; i++) addEdge(nM(i), T, maxPer);

  // Edmonds-Karp：每次 BFS 找一条增广路（图很小，够快）
  let flow = 0;
  while(flow < totalNeed){
    const pre = new Array(T+1).fill(null), seen = new Array(T+1).fill(false);
    seen[S] = true;
    const q = [S];
    for(let qi=0; qi<q.length; qi++){
      const u = q[qi];
      for(const e of g[u]) if(e.cap > 0 && !seen[e.to]){ seen[e.to] = true; pre[e.to] = {u, e}; q.push(e.to); }
      if(seen[T]) break;
    }
    if(!seen[T]) break;
    let aug = Infinity;
    for(let v=T; v!==S; v=pre[v].u) aug = Math.min(aug, pre[v].e.cap);
    for(let v=T; v!==S; v=pre[v].u){ const p = pre[v]; p.e.cap -= aug; g[v][p.e.rev].cap += aug; }
    flow += aug;
  }
  // 读出流量 → 分工表（容量 1 的边被用掉 = 这个人接下这个名额）
  specs.forEach((s, ri)=>{
    for(let d=0; d<7; d++) for(const e of g[nDR(ri,d)]){
      if(e.to >= 1+7*R && e.to < 1+7*R+7*M && e.cap === 0){
        const rel = e.to - (1 + 7*R);
        if(Math.floor(rel / M) === d){ const n = members[rel % M]; out[n][d] = s.role; cnt[n]++; }
      }
    }
  });
  return {roles:out, cnt, short: totalNeed - flow, total: flow, need: totalNeed};
}
function weekRoleShort(week){
  const gOc = state.groups && state.groups.openClose;
  const members = groupMembers("openClose");
  const openN  = (gOc && +gOc.open  || 0), closeN = (gOc && +gOc.close || 0);
  const maxPer = Math.min(7, Math.max(1, (gOc && +gOc.maxPerWeek) || 3));
  if(!week || members.length === 0 || (openN + closeN) === 0) return 0;
  return roleFlowAssign(week, members, openN, closeN, maxPer).short;
}
function shiftGapOf(week, n, shift, override){
  const get = d => (override && override.d === d) ? override.sh : ((week[n] && week[n][d]) || "");
  const ds = [];
  for(let d=0; d<7; d++) if(get(d) === shift) ds.push(d);
  if(ds.length < 2) return 0;                    // 只上 1 天谈不上有节奏
  const ideal = 7 / ds.length;
  let bad = 0;
  for(let k=0; k<ds.length; k++){
    const nxt = ds[(k+1) % ds.length];
    const g = k === ds.length-1 ? (7 - ds[k] + nxt) : (nxt - ds[k]);   // 最后一段跨周边界
    bad += Math.abs(g - ideal);
  }
  return bad;
}
function balanceShifts(week, R, k){
  const N = state.staff.length;
  if(N < 3) return 0;
  const lim = state.limits || {};
  const at = (n,d)=> week[n][d] || "";
  const cnt = (n, sh)=>{ let c=0; for(let d=0; d<7; d++) if(at(n,d)===sh) c++; return c; };
  const ruleOK = (n, d, sh)=>{
    const c = R && R[n] && R[n][d];
    if(!c) return true;
    if(c.off) return false;
    if(c.only && c.only !== sh) return false;
    if(c.ban && c.ban[sh]) return false;
    return true;
  };
  /* 分组保底：互换只在两个人之间对调班次，当天各班次的总人数不变，
     所以「班次人数≥需求」这类规则天生安全；唯一会被动到的是「按组看身份」的保底
     （早晚保障组每天至少 N 人早 / N 人晚、开店闭店组每天至少 open 人早 + close 人晚）。
     这里显式试算互换后的组内人数：本来就达标的，换完必须仍达标；
     本来就不达标（前序步骤遗留），至少不能变得更差。 */
  const gEn = state.groups && state.groups.earlyNight;
  const gOc = state.groups && state.groups.openClose;
  const enSet = new Set(groupMembers("earlyNight"));
  const ocSet = new Set(groupMembers("openClose"));
  const grpCounts = (d, ov1, ov2)=>{
    const shAt = n=>{
      if(ov1 && ov1.n === n && ov1.d === d) return ov1.sh;
      if(ov2 && ov2.n === n && ov2.d === d) return ov2.sh;
      return at(n,d);
    };
    const c = {enE:0, enN:0, ocE:0, ocN:0};
    state.staff.forEach(n=>{
      const v = shAt(n);
      if(enSet.has(n)){ if(v === "early") c.enE++; else if(v === "night") c.enN++; }
      if(ocSet.has(n)){ if(v === "early") c.ocE++; else if(v === "night") c.ocN++; }
    });
    return c;
  };
  const groupOK = (hi, lo, d, shB)=>{
    const b = grpCounts(d);
    const a = grpCounts(d, {n:hi, d, sh:shB}, {n:lo, d, sh:"early"});
    const req = [
      [a.enE, b.enE, (gEn && +gEn.minEarly) || 0],
      [a.enN, b.enN, (gEn && +gEn.minNight) || 0],
      [a.ocE, b.ocE, (gOc && +gOc.open)     || 0],
      [a.ocN, b.ocN, (gOc && +gOc.close)    || 0]
    ];
    return req.every(([after, before, need])=> after >= Math.min(need, before));
  };
  const eCnt = {};
  state.staff.forEach(n=> eCnt[n] = cnt(n, "early"));
  const totalE = state.staff.reduce((s,n)=> s + eCnt[n], 0);
  const avg = totalE / N;
  // 晚班一侧也要跟着记账：互换在 shB === "night" 时会动到「谁上晚班」，
  // 只看早班的话，「早班更平、晚班更歪」会被当成纯赚 —— 实测会把晚班分布越换越散。
  const nCnt = {};
  state.staff.forEach(n=> nCnt[n] = cnt(n, "night"));
  const avgN = state.staff.reduce((s,n)=> s + nCnt[n], 0) / N;

  // 某人某班次的日期分布有多不匀（0 = 完全等距）。override 用来试算「把 d 改成 sh 之后」的值。
  const personGap = (n, override)=> shiftGapOf(week, n, "early", override);
  // 总代价 = 次数偏离 × 10 + 间隔偏离 × 1：平均优先，匀了之后再顺手把节奏理顺
  const W_CNT = 10, W_GAP = 1;
  const costOf = ()=>{
    let c = 0;
    state.staff.forEach(n=>{ c += Math.abs(eCnt[n] - avg) * W_CNT + personGap(n) * W_GAP; });
    return c;
  };

  let swapped = 0;
  /* 均衡只该动「谁上哪天早班」，不该把开闭分工的空间挤掉：
     互换会改变该组成员在早/晚班上的落点，可能让某天的名额被钉死在同一个人身上。
     所以每次换完都重新判定一次开闭名额，变差了就撤销并把这一手拉黑（同一个 hi/lo/天 不再试）。 */
  const banned = new Set();
  const baseShort = weekRoleShort(week);
  for(let iter=0; iter<400; iter++){
    // 高于人均的都算「多」，低于人均的都算「少」
    const his = state.staff.filter(n=> eCnt[n] > avg + 0.01).sort((a,b)=> eCnt[b] - eCnt[a]);
    const los = state.staff.filter(n=> eCnt[n] < avg - 0.01).sort((a,b)=> eCnt[a] - eCnt[b]);
    if(!his.length || !los.length) break;
    // 试遍所有配对与所有天，挑「总代价降得最多」的一次交换（必须真的降才执行）
    let bestGain = 0, bestMove = null;
    for(const hi of his){
      for(const lo of los){
        for(let d=0; d<7; d++){
          if(at(hi,d) !== "early") continue;
          if(banned.has(hi + "|" + lo + "|" + d)) continue;
          const shB = at(lo,d);
          if(shB !== "mid" && shB !== "night") continue;      // 对方当天得在上班（动休息日会破坏配额）
          if(!ruleOK(hi,d,shB) || !ruleOK(lo,d,"early")) continue;
          // hi 换成 shB 之后
          if(shB === "night" && at(hi,(d+1)%7) === "early") continue;   // 晚班次日不接早班
          if(cnt(hi,shB) + 1 > (lim[shB]||99)) continue;                // 班次周上限
          // lo 换成 early 之后
          if(at(lo,(d+6)%7) === "night") continue;                      // 前一天晚班 → 今天不能早班
          if(cnt(lo,"early") + 1 > (lim.early||99)) continue;
          if(wouldEarlyRun3(x => x === d ? "early" : at(lo,x), d)) continue;   // 不能三连早
          // 周末两天都早班：开店闭店组强制换人，保守起见两种情况都不动
          if(d === 5 && at(lo,6) === "early") continue;
          if(d === 6 && at(lo,5) === "early") continue;
          if(!groupOK(hi, lo, d, shB)) continue;                 // 分组保底不能被打破
          const gain = (Math.abs(eCnt[hi]-avg) + Math.abs(eCnt[lo]-avg)
                        - Math.abs(eCnt[hi]-1-avg) - Math.abs(eCnt[lo]+1-avg)) * W_CNT
                     + (personGap(hi) + personGap(lo)
                        - personGap(hi, {d, sh:shB}) - personGap(lo, {d, sh:"early"})) * W_GAP
                     // 让出 / 接手的若是晚班，晚班的次数与间隔一并计入代价（两个均衡器共用一个目标，
                     // 单次交换只在这一个目标确实下降时才接受，所以不会互相把对方拉歪）
                     + (shB === "night"
                        ? (Math.abs(nCnt[hi]-avgN) + Math.abs(nCnt[lo]-avgN)
                           - Math.abs(nCnt[hi]+1-avgN) - Math.abs(nCnt[lo]-1-avgN)) * W_CNT : 0)
                     + (shB === "night"
                        ? (shiftGapOf(week,hi,"night") + shiftGapOf(week,lo,"night")
                           - shiftGapOf(week,hi,"night",{d, sh:shB})
                           - shiftGapOf(week,lo,"night",{d, sh:"early"})) * W_GAP : 0);
          if(gain > bestGain){ bestGain = gain; bestMove = {hi, lo, d, shB}; }
        }
      }
    }
    if(!bestMove) break;                             // 没有能变好的交换了 → 收工
    const oldHi = week[bestMove.hi][bestMove.d], oldLo = week[bestMove.lo][bestMove.d];
    week[bestMove.hi][bestMove.d] = bestMove.shB;
    week[bestMove.lo][bestMove.d] = "early";
    if(weekRoleShort(week) > baseShort){             // 换完开闭名额反而更难分了 → 还原 + 拉黑
      week[bestMove.hi][bestMove.d] = oldHi;
      week[bestMove.lo][bestMove.d] = oldLo;
      banned.add(bestMove.hi + "|" + bestMove.lo + "|" + bestMove.d);
      continue;
    }
    eCnt[bestMove.hi]--; eCnt[bestMove.lo]++;
    if(bestMove.shB === "night"){ nCnt[bestMove.hi]++; nCnt[bestMove.lo]--; }
    swapped++;
  }
  return swapped;
}
function balanceNightShifts(week, R, k){
  const N = state.staff.length;
  if(N < 3) return 0;
  const lim = state.limits || {};
  const at = (n,d)=> week[n][d] || "";
  const cnt = (n, sh)=>{ let c=0; for(let d=0; d<7; d++) if(at(n,d)===sh) c++; return c; };
  const ruleOK = (n, d, sh)=>{
    const c = R && R[n] && R[n][d];
    if(!c) return true;
    if(c.off) return false;
    if(c.only && c.only !== sh) return false;
    if(c.ban && c.ban[sh]) return false;
    return true;
  };
  const gEn = state.groups && state.groups.earlyNight;
  const gOc = state.groups && state.groups.openClose;
  const enSet = new Set(groupMembers("earlyNight"));
  const ocSet = new Set(groupMembers("openClose"));
  // 试算「hi 第 d 天改成 shB、lo 第 d 天改成 night」之后的组内人数（口径同 balanceShifts）
  const grpCounts = (d, ov1, ov2)=>{
    const shAt = n=>{
      if(ov1 && ov1.n === n && ov1.d === d) return ov1.sh;
      if(ov2 && ov2.n === n && ov2.d === d) return ov2.sh;
      return at(n,d);
    };
    const c = {enE:0, enN:0, ocE:0, ocN:0};
    state.staff.forEach(n=>{
      const v = shAt(n);
      if(enSet.has(n)){ if(v === "early") c.enE++; else if(v === "night") c.enN++; }
      if(ocSet.has(n)){ if(v === "early") c.ocE++; else if(v === "night") c.ocN++; }
    });
    return c;
  };
  const groupOK = (hi, lo, d, shB)=>{
    const b = grpCounts(d);
    const a = grpCounts(d, {n:hi, d, sh:shB}, {n:lo, d, sh:"night"});
    const req = [
      [a.enE, b.enE, (gEn && +gEn.minEarly) || 0],
      [a.enN, b.enN, (gEn && +gEn.minNight) || 0],
      [a.ocE, b.ocE, (gOc && +gOc.open)     || 0],
      [a.ocN, b.ocN, (gOc && +gOc.close)    || 0]
    ];
    return req.every(([after, before, need])=> after >= Math.min(need, before));
  };
  const nCnt = {}, eCnt = {};
  state.staff.forEach(n=>{ nCnt[n] = cnt(n, "night"); eCnt[n] = cnt(n, "early"); });
  const totalN = state.staff.reduce((s,n)=> s + nCnt[n], 0);
  const avg = totalN / N;
  const avgE = state.staff.reduce((s,n)=> s + eCnt[n], 0) / N;
  const W_CNT = 10, W_GAP = 1;
  let swapped = 0;
  const banned = new Set();
  const baseShort = weekRoleShort(week);
  for(let iter=0; iter<400; iter++){
    const his = state.staff.filter(n=> nCnt[n] > avg + 0.01).sort((a,b)=> nCnt[b] - nCnt[a]);
    const los = state.staff.filter(n=> nCnt[n] < avg - 0.01).sort((a,b)=> nCnt[a] - nCnt[b]);
    if(!his.length || !los.length) break;
    let bestGain = 0, bestMove = null;
    for(const hi of his){
      for(const lo of los){
        for(let d=0; d<7; d++){
          if(at(hi,d) !== "night") continue;
          if(banned.has(hi + "|" + lo + "|" + d)) continue;
          const shB = at(lo,d);
          // 对方当天得在上班，且不是晚班（否则 hi 的晚班没让出去、次数不变）
          if(shB !== "early" && shB !== "mid") continue;
          if(!ruleOK(hi,d,shB) || !ruleOK(lo,d,"night")) continue;
          // lo 接晚班之后
          if(cnt(lo,"night") + 1 > (lim.night||99)) continue;        // 晚班周上限
          if(at(lo,(d+1)%7) === "early") continue;                   // 晚班次日不接早班
          // hi 让出晚班之后（hi 只在 shB === "early" 时会新增一个早班）
          if(shB === "early"){
            if(cnt(hi,"early") + 1 > (lim.early||99)) continue;      // 早班周上限
            if(at(hi,(d+6)%7) === "night") continue;                 // 前一天晚班 → 今天不能早班
            if(wouldEarlyRun3(x => x === d ? "early" : at(hi,x), d)) continue;  // 不能三连早
            if(d === 5 && at(hi,6) === "early") continue;            // 周末连上早班：一律不制造
            if(d === 6 && at(hi,5) === "early") continue;
          }
          if(!groupOK(hi, lo, d, shB)) continue;                     // 分组保底不能被打破
          const gain = (Math.abs(nCnt[hi]-avg) + Math.abs(nCnt[lo]-avg)
                        - Math.abs(nCnt[hi]-1-avg) - Math.abs(nCnt[lo]+1-avg)) * W_CNT
                     + (shiftGapOf(week, hi, "night") + shiftGapOf(week, lo, "night")
                        - shiftGapOf(week, hi, "night", {d, sh:shB})
                        - shiftGapOf(week, lo, "night", {d, sh:"night"})) * W_GAP
                     // 接手的是早班时，早班的次数与间隔一并计入代价 —— 与 balanceShifts 共用同一个目标，
                     // 否则晚班匀了、早班却被换歪（实测早班偏离会从 1.9 涨到 13+）
                     + (shB === "early"
                        ? (Math.abs(eCnt[hi]-avgE) + Math.abs(eCnt[lo]-avgE)
                           - Math.abs(eCnt[hi]+1-avgE) - Math.abs(eCnt[lo]-1-avgE)) * W_CNT : 0)
                     + (shB === "early"
                        ? (shiftGapOf(week,hi,"early") + shiftGapOf(week,lo,"early")
                           - shiftGapOf(week,hi,"early",{d, sh:"early"})
                           - shiftGapOf(week,lo,"early",{d, sh:"night"})) * W_GAP : 0);
          if(gain > bestGain){ bestGain = gain; bestMove = {hi, lo, d, shB}; }
        }
      }
    }
    if(!bestMove) break;
    // 换完判断开闭名额还能不能分满；变差就还原 + 拉黑这一手（同 balanceShifts）
    const oldHi = week[bestMove.hi][bestMove.d], oldLo = week[bestMove.lo][bestMove.d];
    week[bestMove.hi][bestMove.d] = bestMove.shB;
    week[bestMove.lo][bestMove.d] = "night";
    if(weekRoleShort(week) > baseShort){
      week[bestMove.hi][bestMove.d] = oldHi;
      week[bestMove.lo][bestMove.d] = oldLo;
      banned.add(bestMove.hi + "|" + bestMove.lo + "|" + bestMove.d);
      continue;
    }
    nCnt[bestMove.hi]--; nCnt[bestMove.lo]++;
    if(bestMove.shB === "early"){ eCnt[bestMove.hi]++; eCnt[bestMove.lo]--; }
    swapped++;
  }
  return swapped;
}
function weekRestSet(week, n){
  const s = new Set();
  for(let d=0; d<7; d++){ const v = (week[n]||[])[d]; if(v === "rest" || v === "") s.add(d); }
  return s;
}
function canRestOn(week, R, n, d){
  const c = R && R[n] && R[n][d];
  const cur = (week[n]||[])[d] || "";
  if(cur !== "rest" && cur !== "") return false;      // 已经有班了，不动
  if(c && c.off) return true;                          // 请假：本来就该休
  if(c && (c.only || c.noOff)) return false;           // 固定班 / 必须上班
  return true;
}
function fixRun3Rest(week, R){
  const staff = (state.staff||[]).filter(n=> week[n]);
  if(staff.length < 2) return 0;
  const at  = (n,d)=> (week[n][d]||"");
  const isRest = (n,d)=>{ const v = at(n,d); return v==="rest" || v===""; };
  const modMin = moduleMinOn();
  const modOf = n => getStaffProfile(n).module;
  const run3Of = n => run3RestCount(weekRestSet(week, n));
  const LIM = state.limits || {early:3, night:3, mid:99};   // 班次周上限，挪休息日时不能超
  let cur = staff.reduce((s,n)=> s + run3Of(n), 0);
  if(!cur) return 0;
  // 模块在岗计数（换完之后不能把某模块当天压到下限以下）
  const modOnCount = (m,d)=>{
    let c = 0;
    staff.forEach(n=>{ if(modOf(n)===m && !isRest(n,d)) c++; });
    return c;
  };
  const modSize = {};
  staff.forEach(n=>{ const m=modOf(n); modSize[m]=(modSize[m]||0)+1; });
  const banned = new Set();
  let fixed = 0;
  for(let round=0; round<12 && cur>0; round++){
    let moved = false;
    for(const A of staff){
      if(!moved && run3Of(A) === 0) continue;
      const rA = weekRestSet(week, A);
      for(const a of rA){
        if(moved) break;
        for(const B of staff){
          if(moved) break;
          if(B === A) continue;
          const rB = weekRestSet(week, B);
          for(const b of rB){
            if(a === b) continue;
            if(banned.has(A+"|"+B+"|"+a+"|"+b)) continue;
            // 对调：A 的休息日 a ↔ B 的休息日 b。互换后 A 在 b 上班、B 在 a 休息。
            // 必须满足：A 的 b 天不是固定班 / 必须上班；B 的 a 天同理
            if(!canRestOn(week, R, B, a)) continue;   // B 能在 a 休
            const vA_a = at(A,a), vA_b = at(A,b), vB_a = at(B,a), vB_b = at(B,b);
            // 记下「改之前」两人的 run3 / 孤立数：rA、rB 是循环开头取的快照，
            // 中途可能已被别的候选改掉，所以这里现场重算一遍当前值。
            const oA = run3Of(A), oB = run3Of(B);
            const isoA = isolatedRestCount(weekRestSet(week, A)), isoB = isolatedRestCount(weekRestSet(week, B));
            // 先试算：临时改，检查两条 run3 与模块在岗
            week[A][a] = vB_a; week[B][a] = vA_a;
            week[A][b] = vB_b; week[B][b] = vA_b;
            const nA = run3RestCount(weekRestSet(week, A)), nB = run3RestCount(weekRestSet(week, B));
            const modOK = (modMin <= 0) || (Object.keys(modSize).every(m=>{
                if(modSize[m] <= modMin) return true;
                return [0,1,2,3,4,5,6].every(d=> modOnCount(m,d) >= modMin);
              }));
            // 接受条件：**A 本人的 3 连休必须减少，且 B 不能新增**。
            // 早前写成「两人总数必须下降」，会把「A 有 2 处、B 有 1 处 → 各留 1 处」
            // 这种明明 A 改善了的情况也拒掉，导致约 3/10 的排班残留违规。
            // 另加两条：不能造出新的孤立休息，也不能让任何人的休息天数跑出 [min, per]。
            const rr = restRange();
            const restOK = [A,B].every(x=>{
              const c = weekRestSet(week,x).size;
              return c >= rr.min && c <= rr.per;
            });
            const isoOK = (isolatedRestCount(weekRestSet(week,A)) <= isoA)
                       && (isolatedRestCount(weekRestSet(week,B)) <= isoB);
            const better = (nA < oA) && (nB <= oB);
            if(!(better && modOK && restOK && isoOK)){
              week[A][a] = vA_a; week[B][a] = vB_a;
              week[A][b] = vA_b; week[B][b] = vB_b;
              banned.add(A+"|"+B+"|"+a+"|"+b);
              continue;
            }
            cur = cur - run3Of(A) - run3Of(B) + nA + nB;
            fixed++; moved = true;
            break;
          }
        }
      }
    }
    if(!moved) break;
  }
  /* 第三条路径（关键）：**把 3 连休的那一天，整体搬到另一个日子**。
     为什么前两条路会走进死胡同（实测踩过的坑）：
     典型班表是「周一二三天全休、周四五上班」。这时周二不能改成上班 ——
     一改就变成「周一休-周二上-周三休」，造出「上一休一」；
     而「上一休一」和「3 连休」都是硬约束，两条同时生效时**互斥**：
     3 天休息日无论放哪一天，都会至少违反其中一条。
     所以唯一的出路不是「在原地塞一个人上班」，而是**把休息日挪走**：
     例如把周三的休息挪到周四（周四原本上班 → 改成休息），
     于是变成「一二休、周三上、周四休、五上」，3 连断开、也没有孤立休息。
     这里做的是「同一个人内部挪一天」：从他的休息日里挑一个 d，
     找一个能上班的工作日 w，把 w 改成休息、d 改成上班。 */
  cur = staff.reduce((s,n)=> s + run3Of(n), 0);
  for(const A of staff){
    if(run3Of(A) === 0) continue;
    for(let guard=0; guard<8 && run3Of(A) > 0; guard++){
      const setA = weekRestSet(week, A);
      const trips = [];
      for(let d=0; d<7; d++) if(setA.has(d) && setA.has((d+1)%7) && setA.has((d+2)%7)) trips.push(d);
      if(!trips.length) break;
      let done = false;
      for(const t of trips){
        if(done) break;
        // 候选：把休息日 d 改成上班，同时把工作日 w 改成休息
        for(const d of [t,(t+1)%7,(t+2)%7]){
          if(done) break;
          const cd = (R && R[A] && R[A][d]) || {};
          if(cd.off || cd.only || cd.noOff) continue;       // 请假 / 固定班 / 必须上班
          for(const w of [0,1,2,3,4,5,6]){
            if(done) break;
            if(w === d || setA.has(w)) continue;              // w 必须是工作日
            const cw = (R && R[A] && R[A][w]) || {};
            if(cw.off) continue;                              // w 那天请假 → 不能改成休息
            const shW = at(A,w);
            // 优先沿用 w 原本的班次：这样各班次总数完全不变，只是「哪天上哪个班」挪了位置
            const cands = (shW === "early" || shW === "mid" || shW === "night") ? [shW] : ["mid","night","early"];
            for(const sh of cands){
              const cdw = (R && R[A] && R[A][d]) || {};
              if(cdw.ban && cdw.ban[sh]) continue;
              // w 从 shW 变成休息，d 从休息变成 sh → 各班次计数只挪一格
              const base = {early:0, mid:0, night:0};
              week[A].forEach(v=>{ if(base[v] !== undefined) base[v]++; });
              const after = {...base};
              after[shW] = (after[shW]||0) - 1;   // w 改成休息
              after[sh]   = (after[sh]||0) + 1;   // d 改成上班
              if(after[sh] > (LIM[sh]||99)) continue;
              if(after.early > (LIM.early||99) || after.night > (LIM.night||99)) continue;
              // 试算
              const oldD = at(A,d), oldW = at(A,w);
              week[A][w] = "rest";
              week[A][d] = sh;
              const nSet = weekRestSet(week, A);
              const ok = run3RestCount(nSet) === 0
                      && isolatedRestCount(nSet) === 0
                      && nSet.size === setA.size;              // 休息天数不变
              week[A][w] = oldW;
              week[A][d] = oldD;
              if(!ok) continue;
              week[A][w] = "rest";
              week[A][d] = sh;
              cur -= run3RestCount(weekRestSet(week,A)) > 0 ? 0 : 1;
              fixed++; done = true; break;
            }
          }
        }
      }
      if(!done) break;
    }
  }
  return fixed;
}
function fixModuleAllOff(week, R){
  const staff = (state.staff||[]).filter(n=> week[n]);
  const modMin = moduleMinOn();
  if(!modMin || staff.length < 2) return 0;
  const at     = (n,d)=> (week[n][d]||"");
  const isRest = (n,d)=>{ const v = at(n,d); return v==="rest" || v===""; };
  const isWork = (n,d)=>{ const v = at(n,d); return v==="early" || v==="mid" || v==="night"; };
  const modOf  = n => getStaffProfile(n).module;
  const byMod = new Map();
  staff.forEach(n=>{ const m = modOf(n); if(!byMod.has(m)) byMod.set(m, []); byMod.get(m).push(n); });
  const LIM = state.limits || {early:3, night:3, mid:99};
  const exact = Array.isArray(state.exactShifts) ? state.exactShifts : [];
  // 「不限人数」的班次：把人加进来不会让该班次超编（早班通常是人数固定班次，不在其列）
  const flex = ["mid","night"].filter(sh => !exact.includes(sh));
  const banned = new Set();
  let fixed = 0;
  // A 顶替 B 的班以后，A 自己的班次计数不能超上限、不能晚接早、不能连上三早
  const aCanTake = (A, d, sh)=>{
    const c = (R && R[A] && R[A][d]) || {};
    if(c.off) return false;                                  // 请假：不能上班
    if(c.only && c.only !== sh) return false;                // 固定班
    if(c.ban && c.ban[sh]) return false;                     // 禁排班次
    const cnt = {early:0, mid:0, night:0};
    for(let x=0; x<7; x++){ const v = x===d ? sh : (week[A][x]||""); if(cnt[v]!==undefined) cnt[v]++; }
    if(cnt[sh] > (LIM[sh]||99)) return false;                // 班次周上限
    const get = x => (x===d) ? sh : (week[A][x]||"");
    for(let x=0; x<7; x++) if(get(x)==="night" && get((x+1)%7)==="early") return false;   // 晚接早
    for(let x=0; x<7; x++)                                                // 连上三早（含跨周）
      if(get(x)==="early" && get((x+1)%7)==="early" && get((x+2)%7)==="early") return false;
    if(get(5)==="early" && get(6)==="early") return false;    // 周末连上早班
    return true;
  };
  // B 接过 A 的休息日：b 天改成 rest 之后，B 自己的休息日不能出现新的 3 连 / 孤立
  const bRestOK = (B, d, b)=>{
    const before = isolatedRestCount(weekRestSet(week, B));
    const old = week[B][b]; week[B][b] = "rest";
    const after = isolatedRestCount(weekRestSet(week, B));
    const r3 = run3RestCount(weekRestSet(week, B));
    week[B][b] = old;
    const c = (R && R[B] && R[B][d]) || {};
    if(c.off) return false;            // B 当天请假，本来就该休，换不动
    return after <= before && r3 === 0;
  };
  for(let pass=0; pass<24; pass++){
    let didAny = false;
    for(const [m, idxs] of byMod){
      if(moduleMinOnExempt(m)) continue;       // 排除名单（见 moduleMinOnExempt）
      if(idxs.length <= modMin) continue;      // 单人 / 等于下限的模块无法自洽，跳过
      for(let d=0; d<7 && !didAny; d++){
        const on = idxs.filter(n=> isWork(n,d)).length;
        if(on >= modMin) continue;                    // 已达标
        /* 严格守恒的对调（踩过的坑）：
           旧实现「A 顶 B 在 d 的班，B 在 d 改成休息」——注释说 B 会去 A 的休息日上班，
           但代码只写了 week[B][d]="rest"，B 并没有去 A 的休息日。
           结果 A 白白少休一天（可能跌破 min）、B 白多多休一天，全队休息总数失衡，
           而且 A 若没别的休息日可挪就直接失败 —— 实测小模块（2~3 人）几乎全军覆没。

           正确的对调是**双向**的，两人的休息天数都不变：
               A：d 休→上 B 的班，x 上→休      （A 的休息日 {d,x} → {x}，少了一个 d、多了个 x… 实为不变）
               B：d 上→休，x 休→上 A 原本的班 （B 的休息日同样一进一出）
           两天各有一个人顶上另一个人腾出的位置，在岗总人数与班次覆盖完全不变。 */
        let done = false;
        for(const A of idxs){
          if(done || !isRest(A,d)) continue;         // A 必须是模块 m 内、当天在休的人
          const restA = [...weekRestSet(week, A)];
          for(const B of staff){
            if(done) break;
            if(B === A || !isWork(B,d)) continue;    // B 必须是当天在岗的人
            const shB = at(B,d);
            if(shB!=="early" && shB!=="mid" && shB!=="night") continue;
            if(!aCanTake(A, d, shB)) continue;       // A 能顶 B 在 d 的班吗
            if(banned.has(A+"|"+B+"|"+d)) continue;
            // x：A 的另一个休息日。A 要在 x 让位给 B 去上班
            const xs = restA.filter(x=> x!==d).sort((x,y)=>Math.abs(x-d)-Math.abs(y-d));
            for(const x of xs){
              const shA = at(A,x);
              if(shA!=="early" && shA!=="mid" && shA!=="night") continue;  // A 在 x 本来就休，没班可让
              // B 能不能在 x 上 A 的班（请假 / 禁排 / 班次上限 / 晚接早 / 连三早 / 周末连早）
              const cB = (R && R[B] && R[B][x]) || {};
              if(cB.off || cB.only) continue;
              if(cB.ban && cB.ban[shA]) continue;
              const cntB = {early:0,mid:0,night:0};
              week[B].forEach(v=>{ if(cntB[v]!==undefined) cntB[v]++; });
              if(cntB[shA] >= (LIM[shA]||99)) continue;
              const getB = t => (t===x) ? shA : (week[B][t]||"");
              let bOK = true;
              for(let t=0;t<7;t++) if(getB(t)==="night" && getB((t+1)%7)==="early"){ bOK=false; break; }
              if(bOK) for(let t=0;t<7;t++) if(getB(t)==="early"&&getB((t+1)%7)==="early"&&getB((t+2)%7)==="early"){ bOK=false; break; }
              if(bOK && getB(5)==="early" && getB(6)==="early") bOK=false;
              if(!bOK) continue;
              if(!bRestOK(B, d, x)) continue;         // B 在 x 上班后，d 变休息，休息形状不能坏
              // 试算：A 让出 x、B 腾出 d，两人在岗天数一进一出
              const vA_d=week[A][d], vA_x=week[A][x], vB_d=week[B][d], vB_x=week[B][x];
              week[A][d]=shB; week[A][x]="rest"; week[B][d]="rest"; week[B][x]=shA;
              const on2 = idxs.filter(n=> isWork(n,d)).length;
              if(on2 > on){ fixed++; didAny = true; done = true; break; }
              // 不该发生，撤销
              week[A][d]=vA_d; week[A][x]=vA_x; week[B][d]=vB_d; week[B][x]=vB_x;
              banned.add(A+"|"+B+"|"+d);
            }
          }
        }
        /* ── 第二条路径：跨天「腾位补缺」──
           上一条路径要求 A 有一个「不同于 d 的休息日」让给 B。
           但 1~2 天配额下 A 完全可能只休 1 天（就是 d），那时 xs 为空，必然无解。
           实测剩余的模块失败全部收敛到这一形态：2~3 人小模块、两人休息日撞同一天、
           且谁都只有 1 天可休（例：3c/销售运营 2 人，周四双双全休）。

           这里改成：A 在 d 直接上班（自己挑不限人数的班次），
           同时把 A 在**某个工作日 x** 上的班让给当天休息的 C：
               A：d 休 → 上 sh_new      x 上 shA → 休    （A 的休息日 d 换成 x，数量不变）
               C：x 休 → 上 shA                             （C 少休一天，须保证仍 ≥ min）
           第 x 天每个班次人数不变（C 精确顶上 A 的班），第 d 天模块多一个在岗名额。
           与 fixGroupGuarantee 第五条路径同源，都是「让出位置给别人，自己空出来补缺口」。 */
        if(!done){
          const rrM = restRange();
          for(const A of idxs){
            if(done || !isRest(A,d)) continue;
            // A 在 d 能上什么班？早班是人数固定班次，加人会超编，优先用中班 / 晚班
            const cn = (R && R[A] && R[A][d]) || {};
            if(cn.off || cn.noOff || cn.only) continue;
            const picks = flex.length ? flex : ["early"];   // flex = 不限人数的班次
            let placed = false;
            for(const shNew of picks){
              if(placed) break;
              if(cn.only && cn.only !== shNew) continue;
              if(cn.ban && cn.ban[shNew]) continue;
              // 早班若已满员，加人会超编
              if(exact.includes(shNew)){
                const needD = (state.needs && state.needs[d]) ? (+state.needs[d][shNew]||0) : 99;
                let have = 0; staff.forEach(n=>{ if(at(n,d)===shNew) have++; });
                if(have >= needD) continue;
              }
              if(!aCanTake(A, d, shNew)) continue;
              const rsA = weekRestSet(week, A);
              // x：A 某个正在上班的日子，A 要把班让给 C
              for(let x=0; x<7 && !placed; x++){
                if(x===d) continue;
                const shA = at(A,x);
                if(shA!=="early" && shA!=="mid" && shA!=="night") continue;
                const rsA2 = new Set(rsA); rsA2.delete(d); rsA2.add(x);   // A 让出 d、接上 x
                if(rsA2.size < rrM.min || rsA2.size > rrM.per) continue;
                if(run3RestCount(rsA2) > run3RestCount(rsA)) continue;
                if(isolatedRestCount(rsA2) > isolatedRestCount(rsA)) continue;
                // 谁来顶 A 在 x 的班？
                for(const C of staff){
                  if(C===A || !isRest(C,x)) continue;
                  if(banned.has(A+"|C|"+d+"|"+x)) continue;
                  const cc = (R && R[C] && R[C][x]) || {};
                  if(cc.off || cc.only) continue;
                  if(cc.ban && cc.ban[shA]) continue;
                  const cntC = {early:0,mid:0,night:0};
                  week[C].forEach(v=>{ if(cntC[v]!==undefined) cntC[v]++; });
                  if(cntC[shA] >= (LIM[shA]||99)) continue;
                  const getC = t => (t===x) ? shA : (week[C][t]||"");
                  let cOK = true;
                  for(let t=0;t<7;t++) if(getC(t)==="night" && getC((t+1)%7)==="early"){ cOK=false; break; }
                  if(cOK) for(let t=0;t<7;t++) if(getC(t)==="early"&&getC((t+1)%7)==="early"&&getC((t+2)%7)==="early"){ cOK=false; break; }
                  if(cOK && getC(5)==="early" && getC(6)==="early") cOK=false;
                  if(!cOK) continue;
                  const rsC = new Set(weekRestSet(week,C)); rsC.delete(x);
                  if(rsC.size < rrM.min || rsC.size > rrM.per) continue;
                  if(run3RestCount(rsC) > 0) continue;
                  if(isolatedRestCount(rsC) > isolatedRestCount(weekRestSet(week,C))) continue;
                  // 试算：A 在 d 上班、A 在 x 让位给 C
                  const a_d=week[A][d], a_x=week[A][x], c_x=week[C][x];
                  week[A][d]=shNew; week[A][x]="rest"; week[C][x]=shA;
                  const on2 = idxs.filter(n=> isWork(n,d)).length;
                  if(on2 > on){ fixed++; didAny = true; done = true; placed = true; break; }
                  week[A][d]=a_d; week[A][x]=a_x; week[C][x]=c_x;   // 撤销
                  banned.add(A+"|C|"+d+"|"+x);
                }
              }
            }
          }
        }
      }
    }
    if(!didAny) break;
  }
  return fixed;
}
function fixGroupGuarantee(week, R){
  const g = state.groups && state.groups.earlyNight;
  if(!g) return 0;
  const mem = schedulableGroupMembers("earlyNight").filter(n=> week[n]);
  const needE = Math.max(0, +g.minEarly || 0), needN = Math.max(0, +g.minNight || 0);
  if(!mem.length || (!needE && !needN)) return 0;
  const staff = (state.staff||[]).filter(n=> week[n]);
  const at     = (n,d)=> (week[n][d]||"");
  const isRest = (n,d)=>{ const v = at(n,d); return v==="rest" || v===""; };
  const LIM = state.limits || {early:3, night:3, mid:99};
  const banned5 = new Set();   // 第五条路径试过的 (A,B,d,x) 组合，避免在同一张表上空转
  // 「人数固定」的班次（如早班）：补位可以，但把它撑爆会挤占别的班次名额
  const exactArr = Array.isArray(state.exactShifts) ? state.exactShifts : [];
  // 某人第 d 天能不能上 sh（不含「当天已有班」这一条，由调用方保证）
  const canTake = (n, d, sh)=>{
    const c = (R && R[n] && R[n][d]) || {};
    if(c.off) return false;
    if(c.only && c.only !== sh) return false;
    if(c.ban && c.ban[sh]) return false;
    const cnt = {early:0, mid:0, night:0};
    for(let x=0; x<7; x++){ const v = x===d ? sh : (week[n][x]||""); if(cnt[v]!==undefined) cnt[v]++; }
    if(cnt[sh] > (LIM[sh]||99)) return false;
    const get = x => (x===d) ? sh : (week[n][x]||"");
    for(let x=0; x<7; x++) if(get(x)==="night" && get((x+1)%7)==="early") return false;
    for(let x=0; x<7; x++) if(get(x)==="early" && get((x+1)%7)==="early" && get((x+2)%7)==="early") return false;
    if(get(5)==="early" && get(6)==="early") return false;
    return true;
  };
  // 缺口数
  const shortOf = (d)=>{
    let s = 0;
    if(needE) s += Math.max(0, needE - mem.filter(n=> at(n,d)==="early").length);
    if(needN) s += Math.max(0, needN - mem.filter(n=> at(n,d)==="night").length);
    return s;
  };
  let fixed = 0;
  for(let pass=0; pass<10; pass++){
    let didAny = false;
    for(let d=0; d<7 && !didAny; d++){
      if(shortOf(d) <= 0) continue;
      // 优先「拉组内在休的人顶班」
      let done = false;
      for(const A of mem){
        for(const sh of ["early","night"]){
          const want = (sh==="early") ? needE : needN;
          if(!want) continue;
          const have = mem.filter(n=> at(n,d)===sh).length;
          if(have >= want) continue;
          if(!isRest(A,d)) continue;
          if(!canTake(A,d,sh)) continue;
          week[A][d] = sh; fixed++; didAny = true; done = true; break;
        }
        if(done) break;
      }
      if(done) continue;
      // 退而求其次：组内有人当天在**别的班次**（含中班），换到缺的班次上。
      // 注意不能只认 early/night —— 组员当天在中班是很常见的情况，
      // 漏掉中班会让「周日何广友上中班 → 早班没人」这类缺口修不掉。
      // 从中班/晚班改成早班相当于给那天早班**补位**（本来就缺人），不会挤掉任何人。
      for(const A of mem){
        const cur = at(A,d);
        if(cur !== "early" && cur !== "mid" && cur !== "night") continue;
        for(const sh of ["early","night"]){
          if(sh === cur) continue;
          const want = (sh==="early") ? needE : needN;
          if(!want || mem.filter(n=> at(n,d)===sh).length >= want) continue;
          if(!canTake(A,d,sh)) continue;
          week[A][d] = sh; fixed++; didAny = true; done = true; break;
        }
        if(done) break;
      }
      if(done) continue;
      /* 第三条路径：与他人**对调**。
         组员 A 当天休息 → 直接改上班的话，A 就少休了一天（可能跌破休息下界）。
         所以同时让当天在岗的 B 去 A 的某个休息日 b 休息、并顶掉 A 在 b 原本的班：
             A：d 休→上，b 上→休      休息天数不变
             B：d 上→休，b 休→上      休息天数不变
         两人的休息天数不变、当天在岗总人数不变、班次覆盖不变，
         唯独「d 那天谁在上班」换成了组员 A —— 组内保障因此达成。
         这条路径不会破坏 fixRestRange 的成果（谁都没多休也没少休）。 */
      for(const A of mem){
        const restA = isRest(A,d);
        for(const B of staff){
          if(B === A || isRest(B,d)) continue;
          const shB = at(B,d);
          if(shB !== "early" && shB !== "mid" && shB !== "night") continue;
          if(restA){
            if(!canTake(A, d, shB)) continue;    // A 能顶这个班吗（请假 / 禁排 / 上限 / 晚接早 / 三连早）
            // A 的某个非 d 休息日 b：A 去 b 休息，B 去 b 顶 A 原本的班
            let picked = -1, pickedShift = "";
            for(const b of weekRestSet(week, A)){
              if(b === d) continue;
              const cB = (R && R[B] && R[B][b]) || {};
              if(cB.off || cB.only) continue;          // B 在 b 请假 / 固定班，不动
              const shA = at(A,b);
              if(shA !== "early" && shA !== "mid" && shA !== "night") continue;
              // B 试算：d 改休息、b 改上 shA
              const oldBd = week[B][d], oldBb = week[B][b];
              const isoBefore = isolatedRestCount(weekRestSet(week, B));
              week[B][d] = "rest"; week[B][b] = shA;
              const cnt = {early:0, mid:0, night:0};
              week[B].forEach(v=>{ if(cnt[v] !== undefined) cnt[v]++; });
              let ok = cnt[shA] <= (LIM[shA]||99);
              if(ok) for(let x=0; x<7; x++) if(week[B][x]==="night" && week[B][(x+1)%7]==="early"){ ok=false; break; }
              if(ok) for(let x=0; x<7; x++) if(week[B][x]==="early" && week[B][(x+1)%7]==="early" && week[B][(x+2)%7]==="early"){ ok=false; break; }
              if(ok && week[B][5]==="early" && week[B][6]==="early") ok=false;
              if(ok && run3RestCount(weekRestSet(week,B)) > 0) ok=false;
              if(ok && isolatedRestCount(weekRestSet(week,B)) > isoBefore) ok=false;
              week[B][d] = oldBd; week[B][b] = oldBb;   // 无条件还原
              if(ok){ picked = b; pickedShift = shA; break; }
            }
            if(picked < 0) continue;
            // 正式执行
            week[A][d] = shB;        // A 顶 B 在 d 的班
            week[B][d] = "rest";     // B 在 d 改休息
            week[B][picked] = pickedShift;   // B 去 A 原来的休息日顶班
            week[A][picked] = "rest";        // A 在那天改休息（休息天数不变）
            fixed++; didAny = true; done = true; break;
          } else {
            // A 当天已有班：直接换成缺的班次 —— 不涉及休息日变动
            const cur = at(A,d);
            for(const sh of ["early","night"]){
              if(sh === cur) continue;
              const want = (sh==="early") ? needE : needN;
              if(!want || mem.filter(n=> at(n,d)===sh).length >= want) continue;
              if(!canTake(A,d,sh)) continue;
              week[A][d] = sh; fixed++; didAny = true; done = true; break;
            }
          }
          if(done) break;
        }
        if(done) break;
        /* ── 第五条路径：班次名额跨天对调（严格守恒，前四条全灭时的兜底）──
           前四条路径都只在「当天这一格」上做文章，所以有一种情况它们必然全部失效：
           组员 A 在 d 天本来能上班，却被**别的某一天**的安排挡住 ——
             · 班次周上限已排满（如 early 已经 3 次，而 LIM.early = 3）
             · 连上三早 / 晚接早 / 周末连上早班（如周六已排早班，周日就再也排不了早班）
           实测样本：周日缺早班时，4 名组员被「周末连早 / 连三早 / 早班超上限」各挡一种，
           前四条路径全部无解 —— 不是它们写得不对，而是根本没给它们跨天操作的手段。

           这种情况唯一出路不是「在 d 天想办法」，而是把 A 在别的某一天占住的那个
           班次名额让出去。设 A 在 x 天排 sh（x 就是造成阻碍的那天），
           B 是 d 天正好也排 sh 的那个人（要腾出位置的人）：
               A：x 上 sh → d 上 sh     （A 的休息日由 d 换成 x，数量不变）
               B：d 上 sh → x 上 sh     （B 的休息日由 x 换成 d，数量不变）

           这是**严格守恒**的：第 x 天 A 腾出 sh、B 顶上；第 d 天 B 腾出 sh、A 顶上。
           两天的每个班次人数、每天的在岗总人数都不变 —— 既不会让「人数固定」的早班
           超编，也不会动到任何人的班次覆盖，两人的休息天数也都没变（只是换了休哪天）。
           所以要校验的只有：两人换班后各自仍满足班次上限 / 晚接早 / 连三早 / 周末连早，
           休息集合不出现新的 3 连休或孤立休息，且全组的早晚保障没有因此出现新缺口。 */
        if(!done){
          const rr5 = restRange();
          // 某人把休息日从 from 挪到 to 之后，休息形状是否仍然合法
          const restShapeOK = (n, from, to)=>{
            const cur = weekRestSet(week, n);
            const rs = new Set(cur); rs.delete(from); rs.add(to);
            return rs.size >= rr5.min && rs.size <= rr5.per
                && run3RestCount(rs) <= run3RestCount(cur)
                && isolatedRestCount(rs) <= isolatedRestCount(cur);
          };
          // 某人「第 from 天让出去、第 to 天接上 sh」之后，整周是否仍然合法
          const rowOK = (n, from, to, sh)=>{
            if(!restShapeOK(n, from, to)) return false;
            const get = x => (x===to) ? sh : (x===from ? "" : (week[n][x]||""));
            const cnt = {early:0, mid:0, night:0};
            for(let x=0; x<7; x++){ const v = get(x); if(cnt[v]!==undefined) cnt[v]++; }
            for(const s of ["early","mid","night"]) if(cnt[s] > (LIM[s]||99)) return false;
            for(let x=0; x<7; x++) if(get(x)==="night" && get((x+1)%7)==="early") return false;
            for(let x=0; x<7; x++) if(get(x)==="early" && get((x+1)%7)==="early" && get((x+2)%7)==="early") return false;
            if(get(5)==="early" && get(6)==="early") return false;
            // 请假 / 固定班 / 禁排
            for(let x=0; x<7; x++){
              const c = (R && R[n] && R[n][x]) || {};
              const v = get(x);
              if(c.off){ if(v!=="" && v!=="rest") return false; continue; }   // 请假只能休
              if(v===""||v==="rest"){ if(c.noOff || c.only) return false; continue; }
              if(c.only && c.only!==v) return false;
              if(c.ban && c.ban[v]) return false;
            }
            return true;
          };
          // 先记下当前每天的缺口，操作后不允许任何一天变得更差
          const gapBefore = []; for(let x=0; x<7; x++) gapBefore.push(shortOf(x));
          /* d 天每个班次已经有哪些人 —— 预先建索引，避免在内层 B 循环里反复 filter 全队。
             这也是性能关键：早前的写法在 B 循环里对每个候选人重算一遍，
             实测把 test_edge 拖到 644 秒。 */
          const onShift = {};   // onShift[day][shift] = [names]
          for(let y=0; y<7; y++){
            onShift[y] = {early:[], mid:[], night:[]};
            staff.forEach(n=>{ const v = at(n,y); if(onShift[y][v]) onShift[y][v].push(n); });
          }
          const memSet = new Set(mem);
          outer5:
          for(const A of mem){
            if(!isRest(A,d)) continue;                       // 只处理「当天在休」的组员
            for(const sh of ["early","night"]){
              const want = (sh==="early") ? needE : needN;
              if(!want || mem.filter(n=> at(n,d)===sh).length >= want) continue;
              // A 在别的哪一天占着同一个班次 —— 那一天就是造成阻碍的根源
              for(let x=0; x<7; x++){
                if(x===d || at(A,x)!==sh) continue;
                // A 侧的校验与 B 无关，提到 B 循环外（每次 x 只算一次）
                if(!rowOK(A, x, d, sh)) continue;            // A 换过去之后整周还合法吗
                // d 天谁占着这个班次名额（要把它腾出来给 A 的人）
                for(const B of onShift[d][sh]){
                  if(B===A || memSet.has(B)) continue;        // 不动同组的人，避免拆掉别的保障
                  if(!rowOK(B, d, x, sh)) continue;           // B 换过去之后整周还合法吗
                  const vAx=week[A][x], vAd=week[A][d], vBd=week[B][d], vBx=week[B][x];
                  week[A][x] = "";    week[A][d] = sh;
                  week[B][d] = "";    week[B][x] = sh;
                  let ok = true;
                  for(let y=0; y<7; y++) if(shortOf(y) > gapBefore[y]){ ok = false; break; }
                  if(ok){ fixed++; didAny = true; done = true; break outer5; }
                  week[A][x]=vAx; week[A][d]=vAd; week[B][d]=vBd; week[B][x]=vBx;   // 无条件还原
                }
              }
            }
          }
        }
      }
    }
    if(!didAny) break;
  }
  return fixed;
}
function fixRestRange(week, R){
  const staff = (state.staff||[]).filter(n=> week[n]);
  if(staff.length < 2) return 0;
  const rr = restRange();
  const {min, per} = rr;
  const LIM = state.limits || {early:3, night:3, mid:99};
  const exact = Array.isArray(state.exactShifts) ? state.exactShifts : [];
  const flex = ["mid","night"].filter(sh=> !exact.includes(sh));
  const at  = (n,d)=> (week[n][d]||"");
  const isRest = (n,d)=>{ const v = at(n,d); return v==="rest" || v===""; };
  const restN = n => weekRestSet(week,n).size;
  let fixed = 0;
  for(let pass=0; pass<20; pass++){
    let didAny = false;
    for(const n of staff){
      const r = restN(n);
      if(r >= min && r <= per) continue;
      if(r > per){
        // 休多了：拿掉一个休息日改成上班。优先加到「不限人数」的班次，
        // 早班是人数固定班次（exactShifts），不碰。
        const d = [...weekRestSet(week,n)][0];
        if(d === undefined) continue;
        const c = (R && R[n] && R[n][d]) || {};
        if(c.off) continue;                       // 请假：不动
        if(!flex.length) continue;
        const opts = flex.filter(sh=>{
          if(c.only && c.only !== sh) return false;
          if(c.ban && c.ban[sh]) return false;
          const cnt = {early:0,mid:0,night:0};
          week[n].forEach(v=>{ if(cnt[v]!==undefined) cnt[v]++; });
          return cnt[sh] < (LIM[sh]||99);
        });
        if(opts.length){ week[n][d] = opts[0]; fixed++; didAny = true; continue; }
        // 加不上班就换个休息日（找一天确实能上的）
        for(const d2 of weekRestSet(week,n)){
          const c2 = (R && R[n] && R[n][d2]) || {};
          if(c2.off) continue;
          const o2 = flex.filter(sh=> !c2.only && !(c2.ban&&c2.ban[sh]));
          if(o2.length){ week[n][d2] = o2[0]; fixed++; didAny = true; break; }
        }
        continue;
      }
      /* 休少了（< min）：n 需要**多休一天**，不是多上班一天。
         （旧实现把方向写反了：只在 n 已休息的日子上找、又从未给 week[n][d] 赋值，
           结果是 didAny=true 但班表纹丝不动 —— 白白耗掉 20 轮 pass，「休少了」永远修不掉。）
         正确做法：找一个 n 正在上班的日子 d，把 n 改成休息，同时让当天休息的 B 顶上 n 的班：
             n：上 → 休      休息天数 +1，向 min 靠拢
             B：休 → 上 n 的班 休息天数 -1，必须保证 B 改完仍 ≥ min
         两人一进一出，当天在岗总人数与班次覆盖都不变，只是「谁在上班」换了人。 */
      for(const d of [0,1,2,3,4,5,6]){
        if(isRest(n,d)) continue;                       // 已经在休了，换别的日子
        const cn = (R && R[n] && R[n][d]) || {};
        if(cn.off || cn.noOff || cn.only) continue;     // 请假 / 必须上班 / 固定班：不可挪
        const shN = at(n,d);
        if(shN!=="early" && shN!=="mid" && shN!=="night") continue;
        const rsN = weekRestSet(week,n);
        // 多休这一天不能造出新的 3 连休或孤立休息
        if(wouldRun3Rest(rsN, d) || wouldIsolate(rsN, d)) continue;
        const cands = staff.filter(B=>{
          if(B===n || !isRest(B,d)) return false;       // B 必须是当天在休、且愿意顶班的人
          const cb = (R && R[B] && R[B][d]) || {};
          if(cb.off || cb.only) return false;           // B 当天请假 / 固定班，接不了
          if(cb.ban && cb.ban[shN]) return false;      // B 不能接这个班次
          if(weekRestSet(week,B).size <= min) return false;   // B 再少休就跌破下界
          const rsB = new Set(weekRestSet(week,B)); rsB.delete(d);   // B 在 d 改成上班后的休息集合
          if(run3RestCount(rsB) > 0) return false;               // B 会因此出现 3 连休
          if(isolatedRestCount(rsB) > isolatedRestCount(weekRestSet(week,B))) return false;
          return true;
        });
        let done = false;
        for(const B of cands){
          const cnt = {early:0,mid:0,night:0};
          week[B].forEach(v=>{ if(cnt[v]!==undefined) cnt[v]++; });
          if(cnt[shN] >= (LIM[shN]||99)) continue;     // B 的班次周上限接不了
          const get = x => (x===d) ? shN : (week[B][x]||"");
          let bad = false;
          for(let x=0;x<7;x++){ if(get(x)==="night" && get((x+1)%7)==="early"){ bad=true; break; } }
          if(bad) continue;
          for(let x=0;x<7;x++){ if(get(x)==="early" && get((x+1)%7)==="early" && get((x+2)%7)==="early"){ bad=true; break; } }
          if(bad) continue;
          if(get(5)==="early" && get(6)==="early") continue;
          // 执行：n 改休息，B 顶上 n 的班
          week[n][d] = "rest";
          week[B][d] = shN;
          fixed++; didAny = true; done = true; break;
        }
        if(done) break;
      }
    }
    if(!didAny) break;
  }
  return fixed;
}
function fixIsolatedRest(week, R){
  const staff = state.staff;
  if(!staff || staff.length < 2 || !week) return 0;
  const LIM = state.limits || {};
  const gEn = state.groups && state.groups.earlyNight;
  const gOc = state.groups && state.groups.openClose;
  const enSet = new Set(groupMembers("earlyNight"));
  const ocSet = new Set(groupMembers("openClose"));
  const at = (n,d)=> (week[n] && week[n][d]) || "";
  const isRest = (n,d)=>{ const v = at(n,d); return v === "" || v === "rest"; };

  // 规则格：某人第 d 天能不能排成 sh（sh === "" 表示休息）
  const canPut = (n,d,sh)=>{
    const c = R && R[n] && R[n][d];
    if(!c) return true;
    if(c.off) return !sh;                                 // 请假：只能休
    if(!sh) return !c.only && !c.noOff;                   // 要休：不能是固定班 / 必须上班日
    if(c.only && c.only !== sh) return false;             // 固定班必须匹配
    if(c.ban && c.ban[sh]) return false;                  // 禁排班次
    return true;
  };
  // 把 n 的第 d1 / d2 天改成 sh1 / sh2 之后，这个人的个人规则还成立吗
  const okSwap = (n, d1, sh1, d2, sh2)=>{
    if(!canPut(n,d1,sh1) || !canPut(n,d2,sh2)) return false;
    const get = d => (d===d1) ? sh1 : (d===d2) ? sh2 : at(n,d);
    const cnt = {early:0, mid:0, night:0};
    for(let d=0; d<7; d++){ const v = get(d); if(cnt[v] !== undefined) cnt[v]++; }
    if(cnt.early > (LIM.early||99)) return false;              // 每人每周早班上限
    if(cnt.night > (LIM.night||99)) return false;              // 每人每周晚班上限
    for(let d=0; d<6; d++) if(get(d)==="night" && get(d+1)==="early") return false;  // 晚班次日不接早班
    for(let d=0; d<7; d++)                                      // 不能三连早（含跨周）
      if(get(d)==="early" && get((d+1)%7)==="early" && get((d+2)%7)==="early") return false;
    if(get(5)==="early" && get(6)==="early") return false;      // 周末连上早班：一律不制造
    return true;
  };
  // 某天按「组」看身份的四个计数
  const grpDay = d=>{
    let enE=0, enN=0, ocE=0, ocN=0;
    staff.forEach(n=>{
      const v = at(n,d);
      if(enSet.has(n)){ if(v==="early") enE++; else if(v==="night") enN++; }
      if(ocSet.has(n)){ if(v==="early") ocE++; else if(v==="night") ocN++; }
    });
    return [enE, enN, ocE, ocN];
  };
  const need = [(gEn && +gEn.minEarly)||0, (gEn && +gEn.minNight)||0,
                (gOc && +gOc.open)||0,     (gOc && +gOc.close)||0];
  // 本来就达标的组，换完必须仍达标；本来就不达标，至少不能更差（与 balanceShifts 同一口径）
  const groupSafe = (d, before)=> {
    const after = grpDay(d);
    for(let i=0; i<4; i++) if(after[i] < Math.min(need[i], before[i])) return false;
    return true;
  };

  const isoOf = n => isolatedRestCount(restSetOfWeek(week, n));
  let cur = staff.reduce((s,n)=> s + isoOf(n), 0);
  if(!cur) return 0;
  let roleShort = weekRoleShort(week);
  const banned = new Set();
  let fixed = 0;
  /* 互换对象必须是「第 b 天休息、第 a 天上班」的人 —— 直接把这两个关系做成索引，
     别在四重循环里扫全部人：31 人 × 7 天 × 7 天的朴素写法，每个候选方案要几十万次判断，
     而选优最多要跑 300 个候选，实测会明显拖慢排班。 */
  const N0 = staff.length;
  for(let round=0; round<16 && cur>0; round++){
    // 本轮开始时每人的孤立数。本轮内只在“接受”时才改班表，而接受后立刻结束本轮，
    // 所以这个缓存整轮有效，可以把 isoOf 的调用次数压到极低。
    const iso0 = staff.map(isoOf);
    const restIdx = [], workIdx = [], restOn = [[],[],[],[],[],[],[]];
    staff.forEach((n,i)=>{
      const rs = [], ws = [];
      for(let d=0; d<7; d++){ if(isRest(n,d)) rs.push(d); else ws.push(d); }
      restIdx.push(rs); workIdx.push(ws);
      rs.forEach(d=> restOn[d].push(i));
    });
    let moved = false;
    for(let i=0; i<N0 && !moved; i++){
      if(iso0[i] === 0) continue;
      const A = staff[i];
      for(const a of restIdx[i]){                       // a：A 的休息日
        if(moved) break;
        for(const b of workIdx[i]){                     // b：A 上班的一天 → 把休息挪到 b
          if(moved) break;
          for(const j of restOn[b]){                    // B 第 b 天休息
            if(j === i) continue;
            if(restIdx[j].includes(a)) continue;        // B 第 a 天要上班（否则每天人数会变）
            const B = staff[j];
            if(banned.has(A+"|"+B+"|"+a+"|"+b)) continue;
            const sA = at(A,b), sB = at(B,a);
            if(!okSwap(A, a, sB, b, at(B,b)) || !okSwap(B, a, at(A,a), b, sA)) continue;
            const gA0 = grpDay(a), gB0 = grpDay(b);
            // 对调两人第 a 天 / 第 b 天的格子（撤销 = 再做一遍）
            const vAa = at(A,a), vAb = at(A,b), vBa = at(B,a), vBb = at(B,b);
            week[A][a] = vBa; week[B][a] = vAa;
            week[A][b] = vBb; week[B][b] = vAb;
            const nxt = cur - iso0[i] - iso0[j] + isoOf(A) + isoOf(B);
            const ok = nxt < cur && groupSafe(a, gA0) && groupSafe(b, gB0)
                       && weekRoleShort(week) <= roleShort;
            if(!ok){
              week[A][a] = vAa; week[B][a] = vBa;          // 撤销
              week[A][b] = vAb; week[B][b] = vBb;
              banned.add(A+"|"+B+"|"+a+"|"+b);
              continue;
            }
            cur = nxt; fixed++; moved = true;
            break;
          }
        }
      }
    }
    if(!moved) break;
  }
  return fixed;
}

/* ===== ④ 对外 API ========================================================== */

/* 状态快照：JSON 化后再还原，避免宿主拿到内部引用乱改 */
function snapshot(o){ return JSON.parse(JSON.stringify(o)); }

var STATE_DEFAULTS = snapshot(state);

/* 深合并：只覆盖 patch 里显式给出的键；数组整体替换（不逐项并） */
function deepMerge(dst, patch){
  Object.keys(patch || {}).forEach(function(k){
    var v = patch[k];
    if(v && typeof v === 'object' && !Array.isArray(v)
       && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])){
      deepMerge(dst[k], v);
    } else {
      dst[k] = v;
    }
  });
  return dst;
}

var WARNINGS = [];
function warn(msg){ WARNINGS.push(String(msg)); }

/* 装载一次生成的输入。每次装载都从默认状态起步 —— 上一次的 schedule / manual
   不能污染这一次（否则「同一个输入两次结果不同」）。
   cfg = { state:{…}, hooks:{…}, staff:[…], requests:[…], … }，常用字段可直接写在顶层 */
function loadInput(cfg){
  cfg = cfg || {};
  state = snapshot(STATE_DEFAULTS);
  WARNINGS = [];
  bindHost({
    toast: warn,
    save: function(){},
    renderAll: function(){},
    confirm: function(msg){ warn(msg); return true; }
  });
  bindHost(cfg.hooks);
  deepMerge(state, cfg.state || {});
  ['staff','staffProfiles','staffDomain','requests','mustWork','fixedRoster','groups','needs','limits','restMax',
   'schedule','roles','roleSig','manual','domain','moduleMinOn','exactShifts','weekendEarlyMax'
  ].forEach(function(k){ if(cfg[k] !== undefined) state[k] = cfg[k]; });
  return state;
}

/* 'yyyy-mm-dd' / Date / 毫秒 → 该周周一（一律按本地时区，别走 UTC） */
function toMonday(key){
  if(key instanceof Date) return mondayOf(key);
  if(typeof key === 'number') return mondayOf(new Date(key));
  var m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(key || ''));
  if(m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return mondayOf(new Date());
}

/* 生成一周（单领域）。
   opts = {
     weekKey : 该周周一，'yyyy-mm-dd'；缺省 = 今天所在周
     domain  : '3c' | 'hongmeng' | 'zunjie' | 'aftersales' | 'kufang' | 'admin' | 'manager'
     effort  : 'fast' | 'quality'
               fast    = 与旧版一键排班完全等价（攒够 MIN_POOL 且合格就收工）
               quality = N1 预算用满 + N2 局部搜索（默认）
     budgetMs: 覆盖主搜索时间预算（毫秒）
     climbMs : 覆盖局部搜索时间预算（毫秒），0 = 关闭 N2
     input   : 与 loadInput 同一个对象（不传则用 opts 自身的字段装载）
   }
   返回 { ok, weekKey, domain, grid, roles, manual, warnings, stats, ms } */
function generateWeek(opts){
  opts = opts || {};
  loadInput(opts.input || opts);

  var dom = opts.domain || state.domain || '3c';
  currentMonday = toMonday(opts.weekKey || opts.week);
  var k = curKey();

  var effort = opts.effort || 'quality';
  var t0 = Date.now();
  autoSchedule(dom, {
    fillBudget: effort === 'quality',
    budgetMs: opts.budgetMs,
    climbMs : opts.climbMs
  });
  var ms = Date.now() - t0;

  var week = state.schedule[k] || null;
  return {
    ok: !!(week && state.staff.length),
    weekKey: k,
    domain: dom,
    grid: week ? snapshot(week) : null,
    roles: snapshot(state.roles[k] || {}),
    manual: snapshot((state.manual || {})[k] || {}),
    warnings: WARNINGS.slice(),
    stats: week ? checkWeek(week, dom) : null,
    ms: ms
  };
}

/* 把 state 切到某个领域的口径：需求 / 上限 / 休息配额 / 人力池 一起换。
   这正是 autoSchedule 内部做的事（少了它，体检会把别的领域的人也算进来，
   报出一堆「三连休」「模块无人上岗」的假违规）。退出前一定还原。 */
function withScope(dom, fn){
  var bakNeeds = state.needs, bakLimits = state.limits, bakRest = state.restMax,
      bakDom = state.domain, bakStaff = state.staff, bakMonday = currentMonday;
  state.domain = dom;
  state.needs = domNeeds(dom);
  state.limits = domLimits(dom);
  state.restMax = domRestMax(dom);
  var fixedAll = allFixedRosterNames();
  state.staff = bakStaff.filter(function(n){
    return inDomain(n, dom) && !blockedInDomain(n, dom) && fixedAll.indexOf(n) < 0;
  });
  try { return fn(); }
  finally {
    state.needs = bakNeeds; state.limits = bakLimits; state.restMax = bakRest;
    state.domain = bakDom; state.staff = bakStaff; currentMonday = bakMonday;
  }
}

/* 体检：把「这一周排得怎么样」量化出来。跑分基座、经理端、A/B 对比共用这一个口径。
   注意所有指标都只统计**本领域可排班的人**，与生成期口径一致。 */
function checkWeek(week, dom){
  dom = dom || state.domain || '3c';
  /* 纯固定班表部门（行政）：没有可排班人力，但格子照样有值（固定班表写死的）。
     这种情况按「本领域全员」来体检 —— 否则会得出「需求 23、缺口 23」这种假结论。
     注意此时 fixedOnly=true，覆盖类指标不适用（引擎自己也只给提示、不给错误）。 */
  var fixedOnly = domainSchedulable(dom).length === 0 && !!fixedRosterOf(dom);
  return withScope(dom, function(){
    var scope = fixedOnly ? domainStaff(dom) : state.staff;
    var R = buildRules(curKey(), dom);
    var RArr = scope.map(function(n){ return R[n]; });
    var plan = { assign: [], restDays: [], slots: [], R: RArr };
    state.needs.forEach(function(d, di){
      ['early','mid','night'].forEach(function(sh){
        for(var i = 0; i < (+d[sh] || 0); i++) plan.slots.push({ day: di, shift: sh });
      });
    });
    var filled = 0;
    scope.forEach(function(n){
      var arr = week[n] || [];
      var list = [];
      var rest = new Set([0,1,2,3,4,5,6]);
      for(var d = 0; d < 7; d++){
        var v = arr[d] || '';
        if(v === 'early' || v === 'mid' || v === 'night'){
          list.push({ day: d, shift: v });
          rest.delete(d);
          filled++;
        }
      }
      plan.assign.push(list);
      plan.restDays.push(rest);
    });
    var rr = restRange();
    var stats = {
      domain: dom,
      staff: scope.length,
      fixedOnly: fixedOnly,
      slots: plan.slots.length,
      filled: filled,
      gaps: Math.max(0, plan.slots.length - filled),
      ruleViol : planRuleViol(plan, RArr),
      isoRest  : planIsoRest(plan),
      groupViol: planGroupViol(plan),
      run3Bad  : planRun3Rest(plan, RArr),
      modViol  : planModuleViol(plan),
      floorBad : planRestFloorViol(plan, RArr),
      shortWork: plan.assign.reduce(function(s, a){
        return s + Math.max(0, (7 - rr.min) - a.length); }, 0),
      score: scope.length ? planScore(plan) : 0
    };
    stats.hard = stats.gaps + stats.ruleViol + stats.isoRest + stats.groupViol
               + stats.run3Bad + stats.modViol + stats.floorBad;
    return stats;
  });
}

/* 按请假 / 改班微调（局部补位），opts 与 generateWeek 同构 */
function repatch(opts){
  opts = opts || {};
  loadInput(opts.input || opts);
  var dom = opts.domain || state.domain || '3c';
  currentMonday = toMonday(opts.weekKey || opts.week);
  var k = curKey();
  repatchWeek(!!opts.silent, dom);
  var week = state.schedule[k] || null;
  return {
    ok: !!week, weekKey: k, domain: dom,
    grid: week ? snapshot(week) : null,
    warnings: WARNINGS.slice(),
    stats: week ? checkWeek(week, dom) : null
  };
}

return {
  version: '1.0.0',
  core: { count: 114, lines: 3706, stubs: 36, source: '866858ba62c8e6be6e850e2f6058a1e6540c43d9991a8f75e6d26f3fcc657396' },
  get state(){ return state; },
  snapshot: function(){ return snapshot(state); },
  loadInput: loadInput,
  configure: function(patch){ return deepMerge(state, patch || {}); },
  bindHost: bindHost,
  generateWeek: generateWeek,
  repatch: repatch,
  autoSchedule: function(dom, opts){ return autoSchedule(dom || state.domain, opts); },
  batchScheduleWeeks: function(weeks, dom, opts){ return batchScheduleWeeks(weeks, dom, opts); },
  checkWeek: checkWeek,
  /* 内部函数出口（跑分基座与测试用）：fn('planScore') */
  fn: function(name){
    try { return eval(name); } catch(e){ return undefined; }
  },
  coreNames: ['groupMembers', 'schedulableGroupMembers', 'mondayOf', 'fmt', 'fmtCN', 'fmtLocal', 'dateObj', 'dateLabel', 'inferDateYear', 'parseDateToken', 'restTotalCap', 'wouldIsolate', 'wouldRun3Rest', 'run3RestCount', 'restRange', 'isolatedRestCount', 'restSetOfWeek', 'wouldIsolateWeek', 'wouldEarlyRun3', 'hasEarlyRun3', 'weekKeyOf', 'curKey', 'getWeek', 'ensureWeek', 'activeRequests', 'buildRules', 'hasRule', 'ruleText', 'checkRuleViolations', 'cellViolation', 'roleOf', 'scheduleSig', 'roleCands', 'tryRoles', 'assignRoles', 'syncRoles', 'moduleMinOn', 'moduleMinOnExempt', 'isManager', 'isBlockedFromSchedule', 'curDomain', 'domLabel', 'groupLabel', 'isHongmeng', 'isAftersales', 'isKufang', 'isAdmin', 'isZunjie', 'inDomain', 'domainStaff', 'fixedRosterOf', 'fixedRosterNames', 'allFixedRosterNames', 'applyFixedRoster', 'blockedInDomain', 'domainSchedulable', 'domNeeds', 'domLimits', 'domRestMax', 'schedRestStats', 'nonManagerBlocked', 'staffDisplayCmp', 'batchScheduleWeeks', 'autoSchedule', 'tryPlan', 'planGroupViol', 'planModuleViol', 'planRestFloorViol', 'planRun3Rest', 'planRuleViol', 'planIsoRest', 'absorbPlan', 'planScore', 'planOfWeek', 'weekGrade', 'gradeCmp', 'cloneWeek', 'sameWeek', 'fillGaps', 'absorbSurplus', 'patchViolations', 'polishScore', 'polishWeek', 'repatchWeek', 'uiIcon', 'getStaffProfile', 'collectStaffProfiles', 'moduleColorMap', 'escapeHtml', 'escapeAttr', 'hasRestPlan', 'effectiveScheduleData', 'currentWeekHasData', 'analyticsKeyDate', 'hasWeekData', 'analyticsWeeks', 'weekAnalytics', 'analyticsYears', 'analyticsRange', 'svgChartFrame', 'monthBounds', 'shuffle', 'roleFlowAssign', 'weekRoleShort', 'shiftGapOf', 'balanceShifts', 'balanceNightShifts', 'weekRestSet', 'canRestOn', 'fixRun3Rest', 'fixModuleAllOff', 'fixGroupGuarantee', 'fixRestRange', 'fixIsolatedRest']
};
});
