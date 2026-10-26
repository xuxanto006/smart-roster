// =============================================================
// review/index.ts · 注册审核（排班经理专用）
//
// 请求：POST /functions/v1/review
//   { token, action: "list" }
//   { token, action: "approve", id, staff_name?, role?, display_name? }
//   { token, action: "reject",  id, reason? }
//   { token, action: "purge",   id }          ← 彻底删除（含 Auth 账号，释放账号名）
//
// 返回：统一 { ok:true, ... } / { ok:false, code, error }（业务失败也用 HTTP 200）
//
// 为什么要它：没有它，每次审核都要去 SQL Editor 手敲 update，既慢又容易手滑。
//
// 审核要点：
//   · employee 必须绑定 staff.name（否则员工查不到自己的班表）
//   · staff_name 有唯一索引，一个员工只能挂一个账号
//   · purge 先删 Auth 用户，靠 auth.users → profiles 的级联把资料一起带走
// =============================================================

import { json, preflight } from '../_shared/cors.ts';
import { adminDeleteUser, pgDelete, pgPatch, pgSelect } from '../_shared/db.ts';
import { audit, type Caller, requireManager, UUID_RE } from '../_shared/auth.ts';
import { cleanText } from '../_shared/validate.ts';

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
  staff_name: string | null;
  apply_note?: string | null;
  created_at?: string;
};

type StaffRow = {
  name: string;
  module: string;
  position: string;
  domain: string;
};

type ClaimRow = { staff_name: string; username: string; id: string };

const ROLES = ['employee', 'viewer', 'manager'];
const ROLE_MSG = '角色只能是 employee（员工）/ viewer（只读）/ manager（排班经理）';

function fail(origin: string | null, code: string, error: string, status = 200): Response {
  return json({ ok: false, code, error }, status, origin);
}

async function loadTarget(id: string): Promise<ProfileRow | null> {
  const rows = await pgSelect<ProfileRow>(
    `profiles?id=eq.${encodeURIComponent(id)}` +
      `&select=id,username,display_name,role,status,staff_name,apply_note,created_at&limit=1`,
  );
  return rows[0] ?? null;
}

