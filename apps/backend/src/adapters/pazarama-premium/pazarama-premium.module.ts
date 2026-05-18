import { Module } from '@nestjs/common';

import { PazaramaPremiumAdapter } from './pazarama-premium.adapter';

@Module({
  providers: [PazaramaPremiumAdapter],
  exports: [PazaramaPremiumAdapter],
})
export class PazaramaPremiumModule {}
