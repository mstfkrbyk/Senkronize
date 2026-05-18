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
