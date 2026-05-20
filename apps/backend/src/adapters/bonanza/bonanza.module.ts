import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BonanzaAdapter } from './bonanza.adapter';

@Module({
  imports: [CommonModule],
  providers: [BonanzaAdapter],
  exports: [BonanzaAdapter],
})
export class BonanzaModule {}
