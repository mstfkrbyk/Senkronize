import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignSchedulerTask } from './campaign.task';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignSchedulerTask],
  exports: [CampaignService],
})
export class CampaignModule {}
