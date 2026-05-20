import { Global, Module } from '@nestjs/common';

import { CacheModule } from '../../common/cache/cache.module';
import { MarketplaceTokenCache } from './marketplace-token-cache';
import { PlatformHealthService } from './platform-health.service';
import { RedisRateLimiter } from './redis-rate-limiter';

@Global()
@Module({
  imports: [CacheModule],
  providers: [RedisRateLimiter, PlatformHealthService, MarketplaceTokenCache],
  exports: [RedisRateLimiter, PlatformHealthService, MarketplaceTokenCache],
})
export class AdaptersCommonModule {}
