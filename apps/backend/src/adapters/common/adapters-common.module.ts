import { Global, Module } from '@nestjs/common';

import { PlatformHealthService } from './platform-health.service';
import { RedisRateLimiter } from './redis-rate-limiter';

@Global()
@Module({
  providers: [RedisRateLimiter, PlatformHealthService],
  exports: [RedisRateLimiter, PlatformHealthService],
})
export class AdaptersCommonModule {}
