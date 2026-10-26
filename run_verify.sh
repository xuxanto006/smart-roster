#!/bin/zsh
# 本轮改动（晚班≤3 + 上一休一配对修复）的完整验证。
# 顺序讲究：回归测试对 CPU 竞争最敏感，放在最前面单独跑；其余依次串行，避免互相拖慢。
cd /Users/xianyu/WorkBuddy/2026-09-02-11-41-05
APP=/Users/xianyu/WorkBuddy/2026-08-26-20-24-59/index.html
LOG=/tmp/verify.log
: > $LOG

echo "########## 1. 回归测试（全量 test_*.js） ##########" >> $LOG
for f in test_*.js; do
  out=$(node "$f" 2>&1); code=$?
  last=$(echo "$out" | grep -E "通过|失败|❌|✅|PASS|FAIL|全绿" | tail -1)
  echo "[exit $code] $f :: $last" >> $LOG
done
echo "" >> $LOG

echo "########## 2. 全规则审计 60 轮（早班需求 8 + 晚班≤3） ##########" >> $LOG
ROUNDS=60 node audit_env.js 2>&1 | grep -E "条规则零违规|❌" >> $LOG
echo "" >> $LOG

echo "########## 3. 请假模式 40 轮 ##########" >> $LOG
ROUNDS=40 node audit_env.js 40 leave 2>&1 | grep -E "条规则零违规|❌|算法问题" >> $LOG
echo "" >> $LOG

echo "########## 4. 对照组：晚班上限 4（改造前口径） ##########" >> $LOG
ROUNDS=60 node audit_env_n4.js 2>&1 | grep -E "条规则零违规|❌" >> $LOG
echo "" >> $LOG

echo "########## 4b. 早晚班分布（均衡度） ##########" >> $LOG
node probe_balance.js $APP 5 2>&1 | head -11 >> $LOG
echo "" >> $LOG

echo "########## 5. 微调路径 vs 重排（同输入对照） ##########" >> $LOG
node audit_repatch.js 30 2 2>&1 | grep -E "微调后出现违规|重排后出现违规|净缺陷|合计" >> $LOG
echo "" >> $LOG

echo "########## 6. 扫码：早班需求 8 + 晚班≤3，200 个 seed ##########" >> $LOG
EARLY=8 node probe_iso_seed.js $APP 1 200 3 2>&1 | tail -3 >> $LOG
echo "" >> $LOG

echo "########## 7. 扫码：默认配置（早班 9）+ 晚班≤3，200 个 seed ##########" >> $LOG
EARLY=9 node probe_iso_seed.js $APP 1 200 3 2>&1 | tail -3 >> $LOG
echo "" >> $LOG

echo "DONE" >> $LOG
