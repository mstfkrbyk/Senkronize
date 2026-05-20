import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { HeurekaAdapter } from './heureka.adapter';

@Module({
  imports: [CommonModule],
  providers: [HeurekaAdapter],
  exports: [HeurekaAdapter],
})
export class HeurekaModule {}
