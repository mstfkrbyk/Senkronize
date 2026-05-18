import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
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
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService, type IssueTokenResult } from './auth.service';
import {
  AcceptInviteDto,
  ChangePasswordDto,
  LoginDto,
  RecommendPlanDto,
  RefreshTokenDto,
  RegisterDto,
  UpdateProfileDto,
} from './auth.dto';
import {
  TwoFactorDisableDto,
  TwoFactorEnableDto,
  TwoFactorRegenerateBackupDto,
  TwoFactorVerifyLoginDto,
} from './two-factor.dto';
import { TwoFactorService } from './two-factor.service';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtRefreshAuthGuard } from './jwt-refresh-auth.guard';
import { JwtRefreshValidatedUser } from './jwt-refresh.strategy';
import { UserInviteService } from '../users/user-invite.service';

@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: 5 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly userInviteService: UserInviteService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni hesap ve organizasyon oluştur' })
  @ApiResponse({ status: 201, description: 'Kayıt tamamlandı' })
  @ApiResponse({ status: 409, description: 'E-posta zaten kayıtlı' })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<IssueTokenResult> {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 30 } })
  @Get('invite-preview')
  @ApiOperation({ summary: 'Organizasyon daveti önizleme (herkese açık)' })
  @ApiResponse({ status: 200, description: 'Davet bilgisi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async invitePreview(@Query('token') token: string) {
    return this.userInviteService.getInvitePreview(token ?? '');
  }

  @Throttle({ default: { limit: 20 } })
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Organizasyon davetini kabul et' })
  @ApiResponse({ status: 200, description: 'Oturum açıldı' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  async acceptInvite(
    @Query('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Req() req: Request,
  ): Promise<IssueTokenResult> {
    const ipAddress = req.ip ?? req.socket?.remoteAddress ?? undefined;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;
    return this.userInviteService.acceptInvite(token ?? '', dto.password, dto.name, {
      ipAddress,
      userAgent,
    });
  }

  @Throttle({ default: { limit: 20 } })
  @Post('recommend-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'İş yapısına göre paket önerisi' })
  @ApiResponse({ status: 200, description: 'Önerilen plan' })
  recommendPlan(
    @Body() dto: RecommendPlanDto,
  ): { recommendedPlan: 'BASLANGIC' | 'GELISIM' | 'PRO' | 'KURUMSAL'; reason: string } {
    return this.authService.recommendPlan(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Giriş' })
  @ApiResponse({ status: 200, description: 'Token çifti veya 2FA gerekli' })
  @ApiResponse({ status: 401, description: 'Geçersiz kimlik bilgileri' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<
    | IssueTokenResult
    | { requiresTwoFactor: true; tempToken: string }
  > {
    const ipAddress = req.ip ?? req.socket?.remoteAddress ?? undefined;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  @Throttle({ default: { limit: 30 } })
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'İki adımlı doğrulama ile girişi tamamla' })
  @ApiResponse({ status: 200, description: 'Token çifti' })
  @ApiResponse({ status: 401, description: 'Geçersiz kod veya jeton' })
  async verifyTwoFactorLogin(
    @Body() dto: TwoFactorVerifyLoginDto,
    @Req() req: Request,
  ): Promise<IssueTokenResult> {
    const ipAddress = req.ip ?? req.socket?.remoteAddress ?? undefined;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;
    return this.authService.completeTwoFactorLogin(
      dto.tempToken,
      dto.code,
      { ipAddress, userAgent },
    );
  }

  @SkipThrottle()
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA kurulumu başlat (QR ve yedek kodlar)' })
  @ApiResponse({ status: 200, description: 'Kurulum verisi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.setupTwoFactor(user.id);
  }

  @SkipThrottle()
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA doğrula ve etkinleştir' })
  @ApiResponse({ status: 200, description: 'Etkinleştirildi' })
  @ApiResponse({ status: 400, description: 'Geçersiz veri' })
  @ApiResponse({ status: 401, description: 'Geçersiz kod' })
  async enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorEnableDto,
  ): Promise<{ ok: true }> {
    await this.twoFactorService.enableTwoFactor(user, dto.token, dto.backupCodes);
    return { ok: true };
  }

  @SkipThrottle()
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA kapat' })
  @ApiResponse({ status: 200, description: 'Kapatıldı' })
  @ApiResponse({ status: 401, description: 'Geçersiz kod' })
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorDisableDto,
  ): Promise<{ ok: true }> {
    await this.twoFactorService.disableTwoFactor(user, dto.token);
    return { ok: true };
  }

  @SkipThrottle()
  @Post('2fa/regenerate-backup-codes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yeni yedek kodlar üret (tek sefer gösterilir)' })
  @ApiResponse({ status: 200, description: 'Yeni düz metin yedek kodlar' })
  @ApiResponse({ status: 401, description: 'Geçersiz kod' })
  async regenerateBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorRegenerateBackupDto,
  ): Promise<{ backupCodes: string[] }> {
    const backupCodes = await this.twoFactorService.regenerateBackupCodes(
      user,
      dto.token,
    );
    return { backupCodes };
  }

  @Throttle({ default: { limit: 20 } })
  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  @ApiOperation({ summary: 'Access token yenile' })
  @ApiResponse({ status: 200, description: 'Yeni token çifti' })
  @ApiResponse({ status: 401, description: 'Geçersiz yenileme jetonu' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request & { user: JwtRefreshValidatedUser },
  ): Promise<IssueTokenResult> {
    const ipAddress = req.ip ?? req.socket?.remoteAddress ?? undefined;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;
    return this.authService.refresh(req.user.id, dto.refreshToken, {
      ipAddress,
      userAgent,
    });
  }

  @SkipThrottle()
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

  @SkipThrottle()
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
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      organization,
      currentOrgId: user.currentOrgId,
      isImpersonating: user.isImpersonating,
    };
  }

  @SkipThrottle()
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

  @SkipThrottle()
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
