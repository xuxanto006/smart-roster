-- =============================================================
-- 007_rename_dev_employee.sql · 开发员工账号 xmt → test
-- -------------------------------------------------------------
-- 在 Supabase SQL Editor（postgres 角色）执行，可重复执行（幂等）。
--
-- 目的：登录页「普通用户身份」的内置开发账号从 xmt 改名成 test，
--       密码 12345678，让开发状态下的一键登录能直接用。
--
-- 账号体系约定：profiles.id = auth.users.id，
--               邮箱 = 用户名@staff.smart-roster.local（见 _shared/validate.ts）
--
-- 脚本按现状自动选路：
--   A. 只有 xmt        → profile / auth 邮箱 / email identity 一起改名成 test，id 不变（历史数据不丢）
--   B. xmt 和 test 都在 → 保留 test（密码重置为 12345678），xmt 置为 disabled（不删，随时可恢复）
--   C. 只有 test       → 只把 test 的密码重置为 12345678（缺 auth 用户时补建）
--   D. 两个都没有       → 只打提示：需要用邀请码注册一个 test
-- =============================================================

do $$
declare
  v_xmt   uuid;
  v_test  uuid;
  v_email text := 'test@staff.smart-roster.local';
  v_role  text;
begin
  select id into v_xmt  from public.profiles where username = 'xmt';
  select id into v_test from public.profiles where username = 'test';
  raise notice '现状：xmt=%, test=%', coalesce(v_xmt::text, '（无）'), coalesce(v_test::text, '（无）');

  if v_test is not null then
    -- ---------- B / C：保留 test ----------
    update auth.users
       set encrypted_password = extensions.crypt('12345678', extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where email = v_email;

    if not found then
      -- test 的 profile 在、auth 用户不在：用 profile.id 补建一个邮箱账号
      begin
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) values (
          '00000000-0000-0000-0000-000000000000', v_test, 'authenticated', 'authenticated',
          v_email, extensions.crypt('12345678', extensions.gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
        );
        insert into auth.identities (
          id, user_id, provider_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) values (
          gen_random_uuid(), v_test, v_email,
          jsonb_build_object('sub', v_test::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now()
        );
        raise notice '  test 原本没有 auth 用户，已按 profile.id 补建';
      exception when others then
        raise notice '  ! 补建 auth 用户失败（%），请到 Dashboard → Authentication 手动新建 test 并设密码 12345678', sqlerrm;
      end;
    else
      raise notice '  test 密码已重置为 12345678';
    end if;

    select role into v_role from public.profiles where id = v_test;
    raise notice '  test 当前角色 = %（要测员工端应为 employee；若是 manager 需另行调整）', v_role;

    if v_xmt is not null and v_xmt <> v_test then
      update public.profiles
         set status          = 'disabled',
             disabled_at     = coalesce(disabled_at, now()),
             disabled_reason = coalesce(disabled_reason, '已并入 test 账号')
       where id = v_xmt;
      raise notice '  xmt 已停用（数据保留）；确认不需要可在 Dashboard 删除';
    end if;

  elsif v_xmt is not null then
    -- ---------- A：直接改名（id 不变） ----------
    update public.profiles set username = 'test' where id = v_xmt;

    update auth.users
       set email              = v_email,
           encrypted_password = extensions.crypt('12345678', extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_xmt;

    update auth.identities
       set provider_id   = v_email,
           identity_data = jsonb_set(
             coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email)
           ),
           updated_at    = now()
     where user_id = v_xmt and provider = 'email';

    raise notice '  xmt → test 改名完成（profile + auth 邮箱 + email identity）';

  else
    raise notice '  两个账号都不存在：请用邀请码注册一个 test，再回来重跑本脚本';
  end if;
end $$;

-- 执行完看这一行：应为 username=test / status=active / email=test@staff.smart-roster.local / has_password=t
select p.username, p.role, p.status, u.email,
       (u.encrypted_password is not null) as has_password
  from public.profiles p
  left join auth.users u on u.id = p.id
 where p.username in ('test', 'xmt')
 order by p.username;
