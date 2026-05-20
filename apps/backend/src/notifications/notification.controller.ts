import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateNotificationPreferencesDto } from './notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Bildirim tercihleri' })
  @ApiResponse({ status: 200, description: 'Tercihler' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.notificationService.getPreferences(
      user.id,
      user.currentOrgId,
    );
    return { data };
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Bildirim tercihlerini güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const data = await this.notificationService.updatePreferences(
      user.id,
      user.currentOrgId,
      dto,
    );
    return { data };
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Test e-postası gönder' })
  @ApiResponse({ status: 201, description: 'Gönderildi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async sendTestEmail(@CurrentUser() user: AuthenticatedUser) {
    await this.notificationService.sendTestEmail(user.id, user.currentOrgId);
    return { success: true };
  }

  @Post('test-push')
  @ApiOperation({ summary: 'Test push bildirimi gönder' })
  @ApiResponse({ status: 201, description: 'Gönderildi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async sendTestPush(@CurrentUser() user: AuthenticatedUser) {
    await this.notificationService.sendTestPush(user.id);
    return { success: true };
  }
}
