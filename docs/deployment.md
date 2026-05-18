# Senkronize — Deployment Guide

## Gereksinimler

- Docker 24+
- Docker Compose 2.20+
- 2 CPU, 4 GB RAM (minimum)
- PostgreSQL verisi için en az 20 GB disk

## Hızlı başlangıç

1. Repoyu klonlayın:

   ```bash
   git clone https://github.com/yourorg/senkronize.git
   cd senkronize
   ```

2. `.env` dosyasını oluşturun:

   ```bash
   cp .env.example .env
   # Gerekli değerleri doldurun (özellikle güvenlik ve veritabanı)
   ```

3. Üretim stack’ini başlatın:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Veritabanı migration’larını uygulayın (migration’lar konteyner başlatma sırasında otomatik çalışmaz; ayrı çalıştırılmalıdır):

   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
   ```

5. Super admin oluşturun (tek seferlik):

   ```bash
   SEED_SUPER_ADMIN_EMAIL=admin@senkronize.com \
   SEED_SUPER_ADMIN_PASSWORD='güvenliŞifre' \
   docker compose -f docker-compose.prod.yml exec -e SEED_SUPER_ADMIN_EMAIL -e SEED_SUPER_ADMIN_PASSWORD backend npx ts-node prisma/seed.ts
   ```

## Ortam değişkenleri (kritik)

| Değişken | Açıklama |
| --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL şifresi (`docker-compose.prod.yml` içinde zorunlu). |
| `POSTGRES_USER` / `POSTGRES_DB` | İsteğe bağlı; varsayılan `senkronize`. |
| `DATABASE_URL` | `.env` içinde tanımlıysa bile, compose içindeki `DATABASE_URL` servis ağı için üretilen değeri kullanır; üretimde JWT ve uygulama ile tutarlı olmalıdır. |
| `REDIS_URL` | Compose’ta `redis://redis:6379` olarak verilir; `.env` ile çakışmaması için üretim `.env` dosyanızı buna göre ayarlayın. |
| `JWT_SECRET` | Access token imzalama (yeterince uzun, rastgele). |
| `JWT_REFRESH_SECRET` | Refresh token imzalama. |
| `ENCRYPTION_KEY` | Pazaryeri/ERP kimlik bilgisi şifrelemesi (AES-256-GCM; 64 hex karakter). |
| `ALLOWED_ORIGINS` | Panel ve pazarlama sitelerinin kökenleri (CORS), virgülle ayrılmış. |
| `APP_URL` / `NEXT_PUBLIC_API_URL` | Ortak URL’ler; ters vekil ve TLS sonrası `https://` kullanın. |
| `PAYTR_*`, `RESEND_API_KEY`, `NETGSM_*`, `R2_*` | Ödeme, e-posta, SMS ve nesne depolama entegrasyonları. |

Tam liste için `.env.example` dosyasına bakın.

## Nginx ve TLS

- `nginx/nginx.conf` varsayılan olarak HTTP (80) üzerinden `api.senkronize.com`, `app.senkronize.com`, `senkronize.com` sanal sunucularını yönlendirir.
- TLS sertifikaları için `nginx/ssl/` dizinine PEM dosyalarını yerleştirin (ör. `fullchain.pem`, `privkey.pem`) ve `nginx.conf` içinde `listen 443 ssl` bloklarını ekleyin. Depoda yalnızca boş `nginx/ssl/` placeholder’ı vardır; gerçek sertifikalar dağıtım sırasında eklenir.

Certbot ile Let's Encrypt (örnek, tek başına çalışan sunucu):

```bash
certbot certonly --standalone -d senkronize.com -d www.senkronize.com -d api.senkronize.com -d app.senkronize.com
```

## İzleme

- Backend sağlık kontrolü: `GET http://<backend-host>:3001/health` (JSON `status: ok`).
- Compose healthcheck aynı uç noktayı kullanır.

## Notlar

- `pnpm` üretim imajında yoktur; Prisma ve seed için `npx` kullanın.
- Migration’ları uygulamadan API’yi açmayın.
