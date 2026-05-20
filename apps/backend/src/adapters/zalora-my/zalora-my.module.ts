import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ZaloraMyAdapter } from './zalora-my.adapter';

@Module({
  imports: [CommonModule],
  providers: [ZaloraMyAdapter],
  exports: [ZaloraMyAdapter],
})
export class ZaloraMyModule {}
