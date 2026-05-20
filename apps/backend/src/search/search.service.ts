import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { SearchResults } from './search.types';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(
    orgId: string,
    query: string,
    limit = 10,
  ): Promise<SearchResults> {
    if (!query || query.length < 2) {
      return { products: [], orders: [], listings: [] };
    }

    const listingLimit = Math.min(limit, 5);

    const [products, orders, listings] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { barcode: { contains: query } },
            { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          barcode: true,
          sku: true,
          imageUrls: true,
        },
      }),
      this.prisma.order.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            {
              platformOrderId: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              customerName: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        },
        take: limit,
        select: {
          id: true,
          platformOrderId: true,
          customerName: true,
          totalAmount: true,
          platform: true,
        },
      }),
      this.prisma.listing.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            {
              barcode: { contains: query, mode: Prisma.QueryMode.insensitive },
            },
            { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
            {
              platformProductId: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        },
        take: listingLimit,
        select: {
          id: true,
          barcode: true,
          title: true,
          platform: true,
        },
      }),
    ]);

    return { products, orders, listings };
  }
}
