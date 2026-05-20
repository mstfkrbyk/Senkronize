import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MercariJpAdapter } from './mercari-jp.adapter';

@Module({
  imports: [CommonModule],
  providers: [MercariJpAdapter],
  exports: [MercariJpAdapter],
})
export class MercariJpModule {}
