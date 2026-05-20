import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BigwAdapter } from './bigw.adapter';

@Module({
  imports: [CommonModule],
  providers: [BigwAdapter],
  exports: [BigwAdapter],
})
export class BigwModule {}
