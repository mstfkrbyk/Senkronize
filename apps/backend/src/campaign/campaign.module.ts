import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { PricingModule } from '../pricing/pricing.module';

import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignSchedulerTask } from './campaign.task';
import { PlatformCampaignService } from './platform-campaign.service';

@Module({
  imports: [AuthModule, CommonModule, PricingModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignSchedulerTask, PlatformCampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
