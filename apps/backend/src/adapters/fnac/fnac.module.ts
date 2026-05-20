import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { FnacAdapter } from './fnac.adapter';

@Module({
  imports: [CommonModule],
  providers: [FnacAdapter],
  exports: [FnacAdapter],
})
export class FnacModule {}
