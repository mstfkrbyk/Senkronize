import { Module } from '@nestjs/common';

import { ReportsModule } from '../reports/reports.module';

import { EmailModule } from './email/email.module';
import { InAppNotificationModule } from './in-app/in-app-notification.module';
import { NotificationController } from './notification.controller';
import { NotificationDigestTask } from './digest.task';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { PushModule } from './push/push.module';

@Module({
  imports: [InAppNotificationModule, PushModule, EmailModule, ReportsModule],
  controllers: [NotificationController, NotificationsController],
  providers: [
    NotificationPreferencesService,
    NotificationService,
    NotificationDigestTask,
  ],
  exports: [
    NotificationService,
    NotificationPreferencesService,
    InAppNotificationModule,
  ],
})
export class NotificationsModule {}
