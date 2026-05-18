import { Module } from '@nestjs/common';

import { HepsiburadaPremiumAdapter } from './hepsiburada-premium.adapter';

@Module({
  providers: [HepsiburadaPremiumAdapter],
  exports: [HepsiburadaPremiumAdapter],
})
export class HepsiburadaPremiumModule {}
