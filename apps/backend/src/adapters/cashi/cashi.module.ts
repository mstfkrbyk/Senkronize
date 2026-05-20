import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CashiAdapter } from './cashi.adapter';

@Module({
  imports: [CommonModule],
  providers: [CashiAdapter],
  exports: [CashiAdapter],
})
export class CashiModule {}
