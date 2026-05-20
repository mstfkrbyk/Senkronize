import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { NoonAdapter } from './noon.adapter';

@Module({
  imports: [CommonModule],
  providers: [NoonAdapter],
  exports: [NoonAdapter],
})
export class NoonModule {}
