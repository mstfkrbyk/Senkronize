import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BanabiAdapter } from './banabi.adapter';

@Module({
  imports: [CommonModule],
  providers: [BanabiAdapter],
  exports: [BanabiAdapter],
})
export class BanabiModule {}
