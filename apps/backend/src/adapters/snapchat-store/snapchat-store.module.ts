import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SnapchatStoreAdapter } from './snapchat-store.adapter';

@Module({
  imports: [CommonModule],
  providers: [SnapchatStoreAdapter],
  exports: [SnapchatStoreAdapter],
})
export class SnapchatStoreModule {}
