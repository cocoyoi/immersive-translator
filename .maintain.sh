#!/bin/bash
# immersive-translator auto-maintain script
# Runs every 3 hours to maintain the repo

set -e

REPO_DIR="/root/.openclaw/workspace/immersive-translator"
LOG_FILE="$REPO_DIR/.maintain.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting maintenance..." >> "$LOG_FILE"

cd "$REPO_DIR"

# Pull latest
echo "[$DATE] Pulling latest changes..." >> "$LOG_FILE"
git pull origin master >> "$LOG_FILE" 2>&1 || echo "[$DATE] Pull failed or no remote changes" >> "$LOG_FILE"

# Run tests
echo "[$DATE] Running tests..." >> "$LOG_FILE"
cd tests
npm test >> "$LOG_FILE" 2>&1 && echo "[$DATE] Tests passed" >> "$LOG_FILE" || echo "[$DATE] Tests FAILED" >> "$LOG_FILE"

# Check for TODOs in code
echo "[$DATE] Checking TODOs..." >> "$LOG_FILE"
grep -r "TODO\|FIXME\|XXX" --include="*.js" --include="*.html" --include="*.css" "$REPO_DIR" >> "$LOG_FILE" 2>&1 || echo "[$DATE] No TODOs found" >> "$LOG_FILE"

# Check file sizes
echo "[$DATE] File stats:" >> "$LOG_FILE"
find "$REPO_DIR" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -exec wc -l {} + | tail -1 >> "$LOG_FILE"

# Git status
echo "[$DATE] Git status:" >> "$LOG_FILE"
git status --short >> "$LOG_FILE" 2>&1 || true

echo "[$DATE] Maintenance complete." >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"

# Keep only last 500 lines of log
tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
