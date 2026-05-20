import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MegatradeAdapter } from './megatrade.adapter';

@Module({
  imports: [CommonModule],
  providers: [MegatradeAdapter],
  exports: [MegatradeAdapter],
})
export class MegatradeModule {}
