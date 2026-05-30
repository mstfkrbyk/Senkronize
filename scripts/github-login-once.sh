#!/usr/bin/env bash
# Tek seferlik GitHub girişi — yalnızca tarayıcıda cihaz kodu gerekir.
# Kullanım: ./scripts/github-login-once.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh gerekli: brew install gh"
  exit 1
fi

if gh auth status >/dev/null 2>&1; then
  echo "Zaten giriş yapılmış."
else
  echo "Tarayıcı açılacak — github.com/login/device sayfasına kodu yapıştırın."
  gh auth login -h github.com -p https -w
fi

gh auth setup-git

exec "${ROOT}/scripts/setup-github.sh"
