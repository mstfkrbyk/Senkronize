import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Marketplace, StockMovementType } from '@prisma/client';
import type { Job } from 'bull';
import type { PriceUpdatePayload, StockUpdatePayload } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';
import { StockMovementService } from '../stock/stock-movement.service';
import { SyncStatusService } from '../sync-status/sync-status.service';
import { WarehouseService } from '../warehouse/warehouse.service';

function isStockUpdateRow(
  value: unknown,
): value is { barcode: string; quantity: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.barcode === 'string' &&
    o.barcode.length > 0 &&
    typeof o.quantity === 'number' &&
    Number.isFinite(o.quantity) &&
    o.quantity >= 0
  );
}

function parseStockUpdatesFromPayload(
  job: Job<MarketplacePushJobData>,
): StockUpdatePayload[] {
  const raw = job.data.payload?.updates;
  if (Array.isArray(raw)) {
    const out: StockUpdatePayload[] = [];
    for (const item of raw) {
      if (isStockUpdateRow(item)) {
        out.push({ barcode: item.barcode, quantity: item.quantity });
      }
    }
    if (out.length > 0) {
      return out;
    }
  }
  const qty = job.data.payload?.quantity;
  const quantity =
    typeof qty === 'number' && Number.isFinite(qty) && qty >= 0 ? qty : 0;
  return job.data.resourceIds.map((barcode) => ({ barcode, quantity }));
}

function parsePriceUpdatesFromPayload(
  job: Job<MarketplacePushJobData>,
): PriceUpdatePayload[] {
  const single = job.data.payload?.price;
  if (
    typeof single === 'number' &&
    Number.isFinite(single) &&
    single > 0
  ) {
    return job.data.resourceIds.map((barcode) => ({
      barcode,
      salePrice: single,
      listPrice: single,
    }));
  }
  const sale = job.data.payload?.salePrice;
  const list = job.data.payload?.listPrice;
  if (
    typeof sale !== 'number' ||
    typeof list !== 'number' ||
    !Number.isFinite(sale) ||
    !Number.isFinite(list) ||
    sale <= 0 ||
    list <= 0
  ) {
    return [];
  }
  return job.data.resourceIds.map((barcode) => ({
    barcode,
    salePrice: sale,
    listPrice: list,
  }));
}

@Processor(QUEUE_MARKETPLACE_PUSH)
export class MarketplacePushProcessor {
  private readonly logger = new Logger(MarketplacePushProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly marketplaceConnectionService: MarketplaceConnectionService,
    private readonly prisma: PrismaService,
    private readonly syncStatusService: SyncStatusService,
    private readonly eventService: EventService,
    private readonly warehouseService: WarehouseService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  @Process('push-stock')
  async handlePushStock(job: Job<MarketplacePushJobData>): Promise<void> {
    const { organizationId, platform } = job.data;
    this.logger.log('Pazaryeri stok gönderimi başladı', {
      organizationId,
      platform,
    });
    try {
      const credentials =
        await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
          organizationId,
          platform as Marketplace,
        );
      if (!credentials) {
        this.logger.warn('Aktif pazaryeri bağlantısı bulunamadı', {
          organizationId,
          platform,
        });
        return;
      }
      const adapter = this.adapterRegistry.get(platform);
      const updates = parseStockUpdatesFromPayload(job);
      if (updates.length === 0) {
        this.logger.warn('Stok güncellemesi boş', { organizationId, platform });
        return;
      }
      await adapter.updateStock(credentials, updates);
      const mainWh = await this.warehouseService.getOrCreateMainWarehouse(
        organizationId,
      );
      for (const u of updates) {
        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.stockEntry.findUnique({
            where: {
              organizationId_barcode_platform_warehouseId: {
                organizationId,
                barcode: u.barcode,
                platform: platform as Marketplace,
                warehouseId: mainWh.id,
              },
            },
          });
          const before = existing?.quantity ?? 0;
          await tx.stockEntry.upsert({
            where: {
              organizationId_barcode_platform_warehouseId: {
                organizationId,
                barcode: u.barcode,
                platform: platform as Marketplace,
                warehouseId: mainWh.id,
              },
            },
            create: {
              organizationId,
              warehouseId: mainWh.id,
              barcode: u.barcode,
              platform: platform as Marketplace,
              quantity: u.quantity,
            },
            update: { quantity: u.quantity },
          });
          const after = u.quantity;
          if (before !== after) {
            await this.stockMovementService.record({
              organizationId,
              barcode: u.barcode,
              warehouseId: mainWh.id,
              platform: String(platform),
              movementType: StockMovementType.SYNC,
              quantity: after - before,
              beforeQuantity: before,
              afterQuantity: after,
              note: 'Pazaryeri stok senkronu',
              tx,
            });
          }
        });
      }
      await this.syncStatusService.recordSuccess(
        organizationId,
        platform as Marketplace,
      );
      this.eventService.emit(organizationId, WS_EVENTS.LISTING_SYNCED, {
        barcode: job.data.resourceIds,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Pazaryeri stok gönderim hatası', {
        organizationId,
        platform,
        error: message,
      });
      await this.syncStatusService.recordError(
        organizationId,
        platform as Marketplace,
        message,
      );
      throw error;
    }
  }

  @Process('push-price')
  async handlePushPrice(
    job: Job<MarketplacePushJobData & { payload?: Record<string, unknown> }>,
  ): Promise<void> {
    const { organizationId, platform } = job.data;
    this.logger.log('Pazaryeri fiyat gönderimi başladı', {
      organizationId,
      platform,
    });
    try {
      const credentials =
        await this.marketplaceConnectionService.getDecryptedCredentialsForJob(
          organizationId,
          platform as Marketplace,
        );
      if (!credentials) {
        this.logger.warn('Aktif pazaryeri bağlantısı bulunamadı', {
          organizationId,
          platform,
        });
        return;
      }
      const adapter = this.adapterRegistry.get(platform);
      const updates = parsePriceUpdatesFromPayload(job);
      if (updates.length === 0) {
        this.logger.warn('Fiyat güncellemesi boş', { organizationId, platform });
        return;
      }
      await adapter.updatePrice(credentials, updates);
      await this.syncStatusService.recordSuccess(
        organizationId,
        platform as Marketplace,
      );
      this.eventService.emit(organizationId, WS_EVENTS.PRICE_UPDATED, {
        barcode: job.data.resourceIds,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Pazaryeri fiyat gönderim hatası', {
        organizationId,
        platform,
        error: message,
      });
      await this.syncStatusService.recordError(
        organizationId,
        platform as Marketplace,
        message,
      );
      throw error;
    }
  }
}
