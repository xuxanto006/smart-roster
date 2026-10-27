// =============================================================
// register/index.ts · 员工注册（匿名可调，需关 JWT 验证）
//
// 请求：POST /functions/v1/register
// {
//   username, password,
//   invite_code, captcha_token, captcha_answer,
//   device_id,        // 必填：本机随机标识（localStorage），与登录共用同一份 device_bans
//   staff_name?,      // 从「员工名单」里选自己，可不填留待经理审核时绑定
//   apply_note?       // 申请说明
// }
// 成功：200 { ok:true, username, status:'pending' }
// 业务失败：400 { ok:false, code, error }
//
// 顺序很重要（先难后易，避免脏数据）：
//   验证码 → 格式校验（含 device_id）→ 设备黑名单 → 员工名占用检查 → 邀请码预检
//   → 建 Auth 用户 → 写入 profile(status=pending)
//   → 邀请码原子占用（失败则回滚 profile + 删号）→ 审计
//   ⚠️ profile 必须早于 redeem_invite：invite_uses.profile_id 外键指向 profiles(id)，
//      反过来做会触发 23503，整个占用事务回滚、注册直接 500（2026-10-27 实测踩过）
//
// 为什么注册也要查设备黑名单（只在登录拦是不够的）：
//   离职封禁会把该账号名下所有设备永久拉黑（device_bans）。若注册不查，
//   同一个被拉黑的设备只要换个新账号名、甚至认领另一个员工名，就又回来了 ——
//   等于把「设备永久拉黑」这道锁从注册口绕开。放在建号之前查，被拉黑的设备
//   连 Auth 用户都不会被创建。
// =============================================================

import { requireCaptchaSecret, verifyCaptcha } from '../_shared/captcha.ts';
import { json, preflight } from '../_shared/cors.ts';
import {
  adminCreateUser,
  adminDeleteUser,
  pgDelete,
  pgInsert,
  pgRpc,
  pgSelect,
} from '../_shared/db.ts';
import {
  checkPassword,
  cleanText,
  normInvite,
  normUsername,
  pseudoEmail,
} from '../_shared/validate.ts';

const INVITE_MSG: Record<string, string> = {
  NOT_FOUND: '邀请码不存在，请向排班经理索取',
  DISABLED: '该邀请码已被停用',
  NOT_STARTED: '该邀请码还没到生效时间',
  EXPIRED: '该邀请码已过期',
  EXHAUSTED: '该邀请码的使用次数已用完',
};

type StaffRow = { name: string };
type ProfileRow = { id: string; username: string; staff_name: string | null };
type BanRow = { device_hash: string };

