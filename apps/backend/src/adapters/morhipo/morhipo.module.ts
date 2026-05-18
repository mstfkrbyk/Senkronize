import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MorhipoAdapter } from './morhipo.adapter';

@Module({
  imports: [CommonModule],
  providers: [MorhipoAdapter],
  exports: [MorhipoAdapter],
})
export class MorhipoModule {}
