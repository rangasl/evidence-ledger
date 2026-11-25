#!/bin/zsh
# Daily unattended shift for the Evidence Ledger. Started by launchd at 07:00 Asia/Colombo.
# Drafts only: commits, pushes and posts are blocked here and stay with Ranga.
set -u
REPO="$HOME/evidence-ledger"
cd "$REPO" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
TODAY=$(date +%F)
LOG="$REPO/ops/logs/$TODAY.log"
mkdir -p "$REPO/ops/logs"

# Run once per day even if launchd fires again after a wake
[ -f "$REPO/ops/logs/$TODAY.done" ] && exit 0

claude -p "/shift" \
  --permission-mode dontAsk \
  --allowedTools "Read" "Write" "Edit" "Glob" "Grep" "Agent" "Task" "Skill" "WebSearch" "WebFetch" \
    "mcp__plugin_bio-research_consensus__search" \
    "mcp__plugin_bio-research_pubmed__search_articles" \
    "mcp__plugin_bio-research_pubmed__get_article_metadata" \
    "mcp__plugin_bio-research_pubmed__lookup_article_by_citation" \
    "mcp__plugin_bio-research_biorxiv__search_preprints" \
    "Bash(date:*)" "Bash(ls:*)" "Bash(git status:*)" "Bash(git log:*)" "Bash(git diff:*)" \
  --disallowedTools "Bash(git commit:*)" "Bash(git push:*)" "Bash(git reset:*)" "Bash(git checkout:*)" "Bash(rm:*)" \
  > "$LOG" 2>&1
STATUS=$?

if [ $STATUS -eq 0 ]; then
  touch "$REPO/ops/logs/$TODAY.done"
  MSG=$(grep -m1 -i "status" "$LOG" | cut -c1-180)
  osascript -e "display notification \"${MSG//\"/}\" with title \"Evidence Ledger: CEO memo ready\" sound name \"Glass\""
else
  osascript -e "display notification \"Shift failed (exit $STATUS). See ops/logs/$TODAY.log\" with title \"Evidence Ledger\" sound name \"Basso\""
fi
