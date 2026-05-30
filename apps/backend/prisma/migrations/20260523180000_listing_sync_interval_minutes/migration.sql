-- İlan çekme aralığı (dakika) — admin panelinden platform bazlı yönetim
ALTER TABLE "IntegrationPlatformPolicy"
ADD COLUMN "listingSyncIntervalMinutes" INTEGER;

UPDATE "IntegrationPlatformPolicy"
SET "listingSyncIntervalMinutes" = 5
WHERE "category" = 'ECOMMERCE';

UPDATE "IntegrationPlatformPolicy"
SET "listingSyncIntervalMinutes" = 60
WHERE "category" = 'MARKETPLACE';
