// =============================================================
// ack/index.ts · 员工端「已知晓」回执（标记某一版班表已读）
//
// 请求：POST /functions/v1/ack
//   { token, publish_id: "uuid" }
//
// 为什么必须走服务端（不能让员工直接写 publish_deliveries）：
//   RLS 里 publish_deliveries 的写权限只给了 is_editor()（经理），员工一条都改不了。
//   如果想放开，就得给员工 UPDATE 权限 + 列级授权，还得自己防「顺手把 status 改成
//   sent」「把别人的行改掉」。放在服务端做，只有一件事：把「我自己那条 inapp 投递」
//   从 pending 改成 seen，并记 seen_at，其余字段一律不碰。
//
// 幂等：
//   已经是 seen 的直接原样返回（只读不写），重复点按钮不会刷新时间、
//   也不会产生多余的审计记录。
// =============================================================

import { json, preflight } from '../_shared/cors.ts';
import { pgPatch, pgSelect } from '../_shared/db.ts';
import { audit, UUID_RE, whoami } from '../_shared/auth.ts';

type DeliveryRow = {
  id: number;
  status: string;
  seen_at: string | null;
};

function fail(origin: string | null, code: string, error: string, status = 200): Response {
  return json({ ok: false, code, error }, status, origin);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflight(origin);
  if (req.method !== 'POST') {
    return json({ ok: false, code: 'BAD_METHOD', error: '只支持 POST' }, 405, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: 'BAD_JSON', error: '请求格式不对' }, 400, origin);
  }

  // ---------- 身份：必须是 active 账号，且绑定了员工档案 ----------
  const auth = await whoami(String(body.token ?? ''));
  if (!auth.ok) return fail(origin, auth.code, auth.error, auth.status);
  const me = auth.caller;

  const staffName = String(me.staff_name ?? '').trim();
  if (!staffName) {
    return fail(origin, 'NO_STAFF', '这个账号还没绑定员工档案，暂时不能确认班表');
  }

  const publishId = String(body.publish_id ?? '').trim().toLowerCase();
  if (!UUID_RE.test(publishId)) {
    return fail(origin, 'BAD_PUBLISH', '班表版本参数不对，请刷新页面重试');
  }

  try {
    // ---------- 只认「发给我的那条 inapp 投递」 ----------
    const rows = await pgSelect<DeliveryRow>(
      `publish_deliveries?publish_id=eq.${publishId}` +
        `&staff_name=eq.${encodeURIComponent(staffName)}` +
        `&channel=eq.inapp&select=id,status,seen_at&limit=1`,
    );
    const row = rows[0];
    if (!row) {
      return fail(origin, 'NOT_DELIVERED', '这一版班表没有发给你，确认不了');
    }

    // ---------- 已经确认过：幂等返回，不覆盖时间 ----------
    if (row.status === 'seen') {
      return json(
        { ok: true, already: true, publish_id: publishId, seen_at: row.seen_at },
        200,
        origin,
      );
    }

    const seenAt = new Date().toISOString();
    await pgPatch(`publish_deliveries?id=eq.${row.id}`, {
      status: 'seen',
      seen_at: seenAt,
    });

    await audit(me, 'ack', publishId, {
      publish_id: publishId,
      staff_name: staffName,
    });

    return json({ ok: true, already: false, publish_id: publishId, seen_at: seenAt }, 200, origin);
  } catch (e) {
    console.error('ack failed:', e);
    return fail(origin, 'ACK_FAILED', '确认没记上，请稍后再试', 500);
  }
});
