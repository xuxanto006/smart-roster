// =============================================================
// login/index.ts · 登录（匿名可调，需关 JWT 验证）
//
// 请求：POST /functions/v1/login
// { username, password, device_id, ua?, captcha_token, captcha_answer }
//
// 成功：200 { ok:true, session:{access_token,refresh_token,expires_in,token_type},
//              profile:{username,role,display_name,staff_name,status} }
// 失败：200 { ok:false, reason, message }   ← 用 200 是为了让前端统一处理业务失败
//
// 职责边界：
//   密码校验交给 Supabase Auth（GoTrue），本函数只做「登录前拦人」和「登录后登记设备」
//   拦人顺序：算术验证码 → 账号不存在/待审核/已拒绝/已停用 → 设备黑名单 → 15 分钟失败锁定
//   验证码由 captcha 函数签发（HMAC 无状态），这里只判卷，答案不经网络回传
//   登记：touch_device（不限设备数量，只记录 + 检查黑名单）
// =============================================================

import { requireCaptchaSecret, verifyCaptcha } from '../_shared/captcha.ts';
import { json, preflight } from '../_shared/cors.ts';
import {
  anonKey,
  passwordSignIn,
  pgInsert,
  pgRpc,
  supaUrl,
} from '../_shared/db.ts';
import { normUsername, pseudoEmail } from '../_shared/validate.ts';

type GuardRow = {
  allowed: boolean;
  reason: string;
  profile_id: string | null;
  display_name: string | null;
  role: string | null;
};

const REASON_MSG: Record<string, string> = {
  NO_SUCH_USER: '账号或密码不对',
  PENDING_APPROVAL: '账号还在等排班经理审核，通过后就能登录',
  REJECTED: '注册申请未通过，请联系排班经理',
  DISABLED: '账号已停用，请联系排班经理',
  DEVICE_BANNED: '这台设备已被禁止登录，请联系排班经理解封',
  TOO_MANY_FAILS: '密码错误次数太多，请 15 分钟后再试',
  BAD_CREDENTIALS: '账号或密码不对',
  BAD_DEVICE: '设备标识异常，请刷新页面重试',
  CAPTCHA_REQUIRED: '请先完成算式验证',
  CAPTCHA_FAILED: '算式结果不对，请重新计算',
  SERVER_MISCONFIG: '服务未就绪，请联系管理员',
};

const DEVICE_RE = /^[A-Za-z0-9_-]{16,128}$/;

function deny(origin: string | null, reason: string): Response {
  return json(
    { ok: false, reason, message: REASON_MSG[reason] ?? '登录失败' },
    200,
    origin,
  );
}

async function logAuth(entry: {
  username?: string;
  device_hash?: string;
  ok: boolean;
  reason?: string;
}): Promise<void> {
  await pgInsert('auth_logs', {
    username: entry.username ?? null,
    device_hash: entry.device_hash ?? null,
    ok: entry.ok,
    reason: entry.reason ?? null,
  }).catch((e) => console.error('auth_logs insert failed:', e));
}

// 设备被拉黑时，把已经签发出去的会话立刻作废（防止 token 被继续使用）
async function revokeSession(accessToken: string): Promise<void> {
  try {
    await fetch(`${supaUrl()}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: anonKey(), Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    console.error('revoke session failed:', e);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflight(origin);
  if (req.method !== 'POST') return json({ ok: false, error: '只支持 POST' }, 405, origin);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, reason: 'BAD_REQUEST', message: '请求格式不对' }, 400, origin);
  }

  const u = normUsername(body.username);
  const password = typeof body.password === 'string' ? body.password : '';
  const deviceId = typeof body.device_id === 'string' ? body.device_id : '';
  const ua = typeof body.ua === 'string' ? body.ua.slice(0, 400) : '';

  if (!u.ok || !password) return deny(origin, 'NO_SUCH_USER');
  if (!DEVICE_RE.test(deviceId)) return deny(origin, 'BAD_DEVICE');

  // ---------- 0. 算术验证码（服务端判卷，挡脚本撞库）----------
  // 放在最前面：这一步不碰数据库，最便宜；答错直接打回，不进 login_guard。
  let secret: string;
  try {
    secret = requireCaptchaSecret();
  } catch (e) {
    console.error('captcha secret missing:', e);
    return deny(origin, 'SERVER_MISCONFIG');
  }

  const capToken = typeof body.captcha_token === 'string' ? body.captcha_token : '';
  const capAnswer = typeof body.captcha_answer === 'string' ? body.captcha_answer : '';

  if (!capToken || !capAnswer) {
    return json(
      { ok: false, reason: 'CAPTCHA_REQUIRED', message: REASON_MSG.CAPTCHA_REQUIRED },
      200,
      origin,
    );
  }

  const cap = await verifyCaptcha(secret, capToken, capAnswer);
  if (!cap.ok) {
    return json(
      { ok: false, reason: 'CAPTCHA_FAILED', message: cap.why || REASON_MSG.CAPTCHA_FAILED },
      200,
      origin,
    );
  }

  try {
    // ---------- 1. 登录守卫 ----------
    const rows = await pgRpc<GuardRow[]>('login_guard', {
      p_username: u.value,
      p_device_hash: deviceId,
    });
    const guard = Array.isArray(rows) ? rows[0] : (rows as unknown as GuardRow);

    if (!guard || !guard.allowed) {
      const reason = guard?.reason ?? 'NO_SUCH_USER';
      await logAuth({ username: u.value, device_hash: deviceId, ok: false, reason });
      return deny(origin, reason);
    }

    // ---------- 2. 校验密码（交给 GoTrue）----------
    const sign = await passwordSignIn(pseudoEmail(u.value), password);
    if (!sign.ok) {
      const reason = sign.status === 400 ? 'BAD_CREDENTIALS' : 'BAD_CREDENTIALS';
      await logAuth({ username: u.value, device_hash: deviceId, ok: false, reason });
      return deny(origin, reason);
    }

    // ---------- 3. 登记设备（不限数量，但黑名单直接拦）----------
    const touched = await pgRpc<string>('touch_device', {
      p_profile: guard.profile_id,
      p_device_hash: deviceId,
      p_ua: ua,
    });

    if (touched !== 'ok') {
      await revokeSession(sign.session.access_token);
      const reason =
        touched === 'BANNED' ? 'DEVICE_BANNED'
        : touched === 'DISABLED' ? 'DISABLED'
        : 'BAD_DEVICE';
      await logAuth({ username: u.value, device_hash: deviceId, ok: false, reason });
      return deny(origin, reason);
    }

    // ---------- 4. 成功 ----------
    await logAuth({ username: u.value, device_hash: deviceId, ok: true, reason: 'ok' });

    return json(
      {
        ok: true,
        session: {
          access_token: sign.session.access_token,
          refresh_token: sign.session.refresh_token,
          expires_in: sign.session.expires_in,
          token_type: sign.session.token_type ?? 'bearer',
        },
        profile: {
          username: u.value,
          role: guard.role,
          display_name: guard.display_name ?? u.value,
          status: 'active',
        },
      },
      200,
      origin,
    );
  } catch (e) {
    console.error('login unhandled:', e);
    return json(
      { ok: false, reason: 'SERVER_MISCONFIG', message: REASON_MSG.SERVER_MISCONFIG },
      200,
      origin,
    );
  }
});
