// =============================================================
// tools/test_captcha.mjs · 对 _shared/captcha.ts 做真实往返测试
// 用法：
//   npx esbuild ../supabase/functions/_shared/captcha.ts --format=esm --outfile=_build/captcha.mjs
//   node test_captcha.mjs
// 依赖：Node 22（自带 Web Crypto / btoa / atob / TextEncoder）
// =============================================================

// 造一个 Deno.env 桩，让共享模块能在 Node 下跑
process.env.CAPTCHA_SECRET = 'test-secret-0123456789abcdef';
globalThis.Deno = {
  env: { get: (k) => process.env[k] },
};

const { issueCaptcha, verifyCaptcha, requireCaptchaSecret } = await import('./_build/captcha.mjs');

const enc = new TextEncoder();
function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}
function b64urlStr(s) {
  return b64url(enc.encode(s));
}

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ' → ' + extra : ''}`);
  }
}

const secret = requireCaptchaSecret();
console.log(`\n密钥长度: ${secret.length}\n`);
let t;

// ---------- 1. 正常路径 ----------
t = await issueCaptcha(secret);
check('签发返回 token', typeof t.token === 'string' && t.token.length > 20);
check('签发返回题面', /^\d{1,2} [+\-] \d{1,2} = \?$/.test(t.question), t.question);
check('TTL 为 180 秒', t.expires_in === 180);
check('token 里不含答案字段', !/answer/i.test(Buffer.from(t.token, 'base64').toString('latin1')));

// ---------- 1b. 可指定有效期（登录页 13 秒） ----------
{
  const t13 = await issueCaptcha(secret, 13);
  check('ttl=13 生效', t13.expires_in === 13, String(t13.expires_in));
  const m13 = /^(\d+) ([+\-]) (\d+) = \?$/.exec(t13.question);
  const a13 = m13[2] === '+' ? Number(m13[1]) + Number(m13[3]) : Number(m13[1]) - Number(m13[3]);
  const r13 = await verifyCaptcha(secret, t13.token, String(a13));
  check('13 秒 token 立即判卷通过', r13.ok === true, r13.why);

  const tLow = await issueCaptcha(secret, 1);
  check('ttl 过低夹到 10 秒', tLow.expires_in === 10, String(tLow.expires_in));
  const tHigh = await issueCaptcha(secret, 9999);
  check('ttl 过高夹到 300 秒', tHigh.expires_in === 300, String(tHigh.expires_in));
  const tBad = await issueCaptcha(secret, 'abc');
  check('非法 ttl 回落 180 秒', tBad.expires_in === 180, String(tBad.expires_in));
}

{
  const m = /^(\d+) ([+\-]) (\d+) = \?$/.exec(t.question);
  const answer = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
  const r = await verifyCaptcha(secret, t.token, String(answer));
  check('答对通过', r.ok === true, r.why);

  const r2 = await verifyCaptcha(secret, t.token, String(answer + 1));
  check('答错被拒', r2.ok === false && /计算结果不对/.test(r2.why), r2.why);

  const r3 = await verifyCaptcha(secret, t.token, '');
  check('空答案被拒', r3.ok === false);

  const r4 = await verifyCaptcha(secret, t.token, 'abc');
  check('非数字被拒', r4.ok === false);

  // 已知限制：3 分钟内可复用
  const r5 = await verifyCaptcha(secret, t.token, String(answer));
  check('（已知限制）同 token 可再次通过', r5.ok === true);
}

// ---------- 2. 篡改 token ----------
{
  const bad = t.token.slice(0, -3) + (t.token.slice(-3) === 'AAA' ? 'BBB' : 'AAA');
  const r = await verifyCaptcha(secret, bad, '3');
  check('签名被篡改 → 拒绝', r.ok === false, r.why);
}
{
  const r = await verifyCaptcha(secret, 'not-a-token', '3');
  check('垃圾 token → 拒绝', r.ok === false, r.why);
}
{
  const r = await verifyCaptcha(secret, '', '3');
  check('空 token → 拒绝', r.ok === false);
}

// ---------- 3. 换密钥（模拟别人伪造）----------
{
  const other = await issueCaptcha('another-secret-that-is-long-enough');
  const m = /^(\d+) ([+\-]) (\d+) = \?$/.exec(other.question);
  const answer = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
  const r = await verifyCaptcha(secret, other.token, String(answer));
  check('别的密钥签的 token → 拒绝', r.ok === false, r.why);
}

// ---------- 4. 过期 ----------
{
  const q = '5 + 6';
  const exp = Date.now() - 1000; // 已过期
  const n = 'abcdefgh';
  const sig = await hmac(secret, `${q}|${exp}|${n}`);
  const token = b64urlStr(JSON.stringify({ q, exp, n, sig }));
  const r = await verifyCaptcha(secret, token, '11');
  check('过期 token → 拒绝', r.ok === false && /过期/.test(r.why), r.why);
}

// ---------- 5. 篡改 exp 延长有效期 ----------
{
  const q = '5 + 6';
  const expOld = Date.now() + 1000;
  const n = 'abcdefgh';
  const sig = await hmac(secret, `${q}|${expOld}|${n}`);
  const forgedExp = Date.now() + 3600_000;
  const token = b64urlStr(JSON.stringify({ q, exp: forgedExp, n, sig }));
  const r = await verifyCaptcha(secret, token, '11');
  check('改 exp 想续期 → 拒绝', r.ok === false, r.why);
}

console.log(`\n结果: 通过 ${pass} / 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
