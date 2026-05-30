# Senkronize

Tüm pazaryerlerinizi tek yerden yönetin — Trendyol, Hepsiburada, T-Soft, Ticimax ve ERP entegrasyonları ile gerçek zamanlı stok, fiyat ve sipariş senkronizasyonu.

## Teknoloji Yığını

- **Backend:** NestJS 11, TypeScript, Prisma 6, PostgreSQL 16, Redis, BullMQ
- **Panel:** React 19, Vite 7, shadcn/ui, TanStack Query, Zustand
- **Marketing:** Next.js 15
- **Desktop:** Tauri 2 (Rust + React)
- **Monorepo:** pnpm workspaces

## Hızlı Başlangıç

### Gereksinimler
- Node.js 22+
- pnpm 9+
- Docker & Docker Compose

### Kurulum

```bash
# Bağımlılıkları yükle
pnpm install

# Ortam değişkenlerini ayarla
cp .env.example .env
# .env dosyasını düzenle

# Veritabanı ve Redis'i başlat
docker compose up -d

# Shared paketi derle
pnpm --filter @senkronize/shared build

# Migrasyon uygula
pnpm db:migrate

# Geliştirme sunucularını başlat
pnpm dev
```

### Kullanışlı Komutlar

| Komut | Açıklama |
|-------|----------|
| `pnpm dev` | Backend + Panel geliştirme sunucuları |
| `pnpm build` | Tüm paketleri derle |
| `pnpm type-check` | TypeScript tip kontrolü |
| `pnpm lint` | ESLint kontrolü |
| `pnpm test` | Backend testleri |
| `pnpm db:migrate` | Prisma migrasyon uygula |
| `pnpm db:studio` | Prisma Studio aç |

## Demo Hesapları (geliştirme)

Yalnızca local/dev ortamı için. Üretimde kullanmayın. Kaynak: `apps/backend/prisma/seed.ts`.

### Seed

Örnek org'lar, ürünler, siparişler ve muhasebe verileri yüklemek için:

```bash
cd apps/backend && SEED_DEMO=true pnpm seed
```

`demo-external-erp` için Paraşüt stub bağlantısı seed sırasında oluşturulur; `.env` içinde geçerli bir `ENCRYPTION_KEY` tanımlı olmalıdır. Tanımlı değilse hesaba giriş yapılabilir, ERP bağlantısını panelden manuel eklemeniz gerekir.

Panel giriş sayfasında hızlı demo hesap butonları için kök `.env` veya `apps/panel/.env` dosyasına `VITE_DEMO_MODE=true` ekleyin ve paneli yeniden başlatın.

### Giriş tablosu

| Org slug | productLines | accountingMode | Giriş e-postası | Şifre (dev) |
|----------|--------------|----------------|-----------------|-------------|
| demo-partner | BUNDLE | — | partner@partner.com | Partner2026! |
| demo-partner-musteri | BUNDLE | NATIVE | demo-partner-musteri@senkronize.com | demo123456 |
| demo-partner-musteri-2 | INTEGRATION | — | demo-magaza2@senkronize.com | demo123456 |
| demo-muhasebe | ACCOUNTING | NATIVE | demo-muhasebe@senkronize.com | demo123456 |
| demo-entegrasyon | INTEGRATION | — | demo-entegrasyon@senkronize.com | demo123456 |
| demo-paket | BUNDLE | NATIVE | demo-paket@senkronize.com | demo123456 |
| demo-external-erp | BUNDLE | EXTERNAL_ERP | demo-external-erp@senkronize.com | demo123456 |

**productLines:** `INTEGRATION` · `ACCOUNTING` · `BUNDLE` (entegrasyon + muhasebe)  
**accountingMode:** `NATIVE` (yerel muhasebe) · `EXTERNAL_ERP` · `—` (muhasebe hattı yok)

`SEED_DEMO=true` iken örnek veri:

- `demo-entegrasyon` — 30 sipariş (ENT önek)
- `demo-paket` — 12 sipariş (PKG önek)
- `demo-external-erp` — 12 sipariş (HEX önek); yerel fatura yok (harici ERP)
- `demo-muhasebe` / `demo-paket` / `demo-partner-musteri` — muhasebe (fatura, cari)
- `demo-partner-musteri` — entegrasyon + muhasebe
- `demo-partner-musteri-2` — hafif entegrasyon

Ayrı demo Docker yığını için: `make demo-up` / `scripts/setup-demo.sh` (`demo@senkronize.com` / `Demo2024!` — `seed-demo.ts`).

## Mimari

```
apps/
├── backend/     # NestJS API (port 3001)
├── panel/       # React SPA (port 5173)
├── marketing/   # Next.js marketing sitesi (port 3000)
desktop/         # Tauri masaüstü uygulaması
packages/
└── shared/      # Paylaşılan tipler ve arayüzler
```

### API Endpoint'leri

| Bölüm | Base URL |
|-------|----------|
| REST API | `http://localhost:3001/api/v1` |
| Swagger | `http://localhost:3001/api/docs` |
| Health | `http://localhost:3001/health` |
| WebSocket | `ws://localhost:3001` |

### Ortam Değişkenleri

Tüm gerekli değişkenler için `.env.example` dosyasına bakın.

## Geliştirme Notları

- `organizationId` her zaman JWT'den alınır, request body/params'tan asla
- Tüm dış API çağrıları BullMQ kuyrukları üzerinden yapılır
- Credentials AES-256-GCM ile şifreli olarak saklanır
- WebSocket odaları `org:{organizationId}` formatında
