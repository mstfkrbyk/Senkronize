import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MyntraAdapter } from './myntra.adapter';

@Module({
  imports: [CommonModule],
  providers: [MyntraAdapter],
  exports: [MyntraAdapter],
})
export class MyntraModule {}