/** 检查员工名是否存在、是否已被别的账号占用 */
async function checkStaff(name: string, selfId: string): Promise<{ ok: true } | { ok: false; code: string; error: string }> {
  const staff = await pgSelect<{ name: string }>(
    `staff?name=eq.${encodeURIComponent(name)}&select=name&limit=1`,
  );
  if (staff.length === 0) {
    return { ok: false, code: 'STAFF_NOT_FOUND', error: '员工名单里没有这个姓名，请从下拉列表选择' };
  }
  const claimed = await pgSelect<ClaimRow>(
    `profiles?staff_name=eq.${encodeURIComponent(name)}&select=id,username,staff_name&limit=5`,
  );
  const other = claimed.find((c) => c.id !== selfId);
  if (other) {
    return { ok: false, code: 'STAFF_TAKEN', error: `这个员工已经绑定了账号 ${other.username}` };
  }
  return { ok: true };
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
      const pending = await pgSelect<ProfileRow>(
        'profiles?status=eq.pending' +
          '&select=id,username,display_name,role,staff_name,apply_note,created_at' +
          '&order=created_at.asc',
      );
      const statusRows = await pgSelect<{ status: string }>('profiles?select=status');
      const staff = await pgSelect<StaffRow>(
        'staff?active=eq.true&select=name,module,position,domain&order=name.asc',
      );
      const claims = await pgSelect<ClaimRow>(
        'profiles?staff_name=not.is.null&select=id,username,staff_name',
      );

      const claimMap = new Map<string, string>();
      for (const c of claims) if (c.staff_name) claimMap.set(c.staff_name, c.username);

      const counts = { pending: 0, active: 0, disabled: 0, rejected: 0 };
      for (const r of statusRows) {
        if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
      }

      return json(
        {
          ok: true,
          me: { username: me.username, role: me.role },
          counts,
          pending: pending.map((p) => ({
            ...p,
            staff_taken_by: p.staff_name ? claimMap.get(p.staff_name) ?? null : null,
          })),
          staff: staff.map((s) => ({
            ...s,
            taken_by: claimMap.get(s.name) ?? null,
          })),
        },
        200,
        origin,
      );
    }

    // ---------------- 通过 ----------------
    if (action === 'approve') {
      const id = String(body.id ?? '');
      if (!UUID_RE.test(id)) return fail(origin, 'BAD_ID', '参数不对：缺少账号 id');

      const target = await loadTarget(id);
      if (!target) return fail(origin, 'NOT_FOUND', '找不到这个申请，可能已被处理');
      if (target.status === 'disabled') {
        return fail(origin, 'IS_DISABLED', '这个账号已被停用，请先到「离职/停用」里重新启用');
      }

      // 员工绑定
      let staffName = typeof body.staff_name === 'string' ? body.staff_name.trim() : '';
      if (staffName) {
        const c = await checkStaff(staffName, id);
        if (!c.ok) return fail(origin, c.code, c.error);
      } else {
        staffName = target.staff_name ?? '';
      }

      // 角色
      let role = String(body.role ?? '').trim();
      if (!role) role = target.status === 'pending' ? 'employee' : (target.role || 'employee');
      if (!ROLES.includes(role)) return fail(origin, 'BAD_ROLE', ROLE_MSG);
      if (role === 'employee' && !staffName) {
        return fail(origin, 'NEED_STAFF', '员工账号必须先绑定员工名单里的姓名，否则他看不到自己的班表');
      }

      const displayName =
        cleanText(body.display_name, 40) || staffName || target.display_name || target.username;

      await pgPatch(`profiles?id=eq.${encodeURIComponent(id)}`, {
        status: 'active',
        role,
        staff_name: staffName || null,
        display_name: displayName,
        approved_by: me.id,
        approved_at: new Date().toISOString(),
        rejected_reason: null,
      });

      await audit(me, 'review_approve', target.username, {
        role,
        staff_name: staffName || null,
        was: target.status,
      });

      return json(
        {
          ok: true,
          id,
          username: target.username,
          status: 'active',
          role,
          staff_name: staffName || null,
          display_name: displayName,
        },
        200,
        origin,
      );
    }

    // ---------------- 拒绝 ----------------
    if (action === 'reject') {
      const id = String(body.id ?? '');
      if (!UUID_RE.test(id)) return fail(origin, 'BAD_ID', '参数不对：缺少账号 id');

      const target = await loadTarget(id);
      if (!target) return fail(origin, 'NOT_FOUND', '找不到这个申请，可能已被处理');
      if (target.status !== 'pending' && target.status !== 'rejected') {
        return fail(origin, 'NOT_PENDING', '只有待审核的申请可以拒绝；已在用的账号请走「停用」');
      }

      const reason = cleanText(body.reason, 200) || '未通过审核';
      await pgPatch(`profiles?id=eq.${encodeURIComponent(id)}`, {
        status: 'rejected',
        rejected_reason: reason,
        approved_by: me.id,
        approved_at: new Date().toISOString(),
      });

      await audit(me, 'review_reject', target.username, { reason });

      return json({ ok: true, id, username: target.username, status: 'rejected', reason }, 200, origin);
    }

    // ---------------- 彻底删除 ----------------
    if (action === 'purge') {
      const id = String(body.id ?? '');
      if (!UUID_RE.test(id)) return fail(origin, 'BAD_ID', '参数不对：缺少账号 id');
      if (id === me.id) return fail(origin, 'FORBIDDEN', '不能删除你自己的账号', 403);

      const target = await loadTarget(id);
      if (!target) return fail(origin, 'NOT_FOUND', '找不到这个账号');
      if (target.status === 'active') {
        return fail(origin, 'IS_ACTIVE', '账号还在用，请先在「离职/停用」里停用，再删除');
      }
      if (target.role === 'manager') {
        return fail(origin, 'FORBIDDEN', '不能删除排班经理账号', 403);
      }

      // 先删 Auth 用户：auth.users → profiles 是 on delete cascade，
      // 资料/设备/邀请码使用记录会一起清掉，账号名随即释放、可重新注册。
      try {
        await adminDeleteUser(id);
      } catch (e) {
        console.error('purge adminDeleteUser failed:', e);
        return fail(origin, 'DELETE_FAILED', 'Auth 账号删除失败，请稍后重试', 500);
      }
      // 兜底：若级联没生效（理论上不会），再清一次 profile
      await pgDelete(`profiles?id=eq.${encodeURIComponent(id)}`).catch((e) =>
        console.error('purge profile cleanup skipped:', e)
      );

      await audit(me, 'review_purge', target.username, {
        staff_name: target.staff_name,
        status: target.status,
      });

      return json({ ok: true, id, username: target.username, deleted: true }, 200, origin);
    }

    return fail(origin, 'BAD_ACTION', `不支持的操作：${action}`);
  } catch (e) {
    console.error('review unhandled:', e);
    return fail(origin, 'INTERNAL', '服务器开小差了，请稍后再试', 500);
  }
});
