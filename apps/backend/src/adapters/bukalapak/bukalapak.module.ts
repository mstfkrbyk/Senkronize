import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BukalapakAdapter } from './bukalapak.adapter';

@Module({
  imports: [CommonModule],
  providers: [BukalapakAdapter],
  exports: [BukalapakAdapter],
})
export class BukalapakModule {}
