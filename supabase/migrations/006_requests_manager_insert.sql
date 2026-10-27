-- 006_requests_manager_insert.sql
-- 经理端「请假 / 必上录入」面板需要经理**替别人**写 requests。
--
-- 背景：002_rls.sql 里的 pol_requests_insert 只放开「员工给自己提交」：
--     with check (public.is_active_user() and staff_name = public.my_staff_name())
-- 所以经理替张三录请假时，staff_name(张三) <> my_staff_name()(经理自己)
-- → 403 "new row violates row-level security policy for table requests"，
--   页面上表现就是「请假录不进去」（2026-10-27 用户实测反馈）。
--
-- Postgres 的 permissive policy 之间是 OR 关系：这里再补一条「编辑者（manager）可插任意人」，
-- 原有员工自助那条保持不变（员工照旧只能给自己提）。
-- 注意用 is_editor()（role = 'manager'），viewer 仍然只读。

drop policy if exists pol_requests_insert_mgr on public.requests;
create policy pol_requests_insert_mgr on public.requests
  for insert to authenticated
  with check (public.is_editor());

-- 顺带：created_by 自动记成当前登录账号（auth.uid()），不依赖前端传参，方便日后审计。
-- 前端没有 uuid 可用（session 里只有 username/role），所以交给数据库默认值最稳。
alter table public.requests alter column created_by set default auth.uid();

-- 校验（人工执行，用经理账号跑；应返回 1 行）：
-- explain (costs off) insert into public.requests (staff_name, week_key, day, type)
--   values ('陈悦娴', date_trunc('week', now())::date, 2, 'leave') returning id;
