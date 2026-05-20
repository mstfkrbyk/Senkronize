import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CoupangAdapter } from './coupang.adapter';

@Module({
  imports: [CommonModule],
  providers: [CoupangAdapter],
  exports: [CoupangAdapter],
})
export class CoupangModule {}
