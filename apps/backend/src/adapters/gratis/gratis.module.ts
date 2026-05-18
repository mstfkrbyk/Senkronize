import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GratisAdapter } from './gratis.adapter';

@Module({
  imports: [CommonModule],
  providers: [GratisAdapter],
  exports: [GratisAdapter],
})
export class GratisModule {}
