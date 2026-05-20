import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VenteExclusiveAdapter } from './vente-exclusive.adapter';

@Module({
  imports: [CommonModule],
  providers: [VenteExclusiveAdapter],
  exports: [VenteExclusiveAdapter],
})
export class VenteExclusiveModule {}
