import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { EllosAdapter } from './ellos.adapter';

@Module({
  imports: [CommonModule],
  providers: [EllosAdapter],
  exports: [EllosAdapter],
})
export class EllosModule {}
