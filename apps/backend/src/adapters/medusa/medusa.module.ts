import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MedusaAdapter } from './medusa.adapter';

@Module({
  imports: [CommonModule],
  providers: [MedusaAdapter],
  exports: [MedusaAdapter],
})
export class MedusaModule {}
