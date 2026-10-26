-- =============================================================
-- dev/create_test_invite.sql · 建一个开发自测用的邀请码（不走迁移，只手动执行）
-- 执行：SQL Editor 粘贴运行
-- 说明：可重复执行；会把 used_count 归零，方便反复测注册
-- =============================================================

insert into public.invite_codes (code, max_uses, note, created_by)
values (
  'TEST2026',
  20,
  '开发自测用，上线前务必禁用或删除',
  (select id from public.profiles where username = 'admin')
)
on conflict (code) do update
  set max_uses   = excluded.max_uses,
      disabled   = false,
      used_count = 0,
      starts_at  = now(),
      ends_at    = null,
      note       = excluded.note;

-- 校验：应看到 TEST2026 / max_uses=20 / used_count=0 / disabled=false
select code, max_uses, used_count, disabled, starts_at, ends_at
  from public.invite_codes
 order by created_at desc;
