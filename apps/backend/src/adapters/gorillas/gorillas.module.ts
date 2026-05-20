import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GorillasAdapter } from './gorillas.adapter';

@Module({
  imports: [CommonModule],
  providers: [GorillasAdapter],
  exports: [GorillasAdapter],
})
export class GorillasModule {}
