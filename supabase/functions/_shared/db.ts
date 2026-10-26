// =============================================================
// _shared/db.ts · 极简 REST 客户端（PostgREST + GoTrue Admin）
//
// 为什么不用 supabase-js：
//   它需要从 esm.sh / npm 拉包，esbuild 打「单文件版」时会因无法解析远程模块而失败。
//   本项目只需要 6 个调用，手写 fetch 更稳、依赖为零、单文件打包无痛。
//
// 密钥来源（Supabase Edge Function 默认注入，无需手动设置）：
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（新项目可能是 SUPABASE_SECRET_KEY）
//   旧版 anon：SUPABASE_ANON_KEY（新项目可能是 SUPABASE_PUBLISHABLE_KEY）
// =============================================================

export function supaUrl(): string {
  const u = Deno.env.get('SUPABASE_URL') ?? '';
  if (!u) throw new Error('缺少 SUPABASE_URL 环境变量');
  return u.replace(/\/+$/, '');
}

export function serviceKey(): string {
  const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    ?? Deno.env.get('SUPABASE_SECRET_KEY')
    ?? '';
  if (!k) {
    throw new Error('缺少服务端密钥：请在 Edge Functions → Secrets 配置 SUPABASE_SERVICE_ROLE_KEY');
  }
  return k;
}

export function anonKey(): string {
  const k = Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    ?? '';
  if (!k) throw new Error('缺少公共密钥：SUPABASE_ANON_KEY');
  return k;
}

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const k = serviceKey();
  return {
    apikey: k,
    Authorization: `Bearer ${k}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function bodyOrThrow(r: Response, tag: string): Promise<string> {
  const text = await r.text();
  if (!r.ok) throw new Error(`${tag} ${r.status}: ${text.slice(0, 500)}`);
  return text;
}

// ---------- PostgREST：查 ----------
export async function pgSelect<T>(pathWithQuery: string): Promise<T[]> {
  const r = await fetch(`${supaUrl()}/rest/v1/${pathWithQuery}`, {
    headers: svcHeaders({ Accept: 'application/json' }),
  });
  const text = await bodyOrThrow(r, `select ${pathWithQuery}`);
  return text ? (JSON.parse(text) as T[]) : [];
}

// ---------- PostgREST：插 ----------
export async function pgInsert<T>(table: string, row: unknown): Promise<T | null> {
  const r = await fetch(`${supaUrl()}/rest/v1/${table}`, {
    method: 'POST',
    headers: svcHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  const text = await bodyOrThrow(r, `insert ${table}`);
  if (!text) return null;
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
}

// ---------- PostgREST：批量插（不返回行，避免几百行的响应） ----------
export async function pgInsertMany(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const r = await fetch(`${supaUrl()}/rest/v1/${table}`, {
    method: 'POST',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  await bodyOrThrow(r, `insert many ${table}`);
}

// ---------- PostgREST：改 ----------
export async function pgPatch(pathWithQuery: string, patch: unknown): Promise<void> {
  const r = await fetch(`${supaUrl()}/rest/v1/${pathWithQuery}`, {
    method: 'PATCH',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  await bodyOrThrow(r, `patch ${pathWithQuery}`);
}

// ---------- PostgREST：删 ----------
export async function pgDelete(pathWithQuery: string): Promise<void> {
  const r = await fetch(`${supaUrl()}/rest/v1/${pathWithQuery}`, {
    method: 'DELETE',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
  });
  await bodyOrThrow(r, `delete ${pathWithQuery}`);
}

// ---------- PostgREST：调函数 ----------
export async function pgRpc<T>(fn: string, args: unknown): Promise<T> {
  const r = await fetch(`${supaUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify(args),
  });
  const text = await bodyOrThrow(r, `rpc ${fn}`);
  return (text ? JSON.parse(text) : null) as T;
}

// ---------- GoTrue Admin：建号 / 删号 ----------
export async function adminCreateUser(
  email: string,
  password: string,
): Promise<{ id: string; email?: string }> {
  const r = await fetch(`${supaUrl()}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const text = await bodyOrThrow(r, 'createUser');
  return JSON.parse(text) as { id: string; email?: string };
}

export async function adminDeleteUser(id: string): Promise<void> {
  const r = await fetch(`${supaUrl()}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: svcHeaders(),
  });
  await bodyOrThrow(r, 'deleteUser');
}

// ---------- GoTrue Admin：封禁 / 解封 Auth 账号 ----------
// ban_duration 用 GoTrue 的时长格式："876000h" ≈ 100 年（即永久），"none" 解封。
// 这是离职封禁四道锁里的 ②：即使密码正确，GoTrue 也拒绝签发会话。
export async function adminSetBan(id: string, banDuration: string): Promise<void> {
  const r = await fetch(`${supaUrl()}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: svcHeaders(),
    body: JSON.stringify({ ban_duration: banDuration }),
  });
  await bodyOrThrow(r, 'banUser');
}

// ---------- GoTrue：密码登录（密码校验交给 GoTrue，我们从不碰哈希）----------
export type GotrueSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user?: { id: string; email?: string };
};

export type SignInResult =
  | { ok: true; session: GotrueSession }
  | { ok: false; status: number; code: string };

export async function passwordSignIn(email: string, password: string): Promise<SignInResult> {
  const k = anonKey();
  const r = await fetch(`${supaUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: k, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await r.text();

  if (r.ok) {
    return { ok: true, session: JSON.parse(text) as GotrueSession };
  }

  let code = 'UNKNOWN';
  try {
    const j = JSON.parse(text) as { error_code?: string; error?: string; msg?: string };
    code = j.error_code ?? j.error ?? j.msg ?? 'UNKNOWN';
  } catch {
    code = r.status === 400 ? 'invalid_grant' : 'UNKNOWN';
  }
  return { ok: false, status: r.status, code };
}
