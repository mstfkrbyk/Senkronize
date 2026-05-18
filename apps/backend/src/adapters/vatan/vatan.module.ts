import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VatanAdapter } from './vatan.adapter';

@Module({
  imports: [CommonModule],
  providers: [VatanAdapter],
  exports: [VatanAdapter],
})
export class VatanModule {}
