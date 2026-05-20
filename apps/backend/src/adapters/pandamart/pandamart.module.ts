import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PandamartAdapter } from './pandamart.adapter';

@Module({
  imports: [CommonModule],
  providers: [PandamartAdapter],
  exports: [PandamartAdapter],
})
export class PandamartModule {}
