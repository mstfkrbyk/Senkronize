import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { WillhabenAdapter } from './willhaben.adapter';

@Module({
  imports: [CommonModule],
  providers: [WillhabenAdapter],
  exports: [WillhabenAdapter],
})
export class WillhabenModule {}
