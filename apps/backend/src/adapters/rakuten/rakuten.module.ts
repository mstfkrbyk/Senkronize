import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { RakutenAdapter } from './rakuten.adapter';

@Module({
  imports: [CommonModule],
  providers: [RakutenAdapter],
  exports: [RakutenAdapter],
})
export class RakutenModule {}
