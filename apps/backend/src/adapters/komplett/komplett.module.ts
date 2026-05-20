import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KomplettAdapter } from './komplett.adapter';

@Module({
  imports: [CommonModule],
  providers: [KomplettAdapter],
  exports: [KomplettAdapter],
})
export class KomplettModule {}
