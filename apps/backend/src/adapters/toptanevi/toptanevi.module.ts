import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ToptaneviAdapter } from './toptanevi.adapter';

@Module({
  imports: [CommonModule],
  providers: [ToptaneviAdapter],
  exports: [ToptaneviAdapter],
})
export class ToptaneviModule {}
