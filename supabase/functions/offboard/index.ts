// =============================================================
// offboard/index.ts · 离职停用 / 重新启用（排班经理专用）
//
// 请求：POST /functions/v1/offboard
//   { token, action: "list" }
//   { token, action: "offboard",   id?, username?, reason? }
//   { token, action: "reactivate", id?, username?, lift_devices? }
//
// 「离职」= 四道锁，缺一不可：
//   ① status=disabled  → RLS 里 is_active_user() 秒级失效（数据库层）
//   ② GoTrue ban        → 密码正确也签发不出新会话（Auth 层）
//   ③ 吊销全部设备 + 拉黑 device_hash → 旧设备换号登录也进不来
//   ④ audit_logs 留痕  → 谁在什么时候停用了谁
// 其中 ①③④ 由 RPC offboard_profile 在一个事务里做完，② 由本函数调 Admin API 补上。
//
// 反方向「启用」= ② 解封 Auth + ① status 回 active；设备默认仍然封着
//   （这是刻意的：设备封禁永久、只管理员手动解封，需要时传 lift_devices:true）
// =============================================================

import { json, preflight } from '../_shared/cors.ts';
import { adminSetBan, pgRpc, pgSelect } from '../_shared/db.ts';
import { audit, type Caller, requireManager, UUID_RE } from '../_shared/auth.ts';
import { cleanText } from '../_shared/validate.ts';

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
  staff_name: string | null;
  last_login_at?: string | null;
  disabled_at?: string | null;
  disabled_reason?: string | null;
  created_at?: string;
};

type DeviceRow = {
  id: number;
  profile_id: string;
  device_hash: string;
  ua: string | null;
  first_seen: string;
  last_seen: string;
  revoked_at: string | null;
};

type BanRow = {
  device_hash: string;
  reason: string | null;
  banned_at: string;
  lifted_at: string | null;
};

const BAN_FOREVER = '876000h'; // GoTrue 时长格式，≈100 年 = 永久
const SELECT_COLS =
  'id,username,display_name,role,status,staff_name,last_login_at,disabled_at,disabled_reason,created_at';

function fail(origin: string | null, code: string, error: string, status = 200): Response {
  return json({ ok: false, code, error }, status, origin);
}

async function resolveProfile(body: Record<string, unknown>): Promise<
  { ok: true; row: ProfileRow } | { ok: false; code: string; error: string }
> {
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';

  if (id) {
    if (!UUID_RE.test(id)) return { ok: false, code: 'BAD_ID', error: '账号 id 格式不对' };
    const rows = await pgSelect<ProfileRow>(
      `profiles?id=eq.${encodeURIComponent(id)}&select=${SELECT_COLS}&limit=1`,
    );
    if (!rows[0]) return { ok: false, code: 'NOT_FOUND', error: '找不到这个账号' };
    return { ok: true, row: rows[0] };
  }
  if (username) {
    const rows = await pgSelect<ProfileRow>(
      `profiles?username=eq.${encodeURIComponent(username)}&select=${SELECT_COLS}&limit=1`,
    );
    if (!rows[0]) return { ok: false, code: 'NOT_FOUND', error: '找不到这个账号' };
    return { ok: true, row: rows[0] };
  }
  return { ok: false, code: 'BAD_ID', error: '请提供账号 id 或 username' };
}

async function activeManagerCount(): Promise<number> {
  const rows = await pgSelect<{ id: string }>(
    `profiles?role=eq.manager&status=eq.active&select=id&limit=100`,
  );
  return rows.length;
}

