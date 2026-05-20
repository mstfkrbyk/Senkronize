import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AuchanAdapter } from './auchan.adapter';

@Module({
  imports: [CommonModule],
  providers: [AuchanAdapter],
  exports: [AuchanAdapter],
})
export class AuchanModule {}
