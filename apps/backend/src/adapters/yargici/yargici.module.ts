import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { YargiciAdapter } from './yargici.adapter';

@Module({
  imports: [CommonModule],
  providers: [YargiciAdapter],
  exports: [YargiciAdapter],
})
export class YargiciModule {}
