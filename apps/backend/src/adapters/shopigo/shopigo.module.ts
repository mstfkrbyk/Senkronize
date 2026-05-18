import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShopigoAdapter } from './shopigo.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShopigoAdapter],
  exports: [ShopigoAdapter],
})
export class ShopigoModule {}
