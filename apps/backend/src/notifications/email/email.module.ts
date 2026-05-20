import { Global, Module, forwardRef } from '@nestjs/common';

import { SuperAdminGuard } from '../../admin/admin.guard';
import { AuthModule } from '../../auth/auth.module';
import { EmailPreviewController } from './email-preview.controller';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [EmailPreviewController],
  providers: [EmailTemplateService, EmailService, SuperAdminGuard],
  exports: [EmailService, EmailTemplateService],
})
export class EmailModule {}
