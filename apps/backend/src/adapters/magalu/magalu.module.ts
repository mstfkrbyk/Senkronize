import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MagaluAdapter } from './magalu.adapter';

@Module({
  imports: [CommonModule],
  providers: [MagaluAdapter],
  exports: [MagaluAdapter],
})
export class MagaluModule {}
