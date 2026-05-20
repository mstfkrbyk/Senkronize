import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { RicardoChAdapter } from './ricardo-ch.adapter';

@Module({
  imports: [CommonModule],
  providers: [RicardoChAdapter],
  exports: [RicardoChAdapter],
})
export class RicardoChModule {}
