# supabase/ · 建库说明

> 配套文档：`实施清单.md`（§3 M1 账号底座、§4 数据模型）
> 本目录只放**数据库迁移**，前端与 Edge Function 代码在后续目录。

## 1. 文件清单与执行顺序

| 顺序 | 文件 | 内容 | 校验方法 |
|---|---|---|---|
| ① | `migrations/001_init.sql` | 17 张表 + 索引 + `updated_at` 触发器 | 见 §3 第 1 条 |
| ② | `migrations/002_rls.sql` | RLS + 5 个权限判定函数 + 25 条策略 | 见 §3 第 2 条 |
| ③ | `migrations/003_functions.sql` | 邀请码原子占用 / 设备登记 / 登录守卫 / 离职封禁 / 解封 | 见 §3 第 3 条 |
| ④ | `migrations/004_seed_staff.sql` | 81 位员工主数据（自动生成） | 见 §3 第 4 条 |
| ⑤ | `migrations/005_bootstrap_manager.sql` | 第一个经理账号（需先在控制台建 Auth 用户） | 见 §3 第 5 条 |

**必须按 ①→⑤ 顺序执行**，后面的文件依赖前面建好的表和函数。

## 2. 两种执行方式，挑一种

### 方式 A：网页 SQL Editor（不需要装任何东西，适合第一次）

1. 打开 Supabase 项目 → 左侧 **SQL Editor** → **New query**
2. 把 `001_init.sql` 全文粘贴进去 → **Run**
3. 依次执行 `002`、`003`、`004`
4. `005` 需要先建 Auth 用户，见该文件开头注释

> 每个文件都已写成「可重复执行」（`if not exists` / `drop policy if exists` / `on conflict`），
> 跑错了直接重跑，不会报「已存在」。

### 方式 B：Supabase CLI（Git 化，推荐从第二次开始用）

```powershell
npm i -g supabase
supabase login
supabase link --project-ref <你的项目ref>
supabase db push          # 自动按文件名顺序执行 migrations/
```

## 3. 逐条校验（每条都要你自己跑一遍）

在 SQL Editor 里依次执行，结果必须与右列一致：

```sql
-- ① 表数量：应为 17
select count(*) from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';

-- ② RLS 是否全部开启：应为 17 行，且 rowsecurity 全为 true
select relname, relrowsecurity from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r'
   and relname in ('staff','profiles','invite_codes','invite_uses','devices',
                   'device_bans','auth_logs','weeks','shifts','requests','must_work',
                   'fixed_roster','rules','publish_versions','published_shifts',
                   'publish_deliveries','audit_logs')
 order by relname;

-- ③ 函数是否齐全：应为 13 个
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('is_active_user','my_role','is_manager','is_editor','my_staff_name',
                   'check_invite','redeem_invite','touch_device','login_guard',
                   'offboard_profile','reactivate_profile','ban_device','unban_device')
 order by proname;

-- ④ 员工人数：total=81, managers=9
select count(*) as total,
       count(*) filter (where domain = 'manager') as managers
  from public.staff;

-- ⑤ 经理账号：应有 1 行 manager/active
select username, role, status from public.profiles where role = 'manager';
```

## 4. 越权测试（🔒 上线闸门，必须做）

这一组测试的目的：**证明员工账号看不到别人的数据、也看不到草稿**。

1. 在 Dashboard → Authentication → Users 建一个测试员工账号（如 `test01@staff.smart-roster.local`，自动确认）
2. 用 `005` 的写法给他建 profile，把 `role` 改成 `'employee'`、`status` 改成 `'active'`、
   `staff_name` 填一个真实姓名（如 `'何广友'`）
3. 用这个账号登录（前端登录页建好后，或用 Dashboard 的 impersonate）
4. 执行下表，**结果列**必须一致：

```sql
-- 员工应看到：0 行（草稿对他完全不可见）
select count(*) from public.shifts;

-- 员工应看到：只有自己那几行
select count(distinct staff_name) from public.published_shifts;   -- 应为 1

-- 员工应看到：只有自己的申请
select distinct staff_name from public.requests;                  -- 应为 1 个（自己）

-- 员工应看到：0 行（邀请码、设备、审计都不可见）
select count(*) from public.invite_codes;
select count(*) from public.devices;
select count(*) from public.audit_logs;
```

5. **秒级封禁测试**：把该员工 `status` 改成 `'disabled'`，**不重新登录**，直接刷新页面 → 应立即失去所有数据（RLS 实时生效，不需要等 token 过期）

> 这一步是整个系统的安全底线。做完把结果告诉我，或者截图存进仓库。

## 5. 已知限制

| 限制 | 说明 |
|---|---|
| `check_invite` / `login_guard` 等函数只给 `service_role` | 前端调不到，必须经 Edge Function；否则等于把用户名枚举接口公开 |
| `offboard_profile` 不负责封 Auth 账号 | Auth 的 `ban_duration` 要走 Admin API，在 Edge Function 里调，SQL 做不到 |
| 设备身份是 localStorage 的随机 id | 换浏览器即失效，属「提高成本」不是「绝对封堵」（见 `实施清单.md` §6.3） |
| 免费版 7 天无请求会暂停 | M1 完成后加每日保活（`pg_cron` 或 Worker Cron 打一次 `select 1`） |

## 6. 生成脚本（在仓库 tools/ 下）

| 脚本 | 用途 |
|---|---|
| `tools/gen_seed_from_html.py` | 从 `app_merged.html` 的 `ROSTER_PROFILES` 抽出 81 人 → 生成 `004_seed_staff.sql` |
| `tools/check_sql.py` | 静态检查：语法解析、表数、RLS 覆盖率、外键引用、种子人数、关键约定 |

```powershell
python tools\gen_seed_from_html.py   # 员工名单变了就重跑
python tools\check_sql.py            # 每次改完 SQL 都跑一遍
```
