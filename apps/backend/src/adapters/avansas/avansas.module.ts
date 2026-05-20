import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AvansasAdapter } from './avansas.adapter';

@Module({
  imports: [CommonModule],
  providers: [AvansasAdapter],
  exports: [AvansasAdapter],
})
export class AvansasModule {}
