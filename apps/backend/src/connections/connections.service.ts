import { Injectable } from '@nestjs/common';
import { SyncFrequency } from '@prisma/client';

import { ECOMMERCE_MARKETPLACE_PLATFORMS } from '../marketplace-connection/ecommerce-platforms';
import { PrismaService } from '../prisma/prisma.service';

import type {
  UnifiedConnectionItem,
  UnifiedConnectionStatus,
  UnifiedConnectionType,
} from './connections.types';

const ECOMMERCE_SET = new Set<string>(ECOMMERCE_MARKETPLACE_PLATFORMS);

function deriveListStatus(
  isActive: boolean,
  syncErrorCount: number,
  lastSyncAt: Date | null,
): UnifiedConnectionStatus {
  if (!isActive) {
    return 'inactive';
  }
  if (syncErrorCount >= 5) {
    return 'error';
  }
  if (syncErrorCount >= 3) {
    return 'warning';
  }
  if (lastSyncAt) {
    const staleMs = Date.now() - lastSyncAt.getTime();
    if (staleMs > 2 * 60 * 60 * 1000) {
      return 'error';
    }
    if (staleMs > 24 * 60 * 60 * 1000) {
      return 'warning';
    }
    return 'healthy';
  }
  return 'unknown';
}

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(organizationId: string): Promise<UnifiedConnectionItem[]> {
    const [marketplaces, erps, cargo, ecommerce] = await Promise.all([
      this.prisma.marketplaceConnection.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { platform: 'asc' },
      }),
      this.prisma.erpConnection.findMany({
        where: { organizationId, deletedAt: null },
        include: { syncSettings: true },
        orderBy: { erpType: 'asc' },
      }),
      this.prisma.cargoConnection.findMany({
        where: { organizationId },
        orderBy: { provider: 'asc' },
      }),
      this.prisma.ecommerceConnection.findMany({
        where: { organizationId },
        orderBy: { platform: 'asc' },
      }),
    ]);

    const items: UnifiedConnectionItem[] = [];

    for (const c of marketplaces) {
      const isEcommerce = ECOMMERCE_SET.has(c.platform);
      items.push({
        id: c.id,
        type: isEcommerce ? 'ECOMMERCE' : 'MARKETPLACE',
        platform: c.platform,
        name: c.platform,
        status: deriveListStatus(c.isActive, c.syncErrorCount, c.lastSyncAt),
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        syncFrequency: null,
      });
    }

    for (const c of erps) {
      items.push({
        id: c.id,
        type: 'ERP',
        platform: c.erpType,
        name: c.erpType,
        status: deriveListStatus(c.isActive, c.syncErrorCount, c.lastSyncAt),
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        syncFrequency: c.syncSettings?.syncFrequency ?? SyncFrequency.HOURLY,
      });
    }

    for (const c of cargo) {
      items.push({
        id: c.id,
        type: 'CARGO',
        platform: c.provider,
        name: c.provider,
        status: deriveListStatus(c.isActive, 0, c.lastSyncAt),
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        syncFrequency: null,
      });
    }

    for (const c of ecommerce) {
      items.push({
        id: c.id,
        type: 'ECOMMERCE',
        platform: c.platform,
        name: c.platform,
        status: deriveListStatus(c.isActive, 0, c.lastSyncAt),
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        syncFrequency: null,
      });
    }

    return items.sort((a, b) => {
      const typeOrder = a.type.localeCompare(b.type);
      if (typeOrder !== 0) {
        return typeOrder;
      }
      return a.platform.localeCompare(b.platform);
    });
  }
}
