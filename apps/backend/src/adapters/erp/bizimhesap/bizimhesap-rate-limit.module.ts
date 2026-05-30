import { Global, Module } from '@nestjs/common';

import { IntegrationPolicyModule } from '../../../integration-policy/integration-policy.module';
import { PlatformActivityLogService } from '../../../monitoring/platform-activity-log.service';

import { BizimHesapRateLimitService } from './bizimhesap-rate-limit.service';

@Global()
@Module({
  imports: [IntegrationPolicyModule],
  providers: [PlatformActivityLogService, BizimHesapRateLimitService],
  exports: [PlatformActivityLogService, BizimHesapRateLimitService],
})
export class BizimHesapRateLimitModule {}
