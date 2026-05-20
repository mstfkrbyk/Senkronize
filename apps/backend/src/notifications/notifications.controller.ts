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
import type { InAppNotification } from '@prisma/client';
import type { PaginatedResult } from '@senkronize/shared';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { InAppService } from './in-app.service';
import { NotificationsListQueryDto } from './notifications.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly inAppService: InAppService) {}

  @Get('count')
  @ApiOperation({ summary: 'Okunmamış bildirim sayısı' })
  @ApiResponse({ status: 200, description: 'Sayı' })
  async count(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    const count = await this.inAppService.getUnreadCountForOrg(org.id, user.id);
    return { count };
  }

  @Get()
  @ApiOperation({ summary: 'Bildirim listesi (sayfalı)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationsListQueryDto,
  ): Promise<PaginatedResult<InAppNotification>> {
    return this.inAppService.getPaginatedForOrg(org.id, user.id, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      unreadOnly: query.unreadOnly,
    });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Tüm bildirimleri okundu işaretle' })
  @ApiResponse({ status: 200, description: 'Tamamlandı' })
  async markAllRead(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.inAppService.markAllAsReadForOrg(org.id, user.id);
    return { success: true };
  }

  @Delete()
  @ApiOperation({ summary: 'Tüm bildirimleri sil' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async deleteAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; deleted: number }> {
    const deleted = await this.inAppService.deleteAllForOrg(org.id, user.id);
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
    await this.inAppService.markAsReadForOrg(id, org.id, user.id);
    return { success: true };
  }
}
