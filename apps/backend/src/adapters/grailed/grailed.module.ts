import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GrailedAdapter } from './grailed.adapter';

@Module({
  imports: [CommonModule],
  providers: [GrailedAdapter],
  exports: [GrailedAdapter],
})
export class GrailedModule {}
