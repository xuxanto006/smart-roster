// =============================================================
// _shared/captcha.ts · 随机算术验证码（无状态 HMAC 方案）
//
// 设计要点：
//   ① 题目与答案都**不落库**，token 里只放「题面 + 过期时间 + 随机数 + 签名」
//   ② 答案永不下发给浏览器，判卷时由服务端从题面重新计算
//   ③ 签名用 HMAC-SHA256，密钥只在 Edge Function 的 CAPTCHA_SECRET 环境变量里
//   ④ 默认 180 秒过期；签发时可指定 ttl（登录页用 13 秒，缩短 token 可复用窗口）
//      签名覆盖 exp，改 exp 即失效
//
// 已知限制（有意为之）：
//   · 同一个 token 在有效期内可被复用多次（无状态方案无法标记已用）
//     → 真正的防滥用闸门是「邀请码」，验证码只挡脚本化批量提交
//   · 若要严格一次性，需要在库里加一张 nonce 表，P2 再考虑
// =============================================================

const TTL_DEFAULT_S = 180;
const TTL_MIN_S = 10;
const TTL_MAX_S = 300;
const enc = new TextEncoder();

export type CaptchaIssue = { token: string; question: string; expires_in: number };
export type CaptchaResult = { ok: boolean; why: string };

// 把外部传进来的 ttl 夹到 [10, 300] 秒，非法值回落到默认 180 秒
function normTtl(raw?: number | string | null): number {
  if (raw === undefined || raw === null || raw === '') return TTL_DEFAULT_S;
  const n = Number(raw);
  if (!Number.isFinite(n)) return TTL_DEFAULT_S;
  return Math.min(TTL_MAX_S, Math.max(TTL_MIN_S, Math.floor(n)));
}

// ---------- base64url ----------
function b64urlFromBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesFromB64url(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const raw = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function b64urlFromString(s: string): string {
  return b64urlFromBytes(enc.encode(s));
}

function stringFromB64url(s: string): string {
  return new TextDecoder().decode(bytesFromB64url(s));
}

// ---------- HMAC-SHA256 ----------
async function hmacB64url(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64urlFromBytes(new Uint8Array(sig));
}

// 恒定时间比较，避免计时侧信道
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomNonce(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return b64urlFromBytes(b);
}

// ---------- 出题 ----------
function makeQuestion(): { q: string; answer: number } {
  const a = 2 + Math.floor(Math.random() * 11); // 2..12
  const b = 2 + Math.floor(Math.random() * 11); // 2..12
  const useAdd = Math.random() < 0.5;
  if (useAdd) return { q: `${a} + ${b}`, answer: a + b };
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return { q: `${hi} - ${lo}`, answer: hi - lo };
}

// ---------- 签发 ----------
export async function issueCaptcha(
  secret: string,
  ttlSeconds?: number | string | null,
): Promise<CaptchaIssue> {
  const ttl = normTtl(ttlSeconds);
  const { q } = makeQuestion();
  const exp = Date.now() + ttl * 1000;
  const n = randomNonce();
  const sig = await hmacB64url(secret, `${q}|${exp}|${n}`);
  const token = b64urlFromString(JSON.stringify({ q, exp, n, sig }));
  return { token, question: `${q} = ?`, expires_in: ttl };
}

// ---------- 判卷 ----------
export async function verifyCaptcha(
  secret: string,
  token: string,
  input: string,
): Promise<CaptchaResult> {
  try {
    if (typeof token !== 'string' || token.length < 10 || token.length > 512) {
      return { ok: false, why: '验证无效，请刷新重试' };
    }

    const payload = JSON.parse(stringFromB64url(token)) as {
      q?: unknown;
      exp?: unknown;
      n?: unknown;
      sig?: unknown;
    };

    const q = typeof payload.q === 'string' ? payload.q : '';
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    const n = typeof payload.n === 'string' ? payload.n : '';
    const sig = typeof payload.sig === 'string' ? payload.sig : '';

    if (!q || !exp || !n || !sig) return { ok: false, why: '验证无效，请刷新重试' };
    if (Date.now() > exp) return { ok: false, why: '验证已过期，请重新计算' };

    const expect = await hmacB64url(secret, `${q}|${exp}|${n}`);
    if (!safeEqual(sig, expect)) return { ok: false, why: '验证无效，请刷新重试' };

    const m = /^(\d{1,2}) ([+\-]) (\d{1,2})$/.exec(q);
    if (!m) return { ok: false, why: '验证无效，请刷新重试' };

    const x = Number(m[1]);
    const op = m[2];
    const y = Number(m[3]);
    const answer = op === '+' ? x + y : x - y;

    const cleaned = String(input ?? '').trim();
    if (!/^-?\d{1,3}$/.test(cleaned)) return { ok: false, why: '请输入计算结果' };
    if (Number(cleaned) !== answer) return { ok: false, why: '计算结果不对，请重新计算' };

    return { ok: true, why: 'ok' };
  } catch {
    return { ok: false, why: '验证无效，请刷新重试' };
  }
}

// ---------- 取密钥（缺失即失败，绝不降级）----------
export function requireCaptchaSecret(): string {
  const s = Deno.env.get('CAPTCHA_SECRET');
  if (!s || s.length < 16) {
    throw new Error('CAPTCHA_SECRET 未配置或长度不足 16 位');
  }
  return s;
}
