-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "TicketCategory" AS ENUM ('TECHNICAL', 'BILLING', 'INTEGRATION', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: firstResponseAt
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);

-- Migrate category column to enum (idempotent)
DO $$ BEGIN
  ALTER TABLE "SupportTicket"
    ALTER COLUMN "category" TYPE "TicketCategory"
    USING (
      CASE
        WHEN "category" IS NULL THEN NULL
        WHEN "category" IN ('TECHNICAL', 'BILLING', 'INTEGRATION', 'GENERAL') THEN "category"::"TicketCategory"
        ELSE 'GENERAL'::"TicketCategory"
      END
    );
EXCEPTION
  WHEN duplicate_column THEN NULL;
  WHEN others THEN
    IF SQLERRM NOT LIKE '%cannot cast%' AND SQLERRM NOT LIKE '%already exists%' THEN
      RAISE;
    END IF;
END $$;

-- CreateTable HelpArticle (idempotent)
CREATE TABLE IF NOT EXISTS "HelpArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HelpArticle_slug_key" ON "HelpArticle"("slug");
CREATE INDEX IF NOT EXISTS "HelpArticle_category_isPublished_idx" ON "HelpArticle"("category", "isPublished");
