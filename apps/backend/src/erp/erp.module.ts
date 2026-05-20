import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

import { ErpController } from './erp.controller';
import { ErpSyncSettingsService } from './erp-sync-settings.service';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [ErpController],
  providers: [ErpSyncSettingsService],
  exports: [ErpSyncSettingsService],
})
export class ErpModule {}
