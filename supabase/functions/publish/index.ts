// =============================================================
// publish/index.ts · 发布本周班表（排班经理专用）
//
// 请求：POST /functions/v1/publish
//   { token, week_key: "2026-10-26", note?: "本周有调休" }
//
// 为什么必须走服务端（不能前端直接写）：
//   发布是一组「跨 4 张表、必须全成功或全失败」的操作：
//     ① publish_versions  记一条版本（version = 该周当前最大值 + 1）
//     ② published_shifts  把草稿 shifts 整周快照一份（员工只读这张表）
//     ③ publish_deliveries 给每位涉及员工建一条待投递记录
//     ④ weeks.status      置为 published
//   任何一步失败，前端已经排好的草稿就处在「一半发布」的状态。
//   这里用 publish_id 做事务边界：中途出错就删掉 publish_versions 那一行，
//   级联删除 ② ③，再把 weeks.status 还原成 draft。
//
// 幂等 / 并发：
//   (week_key, version) 有唯一约束。两个经理同时发布，后者会撞 409，
//   这里自动重算版本号重试一次；仍冲突就返回 CONFLICT，让前端刷新。
//
// 空周：
//   shifts 里没有任何 slot 的行 → EMPTY_WEEK，不会生成 vN 的空快照。
// =============================================================

import { json, preflight } from '../_shared/cors.ts';
import { pgDelete, pgInsert, pgInsertMany, pgPatch, pgSelect } from '../_shared/db.ts';
import { audit, requireManager, type Caller } from '../_shared/auth.ts';
import { cleanText } from '../_shared/validate.ts';

type ShiftRow = {
  staff_name: string;
  day: number;
  slot: string | null;
  role: string | null;
};

type VersionRow = { version: number };

type WeekRow = { week_key: string; status: string };

type PublishRow = { publish_id: string; version: number; published_at: string };

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOTS = new Set(['early', 'mid', 'night', 'rest']);
const ROLES = new Set(['open', 'close']);

function fail(origin: string | null, code: string, error: string, status = 200): Response {
  return json({ ok: false, code, error }, status, origin);
}

/* 周键必须是周一，且是合法日期（DB 有 chk_week_monday 约束，先在这里拦住更友好） */
function normWeek(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!WEEK_RE.test(s)) return { ok: false, error: '周次格式不对（应为 YYYY-MM-DD）' };
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return { ok: false, error: '周次不是合法日期' };
  if (d.toISOString().slice(0, 10) !== s) return { ok: false, error: '周次不是合法日期' };
  if (d.getUTCDay() !== 1) return { ok: false, error: '周次必须是周一' };
  return { ok: true, value: s };
}

function nextVersion(rows: VersionRow[]): number {
  return (rows[0]?.version ?? 0) + 1;
}

