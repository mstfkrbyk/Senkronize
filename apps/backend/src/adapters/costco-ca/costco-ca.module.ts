import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CostcoCaAdapter } from './costco-ca.adapter';

@Module({
  imports: [CommonModule],
  providers: [CostcoCaAdapter],
  exports: [CostcoCaAdapter],
})
export class CostcoCaModule {}
