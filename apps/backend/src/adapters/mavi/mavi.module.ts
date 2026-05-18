import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MaviAdapter } from './mavi.adapter';

@Module({
  imports: [CommonModule],
  providers: [MaviAdapter],
  exports: [MaviAdapter],
})
export class MaviModule {}
