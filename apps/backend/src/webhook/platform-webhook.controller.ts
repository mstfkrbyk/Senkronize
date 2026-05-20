import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../auth/public.decorator';

import { PlatformWebhookService } from './platform-webhook.service';

@ApiTags('webhooks')
@Controller('webhooks/platform')
@SkipThrottle()
export class PlatformWebhookController {
  constructor(private readonly platformWebhookService: PlatformWebhookService) {}

  @Public()
  @Post('trendyol/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trendyol platform webhook (org bazlı)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async trendyol(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handle(Marketplace.TRENDYOL, orgId, headers, req);
  }

  @Public()
  @Post('hepsiburada/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hepsiburada platform webhook (org bazlı)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async hepsiburada(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handle(Marketplace.HEPSIBURADA, orgId, headers, req);
  }

  @Public()
  @Post('n11/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'n11 platform webhook (org bazlı)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async n11(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handle(Marketplace.N11, orgId, headers, req);
  }

  @Public()
  @Post('amazon/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Amazon TR SNS webhook (org bazlı)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async amazon(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handle(Marketplace.AMAZON_TR, orgId, headers, req);
  }

  private handle(
    platform: Marketplace,
    orgId: string,
    headers: Record<string, string>,
    req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Ham gövde kullanılamıyor');
    }
    return this.platformWebhookService.handlePlatformWebhook(
      platform,
      orgId.trim(),
      headers,
      raw,
    );
  }
}
