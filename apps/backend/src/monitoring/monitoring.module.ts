import { Global, Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimitMonitorService } from './rate-limit-monitor.service';

@Global()
@Module({
  imports: [PrismaModule, CommonModule],
  providers: [RateLimitMonitorService],
  exports: [RateLimitMonitorService],
})
export class MonitoringModule {}
