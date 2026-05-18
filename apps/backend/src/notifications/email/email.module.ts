import { Global, Module } from '@nestjs/common';

import { EmailPreviewController } from './email-preview.controller';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';

const previewControllers =
  process.env.NODE_ENV === 'development' ? [EmailPreviewController] : [];

@Global()
@Module({
  controllers: previewControllers,
  providers: [EmailTemplateService, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
