// =============================================================
// _shared/validate.ts · 输入校验（前后端共用同一套规则）
// 与 001_init.sql 里的 profiles.username check 保持一致：
//   username = lower(username) and username ~ '^[a-z0-9_]{3,20}$'
// =============================================================

export const EMAIL_DOMAIN = 'staff.smart-roster.local';
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt 上限

export type V<T> = { ok: true; value: T } | { ok: false; error: string };

export function normUsername(raw: unknown): V<string> {
  if (typeof raw !== 'string') return { ok: false, error: '请输入账号名' };
  const s = raw.trim().toLowerCase();
  if (!s) return { ok: false, error: '请输入账号名' };
  if (s.length < 3) return { ok: false, error: '账号名至少 3 位' };
  if (s.length > 20) return { ok: false, error: '账号名最多 20 位' };
  if (!USERNAME_RE.test(s)) {
    return { ok: false, error: '账号名只能用英文字母、数字、下划线' };
  }
  return { ok: true, value: s };
}

export function checkPassword(raw: unknown): V<string> {
  if (typeof raw !== 'string' || !raw) return { ok: false, error: '请输入密码' };
  if (raw.length < PASSWORD_MIN) return { ok: false, error: `密码至少 ${PASSWORD_MIN} 位` };
  // bcrypt 只取前 72 字节，超长会被静默截断，必须显式拒绝
  if (new TextEncoder().encode(raw).length > PASSWORD_MAX) {
    return { ok: false, error: `密码不能超过 ${PASSWORD_MAX} 字节` };
  }
  return { ok: true, value: raw };
}

export function normInvite(raw: unknown): V<string> {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: '请输入邀请码' };
  const s = raw.trim().toUpperCase();
  if (s.length < 4 || s.length > 32) return { ok: false, error: '邀请码格式不对' };
  return { ok: true, value: s };
}

export function pseudoEmail(username: string): string {
  return `${username}@${EMAIL_DOMAIN}`;
}

export function cleanText(raw: unknown, max = 200): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}
