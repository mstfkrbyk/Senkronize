import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MigroshemenAdapter } from './migroshemen.adapter';

@Module({
  imports: [CommonModule],
  providers: [MigroshemenAdapter],
  exports: [MigroshemenAdapter],
})
export class MigroshemenModule {}
