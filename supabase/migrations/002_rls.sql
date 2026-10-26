-- =============================================================
-- 002_rls.sql · 行级权限（RLS）+ 权限判定函数
-- 核心原则：
--   ① 一切策略都挂在 is_active_user() 上 —— 账号一停用，数据立刻不可见、不可写
--   ② 员工只读 published_shifts，且只能读自己那一行
--   ③ shifts（草稿）员工一行都看不到
--   ④ profiles / devices / invite_* 的写操作只走 Edge Function（service_role），不给前端写权限
-- 执行顺序：001 → 002 → 003 → 004
-- =============================================================

-- =============================================================
-- 权限判定函数（security definer：绕过自身 RLS，避免递归）
-- =============================================================
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
   where id = auth.uid() and status = 'active';
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and status = 'active' and role in ('manager','viewer')
  );
$$;

-- 只读角色：能看全部，但不能改
create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and status = 'active' and role = 'manager'
  );
$$;

create or replace function public.my_staff_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select staff_name from public.profiles
   where id = auth.uid() and status = 'active';
$$;

-- =============================================================
-- 统一开启 RLS
-- =============================================================
alter table public.staff              enable row level security;
alter table public.profiles           enable row level security;
alter table public.invite_codes       enable row level security;
alter table public.invite_uses        enable row level security;
alter table public.devices            enable row level security;
alter table public.device_bans        enable row level security;
alter table public.auth_logs          enable row level security;
alter table public.weeks              enable row level security;
alter table public.shifts             enable row level security;
alter table public.requests           enable row level security;
alter table public.must_work          enable row level security;
alter table public.fixed_roster       enable row level security;
alter table public.rules              enable row level security;
alter table public.publish_versions   enable row level security;
alter table public.published_shifts   enable row level security;
alter table public.publish_deliveries enable row level security;
alter table public.audit_logs         enable row level security;

-- 匿名角色一律不给表权限（注册/登录只走 Edge Function）
revoke all on all tables in schema public from anon;

-- =============================================================
-- staff · 在职账号可读，只有经理可写
-- =============================================================
drop policy if exists pol_staff_read on public.staff;
create policy pol_staff_read on public.staff
  for select to authenticated using (public.is_active_user());

drop policy if exists pol_staff_write on public.staff;
create policy pol_staff_write on public.staff
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- =============================================================
-- profiles · 本人可读自己，经理可读全部；不开放任何前端写权限
-- =============================================================
drop policy if exists pol_profiles_read on public.profiles;
create policy pol_profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_manager());

-- =============================================================
-- invite_codes / invite_uses · 只给经理看
-- =============================================================
drop policy if exists pol_invite_codes_read on public.invite_codes;
create policy pol_invite_codes_read on public.invite_codes
  for select to authenticated using (public.is_manager());

drop policy if exists pol_invite_uses_read on public.invite_uses;
create policy pol_invite_uses_read on public.invite_uses
  for select to authenticated using (public.is_manager());

-- =============================================================
-- devices / device_bans · 只给经理看（写走 Edge Function）
-- =============================================================
drop policy if exists pol_devices_read on public.devices;
create policy pol_devices_read on public.devices
  for select to authenticated
  using (public.is_manager() or profile_id = auth.uid());

drop policy if exists pol_device_bans_read on public.device_bans;
create policy pol_device_bans_read on public.device_bans
  for select to authenticated using (public.is_manager());

-- =============================================================
-- auth_logs / audit_logs · 只给经理看（写走 Edge Function）
-- =============================================================
drop policy if exists pol_auth_logs_read on public.auth_logs;
create policy pol_auth_logs_read on public.auth_logs
  for select to authenticated using (public.is_manager());

drop policy if exists pol_audit_logs_read on public.audit_logs;
create policy pol_audit_logs_read on public.audit_logs
  for select to authenticated using (public.is_manager());

-- =============================================================
-- weeks / shifts · 草稿区，只属于经理
-- =============================================================
drop policy if exists pol_weeks_all on public.weeks;
create policy pol_weeks_all on public.weeks
  for all to authenticated
  using (public.is_manager()) with check (public.is_editor());

drop policy if exists pol_shifts_read on public.shifts;
create policy pol_shifts_read on public.shifts
  for select to authenticated using (public.is_manager());

drop policy if exists pol_shifts_write on public.shifts;
create policy pol_shifts_write on public.shifts
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- =============================================================
-- published_shifts · 员工只能读自己那一行（核心隔离）
-- =============================================================
drop policy if exists pol_published_read on public.published_shifts;
create policy pol_published_read on public.published_shifts
  for select to authenticated
  using (public.is_manager() or staff_name = public.my_staff_name());

drop policy if exists pol_published_write on public.published_shifts;
create policy pol_published_write on public.published_shifts
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- =============================================================
-- publish_versions / publish_deliveries · 经理专属
-- =============================================================
drop policy if exists pol_publish_versions_read on public.publish_versions;
create policy pol_publish_versions_read on public.publish_versions
  for select to authenticated using (public.is_manager());

drop policy if exists pol_publish_versions_write on public.publish_versions;
create policy pol_publish_versions_write on public.publish_versions
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

drop policy if exists pol_deliveries_read on public.publish_deliveries;
create policy pol_deliveries_read on public.publish_deliveries
  for select to authenticated
  using (public.is_manager() or staff_name = public.my_staff_name());

drop policy if exists pol_deliveries_write on public.publish_deliveries;
create policy pol_deliveries_write on public.publish_deliveries
  for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- =============================================================
-- requests · 员工可提交自己的申请、只看自己的；经理全权
-- =============================================================
drop policy if exists pol_requests_read on public.requests;
create policy pol_requests_read on public.requests
  for select to authenticated
  using (public.is_manager() or staff_name = public.my_staff_name());

drop policy if exists pol_requests_insert on public.requests;
create policy pol_requests_insert on public.requests
  for insert to authenticated
  with check (public.is_active_user() and staff_name = public.my_staff_name());

drop policy if exists pol_requests_write on public.requests;
create policy pol_requests_write on public.requests
  for update to authenticated
  using (public.is_editor()) with check (public.is_editor());

drop policy if exists pol_requests_delete on public.requests;
create policy pol_requests_delete on public.requests
  for delete to authenticated using (public.is_editor());

-- =============================================================
-- must_work / fixed_roster / rules · 经理专属
-- =============================================================
drop policy if exists pol_must_work_all on public.must_work;
create policy pol_must_work_all on public.must_work
  for all to authenticated
  using (public.is_manager()) with check (public.is_editor());

drop policy if exists pol_fixed_roster_all on public.fixed_roster;
create policy pol_fixed_roster_all on public.fixed_roster
  for all to authenticated
  using (public.is_manager()) with check (public.is_editor());

drop policy if exists pol_rules_all on public.rules;
create policy pol_rules_all on public.rules
  for all to authenticated
  using (public.is_manager()) with check (public.is_editor());

-- =============================================================
-- 自检（人工执行）：用员工账号跑这两句，必须返回 0 行
-- =============================================================
-- select count(*) from public.shifts;
-- select count(*) from public.published_shifts where staff_name <> public.my_staff_name();
