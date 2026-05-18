import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LetgoAdapter } from './letgo.adapter';

@Module({
  imports: [CommonModule],
  providers: [LetgoAdapter],
  exports: [LetgoAdapter],
})
export class LetgoModule {}
