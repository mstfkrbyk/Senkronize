import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MadeinchinaAdapter } from './madeinchina.adapter';

@Module({
  imports: [CommonModule],
  providers: [MadeinchinaAdapter],
  exports: [MadeinchinaAdapter],
})
export class MadeinchinaModule {}
