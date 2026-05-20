import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ConnectionHealthService } from '../connection-health/connection-health.service';
import { PrismaService } from '../prisma/prisma.service';

import { ConnectionsService } from './connections.service';
import type { UnifiedConnectionItem } from './connections.types';

@ApiTags('connections')
@ApiBearerAuth()
@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly connectionHealthService: ConnectionHealthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tüm entegrasyon bağlantılarını listele' })
  @ApiResponse({ status: 200, description: 'Birleşik bağlantı listesi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async listAll(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: UnifiedConnectionItem[] }> {
    const data = await this.connectionsService.listAll(org.id);
    return { data };
  }

  @Get(':id/health')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bağlantı sağlık durumu (tür otomatik)' })
  @ApiResponse({ status: 200, description: 'Sağlık özeti' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async getHealth(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ) {
    const [marketplace, erp] = await Promise.all([
      this.prisma.marketplaceConnection.findFirst({
        where: { id, organizationId: org.id, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.erpConnection.findFirst({
        where: { id, organizationId: org.id, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (marketplace) {
      const data = await this.connectionHealthService.getMarketplaceHealth(
        org.id,
        id,
      );
      return { data };
    }
    if (erp) {
      const data = await this.connectionHealthService.getErpHealth(org.id, id);
      return { data };
    }
    throw new NotFoundException('Bağlantı bulunamadı');
  }
}
