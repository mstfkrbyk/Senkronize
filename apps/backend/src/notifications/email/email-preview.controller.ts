import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { SuperAdminGuard } from '../../admin/admin.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  EmailTemplateService,
  isEmailPreviewTemplate,
} from './email-template.service';

@Controller()
export class EmailPreviewController {
  constructor(private readonly templateService: EmailTemplateService) {}

  @Get('email-preview/:template')
  @UseGuards(
    ...(process.env.NODE_ENV === 'development'
      ? []
      : [JwtAuthGuard, SuperAdminGuard]),
  )
  previewTemplate(
    @Param('template') template: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): void {
    if (
      process.env.NODE_ENV !== 'development' &&
      process.env.EMAIL_PREVIEW_ENABLED !== 'true'
    ) {
      throw new NotFoundException();
    }
    if (!isEmailPreviewTemplate(template)) {
      throw new BadRequestException(
        `Geçersiz şablon. Geçerli değerler: ${[
          'welcome',
          'password-reset',
          'subscription-activated',
          'subscription-expiring',
          'stock-alert',
          'weekly-report',
          'order-new',
          'low-stock',
          'trial-expiring',
          'plan-changed',
          'invoice',
          'partner-invite',
        ].join(', ')}`,
      );
    }
    const { template: _t, ...vars } = query;
    const html = this.templateService.previewHtml(template, vars);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
