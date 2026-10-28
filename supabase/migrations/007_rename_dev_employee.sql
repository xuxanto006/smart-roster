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
--
-- 相对旧版加固（2026-10-27）：
--   找 test 的 auth 用户时「先按 id、再按邮箱」，两种历史状态都能收；
--   邮箱被别的 auth 用户占着时先把它挪开，不让唯一约束把整个脚本炸掉。
-- =============================================================

do $$
declare
  v_xmt   uuid;
  v_test  uuid;
  v_uid   uuid;
  v_email text := 'test@staff.smart-roster.local';
  v_role  text;
  v_pw    text := '12345678';
begin
  select id into v_xmt  from public.profiles where username = 'xmt';
  select id into v_test from public.profiles where username = 'test';
  raise notice '现状：xmt=%, test=%', coalesce(v_xmt::text, '（无）'), coalesce(v_test::text, '（无）');

  if v_test is not null then
    -- ---------- B / C：保留 test ----------
    -- 1) 找 test 对应的 auth 用户：先按 id（约定 profiles.id = auth.users.id），再退回按邮箱
    select id into v_uid from auth.users where id = v_test;
    if v_uid is null then
      select id into v_uid from auth.users where email = v_email;
    end if;

    -- 2) 邮箱被另一个 auth 用户占着：先把它挪到 orphan-… 再继续（否则唯一约束会挡死）
    if v_uid is not null and v_uid <> v_test then
      begin
        update auth.users
           set email = 'orphan-' || v_uid::text || '@staff.smart-roster.local',
               updated_at = now()
         where id = v_uid;
        raise notice '  ! 邮箱 % 原本挂在另一个 auth 用户 %（与 test 的 profile 不同 id），已把它改名为 orphan-…', v_email, v_uid;
      exception when others then
        raise notice '  ! 邮箱 % 被另一个 auth 用户占用且改名失败：%', v_email, sqlerrm;
      end;
      v_uid := null;
    end if;

    -- 3) 没有 auth 用户就按 profile.id 补建；有就重置密码并把邮箱对齐
    if v_uid is null then
      begin
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data
        ) values (
          '00000000-0000-0000-0000-000000000000', v_test, 'authenticated', 'authenticated',
          v_email, extensions.crypt(v_pw, extensions.gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
        );
        v_uid := v_test;
        raise notice '  test 原本没有 auth 用户，已按 profile.id 补建';
      exception when others then
        raise notice '  ! 补建 auth 用户失败（%），请到 Dashboard → Authentication 手动新建 test 并设密码 %', sqlerrm, v_pw;
      end;
    else
      update auth.users
         set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
             email              = v_email,
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at         = now()
       where id = v_uid;
      raise notice '  test 密码已重置为 %（auth 用户 %）', v_pw, v_uid;
    end if;

    -- 4) 保证 email identity 那条也在：GoTrue 密码登录是按邮箱找用户的
    if v_uid is not null then
      if exists (select 1 from auth.identities where user_id = v_uid and provider = 'email') then
        update auth.identities
           set provider_id   = v_email,
               identity_data = jsonb_set(
                 coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email)
               ),
               updated_at    = now()
         where user_id = v_uid and provider = 'email';
      else
        begin
          insert into auth.identities (
            id, user_id, provider_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
          ) values (
            gen_random_uuid(), v_uid, v_email,
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
            'email', now(), now(), now()
          );
          raise notice '  ! 缺 email identity，已补一条';
        exception when others then
          raise notice '  ! 补 email identity 失败（%）：登录若仍报错，请到 Dashboard → Authentication → Providers 检查 Email 是否开启', sqlerrm;
        end;
      end if;
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
    begin
      update public.profiles set username = 'test' where id = v_xmt;
    exception when unique_violation then
      raise notice '  ! profiles 里已经有用户名 test，改名没做（请改用 B/C 分支的思路手工处理）';
    end;

    update auth.users
       set email              = v_email,
           encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_xmt;

    if not exists (select 1 from auth.identities where user_id = v_xmt and provider = 'email') then
      begin
        insert into auth.identities (
          id, user_id, provider_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) values (
          gen_random_uuid(), v_xmt, v_email,
          jsonb_build_object('sub', v_xmt::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now()
        );
      exception when others then
        raise notice '  ! 补 email identity 失败：%', sqlerrm;
      end;
    else
      update auth.identities
         set provider_id   = v_email,
             identity_data = jsonb_set(
               coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email)
             ),
             updated_at    = now()
       where user_id = v_xmt and provider = 'email';
    end if;

    raise notice '  xmt → test 改名完成（profile + auth 邮箱 + email identity）';

  else
    raise notice '  两个账号都不存在：请用邀请码注册一个 test，再回来重跑本脚本';
  end if;
end $$;

-- ============ 执行完看这一段（只读，一次粘贴就能判断结果） ============
-- 期望：test / employee / active / auth_id 非空 / auth_email=test@staff.smart-roster.local
--       / has_password=t / identities 含 email
select p.username, p.role, p.status,
       u.id                               as auth_id,
       u.email                            as auth_email,
       (u.encrypted_password is not null) as has_password,
       (select string_agg(i.provider, ',') from auth.identities i where i.user_id = p.id) as identities,
       u.email_confirmed_at
  from public.profiles p
  left join auth.users u on u.id = p.id
 where p.username in ('test', 'xmt')
 order by p.username;

-- 上面的结果若 auth_id 为空或 auth_email 不是 test@…，再看这一段：
-- 它能查出「邮箱被哪个 auth 用户占着 / 是否被封禁 / 是否被软删」
select id, email, email_confirmed_at, deleted_at, banned_until
  from auth.users
 where email like '%staff.smart-roster.local'
   and (email like 'test@%' or email like 'xmt@%' or email like 'orphan-%');
