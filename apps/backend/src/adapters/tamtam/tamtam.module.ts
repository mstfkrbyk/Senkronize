import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TamtamAdapter } from './tamtam.adapter';

@Module({
  imports: [CommonModule],
  providers: [TamtamAdapter],
  exports: [TamtamAdapter],
})
export class TamtamModule {}
