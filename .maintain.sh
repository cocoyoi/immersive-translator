#!/bin/bash
# immersive-translator auto-maintain script
# Now with "only report on change" policy

set -e

REPO_DIR="/root/.openclaw/workspace/immersive-translator"
LOG_FILE="$REPO_DIR/.maintain.log"
STATE_FILE="$REPO_DIR/.maintain.state.json"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$DATE] $1" >> "$LOG_FILE"
}

# Load previous state
test_status="unknown"
todo_count=0
last_commit=""
if [ -f "$STATE_FILE" ]; then
    test_status=$(grep '"test_status"' "$STATE_FILE" 2>/dev/null | sed 's/.*: "\([^"]*\)".*/\1/' || echo "unknown")
    todo_count=$(grep '"todo_count"' "$STATE_FILE" 2>/dev/null | sed 's/.*: \([0-9]*\).*/\1/' || echo 0)
    last_commit=$(grep '"last_commit"' "$STATE_FILE" 2>/dev/null | sed 's/.*: "\([^"]*\)".*/\1/' || echo "")
fi

log "=== Maintenance Cycle Started ==="

cd "$REPO_DIR"

# 1. Check repo status
git fetch origin >> "$LOG_FILE" 2>&1 || log "Fetch failed"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "no-remote")
PULLED=0
if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != "no-remote" ]; then
    log "   Remote changes detected, pulling..."
    git pull origin master >> "$LOG_FILE" 2>&1 && log "   Pull successful" && PULLED=1 || log "   Pull failed"
fi

# 2. Run tests
cd tests
TEST_RESULT="passed"
if [ -f package.json ]; then
    npm test >> "$LOG_FILE" 2>&1 && log "   Tests PASSED" || { log "   Tests FAILED - check logs"; TEST_RESULT="failed"; }
else
    log "   No package.json found, skipping tests"
fi
cd "$REPO_DIR"

# 3. Check code quality
TOTAL_LINES=$(find . -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/lib/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
TODO_COUNT=$(grep -r "TODO\|FIXME\|XXX" --include="*.js" --include="*.html" --include="*.css" . 2>/dev/null | grep -v node_modules | grep -v .git | wc -l)
CONSOLE_COUNT=$(grep -r "console.log" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v .git | grep -v test | wc -l)
VERSION=$(grep -o '"version".*"[^"]*"' manifest.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

# 4. Security checks
EVAL_COUNT=$(grep -rn "eval(" *.js lib/*.js 2>/dev/null | grep -v node_modules | wc -l)
INNERHTML_COUNT=$(grep -rn "innerHTML" *.js *.html 2>/dev/null | grep -v node_modules | wc -l)

# 5. Determine if anything meaningful changed
CHANGED=0
if [ "$PULLED" -eq 1 ]; then CHANGED=1; fi
if [ "$TEST_RESULT" != "$test_status" ]; then CHANGED=1; fi
if [ "$TODO_COUNT" -ne "$todo_count" ]; then CHANGED=1; fi
if [ "$LOCAL" != "$last_commit" ]; then CHANGED=1; fi

# Only emit a report if something changed or it's the first run
if [ "$CHANGED" -eq 1 ] || [ ! -f "$STATE_FILE" ]; then
    log "=== Change Detected - Full Report ==="
    log "Version: $VERSION | Lines: $TOTAL_LINES | Tests: $TEST_RESULT"
    log "TODOs: $TODO_COUNT | console.logs: $CONSOLE_COUNT | eval: $EVAL_COUNT | innerHTML: $INNERHTML_COUNT"
    if [ "$PULLED" -eq 1 ]; then
        log "New commits pulled. Last: $LOCAL"
    fi
    if [ "$TEST_RESULT" != "$test_status" ] && [ "$test_status" != "unknown" ]; then
        log "Test status changed from $test_status to $TEST_RESULT"
    fi
    
    # Save state
    cat > "$STATE_FILE" <<EOF
{
  "test_status": "$TEST_RESULT",
  "todo_count": $TODO_COUNT,
  "last_commit": "$LOCAL",
  "version": "$VERSION",
  "lines": $TOTAL_LINES,
  "timestamp": "$DATE"
}
EOF
    log "=== Report Emitted ==="
else
    log "No changes since last run. Skipping report."
fi

log "=== Cycle Complete ==="
