import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BoutiqaatAdapter } from './boutiqaat.adapter';

@Module({
  imports: [CommonModule],
  providers: [BoutiqaatAdapter],
  exports: [BoutiqaatAdapter],
})
export class BoutiqaatModule {}
