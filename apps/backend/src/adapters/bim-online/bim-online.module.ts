import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BimOnlineAdapter } from './bim-online.adapter';

@Module({
  imports: [CommonModule],
  providers: [BimOnlineAdapter],
  exports: [BimOnlineAdapter],
})
export class BimOnlineModule {}
