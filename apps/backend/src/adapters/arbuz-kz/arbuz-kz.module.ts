import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ArbuzKzAdapter } from './arbuz-kz.adapter';

@Module({
  imports: [CommonModule],
  providers: [ArbuzKzAdapter],
  exports: [ArbuzKzAdapter],
})
export class ArbuzKzModule {}
