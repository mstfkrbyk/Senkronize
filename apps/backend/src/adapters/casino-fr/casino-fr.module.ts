import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CasinoFrAdapter } from './casino-fr.adapter';

@Module({
  imports: [CommonModule],
  providers: [CasinoFrAdapter],
  exports: [CasinoFrAdapter],
})
export class CasinoFrModule {}
