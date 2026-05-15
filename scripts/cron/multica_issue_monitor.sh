#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/multica_monitor.log"
RERUN_LOG="$LOG_DIR/multica_rerun.log"

MULTICA_BIN="/Applications/Multica.app/Contents/Resources/app.asar.unpacked/resources/bin/multica"
WORKSPACE_ID="84010213-331f-4935-b5b8-9bb19773113b"
CONCURRENCY=3
STALE_MINUTES=10

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

rerun_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$RERUN_LOG"
}

log "===== Multica Issue 监控 + 自动 Rerun 启动 ====="

if [ ! -x "$MULTICA_BIN" ]; then
    MULTICA_BIN="$(command -v multica 2>/dev/null || true)"
fi

if [ -z "$MULTICA_BIN" ]; then
    log "[ERROR] multica CLI 未找到"
    exit 1
fi

MC() {
    "$MULTICA_BIN" "$@" --workspace-id "$WORKSPACE_ID" 2>&1
}

# 1. 守护进程检查 + 自动恢复
DAEMON_STATUS="$(MC daemon status 2>&1 || true)"
log "[DAEMON] $DAEMON_STATUS"

if echo "$DAEMON_STATUS" | grep -qiE "not running|stopped|inactive"; then
    log "[ACTION] 守护进程未运行，尝试启动..."
    DAEMON_START="$($MULTICA_BIN daemon start 2>&1 || true)"
    log "[DAEMON START] $DAEMON_START"
    sleep 5
    DAEMON_STATUS2="$(MC daemon status 2>&1 || true)"
    log "[DAEMON RECHECK] $DAEMON_STATUS2"
    if echo "$DAEMON_STATUS2" | grep -qiE "not running|stopped|inactive"; then
        log "[CRITICAL] 守护进程启动失败"
        exit 2
    fi
fi

# 2. 获取所有 in_progress 的 Issue
ISSUE_LIST="$(MC issue list 2>&1 || true)"
IN_PROGRESS_KEYS="$(echo "$ISSUE_LIST" | awk '/in_progress/{print $1}')"

if [ -z "$IN_PROGRESS_KEYS" ]; then
    log "[OK] 没有 in_progress 的 Issue，全部已完成"
    log "===== 监控检查完成 ====="
    exit 0
fi

log "[INFO] 发现 $(echo "$IN_PROGRESS_KEYS" | wc -l | tr -d ' ') 个 in_progress Issue"

# 3. 检查当前是否有 agent 正在执行（有 running 的 task 就不 rerun）
RUNNING_COUNT="$(echo "$ISSUE_LIST" | grep -c 'in_progress' || true)"

# 检查是否有活跃的 opencode 进程
ACTIVE_AGENTS=0
pgrep -f "opencode run" >/dev/null 2>&1 && ACTIVE_AGENTS=$(pgrep -f "opencode run" 2>/dev/null | wc -l | tr -d '[:space:]')
log "[INFO] 当前活跃 agent 进程数: $ACTIVE_AGENTS"

# 4. 对每个 in_progress Issue 检查最近一次 run 的状态
NEED_RERUN=()

for KEY in $IN_PROGRESS_KEYS; do
    RUNS_OUTPUT="$(MC issue runs "$KEY" 2>&1 || true)"
    LATEST_RUN="$(echo "$RUNS_OUTPUT" | grep -E "^[a-f0-9]" | head -1)"

    if [ -z "$LATEST_RUN" ]; then
        log "[RERUN] $KEY: 无执行记录，需要 rerun"
        NEED_RERUN+=("$KEY")
        continue
    fi

    LATEST_STATUS="$(echo "$LATEST_RUN" | awk '{print $3}')"
    LATEST_STARTED="$(echo "$LATEST_RUN" | awk '{print $4, $5}')"
    LATEST_COMPLETED="$(echo "$LATEST_RUN" | awk '{print $6, $7}')"

    if [ "$LATEST_STATUS" = "completed" ]; then
        # run 已完成但 Issue 仍 in_progress → 需要 rerun
        log "[RERUN] $KEY: 最近 run 已完成但 Issue 未关闭，自动 rerun"
        NEED_RERUN+=("$KEY")
    elif [ "$LATEST_STATUS" = "running" ]; then
        log "[SKIP] $KEY: 正在执行中"
    elif [ "$LATEST_STATUS" = "queued" ]; then
        log "[SKIP] $KEY: 已排队等待执行"
    elif [ "$LATEST_STATUS" = "failed" ]; then
        log "[RERUN] $KEY: 最近 run 失败，自动 rerun"
        NEED_RERUN+=("$KEY")
    else
        # 未知状态，检查是否超时
        log "[WARN] $KEY: 未知 run 状态 '$LATEST_STATUS'"
        NEED_RERUN+=("$KEY")
    fi
done

# 5. 控制并发，批量 rerun
if [ ${#NEED_RERUN[@]} -eq 0 ]; then
    log "[OK] 所有 in_progress Issue 均在正常执行中"
    log "===== 监控检查完成 ====="
    exit 0
fi

log "[ACTION] 需要 rerun 的 Issue: ${NEED_RERUN[*]} (共 ${#NEED_RERUN[@]} 个)"

# 当前有 agent 在跑时，限制并发 rerun 数量
RERUN_LIMIT=$((CONCURRENCY - ACTIVE_AGENTS))
if [ "$RERUN_LIMIT" -le 0 ]; then
    RERUN_LIMIT=1
fi

COUNT=0
for KEY in "${NEED_RERUN[@]}"; do
    if [ "$COUNT" -ge "$RERUN_LIMIT" ]; then
        log "[DEFER] $KEY: 并发数已达上限，等待下一轮调度"
        continue
    fi

    RERUN_RESULT="$(MC issue rerun "$KEY" 2>&1 || true)"
    RERUN_STATUS="$(echo "$RERUN_RESULT" | grep '"status"' | head -1 | grep -oE 'queued|running|failed' || echo 'unknown')"

    log "[RERUN] $KEY → $RERUN_STATUS"
    rerun_log "$KEY → $RERUN_STATUS"
    COUNT=$((COUNT + 1))
done

log "[DONE] 本轮触发 $COUNT 个 rerun"
log "===== 监控检查完成 ====="
