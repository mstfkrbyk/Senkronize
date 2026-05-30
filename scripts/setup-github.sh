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
  echo "GitHub oturumu yok. Önce giriş yapın:"
  echo "  gh auth login -h github.com -p ssh -w"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if git remote get-url origin >/dev/null 2>&1; then
  echo "origin zaten tanımlı: $(git remote get-url origin)"
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
    git remote add origin "git@github.com:${REPO_OWNER}/${REPO_NAME}.git"
  fi
fi

echo "Ortak davet ediliyor: ${COLLABORATOR}"
gh repo invite-collaborator "${REPO_OWNER}/${REPO_NAME}" "${COLLABORATOR}" --permission push || true

echo "main dalı push ediliyor..."
git push -u origin main

echo ""
echo "Tamamlandı: https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo "Ortak (${COLLABORATOR}) e-posta davetini kabul etmeli."
