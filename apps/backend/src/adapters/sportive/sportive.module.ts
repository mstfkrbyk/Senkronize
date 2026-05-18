import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SportiveAdapter } from './sportive.adapter';

@Module({
  imports: [CommonModule],
  providers: [SportiveAdapter],
  exports: [SportiveAdapter],
})
export class SportiveModule {}
