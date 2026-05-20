import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SahibindenPremiumAdapter } from './sahibinden-premium.adapter';

@Module({
  imports: [CommonModule],
  providers: [SahibindenPremiumAdapter],
  exports: [SahibindenPremiumAdapter],
})
export class SahibindenPremiumModule {}
