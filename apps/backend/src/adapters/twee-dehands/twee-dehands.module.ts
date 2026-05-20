import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TweeDehandsAdapter } from './twee-dehands.adapter';

@Module({
  imports: [CommonModule],
  providers: [TweeDehandsAdapter],
  exports: [TweeDehandsAdapter],
})
export class TweeDehandsModule {}
