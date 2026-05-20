import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LuluOnlineAdapter } from './lulu-online.adapter';

@Module({
  imports: [CommonModule],
  providers: [LuluOnlineAdapter],
  exports: [LuluOnlineAdapter],
})
export class LuluOnlineModule {}
