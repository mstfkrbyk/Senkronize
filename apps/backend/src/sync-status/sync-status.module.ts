import { Module } from '@nestjs/common';
import { ApiKeyModule } from '../api-key/api-key.module';
import { SyncStatusController } from './sync-status.controller';
import { SyncStatusService } from './sync-status.service';

@Module({
  imports: [ApiKeyModule],
  controllers: [SyncStatusController],
  providers: [SyncStatusService],
  exports: [SyncStatusService],
})
export class SyncStatusModule {}
