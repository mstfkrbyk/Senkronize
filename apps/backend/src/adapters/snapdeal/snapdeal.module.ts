import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SnapdealAdapter } from './snapdeal.adapter';

@Module({
  imports: [CommonModule],
  providers: [SnapdealAdapter],
  exports: [SnapdealAdapter],
})
export class SnapdealModule {}
