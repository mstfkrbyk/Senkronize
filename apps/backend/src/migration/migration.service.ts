import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { MigrationImportResult, MigrationRow } from './migration.types';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importProducts(
    rows: MigrationRow[],
    organizationId: string,
  ): Promise<MigrationImportResult> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (!row.barcode || !row.name) {
          skipped++;
          continue;
        }

        const existing = await this.prisma.product.findFirst({
          where: { organizationId, barcode: row.barcode },
        });

        const qty = row.stock ?? 0;

        await this.prisma.$transaction(async (tx) => {
          let productId: string;

          if (existing) {
            const updateData: Prisma.ProductUpdateInput = {
              name: row.name,
              category: row.category ?? null,
              brand: row.brand ?? null,
              description: row.description ?? null,
              deletedAt: null,
              updatedAt: new Date(),
            };

            if (row.imageUrl && row.imageUrl.length > 0) {
              const urls = existing.imageUrls ?? [];
              if (!urls.includes(row.imageUrl)) {
                updateData.imageUrls = { push: row.imageUrl };
              }
            }

            await tx.product.update({
              where: { id: existing.id },
              data: updateData,
            });
            productId = existing.id;
          } else {
            const created = await tx.product.create({
              data: {
                organizationId,
                barcode: row.barcode,
                name: row.name,
                category: row.category,
                brand: row.brand,
                description: row.description,
                imageUrls: row.imageUrl ? [row.imageUrl] : [],
              },
            });
            productId = created.id;
          }

          const stockRow = await tx.stockEntry.findFirst({
            where: {
              organizationId,
              barcode: row.barcode,
              platform: null,
            },
          });
          if (stockRow) {
            await tx.stockEntry.update({
              where: { id: stockRow.id },
              data: { quantity: qty, productId },
            });
          } else {
            await tx.stockEntry.create({
              data: {
                organizationId,
                barcode: row.barcode,
                platform: null,
                quantity: qty,
                productId,
              },
            });
          }
        });

        if (existing) {
          updated++;
        } else {
          imported++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.warn('Migration satırı işlenemedi', {
          organizationId,
          barcode: row.barcode,
        });
        errors.push(`${row.barcode}: ${message}`);
      }
    }

    return { imported, updated, skipped, errors };
  }

  async getImportHistory(_organizationId: string): Promise<unknown[]> {
    return [];
  }
}
