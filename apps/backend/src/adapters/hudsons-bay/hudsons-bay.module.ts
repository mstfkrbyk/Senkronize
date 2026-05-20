import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { HudsonsBayAdapter } from './hudsons-bay.adapter';

@Module({
  imports: [CommonModule],
  providers: [HudsonsBayAdapter],
  exports: [HudsonsBayAdapter],
})
export class HudsonsBayModule {}
