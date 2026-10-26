# -*- coding: utf-8 -*-
"""从 app_merged.html 的 ROSTER_PROFILES 提取 81 位员工，按 7 领域规则归类。
   用途：生成 supabase/migrations/004_seed_staff.sql
   运行：python tools/gen_seed_from_html.py"""
import io, json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'app_merged.html')
OUT = os.path.join(ROOT, 'supabase', 'migrations', '004_seed_staff.sql')

h = io.open(SRC, encoding='utf-8').read()

# ---------- 1. 抠出 ROSTER_PROFILES 对象字面量 ----------
anchor = h.index('const ROSTER_PROFILES = {')
start = h.index('{', anchor)
depth = 0
for i in range(start, len(h)):
    c = h[i]
    if c == '{':
        depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0:
            end = i + 1
            break
raw = h[start:end]

# ---------- 2. 去掉注释与尾逗号后解析 ----------
raw = re.sub(r'/\*.*?\*/', '', raw, flags=re.S)
raw = re.sub(r'(^|[^:])//[^\n]*', r'\1', raw)
raw = re.sub(r',(\s*[}\]])', r'\1', raw)
profiles = json.loads(raw)

# ---------- 3. 领域归类（与 app_merged.html 的 DOMAINS 规则一致） ----------
MOD = {'鸿蒙智行': 'hongmeng', '尊界': 'zunjie', '售后': 'aftersales', '库房': 'kufang', '行政': 'admin'}

def domain_of(p):
    if p.get('level') == '经理':
        return 'manager'
    return MOD.get((p.get('module') or '').strip(), '3c')

rows = []
for name, p in profiles.items():
    rows.append({
        'name': name,
        'module': (p.get('module') or '').strip(),
        'position': (p.get('position') or '').strip(),
        'level': (p.get('level') or '员工').strip(),
        'domain': domain_of(p),
    })
rows.sort(key=lambda r: ({'manager': 0, '3c': 1}.get(r['domain'], 2), r['name']))

# ---------- 4. 统计 ----------
from collections import Counter
cnt = Counter(r['domain'] for r in rows)
print('总人数:', len(rows))
for k in ['3c', 'hongmeng', 'zunjie', 'aftersales', 'kufang', 'admin', 'manager']:
    print('  %-11s %d' % (k, cnt.get(k, 0)))
print('模块分布:', dict(Counter(r['module'] for r in rows)))

def q(s):
    return "'" + s.replace("'", "''") + "'"

lines = []
lines.append('-- 004_seed_staff.sql')
lines.append('-- 81 位员工主数据（由 tools/gen_seed_from_html.py 从 app_merged.html 的 ROSTER_PROFILES 自动生成）')
lines.append('-- 可重复执行：冲突时只更新静态字段，不覆盖 active')
lines.append('')
lines.append('insert into public.staff (name, module, position, level, domain) values')
body = []
for r in rows:
    body.append('  (%s, %s, %s, %s, %s)' % (q(r['name']), q(r['module']), q(r['position']), q(r['level']), q(r['domain'])))
lines.append(',\n'.join(body))
lines.append('on conflict (name) do update set')
lines.append('  module = excluded.module,')
lines.append('  position = excluded.position,')
lines.append('  level = excluded.level,')
lines.append('  domain = excluded.domain,')
lines.append('  updated_at = now();')
lines.append('')
lines.append("-- 校验：应为 81")
lines.append("-- select count(*) as total, count(*) filter (where domain='manager') as managers from public.staff;")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
io.open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print('\n已生成:', OUT, os.path.getsize(OUT), 'bytes')
