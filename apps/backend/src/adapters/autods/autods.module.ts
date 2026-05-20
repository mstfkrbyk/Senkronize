import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AutodsAdapter } from './autods.adapter';

@Module({
  imports: [CommonModule],
  providers: [AutodsAdapter],
  exports: [AutodsAdapter],
})
export class AutodsModule {}
