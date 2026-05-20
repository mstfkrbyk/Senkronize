import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GrabMartAdapter } from './grab-mart.adapter';

@Module({
  imports: [CommonModule],
  providers: [GrabMartAdapter],
  exports: [GrabMartAdapter],
})
export class GrabMartModule {}
