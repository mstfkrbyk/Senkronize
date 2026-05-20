import { Global, Module, OnModuleInit } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { configureAmazonSpApiCache } from './amazon-sp-api.auth';

@Global()
@Module({})
export class AmazonSpApiModule implements OnModuleInit {
  constructor(private readonly cache: CacheService) {}

  onModuleInit(): void {
    configureAmazonSpApiCache(this.cache);
  }
}
