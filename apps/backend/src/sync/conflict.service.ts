import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ConflictResolution,
  ConflictType,
  type Marketplace,
  type Prisma,
  type SyncConflict,
} from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';
import { StockMovementService } from '../stock/stock-movement.service';

import type { AutoResolveResult, ConflictStats } from './sync.types';

const STOCK_MISMATCH_THRESHOLD = 0.1;

interface StockValuePayload {
  quantity: number;
  barcode: string;
}

interface PriceValuePayload {
  salePrice: number;
  listPrice: number;
  barcode: string;
}

function isStockPayload(value: unknown): value is StockValuePayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.quantity === 'number' &&
    Number.isFinite(o.quantity) &&
    typeof o.barcode === 'string'
  );
}

function isPricePayload(value: unknown): value is PriceValuePayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.salePrice === 'number' &&
    typeof o.listPrice === 'number' &&
    typeof o.barcode === 'string'
  );
}

function stockDiffRatio(local: number, remote: number): number {
  const base = Math.max(local, remote, 1);
  return Math.abs(local - remote) / base;
}

@Injectable()
export class ConflictService {
  private readonly logger = new Logger(ConflictService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly marketplacePushQueue: Queue<MarketplacePushJobData>,
  ) {}

  async listConflicts(
    organizationId: string,
    filters: {
      entityType?: string;
      conflictType?: ConflictType;
      status?: string;
    },
  ): Promise<SyncConflict[]> {
    const where: Prisma.SyncConflictWhereInput = {
      organizationId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.conflictType ? { conflictType: filters.conflictType } : {}),
      ...(filters.status === 'pending' ? { resolution: null } : {}),
      ...(filters.status === 'resolved'
        ? {
            resolution: {
              in: [
                ConflictResolution.USE_LOCAL,
                ConflictResolution.USE_REMOTE,
                ConflictResolution.MANUAL,
              ],
            },
          }
        : {}),
      ...(filters.status === 'ignored'
        ? { resolution: ConflictResolution.IGNORED }
        : {}),
    };
    return this.prisma.syncConflict.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(organizationId: string): Promise<ConflictStats> {
    const rows = await this.prisma.syncConflict.groupBy({
      by: ['conflictType', 'resolution'],
      where: { organizationId },
      _count: { _all: true },
    });

    const byType: ConflictStats['byType'] = {
      STOCK_MISMATCH: 0,
      PRICE_MISMATCH: 0,
      STATUS_MISMATCH: 0,
      PRODUCT_NOT_FOUND: 0,
      DUPLICATE_ORDER: 0,
    };

    let pending = 0;
    let resolved = 0;
    let ignored = 0;

    for (const row of rows) {
      byType[row.conflictType] += row._count._all;
      if (row.resolution === null) {
        pending += row._count._all;
      } else if (row.resolution === ConflictResolution.IGNORED) {
        ignored += row._count._all;
      } else {
        resolved += row._count._all;
      }
    }

    return { pending, resolved, ignored, byType };
  }

