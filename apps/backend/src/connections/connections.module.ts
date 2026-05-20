import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { ConnectionHealthModule } from '../connection-health/connection-health.module';
import { MarketplaceOAuthModule } from '../common/oauth/marketplace-oauth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { OAuthCallbackController } from './oauth-callback.controller';
import { OAuthCallbackService } from './oauth-callback.service';

@Module({
  imports: [
    PrismaModule,
    ConnectionHealthModule,
    MarketplaceOAuthModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ConnectionsController, OAuthCallbackController],
  providers: [ConnectionsService, OAuthCallbackService],
  exports: [ConnectionsService, OAuthCallbackService],
})
export class ConnectionsModule {}
