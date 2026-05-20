import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TabbyAdapter } from './tabby.adapter';

@Module({
  imports: [CommonModule],
  providers: [TabbyAdapter],
  exports: [TabbyAdapter],
})
export class TabbyModule {}
