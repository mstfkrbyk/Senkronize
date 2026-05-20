import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Marketplace } from '@prisma/client';
import type { Response } from 'express';

import { Public } from '../auth/public.decorator';

import { OAuthCallbackService } from './oauth-callback.service';

@ApiTags('oauth')
@Controller('oauth')
@SkipThrottle()
export class OAuthCallbackController {
  constructor(private readonly oauthCallbackService: OAuthCallbackService) {}

  @Public()
  @Get('callback/lazada')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Lazada OAuth2 callback (kod değişimi)' })
  @ApiResponse({ status: 302, description: 'Panele yönlendirme' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  async lazadaCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthRedirect(res, Marketplace.LAZADA, code, state, error);
  }

  @Public()
  @Get('callback/shopee')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Shopee OAuth2 callback (kod değişimi)' })
  @ApiResponse({ status: 302, description: 'Panele yönlendirme' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  async shopeeCallback(
    @Query('code') code: string | undefined,
    @Query('shop_id') shopId: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthRedirect(
      res,
      Marketplace.SHOPEE,
      code,
      state,
      error,
      shopId,
    );
  }

  @Public()
  @Get('callback/mercadolibre')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Mercado Libre OAuth2 callback (kod değişimi)' })
  @ApiResponse({ status: 302, description: 'Panele yönlendirme' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  async mercadolibreCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthRedirect(
      res,
      Marketplace.MERCADOLIBRE,
      code,
      state,
      error,
    );
  }

  private async handleOAuthRedirect(
    res: Response,
    platform: Marketplace,
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    shopId?: string,
  ): Promise<void> {
    if (typeof error === 'string' && error.length > 0) {
      this.oauthCallbackService.logCallbackFailure(platform, 'provider_error');
      res.redirect(this.oauthCallbackService.panelRedirectUrl(false, platform));
      return;
    }
    if (typeof code !== 'string' || typeof state !== 'string') {
      this.oauthCallbackService.logCallbackFailure(platform, 'missing_params');
      res.redirect(this.oauthCallbackService.panelRedirectUrl(false, platform));
      return;
    }
    if (platform === Marketplace.SHOPEE && typeof shopId !== 'string') {
      this.oauthCallbackService.logCallbackFailure(platform, 'missing_shop_id');
      res.redirect(this.oauthCallbackService.panelRedirectUrl(false, platform));
      return;
    }
    try {
      const result =
        platform === Marketplace.LAZADA
          ? await this.oauthCallbackService.completeLazadaCallback(code, state)
          : platform === Marketplace.SHOPEE
            ? await this.oauthCallbackService.completeShopeeCallback(
                code,
                state,
                shopId as string,
              )
            : await this.oauthCallbackService.completeMercadolibreCallback(
                code,
                state,
              );
      res.redirect(
        this.oauthCallbackService.panelRedirectUrl(
          true,
          platform,
          result.connectionId,
        ),
      );
    } catch {
      this.oauthCallbackService.logCallbackFailure(platform, 'exchange_failed');
      res.redirect(this.oauthCallbackService.panelRedirectUrl(false, platform));
    }
  }
}
