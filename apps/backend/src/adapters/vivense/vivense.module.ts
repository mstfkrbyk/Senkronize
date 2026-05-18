import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VivenseAdapter } from './vivense.adapter';

@Module({
  imports: [CommonModule],
  providers: [VivenseAdapter],
  exports: [VivenseAdapter],
})
export class VivenseModule {}