async function devicesOf(profileId: string): Promise<DeviceRow[]> {
  return await pgSelect<DeviceRow>(
    `devices?profile_id=eq.${encodeURIComponent(profileId)}` +
      '&select=id,profile_id,device_hash,ua,first_seen,last_seen,revoked_at&order=last_seen.desc&limit=200',
  );
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

  const auth = await requireManager(String(body.token ?? ''));
  if (!auth.ok) return fail(origin, auth.code, auth.error, auth.status);
  const me: Caller = auth.caller;
  const action = String(body.action ?? 'list');

  try {
    // ---------------- 列表 ----------------
    if (action === 'list') {
      const accounts = await pgSelect<ProfileRow>(
        `profiles?select=${SELECT_COLS}&order=created_at.asc`,
      );
      const devices = await pgSelect<DeviceRow>(
        'devices?select=id,profile_id,device_hash,ua,first_seen,last_seen,revoked_at' +
          '&order=last_seen.desc&limit=1000',
      );
      const bans = await pgSelect<BanRow>(
        'device_bans?select=device_hash,reason,banned_at,lifted_at&order=banned_at.desc&limit=1000',
      );

      const bannedLive = new Set(bans.filter((b) => !b.lifted_at).map((b) => b.device_hash));
      const devMap = new Map<string, { total: number; live: number; last_seen: string | null; banned: number }>();
      for (const d of devices) {
        const cur = devMap.get(d.profile_id) ?? { total: 0, live: 0, last_seen: null, banned: 0 };
        cur.total += 1;
        if (!d.revoked_at) cur.live += 1;
        if (bannedLive.has(d.device_hash)) cur.banned += 1;
        if (!cur.last_seen || d.last_seen > cur.last_seen) cur.last_seen = d.last_seen;
        devMap.set(d.profile_id, cur);
      }

      const counts = { active: 0, disabled: 0, pending: 0, rejected: 0 };
      for (const a of accounts) {
        if (a.status in counts) counts[a.status as keyof typeof counts] += 1;
      }

      return json(
        {
          ok: true,
          me: { username: me.username, role: me.role },
          counts,
          banned_devices: bannedLive.size,
          accounts: accounts.map((a) => {
            const d = devMap.get(a.id);
            return {
              ...a,
              device_total: d?.total ?? 0,
              device_live: d?.live ?? 0,
              device_banned: d?.banned ?? 0,
              last_seen: d?.last_seen ?? null,
              is_self: a.id === me.id,
            };
          }),
        },
        200,
        origin,
      );
    }

    // ---------------- 停用（离职封禁） ----------------
    if (action === 'offboard') {
      const r = await resolveProfile(body);
      if (!r.ok) return fail(origin, r.code, r.error);
      const target = r.row;

      if (target.id === me.id) {
        return fail(origin, 'FORBIDDEN', '不能停用你自己的账号（会把自己锁在门外）', 403);
      }
      if (target.status === 'pending' || target.status === 'rejected') {
        return fail(origin, 'BAD_STATUS', '这个账号还没通过审核，请到审核页处理');
      }
      if (target.status === 'disabled') {
        return json(
          {
            ok: true,
            already: true,
            id: target.id,
            username: target.username,
            status: 'disabled',
            disabled_at: target.disabled_at ?? null,
            disabled_reason: target.disabled_reason ?? null,
          },
          200,
          origin,
        );
      }
      if (target.role === 'manager' && (await activeManagerCount()) <= 1) {
        return fail(origin, 'LAST_MANAGER', '这是最后一个在用的排班经理，停用后就没人能管理了', 403);
      }

      const reason = cleanText(body.reason, 100) || '离职封禁';

      // ①③④ 在一个事务里完成：停用 + 吊销设备 + 拉黑设备 + 审计
      const bannedCount = await pgRpc<number>('offboard_profile', {
        p_profile: target.id,
        p_actor: me.id,
        p_reason: reason,
      });

      // ② Auth 层封禁：即使密码正确也签发不出新会话
      let authBanned = true;
      let warning: string | null = null;
      try {
        await adminSetBan(target.id, BAN_FOREVER);
      } catch (e) {
        authBanned = false;
        warning = '数据库层已停用（RLS 已失效），但 Auth 封禁失败，请重试或到 Supabase 后台手动 Ban 该用户';
        console.error('offboard adminSetBan failed:', e);
      }

      return json(
        {
          ok: true,
          id: target.id,
          username: target.username,
          display_name: target.display_name,
          status: 'disabled',
          devices_banned: Number(bannedCount ?? 0),
          auth_banned: authBanned,
          reason,
          warning,
        },
        200,
        origin,
      );
    }

    // ---------------- 重新启用 ----------------
    if (action === 'reactivate') {
      const r = await resolveProfile(body);
      if (!r.ok) return fail(origin, r.code, r.error);
      const target = r.row;

      if (target.status === 'active') {
        return json(
          { ok: true, already: true, id: target.id, username: target.username, status: 'active' },
          200,
          origin,
        );
      }
      if (target.status !== 'disabled') {
        return fail(origin, 'BAD_STATUS', '只有已停用的账号可以重新启用；待审核/已拒绝请走审核页');
      }

      // ① status 回 active（并写审计）
      await pgRpc('reactivate_profile', { p_profile: target.id, p_actor: me.id });

      // ② 解封 Auth（ban_duration: none）
      let authUnbanned = true;
      let warning: string | null = null;
      try {
        await adminSetBan(target.id, 'none');
      } catch (e) {
        authUnbanned = false;
        warning = '数据库层已恢复，但 Auth 解封失败，该用户可能仍无法登录，请重试';
        console.error('reactivate adminSetBan none failed:', e);
      }

      // ③ 可选：连设备一起解封（默认不解，设备封禁是永久的）
      let lifted = 0;
      if (body.lift_devices === true) {
        const devs = await devicesOf(target.id);
        const hashes = [...new Set(devs.map((d) => d.device_hash))];
        for (const hash of hashes) {
          try {
            const did = await pgRpc<boolean>('unban_device', { p_device_hash: hash, p_actor: me.id });
            if (did !== false) lifted += 1;
          } catch (e) {
            console.error('lift device failed:', hash.slice(0, 12), e);
          }
        }
      }

      return json(
        {
          ok: true,
          id: target.id,
          username: target.username,
          status: 'active',
          auth_unbanned: authUnbanned,
          devices_lifted: lifted,
          devices_still_banned: body.lift_devices === true ? 0 : null,
          warning,
        },
        200,
        origin,
      );
    }

    return fail(origin, 'BAD_ACTION', `不支持的操作：${action}`);
  } catch (e) {
    console.error('offboard unhandled:', e);
    return fail(origin, 'INTERNAL', '服务器开小差了，请稍后再试', 500);
  }
});
