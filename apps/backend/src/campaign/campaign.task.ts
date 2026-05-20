import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CampaignService } from './campaign.service';

@Injectable()
export class CampaignSchedulerTask {
  private readonly logger = new Logger(CampaignSchedulerTask.name);

  constructor(private readonly campaignService: CampaignService) {}

  /** Her 5 dakikada zamanlanmış kampanyaları aktifleştirir, süresi dolanları sonlandırır. */
  @Cron('*/5 * * * *')
  async checkAndApplyCampaigns(): Promise<void> {
    try {
      await this.campaignService.checkAndApplyCampaigns();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('Kampanya zamanlama görevi hatası', { error: message });
    }
  }
}
