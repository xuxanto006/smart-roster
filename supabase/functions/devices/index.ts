// =============================================================
// devices/index.ts · 设备管理（排班经理专用）
//
// 请求：POST /functions/v1/devices
//   { token, action: "list" }
//   { token, action: "ban",    device_hash, reason? }
//   { token, action: "unban",  device_hash }
//   { token, action: "revoke", device_hash }   ← 只是踢下线，不拉黑
//
// 三个动作的区别（别搞混）：
//   revoke  吊销当前会话：这一行 devices.revoked_at 置为 now()，
//           但他下次登录时 touch_device 会把 revoked_at 清空 → 人还能回来
//   ban     拉黑 device_hash：写 device_bans + 吊销该 hash 的所有行，
//           登录守卫直接拒 → **永久**，只能这里手动 unban
//   unban   解封：device_bans.lifted_at 置为 now()，并清 devices.revoked_at
//
// 诚实提醒：device_hash 是浏览器 localStorage 里生成的 32 位随机串，
//   不是硬件指纹。清 localStorage / 换浏览器就能换一个新 hash。
//   它的价值是「封掉已确认的作案设备 + 事后审计」，不是防专业作弊。
// =============================================================

import { json, preflight } from '../_shared/cors.ts';
import { pgPatch, pgRpc, pgSelect } from '../_shared/db.ts';
import { requireManager, type Caller } from '../_shared/auth.ts';
import { cleanText } from '../_shared/validate.ts';

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
  banned_by: string | null;
};

type MiniProfile = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
  staff_name: string | null;
};

const HASH_RE = /^[A-Za-z0-9_-]{16,128}$/;

function fail(origin: string | null, code: string, error: string, status = 200): Response {
  return json({ ok: false, code, error }, status, origin);
}

function readHash(body: Record<string, unknown>): string {
  return typeof body.device_hash === 'string' ? body.device_hash.trim() : '';
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
      const devices = await pgSelect<DeviceRow>(
        'devices?select=id,profile_id,device_hash,ua,first_seen,last_seen,revoked_at' +
          '&order=last_seen.desc&limit=500',
      );
      const bans = await pgSelect<BanRow>(
        'device_bans?select=device_hash,reason,banned_at,lifted_at,banned_by' +
          '&order=banned_at.desc&limit=500',
      );

      const ids = [...new Set(devices.map((d) => d.profile_id).filter(Boolean))];
      let owners: MiniProfile[] = [];
      if (ids.length > 0) {
        owners = await pgSelect<MiniProfile>(
          `profiles?id=in.(${ids.map((i) => encodeURIComponent(i)).join(',')})` +
            '&select=id,username,display_name,role,status,staff_name',
        );
      }
      const ownerById = new Map(owners.map((o) => [o.id, o]));

      const liveBans = bans.filter((b) => !b.lifted_at);
      const liveSet = new Set(liveBans.map((b) => b.device_hash));

      // 黑名单里的设备可能是「换过账号」的：从 devices 里找最后见过它的人
      const hashToProfile = new Map<string, MiniProfile>();
      for (const d of devices) {
        const o = ownerById.get(d.profile_id);
        if (o) hashToProfile.set(d.device_hash, o);
      }

      const withOwner = devices.map((d) => {
        const o = ownerById.get(d.profile_id);
        return {
          ...d,
          username: o?.username ?? null,
          display_name: o?.display_name ?? null,
          account_status: o?.status ?? null,
          staff_name: o?.staff_name ?? null,
          banned: liveSet.has(d.device_hash),
        };
      });

      return json(
        {
          ok: true,
          me: { username: me.username, role: me.role },
          stats: {
            devices: withOwner.length,
            live: withOwner.filter((d) => !d.revoked_at).length,
            banned_live: liveBans.length,
            bans_lifted: bans.length - liveBans.length,
          },
          devices: withOwner,
          bans: bans.map((b) => {
            const o = hashToProfile.get(b.device_hash);
            return {
              ...b,
              active: !b.lifted_at,
              username: o?.username ?? null,
              display_name: o?.display_name ?? null,
            };
          }),
        },
        200,
        origin,
      );
    }

    // ---------------- 拉黑 ----------------
    if (action === 'ban') {
      const hash = readHash(body);
      if (!HASH_RE.test(hash)) {
        return fail(origin, 'BAD_HASH', '设备标识格式不对（应为 16~128 位字母数字）');
      }
      const reason = cleanText(body.reason, 100) || '管理员手动拉黑';
      // RPC 内部：写 device_bans + 吊销该 hash 的所有会话 + 写审计
      await pgRpc('ban_device', { p_device_hash: hash, p_actor: me.id, p_reason: reason });
      return json(
        { ok: true, device_hash: hash, banned: true, reason },
        200,
        origin,
      );
    }

    // ---------------- 解封 ----------------
    if (action === 'unban') {
      const hash = readHash(body);
      if (!HASH_RE.test(hash)) {
        return fail(origin, 'BAD_HASH', '设备标识格式不对（应为 16~128 位字母数字）');
      }
      const lifted = await pgRpc<boolean>('unban_device', { p_device_hash: hash, p_actor: me.id });
      return json(
        {
          ok: true,
          device_hash: hash,
          lifted: lifted !== false,
          note: lifted === false ? '这个设备本来就不在黑名单里（只清掉了会话吊销）' : '已解封，他可以再次登录',
        },
        200,
        origin,
      );
    }

    // ---------------- 踢下线（不拉黑） ----------------
    if (action === 'revoke') {
      const hash = readHash(body);
      if (!HASH_RE.test(hash)) {
        return fail(origin, 'BAD_HASH', '设备标识格式不对（应为 16~128 位字母数字）');
      }
      const rows = await pgSelect<DeviceRow>(
        `devices?device_hash=eq.${encodeURIComponent(hash)}&select=id,profile_id,device_hash,revoked_at`,
      );
      if (rows.length === 0) return fail(origin, 'NOT_FOUND', '没有这个设备的记录');

      await pgPatch(`devices?device_hash=eq.${encodeURIComponent(hash)}`, {
        revoked_at: new Date().toISOString(),
        revoked_by: me.id,
      });

      const out = {
        ok: true,
        device_hash: hash,
        revoked: rows.filter((r) => !r.revoked_at).length,
        note: '已吊销当前会话；他不是黑名单设备，下次登录仍可回来',
      };
      return json(out, 200, origin);
    }

    return fail(origin, 'BAD_ACTION', `不支持的操作：${action}`);
  } catch (e) {
    console.error('devices unhandled:', e);
    return fail(origin, 'INTERNAL', '服务器开小差了，请稍后再试', 500);
  }
});
