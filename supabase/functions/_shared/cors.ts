// =============================================================
// _shared/cors.ts · 统一 CORS 头
// 说明：本项目不用 Cookie 认证（token 走 Authorization 头），所以允许 * 是安全的；
//      若以后要开 Cookie，必须改成白名单 + Access-Control-Allow-Credentials。
//        ALLOWED_ORIGINS 环境变量：逗号分隔，例如
//        https://smart-roster.xuxanto.workers.dev,http://localhost:8080
// =============================================================

const ENV_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowAll = ENV_ORIGINS.includes('*');
  const ok = allowAll || (origin !== null && ENV_ORIGINS.includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? (allowAll ? '*' : String(origin)) : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

// 注意：HTTP 204 不允许携带 body，`new Response('ok', { status: 204 })`
// 会让 Deno 在构造 Response 时直接抛 TypeError → 整个预检返回 500，
// 浏览器随即拦截所有跨域请求。这里必须用 null body。
export function preflight(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
