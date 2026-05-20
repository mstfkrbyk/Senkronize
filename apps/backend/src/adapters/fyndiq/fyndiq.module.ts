import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FyndiqAdapter } from './fyndiq.adapter';

@Module({
  imports: [CommonModule],
  providers: [FyndiqAdapter],
  exports: [FyndiqAdapter],
})
export class FyndiqModule {}
