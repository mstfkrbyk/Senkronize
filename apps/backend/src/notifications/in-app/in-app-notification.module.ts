import { Module } from '@nestjs/common';

import { InAppNotificationController } from './in-app-notification.controller';
import { InAppNotificationService } from './in-app-notification.service';

@Module({
  controllers: [InAppNotificationController],
  providers: [InAppNotificationService],
  exports: [InAppNotificationService],
})
export class InAppNotificationModule {}
