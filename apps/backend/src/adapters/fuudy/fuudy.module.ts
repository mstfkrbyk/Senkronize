import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FuudyAdapter } from './fuudy.adapter';

@Module({
  imports: [CommonModule],
  providers: [FuudyAdapter],
  exports: [FuudyAdapter],
})
export class FuudyModule {}
