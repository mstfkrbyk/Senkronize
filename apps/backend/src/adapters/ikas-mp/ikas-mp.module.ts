import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { IkasMpAdapter } from './ikas-mp.adapter';

@Module({
  imports: [CommonModule],
  providers: [IkasMpAdapter],
  exports: [IkasMpAdapter],
})
export class IkasMpModule {}
