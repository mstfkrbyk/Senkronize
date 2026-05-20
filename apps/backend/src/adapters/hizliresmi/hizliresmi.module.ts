import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { HizliresmiAdapter } from './hizliresmi.adapter';

@Module({
  imports: [CommonModule],
  providers: [HizliresmiAdapter],
  exports: [HizliresmiAdapter],
})
export class HizliresmiModule {}
