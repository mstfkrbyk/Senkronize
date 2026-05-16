import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncStatusService } from './sync-status.service';
import type { SyncHealthStatus } from './sync-status.types';

@ApiTags('Senkronizasyon')
@ApiBearerAuth()
@Controller('sync')
export class SyncStatusController {
  constructor(private readonly syncStatusService: SyncStatusService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pazaryeri entegrasyon sağlık durumu' })
  @ApiResponse({ status: 200, description: 'Bağlantı durumları' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getStatus(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<SyncHealthStatus[]> {
    return this.syncStatusService.getStatus(org.id);
  }
}
