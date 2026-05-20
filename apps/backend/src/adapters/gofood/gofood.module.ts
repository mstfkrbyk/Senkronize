import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GofoodAdapter } from './gofood.adapter';

@Module({
  imports: [CommonModule],
  providers: [GofoodAdapter],
  exports: [GofoodAdapter],
})
export class GofoodModule {}
