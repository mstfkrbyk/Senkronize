import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KuklaAdapter } from './kukla.adapter';

@Module({
  imports: [CommonModule],
  providers: [KuklaAdapter],
  exports: [KuklaAdapter],
})
export class KuklaModule {}
