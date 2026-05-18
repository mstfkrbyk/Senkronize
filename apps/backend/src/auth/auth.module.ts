import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module';
import { NotificationModule } from '../notification/notification.module';
import { PartnerModule } from '../partner/partner.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtRefreshAuthGuard } from './jwt-refresh-auth.guard';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { PermissionGuard } from './permission.guard';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    SecurityModule,
    NotificationModule,
    PartnerModule,
    forwardRef(() => UsersModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '15m') as NonNullable<JwtSignOptions['expiresIn']>,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TwoFactorService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshAuthGuard,
    PermissionGuard,
  ],
  exports: [AuthService, JwtAuthGuard, PermissionGuard],
})
export class AuthModule {}
