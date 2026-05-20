import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PrivaliaAdapter } from './privalia.adapter';

@Module({
  imports: [CommonModule],
  providers: [PrivaliaAdapter],
  exports: [PrivaliaAdapter],
})
export class PrivaliaModule {}
