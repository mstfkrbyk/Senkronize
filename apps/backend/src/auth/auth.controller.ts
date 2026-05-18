import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RecommendPlanDto,
  RefreshTokenDto,
  RegisterDto,
  UpdateProfileDto,
} from './auth.dto';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtRefreshAuthGuard } from './jwt-refresh-auth.guard';
import { JwtRefreshValidatedUser } from './jwt-refresh.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ short: { limit: 5 }, medium: { limit: 5 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni hesap ve organizasyon oluştur' })
  @ApiResponse({ status: 201, description: 'Kayıt tamamlandı' })
  @ApiResponse({ status: 409, description: 'E-posta zaten kayıtlı' })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.register(dto);
  }

  @Post('recommend-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'İş yapısına göre paket önerisi' })
  @ApiResponse({ status: 200, description: 'Önerilen plan' })
  recommendPlan(
    @Body() dto: RecommendPlanDto,
  ): { recommendedPlan: 'BASLANGIC' | 'GELISIM' | 'PRO' | 'KURUMSAL'; reason: string } {
    return this.authService.recommendPlan(dto);
  }

  @Throttle({ short: { limit: 10 }, medium: { limit: 10 } })
  @Post('login')
  @ApiOperation({ summary: 'Giriş' })
  @ApiResponse({ status: 200, description: 'Token çifti' })
  @ApiResponse({ status: 401, description: 'Geçersiz kimlik bilgileri' })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.login(dto);
  }

  @Throttle({ short: { limit: 20 }, medium: { limit: 60 } })
  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  @ApiOperation({ summary: 'Access token yenile' })
  @ApiResponse({ status: 200, description: 'Yeni token çifti' })
  @ApiResponse({ status: 401, description: 'Geçersiz yenileme jetonu' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request & { user: JwtRefreshValidatedUser },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(req.user.id, dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Çıkış (yenileme jetonunu iptal et)' })
  @ApiResponse({ status: 200, description: 'Çıkış tamamlandı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.authService.logout(user.id, dto.refreshToken);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Oturumdaki kullanıcı ve organizasyon' })
  @ApiResponse({ status: 200, description: 'Profil bilgisi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const organization = await this.authService.getCurrentOrganization(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        organizationId: user.organizationId,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      organization,
      currentOrgId: user.currentOrgId,
      isImpersonating: user.isImpersonating,
    };
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Şifre değiştir' })
  @ApiResponse({ status: 200, description: 'Şifre güncellendi' })
  @ApiResponse({ status: 401, description: 'Mevcut şifre hatalı veya yetkisiz' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(user, dto);
    return { message: 'Şifre güncellendi' };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil güncelle' })
  @ApiResponse({ status: 200, description: 'Profil güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ message: string }> {
    await this.authService.updateProfile(user.id, dto);
    return { message: 'Profil güncellendi' };
  }
}
