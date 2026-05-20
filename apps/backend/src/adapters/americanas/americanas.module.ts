import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AmericanasAdapter } from './americanas.adapter';

@Module({
  imports: [CommonModule],
  providers: [AmericanasAdapter],
  exports: [AmericanasAdapter],
})
export class AmericanasModule {}
