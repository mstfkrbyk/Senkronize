import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KongaAdapter } from './konga.adapter';

@Module({
  imports: [CommonModule],
  providers: [KongaAdapter],
  exports: [KongaAdapter],
})
export class KongaModule {}
