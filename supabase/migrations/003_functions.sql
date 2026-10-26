-- =============================================================
-- 003_functions.sql · 业务函数（全部 security definer）
-- 关键点：
--   · 邀请码原子占用：一条 UPDATE ... WHERE used_count < max_uses
--   · 离职封禁：一条事务内完成「停用账号 + 吊销全部设备 + 拉黑设备」
--   · 设备不限数量：touch_device 只 upsert，不做准入拦截
--   · 这些函数只给 service_role 用（Edge Function 内部调用），
--     对 anon / authenticated 一律 revoke，防止被前端直接调用
-- 执行顺序：001 → 002 → 003 → 004
-- =============================================================

-- =============================================================
-- 1. 邀请码校验（只读检查，给注册流程预检用）
--    返回码：ok / NOT_FOUND / DISABLED / NOT_STARTED / EXPIRED / EXHAUSTED
-- =============================================================
create or replace function public.check_invite(p_code text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare c public.invite_codes;
begin
  select * into c from public.invite_codes where code = upper(trim(p_code));
  if not found then return 'NOT_FOUND'; end if;
  if c.disabled then return 'DISABLED'; end if;
  if now() < c.starts_at then return 'NOT_STARTED'; end if;
  if c.ends_at is not null and now() >= c.ends_at then return 'EXPIRED'; end if;
  if c.used_count >= c.max_uses then return 'EXHAUSTED'; end if;
  return 'ok';
end
$$;

-- =============================================================
-- 2. 邀请码原子占用（防并发超卖）
--    返回码同上，成功时 used_count+1 并写入 invite_uses
-- =============================================================
create or replace function public.redeem_invite(p_code text, p_profile uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_ok   text;
begin
  update public.invite_codes c
     set used_count = c.used_count + 1
   where c.code = v_code
     and not c.disabled
     and now() >= c.starts_at
     and (c.ends_at is null or now() < c.ends_at)
     and c.used_count < c.max_uses
  returning c.code into v_ok;

  if v_ok is null then
    -- 没抢到：返回具体原因（顺序与 check_invite 一致）
    return public.check_invite(v_code);
  end if;

  insert into public.invite_uses (code, profile_id)
  values (v_ok, p_profile)
  on conflict (code, profile_id) do nothing;

  return 'ok';
end
$$;

-- =============================================================
-- 3. 设备登记（不限数量；被拉黑则不登记）
--    返回码：ok / BANNED / DISABLED / NOT_FOUND
-- =============================================================
create or replace function public.touch_device(
  p_profile uuid,
  p_device_hash text,
  p_ua text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.profiles where id = p_profile;
  if v_status is null then return 'NOT_FOUND'; end if;
  if v_status <> 'active' then return 'DISABLED'; end if;

  if exists (
    select 1 from public.device_bans
     where device_hash = p_device_hash and lifted_at is null
  ) then
    return 'BANNED';
  end if;

  insert into public.devices (profile_id, device_hash, ua, last_seen)
  values (p_profile, p_device_hash, left(coalesce(p_ua,''), 400), now())
  on conflict (profile_id, device_hash) do update
    set last_seen = now(),
        ua = coalesce(nullif(excluded.ua,''), public.devices.ua),
        revoked_at = null;          -- 解封后再次登录即恢复

  update public.profiles set last_login_at = now() where id = p_profile;

  return 'ok';
end
$$;

-- =============================================================
-- 4. 登录守卫（查停用 / 设备黑名单 / 失败锁定）
--    返回 allowed + reason，reason 用于前端提示
-- =============================================================
create or replace function public.login_guard(p_username text, p_device_hash text)
returns table (allowed boolean, reason text, profile_id uuid, display_name text, role text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p      public.profiles;
  v_fails  integer;
begin
  select * into v_p from public.profiles where username = lower(trim(p_username));

  if not found then
    return query select false, 'NO_SUCH_USER', null::uuid, null::text, null::text;
    return;
  end if;

  if v_p.status = 'pending' then
    return query select false, 'PENDING_APPROVAL', v_p.id, v_p.display_name, v_p.role;
    return;
  end if;
  if v_p.status = 'rejected' then
    return query select false, 'REJECTED', v_p.id, v_p.display_name, v_p.role;
    return;
  end if;
  if v_p.status <> 'active' then
    return query select false, 'DISABLED', v_p.id, v_p.display_name, v_p.role;
    return;
  end if;

  if exists (
    select 1 from public.device_bans
     where device_hash = p_device_hash and lifted_at is null
  ) then
    return query select false, 'DEVICE_BANNED', v_p.id, v_p.display_name, v_p.role;
    return;
  end if;

  -- 15 分钟内失败 5 次即锁定
  select count(*) into v_fails
    from public.auth_logs
   where username = v_p.username
     and not ok
     and created_at > now() - interval '15 minutes';
  if v_fails >= 5 then
    return query select false, 'TOO_MANY_FAILS', v_p.id, v_p.display_name, v_p.role;
    return;
  end if;

  return query select true, 'ok', v_p.id, v_p.display_name, v_p.role;
end
$$;

-- =============================================================
-- 5. 离职封禁（四道锁里的 ①③④；②Auth 封禁由 Edge Function 调 admin API）
--    返回被拉黑的设备数量
-- =============================================================
create or replace function public.offboard_profile(
  p_profile uuid,
  p_actor uuid default null,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_banned   integer := 0;
  v_row      record;
begin
  select username into v_username from public.profiles where id = p_profile;
  if v_username is null then
    raise exception 'profile % not found', p_profile;
  end if;

  -- ① 停用账号（保留不删）
  update public.profiles
     set status = 'disabled',
         disabled_at = now(),
         disabled_reason = coalesce(p_reason, '离职封禁')
   where id = p_profile;

  -- ③ 吊销全部设备 + 写入永久黑名单
  update public.devices
     set revoked_at = now(), revoked_by = p_actor
   where profile_id = p_profile and revoked_at is null;

  for v_row in
    select device_hash from public.devices where profile_id = p_profile
  loop
    insert into public.device_bans (device_hash, banned_at, banned_by, reason)
    values (v_row.device_hash, now(), p_actor, coalesce(p_reason, '离职封禁'))
    on conflict (device_hash) do update
      set banned_at = now(),
          banned_by = excluded.banned_by,
          reason = excluded.reason,
          lifted_at = null,
          lifted_by = null;
    v_banned := v_banned + 1;
  end loop;

  -- ④ 审计
  insert into public.audit_logs (actor_id, actor_name, action, target, detail)
  values (
    p_actor,
    (select username from public.profiles where id = p_actor),
    'offboard',
    v_username,
    jsonb_build_object('devices_banned', v_banned, 'reason', coalesce(p_reason, '离职封禁'))
  );

  return v_banned;
end
$$;

-- =============================================================
-- 6. 重新启用账号（解封第一步：status 回 active）
-- =============================================================
create or replace function public.reactivate_profile(p_profile uuid, p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set status = 'active',
         disabled_at = null,
         disabled_reason = null
   where id = p_profile;

  insert into public.audit_logs (actor_id, actor_name, action, target, detail)
  values (
    p_actor,
    (select username from public.profiles where id = p_actor),
    'reactivate',
    (select username from public.profiles where id = p_profile),
    '{}'::jsonb
  );
end
$$;

-- =============================================================
-- 7. 拉黑单台设备（管理员手动）
-- =============================================================
create or replace function public.ban_device(
  p_device_hash text,
  p_actor uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.device_bans (device_hash, banned_at, banned_by, reason)
  values (p_device_hash, now(), p_actor, coalesce(p_reason, '管理员手动拉黑'))
  on conflict (device_hash) do update
    set banned_at = now(),
        banned_by = excluded.banned_by,
        reason = excluded.reason,
        lifted_at = null,
        lifted_by = null;

  update public.devices
     set revoked_at = now(), revoked_by = p_actor
   where device_hash = p_device_hash and revoked_at is null;

  insert into public.audit_logs (actor_id, actor_name, action, target, detail)
  values (p_actor, (select username from public.profiles where id = p_actor),
          'ban_device', left(p_device_hash, 12), '{}'::jsonb);
end
$$;

-- =============================================================
-- 8. 解封单台设备（永久封禁 → 手动解封，无自动过期）
-- =============================================================
create or replace function public.unban_device(p_device_hash text, p_actor uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_hit integer;
begin
  update public.device_bans
     set lifted_at = now(), lifted_by = p_actor
   where device_hash = p_device_hash and lifted_at is null;
  get diagnostics v_hit = row_count;

  update public.devices
     set revoked_at = null, revoked_by = null
   where device_hash = p_device_hash;

  insert into public.audit_logs (actor_id, actor_name, action, target, detail)
  values (p_actor, (select username from public.profiles where id = p_actor),
          'unban_device', left(p_device_hash, 12), jsonb_build_object('lifted', v_hit > 0));

  return v_hit > 0;
end
$$;

-- =============================================================
-- 9. 权限收敛：以上函数只允许 service_role 调用
-- =============================================================
revoke all on function public.check_invite(text)                    from public, anon, authenticated;
revoke all on function public.redeem_invite(text, uuid)              from public, anon, authenticated;
revoke all on function public.touch_device(uuid, text, text)         from public, anon, authenticated;
revoke all on function public.login_guard(text, text)                from public, anon, authenticated;
revoke all on function public.offboard_profile(uuid, uuid, text)     from public, anon, authenticated;
revoke all on function public.reactivate_profile(uuid, uuid)         from public, anon, authenticated;
revoke all on function public.ban_device(text, uuid, text)           from public, anon, authenticated;
revoke all on function public.unban_device(text, uuid)               from public, anon, authenticated;

grant execute on function public.check_invite(text)                 to service_role;
grant execute on function public.redeem_invite(text, uuid)           to service_role;
grant execute on function public.touch_device(uuid, text, text)      to service_role;
grant execute on function public.login_guard(text, text)             to service_role;
grant execute on function public.offboard_profile(uuid, uuid, text)  to service_role;
grant execute on function public.reactivate_profile(uuid, uuid)      to service_role;
grant execute on function public.ban_device(text, uuid, text)        to service_role;
grant execute on function public.unban_device(text, uuid)            to service_role;

-- RLS 里用到的判定函数必须让已登录用户可执行
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.my_role()        to authenticated;
grant execute on function public.is_manager()     to authenticated;
grant execute on function public.is_editor()      to authenticated;
grant execute on function public.my_staff_name()  to authenticated;
