import { Injectable } from '@nestjs/common';
import type { Marketplace } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { resolveProductMatchKey } from '../organization/organization.types';

import {
  resolveEffectiveProductMatchKey,
  type ProductMatchKey,
} from './product-match-key';

@Injectable()
export class ProductMatchKeyService {
  constructor(private readonly prisma: PrismaService) {}

  resolveEffective(ctx: {
    productMatchKey?: ProductMatchKey | null;
    connectionMatchKey?: ProductMatchKey | null;
    orgMatchKey?: ProductMatchKey | null;
  }): ProductMatchKey | null {
    return resolveEffectiveProductMatchKey(ctx);
  }

  async loadOrgMatchKey(organizationId: string): Promise<ProductMatchKey | null> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { metadata: true },
    });
    return resolveProductMatchKey(org?.metadata);
  }

  async resolveForErpConnection(
    organizationId: string,
    erpConnectionId: string,
    productMatchKey?: ProductMatchKey | null,
  ): Promise<ProductMatchKey | null> {
    const [orgMatchKey, connection] = await Promise.all([
      this.loadOrgMatchKey(organizationId),
      this.prisma.erpConnection.findFirst({
        where: { id: erpConnectionId, organizationId, deletedAt: null },
        select: { productMatchKey: true },
      }),
    ]);
    return this.resolveEffective({
      productMatchKey,
      connectionMatchKey: connection?.productMatchKey ?? null,
      orgMatchKey,
    });
  }

  async resolveForMarketplace(
    organizationId: string,
    platform: Marketplace,
    productMatchKey?: ProductMatchKey | null,
  ): Promise<ProductMatchKey | null> {
    const [orgMatchKey, connection] = await Promise.all([
      this.loadOrgMatchKey(organizationId),
      this.prisma.marketplaceConnection.findFirst({
        where: { organizationId, platform, deletedAt: null },
        select: { productMatchKey: true },
      }),
    ]);
    return this.resolveEffective({
      productMatchKey,
      connectionMatchKey: connection?.productMatchKey ?? null,
      orgMatchKey,
    });
  }

  async loadMarketplaceConnectionKeys(
    organizationId: string,
  ): Promise<Map<Marketplace, ProductMatchKey | null>> {
    const [orgMatchKey, connections] = await Promise.all([
      this.loadOrgMatchKey(organizationId),
      this.prisma.marketplaceConnection.findMany({
        where: { organizationId, deletedAt: null },
        select: { platform: true, productMatchKey: true },
      }),
    ]);
    const map = new Map<Marketplace, ProductMatchKey | null>();
    for (const conn of connections) {
      map.set(
        conn.platform,
        this.resolveEffective({
          connectionMatchKey: conn.productMatchKey,
          orgMatchKey,
        }),
      );
    }
    return map;
  }
}
