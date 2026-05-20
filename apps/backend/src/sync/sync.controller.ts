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
import { ConflictListQueryDto, ResolveConflictDto } from './sync.dto';
import {
  serializeConflict,
  type AutoResolveResult,
  type ConflictStats,
  type SerializedSyncConflict,
} from './sync.types';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly conflictService: ConflictService) {}

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
