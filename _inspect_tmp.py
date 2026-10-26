import io, re

files = ['分享/团队智能排班系统_2026-09-07.html', '分享/团队智能排班系统_2026-09-10.html']
for f in files:
    h = io.open(f, encoding='utf-8').read()
    print('\n===', f, '===')
    print('size', len(h), 'lines', h.count('\n') + 1)
    print('title', re.search(r'<title[^>]*>(.*?)</title>', h).group(1))
    print('script tags', len(re.findall(r'<script', h)), 'external', len(re.findall(r'<script[^>]*\bsrc=', h)))
    print('__SEED__ count', h.count('__SEED__'), 'assigned payload', [len(m) for m in re.findall(r'window\.__SEED__\s*=\s*(\{.*?\});', h, re.S)])
    print('views', re.findall(r'id="view-([a-z]+)"', h))
    print('data-dom', sorted(set(re.findall(r'data-dom="([a-z0-9]+)"', h))))
    for k in ['function exportCSV', 'batchScheduleWeeks', 'ARCHIVE_KEY', 'staffDrawer', 'const DOMAINS',
              'EXCLUDE_SCHEDULE', 'exportSharedPage', 'fixedRoster', 'renderMonthStats', 'nightSlot',
              'analyze', 'OPENAI', 'fetch(', 'XMLHttpRequest']:
        print('  ', k, h.count(k))

h = io.open('app_merged.html', encoding='utf-8').read()
print('\n=== app_merged.html ===')
for k in ['window.__SEED__', 'inject.js', 'function exportSharedPage', 'const payload',
          'shiftScheduler_v2', 'shiftScheduler_statsArchive_v1', 'fetch(', 'XMLHttpRequest']:
    print(k, h.count(k))
m = re.search(r'window\.__SEED__\s*=\s*(\{.*?\});', h, re.S)
print('seed literal?', bool(m), (len(m.group(1)) if m else 0))
