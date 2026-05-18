import {
  BadRequestException,
  Controller,
  ForbiddenException,
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

  @Post('hepsiburada/:connectionId')
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Hepsiburada webhook (SHA-256 doğrulama)' })
  @ApiResponse({ status: 200, description: 'Kabul edildi' })
  @ApiResponse({ status: 403, description: 'İmza veya yapılandırma hatası' })
  @ApiResponse({ status: 404, description: 'Bağlantı bulunamadı' })
  async handleHepsiburada(
    @Param('connectionId') connectionId: string,
    @Headers('x-hb-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Ham gövde kullanılamıyor');
    }
    const isValid = await this.webhookService.verifyHepsiburadaSignature(
      signature,
      rawBody,
      connectionId,
    );
    if (!isValid) {
      throw new ForbiddenException('Geçersiz imza');
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Geçersiz JSON');
    }

    await this.webhookService.processHepsiburadaWebhook(connectionId, body);
    return { ok: true };
  }
}
