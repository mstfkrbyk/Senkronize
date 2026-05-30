import { Injectable, NotFoundException } from '@nestjs/common';
import type { Listing, Marketplace } from '@prisma/client';
import type { MarketplaceListing } from '@senkronize/shared';

import {
  buildProductWhereForListingMatch,
  resolveListingMatchIdentifiers,
} from '../common/product-match-key';
import { ProductMatchKeyService } from '../common/product-match-key.service';
import type { ProductMatchKey } from '../common/product-match-key';
import { PrismaService } from '../prisma/prisma.service';

import type { ManualProductMatchDto } from './product-match.dto';
import type {
  MatchResult,
  ProductMatchConflict,
  SimilarProduct,
  UnmatchedListingRow,
} from './product-match.types';

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) {
    return n;
  }
  if (n === 0) {
    return m;
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 0; i <= m; i += 1) {
    dp[i]![0] = i;
  }
  for (let j = 0; j <= n; j += 1) {
    dp[0]![j] = j;
  }
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[m]![n]!;
}

function jaccardTokens(a: string, b: string): number {
  const wa = new Set(normalizeWords(a));
  const wb = new Set(normalizeWords(b));
  if (wa.size === 0 || wb.size === 0) {
    return 0;
  }
  let inter = 0;
  for (const t of wa) {
    if (wb.has(t)) {
      inter += 1;
    }
  }
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function matchKey(platform: Marketplace, barcode: string): string {
  return `${platform}::${barcode}`;
}

@Injectable()
export class ProductMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productMatchKeyService: ProductMatchKeyService,
  ) {}

  async autoMatchByBarcode(organizationId: string): Promise<MatchResult> {
    return this.autoMatchListings(organizationId, undefined, undefined, {
      createMissing: true,
    });
  }

  /** Platform çekimi veya ERP sync sonrası listelemeleri katalog ürünleriyle eşleştirir */
  async autoMatchListings(
    organizationId: string,
    platform?: Marketplace,
    pulledListings?: MarketplaceListing[],
    options?: { createMissing?: boolean },
  ): Promise<MatchResult> {
    const createMissing = options?.createMissing ?? false;
    const platformSkuByProductId = new Map<string, string>();
    if (pulledListings) {
      for (const row of pulledListings) {
        const sku = row.platformSku?.trim();
        if (sku && sku.length > 0) {
          platformSkuByProductId.set(row.platformProductId, sku);
        }
      }
    }

    const platformKeys =
      await this.productMatchKeyService.loadMarketplaceConnectionKeys(organizationId);
    const orgKey = await this.productMatchKeyService.loadOrgMatchKey(organizationId);
    if (orgKey === null) {
      return {
        listingsProcessed: 0,
        listingsLinked: 0,
        newProductsCreated: 0,
        newMatchesCreated: 0,
        alreadyInSync: 0,
      };
    }

    const listings = await this.prisma.listing.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(platform ? { platform } : {}),
      },
    });

    let listingsLinked = 0;
    let newProductsCreated = 0;
    let newMatchesCreated = 0;
    let alreadyInSync = 0;

    for (const listing of listings) {
      const matchKey =
        platformKeys.get(listing.platform) ??
        orgKey;
      if (matchKey === null) {
        continue;
      }
      const platformSku = platformSkuByProductId.get(listing.platformProductId);
      const r = await this.ensureListingMatchedTx(
        organizationId,
        listing,
        matchKey,
        platformSku,
        createMissing,
      );
      if (r === 'linked') {
        listingsLinked += 1;
        newMatchesCreated += 1;
      } else if (r === 'created') {
        listingsLinked += 1;
        newMatchesCreated += 1;
        newProductsCreated += 1;
      } else if (r === 'linked_existing_match') {
        listingsLinked += 1;
      } else if (r === 'synced') {
        alreadyInSync += 1;
      }
    }

    return {
      listingsProcessed: listings.length,
      listingsLinked,
      newProductsCreated,
      newMatchesCreated,
      alreadyInSync,
    };
  }

  /** Tek listeleme için eşleme (transaction) */
  private async ensureListingMatchedTx(
    organizationId: string,
    listing: Listing,
    matchKey: ProductMatchKey,
    platformSku?: string,
    createMissing = false,
  ): Promise<'noop' | 'synced' | 'linked' | 'created' | 'linked_existing_match'> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMatch.findFirst({
        where: {
          organizationId,
          platform: listing.platform,
          platformBarcode: listing.barcode,
          deletedAt: null,
        },
      });

      if (existing) {
        if (listing.productId === existing.masterProductId) {
          return 'synced';
        }
        await tx.listing.update({
          where: { id: listing.id, organizationId },
          data: { productId: existing.masterProductId },
        });
        return 'linked_existing_match';
      }

      if (matchKey === 'MANUAL') {
        return 'noop';
      }

      const identifiers = resolveListingMatchIdentifiers(listing, platformSku);
      const productWhere = buildProductWhereForListingMatch(
        organizationId,
        matchKey,
        identifiers,
      );
      const product = productWhere
        ? await tx.product.findFirst({ where: productWhere })
        : null;

      const matchedSku =
        matchKey === 'SKU'
          ? (platformSku?.trim() || identifiers.sku || listing.barcode)
          : null;

      if (product) {
        await tx.productMatch.create({
          data: {
            organizationId,
            masterProductId: product.id,
            platformBarcode: listing.barcode,
            platform: listing.platform,
            platformSku: matchedSku,
            confidence: 1,
            isConfirmed: false,
          },
        });
        await tx.listing.update({
          where: { id: listing.id, organizationId },
          data: { productId: product.id },
        });
        return 'linked';
      }

      if (!createMissing) {
        return 'noop';
      }

      const newProductSku =
        matchKey === 'SKU' ? matchedSku : null;
      const newProduct = await tx.product.create({
        data: {
          organizationId,
          barcode: matchKey === 'SKU' ? null : listing.barcode,
          name: listing.title,
          sku: newProductSku,
          imageUrls: listing.imageUrls,
          isActive: true,
        },
      });

      await tx.productMatch.create({
        data: {
          organizationId,
          masterProductId: newProduct.id,
          platformBarcode: listing.barcode,
          platform: listing.platform,
          platformSku: matchedSku,
          confidence: 1,
          isConfirmed: false,
        },
      });

      await tx.listing.update({
        where: { id: listing.id, organizationId },
        data: { productId: newProduct.id },
      });

      return 'created';
    });
  }

  async findSimilarProducts(
    organizationId: string,
    listing: Listing,
  ): Promise<SimilarProduct[]> {
    const products = await this.prisma.product.findMany({
      where: { organizationId, deletedAt: null },
      take: 800,
      select: { id: true, name: true, barcode: true, sku: true },
    });

    const scored: SimilarProduct[] = [];
    const title = listing.title;
    const normTitle = title.toLowerCase();

    for (const p of products) {
      const jac = jaccardTokens(title, p.name);
      const maxLen = Math.max(p.name.length, title.length);
      const lev =
        maxLen === 0 ? 1 : 1 - levenshtein(p.name.toLowerCase(), normTitle) / maxLen;
      const confidence = Math.min(1, jac * 0.75 + lev * 0.25);
      if (confidence >= 0.18) {
        scored.push({
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          sku: p.sku,
          confidence: Math.round(confidence * 1000) / 1000,
        });
      }
    }

    scored.sort((a, b) => b.confidence - a.confidence);
    return scored.slice(0, 25);
  }

  async findSimilarProductsByListingId(
    organizationId: string,
    listingId: string,
  ): Promise<SimilarProduct[]> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }
    return this.findSimilarProducts(organizationId, listing);
  }

  async confirmMatch(organizationId: string, matchId: string): Promise<void> {
    const match = await this.prisma.productMatch.findFirst({
      where: { id: matchId, organizationId, deletedAt: null },
    });
    if (!match) {
      throw new NotFoundException('Eşleşme kaydı bulunamadı');
    }

    await this.prisma.$transaction([
      this.prisma.productMatch.update({
        where: { id: matchId },
        data: { isConfirmed: true, confidence: 1 },
      }),
      this.prisma.listing.updateMany({
        where: {
          organizationId,
          deletedAt: null,
          barcode: match.platformBarcode,
          platform: match.platform,
        },
        data: { productId: match.masterProductId },
      }),
    ]);
  }

  async manualLinkListing(
    organizationId: string,
    dto: ManualProductMatchDto,
  ): Promise<void> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: dto.listingId, organizationId, deletedAt: null },
    });
    if (!listing) {
      throw new NotFoundException('Listeleme bulunamadı');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.masterProductId, organizationId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productMatch.upsert({
        where: {
          organizationId_platformBarcode_platform: {
            organizationId,
            platformBarcode: listing.barcode,
            platform: listing.platform,
          },
        },
        create: {
          organizationId,
          masterProductId: product.id,
          platformBarcode: listing.barcode,
          platform: listing.platform,
          platformSku: null,
          confidence: 1,
          isConfirmed: true,
        },
        update: {
          masterProductId: product.id,
          isConfirmed: true,
          deletedAt: null,
          confidence: 1,
        },
      });

      await tx.listing.update({
        where: { id: listing.id, organizationId },
        data: { productId: product.id },
      });
    });
  }

  async findConflicts(organizationId: string): Promise<ProductMatchConflict[]> {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null, productId: { not: null } },
      select: {
        id: true,
        platform: true,
        barcode: true,
        title: true,
        productId: true,
      },
    });

    const matches = await this.prisma.productMatch.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        platform: true,
        platformBarcode: true,
        masterProductId: true,
      },
    });

    const matchByKey = new Map<string, string>();
    for (const m of matches) {
      matchByKey.set(matchKey(m.platform, m.platformBarcode), m.masterProductId);
    }

    const conflicts: ProductMatchConflict[] = [];

    for (const l of listings) {
      const mid = matchByKey.get(matchKey(l.platform, l.barcode));
      if (mid && l.productId && mid !== l.productId) {
        conflicts.push({
          kind: 'LISTING_PRODUCT_VS_MATCH',
          listingId: l.id,
          platform: l.platform,
          barcode: l.barcode,
          listingProductId: l.productId,
          matchMasterProductId: mid,
          title: l.title,
        });
      }
    }

    const byKey = new Map<string, Set<string>>();
    for (const l of listings) {
      const k = matchKey(l.platform, l.barcode);
      if (!byKey.has(k)) {
        byKey.set(k, new Set());
      }
      if (l.productId) {
        byKey.get(k)!.add(l.productId);
      }
    }

    for (const [k, ids] of byKey) {
      if (ids.size <= 1) {
        continue;
      }
      const sep = k.indexOf('::');
      const platform = k.slice(0, sep) as Marketplace;
      const barcode = k.slice(sep + 2);
      const first = await this.prisma.listing.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          platform,
          barcode,
          productId: { not: null },
        },
      });
      if (first) {
        conflicts.push({
          kind: 'DUPLICATE_LISTING_PRODUCT',
          listingId: first.id,
          platform: first.platform,
          barcode: first.barcode,
          listingProductId: first.productId,
          matchMasterProductId: null,
          title: first.title,
        });
      }
    }

    return conflicts;
  }

  async listUnmatched(organizationId: string): Promise<UnmatchedListingRow[]> {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    const matches = await this.prisma.productMatch.findMany({
      where: { organizationId, deletedAt: null },
      select: { platform: true, platformBarcode: true },
    });

    const matchSet = new Set(
      matches.map((m) => matchKey(m.platform, m.platformBarcode)),
    );

    const unmatched = listings.filter(
      (l) =>
        !matchSet.has(matchKey(l.platform, l.barcode)) &&
        l.productId === null,
    );

    return unmatched.map((l) => ({
      id: l.id,
      platform: l.platform,
      barcode: l.barcode,
      title: l.title,
      salePrice: l.salePrice.toString(),
      listPrice: l.listPrice.toString(),
      quantity: l.quantity,
      productId: l.productId,
      platformProductId: l.platformProductId,
    }));
  }
}
