import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SefamerveAdapter } from './sefamerve.adapter';

@Module({
  imports: [CommonModule],
  providers: [SefamerveAdapter],
  exports: [SefamerveAdapter],
})
export class SefamerveModule {}
