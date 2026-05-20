import { Module } from '@nestjs/common';

import { InAppService } from '../in-app.service';

import { InAppNotificationService } from './in-app-notification.service';

@Module({
  providers: [InAppService, InAppNotificationService],
  exports: [InAppService, InAppNotificationService],
})
export class InAppNotificationModule {}
