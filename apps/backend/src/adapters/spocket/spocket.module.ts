import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SpocketAdapter } from './spocket.adapter';

@Module({
  imports: [CommonModule],
  providers: [SpocketAdapter],
  exports: [SpocketAdapter],
})
export class SpocketModule {}
