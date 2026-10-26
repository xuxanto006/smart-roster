// =============================================================
// invites/index.ts · 邀请码管理（排班经理专用）
//
// 请求：POST /functions/v1/invites
//   { token, action: "list" }
//   { token, action: "create", code?, max_uses?, starts_at?, ends_at?, note? }
//   { token, action: "update", code, max_uses?, starts_at?, ends_at?, note?, disabled? }
//   { token, action: "delete", code }
//
// 返回：{ ok:true, ... } / { ok:false, code, error }
//
// 设计要点：
//   · code 不填就自动生成 8 位（去掉了 I/O/0/1 这些看错的字符）
//   · 「生效时间窗」服务端算状态：not_started / active / expired / exhausted / disabled
//   · max_uses 受表约束 used_count <= max_uses 限制，所以不允许改到小于已用数量
//   · delete 只允许删「一次都没用过」的码，用过的只能 disabled=true（保住审计链）
// =============================================================

import { json, preflight } from '../_shared/cors.ts';
import { pgDelete, pgInsert, pgPatch, pgSelect } from '../_shared/db.ts';
import { audit, type Caller, requireManager } from '../_shared/auth.ts';
import { cleanText } from '../_shared/validate.ts';

type InviteRow = {
  code: string;
  max_uses: number;
  used_count: number;
  starts_at: string;
  ends_at: string | null;
  disabled: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

type UseRow = { code: string; profile_id: string; used_at: string };
type MiniProfile = { id: string; username: string; display_name: string; status: string };

const CODE_RE = /^[A-Z0-9_-]{4,32}$/;
// 去掉容易看错的 I O 0 1
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_USES_LIMIT = 500;
const SELECT_COLS = 'code,max_uses,used_count,starts_at,ends_at,disabled,note,created_by,created_at';

function fail(origin: string | null, code: string, error: string, status = 200): Response {
  return json({ ok: false, code, error }, status, origin);
}

function genCode(len = 8): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

/** 算这个码当前能不能用（纯展示用，真正的判定在服务端 RPC check_invite 里） */
function statusOf(r: InviteRow, now: number): string {
  if (r.disabled) return 'disabled';
  const start = Date.parse(r.starts_at);
  if (Number.isFinite(start) && start > now) return 'not_started';
  if (r.ends_at) {
    const end = Date.parse(r.ends_at);
    if (Number.isFinite(end) && end <= now) return 'expired';
  }
  if (r.used_count >= r.max_uses) return 'exhausted';
  return 'active';
}

function parseTime(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  const s = String(raw).trim();
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return { ok: false, error: '时间格式不对，请用 2026-10-01 08:00 这种写法' };
  return { ok: true, value: new Date(t).toISOString() };
}

function parseMaxUses(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isInteger(n)) return { ok: false, error: '可用次数必须是整数' };
  if (n < 1 || n > MAX_USES_LIMIT) return { ok: false, error: `可用次数只能在 1 ~ ${MAX_USES_LIMIT} 之间` };
  return { ok: true, value: n };
}

