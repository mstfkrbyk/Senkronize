import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MallCzAdapter } from './mall-cz.adapter';

@Module({
  imports: [CommonModule],
  providers: [MallCzAdapter],
  exports: [MallCzAdapter],
})
export class MallCzModule {}