function isConflict(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return msg.includes(' 409') || msg.includes('duplicate key') || msg.includes('23505');
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

  const wk = normWeek(body.week_key);
  if (!wk.ok) return fail(origin, 'BAD_WEEK', wk.error);
  const week = wk.value;
  const note = cleanText(body.note, 200) || null;

  let publishId = '';
  let version = 0;
  let weekStatusBefore = 'draft';   /* 回滚时还原用，必须声明在 try 外 */

  try {
    // ---------- ① 读草稿，过滤掉空壳与非法值 ----------
    const raw = await pgSelect<ShiftRow>(
      `shifts?week_key=eq.${week}&select=staff_name,day,slot,role`,
    );

    const rows: ShiftRow[] = [];
    for (const r of raw) {
      const slot = typeof r.slot === 'string' ? r.slot : '';
      if (!SLOTS.has(slot)) continue;                       // slot 为空 = 这一格没排
      const staffName = typeof r.staff_name === 'string' ? r.staff_name.trim() : '';
      const day = Number(r.day);
      if (!staffName || !Number.isInteger(day) || day < 0 || day > 6) continue;
      const role = typeof r.role === 'string' && ROLES.has(r.role) ? r.role : null;
      rows.push({ staff_name: staffName, day, slot, role });
    }

    if (rows.length === 0) {
      return fail(origin, 'EMPTY_WEEK', '这一周还没排班，先排几格再发布', 409);
    }

    // ---------- 周记录必须存在（shifts 有外键，正常情况一定在） ----------
    const weeks = await pgSelect<WeekRow>(
      `weeks?week_key=eq.${week}&select=week_key,status&limit=1`,
    );
    weekStatusBefore = weeks[0]?.status ?? 'draft';

    // ---------- ② 版本号：并发撞唯一约束就重算重试一次 ----------
    const perStaff = new Map<string, number>();
    const perDay = [0, 0, 0, 0, 0, 0, 0];
    let working = 0;
    for (const r of rows) {
      perStaff.set(r.staff_name, (perStaff.get(r.staff_name) ?? 0) + 1);
      perDay[r.day] += 1;
      if (r.slot !== 'rest') working += 1;
    }
    const summary = {
      staff: perStaff.size,
      cells: rows.length,
      working,
      days: perDay,
    };

    for (let attempt = 0; attempt < 2 && !publishId; attempt++) {
      const latest = await pgSelect<VersionRow>(
        `publish_versions?week_key=eq.${week}&select=version&order=version.desc&limit=1`,
      );
      const v = nextVersion(latest);
      try {
        const created = await pgInsert<PublishRow>('publish_versions', {
          week_key: week,
          version: v,
          published_by: me.id,
          note,
          summary,
        });
        if (!created?.publish_id) throw new Error('insert publish_versions 未返回 publish_id');
        publishId = created.publish_id;
        version = created.version;
      } catch (e) {
        if (attempt === 0 && isConflict(e)) continue;        // 别人抢先发布了一版 → 重算
        throw e;
      }
    }

    if (!publishId) return fail(origin, 'CONFLICT', '有别人同时发布了这一周，请刷新后重试', 409);

    // ---------- ③ 快照 ----------
    await pgInsertMany(
      'published_shifts',
      rows.map((r) => ({
        publish_id: publishId,
        week_key: week,
        staff_name: r.staff_name,
        day: r.day,
        slot: r.slot,
        role: r.role,
      })),
    );

    // ---------- ④ 投递任务（每人一条 inapp，员工端读到这里就能标记已送达） ----------
    await pgInsertMany(
      'publish_deliveries',
      [...perStaff.keys()].map((name) => ({
        publish_id: publishId,
        staff_name: name,
        channel: 'inapp',
        status: 'pending',
      })),
    );

    // ---------- ⑤ 周状态 ----------
    await pgPatch(`weeks?week_key=eq.${week}`, {
      status: 'published',
      updated_by: me.id,
    });

    await audit(me, 'publish', week, {
      publish_id: publishId,
      version,
      ...summary,
      note,
    });

    return json(
      {
        ok: true,
        week_key: week,
        publish_id: publishId,
        version,
        staff: perStaff.size,
        cells: rows.length,
        working,
        days: perDay,
        note,
      },
      200,
      origin,
    );
  } catch (e) {
    console.error('publish failed:', e);

    // 回滚：删掉版本行 → published_shifts / publish_deliveries 级联消失
    if (publishId) {
      try {
        await pgDelete(`publish_versions?publish_id=eq.${encodeURIComponent(publishId)}`);
      } catch (e2) {
        console.error('publish rollback failed:', e2);
      }
    }
    // 周状态还原成发布前的值（本次发布没成功，不能留下 published）
    try {
      await pgPatch(`weeks?week_key=eq.${week}`, {
        status: weekStatusBefore,
        updated_by: me.id,
      });
    } catch (e3) {
      console.error('publish week reset failed:', e3);
    }

    return fail(
      origin,
      'PUBLISH_FAILED',
      '发布没有完成，草稿没有被改动，请稍后再试',
      500,
    );
  }
});
