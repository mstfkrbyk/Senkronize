import { Module } from '@nestjs/common';

import { AdaptersCommonModule } from '../adapters/common/adapters-common.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { PrismaModule } from '../prisma/prisma.module';

import { IntegrationPolicyService } from './integration-policy.service';

@Module({
  imports: [PrismaModule, AdaptersCommonModule, MonitoringModule],
  providers: [IntegrationPolicyService],
  exports: [IntegrationPolicyService],
})
export class IntegrationPolicyModule {}
