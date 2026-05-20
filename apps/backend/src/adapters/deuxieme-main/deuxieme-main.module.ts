import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DeuxiemeMainAdapter } from './deuxieme-main.adapter';

@Module({
  imports: [CommonModule],
  providers: [DeuxiemeMainAdapter],
  exports: [DeuxiemeMainAdapter],
})
export class DeuxiemeMainModule {}
