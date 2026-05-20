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
import type { Response } from 'express';

import { Public } from '../auth/public.decorator';

import { OAuthCallbackService } from './oauth-callback.service';

@ApiTags('oauth')
@Controller('oauth')
@SkipThrottle()
export class OAuthCallbackController {
  constructor(private readonly oauthCallbackService: OAuthCallbackService) {}

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
    if (typeof error === 'string' && error.length > 0) {
      res.redirect(this.oauthCallbackService.panelRedirectUrl(false));
      return;
    }
    if (typeof code !== 'string' || typeof state !== 'string') {
      res.redirect(this.oauthCallbackService.panelRedirectUrl(false));
      return;
    }
    try {
      const result = await this.oauthCallbackService.completeMercadolibreCallback(
        code,
        state,
      );
      res.redirect(
        this.oauthCallbackService.panelRedirectUrl(true, result.connectionId),
      );
    } catch {
      res.redirect(this.oauthCallbackService.panelRedirectUrl(false));
    }
  }
}
