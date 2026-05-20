import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LinioAdapter } from './linio.adapter';

@Module({
  imports: [CommonModule],
  providers: [LinioAdapter],
  exports: [LinioAdapter],
})
export class LinioModule {}
