import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CACHE } from './cache.constants';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CACHE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const raw = config.get<string>('REDIS_URL')?.trim();
        if (!raw) {
          return null;
        }
        return new Redis(raw, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });
      },
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
