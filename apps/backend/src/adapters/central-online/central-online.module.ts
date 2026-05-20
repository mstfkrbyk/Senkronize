import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CentralOnlineAdapter } from './central-online.adapter';

@Module({
  imports: [CommonModule],
  providers: [CentralOnlineAdapter],
  exports: [CentralOnlineAdapter],
})
export class CentralOnlineModule {}
