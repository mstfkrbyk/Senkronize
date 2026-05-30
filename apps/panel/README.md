# Senkronize Panel

React 19 + Vite 7 SPA. Geliştirme sunucusu varsayılan olarak [http://localhost:5173](http://localhost:5173) üzerinde çalışır.

## Geliştirme

Repo kökünden:

```bash
pnpm install
pnpm --filter @senkronize/shared build
pnpm dev          # backend + panel birlikte
# veya yalnızca panel:
pnpm --filter panel dev
```

API proxy: `VITE_API_URL` (bkz. `.env.example`).

## Denetim kayıtları (süper admin)

| Rota | API | Kapsam |
|------|-----|--------|
| `/audit-logs` (alias `/audit`) | `GET /audit-logs` | Oturumdaki organizasyon (JWT `organizationId`) |
| `/admin/audit-logs` | `GET /admin/activity` | Platform geneli (en fazla 100 kayıt) |
| Organizasyon detayı → Denetim sekmesi | `GET /admin/organizations/:id` (özet) | Seçili kiracı |

Süper admin platform özetindeki “Son aktiviteler” kartı `/admin/audit-logs` sayfasına gider. Kiracı menüsünde “Denetim kayıtları” (`/audit-logs`) yalnızca `DIRECT` org ve ortak menüde görünür; `PARTNER` org kenar çubuğunda bu öğe yoktur.

## Demo giriş (geliştirme)

Backend seed sonrası panelden giriş yapılabilir. Önce demo veriyi yükleyin:

```bash
cd apps/backend && SEED_DEMO=true pnpm seed
```

Giriş sayfasında senaryo kartları için `apps/panel/.env` veya kök `.env` içine ekleyin:

```env
VITE_DEMO_MODE=true
```

Paneli yeniden başlatın. Kartlar `src/lib/demo-login.ts` ile seed tablosuyla eşleşir.

| Org slug | productLines | accountingMode | Giriş e-postası | Şifre (dev) |
|----------|--------------|----------------|-----------------|-------------|
| demo-partner | BUNDLE | — | partner@partner.com | Partner2026! |
| demo-partner-musteri | BUNDLE | NATIVE | demo-partner-musteri@senkronize.com | demo123456 |
| demo-partner-musteri-2 | INTEGRATION | — | demo-magaza2@senkronize.com | demo123456 |
| demo-muhasebe | ACCOUNTING | NATIVE | demo-muhasebe@senkronize.com | demo123456 |
| demo-entegrasyon | INTEGRATION | — | demo-entegrasyon@senkronize.com | demo123456 |
| demo-paket | BUNDLE | NATIVE | demo-paket@senkronize.com | demo123456 |
| demo-external-erp | BUNDLE | EXTERNAL_ERP | demo-external-erp@senkronize.com | demo123456 |

**demo-external-erp:** Tam paket, muhasebe harici ERP (Paraşüt stub). 12 sipariş (HEX önek); yerel fatura yok. Seed sırasında `ENCRYPTION_KEY` varsa ERP bağlantı stub'ı oluşturulur.

Ayrıntılar ve süper admin seed: repo kökü `README.md` ve `.env.example`.