  async detectStockConflicts(organizationId: string): Promise<SyncConflict[]> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    });
    if (connections.length === 0) {
      return [];
    }

    const platformSet = new Set(connections.map((c) => c.platform));
    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId,
        deletedAt: null,
        platform: { in: [...platformSet] },
      },
    });

    const stockRows = await this.prisma.stockEntry.findMany({
      where: { organizationId, barcode: { in: listings.map((l) => l.barcode) } },
    });

    const localByBarcodePlatform = new Map<string, number>();
    const centralByBarcode = new Map<string, number>();

    for (const row of stockRows) {
      if (row.platform === null) {
        centralByBarcode.set(
          row.barcode,
          (centralByBarcode.get(row.barcode) ?? 0) +
            Math.max(0, row.quantity - row.reservedQty),
        );
      } else {
        const key = `${row.barcode}:${row.platform}`;
        localByBarcodePlatform.set(
          key,
          (localByBarcodePlatform.get(key) ?? 0) +
            Math.max(0, row.quantity - row.reservedQty),
        );
      }
    }

    const created: SyncConflict[] = [];

    for (const listing of listings) {
      const key = `${listing.barcode}:${listing.platform}`;
      const localQty =
        localByBarcodePlatform.get(key) ??
        centralByBarcode.get(listing.barcode) ??
        0;
      const remoteQty = listing.quantity;

      if (stockDiffRatio(localQty, remoteQty) <= STOCK_MISMATCH_THRESHOLD) {
        continue;
      }

      const existing = await this.prisma.syncConflict.findFirst({
        where: {
          organizationId,
          platform: listing.platform,
          entityType: 'stock',
          entityId: listing.barcode,
          conflictType: ConflictType.STOCK_MISMATCH,
          resolution: null,
        },
      });
      if (existing) {
        continue;
      }

      const conflict = await this.prisma.syncConflict.create({
        data: {
          organizationId,
          platform: listing.platform,
          entityType: 'stock',
          entityId: listing.barcode,
          conflictType: ConflictType.STOCK_MISMATCH,
          localValue: { barcode: listing.barcode, quantity: localQty },
          remoteValue: { barcode: listing.barcode, quantity: remoteQty },
        },
      });
      created.push(conflict);
    }

    this.logger.log('Stok çakışma taraması tamamlandı', {
      organizationId,
      created: created.length,
    });

    return created;
  }

  async resolveConflict(
    organizationId: string,
    conflictId: string,
    resolution: ConflictResolution,
    userId: string,
    notes?: string,
  ): Promise<void> {
    const conflict = await this.findConflict(conflictId, organizationId);

    if (conflict.resolution !== null) {
      throw new BadRequestException('Bu çakışma zaten çözülmüş.');
    }

    if (resolution === ConflictResolution.USE_REMOTE) {
      await this.applyRemoteValue(conflict);
    } else if (resolution === ConflictResolution.USE_LOCAL) {
      await this.pushLocalValue(conflict);
    }

    await this.markResolved(conflictId, resolution, userId, notes);
  }

  async autoResolve(organizationId: string): Promise<AutoResolveResult> {
    const pending = await this.prisma.syncConflict.findMany({
      where: { organizationId, resolution: null },
      orderBy: { createdAt: 'asc' },
    });

    const result: AutoResolveResult = {
      resolved: 0,
      ignored: 0,
      failed: 0,
      details: [],
    };

    for (const conflict of pending) {
      let resolution: ConflictResolution | null = null;

      switch (conflict.conflictType) {
        case ConflictType.STOCK_MISMATCH:
        case ConflictType.PRICE_MISMATCH:
          resolution = ConflictResolution.USE_LOCAL;
          break;
        case ConflictType.DUPLICATE_ORDER:
          resolution = ConflictResolution.IGNORED;
          break;
        default:
          break;
      }

      if (!resolution) {
        continue;
      }

      try {
        await this.resolveConflict(
          organizationId,
          conflict.id,
          resolution,
          'system',
          'Otomatik çözüm politikası',
        );
        result.details.push({ conflictId: conflict.id, resolution });
        if (resolution === ConflictResolution.IGNORED) {
          result.ignored += 1;
        } else {
          result.resolved += 1;
        }
      } catch (error) {
        result.failed += 1;
        this.logger.error('Otomatik çakışma çözümü başarısız', {
          conflictId: conflict.id,
          error,
        });
      }
    }

    return result;
  }

  private async findConflict(
    conflictId: string,
    organizationId: string,
  ): Promise<SyncConflict> {
    const conflict = await this.prisma.syncConflict.findFirst({
      where: { id: conflictId, organizationId },
    });
    if (!conflict) {
      throw new NotFoundException('Çakışma kaydı bulunamadı.');
    }
    return conflict;
  }

  private async applyRemoteValue(conflict: SyncConflict): Promise<void> {
    if (conflict.conflictType === ConflictType.STOCK_MISMATCH) {
      if (!isStockPayload(conflict.remoteValue)) {
        throw new BadRequestException('Geçersiz uzak stok verisi.');
      }
      await this.stockMovementService.adjustStock(
        conflict.organizationId,
        conflict.remoteValue.barcode,
        conflict.remoteValue.quantity,
        'Çakışma çözümü: platform stoku uygulandı',
      );
      await this.prisma.listing.updateMany({
        where: {
          organizationId: conflict.organizationId,
          platform: conflict.platform,
          barcode: conflict.entityId,
          deletedAt: null,
        },
        data: { quantity: conflict.remoteValue.quantity },
      });
      return;
    }

    if (conflict.conflictType === ConflictType.PRICE_MISMATCH) {
      if (!isPricePayload(conflict.remoteValue)) {
        throw new BadRequestException('Geçersiz uzak fiyat verisi.');
      }
      await this.prisma.listing.updateMany({
        where: {
          organizationId: conflict.organizationId,
          platform: conflict.platform,
          barcode: conflict.entityId,
          deletedAt: null,
        },
        data: {
          salePrice: conflict.remoteValue.salePrice,
          listPrice: conflict.remoteValue.listPrice,
        },
      });
    }
  }

  private async pushLocalValue(conflict: SyncConflict): Promise<void> {
    if (conflict.conflictType === ConflictType.STOCK_MISMATCH) {
      if (!isStockPayload(conflict.localValue)) {
        throw new BadRequestException('Geçersiz yerel stok verisi.');
      }
      await this.marketplacePushQueue.add(
        'push-stock',
        {
          organizationId: conflict.organizationId,
          platform: conflict.platform,
          type: 'stock',
          resourceIds: [conflict.entityId],
          payload: {
            updates: [
              {
                barcode: conflict.localValue.barcode,
                quantity: conflict.localValue.quantity,
              },
            ],
          },
        },
        JOB_DEFAULT_OPTIONS,
      );
      return;
    }

    if (conflict.conflictType === ConflictType.PRICE_MISMATCH) {
      if (!isPricePayload(conflict.localValue)) {
        throw new BadRequestException('Geçersiz yerel fiyat verisi.');
      }
      await this.marketplacePushQueue.add(
        'push-price',
        {
          organizationId: conflict.organizationId,
          platform: conflict.platform,
          type: 'price',
          resourceIds: [conflict.entityId],
          payload: {
            salePrice: conflict.localValue.salePrice,
            listPrice: conflict.localValue.listPrice,
          },
        },
        JOB_DEFAULT_OPTIONS,
      );
    }
  }

  private async markResolved(
    conflictId: string,
    resolution: ConflictResolution,
    userId: string,
    notes?: string,
  ): Promise<void> {
    await this.prisma.syncConflict.update({
      where: { id: conflictId },
      data: {
        resolution,
        resolvedAt: new Date(),
        resolvedBy: userId,
        ...(notes ? { notes } : {}),
      },
    });
  }
}
