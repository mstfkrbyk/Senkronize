import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TiseAdapter } from './tise.adapter';

@Module({
  imports: [CommonModule],
  providers: [TiseAdapter],
  exports: [TiseAdapter],
})
export class TiseModule {}
