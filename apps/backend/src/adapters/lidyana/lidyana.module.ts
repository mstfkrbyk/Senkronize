import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LidyanaAdapter } from './lidyana.adapter';

@Module({
  imports: [CommonModule],
  providers: [LidyanaAdapter],
  exports: [LidyanaAdapter],
})
export class LidyanaModule {}
