#!/bin/bash
# 既有回归测试全量跑一遍
cd /Users/xianyu/WorkBuddy/2026-09-02-11-41-05
NODE=/Users/xianyu/.workbuddy/binaries/node/versions/22.22.2-6/bin/node
TESTS="test_scheduler.js test_domain.js test_edge.js test_features.js test_configs.js test_roster.js test_health.js test_precheck.js test_out.js test_offday.js test_confirm.js test_conflict.js test_limin.js test_kufang.js test_day_needs.js test_dated_req.js test_multi_leave.js test_leave_nolimit.js test_mustwork.js test_balance.js"
PASS=0; FAIL=0; FAILED=""
for t in $TESTS; do
  [ -f "$t" ] || continue
  OUT=$($NODE "$t" 2>&1)
  RC=$?
  LAST=$(echo "$OUT" | grep -E "=====" | tail -1)
  if [ $RC -eq 0 ]; then
    PASS=$((PASS+1)); printf "  ✅ %-28s %s\n" "$t" "$(echo $LAST | cut -c1-52)"
  else
    FAIL=$((FAIL+1)); FAILED="$FAILED $t"
    printf "  ❌ %-28s %s\n" "$t" "$(echo $LAST | cut -c1-52)"
    echo "$OUT" | grep -E "❌|FAIL" | head -4 | sed 's/^/       /'
  fi
done
echo ""
echo "===== 回归：$PASS 通过 / $FAIL 失败 ====="
[ -n "$FAILED" ] && echo "失败套件：$FAILED"
