import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CoppelAdapter } from './coppel.adapter';

@Module({
  imports: [CommonModule],
  providers: [CoppelAdapter],
  exports: [CoppelAdapter],
})
export class CoppelModule {}
