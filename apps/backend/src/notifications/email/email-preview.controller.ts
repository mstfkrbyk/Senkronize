import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  EmailTemplateService,
  isEmailPreviewTemplate,
} from './email-template.service';

@Controller()
export class EmailPreviewController {
  constructor(private readonly templateService: EmailTemplateService) {}

  @Get('dev/email-preview/:template')
  previewTemplate(
    @Param('template') template: string,
    @Res() res: Response,
  ): void {
    if (process.env.NODE_ENV !== 'development') {
      throw new NotFoundException();
    }
    if (!isEmailPreviewTemplate(template)) {
      throw new BadRequestException(
        `Geçersiz şablon. Geçerli değerler: welcome, order-new, low-stock, trial-expiring, plan-changed, invoice, partner-invite`,
      );
    }
    const html = this.templateService.previewHtml(template);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
