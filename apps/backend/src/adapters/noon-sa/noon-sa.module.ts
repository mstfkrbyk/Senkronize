import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { NoonSaAdapter } from './noon-sa.adapter';

@Module({
  imports: [CommonModule],
  providers: [NoonSaAdapter],
  exports: [NoonSaAdapter],
})
export class NoonSaModule {}
