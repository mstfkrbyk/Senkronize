import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AdidasTrAdapter } from './adidas-tr.adapter';

@Module({
  imports: [CommonModule],
  providers: [AdidasTrAdapter],
  exports: [AdidasTrAdapter],
})
export class AdidasTrModule {}
