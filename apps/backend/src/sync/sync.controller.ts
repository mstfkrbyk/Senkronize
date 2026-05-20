import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ConflictService } from './conflict.service';
import { ListingSyncService } from './listing-sync.service';
import type { QueueDepthStatus } from './listing-sync.types';
import { SyncLogService } from './sync-log.service';
import {
  ConflictListQueryDto,
  ResolveConflictDto,
  SyncLogListQueryDto,
} from './sync.dto';
import {
  serializeConflict,
  serializeSyncLog,
  type AutoResolveResult,
  type ConflictStats,
  type SerializedSyncConflict,
  type SerializedSyncLog,
} from './sync.types';
import type { PlatformSyncStat } from './sync-log.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(
    private readonly conflictService: ConflictService,
    private readonly syncLogService: SyncLogService,
    private readonly listingSyncService: ListingSyncService,
  ) {}

  @Get('queues')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Senkronizasyon kuyruk derinlikleri' })
  @ApiResponse({ status: 200 })
  async getQueueStatus(): Promise<{ data: QueueDepthStatus[] }> {
    const data = await this.listingSyncService.getQueueDepths();
    return { data };
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Senkronizasyon geçmişi' })
  @ApiResponse({ status: 200 })
  async listSyncLogs(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: SyncLogListQueryDto,
  ): Promise<{ data: SerializedSyncLog[] }> {
    const rows = await this.syncLogService.getRecentLogs(org.id, {
      platform: query.platform,
      status: query.status,
      limit: query.limit,
      jobTypeStartsWith: query.jobTypeStartsWith,
    });
    return { data: rows.map(serializeSyncLog) };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Platform bazlı senkron başarı oranı' })
  @ApiResponse({ status: 200 })
  async syncStats(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: PlatformSyncStat[] }> {
    const data = await this.syncLogService.getPlatformSyncStats(org.id);
    return { data };
  }

  @Get('conflicts')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Senkronizasyon çakışmalarını listele' })
  @ApiResponse({ status: 200 })
  async listConflicts(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ConflictListQueryDto,
  ): Promise<{ data: SerializedSyncConflict[] }> {
    const rows = await this.conflictService.listConflicts(org.id, query);
    return { data: rows.map(serializeConflict) };
  }

  @Get('conflicts/stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Çakışma istatistikleri' })
  @ApiResponse({ status: 200 })
  async conflictStats(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: ConflictStats }> {
    const data = await this.conflictService.getStats(org.id);
    return { data };
  }

  @Post('conflicts/detect')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok çakışmalarını tespit et' })
  @ApiResponse({ status: 201 })
  async detectConflicts(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: SerializedSyncConflict[] }> {
    const rows = await this.conflictService.detectStockConflicts(org.id);
    return { data: rows.map(serializeConflict) };
  }

  @Post('conflicts/:id/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Çakışmayı çöz' })
  @ApiResponse({ status: 200 })
  async resolveConflict(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveConflictDto,
  ): Promise<{ success: true }> {
    await this.conflictService.resolveConflict(
      org.id,
      id,
      dto.resolution,
      user.id,
      dto.notes,
    );
    return { success: true };
  }

  @Post('conflicts/auto-resolve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bekleyen çakışmaları otomatik çöz' })
  @ApiResponse({ status: 200 })
  async autoResolve(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: AutoResolveResult }> {
    const data = await this.conflictService.autoResolve(org.id);
    return { data };
  }
}
