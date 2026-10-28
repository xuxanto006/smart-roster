-- =============================================================
-- 008_dev_test_employee.sql · 把开发员工账号 test 变成真正的「员工」
-- -------------------------------------------------------------
-- 在 Supabase SQL Editor（postgres 角色）执行，可重复执行（幂等）。
--
-- 背景：007 只负责把开发账号改名成 test（密码 12345678），
--       但 test 的 profiles.role 仍是 viewer（只读）、staff_name 也是空。
--       于是登录页点「普通用户身份」会：
--         ① 被前端身份核对拦下（viewer 属于经理侧，进不了员工端）；
--         ② 就算放行，my_staff_name() 为 null → published_shifts 一行都读不到。
--
-- 本脚本做三件事：
--   1) test.role = 'employee'、status = 'active'（保证 RLS 的 is_active_user() 成立）
--   2) 给 test 绑一个 staff_name：
--        a. 已经绑好且有效 → 不动
--        b. 否则接手 xmt 原来绑的那个（先把 xmt 的 staff_name 置空，让出唯一索引）
--        c. 都没有 → 挑一个「没被任何账号占用、且已经出现在已发布快照里」的在职员工
--   3) xmt 保持 disabled（只让出 staff_name，不删、不启用），末尾打印诊断
--
-- 只动开发账号，不碰任何真实员工的资料。
--
-- 注：线上库已用经理口径的 `review` Edge Function 走过一次同样的改动
--     （action=approve, role=employee, staff_name=谢佳委），所以第 2 步会命中 a. 分支保持不动；
--     本脚本仍然幂等，留着给「换一个库 / 重置环境」时用。
-- =============================================================

do $$
declare
  v_test   uuid;
  v_xmt    uuid;
  v_staff  text;
  v_pub    integer := 0;
begin
  select id into v_test from public.profiles where username = 'test';
  select id into v_xmt  from public.profiles where username = 'xmt';

  if v_test is null then
    raise notice '没有 test 这个账号：先执行 007_rename_dev_employee.sql（它会把 xmt 改名成 test）';
    return;
  end if;

  -- ---------- 1) 角色与状态 ----------
  update public.profiles
     set role   = 'employee',
         status = 'active'
   where id = v_test
     and (role <> 'employee' or status <> 'active');
  raise notice 'test 已设为 employee / active';

  -- ---------- 2) 绑定 staff_name ----------
  select staff_name into v_staff from public.profiles where id = v_test;

  -- a. 已经绑好：确认这个员工还在
  if v_staff is not null and not exists (select 1 from public.staff where name = v_staff) then
    v_staff := null;
  end if;

  -- b. 接手 xmt 绑的那个（先让 xmt 让位，否则唯一索引会挡）
  if v_staff is null and v_xmt is not null and v_xmt <> v_test then
    select staff_name into v_staff from public.profiles where id = v_xmt;
    if v_staff is not null then
      update public.profiles set staff_name = null where id = v_xmt;
      raise notice 'xmt 让出员工绑定：%', v_staff;
    end if;
  end if;

  -- c. 挑一个「有已发布班表、且没被别人占着」的在职员工
  if v_staff is null then
    select s.name
      into v_staff
      from public.staff s
      left join (select staff_name, count(*) as n from public.published_shifts group by staff_name) p
             on p.staff_name = s.name
     where s.active
       and s.domain not in ('manager', 'admin')
       and not exists (
         select 1 from public.profiles pr
          where pr.staff_name = s.name and pr.id <> v_test
       )
     order by coalesce(p.n, 0) desc, s.name
     limit 1;
    if v_staff is not null then
      raise notice '给 test 挑了一个员工：%', v_staff;
    end if;
  end if;

  -- 落库（有冲突就只提示，不炸脚本）
  if v_staff is not null then
    begin
      update public.profiles set staff_name = v_staff where id = v_test;
    exception when unique_violation then
      raise notice '  ! % 已经绑在别的账号上，跳过绑定（可在后台手工改 staff_name）', v_staff;
    end;
  else
    raise notice '  ! 没找到可绑的员工：员工端能登录，但读不到班表';
  end if;

  -- ---------- 3) xmt 保持停用 ----------
  if v_xmt is not null and v_xmt <> v_test then
    update public.profiles
       set status = 'disabled',
           disabled_reason = coalesce(disabled_reason, '已改名为 test，旧账号停用')
     where id = v_xmt and status <> 'disabled';
    raise notice 'xmt 保持 disabled（不删，随时可恢复）';
  end if;

  -- ---------- 诊断 ----------
  select count(*) into v_pub
    from public.published_shifts
   where staff_name = (select staff_name from public.profiles where id = v_test);
  raise notice '诊断：test 已发布班表格子数 = %', v_pub;
end $$;

-- =============================================================
-- 结果自查（应看到 role=employee / status=active / staff_name 非空）
-- =============================================================
select p.username,
       p.role,
       p.status,
       p.staff_name,
       (select count(*) from public.published_shifts ps where ps.staff_name = p.staff_name)
         as published_cells
  from public.profiles p
 where p.username in ('test', 'xmt', 'superadmin')
 order by p.username;
