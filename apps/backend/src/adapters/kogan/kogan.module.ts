import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KoganAdapter } from './kogan.adapter';

@Module({
  imports: [CommonModule],
  providers: [KoganAdapter],
  exports: [KoganAdapter],
})
export class KoganModule {}
