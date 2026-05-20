import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ERPConnectionResult } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestErpConnectionDto } from '../erp-connection/erp-connection.dto';

@ApiTags('erp')
@ApiBearerAuth()
@Controller('erp')
export class ErpController {
  constructor(private readonly adapterRegistry: AdapterRegistry) {}

  @Post('connections/test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Geçici ERP kimlik bilgileri ile bağlantı testi' })
  @ApiResponse({ status: 200, description: 'Test sonucu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async testConnection(
    @CurrentOrg() _org: CurrentOrgPayload,
    @Body() dto: TestErpConnectionDto,
  ): Promise<ERPConnectionResult> {
    if (dto.connectionId) {
      throw new BadRequestException(
        'Kayıtlı bağlantı testi için /erp-connections/test kullanın.',
      );
    }
    if (dto.erpType === undefined || dto.credentials === undefined) {
      throw new BadRequestException('erpType ve credentials zorunludur.');
    }
    if (!this.adapterRegistry.hasErpAdapter(dto.erpType)) {
      return { success: false };
    }
    const adapter = this.adapterRegistry.getErp(dto.erpType);
    return adapter.testConnection(dto.credentials);
  }
}
