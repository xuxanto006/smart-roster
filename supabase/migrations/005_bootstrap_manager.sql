-- =============================================================
-- 005_bootstrap_manager.sql · 第一个经理账号
-- 为什么需要这一步：
--   账号密码存在 Supabase Auth（auth.users）里，密码用 GoTrue 自己的 bcrypt 格式，
--   **不能**纯 SQL 手插（容易漏 identities 行导致登录失败）。
--   正确做法：先用控制台建 Auth 用户，再用这段 SQL 给他挂上 profiles。
-- 步骤：
--   ① Supabase Dashboard → Authentication → Users → Add user
--      Email:    admin@staff.smart-roster.local      ← 必须是「用户名@staff.smart-roster.local」
--      Password: 自己想一个 ≥8 位强密码
--      勾选 Auto Confirm User（否则无法登录）
--   ② 打开 SQL Editor，把下面 v_email 改成同一个邮箱，执行
--   ③ 在登录页用「用户名 admin + 刚设的密码」登录，进去第一件事改密
-- 可重复执行：只更新，不重复插入
-- =============================================================

do $$
declare
  v_email    text := 'superadmin@staff.smart-roster.local';   -- ← 改成你实际建的邮箱
  v_username text := 'superadmin';                            -- ← 登录时用的账号名
  v_uid      uuid;
begin
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    raise exception 'auth.users 里找不到 %，请先在 Dashboard → Authentication → Users 添加该用户', v_email;
  end if;

  insert into public.profiles (id, username, display_name, role, status, approved_at)
  values (v_uid, v_username, '系统管理员', 'manager', 'active', now())
  on conflict (id) do update
    set username     = excluded.username,
        role         = 'manager',
        status       = 'active',
        disabled_at  = null,
        disabled_reason = null;

  insert into public.audit_logs (actor_id, actor_name, action, target, detail)
  values (v_uid, v_username, 'bootstrap_manager', v_username, '{}'::jsonb);

  raise notice '已创建/修复经理账号：% (username=%)', v_email, v_username;
end
$$;

-- 校验：应返回 1 行 manager/active
-- select username, role, status from public.profiles where role = 'manager';
