import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../notifications/email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

import { SupportAdminController } from './support-admin.controller';
import { SupportController } from './support.controller';
import { SupportReminderTask } from './support-reminder.task';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule, AuthModule, EmailModule, AdminModule],
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService, SupportReminderTask],
  exports: [SupportService],
})
export class SupportModule {}
