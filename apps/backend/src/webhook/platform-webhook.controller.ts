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
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
@SkipThrottle()
export class PlatformWebhookController {
  constructor(
    private readonly platformWebhookService: PlatformWebhookService,
    private readonly webhookService: WebhookService,
  ) {}

  @Public()
  @Post('trendyol/:connectionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trendyol sipariş durum webhook (bağlantı kimliği)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async trendyol(
    @Param('connectionId') connectionId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByConnection(
      Marketplace.TRENDYOL,
      connectionId,
      headers,
      req,
    );
  }

  @Public()
  @Post('hepsiburada/:connectionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hepsiburada kargo/sipariş webhook (bağlantı kimliği)',
  })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async hepsiburada(
    @Param('connectionId') connectionId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByConnection(
      Marketplace.HEPSIBURADA,
      connectionId,
      headers,
      req,
    );
  }

  @Public()
  @Post('etsy/:connectionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Etsy webhook ping / olay (bağlantı kimliği)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async etsy(
    @Param('connectionId') connectionId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByConnection(Marketplace.ETSY, connectionId, headers, req);
  }

  @Public()
  @Post('woocommerce/orders/created')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce sipariş oluştu webhook' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async woocommerceOrderCreated(
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleWooCommerceTopic('order.created', headers, req);
  }

  @Public()
  @Post('woocommerce/orders/updated')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce sipariş güncellendi webhook' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async woocommerceOrderUpdated(
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleWooCommerceTopic('order.updated', headers, req);
  }

  @Public()
  @Post('woocommerce/:connectionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce webhook (bağlantı kimliği)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async woocommerce(
    @Param('connectionId') connectionId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByConnection(
      Marketplace.WOOCOMMERCE,
      connectionId,
      headers,
      req,
    );
  }

  @Public()
  @Post('shopify/:shopDomain')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Shopify webhook (mağaza alan adı; X-Shopify-Hmac-Sha256 doğrulama)',
  })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async shopifyByShopDomain(
    @Param('shopDomain') shopDomain: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Ham gövde kullanılamıyor');
    }
    const merged: Record<string, string> = {
      ...headers,
      'x-shopify-shop-domain':
        headers['x-shopify-shop-domain'] ??
        headers['X-Shopify-Shop-Domain'] ??
        decodeURIComponent(shopDomain.trim()),
    };
    return this.webhookService.handleInboundPlatformWebhook(
      'shopify',
      merged,
      raw,
    );
  }

  @Public()
  @Post('platform/trendyol/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trendyol platform webhook (org bazlı, eski)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async trendyolByOrg(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByOrg(Marketplace.TRENDYOL, orgId, headers, req);
  }

  @Public()
  @Post('platform/hepsiburada/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hepsiburada platform webhook (org bazlı, eski)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async hepsiburadaByOrg(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByOrg(Marketplace.HEPSIBURADA, orgId, headers, req);
  }

  @Public()
  @Post('platform/n11/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'n11 platform webhook (org bazlı)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async n11(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByOrg(Marketplace.N11, orgId, headers, req);
  }

  @Public()
  @Post('platform/amazon/:orgId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Amazon TR SNS webhook (org bazlı)' })
  @ApiResponse({ status: 200, description: 'Alındı' })
  async amazon(
    @Param('orgId') orgId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    return this.handleByOrg(Marketplace.AMAZON_TR, orgId, headers, req);
  }

  private handleByConnection(
    platform: Marketplace,
    connectionId: string,
    headers: Record<string, string>,
    req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Ham gövde kullanılamıyor');
    }
    return this.platformWebhookService.handlePlatformWebhookByConnectionId(
      platform,
      connectionId.trim(),
      headers,
      raw,
    );
  }

  private handleByOrg(
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

  private handleWooCommerceTopic(
    eventType: string,
    headers: Record<string, string>,
    req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Ham gövde kullanılamıyor');
    }
    return this.webhookService.handleInboundPlatformWebhook(
      'woocommerce',
      headers,
      raw,
      undefined,
      eventType,
    );
  }
}
