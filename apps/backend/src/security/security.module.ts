import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AnomalyDetectionService } from './anomaly-detection.service';
import { IpBlockService } from './ip-block.service';
import { IpBlockGuard } from '../common/guards/ip-block.guard';
import { SecurityRequestInterceptor } from './security-request.interceptor';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    IpBlockService,
    AnomalyDetectionService,
    IpBlockGuard,
    SecurityRequestInterceptor,
  ],
  exports: [
    IpBlockService,
    AnomalyDetectionService,
    IpBlockGuard,
    SecurityRequestInterceptor,
  ],
})
export class SecurityModule {}
