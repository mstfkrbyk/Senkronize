import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GrabmartAdapter } from './grabmart.adapter';

@Module({
  imports: [CommonModule],
  providers: [GrabmartAdapter],
  exports: [GrabmartAdapter],
})
export class GrabmartModule {}
