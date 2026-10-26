-- =============================================================
-- 001_init.sql · 建表（17 张）+ 索引 + updated_at 触发器
-- 依据：实施清单.md §4 数据模型
-- 执行顺序：001 → 002 → 003 → 004
-- 可重复执行：全部用 if not exists
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- 通用：updated_at 自动维护 ----------
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- =============================================================
-- 1. staff · 81 位员工主数据（排班与账号的绑定键是 name）
-- =============================================================
create table if not exists public.staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  module      text not null default '',
  position    text not null default '',
  level       text not null default '员工',
  domain      text not null default '3c'
              check (domain in ('3c','hongmeng','zunjie','aftersales','kufang','admin','manager')),
  active      boolean not null default true,
  joined_at   date,
  left_at     date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.staff is '员工主数据；name 同时是账号绑定键，改名必须级联';
create index if not exists idx_staff_domain on public.staff (domain) where active;
create index if not exists idx_staff_active on public.staff (active);

drop trigger if exists trg_staff_touch on public.staff;
create trigger trg_staff_touch before update on public.staff
  for each row execute function public.tg_touch_updated_at();

-- =============================================================
-- 2. profiles · 账号（1:1 挂 auth.users；用户名→伪邮箱由 Edge Function 拼）
-- =============================================================
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null unique
                 check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$'),
  display_name   text not null default '',
  role           text not null default 'employee'
                 check (role in ('manager','viewer','employee')),
  status         text not null default 'pending'
                 check (status in ('pending','active','disabled','rejected')),
  staff_name     text references public.staff(name) on update cascade on delete set null,
  apply_note     text,                       -- 注册时填的申请理由（便于审核）
  approved_by    uuid references public.profiles(id),
  approved_at    timestamptz,
  rejected_reason text,
  disabled_at    timestamptz,
  disabled_reason text,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.profiles is '账号资料；status=disabled 时 RLS 立即失效（离职封禁第一道锁）';
comment on column public.profiles.staff_name is '对应 staff.name；employee 角色必须非空才可见班表';
create index if not exists idx_profiles_status on public.profiles (status);
create index if not exists idx_profiles_staff on public.profiles (staff_name);
create unique index if not exists uq_profiles_staff_name
  on public.profiles (staff_name) where staff_name is not null;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.tg_touch_updated_at();

-- =============================================================
-- 3. invite_codes · 邀请码（可禁用 + 生效时间窗 + 次数上限）
-- =============================================================
create table if not exists public.invite_codes (
  code        text primary key check (code = upper(code) and length(code) between 4 and 32),
  max_uses    integer not null default 1 check (max_uses > 0),
  used_count  integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  disabled    boolean not null default false,
  note        text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint chk_invite_window check (ends_at is null or ends_at > starts_at)
);
create index if not exists idx_invite_active on public.invite_codes (code)
  where not disabled;

-- =============================================================
-- 4. invite_uses · 谁用了哪个码（审计）
-- =============================================================
create table if not exists public.invite_uses (
  id          bigint generated always as identity primary key,
  code        text not null references public.invite_codes(code) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  used_at     timestamptz not null default now(),
  unique (code, profile_id)
);

-- =============================================================
-- 5. devices · 设备登记（不限数量；离职时一次性全部吊销）
-- =============================================================
create table if not exists public.devices (
  id           bigint generated always as identity primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  device_hash  text not null,
  ua           text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  revoked_at   timestamptz,
  revoked_by   uuid references public.profiles(id),
  unique (profile_id, device_hash)
);
comment on table public.devices is '不限制设备数量；只用于审计与事后封禁';
create index if not exists idx_devices_profile on public.devices (profile_id);
create index if not exists idx_devices_hash on public.devices (device_hash);

-- =============================================================
-- 6. device_bans · 设备黑名单（永久，仅管理员手动解封）
-- =============================================================
create table if not exists public.device_bans (
  device_hash  text primary key,
  banned_at    timestamptz not null default now(),
  banned_by    uuid references public.profiles(id),
  reason       text,
  lifted_at    timestamptz,
  lifted_by    uuid references public.profiles(id)
);
create index if not exists idx_device_bans_live on public.device_bans (device_hash)
  where lifted_at is null;

