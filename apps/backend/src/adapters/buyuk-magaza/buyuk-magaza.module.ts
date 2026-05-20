import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BuyukMagazaAdapter } from './buyuk-magaza.adapter';

@Module({
  imports: [CommonModule],
  providers: [BuyukMagazaAdapter],
  exports: [BuyukMagazaAdapter],
})
export class BuyukMagazaModule {}
