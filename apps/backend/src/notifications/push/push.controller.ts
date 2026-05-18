import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SubscribePushDto, UnsubscribePushDto } from './push.dto';
import { PushService } from './push.service';

@ApiTags('push')
@ApiBearerAuth()
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Web Push VAPID public key' })
  @ApiResponse({ status: 200, description: 'Public key veya yapılandırma yok' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  getVapidPublicKey(): { publicKey: string | null } {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Get('status')
  @ApiOperation({ summary: 'Tarayıcı push aboneliği var mı' })
  @ApiResponse({ status: 200, description: 'Durum' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ subscribed: boolean }> {
    const subscribed = await this.pushService.hasActiveSubscription(user.id);
    return { subscribed };
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Push subscription kaydet' })
  @ApiResponse({ status: 201, description: 'Kaydedildi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscribePushDto,
  ): Promise<{ success: true }> {
    await this.pushService.saveSubscription(user.id, dto);
    return { success: true };
  }

  @Delete('unsubscribe')
  @ApiOperation({ summary: 'Push subscription kaldır' })
  @ApiResponse({ status: 200, description: 'Kaldırıldı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnsubscribePushDto,
  ): Promise<{ success: true }> {
    await this.pushService.removeSubscription(user.id, dto.endpoint);
    return { success: true };
  }
}
