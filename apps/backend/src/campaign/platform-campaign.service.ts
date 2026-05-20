import { Injectable, Logger } from '@nestjs/common';
import { Marketplace, type Campaign } from '@prisma/client';

export interface PlatformCampaignSyncResult {
  platform: Marketplace;
  success: boolean;
  externalId?: string;
  message: string;
}

@Injectable()
export class PlatformCampaignService {
  private readonly logger = new Logger(PlatformCampaignService.name);

  async syncCampaignStart(
    organizationId: string,
    campaign: Campaign,
  ): Promise<PlatformCampaignSyncResult[]> {
    const results: PlatformCampaignSyncResult[] = [];

    for (const platform of campaign.platforms as Marketplace[]) {
      switch (platform) {
        case Marketplace.TRENDYOL:
          results.push(
            await this.syncTrendyolFlashSale(organizationId, campaign),
          );
          break;
        case Marketplace.HEPSIBURADA:
          results.push(await this.syncHepsiburadaPromo(organizationId, campaign));
          break;
        default:
          results.push({
            platform,
            success: true,
            message: 'Platform kampanya API entegrasyonu henüz tanımlı değil',
          });
      }
    }

    return results;
  }

  async syncCampaignEnd(
    organizationId: string,
    campaign: Campaign,
  ): Promise<PlatformCampaignSyncResult[]> {
    const results: PlatformCampaignSyncResult[] = [];

    for (const platform of campaign.platforms as Marketplace[]) {
      switch (platform) {
        case Marketplace.TRENDYOL:
          results.push(
            await this.endTrendyolFlashSale(organizationId, campaign),
          );
          break;
        case Marketplace.HEPSIBURADA:
          results.push(
            await this.endHepsiburadaPromo(organizationId, campaign),
          );
          break;
        default:
          results.push({
            platform,
            success: true,
            message: 'Platform kampanya sonlandırma henüz tanımlı değil',
          });
      }
    }

    return results;
  }

  /** Trendyol flash-sale API — stub */
  private async syncTrendyolFlashSale(
    organizationId: string,
    campaign: Campaign,
  ): Promise<PlatformCampaignSyncResult> {
    this.logger.log('Trendyol flash-sale kampanya senkronu (stub)', {
      organizationId,
      campaignId: campaign.id,
    });
    return {
      platform: Marketplace.TRENDYOL,
      success: true,
      externalId: `ty-flash-${campaign.id}`,
      message: 'Trendyol flash-sale entegrasyonu hazırlanıyor',
    };
  }

  private async endTrendyolFlashSale(
    organizationId: string,
    campaign: Campaign,
  ): Promise<PlatformCampaignSyncResult> {
    this.logger.log('Trendyol flash-sale kampanya sonlandırma (stub)', {
      organizationId,
      campaignId: campaign.id,
    });
    return {
      platform: Marketplace.TRENDYOL,
      success: true,
      message: 'Trendyol flash-sale sonlandırma (stub)',
    };
  }

  /** Hepsiburada promo API — stub */
  private async syncHepsiburadaPromo(
    organizationId: string,
    campaign: Campaign,
  ): Promise<PlatformCampaignSyncResult> {
    this.logger.log('Hepsiburada promo kampanya senkronu (stub)', {
      organizationId,
      campaignId: campaign.id,
    });
    return {
      platform: Marketplace.HEPSIBURADA,
      success: true,
      externalId: `hb-promo-${campaign.id}`,
      message: 'Hepsiburada promo entegrasyonu hazırlanıyor',
    };
  }

  private async endHepsiburadaPromo(
    organizationId: string,
    campaign: Campaign,
  ): Promise<PlatformCampaignSyncResult> {
    this.logger.log('Hepsiburada promo kampanya sonlandırma (stub)', {
      organizationId,
      campaignId: campaign.id,
    });
    return {
      platform: Marketplace.HEPSIBURADA,
      success: true,
      message: 'Hepsiburada promo sonlandırma (stub)',
    };
  }
}
