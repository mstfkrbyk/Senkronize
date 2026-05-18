import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtOrApiKeyGuard } from '../api-key/jwt-or-api-key.guard';
import { SyncStatusService } from './sync-status.service';
import type { SyncHealthStatus } from './sync-status.types';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncStatusController {
  constructor(private readonly syncStatusService: SyncStatusService) {}

  @Get('status')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Pazaryeri entegrasyon sağlık durumu' })
  @ApiResponse({ status: 200, description: 'Bağlantı durumları' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getStatus(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<SyncHealthStatus[]> {
    return this.syncStatusService.getStatus(org.id);
  }

  @Post(':connectionId/trigger')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Bağlantı için manuel senkron kuyruğa al' })
  @ApiResponse({ status: 200, description: 'İşler kuyruğa eklendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Pasif bağlantı' })
  @ApiResponse({ status: 404, description: 'Bağlantı bulunamadı' })
  async triggerSync(
    @Param('connectionId') connectionId: string,
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ message: string }> {
    await this.syncStatusService.triggerManualSync(connectionId, org.id);
    return { message: 'Sync queued' };
  }
}
