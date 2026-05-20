import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BlibliAdapter } from './blibli.adapter';

@Module({
  imports: [CommonModule],
  providers: [BlibliAdapter],
  exports: [BlibliAdapter],
})
export class BlibliModule {}
