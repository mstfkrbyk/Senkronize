import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SendoAdapter } from './sendo.adapter';

@Module({
  imports: [CommonModule],
  providers: [SendoAdapter],
  exports: [SendoAdapter],
})
export class SendoModule {}
