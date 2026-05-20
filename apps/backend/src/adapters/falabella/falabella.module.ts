import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FalabellaAdapter } from './falabella.adapter';

@Module({
  imports: [CommonModule],
  providers: [FalabellaAdapter],
  exports: [FalabellaAdapter],
})
export class FalabellaModule {}
