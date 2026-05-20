import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CimriAdapter } from './cimri.adapter';

@Module({
  imports: [CommonModule],
  providers: [CimriAdapter],
  exports: [CimriAdapter],
})
export class CimriModule {}
