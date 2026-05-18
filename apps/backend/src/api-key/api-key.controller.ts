import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  ApiKeyListItemDto,
  CreateApiKeyDto,
  CreatedApiKeyResponseDto,
} from './api-key.dto';
import { ApiKeyService } from './api-key.service';

@ApiTags('API Anahtarları')
@ApiBearerAuth()
@Controller('api-keys')
@Throttle({ default: { limit: 60 } })
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aktif API anahtarları' })
  @ApiResponse({ status: 200, description: 'Liste', type: [ApiKeyListItemDto] })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async list(@CurrentOrg() org: CurrentOrgPayload): Promise<ApiKeyListItemDto[]> {
    return this.apiKeyService.listActive(org.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni API anahtarı oluştur' })
  @ApiResponse({ status: 201, description: 'Anahtar (tam değer yalnızca bu yanıtta)', type: CreatedApiKeyResponseDto })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyResponseDto> {
    return this.apiKeyService.create(org.id, dto.name);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'API anahtarını devre dışı bırak' })
  @ApiResponse({ status: 204, description: 'Devre dışı bırakıldı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.apiKeyService.softDisable(org.id, id);
  }
}
