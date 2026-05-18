import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DrAdapter } from './dr.adapter';

@Module({
  imports: [CommonModule],
  providers: [DrAdapter],
  exports: [DrAdapter],
})
export class DrModule {}
