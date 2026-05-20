import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  type Campaign,
  type Listing,
  Marketplace,
  Prisma,
} from '@prisma/client';
import type { Queue } from 'bull';

import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { PriceHistoryService } from '../pricing/price-history.service';
import { PrismaService } from '../prisma/prisma.service';
import { JOB_DEFAULT_OPTIONS, QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';

import type {
  AnalyzeCampaignDto,
  BulkCampaignStatusDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  ValidateCouponDto,
} from './campaign.dto';
import type {
  CampaignDetail,
  CampaignDiscountType,
  CampaignFilter,
  CampaignIdImpact,
  CampaignImpact,
  CampaignKpiSummary,
  CampaignListItem,
  CampaignOriginalPrices,
  CampaignPerformance,
  CampaignUsageTrendPoint,
  CouponValidationResult,
} from './campaign.types';
import { PlatformCampaignService } from './platform-campaign.service';

type ListingWithProduct = Listing & {
  product: {
    id: string;
    name: string;
    barcode: string;
    costPrice: Prisma.Decimal | null;
  } | null;
};

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly priceHistoryService: PriceHistoryService,
    private readonly platformCampaignService: PlatformCampaignService,
    @InjectQueue(QUEUE_MARKETPLACE_PUSH)
    private readonly pushQueue: Queue<MarketplacePushJobData>,
  ) {}

  async createCampaign(
    organizationId: string,
    dto: CreateCampaignDto,
  ): Promise<CampaignListItem> {
    this.assertValidDates(dto.startDate, dto.endDate);
    this.assertValidPlatforms(dto.platforms);
    this.assertValidDiscount(dto.discountType, dto.discountValue);

    const couponCode = this.normalizeCouponCode(dto.couponCode);
    if (couponCode) {
      await this.assertCouponCodeAvailable(organizationId, couponCode);
    }

    const startDate = new Date(dto.startDate);
    const now = new Date();
    const initialStatus =
      startDate > now ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT;

    const campaign = await this.prisma.campaign.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        type: dto.type,
        status: initialStatus,
        startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        platforms: dto.platforms,
        productIds: dto.productIds ?? [],
        categoryIds: dto.categoryIds ?? [],
        discountType: dto.discountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        minPrice:
          dto.minPrice !== undefined
            ? new Prisma.Decimal(dto.minPrice)
            : null,
        minOrderAmount:
          dto.minOrderAmount !== undefined
            ? new Prisma.Decimal(dto.minOrderAmount)
            : null,
        maxUses: dto.maxUses ?? null,
        couponCode,
        stackable: dto.stackable ?? false,
      },
    });

    return this.toListItem(campaign);
  }

  async getKpiSummary(organizationId: string): Promise<CampaignKpiSummary> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        status: true,
        usageCount: true,
        impressions: true,
        totalDiscountAmount: true,
      },
    });

    let activeCampaignCount = 0;
    let totalUsageCount = 0;
    let totalDiscount = 0;
    let conversionSum = 0;
    let conversionWeight = 0;

    for (const c of campaigns) {
      if (c.status === CampaignStatus.ACTIVE) {
        activeCampaignCount += 1;
      }
      totalUsageCount += c.usageCount;
      totalDiscount += Number(c.totalDiscountAmount);
      if (c.impressions > 0) {
        conversionSum += (c.usageCount / c.impressions) * 100;
        conversionWeight += 1;
      }
    }

    return {
      activeCampaignCount,
      totalUsageCount,
      totalDiscountAmount: totalDiscount.toFixed(2),
      avgConversionRate:
        conversionWeight > 0
          ? Math.round((conversionSum / conversionWeight) * 100) / 100
          : 0,
    };
  }

  async validateCoupon(
    organizationId: string,
    dto: ValidateCouponDto,
  ): Promise<CouponValidationResult> {
    const code = dto.couponCode.trim().toUpperCase();
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        couponCode: { equals: code, mode: 'insensitive' },
      },
    });

    if (!campaign) {
      return {
        valid: false,
        campaignId: null,
        campaignName: null,
        discountAmount: '0.00',
        message: 'Kupon kodu bulunamadı',
      };
    }

    const validationError = this.getCouponEligibilityError(campaign, dto.orderAmount);
    if (validationError) {
      return {
        valid: false,
        campaignId: campaign.id,
        campaignName: campaign.name,
        discountAmount: '0.00',
        message: validationError,
      };
    }

    const discountAmount = this.calculateOrderDiscount(
      dto.orderAmount,
      campaign.discountType as CampaignDiscountType,
      Number(campaign.discountValue),
    );

    return {
      valid: true,
      campaignId: campaign.id,
      campaignName: campaign.name,
      discountAmount: discountAmount.toFixed(2),
      message: 'Kupon geçerli',
    };
  }

  async getCampaignImpactById(
    organizationId: string,
    id: string,
  ): Promise<CampaignIdImpact> {
    const campaign = await this.findCampaignOrThrow(organizationId, id);
    const impact = await this.analyzeImpact(organizationId, {
      name: campaign.name,
      type: campaign.type,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate?.toISOString(),
      platforms: campaign.platforms,
      productIds: campaign.productIds,
      categoryIds: campaign.categoryIds,
      discountType: campaign.discountType as CampaignDiscountType,
      discountValue: Number(campaign.discountValue),
      minPrice: campaign.minPrice ? Number(campaign.minPrice) : undefined,
    });

    const affectedOrderEstimate = await this.estimateAffectedOrders(
      organizationId,
      campaign,
    );

    return { ...impact, affectedOrderEstimate };
  }

  async getCampaignPerformance(
    organizationId: string,
    id: string,
  ): Promise<CampaignPerformance> {
    const campaign = await this.findCampaignOrThrow(organizationId, id);
    const conversionRate =
      campaign.impressions > 0
        ? Math.round((campaign.usageCount / campaign.impressions) * 10000) / 100
        : 0;

    return {
      usageCount: campaign.usageCount,
      maxUses: campaign.maxUses,
      totalDiscountAmount: campaign.totalDiscountAmount.toString(),
      conversionRate,
      impressions: campaign.impressions,
      usageByDay: this.buildUsageTrend(campaign),
    };
  }

  async duplicateCampaign(
    organizationId: string,
    id: string,
  ): Promise<CampaignListItem> {
    const source = await this.findCampaignOrThrow(organizationId, id);

    const duplicate = await this.prisma.campaign.create({
      data: {
        organizationId,
        name: `${source.name} (Kopya)`,
        type: source.type,
        status: CampaignStatus.DRAFT,
        startDate: source.startDate,
        endDate: source.endDate,
        platforms: source.platforms,
        productIds: source.productIds,
        categoryIds: source.categoryIds,
        discountType: source.discountType,
        discountValue: source.discountValue,
        minPrice: source.minPrice,
        minOrderAmount: source.minOrderAmount,
        maxUses: source.maxUses,
        stackable: source.stackable,
        usageCount: 0,
        impressions: 0,
        totalDiscountAmount: new Prisma.Decimal(0),
      },
    });

    return this.toListItem(duplicate);
  }

  async bulkUpdateStatus(
    organizationId: string,
    dto: BulkCampaignStatusDto,
  ): Promise<{ updated: number; failed: string[] }> {
    const failed: string[] = [];
    let updated = 0;

    for (const id of dto.ids) {
      try {
        if (dto.status === 'ACTIVE') {
          await this.activateCampaign(organizationId, id);
        } else if (dto.status === 'PAUSED') {
          await this.pauseCampaign(organizationId, id);
        } else {
          await this.deactivateCampaign(organizationId, id);
        }
        updated += 1;
      } catch {
        failed.push(id);
      }
    }

    return { updated, failed };
  }

  async listCampaigns(
    organizationId: string,
    filter?: CampaignFilter,
  ): Promise<CampaignListItem[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(campaigns.map((c) => this.toListItem(c)));
  }

  async getCampaign(
    organizationId: string,
    id: string,
  ): Promise<CampaignDetail> {
    const campaign = await this.findCampaignOrThrow(organizationId, id);
    const listings = await this.resolveAffectedListings(organizationId, campaign);
    const originals = this.parseOriginalPrices(campaign.originalPrices);

    const affectedProducts = listings.map((listing) => {
      const current = Number(listing.salePrice);
      const discounted = this.calculateDiscountedPrice(
        current,
        campaign.discountType as CampaignDiscountType,
        Number(campaign.discountValue),
        campaign.minPrice ? Number(campaign.minPrice) : null,
      );
      const snapshot = originals[listing.id];

      return {
        id: listing.id,
        productId: listing.productId,
        barcode: listing.barcode,
        title: listing.title,
        platform: listing.platform,
        currentPrice: listing.salePrice.toString(),
        originalPrice: snapshot?.salePrice ?? null,
        discountedPrice: discounted.toFixed(2),
      };
    });

    const listItem = await this.toListItem(campaign);

    return {
      ...listItem,
      affectedProducts,
    };
  }

  async updateCampaign(
    organizationId: string,
    id: string,
    dto: UpdateCampaignDto,
  ): Promise<CampaignListItem> {
    const existing = await this.findCampaignOrThrow(organizationId, id);
    if (existing.status === CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        'Aktif kampanya düzenlenemez. Önce duraklatın veya sonlandırın.',
      );
    }

    const startDate =
      dto.startDate !== undefined ? new Date(dto.startDate) : existing.startDate;
    const endDate =
      dto.endDate === null
        ? null
        : dto.endDate !== undefined
          ? new Date(dto.endDate)
          : existing.endDate;

    this.assertValidDates(startDate.toISOString(), endDate?.toISOString());

    if (dto.platforms) {
      this.assertValidPlatforms(dto.platforms);
    }

    const discountType = (dto.discountType ??
      existing.discountType) as CampaignDiscountType;
    const discountValue =
      dto.discountValue ?? Number(existing.discountValue);
    this.assertValidDiscount(discountType, discountValue);

    if (dto.couponCode !== undefined) {
      const couponCode = this.normalizeCouponCode(dto.couponCode);
      if (couponCode) {
        await this.assertCouponCodeAvailable(
          organizationId,
          couponCode,
          existing.id,
        );
      }
    }

    const updated = await this.prisma.campaign.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.platforms !== undefined ? { platforms: dto.platforms } : {}),
        ...(dto.productIds !== undefined ? { productIds: dto.productIds } : {}),
        ...(dto.categoryIds !== undefined
          ? { categoryIds: dto.categoryIds }
          : {}),
        ...(dto.discountType !== undefined
          ? { discountType: dto.discountType }
          : {}),
        ...(dto.discountValue !== undefined
          ? { discountValue: new Prisma.Decimal(dto.discountValue) }
          : {}),
        ...(dto.minPrice !== undefined
          ? {
              minPrice:
                dto.minPrice === null
                  ? null
                  : new Prisma.Decimal(dto.minPrice),
            }
          : {}),
        ...(dto.minOrderAmount !== undefined
          ? {
              minOrderAmount:
                dto.minOrderAmount === null
                  ? null
                  : new Prisma.Decimal(dto.minOrderAmount),
            }
          : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.couponCode !== undefined
          ? { couponCode: this.normalizeCouponCode(dto.couponCode) }
          : {}),
        ...(dto.stackable !== undefined ? { stackable: dto.stackable } : {}),
      },
    });

    return this.toListItem(updated);
  }

  async deleteCampaign(organizationId: string, id: string): Promise<void> {
    const campaign = await this.findCampaignOrThrow(organizationId, id);
    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        'Aktif kampanya silinemez. Önce sonlandırın.',
      );
    }

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { deletedAt: new Date() },
    });
  }

  async activateCampaign(organizationId: string, id: string): Promise<void> {
    const campaign = await this.findCampaignOrThrow(organizationId, id);
    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.SCHEDULED &&
      campaign.status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException('Kampanya aktifleştirilemez.');
    }

    await this.applyCampaignPrices(organizationId, campaign);

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.ACTIVE },
    });

    await this.platformCampaignService.syncCampaignStart(organizationId, campaign);
  }

  async pauseCampaign(organizationId: string, id: string): Promise<void> {
    const campaign = await this.findCampaignOrThrow(organizationId, id);
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException('Yalnızca aktif kampanyalar duraklatılabilir.');
    }

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.PAUSED },
    });
  }

  async deactivateCampaign(organizationId: string, id: string): Promise<void> {
    const campaign = await this.findCampaignOrThrow(organizationId, id);
    if (
      campaign.status !== CampaignStatus.ACTIVE &&
      campaign.status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException('Kampanya sonlandırılamaz.');
    }

    await this.restoreCampaignPrices(organizationId, campaign);

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.ENDED,
        originalPrices: Prisma.JsonNull,
      },
    });

    await this.platformCampaignService.syncCampaignEnd(organizationId, campaign);
  }

  async checkAndApplyCampaigns(): Promise<void> {
    await this.scheduleCampaigns();
  }

  async scheduleCampaigns(): Promise<void> {
    const now = new Date();

    const toActivate = await this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        status: CampaignStatus.SCHEDULED,
        startDate: { lte: now },
      },
    });

    for (const campaign of toActivate) {
      try {
        await this.applyCampaignPrices(campaign.organizationId, campaign);
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: CampaignStatus.ACTIVE },
        });
        await this.platformCampaignService.syncCampaignStart(
          campaign.organizationId,
          campaign,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.error('Kampanya otomatik aktivasyon hatası', {
          campaignId: campaign.id,
          organizationId: campaign.organizationId,
          error: message,
        });
      }
    }

    const toEnd = await this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        status: CampaignStatus.ACTIVE,
        endDate: { not: null, lte: now },
      },
    });

    for (const campaign of toEnd) {
      try {
        await this.restoreCampaignPrices(campaign.organizationId, campaign);
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CampaignStatus.ENDED,
            originalPrices: Prisma.JsonNull,
          },
        });
        await this.platformCampaignService.syncCampaignEnd(
          campaign.organizationId,
          campaign,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.error('Kampanya otomatik sonlandırma hatası', {
          campaignId: campaign.id,
          organizationId: campaign.organizationId,
          error: message,
        });
      }
    }
  }

  async analyzeImpact(
    organizationId: string,
    dto: AnalyzeCampaignDto,
  ): Promise<CampaignImpact> {
    this.assertValidPlatforms(dto.platforms);
    this.assertValidDiscount(dto.discountType, dto.discountValue);

    const pseudoCampaign = {
      platforms: dto.platforms,
      productIds: dto.productIds ?? [],
      categoryIds: dto.categoryIds ?? [],
      discountType: dto.discountType,
      discountValue: new Prisma.Decimal(dto.discountValue),
      minPrice:
        dto.minPrice !== undefined ? new Prisma.Decimal(dto.minPrice) : null,
    };

    const listings = await this.resolveAffectedListings(
      organizationId,
      pseudoCampaign,
    );

    let totalLoss = 0;
    let totalDiscountPct = 0;
    const productsAtRisk: CampaignImpact['productsAtRisk'] = [];
    const MIN_MARGIN_PCT = 10;

    for (const listing of listings) {
      const current = Number(listing.salePrice);
      const discounted = this.calculateDiscountedPrice(
        current,
        dto.discountType,
        dto.discountValue,
        dto.minPrice ?? null,
      );
      const loss = Math.max(0, current - discounted);
      totalLoss += loss;

      if (current > 0) {
        totalDiscountPct += ((current - discounted) / current) * 100;
      }

      const cost = listing.product?.costPrice
        ? Number(listing.product.costPrice)
        : null;
      const marginPct =
        cost !== null && discounted > 0
          ? ((discounted - cost) / discounted) * 100
          : null;

      if (
        marginPct !== null &&
        cost !== null &&
        (marginPct < MIN_MARGIN_PCT || discounted < cost)
      ) {
        productsAtRisk.push({
          id: listing.product?.id ?? listing.id,
          name: listing.product?.name ?? listing.title,
          barcode: listing.barcode,
          currentPrice: current.toFixed(2),
          discountedPrice: discounted.toFixed(2),
          marginPct: marginPct !== null ? Math.round(marginPct * 100) / 100 : null,
        });
      }
    }

    const count = listings.length;
    const avgDiscountPct =
      count > 0 ? Math.round((totalDiscountPct / count) * 100) / 100 : 0;

    return {
      affectedProductCount: count,
      estimatedRevenueLoss: totalLoss.toFixed(2),
      avgDiscountPct,
      productsAtRisk: productsAtRisk.slice(0, 50),
    };
  }

  private async findCampaignOrThrow(
    organizationId: string,
    id: string,
  ): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!campaign) {
      throw new NotFoundException('Kampanya bulunamadı');
    }
    return campaign;
  }

  private async toListItem(campaign: Campaign): Promise<CampaignListItem> {
    const listings = await this.resolveAffectedListings(
      campaign.organizationId,
      campaign,
    );
    return {
      ...campaign,
      affectedProductCount: listings.length,
    };
  }

  private assertValidDates(
    startDate: string,
    endDate?: string | null,
  ): void {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Geçersiz başlangıç tarihi');
    }
    if (endDate) {
      const end = new Date(endDate);
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('Geçersiz bitiş tarihi');
      }
      if (end <= start) {
        throw new BadRequestException(
          'Bitiş tarihi başlangıç tarihinden sonra olmalıdır',
        );
      }
    }
  }

  private assertValidPlatforms(platforms: string[]): void {
    if (platforms.length === 0) {
      throw new BadRequestException('En az bir platform seçilmelidir');
    }
    for (const p of platforms) {
      if (!(p in Marketplace)) {
        throw new BadRequestException(`Geçersiz platform: ${p}`);
      }
    }
  }

  private assertValidDiscount(
    discountType: CampaignDiscountType,
    discountValue: number,
  ): void {
    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      throw new BadRequestException('Yüzde indirim 0–100 arasında olmalıdır');
    }
    if (discountType !== 'PERCENTAGE' && discountValue <= 0) {
      throw new BadRequestException('İndirim değeri sıfırdan büyük olmalıdır');
    }
  }

  private calculateDiscountedPrice(
    currentPrice: number,
    discountType: CampaignDiscountType,
    discountValue: number,
    minPrice: number | null,
  ): number {
    let newPrice: number;
    switch (discountType) {
      case 'PERCENTAGE':
        newPrice = currentPrice * (1 - discountValue / 100);
        break;
      case 'FIXED':
        newPrice = currentPrice - discountValue;
        break;
      case 'PRICE_SET':
        newPrice = discountValue;
        break;
      default:
        throw new BadRequestException('Geçersiz indirim tipi');
    }

    newPrice = Math.round(newPrice * 100) / 100;
    if (minPrice !== null && newPrice < minPrice) {
      newPrice = minPrice;
    }
    return Math.max(0, newPrice);
  }

  private async resolveAffectedListings(
    organizationId: string,
    campaign: {
      platforms: string[];
      productIds: string[];
      categoryIds: string[];
    },
  ): Promise<ListingWithProduct[]> {
    const platforms = campaign.platforms as Marketplace[];

    let productIdFilter: string[] | undefined;
    if (campaign.productIds.length > 0) {
      productIdFilter = campaign.productIds;
    } else if (campaign.categoryIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: {
          organizationId,
          deletedAt: null,
          categoryId: { in: campaign.categoryIds },
        },
        select: { id: true },
      });
      productIdFilter = products.map((p) => p.id);
    }

    return this.prisma.listing.findMany({
      where: {
        organizationId,
        deletedAt: null,
        platform: { in: platforms },
        ...(productIdFilter !== undefined
          ? { productId: { in: productIdFilter } }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            costPrice: true,
          },
        },
      },
    });
  }

  private parseOriginalPrices(
    value: Prisma.JsonValue | null,
  ): CampaignOriginalPrices {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as unknown as CampaignOriginalPrices;
  }

  private async applyCampaignPrices(
    organizationId: string,
    campaign: Campaign,
  ): Promise<void> {
    const listings = await this.resolveAffectedListings(organizationId, campaign);
    const existingSnapshots = this.parseOriginalPrices(campaign.originalPrices);
    const snapshots: CampaignOriginalPrices = { ...existingSnapshots };
    const pushByPlatform = new Map<Marketplace, string[]>();

    await this.prisma.$transaction(async (tx) => {
      for (const listing of listings) {
        const current = Number(listing.salePrice);
        const discounted = this.calculateDiscountedPrice(
          current,
          campaign.discountType as CampaignDiscountType,
          Number(campaign.discountValue),
          campaign.minPrice ? Number(campaign.minPrice) : null,
        );

        if (!snapshots[listing.id]) {
          snapshots[listing.id] = {
            salePrice: listing.salePrice.toString(),
            listPrice: listing.listPrice.toString(),
          };
        }

        await this.priceHistoryService.recordPriceChange(
          {
            organizationId,
            listingId: listing.id,
            barcode: listing.barcode,
            platform: listing.platform,
            oldPrice: listing.salePrice,
            newPrice: discounted,
            source: 'campaign',
            reason: `campaign:${campaign.id}`,
          },
          tx,
        );

        await tx.listing.update({
          where: { id: listing.id },
          data: {
            salePrice: new Prisma.Decimal(discounted),
            listPrice: new Prisma.Decimal(
              Math.max(discounted, Number(listing.listPrice)),
            ),
          },
        });

        const barcodes = pushByPlatform.get(listing.platform) ?? [];
        barcodes.push(listing.barcode);
        pushByPlatform.set(listing.platform, barcodes);
      }

      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          originalPrices: snapshots as unknown as Prisma.InputJsonValue,
        },
      });
    });

    for (const [platform, barcodes] of pushByPlatform) {
      await this.pushQueue.add(
        'push-price',
        {
          organizationId,
          platform,
          type: 'price',
          resourceIds: [...new Set(barcodes)],
          payload: { campaignId: campaign.id },
        },
        JOB_DEFAULT_OPTIONS,
      );
    }

    this.eventService.emit(organizationId, WS_EVENTS.PRICE_UPDATED, {
      campaignId: campaign.id,
    });
  }

  private async restoreCampaignPrices(
    organizationId: string,
    campaign: Campaign,
  ): Promise<void> {
    const snapshots = this.parseOriginalPrices(campaign.originalPrices);
    const listingIds = Object.keys(snapshots);
    if (listingIds.length === 0) {
      return;
    }

    const listings = await this.prisma.listing.findMany({
      where: {
        id: { in: listingIds },
        organizationId,
        deletedAt: null,
      },
    });

    const pushByPlatform = new Map<Marketplace, string[]>();

    await this.prisma.$transaction(async (tx) => {
      for (const listing of listings) {
        const snapshot = snapshots[listing.id];
        if (!snapshot) {
          continue;
        }

        await this.priceHistoryService.recordPriceChange(
          {
            organizationId,
            listingId: listing.id,
            barcode: listing.barcode,
            platform: listing.platform,
            oldPrice: listing.salePrice,
            newPrice: snapshot.salePrice,
            source: 'campaign',
            reason: `campaign-restore:${campaign.id}`,
          },
          tx,
        );

        await tx.listing.update({
          where: { id: listing.id },
          data: {
            salePrice: new Prisma.Decimal(snapshot.salePrice),
            listPrice: new Prisma.Decimal(snapshot.listPrice),
          },
        });

        const barcodes = pushByPlatform.get(listing.platform) ?? [];
        barcodes.push(listing.barcode);
        pushByPlatform.set(listing.platform, barcodes);
      }
    });

    for (const [platform, barcodes] of pushByPlatform) {
      await this.pushQueue.add(
        'push-price',
        {
          organizationId,
          platform,
          type: 'price',
          resourceIds: [...new Set(barcodes)],
          payload: { campaignId: campaign.id, restore: true },
        },
        JOB_DEFAULT_OPTIONS,
      );
    }

    this.eventService.emit(organizationId, WS_EVENTS.PRICE_UPDATED, {
      campaignId: campaign.id,
      restored: true,
    });
  }

  private async assertCouponCodeAvailable(
    organizationId: string,
    couponCode: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.campaign.findFirst({
      where: {
        couponCode: { equals: couponCode, mode: 'insensitive' },
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, organizationId: true },
    });
    if (existing && existing.organizationId !== organizationId) {
      throw new ConflictException('Bu kupon kodu başka bir organizasyonda kullanılıyor');
    }
    if (existing) {
      throw new ConflictException('Bu kupon kodu zaten kullanılıyor');
    }
  }

  private normalizeCouponCode(code?: string | null): string | null {
    if (!code) {
      return null;
    }
    const normalized = code.trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }

  private getCouponEligibilityError(
    campaign: Campaign,
    orderAmount: number,
  ): string | null {
    const now = new Date();
    if (campaign.status !== CampaignStatus.ACTIVE) {
      return 'Kampanya aktif değil';
    }
    if (campaign.startDate > now) {
      return 'Kampanya henüz başlamadı';
    }
    if (campaign.endDate && campaign.endDate < now) {
      return 'Kampanya süresi doldu';
    }
    if (
      campaign.maxUses !== null &&
      campaign.usageCount >= campaign.maxUses
    ) {
      return 'Kupon kullanım limitine ulaşıldı';
    }
    if (
      campaign.minOrderAmount !== null &&
      orderAmount < Number(campaign.minOrderAmount)
    ) {
      return `Minimum sipariş tutarı ${campaign.minOrderAmount} TL`;
    }
    return null;
  }

  private calculateOrderDiscount(
    orderAmount: number,
    discountType: CampaignDiscountType,
    discountValue: number,
  ): number {
    switch (discountType) {
      case 'PERCENTAGE':
        return Math.round(orderAmount * (discountValue / 100) * 100) / 100;
      case 'FIXED':
        return Math.min(orderAmount, discountValue);
      case 'PRICE_SET':
        return Math.max(0, orderAmount - discountValue);
      default:
        return 0;
    }
  }

  private async estimateAffectedOrders(
    organizationId: string,
    campaign: Campaign,
  ): Promise<number> {
    const platforms = campaign.platforms as Marketplace[];
    const since = campaign.startDate;
    const until = campaign.endDate ?? new Date();

    return this.prisma.order.count({
      where: {
        organizationId,
        deletedAt: null,
        platform: { in: platforms },
        createdAt: { gte: since, lte: until },
      },
    });
  }

  private buildUsageTrend(campaign: Campaign): CampaignUsageTrendPoint[] {
    const days = 14;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const campaignStart = campaign.startDate;
    const effectiveStart = campaignStart > start ? campaignStart : start;
    const activeDays = Math.max(
      1,
      Math.ceil((end.getTime() - effectiveStart.getTime()) / 86_400_000),
    );
    const dailyAvg = campaign.usageCount / activeDays;

    const points: CampaignUsageTrendPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      const inRange = d >= effectiveStart && d <= end;
      points.push({
        date: dateKey,
        usageCount: inRange ? Math.round(dailyAvg) : 0,
      });
    }

    return points;
  }
}
