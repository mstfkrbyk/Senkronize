import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FinnNoAdapter } from './finn-no.adapter';

@Module({
  imports: [CommonModule],
  providers: [FinnNoAdapter],
  exports: [FinnNoAdapter],
})
export class FinnNoModule {}
