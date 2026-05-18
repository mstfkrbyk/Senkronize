import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { HepsiexpressAdapter } from './hepsiexpress.adapter';

@Module({
  imports: [CommonModule],
  providers: [HepsiexpressAdapter],
  exports: [HepsiexpressAdapter],
})
export class HepsiexpressModule {}
