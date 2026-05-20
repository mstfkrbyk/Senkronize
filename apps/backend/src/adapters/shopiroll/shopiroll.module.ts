import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShopirollAdapter } from './shopiroll.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShopirollAdapter],
  exports: [ShopirollAdapter],
})
export class ShopirollModule {}