async function loadCode(code: string): Promise<InviteRow | null> {
  const rows = await pgSelect<InviteRow>(
    `invite_codes?code=eq.${encodeURIComponent(code)}&select=${SELECT_COLS}&limit=1`,
  );
  return rows[0] ?? null;
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
      const codes = await pgSelect<InviteRow>(
        `invite_codes?select=${SELECT_COLS}&order=created_at.desc`,
      );
      const uses = await pgSelect<UseRow>(
        'invite_uses?select=code,profile_id,used_at&order=used_at.desc&limit=40',
      );

      let names: MiniProfile[] = [];
      const ids = [...new Set(uses.map((u) => u.profile_id).filter(Boolean))];
      if (ids.length > 0) {
        names = await pgSelect<MiniProfile>(
          `profiles?id=in.(${ids.map((i) => encodeURIComponent(i)).join(',')})` +
            '&select=id,username,display_name,status',
        );
      }
      const byId = new Map(names.map((n) => [n.id, n]));

      const now = Date.now();
      const withStatus = codes.map((c) => ({ ...c, status: statusOf(c, now) }));
      const stats = {
        total: withStatus.length,
        active: withStatus.filter((c) => c.status === 'active').length,
        used: withStatus.reduce((s, c) => s + c.used_count, 0),
        capacity: withStatus.reduce((s, c) => s + c.max_uses, 0),
      };

      return json(
        {
          ok: true,
          me: { username: me.username, role: me.role },
          stats,
          codes: withStatus,
          uses: uses.map((u) => {
            const p = byId.get(u.profile_id);
            return {
              code: u.code,
              used_at: u.used_at,
              profile_id: u.profile_id,
              username: p?.username ?? null,
              display_name: p?.display_name ?? null,
              account_status: p?.status ?? null,
            };
          }),
        },
        200,
        origin,
      );
    }

    // ---------------- 新建 ----------------
    if (action === 'create') {
      const m = parseMaxUses(body.max_uses);
      if (!m.ok) return fail(origin, 'BAD_MAX_USES', m.error);
      const st = parseTime(body.starts_at);
      if (!st.ok) return fail(origin, 'BAD_TIME', st.error);
      const en = parseTime(body.ends_at);
      if (!en.ok) return fail(origin, 'BAD_TIME', en.error);

      const startsAt = st.value ?? new Date().toISOString();
      if (en.value && Date.parse(en.value) <= Date.parse(startsAt)) {
        return fail(origin, 'BAD_WINDOW', '结束时间必须晚于开始时间');
      }

      let code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (code && !CODE_RE.test(code)) {
        return fail(origin, 'BAD_CODE', '邀请码只能用大写字母、数字、下划线或短横线，4~32 位');
      }

      const row: Record<string, unknown> = {
        max_uses: m.value ?? 1,
        starts_at: startsAt,
        ends_at: en.value,
        note: cleanText(body.note, 100) || null,
        created_by: me.id,
      };

      // 自动生成时按冲突重试（并发下极小概率撞码）
      let created: InviteRow | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (!code) code = genCode(8);
        try {
          created = await pgInsert<InviteRow>('invite_codes', { code, ...row });
          break;
        } catch (e) {
          const msg = String(e);
          if (!code || !/duplicate key|23505/i.test(msg)) throw e;
          if (body.code) return fail(origin, 'CODE_TAKEN', '这个邀请码已经存在了，换一个');
          code = '';
        }
      }
      if (!created) return fail(origin, 'CODE_TAKEN', '生成邀请码失败，请重试', 500);

      await audit(me, 'invite_create', created.code, {
        max_uses: created.max_uses,
        starts_at: created.starts_at,
        ends_at: created.ends_at,
      });

      return json({ ok: true, invite: { ...created, status: statusOf(created, Date.now()) } }, 200, origin);
    }

    // ---------------- 修改 ----------------
    if (action === 'update') {
      const code = String(body.code ?? '').trim().toUpperCase();
      if (!CODE_RE.test(code)) return fail(origin, 'BAD_CODE', '邀请码格式不对');

      const cur = await loadCode(code);
      if (!cur) return fail(origin, 'NOT_FOUND', '找不到这个邀请码');

      const patch: Record<string, unknown> = {};

      if (body.max_uses !== undefined) {
        const m = parseMaxUses(body.max_uses);
        if (!m.ok) return fail(origin, 'BAD_MAX_USES', m.error);
        const v = m.value as number;
        if (v < cur.used_count) {
          return fail(origin, 'USED_EXCEEDS_MAX', `这个码已经被用了 ${cur.used_count} 次，可用次数不能改到比它小`);
        }
        patch.max_uses = v;
      }

      let startsAt = cur.starts_at;
      let endsAt = cur.ends_at;
      if (body.starts_at !== undefined) {
        const st = parseTime(body.starts_at);
        if (!st.ok) return fail(origin, 'BAD_TIME', st.error);
        startsAt = st.value ?? cur.starts_at;
        patch.starts_at = startsAt;
      }
      if (body.ends_at !== undefined) {
        const en = parseTime(body.ends_at);
        if (!en.ok) return fail(origin, 'BAD_TIME', en.error);
        endsAt = en.value;
        patch.ends_at = endsAt;
      }
      if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
        return fail(origin, 'BAD_WINDOW', '结束时间必须晚于开始时间');
      }

      if (body.note !== undefined) patch.note = cleanText(body.note, 100) || null;
      if (body.disabled !== undefined) {
        if (typeof body.disabled !== 'boolean') {
          return fail(origin, 'BAD_DISABLED', 'disabled 只能是 true 或 false');
        }
        patch.disabled = body.disabled;
      }

      if (Object.keys(patch).length === 0) return fail(origin, 'NOTHING_TO_UPDATE', '没有要改的字段');

      await pgPatch(`invite_codes?code=eq.${encodeURIComponent(code)}`, patch);

      const after = await loadCode(code);
      await audit(me, 'invite_update', code, patch);

      return json(
        { ok: true, invite: after ? { ...after, status: statusOf(after, Date.now()) } : null },
        200,
        origin,
      );
    }

    // ---------------- 删除 ----------------
    if (action === 'delete') {
      const code = String(body.code ?? '').trim().toUpperCase();
      if (!CODE_RE.test(code)) return fail(origin, 'BAD_CODE', '邀请码格式不对');

      const cur = await loadCode(code);
      if (!cur) return fail(origin, 'NOT_FOUND', '找不到这个邀请码');
      if (cur.used_count > 0) {
        return fail(origin, 'IN_USE', `这个码已经被用了 ${cur.used_count} 次，不能删除；要停用请把 disabled 设为 true`);
      }

      await pgDelete(`invite_codes?code=eq.${encodeURIComponent(code)}`);
      await audit(me, 'invite_delete', code, { max_uses: cur.max_uses, note: cur.note });

      return json({ ok: true, code, deleted: true }, 200, origin);
    }

    return fail(origin, 'BAD_ACTION', `不支持的操作：${action}`);
  } catch (e) {
    console.error('invites unhandled:', e);
    return fail(origin, 'INTERNAL', '服务器开小差了，请稍后再试', 500);
  }
});
