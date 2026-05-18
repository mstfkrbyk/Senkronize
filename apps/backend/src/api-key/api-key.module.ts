import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyStrategy } from './api-key.strategy';
import { JwtOrApiKeyGuard } from './jwt-or-api-key.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    forwardRef(() => AuthModule),
  ],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyStrategy,
    ApiKeyAuthGuard,
    JwtOrApiKeyGuard,
  ],
  exports: [
    ApiKeyService,
    ApiKeyAuthGuard,
    ApiKeyStrategy,
    JwtOrApiKeyGuard,
  ],
})
export class ApiKeyModule {}
