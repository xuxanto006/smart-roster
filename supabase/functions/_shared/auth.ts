// =============================================================
// _shared/auth.ts · 管理端函数的「调用者身份校验」
//
// 为什么 token 走 body 而不是 Authorization 头：
//   前端刻意只发「简单请求」（不带自定义头、Content-Type: text/plain）来避开
//   CORS 预检，这样即使预检链路出问题页面也不会挂。管理端函数因此从
//   body.token 里取 access_token，再用 GoTrue /auth/v1/user 校验它。
//   HTTPS + 不落日志的前提下，这与放 Authorization 头等价安全。
//
// 职责边界：
//   · 只认 Supabase Auth 签发的 access_token，本地不解析 JWT payload
//   · 校验通过后必须回查 profiles：status 必须 active，否则视为无权限
//   · 管理端函数只允许 role = manager
// =============================================================

import { anonKey, pgInsert, pgSelect, serviceKey, supaUrl } from './db.ts';

export type Role = 'manager' | 'viewer' | 'employee';

export type Caller = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  status: string;
  staff_name: string | null;
};

export type AuthOk = { ok: true; caller: Caller };
export type AuthErr = { ok: false; code: string; error: string; status: number };
export type AuthResult = AuthOk | AuthErr;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// apikey 只用于标识项目；身份由 Authorization 里的用户 token 决定。
// 优先 anon（若项目只配了 publishable key 就用它），取不到再退化到 service key。
function projectKey(): string {
  try {
    return anonKey();
  } catch {
    return serviceKey();
  }
}

function err(code: string, error: string, status = 200): AuthErr {
  return { ok: false, code, error, status };
}

/**
 * 校验 access_token → 返回调用者资料（含 role/status）。
 * 所有失败都返回 code，调用方统一转成 { ok:false, code, error }。
 */
export async function whoami(token: string): Promise<AuthResult> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 8000) {
    return err('NO_TOKEN', '缺少登录凭证，请重新登录');
  }

  let userId = '';
  try {
    const r = await fetch(`${supaUrl()}/auth/v1/user`, {
      headers: { apikey: projectKey(), Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return err('BAD_TOKEN', '登录状态已失效，请重新登录');
    const u = (await r.json()) as { id?: string };
    userId = String(u?.id ?? '');
  } catch (e) {
    console.error('whoami goTrue failed:', e);
    return err('SERVER_MISCONFIG', '身份校验服务暂时不可用，请稍后再试');
  }

  if (!UUID_RE.test(userId)) return err('BAD_TOKEN', '登录状态已失效，请重新登录');

  try {
    const rows = await pgSelect<Caller>(
      `profiles?id=eq.${encodeURIComponent(userId)}` +
        `&select=id,username,display_name,role,status,staff_name&limit=1`,
    );
    const p = rows[0];
    if (!p) return err('NO_PROFILE', '账号资料缺失，请联系管理员');
    if (p.status === 'pending') return err('PENDING_APPROVAL', '账号还在等审核，通过后才能使用');
    if (p.status === 'rejected') return err('REJECTED', '注册申请未通过');
    if (p.status !== 'active') return err('DISABLED', '账号已停用，请联系管理员');
    return { ok: true, caller: p };
  } catch (e) {
    console.error('whoami profile lookup failed:', e);
    return err('SERVER_MISCONFIG', '服务未就绪，请联系管理员');
  }
}

/** 管理端专用：必须是 active 的 manager。 */
export async function requireManager(token: string): Promise<AuthResult> {
  const r = await whoami(token);
  if (!r.ok) return r;
  if (r.caller.role !== 'manager') {
    return err('FORBIDDEN', '只有排班经理可以执行这个操作', 403);
  }
  return r;
}

/** 写一条审计日志（失败只打日志，绝不影响主流程）。 */
export async function audit(
  caller: Caller | null,
  action: string,
  target: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await pgInsert('audit_logs', {
      actor_id: caller?.id ?? null,
      actor_name: caller?.username ?? null,
      action,
      target,
      detail,
    });
  } catch (e) {
    console.error('audit insert failed:', e);
  }
}
