import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BebekComAdapter } from './bebek-com.adapter';

@Module({
  imports: [CommonModule],
  providers: [BebekComAdapter],
  exports: [BebekComAdapter],
})
export class BebekComModule {}
