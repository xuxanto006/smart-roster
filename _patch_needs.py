import io
p = "/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html"
lines = io.open(p, encoding="utf-8").read().split("\n")
# 行号 1-based：254..282 → 索引 253..281
assert lines[253].strip().startswith('<div class="row" data-page-node-id="GnvWHjMBG35K2RHEVKvOjV"'), lines[253]
assert lines[281].strip() == "</div>", lines[281]

def row(d):
    nm = ["周一", "周二", "周三", "周四", "周五"][d]
    return ('      <span class="nd-row"><b class="nd-day">%s</b>'
            '<label class="nd-lb"><i class="nd-dot" style="background:var(--early)"></i>早'
            '<input type="number" id="wdE%d" min="0" value="8" onchange="setDayNeed(%d,\'early\',this.value)"></label>'
            '<label class="nd-lb"><i class="nd-dot" style="background:var(--mid)"></i>中'
            '<input type="number" id="wdM%d" min="0" value="1" onchange="setDayNeed(%d,\'mid\',this.value)"></label>'
            '<label class="nd-lb"><i class="nd-dot" style="background:var(--night)"></i>晚'
            '<input type="number" id="wdN%d" min="0" value="10" onchange="setDayNeed(%d,\'night\',this.value)"></label></span>'
            ) % (nm, d, d, d, d, d, d)

new = []
new.append('    <div class="row" style="margin-bottom:2px">')
new.append('      <span style="font-size:13px;color:var(--text2);font-weight:600">工作日（周一~周五，每天单独设置）</span>')
new.append('      <span style="font-size:12px;color:var(--text2)">早班＝按人数排满（不多不少，不设「≥」）；中班 / 晚班＝至少这么多人，多出的人力自动补进去</span>')
new.append('    </div>')
new.append('    <div class="nd-grid" id="wdNeedsGrid">')
for d in range(5):
    new.append(row(d))
new.append('    </div>')
new.append('    <div class="row">')
new.append('      <span style="font-size:13px;color:var(--text2);font-weight:600">周末(周六/日 同时生效)</span>')
new.append('      <label style="font-size:13px;display:flex;align-items:center;gap:6px;">')
new.append('        <span style="width:12px;height:12px;border-radius:3px;background:var(--early);display:inline-block"></span>早班')
new.append('        <input type="number" id="wkNeedEarly" min="0" value="9" style="width:56px" onchange="applyWeekendNeed()">')
new.append('      </label>')
new.append('      <label style="font-size:13px;display:flex;align-items:center;gap:6px;">')
new.append('        <span style="width:12px;height:12px;border-radius:3px;background:var(--mid);display:inline-block"></span>中班(≥)')
new.append('        <input type="number" id="wkNeedMid" min="0" value="3" style="width:56px" onchange="applyWeekendNeed()">')
new.append('      </label>')
new.append('      <label style="font-size:13px;display:flex;align-items:center;gap:6px;">')
new.append('        <span style="width:12px;height:12px;border-radius:3px;background:var(--night);display:inline-block"></span>晚班(≥)')
new.append('        <input type="number" id="wkNeedNight" min="0" value="12" style="width:56px" onchange="applyWeekendNeed()">')
new.append('      </label>')
new.append('    </div>')
new.append('    <div class="hint" id="enGroupHint" style="margin:2px 0 0;text-align:left"></div>')

out = lines[:253] + new + lines[282:]
io.open(p, "w", encoding="utf-8").write("\n".join(out))
print("替换完成，新行数", len(out))
