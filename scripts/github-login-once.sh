#!/usr/bin/env bash
# Tek seferlik GitHub girişi — tarayıcıda cihaz kodu + workflow izni (CI dosyaları için).
# Kullanım: ./scripts/github-login-once.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GH_SCOPES="repo,workflow,read:org,gist"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh gerekli: brew install gh"
  exit 1
fi

if gh auth status >/dev/null 2>&1; then
  echo "GitHub oturumu var; workflow izni kontrol ediliyor..."
  gh auth refresh -h github.com -s "${GH_SCOPES}" || true
else
  echo "Tarayıcı açılacak — https://github.com/login/device adresine kodu yapıştırın."
  gh auth login -h github.com -p https -w -s "${GH_SCOPES}"
fi

gh auth setup-git
exec "${ROOT}/scripts/setup-github.sh"
