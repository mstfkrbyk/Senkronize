import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LeroyMerlinAdapter } from './leroy-merlin.adapter';

@Module({
  imports: [CommonModule],
  providers: [LeroyMerlinAdapter],
  exports: [LeroyMerlinAdapter],
})
export class LeroyMerlinModule {}