-- =============================================================
-- 7. auth_logs · 登录尝试（限流 + 撞库分析）
-- =============================================================
create table if not exists public.auth_logs (
  id           bigint generated always as identity primary key,
  username     text,
  device_hash  text,
  ip_hint      text,
  ok           boolean not null,
  reason       text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_auth_logs_user_time on public.auth_logs (username, created_at desc);
create index if not exists idx_auth_logs_fail on public.auth_logs (username, created_at desc) where not ok;

-- =============================================================
-- 8. weeks · 周维度（草稿 / 已发布）
-- =============================================================
create table if not exists public.weeks (
  week_key     date primary key,                -- 该周周一
  status       text not null default 'draft' check (status in ('draft','published')),
  lock_version integer not null default 0,
  note         text,
  updated_by   uuid references public.profiles(id),
  updated_at   timestamptz not null default now(),
  constraint chk_week_monday check (extract(isodow from week_key) = 1)
);

drop trigger if exists trg_weeks_touch on public.weeks;
create trigger trg_weeks_touch before update on public.weeks
  for each row execute function public.tg_touch_updated_at();

-- =============================================================
-- 9. shifts · 草稿班表格子（按格 upsert + 乐观锁）
-- =============================================================
create table if not exists public.shifts (
  week_key    date not null references public.weeks(week_key) on delete cascade,
  staff_name  text not null references public.staff(name) on update cascade on delete cascade,
  day         smallint not null check (day between 0 and 6),   -- 0=周一
  slot        text check (slot is null or slot in ('early','mid','night','rest')),
  role        text check (role is null or role in ('open','close')),
  manual      boolean not null default false,
  note        text,
  lock_version integer not null default 0,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now(),
  primary key (week_key, staff_name, day)
);
comment on table public.shifts is '草稿；员工永远读不到这张表';
create index if not exists idx_shifts_week on public.shifts (week_key);

-- =============================================================
-- 10. requests · 请假 / 调班申请
-- =============================================================
create table if not exists public.requests (
  id           bigint generated always as identity primary key,
  staff_name   text not null references public.staff(name) on update cascade on delete cascade,
  week_key     date,
  day          smallint check (day is null or day between 0 and 6),
  type         text not null default 'leave'
               check (type in ('leave','swap','must')),
  note         text,
  status       text not null default 'approved'
               check (status in ('pending','approved','rejected')),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_requests_week on public.requests (week_key);

-- =============================================================
-- 11. must_work · 必上标记（day 为空 = 本周不限哪天）
-- =============================================================
create table if not exists public.must_work (
  id          bigint generated always as identity primary key,
  staff_name  text not null references public.staff(name) on update cascade on delete cascade,
  week_key    date not null,
  day         smallint check (day is null or day between 0 and 6),
  note        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_must_work
  on public.must_work (week_key, staff_name, coalesce(day, -1));

-- =============================================================
-- 12. fixed_roster · 固定班表（pattern 全员 / 逐人覆盖）
-- =============================================================
create table if not exists public.fixed_roster (
  id          bigint generated always as identity primary key,
  domain      text not null
              check (domain in ('3c','hongmeng','zunjie','aftersales','kufang','admin','manager')),
  staff_name  text references public.staff(name) on update cascade on delete cascade,
  pattern     text[] check (pattern is null or array_length(pattern, 1) = 7),
  created_at  timestamptz not null default now(),
  constraint chk_fixed_roster_scope check (pattern is not null or staff_name is not null)
);
create unique index if not exists uq_fixed_roster_pattern
  on public.fixed_roster (domain) where staff_name is null;
create unique index if not exists uq_fixed_roster_person
  on public.fixed_roster (domain, staff_name) where staff_name is not null;

-- =============================================================
-- 13. rules · 各领域规则阈值（把硬编码常量搬出来）
-- =============================================================
create table if not exists public.rules (
  domain      text primary key
              check (domain in ('3c','hongmeng','zunjie','aftersales','kufang','admin','manager')),
  config      jsonb not null default '{}'::jsonb,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_rules_touch on public.rules;
create trigger trg_rules_touch before update on public.rules
  for each row execute function public.tg_touch_updated_at();

-- =============================================================
-- 14. publish_versions · 每次发布的版本
-- =============================================================
create table if not exists public.publish_versions (
  publish_id    uuid primary key default gen_random_uuid(),
  week_key      date not null references public.weeks(week_key) on delete cascade,
  version       integer not null check (version > 0),
  published_by  uuid references public.profiles(id),
  published_at  timestamptz not null default now(),
  note          text,
  summary       jsonb not null default '{}'::jsonb,
  unique (week_key, version)
);
create index if not exists idx_publish_week on public.publish_versions (week_key, version desc);

-- =============================================================
-- 15. published_shifts · 已发布快照（员工只读这张表）
-- =============================================================
create table if not exists public.published_shifts (
  publish_id   uuid not null references public.publish_versions(publish_id) on delete cascade,
  week_key     date not null,
  staff_name   text not null,
  day          smallint not null check (day between 0 and 6),
  slot         text,
  role         text,
  primary key (publish_id, staff_name, day)
);
comment on table public.published_shifts is '快照；草稿改动对员工不可见';
create index if not exists idx_published_staff on public.published_shifts (staff_name, week_key);

-- =============================================================
-- 16. publish_deliveries · 推送投递（幂等键防重复推送）
-- =============================================================
create table if not exists public.publish_deliveries (
  id           bigint generated always as identity primary key,
  publish_id   uuid not null references public.publish_versions(publish_id) on delete cascade,
  staff_name   text not null,
  channel      text not null default 'inapp' check (channel in ('inapp','feishu')),
  status       text not null default 'pending'
               check (status in ('pending','sent','failed','seen')),
  sent_at      timestamptz,
  seen_at      timestamptz,
  error        text,
  unique (publish_id, staff_name, channel)
);
create index if not exists idx_deliveries_pending on public.publish_deliveries (publish_id)
  where status in ('pending','failed');

-- =============================================================
-- 17. audit_logs · 操作审计
-- =============================================================
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id),
  actor_name  text,
  action      text not null,
  target      text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_time on public.audit_logs (created_at desc);
create index if not exists idx_audit_actor on public.audit_logs (actor_id, created_at desc);

-- =============================================================
-- 校验：应返回 17
-- =============================================================
-- select count(*) from information_schema.tables
--  where table_schema = 'public' and table_type = 'BASE TABLE';
