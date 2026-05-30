# Ortak geliştirme

İki kişilik akış: **feature branch → Pull Request → `main`**

## Günlük akış

```bash
git checkout main
git pull origin main
git checkout -b feature/kisa-aciklama
# ... değişiklikler ...
git add -A && git commit -m "feat: ..."
git push -u origin feature/kisa-aciklama
gh pr create --fill
```

PR birleştirildikten sonra diğer geliştirici `main`'i çeker.

## Kurallar

- `.env` asla commit edilmez (sadece `.env.example`).
- Her iş ayrı branch; doğrudan `main`'e push yok (branch protection açıldığında).
- Migration: `schema.prisma` değişince migration dosyası zorunlu.
- Tenant güvenliği: tüm sorgularda `organizationId` JWT'den gelir.

## İlk kurulum (yeni makine)

```bash
git clone git@github.com:mstfkrbyk/Senkronize.git
cd Senkronize
pnpm install
cp .env.example .env   # değerleri doldur
pnpm --filter backend prisma migrate deploy
```
