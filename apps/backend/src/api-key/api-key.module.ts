import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyStrategy } from './api-key.strategy';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AuthModule,
  ],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyStrategy, ApiKeyAuthGuard],
  exports: [ApiKeyService, ApiKeyAuthGuard, ApiKeyStrategy],
})
export class ApiKeyModule {}
