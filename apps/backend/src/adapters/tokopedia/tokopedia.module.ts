import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TokopediaAdapter } from './tokopedia.adapter';

@Module({
  imports: [CommonModule],
  providers: [TokopediaAdapter],
  exports: [TokopediaAdapter],
})
export class TokopediaModule {}
