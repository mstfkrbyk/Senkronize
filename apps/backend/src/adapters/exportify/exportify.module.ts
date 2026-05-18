import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ExportifyAdapter } from './exportify.adapter';

@Module({
  imports: [CommonModule],
  providers: [ExportifyAdapter],
  exports: [ExportifyAdapter],
})
export class ExportifyModule {}
