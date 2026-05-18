import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../../auth/auth.types';
import { CurrentOrg, CurrentOrgPayload } from '../../auth/current-org.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

import {
  InAppNotificationListQueryDto,
  type InAppNotificationListFilter,
} from './in-app-notification.dto';
import { InAppNotificationService } from './in-app-notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class InAppNotificationController {
  constructor(
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  @Get('unread-count')
  @ApiOperation({ summary: 'Okunmamış bildirim sayısı' })
  @ApiResponse({ status: 200, description: 'Sayı' })
  async unreadCount(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    const count = await this.inAppNotificationService.getUnreadCount(
      org.id,
      user.id,
    );
    return { count };
  }

  @Get()
  @ApiOperation({ summary: 'Bildirim listesi (sayfalı)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InAppNotificationListQueryDto,
  ): Promise<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
    filter: InAppNotificationListFilter;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = query.filter ?? 'all';
    const { data, total } = await this.inAppNotificationService.getAll(
      org.id,
      user.id,
      page,
      limit,
      filter,
    );
    return { data, total, page, limit, filter };
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Tüm bildirimleri okundu işaretle' })
  @ApiResponse({ status: 200, description: 'Tamamlandı' })
  async markAllRead(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.inAppNotificationService.markAllAsRead(org.id, user.id);
    return { success: true };
  }

  @Delete('all')
  @ApiOperation({ summary: 'Tüm bildirimleri sil' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async deleteAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; deleted: number }> {
    const { deleted } = await this.inAppNotificationService.deleteAllForUser(
      org.id,
      user.id,
    );
    return { success: true, deleted };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Bildirimi okundu işaretle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async markRead(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.inAppNotificationService.markAsRead(id, org.id, user.id);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bildirimi sil' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.inAppNotificationService.deleteNotification(id, org.id, user.id);
    return { success: true };
  }
}
