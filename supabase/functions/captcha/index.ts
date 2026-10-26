// =============================================================
// captcha/index.ts · 签发算术验证码
// 请求：GET /functions/v1/captcha?ttl=13   或 POST { ttl?: number }
// 响应：{ token, question, expires_in }
//
// ttl：可选，有效期秒数，服务端夹到 [10, 300]，缺省 180。
//      登录页用 13 秒（题面就在眼前，短窗口也够用，还能把 token 可复用时间压到最低）；
//      注册页仍用默认 180 秒（要填账号密码确认密码，13 秒不现实）。
// 注意：这是唯一一个**允许匿名调用**的函数（注册前就要拿到题）
// =============================================================

import { issueCaptcha, requireCaptchaSecret } from '../_shared/captcha.ts';
import { json, preflight } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return preflight(origin);
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ ok: false, error: '只支持 GET / POST' }, 405, origin);
  }

  try {
    // GET 从查询串取，POST 从 body 取；都没给就用默认 180 秒
    let ttl: unknown = new URL(req.url).searchParams.get('ttl');
    if ((ttl === null || ttl === '') && req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as { ttl?: unknown };
      ttl = body.ttl;
    }

    const secret = requireCaptchaSecret();
    const out = await issueCaptcha(secret, ttl as number | string | null);
    return json({ ok: true, ...out }, 200, origin);
  } catch (e) {
    // 配置缺失属于部署事故，明确报出来，方便一眼定位
    console.error('captcha issue failed:', e);
    return json({ ok: false, error: '验证码服务未就绪，请联系管理员' }, 500, origin);
  }
});
