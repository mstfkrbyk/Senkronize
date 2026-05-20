import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AlibabaTrAdapter } from './alibaba-tr.adapter';

@Module({
  imports: [CommonModule],
  providers: [AlibabaTrAdapter],
  exports: [AlibabaTrAdapter],
})
export class AlibabaTrModule {}
