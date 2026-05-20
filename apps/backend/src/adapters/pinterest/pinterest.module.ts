import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PinterestAdapter } from './pinterest.adapter';

@Module({
  imports: [CommonModule],
  providers: [PinterestAdapter],
  exports: [PinterestAdapter],
})
export class PinterestModule {}
