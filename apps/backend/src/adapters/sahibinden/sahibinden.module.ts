import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SahibindenAdapter } from './sahibinden.adapter';

@Module({
  imports: [CommonModule],
  providers: [SahibindenAdapter],
  exports: [SahibindenAdapter],
})
export class SahibindenModule {}
