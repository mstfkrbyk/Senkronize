#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "🚀 Senkronize Demo Ortamı Kuruluyor..."

docker compose -f docker-compose.demo.yml up -d demo-db demo-redis

echo "Veritabanı hazır olana kadar bekleniyor..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.demo.yml exec -T demo-db pg_isready -U senkronize -d senkronize_demo >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

DATABASE_URL="postgresql://senkronize:demo_password_2024@localhost:5433/senkronize_demo" \
  pnpm --filter backend exec prisma migrate deploy

DATABASE_URL="postgresql://senkronize:demo_password_2024@localhost:5433/senkronize_demo" \
  ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  pnpm --filter backend exec ts-node prisma/seed-demo.ts

echo ""
echo "✅ Demo ortamı hazır!"
echo "Panel: http://localhost:3002  (docker compose -f docker-compose.demo.yml up -d demo-panel)"
echo "API:   http://localhost:3001  (docker compose -f docker-compose.demo.yml up -d demo-backend)"
echo "Demo giriş: demo@senkronize.com / Demo2024!"
