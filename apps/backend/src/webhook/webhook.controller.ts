import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  type RawBodyRequest,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { WebhookDelivery, WebhookEndpoint } from '@prisma/client';
import type { Request } from 'express';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

import {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
} from './outbound-webhook.dto';
import { OutboundWebhookService } from './outbound-webhook.service';
import { WebhookService } from './webhook.service';

function omitWebhookSecret(row: WebhookEndpoint): Omit<WebhookEndpoint, 'secret'> {
  const { secret: _secret, ...rest } = row;
  return rest;
}

@ApiTags('Webhooks')
@Controller('webhooks')
@SkipThrottle()
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly outboundWebhookService: OutboundWebhookService,
  ) {}

  @Get('endpoints')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giden webhook uç noktaları' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async listEndpoints(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<Omit<WebhookEndpoint, 'secret'>[]> {
    const rows = await this.outboundWebhookService.listEndpoints(org.id);
    return rows.map(omitWebhookSecret);
  }

  @Post('endpoints')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giden webhook uç noktası oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async createEndpoint(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    return this.outboundWebhookService.createEndpoint(org.id, dto);
  }

  @Patch('endpoints/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giden webhook uç noktasını güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async updateEndpoint(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ): Promise<Omit<WebhookEndpoint, 'secret'>> {
    const row = await this.outboundWebhookService.updateEndpoint(org.id, id, dto);
    return omitWebhookSecret(row);
  }

  @Delete('endpoints/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giden webhook uç noktasını sil' })
  @ApiResponse({ status: 204, description: 'Silindi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async deleteEndpoint(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.outboundWebhookService.deleteEndpoint(org.id, id);
  }

  @Post('endpoints/:id/test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test webhook gönder' })
  @ApiResponse({ status: 200, description: 'Teslimat kaydı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async testEndpoint(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<WebhookDelivery> {
    return this.outboundWebhookService.testEndpoint(org.id, id);
  }

  @Get('endpoints/:id/deliveries')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Webhook teslimat geçmişi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async listDeliveries(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<WebhookDelivery[]> {
    return this.outboundWebhookService.getDeliveries(org.id, id);
  }

  @Public()
  @Post(':platform')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pazaryeri webhook (imza doğrulamalı)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 403, description: 'İmza veya yapılandırma hatası' })
  @ApiResponse({ status: 404, description: 'Bağlantı bulunamadı' })
  async handleWebhook(
    @Param('platform') platform: string,
    @Headers() headers: Record<string, string>,
    @Query('connectionId') connectionId: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Ham gövde kullanılamıyor');
    }
    return this.webhookService.handleInboundPlatformWebhook(
      platform,
      headers,
      raw,
      connectionId,
    );
  }
}
