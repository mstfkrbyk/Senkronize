import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { WebhookService } from './webhook.service';

@ApiTags('Webhooklar')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('trendyol/:connectionId')
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Trendyol webhook (HMAC)' })
  @ApiResponse({ status: 200, description: 'Kabul edildi' })
  @ApiResponse({ status: 403, description: 'İmza veya yapılandırma hatası' })
  @ApiResponse({ status: 404, description: 'Bağlantı bulunamadı' })
  async trendyol(
    @Param('connectionId') connectionId: string,
    @Headers('x-trendyol-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: true }> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Ham gövde kullanılamıyor');
    }
    await this.webhookService.acceptTrendyolWebhook(
      connectionId,
      signature,
      raw,
    );
    return { ok: true };
  }
}
