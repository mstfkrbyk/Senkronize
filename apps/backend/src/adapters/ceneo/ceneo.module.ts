import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CeneoAdapter } from './ceneo.adapter';

@Module({
  imports: [CommonModule],
  providers: [CeneoAdapter],
  exports: [CeneoAdapter],
})
export class CeneoModule {}