// 与 login 同一套规则：16~128 位字母/数字/下划线/连字符
// （前端 auth-core.js 的 deviceId() 生成 24 字节 → 32 字符 base64url）
const DEVICE_RE = /^[A-Za-z0-9_-]{16,128}$/;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflight(origin);
  if (req.method !== 'POST') return json({ ok: false, error: '只支持 POST' }, 405, origin);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: 'BAD_JSON', error: '请求格式不对' }, 400, origin);
  }

  // ---------- 0. 邀请码预检（注册第 1 步「下一步」用，匿名可调）----------
  // 只回「能不能用」，不回邀请码的归属/已用次数等任何元数据。
  // 目的：前端不拿到真实校验就不能进第 2 步，避免随便编一串字符浪费一次完整注册提交。
  if (body.action === 'check_invite') {
    const rawInv = normInvite(body.invite_code);
    if (!rawInv.ok) {
      return json({ ok: false, code: 'BAD_INVITE', error: rawInv.error }, 400, origin);
    }
    try {
      const pre = await pgRpc<string>('check_invite', { p_code: rawInv.value });
      if (pre !== 'ok') {
        return json(
          { ok: false, code: 'INVITE_INVALID', error: INVITE_MSG[pre] ?? '邀请码不可用' },
          400,
          origin,
        );
      }
      return json({ ok: true, invite: rawInv.value }, 200, origin);
    } catch (e) {
      console.error('check_invite failed:', e);
      return json({ ok: false, code: 'INTERNAL', error: '服务器开小差了，请稍后再试' }, 500, origin);
    }
  }

  // ---------- 1. 验证码（最先做，挡脚本）----------
  let secret: string;
  try {
    secret = requireCaptchaSecret();
  } catch (e) {
    console.error('captcha secret missing:', e);
    return json({ ok: false, code: 'SERVER_MISCONFIG', error: '服务未就绪，请联系管理员' }, 500, origin);
  }

  const cap = await verifyCaptcha(
    secret,
    String(body.captcha_token ?? ''),
    String(body.captcha_answer ?? ''),
  );
  if (!cap.ok) {
    return json({ ok: false, code: 'CAPTCHA_FAILED', error: cap.why }, 400, origin);
  }

  // ---------- 2. 格式校验 ----------
  const u = normUsername(body.username);
  if (!u.ok) return json({ ok: false, code: 'BAD_USERNAME', error: u.error }, 400, origin);

  const p = checkPassword(body.password);
  if (!p.ok) return json({ ok: false, code: 'BAD_PASSWORD', error: p.error }, 400, origin);

  const inv = normInvite(body.invite_code);
  if (!inv.ok) return json({ ok: false, code: 'BAD_INVITE', error: inv.error }, 400, origin);

  // 设备标识：纯格式校验，不查库（查库放在下一步的 try 里）
  const deviceId = typeof body.device_id === 'string' ? body.device_id : '';
  if (!DEVICE_RE.test(deviceId)) {
    return json(
      { ok: false, code: 'BAD_DEVICE', error: '设备标识异常，请刷新页面后重试' },
      400,
      origin,
    );
  }

  const staffName = cleanText(body.staff_name, 40) || null;
  const applyNote = cleanText(body.apply_note, 200);

  try {
    // ---------- 3. 设备黑名单（离职封禁时被拉黑的机器，注册口也要拦）----------
    const banned = await pgSelect<BanRow>(
      `device_bans?device_hash=eq.${encodeURIComponent(deviceId)}` +
        `&lifted_at=is.null&select=device_hash&limit=1`,
    );
    if (banned.length > 0) {
      await pgInsert('audit_logs', {
        action: 'register_blocked',
        target: u.value,
        detail: { device_hash: deviceId.slice(0, 12), reason: 'device_banned' },
      }).catch((e) => console.error('audit failed:', e));
      return json(
        { ok: false, code: 'DEVICE_BANNED', error: '该设备已被禁用，请联系排班经理处理' },
        400,
        origin,
      );
    }

    // ---------- 4. 账号名是否已被占用 ----------
    const dup = await pgSelect<ProfileRow>(
      `profiles?username=eq.${encodeURIComponent(u.value)}&select=id,username,staff_name`,
    );
    if (dup.length > 0) {
      return json({ ok: false, code: 'USERNAME_TAKEN', error: '这个账号名已经被用了' }, 400, origin);
    }

    // ---------- 5. 员工名是否真实存在 / 是否已被别人认领 ----------
    if (staffName) {
      const staff = await pgSelect<StaffRow>(
        `staff?name=eq.${encodeURIComponent(staffName)}&select=name`,
      );
      if (staff.length === 0) {
        return json(
          { ok: false, code: 'STAFF_NOT_FOUND', error: '员工名单里没有这个人，请从下拉列表选择' },
          400,
          origin,
        );
      }
      const claimed = await pgSelect<ProfileRow>(
        `profiles?staff_name=eq.${encodeURIComponent(staffName)}&select=id,username`,
      );
      if (claimed.length > 0) {
        return json(
          { ok: false, code: 'STAFF_TAKEN', error: '这个员工已经绑定过账号了' },
          400,
          origin,
        );
      }
    }

    // ---------- 6. 邀请码预检（先别建号，省得白建再删）----------
    const pre = await pgRpc<string>('check_invite', { p_code: inv.value });
    if (pre !== 'ok') {
      return json(
        { ok: false, code: 'INVITE_INVALID', error: INVITE_MSG[pre] ?? '邀请码不可用' },
        400,
        origin,
      );
    }

    // ---------- 7. 建 Auth 用户（邮箱=用户名@staff.smart-roster.local）----------
    const email = pseudoEmail(u.value);
    let created: { id: string };
    try {
      created = await adminCreateUser(email, p.value);
    } catch (e) {
      const msg = String(e);
      if (/already|registered|exists|duplicate|23505/i.test(msg)) {
        return json({ ok: false, code: 'USERNAME_TAKEN', error: '这个账号名已经被用了' }, 400, origin);
      }
      console.error('createUser failed:', msg);
      return json({ ok: false, code: 'CREATE_FAILED', error: '创建账号失败，请稍后再试' }, 500, origin);
    }

    // ---------- 8. 写 profile（待审核）----------
    // ⚠️ 必须早于 redeem_invite：invite_uses.profile_id 外键指向 profiles(id)
    try {
      await pgInsert('profiles', {
        id: created.id,
        username: u.value,
        display_name: staffName ?? u.value,
        role: 'employee',
        status: 'pending',
        staff_name: staffName,
        apply_note: applyNote || null,
      });
    } catch (e) {
      const msg = String(e);
      const taken = /23505|duplicate/i.test(msg);
      await adminDeleteUser(created.id).catch(() => {});
      if (taken) {
        return json(
          { ok: false, code: 'STAFF_TAKEN', error: '账号名或员工已被占用，请换一个' },
          400,
          origin,
        );
      }
      console.error('insert profile failed:', msg);
      return json({ ok: false, code: 'CREATE_FAILED', error: '创建账号失败，请稍后再试' }, 500, origin);
    }

    // ---------- 9. 邀请码原子占用（并发安全）；失败回滚 profile + Auth 账号 ----------
    const redeemed = await pgRpc<string>('redeem_invite', {
      p_code: inv.value,
      p_profile: created.id,
    });
    if (redeemed !== 'ok') {
      await pgDelete(`profiles?id=eq.${encodeURIComponent(created.id)}`).catch((e) =>
        console.error('rollback delete profile failed:', e)
      );
      await adminDeleteUser(created.id).catch((e) => console.error('rollback deleteUser failed:', e));
      return json(
        { ok: false, code: 'INVITE_INVALID', error: INVITE_MSG[redeemed] ?? '邀请码不可用' },
        400,
        origin,
      );
    }

    // ---------- 10. 审计 ----------
    await pgInsert('audit_logs', {
      action: 'register',
      target: u.value,
      detail: { staff_name: staffName, invite: inv.value.slice(0, 4) + '***' },
    }).catch((e) => console.error('audit failed:', e));

    return json(
      { ok: true, username: u.value, status: 'pending', message: '注册成功，等待排班经理审核' },
      200,
      origin,
    );
  } catch (e) {
    console.error('register unhandled:', e);
    return json({ ok: false, code: 'INTERNAL', error: '服务器开小差了，请稍后再试' }, 500, origin);
  }
});
