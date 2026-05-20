import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TokopediaFlashAdapter } from './tokopedia-flash.adapter';

@Module({
  imports: [CommonModule],
  providers: [TokopediaFlashAdapter],
  exports: [TokopediaFlashAdapter],
})
export class TokopediaFlashModule {}
