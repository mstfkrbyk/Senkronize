import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { OlxPtAdapter } from './olx-pt.adapter';

@Module({
  imports: [CommonModule],
  providers: [OlxPtAdapter],
  exports: [OlxPtAdapter],
})
export class OlxPtModule {}
