import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GlobalSourcesAdapter } from './global-sources.adapter';

@Module({
  imports: [CommonModule],
  providers: [GlobalSourcesAdapter],
  exports: [GlobalSourcesAdapter],
})
export class GlobalSourcesModule {}
