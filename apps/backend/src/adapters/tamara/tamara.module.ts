import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TamaraAdapter } from './tamara.adapter';

@Module({
  imports: [CommonModule],
  providers: [TamaraAdapter],
  exports: [TamaraAdapter],
})
export class TamaraModule {}
