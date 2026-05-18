import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../auth/public.decorator';

import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks')
@SkipThrottle()
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

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
