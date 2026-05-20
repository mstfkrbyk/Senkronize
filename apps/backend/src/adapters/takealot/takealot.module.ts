import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TakealotAdapter } from './takealot.adapter';

@Module({
  imports: [CommonModule],
  providers: [TakealotAdapter],
  exports: [TakealotAdapter],
})
export class TakealotModule {}
