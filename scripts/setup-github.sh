#!/usr/bin/env bash
# Senkronize — GitHub private repo + ortak kurulumu
# Kullanım: ./scripts/setup-github.sh
set -euo pipefail

REPO_OWNER="${REPO_OWNER:-mstfkrbyk}"
REPO_NAME="${REPO_NAME:-Senkronize}"
COLLABORATOR="${COLLABORATOR:-kayamuhammedd}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) gerekli. Kurulum: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub oturumu yok. Tek komut:"
  echo "  ./scripts/github-login-once.sh"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

gh auth setup-git

REMOTE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"

if git remote get-url origin >/dev/null 2>&1; then
  echo "origin güncelleniyor: ${REMOTE_URL}"
  git remote set-url origin "${REMOTE_URL}"
else
  if ! gh repo view "${REPO_OWNER}/${REPO_NAME}" >/dev/null 2>&1; then
    echo "Private repo oluşturuluyor: ${REPO_OWNER}/${REPO_NAME}"
    gh repo create "${REPO_NAME}" \
      --private \
      --source=. \
      --remote=origin \
      --description "Senkronize — pazaryeri / ERP entegrasyon SaaS"
  else
    echo "Repo mevcut, origin ekleniyor..."
    git remote add origin "${REMOTE_URL}"
  fi
fi

echo "Ortak davet ediliyor: ${COLLABORATOR}"
gh api \
  -X PUT \
  "repos/${REPO_OWNER}/${REPO_NAME}/collaborators/${COLLABORATOR}" \
  -f permission=push \
  >/dev/null 2>&1 || true

echo "main dalı push ediliyor..."
git push -u origin main

echo ""
echo "Tamamlandı: https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo "Ortak (${COLLABORATOR}) e-posta davetini kabul etmeli."
