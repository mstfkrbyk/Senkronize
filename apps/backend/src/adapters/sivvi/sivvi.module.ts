import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SivviAdapter } from './sivvi.adapter';

@Module({
  imports: [CommonModule],
  providers: [SivviAdapter],
  exports: [SivviAdapter],
})
export class SivviModule {}
