import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LamodaAdapter } from './lamoda.adapter';

@Module({
  imports: [CommonModule],
  providers: [LamodaAdapter],
  exports: [LamodaAdapter],
})
export class LamodaModule {}
