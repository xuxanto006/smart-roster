# -*- coding: utf-8 -*-
"""SQL 静态检查：用 sqlglot(postgres) 解析 4 个迁移文件，并做跨文件一致性核对。
   运行：python tools/check_sql.py"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MDIR = os.path.join(ROOT, 'supabase', 'migrations')
FILES = ['001_init.sql', '002_rls.sql', '003_functions.sql', '004_seed_staff.sql', '005_bootstrap_manager.sql']

try:
    import sqlglot
    from sqlglot import exp
except ImportError:
    print('缺少 sqlglot，请先 pip install sqlglot')
    sys.exit(1)

texts = {}
for f in FILES:
    p = os.path.join(MDIR, f)
    texts[f] = io.open(p, encoding='utf-8').read()

print('=' * 60)
print('① 语法解析（postgres 方言）')
print('=' * 60)
ok_all = True
for f in FILES:
    try:
        stmts = sqlglot.parse(texts[f], dialect='postgres')
    except Exception as e:
        ok_all = False
        msg = str(e).split('\n')
        print('  ✗ %-22s 解析失败: %s' % (f, msg[0][:160]))
        continue
    n = len([s for s in stmts if s is not None])
    print('  ✓ %-22s %3d 条语句' % (f, n))

print()
print('=' * 60)
print('② 建表数量与名单')
print('=' * 60)
tables = re.findall(r'create table if not exists public\.(\w+)', texts['001_init.sql'])
print('  001 建表 %d 张: %s' % (len(tables), ', '.join(tables)))

print()
print('=' * 60)
print('③ 002 的 RLS 覆盖是否完整')
print('=' * 60)
rls_on = set(re.findall(r'alter table public\.(\w+)\s+enable row level security', texts['002_rls.sql']))
missing = [t for t in tables if t not in rls_on]
extra = [t for t in rls_on if t not in tables]
print('  已开启 RLS: %d / %d' % (len(rls_on), len(tables)))
print('  未覆盖: %s' % (missing if missing else '无 ✓'))
print('  多出来(表不存在): %s' % (extra if extra else '无 ✓'))

print()
print('=' * 60)
print('④ 003 引用的表是否都在 001 里')
print('=' * 60)
refs = set(re.findall(r'\bfrom public\.(\w+)', texts['003_functions.sql']))
refs |= set(re.findall(r'\binto public\.(\w+)', texts['003_functions.sql']))
refs |= set(re.findall(r'\bupdate public\.(\w+)', texts['003_functions.sql']))
unknown = sorted(r for r in refs if r not in tables)
print('  引用表: %s' % ', '.join(sorted(refs)))
print('  未知表: %s' % (unknown if unknown else '无 ✓'))

print()
print('=' * 60)
print('⑤ 004 种子数据')
print('=' * 60)
rows = re.findall(r"^\s*\('([^']+)', ", texts['004_seed_staff.sql'], re.M)
print('  staff 行数: %d（应为 81）' % len(rows))
dup = [r for r in set(rows) if rows.count(r) > 1]
print('  重名: %s' % (dup if dup else '无 ✓'))
doms = re.findall(r"'([a-z0-9]+)'\)\s*,?\s*$", texts['004_seed_staff.sql'], re.M)
from collections import Counter
print('  领域分布: %s' % dict(Counter(doms)))

print()
print('=' * 60)
print('⑥ 关键约定自检')
print('=' * 60)
pols = re.findall(r'create policy (\w+) on public\.(\w+)', texts['002_rls.sql'])
funcs = re.findall(r'create or replace function public\.(\w+)', texts['003_functions.sql'] + texts['002_rls.sql'])
print('  策略数: %d（去重 %d）' % (len(pols), len(set(p[0] for p in pols))))
dup_pol = [n for n in set(p[0] for p in pols) if [p[0] for p in pols].count(n) > 1]
print('  重名策略: %s' % (dup_pol if dup_pol else '无 ✓'))
print('  函数数: %d（去重 %d）' % (len(funcs), len(set(funcs))))
print('  函数: %s' % ', '.join(sorted(set(funcs))))
checks = [
    ('002 有 is_active_user', 'create or replace function public.is_active_user()' in texts['002_rls.sql']),
    ('002 撤销 anon 权限', 'revoke all on all tables in schema public from anon' in texts['002_rls.sql']),
    ('003 邀请码原子占用', 'used_count < c.max_uses' in texts['003_functions.sql']),
    ('003 离职拉黑全部设备', 'insert into public.device_bans' in texts['003_functions.sql']),
    ('003 函数权限收敛', 'from public, anon, authenticated' in texts['003_functions.sql']),
    ('001 week_key 必须是周一', "extract(isodow from week_key) = 1" in texts['001_init.sql']),
]
for name, passed in checks:
    print('  %s %s' % ('✓' if passed else '✗', name))

print()
print('结论:', '全部通过' if ok_all and not missing and not unknown and len(rows) == 81 else '有问题，见上')
