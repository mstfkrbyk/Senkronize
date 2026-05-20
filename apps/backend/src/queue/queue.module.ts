import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as constants from './queue.constants';

function parseRedisUrl(redisUrl: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
} {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: parseRedisUrl(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        ),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: constants.QUEUE_MARKETPLACE_PULL,
        limiter: {
          max: 10,
          duration: 60_000,
        },
      },
      { name: constants.QUEUE_MARKETPLACE_PUSH },
      { name: constants.QUEUE_ERP_SYNC },
      { name: constants.QUEUE_NOTIFICATION },
      { name: constants.QUEUE_PRICING },
      { name: constants.QUEUE_IMAGE },
      { name: constants.QUEUE_IMAGE_SYNC },
      { name: constants.QUEUE_WEBHOOK_DELIVERY },
      { name: constants.QUEUE_LISTING_SYNC },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
