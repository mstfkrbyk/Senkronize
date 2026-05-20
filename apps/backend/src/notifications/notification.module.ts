import { Module } from '@nestjs/common';

import { InAppNotificationModule } from './in-app/in-app-notification.module';
import { PushModule } from './push/push.module';
import { NotificationController } from './notification.controller';
import { NotificationDigestTask } from './digest.task';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [InAppNotificationModule, PushModule],
  controllers: [NotificationController],
  providers: [
    NotificationPreferencesService,
    NotificationService,
    NotificationDigestTask,
  ],
  exports: [NotificationService, NotificationPreferencesService],
})
export class NotificationsModule {}
