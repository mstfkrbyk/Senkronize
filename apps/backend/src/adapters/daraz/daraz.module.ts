import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DarazAdapter } from './daraz.adapter';

@Module({
  imports: [CommonModule],
  providers: [DarazAdapter],
  exports: [DarazAdapter],
})
export class DarazModule {}
