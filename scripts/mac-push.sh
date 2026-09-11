#!/usr/bin/env bash
set -euo pipefail
# Run on Mac after sources are present at REPO_DIR
REPO_DIR="${1:-$HOME/Projects/office-attendance-pwa}"
mkdir -p "$(dirname "$REPO_DIR")"
if [[ ! -d "$REPO_DIR/.git" ]]; then
  gh repo clone asadtariq96/office-attendance-pwa "$REPO_DIR"
fi
cd "$REPO_DIR"
npm install
npm run build
git checkout main
git add -A
git status
git commit -m "$(cat <<'MSG'
feat: add Office Attendance PWA

Mobile-first Vite + React + TypeScript PWA with 60% office-day tracking,
even-spread suggestions, localStorage persistence, and offline support.
MSG
)" || true
git push -u origin main
git rev-parse HEAD
